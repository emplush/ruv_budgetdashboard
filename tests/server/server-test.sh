#!/usr/bin/env bash
# Kompiliert api.ashx mit Mono (Sprachstand C# 5 wie der IIS-Compiler), startet den Testserver und prüft die Schnittstelle.
# Voraussetzung: mono-mcs und System.Web (z. B. apt-get install mono-mcs mono-xsp4)
# UI_TEST=1 lässt den Server danach mit leeren Daten für den Browsertest weiterlaufen.
set -euo pipefail
HIER="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HIER/../.." && pwd)"
TMP="$(mktemp -d)"
PORT="${PORT:-8098}"
QUELLE="${APP_DIR:-$REPO/app}"  # APP_DIR: z. B. das entpackte IIS-ZIP
cp -r "$QUELLE" "$TMP/app"
rm -rf "$TMP/app/App_Data"
# Wie der IIS: ohne BOM liest der Compiler die Datei als Windows-1252, dann sind die Umlaute kaputt
if [[ "$(head -c3 "$QUELLE/api.ashx" | od -An -tx1 | tr -d ' ')" != "efbbbf" ]]; then echo "FEHLER api.ashx braucht UTF-8 mit BOM"; exit 1; fi
{ printf '\xEF\xBB\xBF'; sed -n '3,$p' "$QUELLE/api.ashx"; } > "$TMP/api.cs"
mcs -langversion:5 -nologo -codepage:1252 -out:"$TMP/server.exe" -r:System.Web.dll -r:System.Web.Extensions.dll -r:System.Core.dll "$TMP/api.cs" "$HIER/TestServer.cs"
mono "$TMP/server.exe" "$TMP/app" "$PORT" > "$TMP/server.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; rm -rf "$TMP"' EXIT
sleep 2
U="http://localhost:$PORT/api.ashx"
H="X-Budgetdashboard: 1"
J="Content-Type: application/json"
A="$TMP/admin.cookies"; L="$TMP/al.cookies"; G="$TMP/gl.cookies"; K="$TMP/kam.cookies"
FEHLER=0
pruefe() { # name erwartet tatsaechlich
  if [[ "$3" == *"$2"* ]]; then echo "ok   $1"; else echo "FEHLER $1: erwartet '$2', erhalten '$3'"; FEHLER=1; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
py() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }
post() { curl -s -b "$1" -H "$H" -H "$J" -d "$3" "$U?aktion=$2"; }

pruefe "ping" '"modus":"server"' "$(curl -s -H "$H" "$U?aktion=ping")"
pruefe "ohne Kopf 403" "403" "$(code "$U?aktion=ping")"
pruefe "öffentlich" '"titel":"Budgetdashboard"' "$(curl -s -H "$H" "$U?aktion=oeffentlich")"
pruefe "Sitzung ohne Anmeldung 401" "401" "$(code -H "$H" "$U?aktion=sitzung")"
pruefe "falsches Passwort 401" "401" "$(code -H "$H" -H "$J" -d '{"kennung":"xv00000","passwort":"falsch"}' "$U?aktion=anmelden")"
pruefe "Umlaute in Meldungen" "fünf Ziffern" "$(curl -s -H "$H" -H "$J" -d '{"kennung":"ab12345","passwort":"x"}' "$U?aktion=anmelden")"
R="$(curl -s -c "$A" -H "$H" -H "$J" -d '{"kennung":"XV00000","passwort":"RuV-Plan#2026!"}' "$U?aktion=anmelden")"
pruefe "Admin meldet sich an, ohne Hash" 'xv00000|admin|False|False' "$(echo "$R" | py 'd["ich"]+"|"+d["daten"]["benutzer"][0]["rolle"]+"|"+str("hash" in d["daten"]["benutzer"][0])+"|"+str("salz" in d["daten"]["benutzer"][0])')"
pruefe "Cookie HttpOnly" "#HttpOnly_localhost" "$(cat "$A")"
pruefe "Titel speichern" '"titel": "Budget T&E äöü"' "$(post "$A" einstellungen '{"titel":"Budget T&E äöü"}' | py 'json.dumps(d["daten"]["einstellungen"],ensure_ascii=False)')"
pruefe "Kostenstelle mit 4 Ziffern 400" "400" "$(code -b "$A" -H "$H" -H "$J" -d '{"art":"ks","alt":"","nummer":"4100","benutzer":[]}' "$U?aktion=nummer-speichern")"
post "$A" nummer-speichern '{"art":"ks","alt":"","nummer":"411","benutzer":[]}' >/dev/null
post "$A" nummer-speichern '{"art":"ks","alt":"","nummer":"410","benutzer":[]}' >/dev/null
pruefe "Projektnummer anlegen, sortiert" "['410', '411']|['41000101']" "$(post "$A" nummer-speichern '{"art":"pn","alt":"","nummer":"41000101","benutzer":[]}' | py 'str([n["nummer"] for n in d["daten"]["kostenstellen"]])+"|"+str([n["nummer"] for n in d["daten"]["projekte"]])')"
pruefe "doppelte Kostenstelle 400" "gibt es schon" "$(post "$A" nummer-speichern '{"art":"ks","alt":"","nummer":"410","benutzer":[]}')"
pruefe "schwaches Einmalpasswort 400" "Sonderzeichen" "$(post "$A" benutzer-anlegen '{"kennung":"xv10001","vorname":"Sabine","nachname":"Hofmann","rolle":"al","passwort":"Willkommen2026"}')"
pruefe "Passwort mit Namen 400" "Deinen Namen" "$(post "$A" benutzer-anlegen '{"kennung":"xv10001","vorname":"Sabine","nachname":"Hofmann","rolle":"al","passwort":"Hofmann#2026xy"}')"
R="$(post "$A" benutzer-anlegen '{"kennung":"xv10001","vorname":"Sabine","nachname":"Hofmann","rolle":"al","nummern":{"ks":["410"],"pn":["41000101"]},"passwort":"Kq7#mPz2-wHte"}')"
pruefe "Abteilungsleitung anlegen, Einmalpasswort sichtbar, Projektnummer passt nicht zur Rolle" "Kq7#mPz2-wHte|True|['xv10001']|[]" "$(echo "$R" | py '[b for b in d["daten"]["benutzer"] if b["kennung"]=="xv10001"][0]["einmalpasswort"]+"|"+str([b for b in d["daten"]["benutzer"] if b["kennung"]=="xv10001"][0]["mussPasswortAendern"])+"|"+str(d["daten"]["kostenstellen"][0]["benutzer"])+"|"+str(d["daten"]["projekte"][0]["benutzer"])')"
pruefe "doppelte XV-Nummer 400" "gibt es schon" "$(post "$A" benutzer-anlegen '{"kennung":"xv10001","vorname":"A","nachname":"B","rolle":"gl","passwort":"Kq7#mPz2-wHte"}')"
post "$A" benutzer-anlegen '{"kennung":"xv10002","vorname":"Thomas","nachname":"Becker","rolle":"gl","nummern":{"ks":["410","411"]},"passwort":"Tq8#nPz3-wJte"}' >/dev/null
post "$A" benutzer-anlegen '{"kennung":"xv10004","vorname":"Daniel","nachname":"Schulz","rolle":"kam","nummern":{"ks":["410"],"pn":["41000101"]},"passwort":"Dq9#mRz4-wKte"}' >/dev/null
pruefe "Zuweisungen je Rolle" "['xv10001', 'xv10002']|['xv10002']|['xv10004']" "$(curl -s -b "$A" -H "$H" "$U?aktion=sitzung" | py 'str(d["daten"]["kostenstellen"][0]["benutzer"])+"|"+str(d["daten"]["kostenstellen"][1]["benutzer"])+"|"+str(d["daten"]["projekte"][0]["benutzer"])')"
pruefe "Admin darf kein Planbudget eintragen 403" "403" "$(code -b "$A" -H "$H" -H "$J" -d '{"jahr":"2026","art":"ks","nummer":"410","werte":{}}' "$U?aktion=budget-speichern")"

# Abteilungsleitung
curl -s -c "$L" -H "$H" -H "$J" -d '{"kennung":"xv10001","passwort":"Kq7#mPz2-wHte"}' "$U?aktion=anmelden" >/dev/null
pruefe "vor Passwortwechsel gesperrt 403" "403" "$(code -b "$L" -H "$H" -H "$J" -d '{"vorname":"S","nachname":"H"}' "$U?aktion=profil")"
pruefe "Einmalpasswort behalten 400" "Einmalpasswort" "$(post "$L" passwort '{"alt":null,"neu":"Kq7#mPz2-wHte"}')"
pruefe "Passwort festlegen" '"ok":true' "$(post "$L" passwort '{"alt":null,"neu":"Mein-Neues#Pw26"}')"
pruefe "Einmalpasswort danach weg" '|False' "$(curl -s -b "$A" -H "$H" "$U?aktion=sitzung" | py '[b for b in d["daten"]["benutzer"] if b["kennung"]=="xv10001"][0]["einmalpasswort"]+"|"+str([b for b in d["daten"]["benutzer"] if b["kennung"]=="xv10001"][0]["mussPasswortAendern"])')"
pruefe "Abteilungsleitung darf keinen Administrator anlegen 403" "403" "$(code -b "$L" -H "$H" -H "$J" -d '{"kennung":"xv10009","vorname":"A","nachname":"B","rolle":"admin","passwort":"Kq7#mPz2-wHte"}' "$U?aktion=benutzer-anlegen")"
pruefe "Abteilungsleitung darf Administrator nicht löschen 403" "403" "$(code -b "$L" -H "$H" -H "$J" -d '{"kennung":"xv00000"}' "$U?aktion=benutzer-loeschen")"
pruefe "Abteilungsleitung darf keine Einstellungen 403" "403" "$(code -b "$L" -H "$H" -H "$J" -d '{"titel":"x"}' "$U?aktion=einstellungen")"
pruefe "ungültiger Betrag 400" "Reise/KfZ" "$(post "$L" budget-speichern '{"jahr":"2026","art":"ks","nummer":"410","werte":{"pkId":"1.000","reise":"abc"}}')"
pruefe "negativer Betrag 400" "400" "$(code -b "$L" -H "$H" -H "$J" -d '{"jahr":"2026","art":"ks","nummer":"410","werte":{"pkId":-5}}' "$U?aktion=budget-speichern")"
pruefe "Planbudget speichern, deutsche Schreibweise" "412000|96000|18000.5|0|9800" "$(post "$L" budget-speichern '{"jahr":"2026","art":"ks","nummer":"410","werte":{"pkId":"412.000,00","pkAd":"96000","werbung":"18000,5","reise":"","sonstiges":9800}}' | py '"|".join(str(d["daten"]["budgets"]["2026"]["ks-410"][k]).rstrip("0").rstrip(".") if "." in str(d["daten"]["budgets"]["2026"]["ks-410"][k]) else str(d["daten"]["budgets"]["2026"]["ks-410"][k]) for k in ["pkId","pkAd","werbung","reise","sonstiges"])')"
post "$L" budget-speichern '{"jahr":"2026","art":"ks","nummer":"411","werte":{"pkId":1000}}' >/dev/null
pruefe "Planbudget der Projektnummer nur als Betrag" '{"betrag": 2500.0}' "$(post "$L" budget-speichern '{"jahr":"2025","art":"pn","nummer":"41000101","werte":{"betrag":"2.500,00","pkAd":"7"}}' | py 'json.dumps(d["daten"]["budgets"]["2025"]["pn-41000101"])')"
pruefe "Planbudget für unbekannte Nummer 404" "404" "$(code -b "$L" -H "$H" -H "$J" -d '{"jahr":"2026","art":"ks","nummer":"999","werte":{}}' "$U?aktion=budget-speichern")"
pruefe "Umbenennen nimmt Planbudget mit" "['ks-411', 'ks-420']" "$(post "$L" nummer-speichern '{"art":"ks","alt":"410","nummer":"420","benutzer":["xv10001","xv10002","xv10004"]}' | py 'str(sorted(d["daten"]["budgets"]["2026"].keys()))')"
pruefe "Key Account Manager nicht an Kostenstelle" "['xv10001', 'xv10002']" "$(curl -s -b "$L" -H "$H" "$U?aktion=sitzung" | py 'str([n["benutzer"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="420"][0])')"
pruefe "Admin sieht keine Planbudgets" "{}" "$(curl -s -b "$A" -H "$H" "$U?aktion=sitzung" | py 'json.dumps(d["daten"]["budgets"])')"

# Übergreifende Kostenstelle
post "$L" nummer-speichern '{"art":"ks","alt":"","nummer":"413","benutzer":[]}' >/dev/null
post "$L" budget-speichern '{"jahr":"2026","art":"ks","nummer":"413","werte":{"werbung":500}}' >/dev/null
pruefe "übergreifende Kostenstelle anlegen" "['413']|[]" "$(post "$L" nummer-speichern '{"art":"ks","alt":"420","nummer":"420","benutzer":["xv10001","xv10002"],"unter":["413"]}' | py 'str([n["unter"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="420"][0])+"|"+str([n["unter"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="413"][0])')"
pruefe "Zuordnung bleibt ohne unter" "['413']" "$(post "$L" nummer-speichern '{"art":"ks","alt":"420","nummer":"420","benutzer":["xv10001","xv10002"]}' | py 'str([n["unter"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="420"][0])')"
pruefe "nur eine Ebene" "selbst übergreifend" "$(post "$L" nummer-speichern '{"art":"ks","alt":"411","nummer":"411","benutzer":["xv10002"],"unter":["420"]}')"
pruefe "zugeordnete Kostenstelle fasst nichts zusammen" "keine Unterkostenstellen haben" "$(post "$L" nummer-speichern '{"art":"ks","alt":"413","nummer":"413","benutzer":[],"unter":["411"]}')"
pruefe "nur zu einer übergreifenden" "gehört schon zur übergreifenden Kostenstelle 420" "$(post "$L" nummer-speichern '{"art":"ks","alt":"","nummer":"430","benutzer":[],"unter":["413"]}')"
pruefe "nicht sich selbst" "nicht selbst" "$(post "$L" nummer-speichern '{"art":"ks","alt":"420","nummer":"420","benutzer":[],"unter":["420"]}')"
pruefe "beim Anlegen zuordnen (oben)" "['413', '431']" "$(post "$L" nummer-speichern '{"art":"ks","alt":"","nummer":"431","benutzer":[],"oben":"420"}' | py 'str([n["unter"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="420"][0])')"
pruefe "oben nur eine Ebene" "selbst Unterkostenstelle von 420" "$(post "$L" nummer-speichern '{"art":"ks","alt":"","nummer":"432","benutzer":[],"oben":"413"}')"
pruefe "oben leer löst Zuordnung" "['413']" "$(post "$L" nummer-speichern '{"art":"ks","alt":"431","nummer":"431","benutzer":[],"unter":[],"oben":""}' | py 'str([n["unter"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="420"][0])')"

# Gruppenleitung und Key Account Manager
curl -s -c "$G" -H "$H" -H "$J" -d '{"kennung":"xv10002","passwort":"Tq8#nPz3-wJte"}' "$U?aktion=anmelden" >/dev/null
post "$G" passwort '{"alt":null,"neu":"Gruppen-Leitung#7"}' >/dev/null
S="$(curl -s -b "$G" -H "$H" "$U?aktion=sitzung")"
pruefe "Gruppenleitung sieht nur sich, ihre Kostenstellen und deren Budgets" "1|['411', '413', '420']|[]|['ks-411', 'ks-413', 'ks-420']|" "$(echo "$S" | py 'str(len(d["daten"]["benutzer"]))+"|"+str([n["nummer"] for n in d["daten"]["kostenstellen"]])+"|"+str(d["daten"]["projekte"])+"|"+str(sorted(d["daten"]["budgets"]["2026"].keys()))+"|"+d["daten"]["benutzer"][0]["einmalpasswort"]')"
pruefe "Gruppenleitung sieht keine anderen Zuweisungen" "['xv10002']" "$(echo "$S" | py 'str([n["benutzer"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="420"][0])')"
pruefe "zugeordnete Kostenstelle ohne Zuweisung dabei" "[]|['413']" "$(echo "$S" | py 'str([n["benutzer"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="413"][0])+"|"+str([n["unter"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="420"][0])')"
pruefe "Gruppenleitung darf keine Benutzer 403" "403" "$(code -b "$G" -H "$H" -H "$J" -d '{"kennung":"xv10009"}' "$U?aktion=benutzer-loeschen")"
pruefe "Gruppenleitung darf kein Planbudget 403" "403" "$(code -b "$G" -H "$H" -H "$J" -d '{"jahr":"2026","art":"ks","nummer":"411","werte":{}}' "$U?aktion=budget-speichern")"
pruefe "Design und Farbe speichern, unbekannte ignorieren" "dunkel|taunus" "$(post "$G" design '{"design":"dunkel","farbe":"taunus"}' >/dev/null; post "$G" design '{"design":"bunt","farbe":"<x>"}' >/dev/null; curl -s -b "$G" -H "$H" "$U?aktion=sitzung" | py 'd["daten"]["benutzer"][0]["design"]+"|"+d["daten"]["benutzer"][0]["farbe"]')"
# BETA-ANMELDEN-ALS Anfang (mit der Funktion entfernen)
pruefe "Anmelden als: Gruppenleitung ohne Recht 403" "403" "$(code -b "$G" -H "$H" -H "$J" -d '{"kennung":"xv10001"}' "$U?aktion=anmelden-als")"
pruefe "Anmelden als: Admin wird Gruppenleitung" "xv10002|xv00000|1" "$(post "$A" anmelden-als '{"kennung":"xv10002"}' | py 'd["ich"]+"|"+d["alsAdmin"]+"|"+str(len(d["daten"]["benutzer"]))')"
pruefe "Anmelden als: Sitzung bleibt" '"alsAdmin":"xv00000"' "$(curl -s -b "$A" -H "$H" "$U?aktion=sitzung")"
pruefe "Anmelden als: kein Passwortwechsel 403" "403" "$(code -b "$A" -H "$H" -H "$J" -d '{"alt":null,"neu":"Anderes#Pw2026x"}' "$U?aktion=passwort")"
pruefe "Anmelden als: nicht doppelt" "403" "$(code -b "$A" -H "$H" -H "$J" -d '{"kennung":"xv10001"}' "$U?aktion=anmelden-als")"
pruefe "Anmelden als: zurück zum Admin" "xv00000|" "$(post "$A" zurueck-als-admin '{}' | py 'd["ich"]+"|"+d["alsAdmin"]')"
pruefe "Anmelden als: Einmalpasswort aktiv" "xv10004|xv00000" "$(post "$A" anmelden-als '{"kennung":"xv10004"}' | py 'd["ich"]+"|"+d["alsAdmin"]')"
pruefe "Anmelden als: zurück" '"ich":"xv00000"' "$(post "$A" zurueck-als-admin '{}')"
# BETA-ANMELDEN-ALS Ende
pruefe "Profil ändert Namen" "Tom|Becker|xv10002" "$(post "$G" profil '{"vorname":"Tom","nachname":"Becker","kennung":"xv99999"}' | py 'd["daten"]["benutzer"][0]["vorname"]+"|"+d["daten"]["benutzer"][0]["nachname"]+"|"+d["ich"]')"
pruefe "Passwort ändern braucht das alte" "stimmt nicht" "$(post "$G" passwort '{"alt":"falsch","neu":"Noch-Ein#Pw2026"}')"
curl -s -c "$K" -H "$H" -H "$J" -d '{"kennung":"xv10004","passwort":"Dq9#mRz4-wKte"}' "$U?aktion=anmelden" >/dev/null
post "$K" passwort '{"alt":null,"neu":"Key-Account#2026"}' >/dev/null
pruefe "Key Account Manager sieht nur Projektnummern" "[]|['41000101']|['2025']" "$(curl -s -b "$K" -H "$H" "$U?aktion=sitzung" | py 'str(d["daten"]["kostenstellen"])+"|"+str([n["nummer"] for n in d["daten"]["projekte"]])+"|"+str(list(d["daten"]["budgets"].keys()))')"

# IST-Daten je Kostenstelle
IST='{"nummer":"411","eintrag":{"stand":"2026-10-22","monat":"2026-09","aktuell":{"jahr":2026,"werte":{"pkId":100.5,"pkAd":200,"werbung":10,"reise":20,"sonstiges":-5.25}},"vorjahrZeitraum":{"jahr":2025,"werte":{"pkId":90,"pkAd":180,"werbung":9,"reise":18,"sonstiges":3}},"vorjahr":null,"datei":"KST 411.xlsx"}}'
pruefe "Gruppenleitung darf keine IST-Daten importieren 403" "403" "$(code -b "$G" -H "$H" -H "$J" -d "$IST" "$U?aktion=ist-importieren")"
pruefe "IST für unbekannte Kostenstelle 404" "404" "$(code -b "$L" -H "$H" -H "$J" -d "${IST/411/999}" "$U?aktion=ist-importieren")"
pruefe "IST mit Text statt Zahl 400" "unvollständig" "$(post "$L" ist-importieren "${IST/100.5/\"abc\"}")"
pruefe "Monat passt nicht zum Jahr 400" "passen nicht zusammen" "$(post "$L" ist-importieren "${IST/2026-09/2025-09}")"
pruefe "IST importieren" "2026-10-22|2026-09|100.5|-5.25|None|Import|" "$(post "$L" ist-importieren "$IST" | py 'd["daten"]["ist"]["ks-411"]["stand"]+"|"+d["daten"]["ist"]["ks-411"]["monat"]+"|"+str(d["daten"]["ist"]["ks-411"]["aktuell"]["werte"]["pkId"])+"|"+str(d["daten"]["ist"]["ks-411"]["aktuell"]["werte"]["sonstiges"])+"|"+str(d["daten"]["ist"]["ks-411"]["vorjahr"])+"|"+d["daten"]["istSicherungen"][0]["anlass"]+"|"+d["daten"]["istSicherungen"][0]["vorherStand"]')"
pruefe "zweiter Import sichert den ersten" "2|2026-10-22" "$(post "$L" ist-importieren "${IST/2026-10-22/2026-11-05}" | py 'str(len(d["daten"]["istSicherungen"]))+"|"+d["daten"]["istSicherungen"][0]["vorherStand"]')"
pruefe "Sicherungen ohne Werte" "False" "$(curl -s -b "$L" -H "$H" "$U?aktion=sitzung" | py 'str("vorher" in d["daten"]["istSicherungen"][0])')"
pruefe "Gruppenleitung sieht IST ihrer Kostenstelle, keine Sicherungen" "['ks-411']|[]" "$(curl -s -b "$G" -H "$H" "$U?aktion=sitzung" | py 'str(sorted(d["daten"]["ist"].keys()))+"|"+str(d["daten"]["istSicherungen"])')"
pruefe "Key Account Manager sieht kein IST" "{}" "$(curl -s -b "$K" -H "$H" "$U?aktion=sitzung" | py 'json.dumps(d["daten"]["ist"])')"
pruefe "Administrator sieht Sicherungen, aber kein IST" "{}|2" "$(curl -s -b "$A" -H "$H" "$U?aktion=sitzung" | py 'json.dumps(d["daten"]["ist"])+"|"+str(len(d["daten"]["istSicherungen"]))')"
SID="$(curl -s -b "$A" -H "$H" "$U?aktion=sitzung" | py 'd["daten"]["istSicherungen"][0]["id"]')"
pruefe "Administrator stellt Sicherung wieder her" "2026-10-22|Wiederherstellung|3" "$(post "$A" ist-wiederherstellen "{\"id\":\"$SID\"}" >/dev/null; curl -s -b "$L" -H "$H" "$U?aktion=sitzung" | py 'd["daten"]["ist"]["ks-411"]["stand"]+"|"+d["daten"]["istSicherungen"][0]["anlass"]+"|"+str(len(d["daten"]["istSicherungen"]))')"
SID="$(curl -s -b "$L" -H "$H" "$U?aktion=sitzung" | py 'd["daten"]["istSicherungen"][-1]["id"]')"
pruefe "Wiederherstellen vor dem ersten Import entfernt IST" "[]" "$(post "$L" ist-wiederherstellen "{\"id\":\"$SID\"}" | py 'str(list(d["daten"]["ist"].keys()))')"
post "$L" ist-importieren "$IST" >/dev/null
pruefe "Umbenennen nimmt IST mit" "['ks-419']" "$(post "$L" nummer-speichern '{"art":"ks","alt":"411","nummer":"419","benutzer":["xv10002"]}' | py 'str(sorted(d["daten"]["ist"].keys()))')"
post "$L" nummer-speichern '{"art":"ks","alt":"419","nummer":"411","benutzer":["xv10002"]}' >/dev/null

# Projektkosten: manuell erfasst, gehen von der zugeordneten Kostenstelle ab
pruefe "unbekannte Kostenstelle für Projektnummer 400" "999" "$(post "$L" nummer-speichern '{"art":"pn","alt":"41000101","nummer":"41000101","benutzer":["xv10004"],"ks":"999"}')"
pruefe "Projektnummer einer Kostenstelle zuordnen" "411" "$(post "$L" nummer-speichern '{"art":"pn","alt":"41000101","nummer":"41000101","benutzer":["xv10004"],"ks":"411"}' | py '[n["ks"] for n in d["daten"]["projekte"] if n["nummer"]=="41000101"][0]')"
KO='{"id":"","pn":"41000101","datum":"2026-03-15","betrag":"1.250,50","text":"Messestand"}'
pruefe "Gruppenleitung darf keine Projektkosten erfassen 403" "403" "$(code -b "$G" -H "$H" -H "$J" -d "$KO" "$U?aktion=kosten-speichern")"
pruefe "Projektkosten mit Betrag 0 400" "größer als 0" "$(post "$L" kosten-speichern "${KO/1.250,50/0}")"
pruefe "Projektkosten mit falschem Datum 400" "Datum" "$(post "$L" kosten-speichern "${KO/2026-03-15/2026-02-30}")"
pruefe "Projektkosten für unbekannte Projektnummer 404" "404" "$(code -b "$L" -H "$H" -H "$J" -d "${KO/41000101/41009999}" "$U?aktion=kosten-speichern")"
pruefe "Projektkosten erfassen ohne Kostenart" "1|1250.5|False|xv10001" "$(post "$L" kosten-speichern "$KO" | py 'str(len(d["daten"]["kosten"]))+"|"+str(d["daten"]["kosten"][0]["betrag"])+"|"+str("kostenart" in d["daten"]["kosten"][0])+"|"+d["daten"]["kosten"][0]["von"]')"
KK="$(post "$K" kosten-speichern "${KO/1.250,50/10}" | py '[x["id"] for x in d["daten"]["kosten"] if x["von"]=="xv10004"][0]')"
pruefe "Key Account Manager erfasst Kosten seiner Projektnummer" "k" "${KK:0:1}"
pruefe "Key Account Manager löscht seinen Eintrag" "1" "$(post "$K" kosten-loeschen "{\"id\":\"$KK\"}" | py 'str(len(d["daten"]["kosten"]))')"
KID="$(curl -s -b "$L" -H "$H" "$U?aktion=sitzung" | py 'd["daten"]["kosten"][0]["id"]')"
pruefe "Projektkosten ändern" "1|99" "$(post "$L" kosten-speichern "{\"id\":\"$KID\",\"pn\":\"41000101\",\"datum\":\"2026-04-01\",\"betrag\":99,\"text\":\"\"}" | py 'str(len(d["daten"]["kosten"]))+"|"+str(d["daten"]["kosten"][0]["betrag"])')"
post "$L" kosten-speichern "$KO" >/dev/null
pruefe "Gruppenleitung sieht Projektnummer ihrer Kostenstelle ohne Zuweisung und deren Kosten" "['41000101']|[]|411|2" "$(curl -s -b "$G" -H "$H" "$U?aktion=sitzung" | py 'str([n["nummer"] for n in d["daten"]["projekte"]])+"|"+str(d["daten"]["projekte"][0]["benutzer"])+"|"+d["daten"]["projekte"][0]["ks"]+"|"+str(len(d["daten"]["kosten"]))')"
pruefe "Key Account Manager sieht Kosten seiner Projektnummer" "2" "$(curl -s -b "$K" -H "$H" "$U?aktion=sitzung" | py 'str(len(d["daten"]["kosten"]))')"
pruefe "Administrator sieht keine Projektkosten" "[]" "$(curl -s -b "$A" -H "$H" "$U?aktion=sitzung" | py 'str(d["daten"]["kosten"])')"
pruefe "Umbenennen der Projektnummer nimmt Kosten mit" "['41000109', '41000109']" "$(post "$L" nummer-speichern '{"art":"pn","alt":"41000101","nummer":"41000109","benutzer":["xv10004"],"ks":"411"}' | py 'str([x["pn"] for x in d["daten"]["kosten"]])')"
post "$L" nummer-speichern '{"art":"pn","alt":"41000109","nummer":"41000101","benutzer":["xv10004"],"ks":"411"}' >/dev/null
pruefe "Projektkosten löschen" "1" "$(post "$L" kosten-loeschen "{\"id\":\"$KID\"}" | py 'str(len(d["daten"]["kosten"]))')"
pruefe "gelöschten Eintrag nochmals löschen 404" "404" "$(code -b "$L" -H "$H" -H "$J" -d "{\"id\":\"$KID\"}" "$U?aktion=kosten-loeschen")"
post "$L" nummer-speichern '{"art":"ks","alt":"","nummer":"499","benutzer":[]}' >/dev/null
post "$L" nummer-speichern '{"art":"pn","alt":"","nummer":"41000199","benutzer":[],"ks":"499"}' >/dev/null
post "$L" kosten-speichern "${KO/41000101/41000199}" >/dev/null
pruefe "Key Account Manager nicht für fremde Projektnummer 403" "403" "$(code -b "$K" -H "$H" -H "$J" -d "${KO/41000101/41000199}" "$U?aktion=kosten-speichern")"
pruefe "Kostenstelle löschen hebt Zuordnung auf" "''" "$(post "$L" nummer-loeschen '{"art":"ks","nummer":"499"}' | py 'repr([n["ks"] for n in d["daten"]["projekte"] if n["nummer"]=="41000199"][0])')"
pruefe "Projektnummer löschen entfernt ihre Kosten" "['41000101']" "$(post "$L" nummer-loeschen '{"art":"pn","nummer":"41000199"}' | py 'str([x["pn"] for x in d["daten"]["kosten"]])')"

# Verwaltung
pruefe "neues Einmalpasswort beendet Sitzungen" "401" "$(post "$A" passwort-zuruecksetzen '{"kennung":"xv10004","passwort":"Neu-Start#2026x"}' >/dev/null; code -b "$K" -H "$H" "$U?aktion=sitzung")"
pruefe "Rollenwechsel nimmt Kostenstellen" "['xv10001']" "$(post "$L" benutzer-aendern '{"kennung":"xv10002","vorname":"Tom","nachname":"Becker","rolle":"kam","nummern":{"ks":["420"],"pn":[]}}' | py 'str([n["benutzer"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="420"][0])')"
pruefe "eigene Adminrolle nicht abgeben" "nicht selbst nehmen" "$(post "$A" benutzer-aendern '{"kennung":"xv00000","vorname":"A","nachname":"B","rolle":"al"}')"
pruefe "Umbenennen nimmt Zuordnung mit" "['414']" "$(post "$L" nummer-speichern '{"art":"ks","alt":"413","nummer":"414","benutzer":[]}' | py 'str([n["unter"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="420"][0])')"
pruefe "Löschen entfernt Zuordnung" "[]" "$(post "$L" nummer-loeschen '{"art":"ks","nummer":"414"}' | py 'str([n["unter"] for n in d["daten"]["kostenstellen"] if n["nummer"]=="420"][0])')"
pruefe "Nummer löschen entfernt Planbudgets" "['ks-411']" "$(post "$L" nummer-loeschen '{"art":"ks","nummer":"420"}' | py 'str(sorted(d["daten"]["budgets"]["2026"].keys()))')"
pruefe "Benutzer löschen entfernt Zuweisungen" "[]" "$(post "$L" benutzer-loeschen '{"kennung":"xv10004"}' | py 'str(d["daten"]["projekte"][0]["benutzer"])')"
pruefe "eigenes Konto nicht löschen" "eigenes Konto" "$(post "$L" benutzer-loeschen '{"kennung":"xv10001"}')"

# Browser und Server rechnen den gleichen Hash
pruefe "gleicher Hash in JS und C#" "gleich" "$(cd "$REPO" && node -e '
const D=require("./app/js/daten.js");D.passwortHash("RuV-Plan#2026!","abc123").then(h=>{const d=require(process.argv[1]);const b=d.benutzer[0];return D.passwortHash("RuV-Plan#2026!",b.salz).then(x=>console.log(x===b.hash?"gleich":"verschieden"))})' "$TMP/app/App_Data/daten.json")"
TOKEN="$(awk '$6=="budgetdashboard_sitzung"{print $7}' "$A")"
pruefe "sitzungen.json ohne Klartext-Token" "0" "$(grep -c "$TOKEN" "$TMP/app/App_Data/sitzungen.json" || true)"
kill $PID 2>/dev/null; sleep 1
mono "$TMP/server.exe" "$TMP/app" "$PORT" >> "$TMP/server.log" 2>&1 &
PID=$!
sleep 2
pruefe "Anmeldung übersteht Neustart" '"ich":"xv00000"' "$(curl -s -b "$A" -H "$H" "$U?aktion=sitzung")"
pruefe "abmelden" '"ok":true' "$(curl -s -b "$A" -c "$A" -H "$H" -H "$J" -d '{}' "$U?aktion=abmelden")"
pruefe "nach Abmelden 401" "401" "$(code -b "$A" -H "$H" "$U?aktion=sitzung")"
pruefe "Sicherungen angelegt" "1" "$( [ "$(ls "$TMP/app/App_Data/sicherungen" | wc -l)" -ge 5 ] && echo 1 || echo 0)"
pruefe "App_Data gesperrt" "404" "$(code "http://localhost:$PORT/App_Data/daten.json")"
pruefe "Startseite" "Budgetdashboard" "$(curl -s "http://localhost:$PORT/")"
if [[ "${UI_TEST:-0}" == "1" ]]; then
  # Frischer Prozess und leere Daten, damit Sitzungen und Sperren aus den Tests nicht stören
  kill $PID 2>/dev/null; sleep 1
  rm -rf "$TMP/app/App_Data"
  mono "$TMP/server.exe" "$TMP/app" "$PORT" > "$TMP/server.log" 2>&1 &
  PID=$!
  sleep 2
  echo "Testserver läuft für UI-Tests auf Port $PORT. Beenden mit Strg+C."; wait $PID
fi
exit $FEHLER
