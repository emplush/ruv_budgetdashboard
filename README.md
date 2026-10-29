# Budgetdashboard

Internes Tool der R+V für Training und Entwicklung Vertrieb: Planbudgets je Kostenstelle und Projektnummer und Kalenderjahr.

- **Installieren:** Die aktuellen Pakete liegen in [`Aktuelle_Version/`](Aktuelle_Version/): IIS-ZIP für die Neuinstallation, Update-ZIP ohne `App_Data` und die Installationsanleitung.
- **Ausprobieren:** `dist/artefakt.html` im Browser öffnen (Browserbetrieb mit Beispieldaten).
- **Prototyp online:** https://claude.ai/artifact/Rs2KWMAhfJTdUGpU16CKp4
- **Technik:** IIS mit ASP.NET 4.x (`app/api.ashx`), Vanilla JS ohne Build, Daten als JSON in `App_Data`, keine Datenbank, kein PHP, kein HTTPS nötig.

## Testzugänge im Browserbetrieb
Alle mit dem Passwort `RuV-Plan#2026!`:

| XV-Nummer | Rolle |
|---|---|
| xv00000 | Administrator |
| xv10001 | Abteilungsleitung |
| xv10002, xv10003 | Gruppenleitung |
| xv10004 | Key Account Manager |

`xv10005` (Key Account Manager) hat noch das Einmalpasswort `Kq7#mPz2-wHte`.

## Tests
```
node --test tests/logik.test.js
node tests/browser-test.js
bash tests/server/server-test.sh
UI_TEST=1 PORT=8099 bash tests/server/server-test.sh &  node tests/server-ui-test.js http://localhost:8099/
```
