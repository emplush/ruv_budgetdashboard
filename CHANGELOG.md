# Änderungen

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
