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
    [BindProperty(SupportsGet = true)] public string? Ks { get; set; }
    public List<int> Years { get; private set; } = new();
    public int Year { get; private set; }
    public List<BudgetRow> Rows { get; private set; } = new();
    public ScopeInfo Scope { get; private set; } = new("", new(), "");

    /// <summary>Nur gesetzt, wenn die Abteilungsleitung eine fremde Kostenstelle ansieht.</summary>
    public string? KsRoute => Scope.Number == User.Identity!.Name ? null : Scope.Number;
    public string ScopeTitle => KsRoute is null ? "" : " der Kostenstelle " + Scope.Number + (Scope.Group.Length > 0 ? " (" + Scope.Group + ")" : "");

    public void OnGet()
    {
        var own = User.Identity!.Name!;
        var (scope, choices) = _budget.ResolveScope(own, User.IsInRole(Roles.DepartmentHead), Ks);
        Scope = new ScopeInfo(scope, choices, own, _budget.CostCenterInfo(scope)?.Group ?? "");
        Years = _budget.EnabledYears();
        if (Years.Count == 0) return;
        Year = Jahr is { } j && Years.Contains(j) ? j : Years[0];
        Rows = _budget.Approved(scope, Year);
    }
}
