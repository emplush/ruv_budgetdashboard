#!/usr/bin/env bash
# Rauchtest gegen eine laufende Instanz mit frischem App_Data:
#   ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://127.0.0.1:5080 dotnet run --project BudgetDashboard
#   tools/smoke-test.sh http://127.0.0.1:5080
set -u
BASE="${1:-http://127.0.0.1:5080}"
TMP="$(mktemp -d)"; fails=0
ok()   { echo "  ok   $1"; }
fail() { echo "  FAIL $1"; fails=$((fails+1)); }
check() { if grep -q -- "$2" "$TMP/out.html"; then ok "$1"; else fail "$1 (erwartet: $2)"; fi; }
nocheck() { if grep -q -- "$2" "$TMP/out.html"; then fail "$1 (unerwartet: $2)"; else ok "$1"; fi; }

# get <jar> <path>        post <jar> <path> [--data-urlencode k=v ...]
token() { grep -o 'name="__RequestVerificationToken"[^>]*value="[^"]*"' "$TMP/out.html" | head -1 | sed 's/.*value="//;s/"$//'; }
get()  { local jar=$1 path=$2; curl -s -L -b "$TMP/$jar" -c "$TMP/$jar" -o "$TMP/out.html" -w "%{http_code} %{url_effective}" "$BASE$path"; }
post() { local jar=$1 path=$2; shift 2
  curl -s -L -b "$TMP/$jar" -c "$TMP/$jar" -o "$TMP/out.html" "$BASE$path" >/dev/null
  local t; t=$(token)
  curl -s -L -b "$TMP/$jar" -c "$TMP/$jar" -o "$TMP/out.html" -w "%{http_code} %{url_effective}" \
    --data-urlencode "__RequestVerificationToken=$t" "$@" "$BASE$path"; }
login() { post "$1" "/Login" --data-urlencode "Kostenstelle=$2" --data-urlencode "Passwort=$3"; }

ADMIN_PW='Adm1n-Start#2026'
echo "Admin"
r=$(login admin 00000000 12test34); [[ $r == *"/Admin/Dashboard" ]] && ok "Admin-Login führt zum Dashboard" || fail "Admin-Login: $r"
check "Hinweis zum Standardpasswort" "Standardpasswort aktiv"
check "Admin-Navigation: Dashboard" ">Dashboard</a>"
r=$(get admin /Admin/Kostenstellen); [[ $r == 200*"/Admin/Kostenstellen" ]] && ok "Kostenstellen auch mit Standardpasswort erreichbar" || fail "$r"
r=$(get admin /Admin/Einstellungen); [[ $r == 200*"/Admin/Einstellungen" ]] && ok "Einstellungen erreichbar" || fail "$r"
post admin "/Admin/Einstellungen?handler=Password" --data-urlencode "Aktuell=12test34" --data-urlencode "Neu=schwach" --data-urlencode "Wiederholung=schwach" >/dev/null
check "schwaches Passwort abgelehnt" "mindestens 12 Zeichen"
post admin "/Admin/Einstellungen?handler=Password" --data-urlencode "Aktuell=12test34" --data-urlencode "Neu=$ADMIN_PW" --data-urlencode "Wiederholung=$ADMIN_PW" >/dev/null
check "Admin-Passwort geändert" "Admin-Passwort ist ge"
nocheck "Hinweis verschwindet" "Standardpasswort aktiv"
get admin /Admin/Dashboard >/dev/null
check "Dashboard zeigt Kennzahlen" "Kostenstellen insgesamt"
nocheck "Hinweis ohne Standardpasswort" "Standardpasswort aktiv"
get admin /Admin/Kostenstellen >/dev/null
check "Admin-Navigation: Kostenstellen" ">Kostenstellen</a>"
check "Admin-Navigation: Einstellungen" ">Einstellungen</a>"
check "Admin-Navigation: Abmelden" ">Abmelden</button>"
post admin "/Admin/Einstellungen?handler=Title" --data-urlencode "Title=Budget-Dashboard 2.0 Test" >/dev/null
check "Titel geändert" "Budget-Dashboard 2.0 Test"
post admin "/Admin/Kostenstellen?handler=Add" --data-urlencode "NewNumber=1234" >/dev/null
check "ungültige Kostenstelle abgelehnt" "genau 8 Ziffern"
post admin "/Admin/Kostenstellen?handler=Add" --data-urlencode "NewNumber=00000000" >/dev/null
check "Admin-Kostenstelle reserviert" "reserviert"
post admin "/Admin/Kostenstellen?handler=Add" --data-urlencode "NewNumber=12345678" --data-urlencode "NewOrgUnit=12345678901X" --data-urlencode "NewEnabled=true" >/dev/null
check "Org-Einheit max. 11 Zeichen" "chstens 11 Zeichen"
post admin "/Admin/Kostenstellen?handler=Add" --data-urlencode "NewNumber=12345678" --data-urlencode "NewOrgUnit=ORG-1" --data-urlencode "NewGroup=Gruppe A" --data-urlencode "NewEnabled=true" --data-urlencode "NewHead=true" >/dev/null
check "Kostenstelle 12345678 angelegt" "12345678 ist angelegt"
post admin "/Admin/Kostenstellen?handler=Add" --data-urlencode "NewNumber=87654321" --data-urlencode "NewGroup=Gruppe B" --data-urlencode "NewEnabled=true" >/dev/null
post admin "/Admin/Kostenstellen?handler=Add" --data-urlencode "NewNumber=11111111" --data-urlencode "NewEnabled=false" >/dev/null
check "Tabelle enthält Kostenstellen" "Alle Kostenstellen (3)"

echo "Abteilungsleitung (12345678)"
r=$(login head 12345678 ""); [[ $r == *"/SetPassword" ]] && ok "Erstanmeldung öffnet Passwort-Dialog" || fail "$r"
check "Dialog-Text" "Bitte setze ein Passwort"
post head /SetPassword --data-urlencode "NeuesPasswort=Kurz1!" --data-urlencode "Wiederholung=Kurz1!" >/dev/null
check "Richtlinie im Dialog" "mindestens 12 Zeichen"
post head /SetPassword --data-urlencode "NeuesPasswort=Sicher#Passwort1" --data-urlencode "Wiederholung=Anders#Passwort1" >/dev/null
check "Wiederholung muss passen" "stimmen nicht"
r=$(post head /SetPassword --data-urlencode "NeuesPasswort=Gruppe-Leitung#2026" --data-urlencode "Wiederholung=Gruppe-Leitung#2026"); [[ $r == *"/Dashboard" ]] && ok "Passwort gesetzt, Dashboard" || fail "$r"
for item in Dashboard Budgetplan Jahresbudget Budgetfreigaben Upload Profil Abmelden; do check "Navigation Abteilungsleitung: $item" ">$item</"; done
r=$(get head /Admin/Kostenstellen); [[ $r == *"AccessDenied"* ]] && ok "kein Zugriff auf Admin" || fail "$r"
for p in Budgetplan Jahresbudget Budgetfreigaben Upload Profil; do r=$(get head /$p); [[ $r == 200* ]] && ok "Seite $p erreichbar" || fail "$p: $r"; done
get head /Profil >/dev/null
post head /Profil --data-urlencode "Aktuell=falsch" --data-urlencode "Neu=Neues#Kennwort2026" --data-urlencode "Wiederholung=Neues#Kennwort2026" >/dev/null
check "falsches aktuelles Passwort" "stimmt nicht"
post head /Profil --data-urlencode "Aktuell=Gruppe-Leitung#2026" --data-urlencode "Neu=Neues#Kennwort2026" --data-urlencode "Wiederholung=Neues#Kennwort2026" >/dev/null
check "Passwort im Profil geändert" "Passwort ist ge"
post head /Logout >/dev/null
r=$(login head 12345678 'Gruppe-Leitung#2026'); [[ $r == *"/Login"* ]] && check "altes Passwort ungültig" "stimmt nicht" || fail "$r"
r=$(login head 12345678 'Neues#Kennwort2026'); [[ $r == *"/Dashboard" ]] && ok "Anmeldung mit neuem Passwort" || fail "$r"

echo "Gruppenleitung (87654321)"
login grp 87654321 "" >/dev/null
post grp /SetPassword --data-urlencode "NeuesPasswort=Gruppe-B#Kennwort1" --data-urlencode "Wiederholung=Gruppe-B#Kennwort1" >/dev/null
get grp /Dashboard >/dev/null
nocheck "keine Budgetfreigaben für Gruppenleitung" ">Budgetfreigaben</"
nocheck "kein Upload für Gruppenleitung" ">Upload</"
r=$(get grp /Budgetfreigaben); [[ $r == *"AccessDenied"* ]] && ok "Budgetfreigaben gesperrt" || fail "$r"

echo "Sperren"
login x 11111111 "" >/dev/null; check "nicht freigegebene Kostenstelle" "stimmt nicht"
login x 99999999 "" >/dev/null; check "unbekannte Kostenstelle" "stimmt nicht"
for i in 1 2 3 4 5; do login x 87654321 "falsch$i" >/dev/null; done
check "Sperre nach 5 Fehlversuchen" "gesperrt"
login x 87654321 'Gruppe-B#Kennwort1' >/dev/null; check "auch richtiges Passwort gesperrt" "gesperrt"

echo "Passwort löschen"
post admin "/Admin/Kostenstellen?handler=ResetPassword" --data-urlencode "number=87654321" >/dev/null
check "Passwort gelöscht" "ist gel"
r=$(get grp /Dashboard); [[ $r == *"/Login"* ]] && ok "laufende Sitzung beendet" || fail "$r"
r=$(login y 87654321 ""); [[ $r == *"/SetPassword" ]] && ok "neue Passwortvergabe nach Löschen" || fail "$r"

echo "Sicherheit"
curl -s -o /dev/null -w "%{http_code}" -X POST --data "Kostenstelle=00000000&Passwort=x" "$BASE/Login" | grep -q 400 && ok "POST ohne Anti-Forgery-Token abgelehnt" || fail "CSRF"
curl -sI "$BASE/Login" | grep -qi "content-security-policy" && ok "CSP-Header gesetzt" || fail "CSP"
curl -s -o /dev/null -w "%{http_code}" "$BASE/App_Data/data.json" | grep -q 200 && fail "App_Data abrufbar" || ok "App_Data nicht abrufbar"

echo; [[ $fails -eq 0 ]] && echo "Alle Prüfungen bestanden." || { echo "$fails Prüfung(en) fehlgeschlagen."; exit 1; }
