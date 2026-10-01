using Microsoft.AspNetCore.DataProtection;

namespace BudgetDashboard.Services;

/// <summary>Kurzlebige, signierte Marke für den Dialog "Passwort setzen" nach der Ersteinrichtung.</summary>
public sealed class SetupTokenService
{
    public const string CookieName = "bd2.setpw";
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    private readonly ITimeLimitedDataProtector _protector;

    public SetupTokenService(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("BudgetDashboard.SetPassword").ToTimeLimitedDataProtector();
    }

    public string Create(string number) => _protector.Protect(number, Lifetime);

    public string? Read(string? token)
    {
        if (string.IsNullOrEmpty(token)) return null;
        try { return _protector.Unprotect(token); }
        catch { return null; }
    }
}
