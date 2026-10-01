using BudgetDashboard.Models;
using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages.Budgetplan;

[Authorize(Policy = "User")]
public class GesamtModel : PageModel
{
    private readonly BudgetService _budget;
    public GesamtModel(BudgetService budget) => _budget = budget;

    public bool IsDepartmentHead => User.IsInRole(Roles.DepartmentHead);
    public List<YearSummary> Overview { get; private set; } = new();
    public List<GroupYearRow> Groups { get; private set; } = new();

    public void OnGet()
    {
        Overview = _budget.Overview(IsDepartmentHead ? null : User.Identity!.Name);
        if (IsDepartmentHead) Groups = _budget.ByGroup();
    }
}
