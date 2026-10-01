using System.Text.Json.Serialization;

namespace BudgetDashboard.Models;

/// <summary>Kostenstelle der Administration (00000000) bzw. eines Nutzers.</summary>
public class CostCenter
{
    public string Number { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public string OrgUnit { get; set; } = "";
    public string Group { get; set; } = "";
    public string? PasswordHash { get; set; }
    public string SecurityStamp { get; set; } = Guid.NewGuid().ToString("N");
    public int FailedAttempts { get; set; }
    public DateTime? LockoutEndUtc { get; set; }
    public DateTime? LastLoginUtc { get; set; }

    /// <summary>Kennzeichnet Kostenstellen aus dem Testdaten-Import.</summary>
    public bool IsTestData { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BudgetStatus { Pending, Approved, Rejected }

/// <summary>Budgetposition einer Gruppenleitung für ein Kalenderjahr.</summary>
public class BudgetItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string CostCenter { get; set; } = "";
    public string Name { get; set; } = "";
    /// <summary>Betrag in Cent, brutto.</summary>
    public long AmountCents { get; set; }
    public int Year { get; set; }
    public string Note { get; set; } = "";
    public BudgetStatus Status { get; set; } = BudgetStatus.Pending;
    public string? RejectReason { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime? DecidedUtc { get; set; }
    public bool IsTestData { get; set; }
}

public class SiteSettings
{
    /// <summary>Kalenderjahre, für die Gruppenleitungen Budgetpositionen einreichen können.</summary>
    public List<int> EnabledYears { get; set; } = new();

    public string Title { get; set; } = "Budget-Dashboard 2.0";

    /// <summary>Kostenstelle mit Abteilungsleiterrechten (genau eine oder keine).</summary>
    public string? DepartmentHeadNumber { get; set; }

    public bool AdminMustChangePassword { get; set; } = true;
}

/// <summary>Gesamter Datenbestand, wird als eine JSON-Datei gespeichert.</summary>
public class StoreData
{
    public int Version { get; set; } = 1;
    public SiteSettings Settings { get; set; } = new();
    public CostCenter Admin { get; set; } = new() { Number = Roles.AdminNumber };
    public List<CostCenter> CostCenters { get; set; } = new();
    public List<BudgetItem> BudgetItems { get; set; } = new();
}

public static class Roles
{
    public const string AdminNumber = "00000000";
    public const string Admin = "Admin";
    public const string DepartmentHead = "Abteilungsleiter";
    public const string GroupLead = "Gruppenleiter";
    public const string AnyUser = DepartmentHead + "," + GroupLead;

    public static string Label(string role) => role switch
    {
        Admin => "Administration",
        DepartmentHead => "Abteilungsleitung",
        _ => "Gruppenleitung"
    };
}
