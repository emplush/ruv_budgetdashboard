using System.Security.Cryptography;
using System.Text.RegularExpressions;
using BudgetDashboard.Models;

namespace BudgetDashboard.Services;

public enum LoginStatus { Success, NeedsPassword, Invalid, LockedOut }

public record AccountInfo(string Number, string Role, string Stamp, string OrgUnit, string Group);

public record LoginResult(LoginStatus Status, AccountInfo? Account = null, int LockMinutes = 0);

public record CostCenterRow(
    string Number, bool Enabled, string OrgUnit, string Group,
    bool HasPassword, bool IsDepartmentHead, bool Locked, DateTime? LastLoginUtc);

public record OperationResult(bool Ok, List<string> Errors)
{
    public static OperationResult Success() => new(true, new());
    public static OperationResult Fail(params string[] errors) => new(false, errors.ToList());
    public static OperationResult Fail(IEnumerable<string> errors) => new(false, errors.ToList());
}

/// <summary>Anmeldung, Passwortverwaltung und Pflege der Kostenstellen.</summary>
public sealed partial class AccountService
{
    public const int OrgUnitMax = 11;
    public const int GroupMax = 30;

    private readonly DataStore _store;
    private readonly PasswordService _passwords;
    private readonly int _maxFailed;
    private readonly TimeSpan _lockout;

    public AccountService(DataStore store, PasswordService passwords, IConfiguration config)
    {
        _store = store;
        _passwords = passwords;
        _maxFailed = config.GetValue("Security:MaxFailedLogins", 5);
        _lockout = TimeSpan.FromMinutes(config.GetValue("Security:LockoutMinutes", 15));
    }

    [GeneratedRegex(@"^\d{8}$")]
    private static partial Regex NumberPattern();

    public static bool IsValidNumber(string? number) => number != null && NumberPattern().IsMatch(number);

    private static CostCenter? FindRaw(StoreData d, string number) =>
        number == Roles.AdminNumber ? d.Admin : d.CostCenters.FirstOrDefault(c => c.Number == number);

    private static string RoleFor(StoreData d, string number) =>
        number == Roles.AdminNumber ? Roles.Admin
        : number == d.Settings.DepartmentHeadNumber ? Roles.DepartmentHead
        : Roles.GroupLead;

    private static AccountInfo ToInfo(StoreData d, CostCenter c) =>
        new(c.Number, RoleFor(d, c.Number), c.SecurityStamp, c.OrgUnit, c.Group);

    private static string NewStamp() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16));

    /// <summary>Aktives Konto für die Sitzungsprüfung; null, wenn gesperrt oder gelöscht.</summary>
    public AccountInfo? Find(string? number) => _store.Read(d =>
    {
        if (number == null) return null;
        var c = FindRaw(d, number);
        return c is { Enabled: true } ? ToInfo(d, c) : null;
    });

    public bool AdminMustChangePassword => _store.Read(d => d.Settings.AdminMustChangePassword);

    public LoginResult Login(string? number, string? password)
    {
        number = (number ?? "").Trim();
        password ??= "";

        var snapshot = _store.Read(d =>
        {
            if (!IsValidNumber(number)) return null;
            var c = FindRaw(d, number);
            return c is { Enabled: true } ? (c.PasswordHash, c.LockoutEndUtc) : ((string?, DateTime?)?)null;
        });

        if (snapshot is null || password.Length > PasswordService.MaxLength)
        {
            _passwords.Verify(password.Length > PasswordService.MaxLength ? "" : password, null);
            return new LoginResult(LoginStatus.Invalid);
        }

        var (hash, lockoutEnd) = snapshot.Value;
        if (lockoutEnd is { } until && until > DateTime.UtcNow)
            return new LoginResult(LoginStatus.LockedOut, null, (int)Math.Ceiling((until - DateTime.UtcNow).TotalMinutes));

        if (hash == null)
            return new LoginResult(LoginStatus.NeedsPassword);

        var ok = _passwords.Verify(password, hash);
        return _store.Write(d =>
        {
            var c = FindRaw(d, number);
            if (c is not { Enabled: true }) return new LoginResult(LoginStatus.Invalid);
            if (ok)
            {
                c.FailedAttempts = 0;
                c.LockoutEndUtc = null;
                c.LastLoginUtc = DateTime.UtcNow;
                return new LoginResult(LoginStatus.Success, ToInfo(d, c));
            }
            c.FailedAttempts++;
            if (c.FailedAttempts >= _maxFailed)
            {
                c.FailedAttempts = 0;
                c.LockoutEndUtc = DateTime.UtcNow + _lockout;
                return new LoginResult(LoginStatus.LockedOut, null, (int)_lockout.TotalMinutes);
            }
            return new LoginResult(LoginStatus.Invalid);
        });
    }

    /// <summary>Ersteinrichtung: setzt das Passwort, solange noch keines existiert.</summary>
    public (OperationResult Result, AccountInfo? Account) SetInitialPassword(string number, string? password)
    {
        var errors = _passwords.Validate(password, number);
        if (errors.Count > 0) return (OperationResult.Fail(errors), null);
        var hash = _passwords.Hash(password!);
        return _store.Write(d =>
        {
            var c = FindRaw(d, number);
            if (c is not { Enabled: true } || c.PasswordHash != null)
                return (OperationResult.Fail("Für diese Kostenstelle ist bereits ein Passwort gesetzt. Bitte melde Dich normal an."), (AccountInfo?)null);
            c.PasswordHash = hash;
            c.SecurityStamp = NewStamp();
            c.FailedAttempts = 0;
            c.LockoutEndUtc = null;
            c.LastLoginUtc = DateTime.UtcNow;
            return (OperationResult.Success(), ToInfo(d, c));
        });
    }

    /// <summary>Passwort ändern; das bisherige Passwort muss stimmen. Liefert das Konto mit neuer Sitzungskennung.</summary>
    public (OperationResult Result, AccountInfo? Account) ChangePassword(string number, string? current, string? password, string? confirm)
    {
        current ??= "";
        var snapshot = _store.Read(d =>
        {
            var c = FindRaw(d, number);
            return c is { Enabled: true } ? (c.PasswordHash, c.LockoutEndUtc) : ((string?, DateTime?)?)null;
        });
        if (snapshot is null) return (OperationResult.Fail("Das Konto ist nicht verfügbar."), null);
        if (snapshot.Value.Item2 is { } until && until > DateTime.UtcNow)
            return (OperationResult.Fail("Das Konto ist vorübergehend gesperrt. Bitte versuche es später erneut."), null);

        if (current.Length > PasswordService.MaxLength || !_passwords.Verify(current, snapshot.Value.Item1))
        {
            _store.Write(d =>
            {
                var c = FindRaw(d, number);
                if (c == null) return 0;
                if (++c.FailedAttempts >= _maxFailed)
                {
                    c.FailedAttempts = 0;
                    c.LockoutEndUtc = DateTime.UtcNow + _lockout;
                }
                return 0;
            });
            return (OperationResult.Fail("Das aktuelle Passwort stimmt nicht."), null);
        }

        var errors = _passwords.Validate(password, number);
        if (password != confirm) errors.Add("Die beiden neuen Passwörter stimmen nicht überein.");
        if (password == current) errors.Add("Das neue Passwort muss sich vom aktuellen unterscheiden.");
        if (errors.Count > 0) return (OperationResult.Fail(errors), null);

        var hash = _passwords.Hash(password!);
        return _store.Write(d =>
        {
            var c = FindRaw(d, number)!;
            c.PasswordHash = hash;
            c.SecurityStamp = NewStamp();
            c.FailedAttempts = 0;
            c.LockoutEndUtc = null;
            if (number == Roles.AdminNumber) d.Settings.AdminMustChangePassword = false;
            return (OperationResult.Success(), (AccountInfo?)ToInfo(d, c));
        });
    }

    /// <summary>Eigene Angaben (Org-Einheit, Gruppe) ändern; die Kostenstelle bleibt unverändert.</summary>
    public OperationResult UpdateOwnDetails(string number, string? orgUnit, string? group)
    {
        orgUnit = (orgUnit ?? "").Trim();
        group = (group ?? "").Trim();
        var errors = ValidateTexts(orgUnit, group);
        if (errors.Count > 0) return OperationResult.Fail(errors);
        return _store.Write(d =>
        {
            var c = FindRaw(d, number);
            if (c is not { Enabled: true } || number == Roles.AdminNumber) return OperationResult.Fail("Das Konto ist nicht verfügbar.");
            c.OrgUnit = orgUnit;
            c.Group = group;
            return OperationResult.Success();
        });
    }

    public (string OrgUnit, string Group, string Role)? Profile(string number) => _store.Read(d =>
    {
        var c = FindRaw(d, number);
        return c == null ? ((string, string, string)?)null : (c.OrgUnit, c.Group, RoleFor(d, number));
    });

    // ---- Administration ----

    public List<CostCenterRow> List() => _store.Read(d => d.CostCenters
        .OrderBy(c => c.Number, StringComparer.Ordinal)
        .Select(c => new CostCenterRow(c.Number, c.Enabled, c.OrgUnit, c.Group, c.PasswordHash != null,
            c.Number == d.Settings.DepartmentHeadNumber,
            c.LockoutEndUtc is { } t && t > DateTime.UtcNow, c.LastLoginUtc))
        .ToList());

    private static List<string> ValidateTexts(string orgUnit, string group)
    {
        var errors = new List<string>();
        if (orgUnit.Length > OrgUnitMax) errors.Add($"Die Org-Einheit darf höchstens {OrgUnitMax} Zeichen haben.");
        if (group.Length > GroupMax) errors.Add($"Die Gruppe darf höchstens {GroupMax} Zeichen haben.");
        if (orgUnit.Any(char.IsControl) || group.Any(char.IsControl)) errors.Add("Org-Einheit und Gruppe enthalten ungültige Zeichen.");
        return errors;
    }

    public OperationResult AddCostCenter(string? number, string? orgUnit, string? group, bool enabled, bool departmentHead)
    {
        number = (number ?? "").Trim();
        orgUnit = (orgUnit ?? "").Trim();
        group = (group ?? "").Trim();
        var errors = ValidateTexts(orgUnit, group);
        if (!IsValidNumber(number)) errors.Insert(0, "Eine Kostenstelle besteht aus genau 8 Ziffern.");
        else if (number == Roles.AdminNumber) errors.Insert(0, "Die Kostenstelle 00000000 ist für die Administration reserviert.");
        if (errors.Count > 0) return OperationResult.Fail(errors);

        return _store.Write(d =>
        {
            if (d.CostCenters.Any(c => c.Number == number))
                return OperationResult.Fail("Diese Kostenstelle gibt es bereits.");
            d.CostCenters.Add(new CostCenter { Number = number, Enabled = enabled, OrgUnit = orgUnit, Group = group });
            if (departmentHead) d.Settings.DepartmentHeadNumber = number;
            return OperationResult.Success();
        });
    }

    public OperationResult UpdateCostCenter(string number, string? orgUnit, string? group, bool enabled)
    {
        orgUnit = (orgUnit ?? "").Trim();
        group = (group ?? "").Trim();
        var errors = ValidateTexts(orgUnit, group);
        if (errors.Count > 0) return OperationResult.Fail(errors);
        return _store.Write(d =>
        {
            var c = d.CostCenters.FirstOrDefault(x => x.Number == number);
            if (c == null) return OperationResult.Fail("Die Kostenstelle gibt es nicht.");
            c.OrgUnit = orgUnit;
            c.Group = group;
            c.Enabled = enabled;
            if (!enabled && d.Settings.DepartmentHeadNumber == number) d.Settings.DepartmentHeadNumber = null;
            return OperationResult.Success();
        });
    }

    public OperationResult DeleteCostCenter(string number) => _store.Write(d =>
    {
        if (d.CostCenters.RemoveAll(c => c.Number == number) == 0)
            return OperationResult.Fail("Die Kostenstelle gibt es nicht.");
        d.BudgetItems.RemoveAll(i => i.CostCenter == number);
        if (d.Settings.DepartmentHeadNumber == number) d.Settings.DepartmentHeadNumber = null;
        return OperationResult.Success();
    });

    public OperationResult ResetPassword(string number) => _store.Write(d =>
    {
        var c = d.CostCenters.FirstOrDefault(x => x.Number == number);
        if (c == null) return OperationResult.Fail("Die Kostenstelle gibt es nicht.");
        c.PasswordHash = null;
        c.SecurityStamp = NewStamp();
        c.FailedAttempts = 0;
        c.LockoutEndUtc = null;
        return OperationResult.Success();
    });

    /// <summary>Setzt die Abteilungsleitung; null entzieht die Rechte.</summary>
    public OperationResult SetDepartmentHead(string? number) => _store.Write(d =>
    {
        if (number == null) { d.Settings.DepartmentHeadNumber = null; return OperationResult.Success(); }
        var c = d.CostCenters.FirstOrDefault(x => x.Number == number);
        if (c is not { Enabled: true }) return OperationResult.Fail("Die Abteilungsleitung braucht eine freigegebene Kostenstelle.");
        d.Settings.DepartmentHeadNumber = number;
        return OperationResult.Success();
    });

    // ---- Testdaten ----

    public int TestDataCount() => _store.Read(d => d.CostCenters.Count(c => c.IsTestData));

    /// <summary>Löscht alle Kostenstellen und legt die Testdaten neu an. Admin-Passwort und Titel bleiben.</summary>
    public int ImportTestData() => _store.Write(d =>
    {
        d.CostCenters.Clear();
        d.BudgetItems.Clear();
        d.Settings.DepartmentHeadNumber = null;
        var items = TestData.Create(_passwords.Hash(TestData.Password));
        d.CostCenters.AddRange(items);
        d.BudgetItems.AddRange(TestData.CreateBudgetItems());
        d.Settings.EnabledYears = TestData.EnabledYears.ToList();
        d.Settings.DepartmentHeadNumber = TestData.DepartmentHeadNumber;
        return items.Count;
    });

    /// <summary>Entfernt nur die Kostenstellen aus dem Testdaten-Import.</summary>
    public int DeleteTestData() => _store.Write(d =>
    {
        var removed = d.CostCenters.RemoveAll(c => c.IsTestData);
        d.BudgetItems.RemoveAll(i => i.IsTestData || d.CostCenters.All(c => c.Number != i.CostCenter));
        if (d.Settings.DepartmentHeadNumber != null && d.CostCenters.All(c => c.Number != d.Settings.DepartmentHeadNumber))
            d.Settings.DepartmentHeadNumber = null;
        return removed;
    });

    public string GetTitle() => _store.Title;

    public OperationResult SetTitle(string? title)
    {
        title = (title ?? "").Trim();
        if (title.Length is < 1 or > 60) return OperationResult.Fail("Der Titel braucht 1 bis 60 Zeichen.");
        if (title.Any(char.IsControl)) return OperationResult.Fail("Der Titel enthält ungültige Zeichen.");
        return _store.Write(d => { d.Settings.Title = title; return OperationResult.Success(); });
    }
}
