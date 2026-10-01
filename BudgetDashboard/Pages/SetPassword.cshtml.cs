using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.RateLimiting;

namespace BudgetDashboard.Pages;

[AllowAnonymous]
[EnableRateLimiting("login")]
public class SetPasswordModel : PageModel
{
    private readonly AccountService _accounts;
    private readonly SetupTokenService _tokens;

    public SetPasswordModel(AccountService accounts, SetupTokenService tokens)
    {
        _accounts = accounts;
        _tokens = tokens;
    }

    [BindProperty] public string? NeuesPasswort { get; set; }
    [BindProperty] public string? Wiederholung { get; set; }
    public string Number { get; private set; } = "";
    public List<string> Errors { get; private set; } = new();

    public IActionResult OnGet() => Load() ? Page() : RedirectToPage("/Login");

    public async Task<IActionResult> OnPostAsync()
    {
        if (!Load()) return RedirectToPage("/Login");

        if (NeuesPasswort != Wiederholung)
        {
            Errors.Add("Die beiden Passwörter stimmen nicht überein.");
            return Page();
        }

        var (result, account) = _accounts.SetInitialPassword(Number, NeuesPasswort);
        if (!result.Ok)
        {
            Errors = result.Errors;
            return Page();
        }

        Response.Cookies.Delete(SetupTokenService.CookieName);
        await HttpContext.SignInAsync(account!);
        return LocalRedirect("/Dashboard");
    }

    private bool Load()
    {
        var number = _tokens.Read(Request.Cookies[SetupTokenService.CookieName]);
        if (number == null || _accounts.Find(number) is null) return false;
        Number = number;
        return true;
    }
}
