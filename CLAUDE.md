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
- Design-Regeln (`BudgetDashboard/wwwroot/css/site.css`, im Prototyp identisch eingebettet): Bedienelemente einheitlich 48 px hoch (Buttons, Felder, Auswahl), kleine 36 px (Tabellen, Reiter, kleine Buttons); 4 px Radius, keine Schatten und Verläufe; Mint nur für Interaktion; Topline mindestens 19 px fett. Neue Seiten verwenden nur die vorhandenen Klassen und halten diese Höhen ein.
- Budgetposition: Netto- und Bruttofeld rechnen sich gegenseitig (Brutto = Netto × 1,19, kaufmännisch gerundet); gespeichert wird der Bruttobetrag.
- Läuft ohne klassische Datenbank auf einem IIS (JSON-Datei in `App_Data`), standardmäßig auch ohne HTTPS.
- Rollen: Administration (Kostenstelle 00000000), Abteilungsleitung (eine Kostenstelle), Gruppenleitung (alle anderen freigegebenen).
- Navigation Nutzende: Dashboard, Budgetplan, Jahresbudget, Profil, Abmelden. Abteilungsleitung zusätzlich Budgetfreigaben und Upload nach Jahresbudget. Administration: Dashboard, Kostenstellen, Einstellungen, Abmelden.
- Testdaten importieren löscht vorher alle Kostenstellen; Import und Löschen müssen bestätigt werden.
- Handbücher gibt es als HTML in der App (Schaltfläche „Handbuch“ im Header) mit PDF-Download.
- Budgetplan (Unterpunkte): „Dashboard“ (zunächst leer), „Gesamtbudgetplan“ (alle freigegebenen Budgetpositionen für ein Kalenderjahr, Umschalten zwischen den freigeschalteten Jahren) und „Eingabe Budgetposition“. Gruppenleitungen fragen dort Positionen (Bezeichnung, Betrag in EUR brutto mit 2 Nachkommastellen, Kalenderjahr, Hinweistext) bei der Abteilungsleitung an; unter dem Formular steht die Status-Tabelle („Warten …“, „Abgelehnt“ mit Grund im Pop-up, sonst Hinweis „keine Begründung“; Papierkorb löscht, wartende Positionen verschwinden auch bei der Abteilungsleitung). Gibt die Abteilungsleitung eine Position für ihre eigene Kostenstelle ein, ist sie sofort freigegeben, ohne Freigabeweg. Die Abteilungsleitung sieht im Gesamtbudgetplan zuerst die eigene Kostenstelle und wechselt per Dropdown zu jeder anderen.
- Deaktivierte Kalenderjahre: Die Daten bleiben erhalten, werden aber nirgends angezeigt (Gesamtbudgetplan, Status-Tabelle, offene Freigaben, Dashboard-Zahlen, Anzahl „offene Freigaben“). Beim erneuten Aktivieren erscheinen sie wieder.
- Entfernen durch die Abteilungsleitung: Im Gesamtbudgetplan kann die Abteilungsleitung freigegebene Positionen per Papierkorb entfernen. Bei der eigenen Kostenstelle ohne Begründung, bei einer anderen Kostenstelle nur mit Pflicht-Grund; dann erhält die Gruppenleitung eine Mitteilung mit Position und Grund (Dashboard-Karte „Mitteilungen“, Hinweisband unter der Navigation, „Gelesen“ entfernt sie).
- Jahresbudget: später Ausgaben eines Kalenderjahres in Zahlen und Diagrammen (Seite wird noch beschrieben); schon jetzt Umschalten zwischen den freigeschalteten Jahren, Inhalt leer.
- Budgetfreigaben (nur Abteilungsleitung): „Dashboard“ (Standard, aktuelle Zahlen und Überblick über alle Gruppen), „offene Freigaben (N)“ (Einreichungen der Gruppenleitungen: Freigabe oder Ablehnung mit optionalem Grund) und „Freischaltung Budgetpläne“ (Kalenderjahre 2026 bis 2028 für die Eingabe freischalten).
- Ansicht einer Kostenstelle: Die Administration öffnet über „Ansicht“ in der Kostenstellen-Tabelle die Anwendung aus Sicht einer freigegebenen Kostenstelle in einem neuen Tab (Pfad `/_ansicht`, eigenes Cookie, nur lesend, endet mit der Admin-Abmeldung). Im Prototyp läuft sie im selben Fenster.
- Tab-Titel ist der Titel der Anwendung, Favicon ist das R+V-Logo.
