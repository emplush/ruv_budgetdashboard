using System.Security.Cryptography;

namespace BudgetDashboard.Services;

/// <summary>PBKDF2-Hashing und Passwortrichtlinie.</summary>
public sealed class PasswordService
{
    private const int Iterations = 600_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;
    public const int MinLength = 12;
    public const int MaxLength = 128;

    private static readonly string[] Blocklist =
    {
        "passwort", "password", "12test34", "qwertz", "qwerty", "123456", "abcdef", "ruv", "budget"
    };

    private readonly string _dummyHash;

    public PasswordService()
    {
        _dummyHash = Hash(Convert.ToBase64String(RandomNumberGenerator.GetBytes(18)));
    }

    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return $"v1.{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public bool Verify(string password, string? stored)
    {
        // Ohne gespeicherten Hash trotzdem rechnen, damit die Antwortzeit gleich bleibt.
        var ok = stored != null;
        var parts = (stored ?? _dummyHash).Split('.');
        if (parts.Length != 4 || parts[0] != "v1" || !int.TryParse(parts[1], out var iterations))
            return false;
        var salt = Convert.FromBase64String(parts[2]);
        var expected = Convert.FromBase64String(parts[3]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected) && ok;
    }

    /// <summary>Liefert die Verstöße gegen die Richtlinie; leer bedeutet gültig.</summary>
    public List<string> Validate(string? password, string costCenter)
    {
        var errors = new List<string>();
        password ??= "";
        if (password.Length < MinLength) errors.Add($"Das Passwort braucht mindestens {MinLength} Zeichen.");
        if (password.Length > MaxLength) errors.Add($"Das Passwort darf höchstens {MaxLength} Zeichen haben.");
        if (!password.Any(char.IsUpper)) errors.Add("Das Passwort braucht mindestens einen Großbuchstaben.");
        if (!password.Any(char.IsLower)) errors.Add("Das Passwort braucht mindestens einen Kleinbuchstaben.");
        if (!password.Any(char.IsDigit)) errors.Add("Das Passwort braucht mindestens eine Ziffer.");
        if (!password.Any(c => !char.IsLetterOrDigit(c) && !char.IsWhiteSpace(c)))
            errors.Add("Das Passwort braucht mindestens ein Sonderzeichen.");
        if (password.Any(char.IsControl)) errors.Add("Das Passwort enthält ungültige Zeichen.");
        if (costCenter.Length > 0 && password.Contains(costCenter))
            errors.Add("Das Passwort darf Deine Kostenstelle nicht enthalten.");
        var lower = password.ToLowerInvariant();
        if (Blocklist.Any(lower.Contains)) errors.Add("Das Passwort enthält ein zu bekanntes Muster.");
        return errors;
    }
}
