using BudgetDashboard.Models;
using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages.Budgetplan;

[Authorize(Policy = "User")]
public class GesamtModel : PageModel
{
    private readonly BudgetService _budget;
    public GesamtModel(BudgetService budget) => _budget = budget;

    [BindProperty(SupportsGet = true)] public string? Ks { get; set; }
    public List<YearSummary> Overview { get; private set; } = new();
    public ScopeInfo Scope { get; private set; } = new("", new(), "");
    public string ScopeTitle => Scope.Number == User.Identity!.Name ? "" : " der Kostenstelle " + Scope.Number + (Scope.Group.Length > 0 ? " (" + Scope.Group + ")" : "");

    public void OnGet()
    {
        var own = User.Identity!.Name!;
        var (scope, choices) = _budget.ResolveScope(own, User.IsInRole(Roles.DepartmentHead), Ks);
        Scope = new ScopeInfo(scope, choices, own, _budget.CostCenterInfo(scope)?.Group ?? "");
        Overview = _budget.Overview(scope);
    }
}
