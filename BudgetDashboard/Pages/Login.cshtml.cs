using BudgetDashboard.Models;
using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.RateLimiting;

namespace BudgetDashboard.Pages;

[AllowAnonymous]
[EnableRateLimiting("login")]
public class LoginModel : PageModel
{
    private readonly AccountService _accounts;
    private readonly SetupTokenService _tokens;

    public LoginModel(AccountService accounts, SetupTokenService tokens)
    {
        _accounts = accounts;
        _tokens = tokens;
    }

    [BindProperty] public string? Kostenstelle { get; set; }
    [BindProperty] public string? Passwort { get; set; }
    [BindProperty(SupportsGet = true)] public string? ReturnUrl { get; set; }
    public string? Error { get; private set; }

    public IActionResult OnGet() =>
        User.Identity?.IsAuthenticated == true ? LocalRedirect(User.HomeFor()) : Page();

    public async Task<IActionResult> OnPostAsync()
    {
        var result = _accounts.Login(Kostenstelle, Passwort);
        switch (result.Status)
        {
            case LoginStatus.Success:
                await HttpContext.SignInAsync(result.Account!);
                if (result.Account!.Role != Roles.Admin && !string.IsNullOrEmpty(ReturnUrl) && Url.IsLocalUrl(ReturnUrl))
                    return LocalRedirect(ReturnUrl);
                return LocalRedirect(result.Account.Role == Roles.Admin ? "~/Admin/Dashboard" : "~/Dashboard");

            case LoginStatus.NeedsPassword:
                Response.Cookies.Append(SetupTokenService.CookieName, _tokens.Create(Kostenstelle!.Trim()), new CookieOptions
                {
                    HttpOnly = true,
                    SameSite = SameSiteMode.Strict,
                    Secure = Request.IsHttps,
                    MaxAge = SetupTokenService.Lifetime,
                    IsEssential = true
                });
                return RedirectToPage("/SetPassword");

            case LoginStatus.LockedOut:
                Error = $"Wegen mehrerer Fehlversuche ist die Anmeldung für etwa {Math.Max(1, result.LockMinutes)} Minuten gesperrt. Bitte versuche es später erneut.";
                break;

            default:
                Error = "Kostenstelle oder Passwort stimmt nicht. Bitte prüfe Deine Eingaben.";
                break;
        }
        Passwort = null;
        return Page();
    }
}
