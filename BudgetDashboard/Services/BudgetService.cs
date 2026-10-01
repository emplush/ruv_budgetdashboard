using System.Text.RegularExpressions;
using BudgetDashboard.Models;

namespace BudgetDashboard.Services;

public record BudgetRow(
    string Id, string CostCenter, string Group, string OrgUnit, string Name, long AmountCents,
    int Year, string Note, BudgetStatus Status, string? RejectReason, DateTime CreatedUtc, DateTime? DecidedUtc);

public record YearSummary(int Year, bool Enabled, int ApprovedCount, long ApprovedCents, int PendingCount, long PendingCents);

/// <summary>Gewählte Kostenstelle eines Budgetplans und die Auswahl für die Abteilungsleitung.</summary>
public record ScopeInfo(string Number, List<(string Number, string Label)> Choices, string Own, string Group = "");

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

    /// <summary>Netto in Cent mal 1,19 (19 % Umsatzsteuer), kaufmännisch gerundet.</summary>
    public static long NetToGross(long netCents) => (netCents * 119 + 50) / 100;

    /// <summary>Brutto in Cent durch 1,19, kaufmännisch gerundet.</summary>
    public static long GrossToNet(long grossCents) => (grossCents * 100 + 59) / 119;

    public int PendingCount() => _store.Read(d => d.BudgetItems.Count(i => i.Status == BudgetStatus.Pending && d.Settings.EnabledYears.Contains(i.Year)));

    /// <summary>
    /// Bestimmt, welche Kostenstelle ein Budgetplan zeigt. Die Abteilungsleitung startet bei der eigenen und kann
    /// zu jeder Kostenstelle wechseln; Gruppenleitungen sehen nur die eigene.
    /// </summary>
    public (string Scope, List<(string Number, string Label)> Choices) ResolveScope(string own, bool isDepartmentHead, string? requested) => _store.Read(d =>
    {
        if (!isDepartmentHead) return (own, new List<(string, string)>());
        string Label(CostCenter c) => c.Number + (c.Group.Length > 0 ? " · " + c.Group : "") + (c.Number == own ? " (eigene Kostenstelle)" : "");
        var choices = d.CostCenters.OrderBy(c => c.Number == own ? 0 : 1).ThenBy(c => c.Number, StringComparer.Ordinal)
            .Select(c => (c.Number, Label(c))).ToList();
        var scope = requested != null && choices.Any(c => c.Number == requested) ? requested : own;
        return (scope, choices);
    });

    public (string Number, string Group)? CostCenterInfo(string number) => _store.Read(d =>
        d.CostCenters.Where(c => c.Number == number).Select(c => ((string, string)?)(c.Number, c.Group)).FirstOrDefault());

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

    public OperationResult Submit(string costCenter, string? name, string? grossText, string? netText, int year, string? note, bool autoApprove = false)
    {
        name = (name ?? "").Trim();
        note = (note ?? "").Trim();
        var errors = new List<string>();
        if (name.Length == 0) errors.Add("Bitte gib eine Bezeichnung ein.");
        else if (name.Length > NameMax) errors.Add($"Die Bezeichnung darf höchstens {NameMax} Zeichen haben.");
        var cents = ParseAmount(grossText);
        var net = ParseAmount(netText);
        if (cents is null && net is not null) cents = NetToGross(net.Value);
        if (cents is null)
            errors.Add("Bitte gib einen Netto- oder Bruttobetrag größer als 0 an, zum Beispiel 1.234,56. Es sind höchstens 2 Nachkommastellen möglich.");
        else if (net is not null && Math.Abs(GrossToNet(cents.Value) - net.Value) > 1)
            errors.Add("Netto und Brutto passen nicht zusammen. Brutto ist Netto × 1,19. Gib nur einen der beiden Beträge an oder gleiche sie ab.");
        if (note.Length == 0) errors.Add("Bitte gib einen Hinweistext zur Freigabe ein.");
        else if (note.Length > NoteMax) errors.Add($"Der Hinweistext darf höchstens {NoteMax} Zeichen haben.");
        if (name.Any(char.IsControl) || note.Any(c => char.IsControl(c) && c != '\n' && c != '\r'))
            errors.Add("Bezeichnung und Hinweistext enthalten ungültige Zeichen.");
        if (errors.Count > 0) return OperationResult.Fail(errors);

        return _store.Write(d =>
        {
            if (!d.Settings.EnabledYears.Contains(year))
                return OperationResult.Fail("Für dieses Kalenderjahr sind Budgetpläne nicht freigeschaltet.");
            d.BudgetItems.Add(new BudgetItem
            {
                CostCenter = costCenter, Name = name, AmountCents = cents!.Value, Year = year, Note = note,
                Status = autoApprove ? BudgetStatus.Approved : BudgetStatus.Pending,
                DecidedUtc = autoApprove ? DateTime.UtcNow : null
            });
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
        .Where(i => i.CostCenter == costCenter && i.Status != BudgetStatus.Approved && d.Settings.EnabledYears.Contains(i.Year))
        .OrderByDescending(i => i.CreatedUtc).Select(i => ToRow(d, i)).ToList());

    /// <summary>Freigegebene Positionen eines Jahres; costCenter null = alle Gruppen (Abteilungsleitung).</summary>
    public List<BudgetRow> Approved(string? costCenter, int year) => _store.Read(d => d.BudgetItems
        .Where(i => i.Status == BudgetStatus.Approved && i.Year == year && (costCenter == null || i.CostCenter == costCenter))
        .OrderBy(i => i.CostCenter).ThenBy(i => i.DecidedUtc).Select(i => ToRow(d, i)).ToList());

    /// <summary>Offene Freigaben. Positionen deaktivierter Jahre bleiben gespeichert, werden aber nicht angezeigt.</summary>
    public List<BudgetRow> Pending() => _store.Read(d => d.BudgetItems
        .Where(i => i.Status == BudgetStatus.Pending && d.Settings.EnabledYears.Contains(i.Year))
        .OrderBy(i => i.CreatedUtc).Select(i => ToRow(d, i)).ToList());

    public List<YearSummary> Overview(string? costCenter) => _store.Read(d =>
    {
        var items = d.BudgetItems.Where(i => costCenter == null || i.CostCenter == costCenter).ToList();
        return Years.Select(y =>
        {
            // Deaktivierte Jahre: Daten bleiben erhalten, werden aber nicht angezeigt.
            var on = d.Settings.EnabledYears.Contains(y);
            var ap = on ? items.Where(i => i.Year == y && i.Status == BudgetStatus.Approved).ToList() : new List<BudgetItem>();
            var pe = on ? items.Where(i => i.Year == y && i.Status == BudgetStatus.Pending).ToList() : new List<BudgetItem>();
            return new YearSummary(y, on, ap.Count, ap.Sum(i => i.AmountCents), pe.Count, pe.Sum(i => i.AmountCents));
        }).ToList();
    });

    /// <summary>Freigegebene Summen je Gruppe und Jahr (Abteilungsleitung).</summary>
    public List<GroupYearRow> ByGroup() => _store.Read(d => d.CostCenters
        .Where(c => c.Number != d.Settings.DepartmentHeadNumber)
        .OrderBy(c => c.Number, StringComparer.Ordinal)
        .Select(c => new GroupYearRow(c.Number, c.Group, Years.ToDictionary(y => y,
            y => d.Settings.EnabledYears.Contains(y)
                ? d.BudgetItems.Where(i => i.CostCenter == c.Number && i.Year == y && i.Status == BudgetStatus.Approved).Sum(i => i.AmountCents)
                : 0)))
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

    /// <summary>
    /// Entfernt eine freigegebene Position (Abteilungsleitung). Gehört sie einer anderen Kostenstelle, ist ein Grund
    /// Pflicht, und die Gruppenleitung erhält eine Mitteilung mit dem Grund.
    /// </summary>
    public OperationResult RemoveApproved(string actingNumber, string id, string? reason, out bool notified)
    {
        notified = false;
        reason = (reason ?? "").Trim();
        if (reason.Length > ReasonMax) return OperationResult.Fail($"Der Grund darf höchstens {ReasonMax} Zeichen haben.");
        var notifiedLocal = false;
        var result = _store.Write(d =>
        {
            var i = d.BudgetItems.FirstOrDefault(x => x.Id == id);
            if (i is not { Status: BudgetStatus.Approved }) return OperationResult.Fail("Die Position gibt es nicht mehr.");
            var foreign = i.CostCenter != actingNumber;
            if (foreign && reason.Length == 0)
                return OperationResult.Fail("Bitte gib einen Grund an. Die Gruppenleitung erhält ihn mit der Mitteilung über die Entfernung.");
            d.BudgetItems.Remove(i);
            if (foreign)
            {
                notifiedLocal = true;
                d.Notifications.Add(new Notification
                {
                    CostCenter = i.CostCenter,
                    Title = "Budgetposition entfernt",
                    Message = $"Die Abteilungsleitung hat die freigegebene Budgetposition „{i.Name}“ ({Money.Brutto(i.AmountCents)}, {i.Year}) entfernt. Grund: {reason}"
                });
            }
            return OperationResult.Success();
        });
        notified = notifiedLocal;
        return result;
    }

    public List<Notification> Notifications(string costCenter) => _store.Read(d => d.Notifications
        .Where(n => n.CostCenter == costCenter).OrderByDescending(n => n.CreatedUtc)
        .Select(n => new Notification { Id = n.Id, CostCenter = n.CostCenter, Title = n.Title, Message = n.Message, CreatedUtc = n.CreatedUtc }).ToList());

    public int NotificationCount(string costCenter) => _store.Read(d => d.Notifications.Count(n => n.CostCenter == costCenter));

    public OperationResult DismissNotification(string costCenter, string id) => _store.Write(d =>
        d.Notifications.RemoveAll(n => n.Id == id && n.CostCenter == costCenter) > 0 ? OperationResult.Success() : OperationResult.Fail("Die Mitteilung gibt es nicht mehr."));

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
