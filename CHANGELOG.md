# Änderungen

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
