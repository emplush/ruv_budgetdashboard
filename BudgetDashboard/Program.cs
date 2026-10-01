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

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.Cookie.Name = "bd2.auth";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Strict;
        o.Cookie.SecurePolicy = requireHttps ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
        o.ExpireTimeSpan = TimeSpan.FromMinutes(builder.Configuration.GetValue("Security:SessionMinutes", 30));
        o.SlidingExpiration = true;
        o.LoginPath = "/Login";
        o.AccessDeniedPath = "/AccessDenied";
        o.Events.OnValidatePrincipal = async ctx =>
        {
            var accounts = ctx.HttpContext.RequestServices.GetRequiredService<AccountService>();
            var info = accounts.Find(ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier));
            if (info == null
                || info.Stamp != ctx.Principal?.FindFirstValue("stamp")
                || info.Role != ctx.Principal?.FindFirstValue(ClaimTypes.Role))
            {
                ctx.RejectPrincipal();
                await ctx.HttpContext.SignOutAsync();
            }
        };
    });

builder.Services.AddAuthorization(o =>
{
    o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
    o.AddPolicy("AdminOnly", p => p.RequireRole(Roles.Admin));
    o.AddPolicy("User", p => p.RequireRole(Roles.DepartmentHead, Roles.GroupLead));
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

// Mit Standardpasswort muss die Administration zuerst ein eigenes Passwort setzen.
app.Use(async (ctx, next) =>
{
    if (ctx.User.IsInRole(Roles.Admin)
        && ctx.RequestServices.GetRequiredService<AccountService>().AdminMustChangePassword
        && !ctx.Request.Path.StartsWithSegments("/Admin/Einstellungen")
        && !ctx.Request.Path.StartsWithSegments("/Logout"))
    {
        ctx.Response.Redirect("/Admin/Einstellungen");
        return;
    }
    await next();
});

app.UseAuthorization();
app.MapRazorPages();
app.Run();

public partial class Program;
