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
        ("10000001", "Abteilungsleitung mit Passwort, Navigation mit Budgetfreigaben und Upload, eigene direkt freigegebene Budgetpositionen"),
        ("10000002", "Gruppenleitung mit Passwort und Budgetpositionen: freigegeben (2026, 2027), wartend, abgelehnt mit und ohne Begründung, dazu eine Mitteilung über eine entfernte Position"),
        ("10000003", "Zweite Gruppenleitung mit Passwort: eine freigegebene und zwei wartende Positionen für die Freigaben der Abteilungsleitung"),
        ("10000004", "Erste Anmeldung: noch kein Passwort, Dialog zum Setzen"),
        ("10000005", "Passwort gelöscht, Org-Einheit und Gruppe leer (im Profil ergänzen)"),
        ("10000006", "Gesperrt nach Fehlversuchen (15 Minuten ab Import)"),
        ("10000007", "Nicht freigegeben: Anmeldung nicht erlaubt"),
        ("10000008", "Org-Einheit und Gruppe in maximaler Länge (11 und 30 Zeichen)"),
        ("Kalenderjahre", "2026 und 2027 sind für Budgetpläne freigeschaltet, 2028 ist gesperrt")
    };

    public static readonly int[] EnabledYears = { 2026, 2027 };

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

    /// <summary>Mitteilungen für die Testkostenstellen: Entfernung einer freigegebenen Position mit Grund.</summary>
    public static List<Notification> CreateNotifications() => new()
    {
        new Notification
        {
            CostCenter = "10000002", Title = "Budgetposition entfernt", IsTestData = true, CreatedUtc = DateTime.UtcNow.AddDays(-2),
            Message = "Die Abteilungsleitung hat die freigegebene Budgetposition „Sonderprojekt Nord“ (3.500,00 EUR (Brutto), 2026) entfernt. Grund: Das Projekt wurde in den Gesamtplan 2027 verschoben."
        }
    };

    /// <summary>Budgetpositionen für die Testkostenstellen: freigegeben, wartend und abgelehnt.</summary>
    public static List<BudgetItem> CreateBudgetItems()
    {
        var now = DateTime.UtcNow;
        BudgetItem Make(string cc, string name, long cents, int year, string note, BudgetStatus status, string? reason = null, int daysAgo = 3) => new()
        {
            CostCenter = cc, Name = name, AmountCents = cents, Year = year, Note = note, Status = status, RejectReason = reason,
            CreatedUtc = now.AddDays(-daysAgo), DecidedUtc = status == BudgetStatus.Pending ? null : now.AddDays(-daysAgo + 1), IsTestData = true
        };
        return new List<BudgetItem>
        {
            Make("10000001", "Abteilungsveranstaltung", 650_000, 2026, "Jahresauftakt der Abteilung", BudgetStatus.Approved, daysAgo: 12),
            Make("10000001", "Fachkonferenz", 280_000, 2027, "Teilnahme der Abteilungsleitung", BudgetStatus.Approved, daysAgo: 6),
            Make("10000002", "Schulungen und Weiterbildung", 1_250_000, 2026, "Fachschulungen für das Team", BudgetStatus.Approved, daysAgo: 10),
            Make("10000002", "Software-Lizenzen", 489_050, 2026, "Verlängerung der Lizenzen", BudgetStatus.Approved, daysAgo: 9),
            Make("10000002", "Reisekosten", 320_000, 2027, "Kundentermine im Norden", BudgetStatus.Approved, daysAgo: 8),
            Make("10000002", "Büroausstattung", 123_456, 2026, "Neue Schreibtische für zwei Arbeitsplätze", BudgetStatus.Pending, daysAgo: 1),
            Make("10000002", "Neue Dienstwagen", 4_500_000, 2026, "Ersatz für zwei alte Fahrzeuge", BudgetStatus.Rejected,
                "Das Budget für 2026 ist ausgeschöpft. Bitte für 2027 neu einreichen.", 4),
            Make("10000002", "Teamevent", 80_000, 2026, "Jahresabschluss des Teams", BudgetStatus.Rejected, null, 5),
            Make("10000003", "Beratungsleistungen", 2_000_000, 2026, "Externe Beratung zur Prozessoptimierung", BudgetStatus.Approved, daysAgo: 7),
            Make("10000003", "Werbemittel", 275_000, 2027, "Material für die Messe im Frühjahr", BudgetStatus.Pending, daysAgo: 2),
            Make("10000003", "Fachliteratur", 34_990, 2026, "Normen und Fachbücher", BudgetStatus.Pending, daysAgo: 1),
        };
    }
}
