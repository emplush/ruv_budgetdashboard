/* Handbuch: Inhalt für die Seite #/handbuch und das PDF (tools/handbuch_pdf.js).
   Bilder in handbuch/bilder/ (tools/handbuch_bilder.js). Bei Änderungen an der Oberfläche hier mitpflegen. */
(function (global) {
  "use strict";

  function bild(name, text, schmal) {
    return '<figure class="hb-bild' + (schmal ? " hb-bild--schmal" : "") + '"><img src="handbuch/bilder/' + name + '.png" alt="' + text + '" loading="lazy"><figcaption>' + text + "</figcaption></figure>";
  }
  function tipp(text) { return '<p class="hb-tipp"><strong>Tipp:</strong> ' + text + "</p>"; }
  function hinweis(text) { return '<p class="hb-hinweis"><strong>Wichtig:</strong> ' + text + "</p>"; }

  var kapitel = [
    {
      id: "ueberblick", titel: "Überblick", fuer: "Alle",
      html:
        "<p>Mit dem Budgetdashboard planst Du die Budgets der Abteilung Training und Entwicklung Vertrieb und behältst die Ausgaben im Blick. " +
        "Für jede Kostenstelle und jede Projektnummer gibt es ein Planbudget je Kalenderjahr. Die IST-Werte kommen aus den KST-Berichten des Konzern-Controllings.</p>" +
        "<p>Das Tool zeigt Dir, wie viel schon ausgegeben ist, was noch übrig ist und wo das Jahr voraussichtlich endet.</p>" +
        "<h3>Rollen und Rechte</h3>" +
        '<div class="hb-tabelle"><table><thead><tr><th>Rolle</th><th>Sieht</th><th>Darf</th></tr></thead><tbody>' +
        "<tr><th>Administrator</th><td>Benutzer, Kostenstellen, Projektnummern, Einstellungen. Keine Budgets.</td><td>Benutzer verwalten, Kostenstellen und Projektnummern anlegen und zuweisen, Titel der Anwendung ändern, Sicherungen wiederherstellen.</td></tr>" +
        "<tr><th>Abteilungsleitung</th><td>Alle Budgets, IST-Werte und Projektkosten der Abteilung.</td><td>Planbudgets eintragen, KST-Berichte importieren, Projektkosten erfassen, Benutzer (außer Administratoren), Kostenstellen und Projektnummern verwalten.</td></tr>" +
        "<tr><th>Gruppenleitung</th><td>Die eigenen Kostenstellen mit ihren Unterkostenstellen und Projektnummern.</td><td>Ansehen, als PDF speichern, Profil und Design ändern.</td></tr>" +
        "<tr><th>Key Account Manager</th><td>Die eigenen Projektnummern.</td><td>Ansehen, Kosten der eigenen Projektnummern erfassen, als PDF speichern, Profil und Design ändern.</td></tr>" +
        "</tbody></table></div>" +
        "<h3>Zwei Betriebsarten</h3>" +
        "<p><strong>Serverbetrieb:</strong> Das Tool läuft auf dem IIS. Alle Daten liegen zentral auf dem Server, alle sehen denselben Stand.</p>" +
        "<p><strong>Browserbetrieb:</strong> Zum Ausprobieren, zum Beispiel als Demo. Die Daten liegen nur in Deinem Browser. Die Fußzeile zeigt dann „Browserbetrieb“. " +
        "Alle Beispielkonten haben das Passwort <code>RuV-Plan#2026!</code>.</p>"
    },
    {
      id: "anmelden", titel: "Anmelden und Passwort", fuer: "Alle",
      html:
        bild("anmeldung", "Anmeldung mit XV-Nummer und Passwort") +
        "<ol><li>Gib Deine XV-Nummer ein, zum Beispiel <code>xv12345</code>.</li><li>Gib Dein Passwort ein und klicke auf „Anmelden“.</li></ol>" +
        "<p>Eine Registrierung gibt es nicht. Dein Konto legt die Abteilungsleitung oder der Administrator an.</p>" +
        "<h3>Erste Anmeldung mit Einmalpasswort</h3>" +
        "<p>Für ein neues Konto gibt es ein Einmalpasswort. Damit meldest Du Dich das erste Mal an. Danach legst Du direkt Dein eigenes Passwort fest.</p>" +
        bild("passwort-festlegen", "Eigenes Passwort festlegen nach der ersten Anmeldung") +
        "<p>Ein gutes Passwort hat:</p><ul><li>mindestens 12 Zeichen,</li><li>Klein- und Großbuchstaben, eine Ziffer und ein Sonderzeichen,</li>" +
        "<li>nicht Deine XV-Nummer oder Deinen Namen,</li><li>keine gängigen Wörter wie „Passwort“ oder Zahlenfolgen wie „123456“,</li><li>kein Zeichen viermal hintereinander.</li></ul>" +
        "<p>Die Liste unter dem Feld zeigt Dir beim Tippen, was noch fehlt.</p>" +
        "<h3>Sicherheit</h3>" +
        "<ul><li>Nach fünf falschen Passwörtern ist die Anmeldung für 15 Minuten gesperrt.</li>" +
        "<li>Im Serverbetrieb bleibst Du sieben Tage angemeldet. Mit „Abmelden“ im Menü oben rechts beendest Du die Anmeldung sofort.</li>" +
        "<li>Passwort vergessen? Die Abteilungsleitung oder der Administrator erzeugt Dir ein neues Einmalpasswort.</li></ul>"
    },
    {
      id: "oberflaeche", titel: "Aufbau der Oberfläche", fuer: "Alle",
      html:
        "<ul><li><strong>Kopfzeile:</strong> Links das Logo und der Titel. Ein Klick darauf führt zur Startseite.</li>" +
        "<li><strong>Navigation:</strong> Start, Planbudgets, IST-Werte und Verwaltung. Du siehst nur, was Deine Rolle darf.</li>" +
        "<li><strong>Mond-Symbol:</strong> wechselt zwischen hellem und dunklem Design.</li>" +
        "<li><strong>Kreis mit Deinen Initialen:</strong> öffnet das Menü mit „Mein Profil“, „Handbuch“ und „Abmelden“.</li>" +
        "<li><strong>Kalenderjahr:</strong> Jede Ansicht startet mit dem aktuellen Jahr. Ein anderes Jahr wählst Du oben rechts. Die Wahl gilt nur für diese Ansicht.</li>" +
        "<li><strong>Als Excel herunterladen:</strong> speichert Planbudgets, IST-Werte und Projektkosten des Kalenderjahres als Excel-Datei, siehe Kapitel „Excel-Export“.</li>" +
        "<li><strong>Als PDF speichern:</strong> speichert die aktuelle Auswertung als PDF, siehe Kapitel „Als PDF speichern“.</li>" +
        "<li><strong>Zurück zur Übersicht:</strong> Auf Detailseiten führt Dich der Link oben zurück zur Seite, von der Du gekommen bist.</li></ul>" +
        "<h3>Zahlen und Farben</h3>" +
        "<p>Beträge stehen immer mit Tausenderpunkt und zwei Nachkommastellen in EUR, zum Beispiel 1.250.000,00 EUR. " +
        "In Eingabefeldern setzt das Tool die Punkte schon beim Tippen.</p>" +
        '<div class="hb-tabelle"><table><thead><tr><th>Anzeige</th><th>Bedeutung</th></tr></thead><tbody>' +
        '<tr><td><span class="ampel ampel--gruen">im Plan</span></td><td>Die Hochrechnung liegt bei höchstens 95 % des Planbudgets.</td></tr>' +
        '<tr><td><span class="ampel ampel--gelb">knapp</span></td><td>Die Hochrechnung liegt zwischen 95 % und 100 %.</td></tr>' +
        '<tr><td><span class="ampel ampel--rot">über Plan</span></td><td>Die Hochrechnung liegt über 100 % des Planbudgets.</td></tr>' +
        "</tbody></table></div>" +
        "<p>Das sind die Standardgrenzen. Die Abteilungsleitung kann sie unter Verwaltung → Einstellungen ändern, siehe Kapitel „Ampel einstellen“. Die geltenden Grenzen stehen in der Hilfe neben der Ampel.</p>"
    },
    {
      id: "begriffe", titel: "Begriffe und Rechnungen", fuer: "Alle",
      html:
        "<dl class=\"hb-begriffe\">" +
        "<dt>Kostenstelle</dt><dd>Drei Ziffern, zum Beispiel 410. Gruppenleitungen bekommen Kostenstellen zugewiesen.</dd>" +
        "<dt>Übergreifende Kostenstelle und Unterkostenstelle</dt><dd>Eine Kostenstelle kann mehrere Unterkostenstellen haben. Es gibt nur diese eine Ebene. Jede Unterkostenstelle gehört zu höchstens einer übergreifenden Kostenstelle. In Tabellen hängen Unterkostenstellen eingerückt an ihrer Kostenstelle.</dd>" +
        "<dt>Projektnummer</dt><dd>Acht Ziffern, zum Beispiel 41000101. Sie gehört meist zu einer Kostenstelle. Key Account Manager bekommen Projektnummern zugewiesen.</dd>" +
        "<dt>Planbudget</dt><dd>Das geplante Budget für ein Kalenderjahr. Bei Kostenstellen aufgeteilt in Personalkosten ID, Personalkosten AD und Sachkosten (Werbung, Reise/KfZ, Sonstiges). Projektnummern haben nur einen Betrag.</dd>" +
        "<dt>Einzelbudget</dt><dd>Das Planbudget, das für eine Kostenstelle selbst eingetragen ist. Es enthält ihre Projektnummern.</dd>" +
        "<dt>Gesamtbudget</dt><dd>Bei einer übergreifenden Kostenstelle: Einzelbudget plus die Planbudgets aller Unterkostenstellen. Die Unterkostenstellen zählen nur hier und nicht noch einmal im Abteilungsbudget.</dd>" +
        "<dt>Abteilungsbudget</dt><dd>Summe der obersten Kostenstellen plus Projektnummern ohne Kostenstelle.</dd>" +
        "<dt>IST</dt><dd>Die gebuchten Ausgaben aus dem KST-Bericht, bis zum gebuchten Monat. Der KST-Bericht einer übergreifenden Kostenstelle enthält schon ihre Unterkostenstellen und Projektnummern.</dd>" +
        "<dt>Ausgegeben</dt><dd>IST geteilt durch Planbudget. Der Strich im Balken zeigt, wie viel vom Jahr schon gebucht ist.</dd>" +
        "<dt>Restbudget</dt><dd>Planbudget minus IST. Dazu steht, wie viel je Restmonat noch verfügbar ist.</dd>" +
        "<dt>Zeitanteilig</dt><dd>Vergleicht das IST mit dem Plan bis zum gebuchten Monat. Beispiel: Gebucht bis September sind 75 % des Jahres um. Sind 60 % des Plans ausgegeben, liegt die Kostenstelle bei 80 % des zeitanteiligen Plans.</dd>" +
        "<dt>Hochrechnung Jahresende</dt><dd>Das IST gleichmäßig bis Dezember fortgeschrieben: IST geteilt durch die gebuchten Monate mal 12.</dd>" +
        "<dt>Prognose in %</dt><dd>Hochrechnung geteilt durch Planbudget. So viel vom Planbudget wird bis Dezember voraussichtlich ausgeschöpft.</dd>" +
        "<dt>Vorjahr gleicher Zeitraum</dt><dd>Das IST des Vorjahres bis zum selben Monat, ebenfalls aus dem KST-Bericht.</dd>" +
        "</dl>"
    },
    {
      id: "start", titel: "Startseite", fuer: "Alle",
      html:
        "<p>Die Startseite begrüßt Dich mit Deinem Vornamen und zeigt, was für Deine Rolle wichtig ist.</p>" +
        "<h3>Abteilungsleitung</h3>" +
        "<p>Oben steht das Abteilungsbudget mit Plan und IST in getrennten Bereichen. Darunter vergleicht ein Diagramm Plan, IST und Vorjahr je Kostenart. " +
        "Die Tabelle „Einzelbudgets der Kostenstellen“ zeigt jede Kostenstelle mit Planbudget, IST, Restbudget und Ampel. Mit Klick auf eine Nummer öffnest Du die Detailseite.</p>" +
        bild("start-abteilungsleitung", "Startseite der Abteilungsleitung") +
        "<h3>Gruppenleitung</h3>" +
        "<p>Oben steht die Tabelle „Kostenstellen auf einen Blick“. Darunter folgt jede Kostenstelle für sich mit Kennzahlen, Verbrauchsbalken, Prognose bis Dezember, „Auf einen Blick“ und den Kostenarten mit Plan, IST, Restbudget, Hochrechnung und Prognose in %.</p>" +
        bild("start-gruppenleitung", "Startseite der Gruppenleitung") +
        "<h3>Key Account Manager</h3>" +
        "<p>Du siehst Deine Projektnummern mit Planbudget, erfassten Kosten und Restbudget. Über „Kosten erfassen und ansehen“ kommst Du zur Seite der Projektnummer.</p>" +
        bild("start-kam", "Startseite eines Key Account Managers") +
        "<h3>Administrator</h3>" +
        "<p>Kacheln führen direkt zu Benutzern, Kostenstellen, Projektnummern und Einstellungen.</p>" +
        bild("start-administrator", "Startseite des Administrators")
    },
    {
      id: "planbudgets", titel: "Planbudgets eintragen", fuer: "Abteilungsleitung",
      html:
        "<p>Unter „Planbudgets“ siehst Du alle Planbudgets des gewählten Kalenderjahres: oben die Summen, darunter die Kostenstellen und die Projektnummern.</p>" +
        bild("planbudgets", "Planbudgets aller Kostenstellen und Projektnummern") +
        "<ol><li>Wähle oben das Kalenderjahr.</li><li>Klicke in der Zeile auf den Stift oder das Plus.</li>" +
        "<li>Trage die Beträge ein. Leere Felder zählen als 0,00 EUR.</li><li>Klicke auf „Planbudget speichern“.</li></ol>" +
        bild("planbudget-eintragen", "Planbudget einer Kostenstelle eintragen", true) +
        "<p>Für eine übergreifende Kostenstelle trägst Du nur ihr Einzelbudget ein, inklusive ihrer Projektnummern. Das Gesamtbudget rechnet das Tool aus Einzelbudget und Unterkostenstellen.</p>" +
        "<p>Für eine Projektnummer gibt es nur einen Betrag ohne Kostenarten.</p>" +
        tipp("Fehlt einer Kostenstelle oder Projektnummer noch ein Planbudget, weist Dich die Startseite darauf hin.") +
        "<h3>Planbudgets aus dem Vorjahr übernehmen</h3>" +
        "<p>Für ein neues Kalenderjahr musst Du nicht alles neu eintragen. Gibt es im Vorjahr Planbudgets, steht über den Kennzahlen der Knopf „Planbudgets aus … übernehmen“.</p>" +
        "<ol><li>Wähle oben das neue Kalenderjahr.</li><li>Klicke auf „Planbudgets aus … übernehmen“.</li>" +
        "<li>Sind für das neue Jahr schon Planbudgets eingetragen, entscheidest Du: Ohne Haken bleiben sie, wie sie sind. Mit Haken bei „Vorhandene Planbudgets überschreiben“ ersetzt das Tool sie durch die Werte aus dem Vorjahr.</li>" +
        "<li>Klicke auf „Jetzt übernehmen“ und passe danach einzelne Werte wie gewohnt an.</li></ol>" +
        bild("uebernahme", "Planbudgets aus dem Vorjahr übernehmen", true) +
        "<p>Das Tool übernimmt nur Kostenstellen und Projektnummern, die es noch gibt.</p>" +
        "<h3>Änderungsprotokoll</h3>" +
        "<p>Unter den Tabellen steht das Änderungsprotokoll des gewählten Kalenderjahres: wer wann welches Planbudget eingetragen oder geändert hat, mit den Beträgen vorher und nachher. " +
        "Bei einer Übernahme steht als Anlass „Übernahme aus …“. Neue Einträge stehen oben, „Weitere anzeigen“ lädt ältere nach.</p>" +
        bild("aenderungsprotokoll", "Änderungsprotokoll der Planbudgets") +
        tipp("Das Tool hebt die letzten 1.000 Einträge über alle Kalenderjahre auf. Das Änderungsprotokoll sieht nur die Abteilungsleitung.")
    },
    {
      id: "ist", titel: "IST-Werte", fuer: "Abteilungsleitung",
      html:
        "<p>Die Seite „IST-Werte“ vergleicht IST und Plan für alle Kostenstellen und Projektnummern: ausgegeben in %, Restbudget, Hochrechnung, Vorjahr und Ampel.</p>" +
        bild("ist-werte", "IST gegen Plan für alle Kostenstellen") +
        "<p>Je Zeile steht der Stand des KST-Berichts. Haben Kostenstellen unterschiedliche Stände, weist das Tool darauf hin.</p>" +
        "<p>Über „KST-Bericht importieren“ kommst Du direkt zum Import, siehe Kapitel „KST-Berichte importieren“.</p>"
    },
    {
      id: "kostenstelle", titel: "Detailseite einer Kostenstelle", fuer: "Abteilungsleitung",
      html:
        "<p>Mit Klick auf eine Kostenstellennummer öffnest Du ihre Detailseite. Sie zeigt Kennzahlen, Plan und IST je Position, Hochrechnung und Vorjahr je Position und ein Diagramm nach Kostenarten.</p>" +
        bild("kostenstelle-detail", "Detailseite der Kostenstelle 411") +
        "<h3>Übergreifende Kostenstelle: Gesamt oder nur selbst</h3>" +
        "<p>Bei einer übergreifenden Kostenstelle wählst Du oben:</p>" +
        "<ul><li><strong>Gesamt mit Unterkostenstellen:</strong> Gesamtbudget und IST aus ihrem KST-Bericht. Die „Zusammensetzung“ zeigt die Anteile.</li>" +
        "<li><strong>Nur … selbst:</strong> nur das Einzelbudget und das eigene IST, ohne Unterkostenstellen und Projektnummern.</li></ul>" +
        bild("kostenstelle-umschalter", "Umschalter auf der Detailseite einer übergreifenden Kostenstelle") +
        "<p>Beispiel: Der KST-Bericht der Kostenstelle 001 zeigt 50.000,00 EUR, ihre Unterkostenstelle 101 hat 30.000,00 EUR und ihre Projektnummer 5.000,00 EUR. Auf 001 selbst bleiben 15.000,00 EUR.</p>"
    },
    {
      id: "bericht", titel: "Bericht einer übergreifenden Kostenstelle", fuer: "Abteilungsleitung",
      html:
        "<p>Über das Diagramm-Symbol in der Tabelle öffnest Du den Bericht einer übergreifenden Kostenstelle. Er stellt Planbudget und IST je Position nebeneinander: eigenes Budget, jede Unterkostenstelle, Projektnummern und gesamt.</p>" +
        bild("bericht", "Bericht der übergreifenden Kostenstelle 410") +
        "<p>Mit „Bericht kopieren“ fügst Du alle Tabellen direkt in Excel ein. So gleichst Du sie mit Deinen KST-Berichten ab.</p>"
    },
    {
      id: "projekte", titel: "Projektnummern und Projektkosten", fuer: "Abteilungsleitung, Key Account Manager, Gruppenleitung",
      html:
        "<p>Projektnummern haben kein eigenes IST aus dem KST-Bericht. Ihre Kosten erfasst Du von Hand. Sie stecken schon im KST-Bericht ihrer Kostenstelle, das Tool schlüsselt sie nur auf.</p>" +
        bild("projekt", "Seite einer Projektnummer mit erfassten Kosten") +
        "<h3>Kosten erfassen</h3>" +
        "<p>Kosten erfassen die Abteilungsleitung (für alle Projektnummern) und Key Account Manager (für ihre eigenen). Gruppenleitungen sehen die Kosten nur.</p>" +
        "<ol><li>Öffne die Projektnummer und klicke auf „Kosten erfassen“.</li><li>Trage Datum, Betrag und eine Beschreibung ein.</li><li>Klicke auf „Kosten speichern“.</li></ol>" +
        bild("kosten-erfassen", "Kosten für eine Projektnummer erfassen", true) +
        "<p>Mit dem Stift änderst Du einen Eintrag, mit dem Papierkorb löschst Du ihn. Die Liste zeigt, wer den Eintrag wann erfasst hat.</p>"
    },
    {
      id: "kst-berichte", titel: "KST-Berichte importieren", fuer: "Abteilungsleitung",
      html:
        "<p>Die IST-Werte kommen aus dem KST-Bericht des Konzern-Controllings als Excel-Datei (.xlsx). Du importierst immer einen Bericht für eine Kostenstelle.</p>" +
        bild("kst-berichte", "Verwaltung, Reiter KST-Berichte") +
        "<ol><li>Öffne Verwaltung → KST-Berichte.</li><li>Wähle die Kostenstelle.</li><li>Wähle den KST-Bericht der Kostenstelle.</li>" +
        "<li>Prüfe die Vorschau: Stand, gebuchter Monat und die Werte je Position.</li><li>Klicke auf „IST-Werte importieren“.</li></ol>" +
        bild("kst-vorschau", "Vorschau mit Prüfung der Summen") +
        "<p>Das Tool liest die Kostenstelle aus dem Bericht (zum Beispiel KST141100 → 411). Passt sie nicht zur gewählten Kostenstelle, bricht es den Import ab. " +
        "Es prüft außerdem, ob die Summen von Sachkosten und Primärkosten I zur Datei passen.</p>" +
        "<p>Das Tool liest die Spalten „Ist“: Vorjahr gesamt, Vorjahr bis zum Monat und das aktuelle Jahr bis zum Monat. Daher kommt zum Beispiel „IST 2025 bis September“.</p>" +
        "<h3>Sicherungen</h3>" +
        "<p>Vor jedem Import sichert das Tool den bisherigen Stand der Kostenstelle. Unter „Sicherungen“ holst Du ihn mit „Wiederherstellen“ zurück. Das dürfen Abteilungsleitung und Administrator.</p>" +
        hinweis("Echte KST-Berichte enthalten Namen. Gib sie nur im Tool selbst ein und nicht in Demos oder Testdateien.")
    },
    {
      id: "benutzer", titel: "Benutzer verwalten", fuer: "Abteilungsleitung, Administrator",
      html:
        "<p>Unter Verwaltung → Benutzer siehst Du alle Konten mit Rolle, zugewiesenen Nummern, Passwortstand und letzter Anmeldung.</p>" +
        bild("verwaltung-benutzer", "Benutzerverwaltung") +
        "<h3>Benutzer anlegen</h3>" +
        "<ol><li>Klicke auf „Neuer Benutzer“.</li><li>Gib XV-Nummer, Vorname, Nachname und Rolle ein.</li>" +
        "<li>Weise Kostenstellen (Gruppenleitung, Abteilungsleitung) oder Projektnummern (Key Account Manager) zu. Das ist optional, mehrere sind möglich.</li>" +
        "<li>Übernimm das vorgeschlagene Einmalpasswort oder erzeuge mit „Neu“ ein anderes.</li><li>Klicke auf „Benutzer anlegen“.</li></ol>" +
        bild("benutzer-anlegen", "Neuen Benutzer anlegen", true) +
        "<p>Das Einmalpasswort bleibt in der Liste sichtbar, bis die Person bei der ersten Anmeldung ihr eigenes Passwort festlegt. Gib es ihr persönlich weiter.</p>" +
        "<h3>Ändern, Passwort zurücksetzen, löschen</h3>" +
        "<ul><li>Stift: Name, Rolle und Zuweisungen ändern. Die XV-Nummer bleibt.</li>" +
        "<li>Schloss: neues Einmalpasswort erzeugen. Das bisherige Passwort gilt dann nicht mehr.</li>" +
        "<li>Papierkorb: Konto löschen. Die Zuweisungen fallen weg. Das eigene Konto kannst Du nicht löschen.</li></ul>" +
        "<p>Die Abteilungsleitung verwaltet alle Konten außer den Administratoren und kann keine Administratoren anlegen.</p>"
    },
    {
      id: "nummern", titel: "Kostenstellen und Projektnummern verwalten", fuer: "Abteilungsleitung, Administrator",
      html:
        bild("verwaltung-kostenstellen", "Verwaltung, Reiter Kostenstellen") +
        "<h3>Kostenstelle anlegen oder ändern</h3>" +
        "<ol><li>Klicke auf „Neue Kostenstelle“ oder in der Zeile auf den Stift.</li><li>Gib die Nummer mit drei Ziffern ein.</li>" +
        "<li>Wähle unter „Verantwortlich“ die Personen.</li><li>Ordne die Kostenstelle bei Bedarf einer übergreifenden Kostenstelle zu („Gehört zu“) oder wähle ihre Unterkostenstellen.</li>" +
        "<li>Speichere.</li></ol>" +
        bild("kostenstelle-bearbeiten", "Kostenstelle mit Unterkostenstellen bearbeiten", true) +
        "<p>Änderst Du die Nummer, wandern die Planbudgets mit. Löschst Du eine Kostenstelle, löscht das Tool auch ihre Planbudgets.</p>" +
        "<h3>Projektnummern</h3>" +
        "<p>Im Reiter Projektnummern legst Du Nummern mit acht Ziffern an, wählst die Kostenstelle, zu der sie gehören, und weist Key Account Manager zu.</p>" +
        bild("verwaltung-projektnummern", "Verwaltung, Reiter Projektnummern")
    },
    {
      id: "ampel", titel: "Ampel einstellen", fuer: "Abteilungsleitung",
      html:
        "<p>Unter Verwaltung → Einstellungen legst Du fest, ab wann die Ampel gelb und rot zeigt. Die Ampel vergleicht die Hochrechnung zum Jahresende mit dem Planbudget.</p>" +
        bild("ampel", "Ampelgrenzen einstellen") +
        "<ul><li><strong>Im Plan bis:</strong> Bis zu diesem Wert zeigt die Ampel grün. Erlaubt sind 50 % bis 150 %, Standard 95 %.</li>" +
        "<li><strong>Knapp bis:</strong> Bis zu diesem Wert zeigt sie gelb, darüber rot. Der Wert liegt über „Im Plan bis“ und höchstens bei 200 %, Standard 100 %.</li></ul>" +
        "<p>Unter den Feldern siehst Du, wie die Ampel mit Deinen Werten schaltet. „Auf Standard zurücksetzen“ stellt 95 % und 100 % wieder her. Die Grenzen gelten für alle im Tool.</p>"
    },
    {
      id: "einstellungen", titel: "Einstellungen und Datensicherung", fuer: "Administrator",
      html:
        "<p>Unter Verwaltung → Einstellungen änderst Du den Titel der Anwendung. Er steht in der Kopfzeile und im Tab des Browsers.</p>" +
        bild("einstellungen", "Einstellungen mit Titel und Datensicherung") +
        "<h3>Datensicherung</h3>" +
        "<ul><li><strong>Sicherung herunterladen:</strong> speichert den vollständigen Datenstand als JSON-Datei: Konten, Nummern, Planbudgets, IST-Werte, Projektkosten, Änderungsprotokoll und Einstellungen. Die Datei enthält auch die Passwort-Hashes. Bewahre sie sicher auf.</li>" +
        "<li><strong>Sicherung einspielen:</strong> Wähle eine Sicherungsdatei und bestätige. Das Tool ersetzt dann alle Daten durch den Stand aus der Datei. Im Serverbetrieb sichert der Server vorher den aktuellen Stand.</li>" +
        "<li><strong>Automatische Sicherungen</strong> (nur Serverbetrieb): Der Server sichert vor jeder Änderung den alten Stand. Die zehn neuesten stehen in der Liste, „Wiederherstellen“ setzt die Daten auf diesen Stand zurück.</li></ul>" +
        tipp("Eine Sicherung, in der Dein eigenes Administratorkonto fehlt, spielt das Tool nicht ein. So sperrst Du Dich nicht aus.") +
        "<p>Im Browserbetrieb setzt „Auf Beispieldaten zurücksetzen“ alle Daten in diesem Browser zurück.</p>"
    },
    {
      id: "profil", titel: "Profil und Design", fuer: "Alle",
      html:
        "<p>Über das Menü oben rechts öffnest Du „Mein Profil“.</p>" +
        bild("profil", "Mein Profil mit Angaben, Passwort und Design") +
        "<ul><li><strong>Deine Angaben:</strong> Vorname und Nachname ändern. XV-Nummer, Rolle und Zuweisungen ändert die Abteilungsleitung.</li>" +
        "<li><strong>Passwort ändern:</strong> aktuelles Passwort und zweimal das neue eingeben.</li>" +
        "<li><strong>Design:</strong> Automatisch (wie Dein Betriebssystem), Hell oder Dunkel. Dazu zehn Farbdesigns im R+V-Stil. Deine Wahl gilt für Dein Konto.</li></ul>"
    },
    {
      id: "excel", titel: "Excel-Export", fuer: "Abteilungsleitung, Gruppenleitung, Key Account Manager",
      html:
        "<p>Auf der Startseite, unter Planbudgets und IST-Werte, auf den Detailseiten, im Bericht und bei den Projektkosten steht oben rechts „Als Excel herunterladen“. Die Excel-Datei enthält alles, was Du im gewählten Kalenderjahr siehst, auf drei Blättern:</p>" +
        "<ul><li><strong>Planbudgets:</strong> je Kostenstelle und Projektnummer die Positionen, das eingetragene Planbudget und das Gesamtbudget.</li>" +
        "<li><strong>IST-Werte:</strong> Stand des KST-Berichts, gebucht bis, die Positionen, IST, Gesamtbudget und IST in % vom Plan. Bei Projektnummern die Summe der erfassten Kosten.</li>" +
        "<li><strong>Projektkosten:</strong> jeder Eintrag mit Datum, Betrag, Beschreibung und wer ihn erfasst hat.</li></ul>" +
        "<p>Der Dateiname enthält Kalenderjahr und Datum, zum Beispiel „Budgetdashboard_2026_2026-10-30.xlsx“. Beträge sind echte Zahlen, Du kannst in Excel also direkt weiterrechnen.</p>"
    },
    {
      id: "pdf", titel: "Als PDF speichern", fuer: "Alle",
      html:
        "<p>Startseite, Planbudgets, IST-Werte, Detailseiten, Bericht und Projektkosten speicherst Du als PDF.</p>" +
        "<ol><li>Wähle das Kalenderjahr und gegebenenfalls die Ansicht.</li><li>Klicke auf „Als PDF speichern“.</li>" +
        "<li>Wähle im Druckdialog als Ziel „Als PDF speichern“ und klicke auf „Speichern“.</li></ol>" +
        "<p>Das PDF hat A4 quer, ist immer hell und hat oben Logo, Titel, Datum und Deinen Namen. Knöpfe und Navigation fehlen. Tabellen und Diagramme werden nicht zerschnitten.</p>" +
        tipp("Im Claude-Artefakt gibt es keinen Druckdialog, dort fehlt der Knopf.")
    },
    // BETA-ANMELDEN-ALS Anfang
    {
      id: "anmelden-als", titel: "Anmelden als (Beta)", fuer: "Administrator",
      html:
        hinweis("Diese Funktion gibt es nur in der Betaversion. Sie wird vor dem Echtbetrieb entfernt.") +
        "<p>Als Administrator meldest Du Dich ohne Passwort als andere Person an, auch wenn noch ein Einmalpasswort aktiv ist. So prüfst Du, was die Person sieht.</p>" +
        "<ol><li>Öffne Verwaltung → Benutzer.</li><li>Klicke in der Zeile der Person auf das Anmelde-Symbol und bestätige.</li>" +
        "<li>Eine orange Leiste oben zeigt, als wer Du angemeldet bist.</li><li>Mit „Zurück zum Administrator“ kehrst Du zu Deinem Konto zurück.</li></ol>" +
        bild("anmelden-als", "Hinweisleiste beim Anmelden als andere Person") +
        "<p>Passwort und Einmalpasswort der Person bleiben unverändert. In diesem Modus kannst Du kein Passwort ändern.</p>"
    },
    // BETA-ANMELDEN-ALS Ende
    {
      id: "fragen", titel: "Häufige Fragen", fuer: "Alle",
      html:
        "<dl class=\"hb-begriffe\">" +
        "<dt>Warum sehe ich keine IST-Werte?</dt><dd>Für die Kostenstelle ist noch kein KST-Bericht importiert. Die Abteilungsleitung holt das nach.</dd>" +
        "<dt>Warum steht „IST 2025 bis September“, obwohl das Vorjahr abgeschlossen ist?</dt><dd>Zum Vergleich zeigt das Tool das Vorjahr bis zum selben Monat wie das aktuelle IST. Das Vorjahr gesamt steht daneben.</dd>" +
        "<dt>Warum zählen Unterkostenstellen im Abteilungsbudget nicht doppelt?</dt><dd>Ihr Planbudget steckt schon im Gesamtbudget der übergreifenden Kostenstelle. Das Abteilungsbudget zählt nur die obersten Kostenstellen.</dd>" +
        "<dt>Das eigene IST einer übergreifenden Kostenstelle ist negativ.</dt><dd>Dann passen die KST-Berichte nicht zusammen, zum Beispiel weil sie unterschiedliche Stände haben. Importiere die Berichte mit gleichem Stand.</dd>" +
        "<dt>Ich bin gesperrt.</dt><dd>Nach fünf falschen Passwörtern wartest Du 15 Minuten. Hast Du das Passwort vergessen, hilft die Abteilungsleitung mit einem neuen Einmalpasswort.</dd>" +
        "<dt>Wo finde ich dieses Handbuch?</dt><dd>Im Menü oben rechts unter „Handbuch“. Dort kannst Du es auch als PDF herunterladen.</dd>" +
        "</dl>"
    }
  ];

  global.BDHandbuch = { kapitel: kapitel };
})(typeof window !== "undefined" ? window : globalThis);
