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

    [BindProperty] public string? Org { get; set; }
    [BindProperty] public string? Group { get; set; }
    [BindProperty] public string? Aktuell { get; set; }
    [BindProperty] public string? Neu { get; set; }
    [BindProperty] public string? Wiederholung { get; set; }
    public List<string> Errors { get; private set; } = new();
    public List<string> DetailErrors { get; private set; } = new();
    public bool Success => TempData["PasswordChanged"] is true;
    public bool DetailsSaved => TempData["DetailsSaved"] is true;

    public void OnGet() => LoadDetails();

    public IActionResult OnPostDetails()
    {
        var result = _accounts.UpdateOwnDetails(User.Identity!.Name!, Org, Group);
        if (!result.Ok)
        {
            DetailErrors = result.Errors;
            return Page();
        }
        TempData["DetailsSaved"] = true;
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostPasswordAsync()
    {
        var (result, account) = _accounts.ChangePassword(User.Identity!.Name!, Aktuell, Neu, Wiederholung);
        if (!result.Ok)
        {
            Errors = result.Errors;
            LoadDetails();
            return Page();
        }
        await HttpContext.SignInAsync(account!);
        TempData["PasswordChanged"] = true;
        return RedirectToPage();
    }

    private void LoadDetails()
    {
        var p = _accounts.Profile(User.Identity!.Name!);
        Org = p?.OrgUnit;
        Group = p?.Group;
    }
}
