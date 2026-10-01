using BudgetDashboard.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BudgetDashboard.Pages;

public record ManualInfo(string Key, string Title, string Short, string FileName);

/// <summary>Handbücher als HTML-Seite und als PDF-Download. Quellen liegen in Manuals/.</summary>
[Authorize]
public class HandbuchModel : PageModel
{
    private static readonly ManualInfo Nutzer = new("nutzer", "Handbuch für Nutzende", "Nutzende", "Budget-Dashboard-Handbuch-Nutzende.pdf");
    private static readonly ManualInfo Abteilung = new("abteilungsleitung", "Handbuch für die Abteilungsleitung", "Abteilungsleitung", "Budget-Dashboard-Handbuch-Abteilungsleitung.pdf");
    private static readonly ManualInfo Admin = new("admin", "Handbuch für die Administration", "Administration", "Budget-Dashboard-Handbuch-Administration.pdf");

    private readonly IWebHostEnvironment _env;
    public HandbuchModel(IWebHostEnvironment env) => _env = env;

    [BindProperty(SupportsGet = true)] public string? Typ { get; set; }
    public List<ManualInfo> Available { get; private set; } = new();
    public ManualInfo Current { get; private set; } = Nutzer;
    public string Html { get; private set; } = "";

    public IActionResult OnGet()
    {
        if (!Resolve()) return Forbid();
        var file = Path.Combine(_env.ContentRootPath, "Manuals", Current.Key + ".html");
        Html = System.IO.File.Exists(file) ? System.IO.File.ReadAllText(file) : "<p>Das Handbuch ist nicht installiert.</p>";
        return Page();
    }

    public IActionResult OnGetPdf()
    {
        if (!Resolve()) return Forbid();
        var file = Path.Combine(_env.ContentRootPath, "Manuals", Current.Key + ".pdf");
        if (!System.IO.File.Exists(file)) return NotFound();
        return PhysicalFile(file, "application/pdf", Current.FileName);
    }

    private bool Resolve()
    {
        Available = User.IsInRole(Roles.Admin) ? new() { Admin, Abteilung, Nutzer }
            : User.IsInRole(Roles.DepartmentHead) ? new() { Nutzer, Abteilung }
            : new() { Nutzer };
        var requested = Typ;
        if (string.IsNullOrEmpty(requested))
            requested = User.IsInRole(Roles.Admin) ? Admin.Key : User.IsInRole(Roles.DepartmentHead) ? Abteilung.Key : Nutzer.Key;
        var match = Available.FirstOrDefault(m => m.Key == requested);
        if (match is null) return false;
        Current = match;
        return true;
    }
}
