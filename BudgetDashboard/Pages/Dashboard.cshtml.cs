using BudgetDashboard.Models;
using BudgetDashboard.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages;

[Authorize(Policy = "User")]
public class DashboardModel : PageModel
{
    private readonly AccountService _accounts;
    private readonly BudgetService _budget;

    public DashboardModel(AccountService accounts, BudgetService budget)
    {
        _accounts = accounts;
        _budget = budget;
    }

    public string OrgUnit { get; private set; } = "";
    public string Group { get; private set; } = "";
    public string Role { get; private set; } = "";
    public List<Notification> Notices { get; private set; } = new();

    public void OnGet() => Load();

    /// <summary>Mitteilung als gelesen markieren (entfernt sie).</summary>
    public IActionResult OnPostDismiss(string id)
    {
        _budget.DismissNotification(User.Identity!.Name!, id);
        return RedirectToPage();
    }

    private void Load()
    {
        var number = User.Identity!.Name!;
        var p = _accounts.Profile(number);
        OrgUnit = p?.OrgUnit ?? "";
        Group = p?.Group ?? "";
        Role = p?.Role ?? "";
        Notices = _budget.Notifications(number);
    }
}
