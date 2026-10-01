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
  - Administration: Dashboard, Kostenstellen, Einstellungen, Abmelden
- Die Fachseiten sind zunächst leer und werden später gefüllt. Unter „Profil“ ändern Nutzende ihre Org-Einheit, ihre Gruppe (die Kostenstelle ist nicht änderbar) und ihr Passwort.
- Admin-Bereich
  - Kostenstellen anlegen, freigeben oder sperren, entfernen
  - Org-Einheit (Text, max. 11 Zeichen) und Gruppe (Text, max. 30 Zeichen) je Kostenstelle
  - Abteilungsleitung festlegen oder entziehen
  - Passwort einer Kostenstelle löschen (danach Erstanmeldung mit neuem Passwort)
  - Ansicht einer Kostenstelle in einem neuen Tab (schreibgeschützt, Navigation und Funktionen der jeweiligen Rolle)
  - Titel der Anwendung ändern, Admin-Passwort ändern
  - Testdaten importieren (löscht vorher alle Kostenstellen) und löschen, jeweils mit Bestätigung
- Budgetplan mit Dashboard (zunächst leer), Gesamtbudgetplan (freigegebene Positionen je Kalenderjahr) und Eingabe Budgetposition. Gruppenleitungen fragen Positionen bei der Abteilungsleitung an, die Positionen der Abteilungsleitung für die eigene Kostenstelle sind sofort freigegeben. Die Abteilungsleitung wechselt im Gesamtbudgetplan per Auswahl zwischen den Kostenstellen.
- Jahresbudget (später Ausgaben als Zahlen und Diagramme) mit Umschalter für die freigeschalteten Kalenderjahre.
- Budgetfreigaben (nur Abteilungsleitung): Dashboard, offene Freigaben mit Anzahl, Freischaltung der Kalenderjahre 2026 bis 2028.
- Budgetposition mit Netto- und Bruttofeld, die sich gegenseitig berechnen (Brutto = Netto × 1,19).
- Handbücher für Nutzende, Abteilungsleitung und Administration als HTML in der App (Schaltfläche „Handbuch“ im Header), jeweils mit PDF-Download

## Sicherheit

- Passwörter nur als PBKDF2-SHA256-Hash (600.000 Iterationen, eigenes Salz), Vergleich in konstanter Zeit.
- Passwortrichtlinie: 12 bis 128 Zeichen, Groß- und Kleinbuchstaben, Ziffer, Sonderzeichen, keine Kostenstelle, keine bekannten Muster.
- Sperre nach 5 Fehlversuchen für 15 Minuten je Kostenstelle, zusätzlich Begrenzung der Anmeldeanfragen je IP-Adresse.
- Gleiche Fehlermeldung für unbekannte, nicht freigegebene und falsch angemeldete Kostenstellen (keine Auskunft, welche Kostenstellen es gibt).
- Cookie: HttpOnly, SameSite=Strict, 30 Minuten gleitend; Secure, sobald die Seite über HTTPS aufgerufen wird. Passwortänderung, Passwort löschen, Sperren oder Rollenwechsel beenden bestehende Sitzungen.
- Anti-Forgery-Schutz auf allen Formularen, Content-Security-Policy, X-Frame-Options, und optional HSTS mit HTTPS-Umleitung (`Security:RequireHttps`).
- Solange das Standardpasswort aktiv ist, erscheint auf jeder Admin-Seite ein Hinweis, ein eigenes Passwort zu setzen.

## Klickbarer Prototyp

`prototype/index.html` bildet Anmeldung, Rollen, Navigation, Profil, Admin-Bereich, Testdaten und Handbücher im Browser nach (Daten im `localStorage`, keine Server-Sicherheit). Er ist die Fassung für das Artefakt und ersetzt die ASP.NET-Anwendung nicht. Datei im Browser öffnen genügt.

## Handbücher

Die Quellen liegen als HTML in `BudgetDashboard/Manuals/` (`nutzer.html`, `abteilungsleitung.html`, `admin.html`). Die App zeigt sie unter „Handbuch“ an. Die PDF-Fassungen entstehen mit `node tools/build-manuals.js` (Node und Playwright mit Chromium nötig) und liegen daneben. Nach jeder Änderung an App oder Handbuch neu erzeugen und mit einchecken.

## Testdaten

Im Admin-Bereich unter „Einstellungen“ importiert der Abschnitt „Testdaten“ acht Kostenstellen (`10000001` bis `10000008`) mit den typischen Fällen, dazu Budgetpositionen (freigegeben, wartend, abgelehnt) und die Freischaltung von 2026 und 2027. Der Import löscht vorher alle Kostenstellen und verlangt eine Bestätigung. Das Passwort der Testkostenstellen steht im Abschnitt und im Admin-Handbuch. Definition: `BudgetDashboard/Services/TestData.cs`.

## Lokal starten

```bash
cd BudgetDashboard
dotnet run
```

Anmeldung als Administration: Kostenstelle `00000000`, Standardpasswort `12test34` (bitte sofort ändern).
Rauchtest gegen eine frische Instanz: `tools/smoke-test.sh http://127.0.0.1:5000`.

## Auf IIS bereitstellen

1. Auf dem Server das **.NET 8 Hosting Bundle** (enthält das ASP.NET Core Module V2) installieren und IIS neu starten.
2. Veröffentlichen: `dotnet publish BudgetDashboard -c Release -o publish`
3. Den Inhalt von `publish` in einen Ordner auf dem Server kopieren, z. B. `C:\inetpub\budgetdashboard2`.
4. In IIS eine Website (oder Anwendung) auf diesen Ordner anlegen. Anwendungspool: **Kein verwalteter Code**.
5. Dem Anwendungspool-Konto (`IIS AppPool\<Poolname>`) Schreibrechte auf den Ordner `App_Data` geben (wird beim ersten Start angelegt).
6. Die Anwendung läuft ohne weitere Einstellung über HTTP. Wer HTTPS nutzt (empfohlen), richtet die Bindung mit Zertifikat ein und setzt `Security:RequireHttps` auf `true`. Dann leitet die Anwendung auf HTTPS um und setzt HSTS. Über HTTP werden Passwörter unverschlüsselt übertragen. Das ist nur in einem vertrauenswürdigen Netz vertretbar.
7. Optional ein anderes Datenverzeichnis über `Storage:Path` setzen. Dieses Verzeichnis gehört in die Datensicherung.

Der Ordner `App_Data` enthält `data.json` (Kostenstellen, Einstellungen, Passwort-Hashes), `data.json.bak` (letzter Stand) und `keys/` (Schlüssel für Cookies). Er ist über IIS nicht abrufbar (`hiddenSegments` in `web.config`).
Die Anwendung ist für **eine** Instanz ausgelegt (der Datenbestand liegt im Arbeitsspeicher und wird in die Datei gespiegelt). Keine Web-Garden- oder Mehrserver-Konfiguration verwenden.

## Konfiguration (`appsettings.json`)

| Schlüssel | Standard | Bedeutung |
| --- | --- | --- |
| `Security:RequireHttps` | `false` | `true` erzwingt HTTPS (Umleitung, HSTS, Secure-Cookie) |
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
  Services/             DataStore (JSON), PasswordService, AccountService, SetupTokenService, TestData
  Manuals/              Handbücher (HTML und PDF)
  Pages/                Razor Pages (Login, SetPassword, Dashboard, ..., Admin/)
  wwwroot/              CSS, Schriften (R+V Sans/Slab), JavaScript
  web.config            IIS-Konfiguration
tools/smoke-test.sh     Rauchtest der Abläufe
tools/build-manuals.js  erzeugt die Handbuch-PDFs
prototype/index.html    klickbare Demo ohne Server
```

Design: Design-System „R+V Design“ (Tokens, Schriften, Logo, Komponenten).
