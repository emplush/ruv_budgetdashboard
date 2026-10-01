using Microsoft.AspNetCore.DataProtection;

namespace BudgetDashboard.Services;

/// <summary>Kurzlebige, signierte Marke, mit der die Administration eine Kostenstellen-Ansicht in einem neuen Tab startet.</summary>
public sealed class ViewAsTokenService
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(2);
    private readonly ITimeLimitedDataProtector _protector;

    public ViewAsTokenService(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("BudgetDashboard.ViewAs").ToTimeLimitedDataProtector();
    }

    public string Create(string number) => _protector.Protect(number, Lifetime);

    public string? Read(string? token)
    {
        if (string.IsNullOrEmpty(token)) return null;
        try { return _protector.Unprotect(token); }
        catch { return null; }
    }
}
