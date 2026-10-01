using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages.Budgetfreigaben;

[Authorize(Policy = "DepartmentHead")]
public class DashboardModel : PageModel
{
    private readonly BudgetService _budget;
    public DashboardModel(BudgetService budget) => _budget = budget;

    public int PendingCount { get; private set; }
    public int EnabledYears { get; private set; }
    public List<YearSummary> Overview { get; private set; } = new();
    public List<GroupYearRow> Groups { get; private set; } = new();

    public void OnGet()
    {
        PendingCount = _budget.PendingCount();
        EnabledYears = _budget.EnabledYears().Count;
        Overview = _budget.Overview(null);
        Groups = _budget.ByGroup();
    }
}
