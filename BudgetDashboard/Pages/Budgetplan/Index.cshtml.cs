using BudgetDashboard.Models;
using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages.Budgetplan;

[Authorize(Policy = "User")]
public class AktuellerStandModel : PageModel
{
    private readonly BudgetService _budget;
    public AktuellerStandModel(BudgetService budget) => _budget = budget;

    [BindProperty(SupportsGet = true)] public int? Jahr { get; set; }
    public List<int> Years { get; private set; } = new();
    public int Year { get; private set; }
    public List<BudgetRow> Rows { get; private set; } = new();
    public bool IsDepartmentHead => User.IsInRole(Roles.DepartmentHead);

    public void OnGet()
    {
        Years = _budget.EnabledYears();
        if (Years.Count == 0) return;
        Year = Jahr is { } j && Years.Contains(j) ? j : Years[0];
        Rows = _budget.Approved(IsDepartmentHead ? null : User.Identity!.Name, Year);
    }
}
