using System.Text.RegularExpressions;
using BudgetDashboard.Models;

namespace BudgetDashboard.Services;

public record BudgetRow(
    string Id, string CostCenter, string Group, string OrgUnit, string Name, long AmountCents,
    int Year, string Note, BudgetStatus Status, string? RejectReason, DateTime CreatedUtc, DateTime? DecidedUtc);

public record YearSummary(int Year, bool Enabled, int ApprovedCount, long ApprovedCents, int PendingCount, long PendingCents);

public record GroupYearRow(string CostCenter, string Group, Dictionary<int, long> ApprovedByYear);

public static class Money
{
    /// <summary>Formatiert Cent als "1.234,56" (ohne Kulturabhängigkeit).</summary>
    public static string Format(long cents)
    {
        var whole = (cents / 100).ToString();
        for (var i = whole.Length - 3; i > 0; i -= 3) whole = whole.Insert(i, ".");
        return $"{whole},{cents % 100:00}";
    }

    public static string Brutto(long cents) => Format(cents) + " EUR (Brutto)";
}

/// <summary>Budgetpläne: Freischaltung der Jahre, Einreichen, Freigeben und Ablehnen von Budgetpositionen.</summary>
public sealed partial class BudgetService
{
    public static readonly int[] Years = { 2026, 2027, 2028 };
    public const int NameMax = 100;
    public const int NoteMax = 500;
    public const int ReasonMax = 500;
    private const long MaxCents = 99_999_999_999;

    private readonly DataStore _store;
    public BudgetService(DataStore store) => _store = store;

    [GeneratedRegex(@"^\d{1,3}(\.\d{3})+(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+\.\d{1,2}$")]
    private static partial Regex AmountPattern();

    /// <summary>Liest Beträge wie "1234,5", "1.234,56" oder "1234.56"; null bei ungültiger Eingabe.</summary>
    public static long? ParseAmount(string? text)
    {
        text = (text ?? "").Trim().Replace(" ", "").Replace("€", "").Replace("EUR", "", StringComparison.OrdinalIgnoreCase);
        if (!AmountPattern().IsMatch(text)) return null;
        string whole, frac = "";
        var comma = text.IndexOf(',');
        if (comma >= 0) { whole = text[..comma].Replace(".", ""); frac = text[(comma + 1)..]; }
        else if (Regex.IsMatch(text, @"^\d+\.\d{1,2}$")) { var dot = text.IndexOf('.'); whole = text[..dot]; frac = text[(dot + 1)..]; }
        else whole = text.Replace(".", "");
        if (whole.Length > 11) return null;
        var cents = long.Parse(whole) * 100 + (frac.Length == 0 ? 0 : long.Parse(frac.PadRight(2, '0')));
        return cents is > 0 and <= MaxCents ? cents : null;
    }

    public List<int> EnabledYears() => _store.Read(d => d.Settings.EnabledYears.Where(Years.Contains).OrderBy(y => y).ToList());

    public OperationResult SetYear(int year, bool enabled)
    {
        if (!Years.Contains(year)) return OperationResult.Fail("Dieses Kalenderjahr gibt es nicht.");
        return _store.Write(d =>
        {
            d.Settings.EnabledYears.Remove(year);
            if (enabled) d.Settings.EnabledYears.Add(year);
            return OperationResult.Success();
        });
    }

    public OperationResult Submit(string costCenter, string? name, string? amountText, int year, string? note)
    {
        name = (name ?? "").Trim();
        note = (note ?? "").Trim();
        var errors = new List<string>();
        if (name.Length == 0) errors.Add("Bitte gib eine Bezeichnung ein.");
        else if (name.Length > NameMax) errors.Add($"Die Bezeichnung darf höchstens {NameMax} Zeichen haben.");
        var cents = ParseAmount(amountText);
        if (cents is null) errors.Add("Bitte gib einen Betrag größer als 0 an, zum Beispiel 1.234,56. Es sind höchstens 2 Nachkommastellen möglich.");
        if (note.Length == 0) errors.Add("Bitte gib einen Hinweistext zur Freigabe ein.");
        else if (note.Length > NoteMax) errors.Add($"Der Hinweistext darf höchstens {NoteMax} Zeichen haben.");
        if (name.Any(char.IsControl) || note.Any(c => char.IsControl(c) && c != '\n' && c != '\r'))
            errors.Add("Bezeichnung und Hinweistext enthalten ungültige Zeichen.");
        if (errors.Count > 0) return OperationResult.Fail(errors);

        return _store.Write(d =>
        {
            if (!d.Settings.EnabledYears.Contains(year))
                return OperationResult.Fail("Für dieses Kalenderjahr sind Budgetpläne nicht freigeschaltet.");
            d.BudgetItems.Add(new BudgetItem { CostCenter = costCenter, Name = name, AmountCents = cents!.Value, Year = year, Note = note });
            return OperationResult.Success();
        });
    }

    private static BudgetRow ToRow(StoreData d, BudgetItem i)
    {
        var c = d.CostCenters.FirstOrDefault(x => x.Number == i.CostCenter);
        return new BudgetRow(i.Id, i.CostCenter, c?.Group ?? "", c?.OrgUnit ?? "", i.Name, i.AmountCents, i.Year, i.Note,
            i.Status, i.RejectReason, i.CreatedUtc, i.DecidedUtc);
    }

    /// <summary>Offene und abgelehnte Positionen einer Gruppenleitung (genehmigte erscheinen im Budgetplan).</summary>
    public List<BudgetRow> OwnOpenItems(string costCenter) => _store.Read(d => d.BudgetItems
        .Where(i => i.CostCenter == costCenter && i.Status != BudgetStatus.Approved)
        .OrderByDescending(i => i.CreatedUtc).Select(i => ToRow(d, i)).ToList());

    /// <summary>Freigegebene Positionen eines Jahres; costCenter null = alle Gruppen (Abteilungsleitung).</summary>
    public List<BudgetRow> Approved(string? costCenter, int year) => _store.Read(d => d.BudgetItems
        .Where(i => i.Status == BudgetStatus.Approved && i.Year == year && (costCenter == null || i.CostCenter == costCenter))
        .OrderBy(i => i.CostCenter).ThenBy(i => i.DecidedUtc).Select(i => ToRow(d, i)).ToList());

    public List<BudgetRow> Pending() => _store.Read(d => d.BudgetItems
        .Where(i => i.Status == BudgetStatus.Pending)
        .OrderBy(i => i.CreatedUtc).Select(i => ToRow(d, i)).ToList());

    public List<YearSummary> Overview(string? costCenter) => _store.Read(d =>
    {
        var items = d.BudgetItems.Where(i => costCenter == null || i.CostCenter == costCenter).ToList();
        return Years.Select(y =>
        {
            var ap = items.Where(i => i.Year == y && i.Status == BudgetStatus.Approved).ToList();
            var pe = items.Where(i => i.Year == y && i.Status == BudgetStatus.Pending).ToList();
            return new YearSummary(y, d.Settings.EnabledYears.Contains(y), ap.Count, ap.Sum(i => i.AmountCents), pe.Count, pe.Sum(i => i.AmountCents));
        }).ToList();
    });

    /// <summary>Freigegebene Summen je Gruppe und Jahr (Abteilungsleitung).</summary>
    public List<GroupYearRow> ByGroup() => _store.Read(d => d.CostCenters
        .Where(c => c.Number != d.Settings.DepartmentHeadNumber)
        .OrderBy(c => c.Number, StringComparer.Ordinal)
        .Select(c => new GroupYearRow(c.Number, c.Group, Years.ToDictionary(y => y,
            y => d.BudgetItems.Where(i => i.CostCenter == c.Number && i.Year == y && i.Status == BudgetStatus.Approved).Sum(i => i.AmountCents))))
        .Where(r => r.ApprovedByYear.Values.Any(v => v > 0))
        .ToList());

    /// <summary>Löscht eine eigene Position. Offene Positionen verschwinden auch bei der Abteilungsleitung.</summary>
    public OperationResult DeleteOwn(string costCenter, string id) => _store.Write(d =>
    {
        var i = d.BudgetItems.FirstOrDefault(x => x.Id == id && x.CostCenter == costCenter);
        if (i == null) return OperationResult.Fail("Den Eintrag gibt es nicht mehr.");
        if (i.Status == BudgetStatus.Approved) return OperationResult.Fail("Freigegebene Positionen lassen sich nicht löschen.");
        d.BudgetItems.Remove(i);
        return OperationResult.Success();
    });

    public OperationResult Approve(string id) => _store.Write(d =>
    {
        var i = d.BudgetItems.FirstOrDefault(x => x.Id == id);
        if (i is not { Status: BudgetStatus.Pending }) return OperationResult.Fail("Die Position wartet nicht mehr auf Freigabe.");
        i.Status = BudgetStatus.Approved;
        i.DecidedUtc = DateTime.UtcNow;
        return OperationResult.Success();
    });

    public OperationResult Reject(string id, string? reason)
    {
        reason = (reason ?? "").Trim();
        if (reason.Length > ReasonMax) return OperationResult.Fail($"Der Grund darf höchstens {ReasonMax} Zeichen haben.");
        return _store.Write(d =>
        {
            var i = d.BudgetItems.FirstOrDefault(x => x.Id == id);
            if (i is not { Status: BudgetStatus.Pending }) return OperationResult.Fail("Die Position wartet nicht mehr auf Freigabe.");
            i.Status = BudgetStatus.Rejected;
            i.RejectReason = reason.Length == 0 ? null : reason;
            i.DecidedUtc = DateTime.UtcNow;
            return OperationResult.Success();
        });
    }
}
