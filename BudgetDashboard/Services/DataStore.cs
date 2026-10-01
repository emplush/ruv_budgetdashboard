using System.Text.Json;
using BudgetDashboard.Models;

namespace BudgetDashboard.Services;

/// <summary>
/// Dateibasierter Speicher ohne Datenbank: ein JSON-Dokument in App_Data, im Speicher gehalten
/// und bei jeder Änderung atomar geschrieben (temporäre Datei, dann Austausch mit Sicherung).
/// </summary>
public sealed class DataStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly object _lock = new();
    private readonly string _file;
    private StoreData _data;

    public DataStore(IWebHostEnvironment env, IConfiguration config, PasswordService passwords)
    {
        var configured = config["Storage:Path"];
        var dir = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(env.ContentRootPath, "App_Data")
            : configured;
        Directory.CreateDirectory(dir);
        _file = Path.Combine(dir, "data.json");
        StorageDirectory = dir;

        if (File.Exists(_file))
        {
            _data = JsonSerializer.Deserialize<StoreData>(File.ReadAllText(_file), JsonOptions) ?? new StoreData();
        }
        else
        {
            _data = new StoreData();
        }

        if (string.IsNullOrEmpty(_data.Admin.PasswordHash))
        {
            _data.Admin.Number = Roles.AdminNumber;
            _data.Admin.PasswordHash = passwords.Hash("12test34");
            _data.Settings.AdminMustChangePassword = true;
            Save();
        }
    }

    public string StorageDirectory { get; }

    public string Title
    {
        get { lock (_lock) return _data.Settings.Title; }
    }

    public T Read<T>(Func<StoreData, T> read)
    {
        lock (_lock) return read(_data);
    }

    public T Write<T>(Func<StoreData, T> change)
    {
        lock (_lock)
        {
            var result = change(_data);
            Save();
            return result;
        }
    }

    private void Save()
    {
        var temp = _file + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(_data, JsonOptions));
        if (File.Exists(_file))
            File.Replace(temp, _file, _file + ".bak");
        else
            File.Move(temp, _file);
    }
}
