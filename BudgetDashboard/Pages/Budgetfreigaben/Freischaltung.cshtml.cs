using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages.Budgetfreigaben;

[Authorize(Policy = "DepartmentHead")]
public class FreischaltungModel : PageModel
{
    private readonly BudgetService _budget;
    public FreischaltungModel(BudgetService budget) => _budget = budget;

    public List<int> Enabled { get; private set; } = new();
    public List<string> Errors { get; private set; } = new();
    public string? Notice => TempData["Notice"] as string;

    public void OnGet() => Enabled = _budget.EnabledYears();

    public IActionResult OnPostToggle(int year, bool enable)
    {
        var result = _budget.SetYear(year, enable);
        if (!result.Ok)
        {
            Errors = result.Errors;
            Enabled = _budget.EnabledYears();
            return Page();
        }
        TempData["Notice"] = enable ? $"Budgetpläne für {year} sind aktiviert." : $"Budgetpläne für {year} sind deaktiviert.";
        return RedirectToPage();
    }
}
