using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages.Budgetfreigaben;

[Authorize(Policy = "DepartmentHead")]
public class OffeneFreigabenModel : PageModel
{
    private readonly BudgetService _budget;
    public OffeneFreigabenModel(BudgetService budget) => _budget = budget;

    public List<BudgetRow> Items { get; private set; } = new();
    public List<string> Errors { get; private set; } = new();
    public string? Notice => TempData["Notice"] as string;

    public void OnGet() => Items = _budget.Pending();

    public IActionResult OnPostApprove(string id) => Handle(_budget.Approve(id), "Die Budgetposition ist freigegeben.");

    public IActionResult OnPostReject(string id, string? reason) => Handle(_budget.Reject(id, reason), "Die Budgetposition ist abgelehnt.");

    private IActionResult Handle(OperationResult result, string notice)
    {
        if (!result.Ok)
        {
            Errors = result.Errors;
            Items = _budget.Pending();
            return Page();
        }
        TempData["Notice"] = notice;
        return RedirectToPage();
    }
}
