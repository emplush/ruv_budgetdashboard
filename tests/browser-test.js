/* Rauchtest im echten Browser (Browserbetrieb mit Beispieldaten): node tests/browser-test.js [bildordner]
   Startet einen kleinen Webserver für app/ und spielt die wichtigsten Abläufe durch. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const WURZEL = path.join(__dirname, "..", "app");
const BILDER = process.argv[2] || "";
const TYPEN = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png" };

const server = http.createServer((req, res) => {
  const datei = path.join(WURZEL, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!datei.startsWith(WURZEL) || !fs.existsSync(datei)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPEN[path.extname(datei)] || "application/octet-stream" });
  fs.createReadStream(datei).pipe(res);
});

function pruefe(bedingung, text) {
  if (!bedingung) throw new Error("Fehlgeschlagen: " + text);
  console.log("ok  " + text);
}

(async () => {
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const url = "http://127.0.0.1:" + server.address().port + "/";
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) fehler.push(m.text()); });
  const bild = async (name) => { if (BILDER) await page.screenshot({ path: path.join(BILDER, name + ".png"), fullPage: true }); };
  async function anmelden(kennung, passwort) {
    await page.fill("#kennung", kennung);
    await page.fill("#passwort", passwort);
    await page.click("button[type=submit]");
  }
  async function abmelden() {
    await page.click("[data-menue]");
    await page.click(".menue__liste [data-abmelden]");
    await page.waitForSelector("#kennung");
  }

  await page.goto(url);
  await page.waitForSelector("#kennung");
  await bild("01-anmeldung");
  pruefe((await page.title()) === "Budgetdashboard", "Titel im Tab");
  pruefe(!(await page.isVisible("text=registrieren")), "keine Registrierung");

  await anmelden("xv1234", "x");
  pruefe(await page.isVisible("text=fünf Ziffern"), "falsche XV-Nummer wird erklärt");
  await anmelden("xv10001", "falsch");
  await page.waitForSelector("text=passen nicht zusammen");
  pruefe(true, "falsches Passwort wird abgewiesen");

  // Abteilungsleitung
  await anmelden("xv10001", "RuV-Plan#2026!");
  await page.waitForSelector("h1:has-text('Sabine')");
  pruefe(/^(Guten Morgen|Guten Tag|Guten Abend|Hallo), Sabine$/.test(await page.textContent("h1")), "Begrüßung nach Tageszeit mit Vornamen");
  pruefe(await page.isVisible(".kopf__nav >> text=Planbudgets") && await page.isVisible(".kopf__nav >> text=IST-Werte") && await page.isVisible(".kopf__nav >> text=Verwaltung"), "Abteilungsleitung hat Planbudgets, IST-Werte und Verwaltung");
  pruefe(await page.isVisible("text=Abteilungsbudget " + new Date().getFullYear()) && await page.isVisible("section[aria-label='Planbudget der Abteilung']") && await page.isVisible("section[aria-label='IST der Abteilung']"), "Abteilungsbudget mit getrennten Bereichen Plan und IST");
  pruefe(await page.isVisible("text=Einzelbudgets der Kostenstellen") && await page.isVisible(".einzelbudgets tr:has-text('410 eigenes Budget')"), "Einzelbudgets mit eigenem Budget der übergreifenden Kostenstelle");
  await bild("02-abteilungsleitung");

  await page.click(".kopf__nav >> text=Planbudgets");
  await page.waitForSelector("text=Summe Kostenstellen");
  pruefe(await page.isVisible("text=Summe Projektnummern"), "Kostenstellen und Projektnummern getrennt");
  await page.click("[data-budget='ks-413']");
  await page.fill("#w-pkId", "120.000");
  await page.fill("#w-werbung", "5000,5");
  await page.fill("#w-reise", "abc");
  await page.click("dialog button[type=submit]");
  pruefe(await page.isVisible("dialog >> text=Reise/KfZ“"), "ungültiger Betrag wird gemeldet");
  await page.fill("#w-reise", "1.000");
  pruefe((await page.textContent("[data-gesamt]")).includes("126.000,50"), "Gesamtbudget rechnet live mit");
  await page.click("dialog button[type=submit]");
  await page.waitForSelector("text=Das Planbudget");
  pruefe(await page.isVisible("tr:has(th:has-text('413')) >> text=126.000,50 €"), "Planbudget erscheint in der Übersicht");
  await bild("03-uebersicht");
  pruefe(await page.isVisible("tr.teilsumme >> text=davon eigenes Budget 410") && await page.isVisible("tr.teilsumme:has-text('eigenes Budget 410') >> text=166.300,00 €"), "übergreifende Kostenstelle: eigenes Budget als Rest");
  await page.click("a[href='#/bericht/410']");
  await page.waitForSelector("h1:has-text('Kostenstelle 410')");
  pruefe(await page.isVisible("th:has-text('Kostenstelle 411')") && await page.isVisible("th:has-text('Eigenes Budget')") && await page.isVisible("[data-kopieren]"), "Bericht der übergreifenden Kostenstelle");
  await bild("03b-bericht");
  await page.goto(url + "#/verwaltung/kostenstellen");
  await page.waitForSelector("td >> text=411, 412");
  await page.click("[data-bearbeiten='413']");
  pruefe(await page.locator("dialog input[name=unter][value='411']").isDisabled() && await page.isVisible("dialog >> text=Unterkostenstelle von 410"), "Unterkostenstellen anderer Kostenstellen sind gesperrt");
  await page.click("dialog [data-schliessen]");

  // KST-Bericht importieren (Beispieldatei mit erfundenen Zahlen, Kostenstelle 413)
  await page.goto(url + "#/verwaltung/ist");
  await page.waitForSelector("[data-import]");
  await page.selectOption("#i-ks", "411");
  await page.setInputFiles("#i-datei", path.join(__dirname, "daten", "kst-bericht-beispiel.xlsx"));
  await page.waitForSelector("text=gewählt ist 411");
  pruefe(await page.locator("[data-importieren]").isDisabled(), "falsche Kostenstelle wird abgewiesen");
  await page.selectOption("#i-ks", "413");
  pruefe(await page.isVisible(".vorschau >> text=Stand 22.10.2026 · gebucht bis September 2026") && await page.isVisible("text=Die Summen stimmen"), "Vorschau mit Stand und Prüfsummen");
  await bild("03c-ist-import");
  await page.click("[data-importieren]");
  await page.click("dialog button[type=submit]");
  await page.waitForSelector("text=sind importiert");
  pruefe(await page.isVisible("tr:has(th:has-text('413')) >> text=September 2026") && await page.isVisible("text=Import"), "IST-Stand und Sicherung erscheinen");
  await page.goto(url + "#/ist");
  await page.waitForSelector("text=IST gegen Plan");
  pruefe(await page.isVisible("text=IST in % vom Plan") && await page.isVisible("tr:has(th:has-text('413')) >> text=22.10.2026"), "IST-Werte zeigen IST gegen Plan mit Stand");
  await bild("03d-ist-uebersicht");

  // Projektkosten manuell erfassen (Projektnummer 41000101 geht von Kostenstelle 410 ab)
  await page.goto(url + "#/projekt/41000101");
  await page.waitForSelector("[data-kosten-neu]");
  pruefe(await page.isVisible("text=Gehört zur Kostenstelle"), "Projektseite nennt die Kostenstelle");
  const zeilenVorher = await page.locator("tr[data-kosten]").count();
  await page.click("[data-kosten-neu]");
  await page.fill("#k-betrag", "1.234,56");
  await page.click("dialog button[type=submit]");
  pruefe(await page.isVisible("dialog >> text=Wähle bitte die Kostenart"), "Kostenart ist Pflicht");
  await page.selectOption("#k-art", "werbung");
  await page.fill("#k-text", "Roll-up für die Messe");
  await page.click("dialog button[type=submit]");
  await page.waitForSelector("text=Die Kosten sind erfasst");
  pruefe(await page.locator("tr[data-kosten]").count() === zeilenVorher + 1 && await page.isVisible("tr[data-kosten] >> text=Roll-up für die Messe"), "Projektkosten erscheinen in der Liste");
  await bild("03e-projektkosten");

  // Benutzer anlegen mit Einmalpasswort
  await page.goto(url + "#/verwaltung/benutzer");
  await page.waitForSelector("[data-kopfaktion] [data-neu]");
  pruefe(await page.locator("[data-bearbeiten='xv00000']").isDisabled(), "Abteilungsleitung kann Administratoren nicht bearbeiten");
  pruefe(!(await page.isVisible(".reiter >> text=Einstellungen")), "Einstellungen nur für Administratoren");
  await page.click("[data-kopfaktion] [data-neu]");
  pruefe(!(await page.locator("#b-rolle option[value=admin]").count()), "Abteilungsleitung kann keine Administratoren anlegen");
  await page.fill("#b-kennung", "xv20001");
  await page.fill("#b-vor", "Mia");
  await page.fill("#b-nach", "Klein");
  await page.selectOption("#b-rolle", "kam");
  pruefe(await page.isVisible("dialog >> text=Projektnummern") && !(await page.isVisible("dialog legend:has-text('Kostenstellen')")), "Key Account Manager bekommen Projektnummern");
  await page.check("dialog input[value='41000103']");
  const einmal = await page.inputValue("#b-pw");
  await page.click("dialog button[type=submit]");
  await page.waitForSelector("text=ist angelegt");
  pruefe(await page.isVisible("tr[data-zeile='xv20001'] >> text=" + einmal), "Einmalpasswort steht in der Benutzerliste");
  pruefe(await page.isVisible("tr[data-zeile='xv20001'] >> text=PN 41000103"), "Projektnummer zugewiesen");
  await bild("04-benutzer");
  await abmelden();

  // Erste Anmeldung mit Einmalpasswort
  await anmelden("xv20001", einmal);
  await page.waitForSelector("text=Passwort festlegen");
  await page.fill("#neu", "Mia-Klein#2026");
  pruefe(await page.isVisible(".regeln >> text=nicht Deine XV-Nummer oder Deinen Namen"), "Name im Passwort wird bemängelt");
  await page.fill("#neu", "Sonnen-Blume#26");
  await page.fill("#wdh", "Sonnen-Blume#26");
  await page.click("button[type=submit]");
  await page.waitForSelector("text=Meine Projektnummern");
  pruefe(await page.isVisible("text=41000103") && !(await page.isVisible("text=Meine Kostenstellen")), "Key Account Manager sieht nur seine Projektnummer");
  pruefe(await page.isVisible("text=noch kein Planbudget"), "fehlendes Planbudget wird erklärt");
  pruefe(!(await page.isVisible(".kopf__nav >> text=Verwaltung")), "keine Verwaltung für Key Account Manager");
  await abmelden();
  await anmelden("xv20001", einmal);
  await page.waitForSelector("text=passen nicht zusammen");
  pruefe(true, "Einmalpasswort gilt danach nicht mehr");

  // Gruppenleitung, Design
  await anmelden("xv10002", "RuV-Plan#2026!");
  await page.waitForSelector("text=Meine Kostenstellen");
  pruefe(await page.locator(".budget").count() === 2, "Gruppenleitung sieht zwei Kostenstellen getrennt");
  const vorjahr = String(new Date().getFullYear() - 1);
  await page.selectOption("[data-jahr]", vorjahr);
  pruefe(await page.isVisible("text=Planbudget " + vorjahr), "Kalenderjahr wechseln");
  await page.goto(url + "#/profil");
  await page.goto(url + "#/");
  await page.waitForSelector("text=Meine Kostenstellen");
  pruefe(await page.inputValue("[data-jahr]") === String(new Date().getFullYear()), "neue Ansicht startet mit dem aktuellen Kalenderjahr");
  await page.goto(url + "#/profil");
  await page.waitForSelector("text=Farbdesign");
  pruefe(await page.locator(".farbwahl__option").count() === 10, "zehn Farbdesigns");
  await page.click(".modus__option:has-text('Dunkel')");
  pruefe(await page.getAttribute("html", "data-theme") === "dunkel", "dunkles Design");
  await page.click(".farbwahl__option:has-text('Taunus')");
  pruefe(await page.getAttribute("html", "data-farbe") === "taunus", "Farbdesign wählen");
  await page.emulateMedia({ colorScheme: "light" });
  await page.click(".modus__option:has-text('Automatisch')");
  pruefe(await page.getAttribute("html", "data-theme") === "hell", "automatisch folgt dem System (hell)");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(100);
  pruefe(await page.getAttribute("html", "data-theme") === "dunkel", "automatisch folgt dem System (dunkel)");
  await bild("05-profil");
  await page.fill("#p-vor", "Tom");
  await page.click("[data-angaben] button[type=submit]");
  await page.waitForSelector("text=Deine Angaben sind gespeichert");
  pruefe(await page.isVisible("h1:has-text('Tom Becker')"), "Angaben im Profil ändern");
  await page.reload();
  await page.waitForSelector("text=Farbdesign");
  pruefe(await page.getAttribute("html", "data-farbe") === "taunus", "Farbdesign bleibt nach dem Neuladen");
  await page.emulateMedia({ colorScheme: "light" });
  await abmelden();

  // Administrator: Titel
  await anmelden("xv00000", "RuV-Plan#2026!");
  await page.waitForSelector(".startkachel");
  pruefe(!(await page.isVisible(".kopf__nav >> text=Planbudgets")), "Administrator sieht keine Planbudgets");
  await page.goto(url + "#/verwaltung/einstellungen");
  await page.fill("#e-titel", "Budget T&E");
  await page.click("[data-titel] button[type=submit]");
  await page.waitForSelector("text=Der Titel ist gespeichert");
  pruefe((await page.title()).endsWith("Budget T&E") && await page.isVisible(".kopf__titel >> text=Budget T&E"), "Titel im Tab und in der Kopfzeile");

  // Handy
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url + "#/start");
  await page.waitForSelector(".startkachel");
  pruefe(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "kein waagerechtes Scrollen am Handy");

  pruefe(fehler.length === 0, "keine Fehler in der Konsole" + (fehler.length ? ": " + fehler.join(" | ") : ""));
  await browser.close();
  server.close();
})().catch((f) => { console.error(f.message); process.exit(1); });
