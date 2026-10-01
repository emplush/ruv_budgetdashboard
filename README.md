# Budget-Dashboard 2.0

ASP.NET-Core-Webanwendung (Razor Pages, .NET 8) im R+V-Design. Sie läuft ohne klassische Datenbank auf einem IIS-Server:
alle Daten liegen in einer JSON-Datei (`App_Data/data.json`).

## Funktionen (Version 1)

- Anmeldung mit Kostenstelle (8 Ziffern) und Passwort.
- Erstanmeldung: Ist für eine freigegebene Kostenstelle noch kein Passwort gesetzt, erscheint ein Dialog zum Setzen des Passworts.
- Rollen: **Administration** (Kostenstelle `00000000`), **Abteilungsleitung** (eine Kostenstelle, im Admin-Bereich festgelegt) und **Gruppenleitung** (alle anderen freigegebenen Kostenstellen).
- Horizontale Navigation unter dem Kopfbereich, Inhalt in voller Breite.
  - Alle Kostenstellen: Dashboard, Budgetplan, Jahresbudget, Profil, Abmelden
  - Abteilungsleitung zusätzlich nach „Jahresbudget“: Budgetfreigaben, Upload
  - Administration: Kostenstellen, Einstellungen, Abmelden
- Die Fachseiten sind zunächst leer und werden später gefüllt. Unter „Profil“ ändern Nutzende ihr Passwort.
- Admin-Bereich
  - Kostenstellen anlegen, freigeben oder sperren, entfernen
  - Org-Einheit (Text, max. 11 Zeichen) und Gruppe (Text, max. 30 Zeichen) je Kostenstelle
  - Abteilungsleitung festlegen oder entziehen
  - Passwort einer Kostenstelle löschen (danach Erstanmeldung mit neuem Passwort)
  - Titel der Anwendung ändern, Admin-Passwort ändern

## Sicherheit

- Passwörter nur als PBKDF2-SHA256-Hash (600.000 Iterationen, eigenes Salz), Vergleich in konstanter Zeit.
- Passwortrichtlinie: 12 bis 128 Zeichen, Groß- und Kleinbuchstaben, Ziffer, Sonderzeichen, keine Kostenstelle, keine bekannten Muster.
- Sperre nach 5 Fehlversuchen für 15 Minuten je Kostenstelle, zusätzlich Begrenzung der Anmeldeanfragen je IP-Adresse.
- Gleiche Fehlermeldung für unbekannte, nicht freigegebene und falsch angemeldete Kostenstellen (keine Auskunft, welche Kostenstellen es gibt).
- Cookie: HttpOnly, SameSite=Strict, Secure (bei `RequireHttps`), 30 Minuten gleitend. Passwortänderung, Passwort löschen, Sperren oder Rollenwechsel beenden bestehende Sitzungen.
- Anti-Forgery-Schutz auf allen Formularen, Content-Security-Policy, X-Frame-Options, HSTS und HTTPS-Umleitung.
- Beim ersten Admin-Login mit dem Standardpasswort wird ein eigenes Passwort verlangt.

## Lokal starten

```bash
cd BudgetDashboard
ASPNETCORE_ENVIRONMENT=Development dotnet run
```

Anmeldung als Administration: Kostenstelle `00000000`, Standardpasswort `12test34` (muss sofort geändert werden).
Rauchtest gegen eine frische Instanz: `tools/smoke-test.sh http://127.0.0.1:5000`.

## Auf IIS bereitstellen

1. Auf dem Server das **.NET 8 Hosting Bundle** (enthält das ASP.NET Core Module V2) installieren und IIS neu starten.
2. Veröffentlichen: `dotnet publish BudgetDashboard -c Release -o publish`
3. Den Inhalt von `publish` in einen Ordner auf dem Server kopieren, z. B. `C:\inetpub\budgetdashboard2`.
4. In IIS eine Website (oder Anwendung) auf diesen Ordner anlegen. Anwendungspool: **Kein verwalteter Code**.
5. Dem Anwendungspool-Konto (`IIS AppPool\<Poolname>`) Schreibrechte auf den Ordner `App_Data` geben (wird beim ersten Start angelegt).
6. HTTPS-Bindung mit Zertifikat einrichten. Ohne HTTPS in `appsettings.json` `Security:RequireHttps` auf `false` setzen (nicht empfohlen).
7. Optional ein anderes Datenverzeichnis über `Storage:Path` setzen. Dieses Verzeichnis gehört in die Datensicherung.

Der Ordner `App_Data` enthält `data.json` (Kostenstellen, Einstellungen, Passwort-Hashes), `data.json.bak` (letzter Stand) und `keys/` (Schlüssel für Cookies). Er ist über IIS nicht abrufbar (`hiddenSegments` in `web.config`).
Die Anwendung ist für **eine** Instanz ausgelegt (der Datenbestand liegt im Arbeitsspeicher und wird in die Datei gespiegelt). Keine Web-Garden- oder Mehrserver-Konfiguration verwenden.

## Konfiguration (`appsettings.json`)

| Schlüssel | Standard | Bedeutung |
| --- | --- | --- |
| `Security:RequireHttps` | `true` | HTTPS-Umleitung, HSTS, Secure-Cookie |
| `Security:HttpsPort` | `443` | Zielport der Umleitung |
| `Security:MaxFailedLogins` | `5` | Fehlversuche bis zur Sperre |
| `Security:LockoutMinutes` | `15` | Dauer der Sperre |
| `Security:SessionMinutes` | `30` | Sitzungsdauer (gleitend) |
| `Security:LoginRequestsPer5Minutes` | `40` | Anmeldeanfragen je IP-Adresse und 5 Minuten |
| `Storage:Path` | leer (`App_Data`) | Datenverzeichnis |

## Aufbau

```
BudgetDashboard/
  Program.cs            Start, Authentifizierung, Sicherheits-Header
  Models/               Datenmodell (StoreData, CostCenter, Rollen)
  Services/             DataStore (JSON), PasswordService, AccountService, SetupTokenService
  Pages/                Razor Pages (Login, SetPassword, Dashboard, ..., Admin/)
  wwwroot/              CSS, Schriften (R+V Sans/Slab), JavaScript
  web.config            IIS-Konfiguration
tools/smoke-test.sh     Rauchtest der Abläufe
```

Design: Design-System „R+V Design“ (Tokens, Schriften, Logo, Komponenten).
