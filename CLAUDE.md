# Budget-Dashboard 2.0: Arbeitsregeln

Dauerhafte Vorgaben des Auftraggebers. Sie gelten bei jeder Änderung an der Anwendung.

## Bei jeder Änderung aktualisieren
1. **GitHub:** Änderungen auf dem Entwicklungsbranch committen und pushen.
2. **Artefakt:** Das Artefakt https://claude.ai/artifact/Rs2KWMAhfJTdUGpU16CKp4 ist ein klickbarer Prototyp (`prototype/index.html`, JavaScript). Er bildet die ASP.NET-App funktional nach und wird bei jeder Änderung mit aktualisiert und neu veröffentlicht. Es gibt keinen Demo-Modus und keine Demo-Daten. Beim Veröffentlichen die Funktion `downloads` deklarieren (`capabilities: {downloads: true}`), damit der PDF-Export der Handbücher im Artefakt funktioniert; die PDFs sind im Prototyp eingebettet.
3. **Testdaten:** `BudgetDashboard/Services/TestData.cs` (und im Prototyp `TEST_CASES`/`importTestData`) bildet die typischen Anwendungsfälle ab. Ergibt sich aus einer Änderung ein neuer Fall oder ein neues Feld, die Testdaten und die Fall-Tabelle im Admin-Handbuch erweitern.
4. **Handbücher:** Die drei Handbücher (`BudgetDashboard/Manuals/nutzer.html`, `abteilungsleitung.html`, `admin.html`) mitpflegen: Inhalt, Versionsnummer und Stand. Danach `node tools/build-manuals.js` ausführen, damit die PDFs aktuell sind, und im Prototyp die eingebetteten Handbücher erneuern.
5. **Rauchtest:** `tools/smoke-test.sh` anpassen und gegen eine frische Instanz laufen lassen.

## Fachliche Vorgaben
- Design: R+V-Design (Artefakt https://claude.ai/artifact/46SH9r4rTB8rSRjfDpnJkN), horizontale Navigation unter dem Header, Inhalt in voller Breite, Ansprache mit „Du“.
- Läuft ohne klassische Datenbank auf einem IIS (JSON-Datei in `App_Data`), standardmäßig auch ohne HTTPS.
- Rollen: Administration (Kostenstelle 00000000), Abteilungsleitung (eine Kostenstelle), Gruppenleitung (alle anderen freigegebenen).
- Navigation Nutzende: Dashboard, Budgetplan, Jahresbudget, Profil, Abmelden. Abteilungsleitung zusätzlich Budgetfreigaben und Upload nach Jahresbudget. Administration: Dashboard, Kostenstellen, Einstellungen, Abmelden.
- Testdaten importieren löscht vorher alle Kostenstellen; Import und Löschen müssen bestätigt werden.
- Handbücher gibt es als HTML in der App (Schaltfläche „Handbuch“ im Header) mit PDF-Download.
- Budgetplan: Gruppenleitungen reichen Budgetpositionen (Bezeichnung, Betrag in EUR brutto mit 2 Nachkommastellen, Kalenderjahr, Hinweistext) über „Eingabe Budgetposition“ zur Freigabe ein. Die Abteilungsleitung hat unter „Budgetfreigaben“ drei Unterpunkte: „Dashboard“ (Standard, Überblick über alle Gruppen), „offene Freigaben (N)“ (mit Anzahl; Freigabe oder Ablehnung mit optionalem Grund) und „Freischaltung Budgetpläne“ (Jahre 2026 bis 2028). Status-Tabelle der Gruppenleitung: „Warten …“ und „Abgelehnt“ (Grund im Pop-up, sonst Hinweis „keine Begründung“); Papierkorb löscht, wartende Positionen verschwinden auch bei der Abteilungsleitung. Unter „Budgetplan“ sieht die Abteilungsleitung zuerst nur die eigene Kostenstelle und wechselt per Dropdown zu jeder anderen Kostenstelle. Genehmigte Positionen stehen im Budgetplan unter „Aktueller Stand“ mit Jahresumschalter.
- Ansicht einer Kostenstelle: Die Administration öffnet über „Ansicht“ in der Kostenstellen-Tabelle die Anwendung aus Sicht einer freigegebenen Kostenstelle in einem neuen Tab (Pfad `/_ansicht`, eigenes Cookie, nur lesend, endet mit der Admin-Abmeldung). Im Prototyp läuft sie im selben Fenster.
- Tab-Titel ist der Titel der Anwendung, Favicon ist das R+V-Logo.
