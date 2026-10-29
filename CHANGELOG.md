# Änderungen

## 0.6.2 (29.10.2026)
- Tabellen ohne Zusätze „übergreifend“ und „eigenes Budget“: Die übergreifende Kostenstelle steht hervorgehoben über ihren Unterkostenstellen, die eingerückte Zeile mit gleicher Nummer zeigt ihren eigenen Teil.

## 0.6.1 (29.10.2026)
- Neue Kostenstelle direkt einer übergreifenden zuordnen: Im Dialog gibt es das Feld „Gehört zu“. Bisher ging das nur über die übergreifende Kostenstelle.
- Eine Kostenstelle ist entweder Unterkostenstelle oder hat selbst Unterkostenstellen; der Dialog sperrt jeweils die andere Auswahl.
- Im Dialog heißt „Zugewiesen an“ jetzt „Verantwortlich“.

## 0.6.0 (29.10.2026)
- Texte in der ganzen App geprüft und gekürzt. Einheitlich „Unterkostenstelle“ statt „zugeordnete Kostenstelle“, „Verantwortlich“ statt „Zugewiesen“, „IST-Werte“ statt „IST-Daten“. Der Verwaltungsbereich heißt „KST-Berichte“.
- Eine übergreifende Kostenstelle kann mehrere Unterkostenstellen haben; die Verwaltung zeigt sie als Liste, gesperrte Kostenstellen mit „Unterkostenstelle von …“.
- „IST zum zeitanteiligen Plan“ (wie „IST / Plan ZZV“ der bisherigen Excel-Liste) steht jetzt sichtbar in Grün, Gelb oder Rot: im Plan bis 95 %, knapp bis 100 %, darüber über Plan. Die Spalte „Prognose“ heißt „zeitanteilig“.
- Diagramm „Plan und IST nach Kostenarten“ im Abteilungsbudget: Plan, IST und Vorjahr im gleichen Zeitraum je Personalkosten AD, Personalkosten ID und Sachkosten.
- IST-Positionen einer Kostenstelle mit Spalte „Vorjahr gesamt“, wenn der KST-Bericht das ganze Vorjahr enthält.

## 0.5.0 (29.10.2026)
- Planbudget wie IST: Bei jeder Kostenstelle trägst Du das Gesamtplanbudget ein. Bei übergreifenden Kostenstellen enthält es die zugeordneten Kostenstellen, bei jeder Kostenstelle auch ihre Projektnummern. Das eigene Budget rechnet das Tool als Rest aus (Beispiel: 2.000.000 € gesamt, 1.500.000 € Unterkostenstelle, 200.000 € Projektnummer, 300.000 € eigenes Budget). Beim IST gilt dasselbe.
- Karten der Kostenstellen und Projektnummern mit zwei getrennten Bereichen: links Planbudget, rechts IST. Oben steht der Status: Prognose, ausgegeben in Prozent und Restbudget. IST je Position mit Anteil vom Plan, über 100 % in Rot.
- Wer mehrere Kostenstellen oder Projektnummern hat, sieht zuerst eine Tabelle „auf einen Blick“ mit Sprung zur jeweiligen Karte.
- Startseite der Abteilungsleitung: Abteilungsbudget mit Planbudget und IST in getrennten Bereichen, darunter die Einzelbudgets aller Kostenstellen und Projektnummern mit Balken und Prognose.
- Navigation der Abteilungsleitung: Start, Planbudgets, IST-Werte, Verwaltung. Planbudgets und IST-Werte sind eigene Seiten.
- Bericht der übergreifenden Kostenstelle mit eigener Spalte für die Projektnummern; Hinweise, wenn die Planbudgets nicht zusammenpassen.
- Am Handy keine waagerechte Verschiebung mehr durch Tabellen.

## 0.4.2 (29.10.2026)
- Jede Ansicht startet mit dem aktuellen Kalenderjahr, auch nach der Anmeldung. Ein anderes Jahr gilt nur in der Ansicht, in der Du es gewählt hast.

## 0.4.1 (29.10.2026)
- IST nach dem KST-Bericht: Der Bericht einer Kostenstelle enthält schon die Kosten ihrer Projektnummern, der Bericht einer übergreifenden Kostenstelle auch die zugeordneten Kostenstellen. Das Tool rechnet deshalb nichts mehr dazu.
- IST einer übergreifenden Kostenstelle = ihr eigener KST-Bericht. Was nach Abzug der zugeordneten Kostenstellen auf ihr selbst liegt, steht als eigener Rest in Übersicht und Bericht (Beispiel: 50.000 € gesamt, 30.000 € auf der zugeordneten, 5.000 € Projektkosten, 15.000 € auf der übergreifenden selbst).
- Projektkosten werden nur aufgeschlüsselt: „davon Projektkosten“ und „IST ohne Projektkosten“ im Bericht, einzeln je Projektnummer für die Key Account Manager.
- Hinweise im Bericht, wenn ein KST-Bericht fehlt, die Stände abweichen oder die zugeordneten zusammen mehr IST haben als die übergreifende. Die Gesamtsumme der Übersicht zählt nichts mehr doppelt.

## 0.4.0 (29.10.2026)
- Projektkosten: Für Projektnummern gibt es keinen KST-Bericht. Die Abteilungsleitung erfasst die Kosten je Projektnummer von Hand mit Datum, Kostenart (Personalkosten ID oder AD, Werbung, Reise/KfZ, Sonstiges), Betrag und Beschreibung und kann sie ändern oder löschen.
- Jede Projektnummer ist einer Kostenstelle zugeordnet (Verwaltung → Projektnummern). Ihre Kosten gehen dort ab: Sie zählen zum IST dieser Kostenstelle und damit auch zur übergreifenden Kostenstelle. Übersicht, Karten und Bericht weisen „davon Projektkosten“ aus.
- Eigene Seite je Projektnummer mit Planbudget, IST in % vom Plan, Restbudget, Veränderung zum Vorjahr und Plan gegen IST nach Kostenart; die Übersicht hat dafür die Tabelle „Projektnummern: IST gegen Plan“.
- Wer eine Kostenstelle sieht, sieht auch die Projektnummern, deren Kosten von ihr abgehen.

## 0.3.0 (29.10.2026)
- IST-Daten je Kostenstelle: Die Abteilungsleitung importiert den KST-Bericht des Konzern-Controllings (.xlsx). Das Tool liest Kostenstelle (KST1xxx00), Datenstand, Abrechnungsmonat und die Spalten „Ist“ (Vorjahr gesamt, Vorjahr bis Monat, aktuelles Jahr bis Monat) und zeigt vorher eine Vorschau mit Prüfsummen (Sachkosten, Primärkosten I).
- Zuordnung: Personalkosten AD und ID, Werbung, Reise/Kfz; alle übrigen Sachkosten-Zeilen ergeben „Sonstiges“.
- Die gewählte Kostenstelle muss zur Datei passen. Ein Import ersetzt die IST-Daten dieser Kostenstelle; vorher sichert das Tool den bisherigen Stand. Abteilungsleitung und Administrator können Sicherungen wiederherstellen.
- IST gegen Plan überall mit Stand-Datum: IST in % vom Plan, Restbudget, Hochrechnung zum Jahresende, Veränderung zum Vorjahr im gleichen Zeitraum, Ampel nach Hochrechnung, je Position Plan, IST und Prozent.
- Übergreifende Kostenstellen summieren auch das IST der zugeordneten Kostenstellen; der Bericht zeigt Plan, IST und den Vergleich und lässt sich komplett nach Excel kopieren.

## 0.2.0 (29.10.2026)
- Übergreifende Kostenstellen: Eine Kostenstelle fasst andere zusammen. Ihr Planbudget ergibt sich aus dem eigenen Budget plus den Planbudgets der zugeordneten Kostenstellen. Nur eine Ebene, jede Kostenstelle gehört zu höchstens einer übergreifenden.
- Zuordnung im Dialog der Kostenstelle, Anzeige in der Verwaltung, Zwischensumme in der Übersicht und Zusammensetzung auf der Karte.
- Bericht je übergreifender Kostenstelle mit allen Positionen je Teil und gesamt; „Tabelle kopieren“ für den Abgleich in Excel.
- Wer einer übergreifenden Kostenstelle zugewiesen ist, sieht auch die Planbudgets der zugeordneten Kostenstellen.

## 0.1.0 (29.10.2026)
Erste Version nach dem Neubeginn.
- Anmeldung mit XV-Nummer und Passwort, Begrüßung nach Tageszeit, keine Registrierung.
- Einmalpasswort für neue Konten, sichtbar in der Benutzerverwaltung bis zur ersten Anmeldung; danach eigenes Passwort nach aktuellen Regeln (12 Zeichen, Groß- und Kleinbuchstaben, Ziffer, Sonderzeichen, nicht Name oder XV-Nummer, keine gängigen Wörter).
- Vier Rollen: Administrator, Abteilungsleitung, Gruppenleitung, Key Account Manager.
- Kostenstellen (3 Ziffern) und Projektnummern (8 Ziffern), mehreren Personen zuweisbar.
- Planbudgets je Kalenderjahr: Personalkosten ID, Personalkosten AD, Sachkosten aus Werbung, Reise/KfZ und Sonstiges.
- Übersicht aller Planbudgets für die Abteilungsleitung, eigene Ansichten für Gruppenleitung und Key Account Manager.
- Profil mit Namen, Passwort, zehn Farbdesigns und Hell, Dunkel oder Automatisch.
- Titel der Anwendung durch den Administrator, auch im Tab des Browsers.
- Server für den IIS (api.ashx, ohne Datenbank, ohne HTTPS) und Browserbetrieb mit Beispieldaten.
