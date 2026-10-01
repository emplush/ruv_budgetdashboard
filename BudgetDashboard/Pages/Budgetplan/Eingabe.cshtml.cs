using BudgetDashboard.Models;
using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages.Budgetplan;

[Authorize(Policy = "User")]
public class EingabeModel : PageModel
{
    private readonly BudgetService _budget;
    public EingabeModel(BudgetService budget) => _budget = budget;

    [BindProperty] public string? Bezeichnung { get; set; }
    [BindProperty] public string? Betrag { get; set; }
    [BindProperty] public string? Netto { get; set; }
    [BindProperty] public int Jahr { get; set; }
    [BindProperty] public string? Hinweis { get; set; }

    public bool IsDepartmentHead => User.IsInRole(Roles.DepartmentHead);
    public List<int> Years { get; private set; } = new();
    public List<BudgetRow> Items { get; private set; } = new();
    public List<string> Errors { get; private set; } = new();
    public string? Notice => TempData["Notice"] as string;

    public void OnGet() => Load();

    public IActionResult OnPostSubmit()
    {
        var result = _budget.Submit(User.Identity!.Name!, Bezeichnung, Betrag, Netto, Jahr, Hinweis, autoApprove: IsDepartmentHead);
        if (!result.Ok)
        {
            Errors = result.Errors;
            Load();
            return Page();
        }
        TempData["Notice"] = IsDepartmentHead
            ? "Die Budgetposition ist angelegt und direkt freigegeben."
            : "Die Budgetposition ist zur Freigabe an die Abteilungsleitung gesendet.";
        return RedirectToPage();
    }

    public IActionResult OnPostDelete(string id)
    {
        var result = _budget.DeleteOwn(User.Identity!.Name!, id);
        if (!result.Ok)
        {
            Errors = result.Errors;
            Load();
            return Page();
        }
        TempData["Notice"] = "Der Eintrag ist gelöscht.";
        return RedirectToPage();
    }

    private void Load()
    {
        Years = _budget.EnabledYears();
        if (Jahr == 0 || !Years.Contains(Jahr)) Jahr = Years.FirstOrDefault();
        Items = _budget.OwnOpenItems(User.Identity!.Name!);
    }
}
