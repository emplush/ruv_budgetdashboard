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
}

public class SiteSettings
{
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
