using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages;

[Authorize(Policy = "User")]
public class ProfilModel : PageModel
{
    private readonly AccountService _accounts;
    public ProfilModel(AccountService accounts) => _accounts = accounts;

    [BindProperty] public string? Aktuell { get; set; }
    [BindProperty] public string? Neu { get; set; }
    [BindProperty] public string? Wiederholung { get; set; }
    public List<string> Errors { get; private set; } = new();
    public bool Success => TempData["PasswordChanged"] is true;

    public async Task<IActionResult> OnPostAsync()
    {
        var (result, account) = _accounts.ChangePassword(User.Identity!.Name!, Aktuell, Neu, Wiederholung);
        if (!result.Ok)
        {
            Errors = result.Errors;
            return Page();
        }
        await HttpContext.SignInAsync(account!);
        TempData["PasswordChanged"] = true;
        return RedirectToPage();
    }
}
