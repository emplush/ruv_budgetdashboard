/* Bildschirmfotos für das Handbuch mit den Beispieldaten (Browserbetrieb): node tools/handbuch_bilder.js
   Legt die Bilder in app/handbuch/bilder/ ab. Danach node tools/handbuch_pdf.js. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const WURZEL = path.join(__dirname, "..", "app");
const ZIEL = path.join(WURZEL, "handbuch", "bilder");
const TYPEN = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png" };
const PASSWORT = "RuV-Plan#2026!";
const BREITE = 1280, HOEHE = 900, MAX = 1250;

const server = http.createServer((req, res) => {
  const datei = path.join(WURZEL, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!datei.startsWith(WURZEL) || !fs.existsSync(datei)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPEN[path.extname(datei)] || "application/octet-stream" });
  fs.createReadStream(datei).pipe(res);
});

(async () => {
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const url = "http://127.0.0.1:" + server.address().port + "/";
  const browser = await chromium.launch({ args: ["--lang=de-DE"], env: Object.assign({}, process.env, { LANG: "de_DE.UTF-8", LANGUAGE: "de" }) });
  fs.mkdirSync(ZIEL, { recursive: true });
  let seite;

  async function neu() {
    if (seite) await seite.context().close();
    const ctx = await browser.newContext({ viewport: { width: BREITE, height: HOEHE }, deviceScaleFactor: 1, locale: "de-DE" });
    seite = await ctx.newPage();
    await seite.goto(url);
    await seite.waitForSelector("#kennung");
    await seite.evaluate(() => window.BDFarben.anwenden("hell", "klassik"));
  }
  async function anmelden(kennung) {
    await neu();
    await seite.fill("#kennung", kennung);
    await seite.fill("#passwort", PASSWORT);
    await seite.click("button[type=submit]");
    await seite.waitForSelector(".kopf");
    await seite.evaluate(() => window.BDFarben.anwenden("hell", "klassik"));
  }
  async function gehe(hash, warte) {
    await seite.evaluate((h) => { location.hash = h; }, hash);
    if (warte) await seite.waitForSelector(warte);
    await seite.waitForTimeout(400);
  }
  /* Bild der sichtbaren Seite, höchstens MAX Pixel hoch; ohne Meldungen */
  async function bild(name, opt) {
    opt = opt || {};
    await seite.evaluate(() => document.querySelectorAll(".meldung, .toast, [role=alert]").forEach((m) => { if (!m.closest("dialog")) m.remove(); }));
    await seite.waitForTimeout(300);
    let clip;
    if (opt.element) {
      await seite.evaluate(() => document.activeElement && document.activeElement.blur());
      await seite.locator(opt.element).first().screenshot({ path: path.join(ZIEL, name + ".png"), style: ".fuss { visibility: hidden !important; }" });
    } else {
      // Fenster auf die volle Seitenhöhe ziehen, sonst setzt Chromium die Fußleiste mitten ins Bild
      const h = await seite.evaluate(() => document.documentElement.scrollHeight);
      await seite.setViewportSize({ width: BREITE, height: h });
      await seite.waitForTimeout(250);
      await seite.screenshot({ path: path.join(ZIEL, name + ".png"), clip: { x: 0, y: 0, width: BREITE, height: Math.min(h, opt.hoehe || MAX) } });
      await seite.setViewportSize({ width: BREITE, height: HOEHE });
    }
    console.log("ok  " + name);
  }

  // Anmeldung
  await neu();
  await bild("anmeldung", { hoehe: HOEHE });

  // Erste Anmeldung mit Einmalpasswort
  await neu();
  await seite.fill("#kennung", "xv10005");
  await seite.fill("#passwort", "Kq7#mPz2-wHte");
  await seite.click("button[type=submit]");
  await seite.waitForSelector("#neu");
  await bild("passwort-festlegen", { hoehe: HOEHE });

  // Abteilungsleitung
  await anmelden("xv10001");
  await bild("start-abteilungsleitung", { hoehe: 1100 });
  await gehe("#/uebersicht", ".planbudgettabelle");
  await bild("planbudgets");
  await seite.click("[data-budget='ks-411']");
  await seite.waitForSelector("dialog[open]");
  await seite.waitForTimeout(300);
  await bild("planbudget-eintragen", { element: "dialog[open]" });
  await seite.keyboard.press("Escape");
  await seite.selectOption("[data-jahr]", "2027");
  await seite.waitForSelector("[data-uebernahme]");
  await seite.click("[data-uebernahme]");
  await seite.waitForSelector("dialog[open]");
  await seite.waitForTimeout(300);
  await bild("uebernahme", { element: "dialog[open]" });
  await seite.click("dialog button[type=submit]");
  await seite.waitForSelector("#protokoll tbody tr");
  await bild("aenderungsprotokoll", { element: "#protokoll" });
  await seite.selectOption("[data-jahr]", "2026");
  await gehe("#/verwaltung/einstellungen", "[data-ampel]");
  await bild("ampel", { hoehe: 720 });
  await gehe("#/ist", "text=IST-Werte");
  await bild("ist-werte");
  await gehe("#/kostenstelle/411", "text=Plan und IST je Position");
  await bild("kostenstelle-detail", { hoehe: 1250 });
  await bild("ist-verlauf", { element: ".verlauf" });
  await gehe("#/kostenstelle/410", ".umschalter");
  await bild("kostenstelle-umschalter", { hoehe: 700 });
  await gehe("#/bericht/410", "[data-kopieren]");
  await bild("bericht");
  await gehe("#/projekt/41000101", "text=Erfasste Kosten");
  await bild("projekt", { hoehe: 1150 });
  const kostenKnopf = seite.locator("[data-kosten-neu], button:has-text('Kosten erfassen')").first();
  if (await kostenKnopf.count()) {
    await kostenKnopf.click();
    await seite.waitForSelector("dialog[open]");
    await seite.waitForTimeout(300);
    await bild("kosten-erfassen", { element: "dialog[open]" });
    await seite.keyboard.press("Escape");
  }
  await gehe("#/verwaltung/benutzer", ".reiter");
  await bild("verwaltung-benutzer");
  await seite.click("[data-kopfaktion] [data-neu]");
  await seite.waitForSelector("dialog[open]");
  await seite.waitForTimeout(300);
  await bild("benutzer-anlegen", { element: "dialog[open]" });
  await seite.keyboard.press("Escape");
  await gehe("#/verwaltung/kostenstellen", ".reiter");
  await bild("verwaltung-kostenstellen");
  await seite.click("[data-bearbeiten='410']");
  await seite.waitForSelector("dialog[open]");
  await seite.waitForTimeout(300);
  await bild("kostenstelle-bearbeiten", { element: "dialog[open]" });
  await seite.keyboard.press("Escape");
  await gehe("#/verwaltung/projekte", ".reiter");
  await bild("verwaltung-projektnummern");
  await gehe("#/verwaltung/ist", "text=KST-Bericht importieren");
  await bild("kst-berichte");
  // Import mit der Beispieldatei (erfundene Zahlen)
  const auswahl = seite.locator("#i-ks").first();
  if (await auswahl.count()) await auswahl.selectOption("413").catch(() => {});
  const datei = seite.locator("input[type=file]").first();
  if (await datei.count()) {
    await datei.setInputFiles(path.join(__dirname, "..", "tests", "daten", "kst-bericht-beispiel.xlsx"));
    await seite.waitForSelector(".vorschau", { timeout: 5000 }).catch(() => {});
    await seite.waitForTimeout(400);
    if (await seite.isVisible(".vorschau")) await bild("kst-vorschau", { element: ".vorschau" });
  }
  await gehe("#/profil", "text=Deine Angaben");
  await bild("profil");

  // Gruppenleitung
  await anmelden("xv10002");
  await bild("start-gruppenleitung", { hoehe: 1250 });

  // Key Account Manager
  await anmelden("xv10004");
  await bild("start-kam", { hoehe: 1000 });

  // Administrator
  await anmelden("xv00000");
  await bild("start-administrator", { hoehe: HOEHE });
  await gehe("#/verwaltung/einstellungen", "#e-titel");
  await bild("einstellungen", { hoehe: HOEHE });
  // BETA-ANMELDEN-ALS Anfang
  await gehe("#/verwaltung/benutzer", ".reiter");
  await seite.click("[data-als='xv10002']");
  await seite.click("dialog button[type=submit]");
  await seite.waitForSelector(".als-admin");
  await bild("anmelden-als", { hoehe: 420 });
  // BETA-ANMELDEN-ALS Ende

  await browser.close();
  server.close();
})().catch((f) => { console.error(f); process.exit(1); });
