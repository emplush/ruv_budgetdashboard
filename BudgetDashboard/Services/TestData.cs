using BudgetDashboard.Models;

namespace BudgetDashboard.Services;

/// <summary>
/// Testdaten für den Import im Admin-Bereich. Sie bilden die typischen Anwendungsfälle der App ab.
/// Bei jeder Änderung der App prüfen, ob neue Fälle oder Felder hier ergänzt werden müssen,
/// und die Handbücher (Abschnitt "Testdaten" im Admin-Handbuch) mitpflegen.
/// </summary>
public static class TestData
{
    /// <summary>Passwort aller Testkostenstellen mit gesetztem Passwort.</summary>
    public const string Password = "Test-Zugang#2026";

    public const string DepartmentHeadNumber = "10000001";

    public static readonly (string Number, string Case)[] Cases =
    {
        ("10000001", "Abteilungsleitung mit Passwort, Navigation mit Budgetfreigaben und Upload"),
        ("10000002", "Gruppenleitung mit Passwort"),
        ("10000003", "Zweite Gruppenleitung mit Passwort"),
        ("10000004", "Erste Anmeldung: noch kein Passwort, Dialog zum Setzen"),
        ("10000005", "Passwort gelöscht, Org-Einheit und Gruppe leer (im Profil ergänzen)"),
        ("10000006", "Gesperrt nach Fehlversuchen (15 Minuten ab Import)"),
        ("10000007", "Nicht freigegeben: Anmeldung nicht erlaubt"),
        ("10000008", "Org-Einheit und Gruppe in maximaler Länge (11 und 30 Zeichen)")
    };

    public static List<CostCenter> Create(string passwordHash)
    {
        var now = DateTime.UtcNow;
        CostCenter Make(string number, string org, string group, bool enabled = true, bool withPassword = true) => new()
        {
            Number = number, OrgUnit = org, Group = group, Enabled = enabled, IsTestData = true,
            PasswordHash = withPassword ? passwordHash : null,
            LastLoginUtc = withPassword ? now.AddDays(-1) : null
        };
        var locked = Make("10000006", "ORG-4", "Gruppe Ost");
        locked.LockoutEndUtc = now.AddMinutes(15);
        return new List<CostCenter>
        {
            Make("10000001", "ORG-1", "Abteilungsleitung"),
            Make("10000002", "ORG-1", "Gruppe Nord"),
            Make("10000003", "ORG-2", "Gruppe Süd"),
            Make("10000004", "ORG-3", "Gruppe West", withPassword: false),
            Make("10000005", "", "", withPassword: false),
            locked,
            Make("10000007", "ORG-5", "Gruppe Archiv", enabled: false),
            Make("10000008", "ORG-1234567", "Gruppe mit maximaler Länge 300", true)
        };
    }
}
