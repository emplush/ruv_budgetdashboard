# Budgetdashboard: Hinweise für Claude

Internes Tool der R+V (Training und Entwicklung Vertrieb). Sprache Deutsch, Anrede „Du“ (immer großgeschrieben), R+V Corporate Wording (emplush/ruv_design, `wording/README.md`, Prüfung `scripts/check_wording.py`). Design aus emplush/ruv_design, Branch `claude/youthful-davinci-580q9o` (Tokens, Schriften, Logos, Icons aus `web/` und `assets/`). Neubeginn am 26.10.2026, der alte Stand (Budget-Dashboard 2.0) ist entfernt.

## Aufbau
- `app/` ist der Ordner für den IIS (Vanilla JS, ohne Build): `js/daten.js` (Modell, Rollen, Rechte, Passwortregeln, Planbudgets, Sicht je Rolle), `js/dienst.js` (Browser- oder Serverbetrieb), `js/design.js` (zehn Farbdesigns, Hell/Dunkel/Automatisch), `js/demo-daten.js`, `js/app.js` (Oberfläche), `css/app.css`, `api.ashx`, `web.config`.
- Antwortet `api.ashx?aktion=ping`, läuft das Tool im Serverbetrieb (JSON in `App_Data/daten.json`, Kopf `X-Budgetdashboard: 1`). Sonst Browserbetrieb mit localStorage (Artefakt).
- Regeln gibt es in `daten.js` und in `api.ashx` (`BdKern`): Passwortregeln, Rechte, Nummern, Beträge, Sicht je Rolle. Beide müssen gleich bleiben (Tests in `tests/logik.test.js` und `server-test.sh`).
- `api.ashx` muss als C# 5 kompilieren (IIS-Compiler): kein `?? throw`, keine String-Interpolation. Datei als UTF-8 mit BOM speichern. CSP verbietet Inline-Skripte und `onclick`. Kein HTTPS: Im Serverbetrieb rechnet nur der Server Passwort-Hashes.
- Iconnamen vor Gebrauch in `app/css/icons.css` prüfen.

## Bei jeder Änderung
1. `node --test tests/logik.test.js`, `node tests/browser-test.js`, `bash tests/server/server-test.sh` (braucht mono-mcs und mono-xsp4) sowie `UI_TEST=1 PORT=8099 bash tests/server/server-test.sh &` mit `node tests/server-ui-test.js http://localhost:8099/`.
2. Version in `VERSION`, `package.json`, `app/js/app.js` (VERSION), `?v=` in `app/index.html`, `BdKern.Version` in `app/api.ashx` und `docs/installation.html` anheben; Eintrag in `CHANGELOG.md`.
3. `python3 tools/build_artefakt.py` baut `dist/artefakt.html`, `python3 tools/build_iis.py` baut die ZIPs in `Aktuelle_Version/` (Neuinstallation und Update ohne `App_Data`, beide ohne Unterordner).
4. Artefakt https://claude.ai/artifact/Rs2KWMAhfJTdUGpU16CKp4 mit `dist/artefakt.html` aktualisieren (gleiche URL).
5. Commit und Push auf den Default-Branch `claude/ecstatic-mayer-vyxwkp`.
