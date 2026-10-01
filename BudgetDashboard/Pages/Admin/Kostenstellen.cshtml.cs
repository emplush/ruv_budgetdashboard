using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages.Admin;

[Authorize(Policy = "AdminOnly")]
public class KostenstellenModel : PageModel
{
    private readonly AccountService _accounts;
    public KostenstellenModel(AccountService accounts) => _accounts = accounts;

    [BindProperty] public string? NewNumber { get; set; }
    [BindProperty] public string? NewOrgUnit { get; set; }
    [BindProperty] public string? NewGroup { get; set; }
    [BindProperty] public bool NewEnabled { get; set; } = true;
    [BindProperty] public bool NewHead { get; set; }

    public List<CostCenterRow> Rows { get; private set; } = new();
    public List<string> Errors { get; private set; } = new();
    public string? Notice => TempData["Notice"] as string;

    public void OnGet() => Rows = _accounts.List();

    public IActionResult OnPostAdd()
    {
        var result = _accounts.AddCostCenter(NewNumber, NewOrgUnit, NewGroup, NewEnabled, NewHead);
        if (!result.Ok)
        {
            Errors = result.Errors;
            Rows = _accounts.List();
            return Page();
        }
        return Done($"Kostenstelle {NewNumber!.Trim()} ist angelegt.");
    }

    public IActionResult OnPostSave(string number, string? orgUnit, string? group, bool enabled) =>
        Handle(_accounts.UpdateCostCenter(number, orgUnit, group, enabled), $"Kostenstelle {number} ist gespeichert.");

    public IActionResult OnPostDelete(string number) =>
        Handle(_accounts.DeleteCostCenter(number), $"Kostenstelle {number} ist entfernt.");

    public IActionResult OnPostResetPassword(string number) =>
        Handle(_accounts.ResetPassword(number), $"Das Passwort der Kostenstelle {number} ist gelöscht. Beim nächsten Anmelden wird ein neues gesetzt.");

    public IActionResult OnPostHead(string number, bool makeHead) =>
        Handle(_accounts.SetDepartmentHead(makeHead ? number : null),
            makeHead ? $"Kostenstelle {number} hat jetzt Abteilungsleiterrechte." : $"Kostenstelle {number} hat keine Abteilungsleiterrechte mehr.");

    private IActionResult Handle(OperationResult result, string notice)
    {
        if (!result.Ok)
        {
            Errors = result.Errors;
            Rows = _accounts.List();
            return Page();
        }
        return Done(notice);
    }

    private IActionResult Done(string notice)
    {
        TempData["Notice"] = notice;
        return RedirectToPage();
    }
}
