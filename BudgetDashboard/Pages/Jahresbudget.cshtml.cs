using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages;

[Authorize(Policy = "User")]
public class JahresbudgetModel : PageModel
{
    private readonly BudgetService _budget;
    public JahresbudgetModel(BudgetService budget) => _budget = budget;

    [BindProperty(SupportsGet = true)] public int? Jahr { get; set; }
    public List<int> Years { get; private set; } = new();
    public int Year { get; private set; }

    public void OnGet()
    {
        Years = _budget.EnabledYears();
        if (Years.Count > 0) Year = Jahr is { } j && Years.Contains(j) ? j : Years[0];
    }
}
