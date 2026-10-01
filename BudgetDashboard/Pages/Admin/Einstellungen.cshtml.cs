using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages.Admin;

[Authorize(Policy = "AdminOnly")]
public class EinstellungenModel : PageModel
{
    private readonly AccountService _accounts;
    public EinstellungenModel(AccountService accounts) => _accounts = accounts;

    [BindProperty] public string? Title { get; set; }
    [BindProperty] public string? Aktuell { get; set; }
    [BindProperty] public string? Neu { get; set; }
    [BindProperty] public string? Wiederholung { get; set; }

    public List<string> Errors { get; private set; } = new();
    public string? Notice => TempData["Notice"] as string;

    public string? Confirm { get; private set; }
    public int TestCount => _accounts.TestDataCount();

    public void OnGet() => Title = _accounts.GetTitle();

    public IActionResult OnPostAskImport() { Title = _accounts.GetTitle(); Confirm = "import"; return Page(); }

    public IActionResult OnPostAskDelete() { Title = _accounts.GetTitle(); Confirm = "delete"; return Page(); }

    public IActionResult OnPostImport(bool confirmed)
    {
        if (!confirmed) return RedirectToPage();
        var n = _accounts.ImportTestData();
        TempData["Notice"] = $"Die Testdaten sind importiert ({n} Kostenstellen). Alle vorherigen Kostenstellen sind gelöscht.";
        return RedirectToPage();
    }

    public IActionResult OnPostDeleteTest(bool confirmed)
    {
        if (!confirmed) return RedirectToPage();
        var n = _accounts.DeleteTestData();
        TempData["Notice"] = $"{n} Testkostenstellen sind gelöscht.";
        return RedirectToPage();
    }

    public IActionResult OnPostTitle()
    {
        var result = _accounts.SetTitle(Title);
        if (!result.Ok)
        {
            Errors = result.Errors;
            return Page();
        }
        TempData["Notice"] = "Der Titel der Anwendung ist geändert.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostPasswordAsync()
    {
        var (result, account) = _accounts.ChangePassword(User.Identity!.Name!, Aktuell, Neu, Wiederholung);
        Title = _accounts.GetTitle();
        if (!result.Ok)
        {
            Errors = result.Errors;
            return Page();
        }
        await HttpContext.SignInAsync(account!);
        TempData["Notice"] = "Das Admin-Passwort ist geändert.";
        return RedirectToPage();
    }
}
