using System.Security.Claims;
using System.Threading.RateLimiting;
using BudgetDashboard.Models;
using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);
var requireHttps = builder.Configuration.GetValue("Security:RequireHttps", false);

builder.Services.AddSingleton<PasswordService>();
builder.Services.AddSingleton<DataStore>();
builder.Services.AddSingleton<AccountService>();
builder.Services.AddSingleton<SetupTokenService>();
builder.Services.AddSingleton<ViewAsTokenService>();
builder.Services.AddSingleton<BudgetService>();

// Schlüssel liegen im Datenordner, weil der IIS-Anwendungspool oft kein Benutzerprofil hat.
var keyDir = Path.Combine(
    string.IsNullOrWhiteSpace(builder.Configuration["Storage:Path"])
        ? Path.Combine(builder.Environment.ContentRootPath, "App_Data")
        : builder.Configuration["Storage:Path"]!,
    "keys");
Directory.CreateDirectory(keyDir);
builder.Services.AddDataProtection()
    .SetApplicationName("BudgetDashboard2")
    .PersistKeysToFileSystem(new DirectoryInfo(keyDir));

const string ViewScheme = "View";

void ConfigureCookie(CookieAuthenticationOptions o, string name, bool view)
{
    o.Cookie.Name = name;
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = requireHttps ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
    o.ExpireTimeSpan = TimeSpan.FromMinutes(builder.Configuration.GetValue("Security:SessionMinutes", 30));
    o.SlidingExpiration = true;
    o.LoginPath = view ? "/AnsichtBeendet" : "/Login";
    o.AccessDeniedPath = "/AccessDenied";
    o.Events.OnValidatePrincipal = async ctx =>
    {
        var accounts = ctx.HttpContext.RequestServices.GetRequiredService<AccountService>();
        var info = accounts.Find(ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier));
        var valid = info != null
            && info.Stamp == ctx.Principal?.FindFirstValue("stamp")
            && info.Role == ctx.Principal?.FindFirstValue(ClaimTypes.Role);
        // Eine Kostenstellen-Ansicht gilt nur, solange die Administration angemeldet ist.
        if (valid && view)
        {
            var admin = await ctx.HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            valid = admin.Succeeded && admin.Principal!.IsInRole(Roles.Admin);
        }
        if (!valid)
        {
            ctx.RejectPrincipal();
            await ctx.HttpContext.SignOutAsync(view ? ViewScheme : CookieAuthenticationDefaults.AuthenticationScheme);
        }
    };
}

// Die Ansicht einer Kostenstelle läuft unter dem Pfad /_ansicht mit eigenem Cookie, damit die
// Admin-Sitzung im anderen Tab erhalten bleibt.
builder.Services
    .AddAuthentication("Smart")
    .AddPolicyScheme("Smart", "Smart", o =>
        o.ForwardDefaultSelector = ctx => ctx.Request.IsViewScope() ? ViewScheme : CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, o => ConfigureCookie(o, "bd2.auth", false))
    .AddCookie(ViewScheme, o => ConfigureCookie(o, "bd2.view", true));

builder.Services.AddAuthorization(o =>
{
    o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
    o.AddPolicy("AdminOnly", p => p.RequireRole(Roles.Admin));
    o.AddPolicy("User", p => p.RequireRole(Roles.DepartmentHead, Roles.GroupLead));
    o.AddPolicy("GroupLead", p => p.RequireRole(Roles.GroupLead));
    o.AddPolicy("DepartmentHead", p => p.RequireRole(Roles.DepartmentHead));
});

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.ContentType = "text/plain; charset=utf-8";
        await ctx.HttpContext.Response.WriteAsync("Zu viele Anfragen. Bitte warte einige Minuten und versuche es dann erneut.", ct);
    };
    // Nur Absendungen (POST) zählen; Fehlversuche je Kostenstelle begrenzt zusätzlich AccountService.
    var loginLimit = builder.Configuration.GetValue("Security:LoginRequestsPer5Minutes", 40);
    o.AddPolicy("login", http => HttpMethods.IsPost(http.Request.Method)
        ? RateLimitPartition.GetFixedWindowLimiter(
            http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = loginLimit, Window = TimeSpan.FromMinutes(5), QueueLimit = 0 })
        : RateLimitPartition.GetNoLimiter("get"));
});

builder.Services.AddRazorPages();

if (requireHttps)
{
    builder.Services.AddHsts(o => o.MaxAge = TimeSpan.FromDays(365));
    builder.Services.AddHttpsRedirection(o => o.HttpsPort = builder.Configuration.GetValue("Security:HttpsPort", 443));
}

var app = builder.Build();

// /_ansicht/... wird zum PathBase; in der Ansicht sind nur Lesezugriffe erlaubt (Ausnahme: Beenden).
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments(SignInHelper.ViewSegment, out var rest))
    {
        ctx.Request.PathBase = ctx.Request.PathBase.Add(SignInHelper.ViewSegment);
        ctx.Request.Path = rest;
        if (!HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method)
            && !rest.StartsWithSegments("/Logout"))
        {
            ctx.Request.Method = HttpMethods.Get;
            ctx.Request.Path = "/AnsichtNurLesen";
            ctx.Request.QueryString = QueryString.Empty;
        }
    }
    await next();
});

if (requireHttps)
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseStaticFiles();

app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'";
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "same-origin";
    h["Cache-Control"] = "no-store";
    await next();
});

app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();

app.UseAuthorization();
app.MapRazorPages();
app.Run();

public partial class Program;
