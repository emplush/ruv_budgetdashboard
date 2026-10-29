/* Erzeugt app/handbuch/Handbuch.pdf aus der Seite #/handbuch (Browserbetrieb mit Beispieldaten): node tools/handbuch_pdf.js
   Vorher bei Änderungen an der Oberfläche die Bilder neu: node tools/handbuch_bilder.js && python3 tools/handbuch_bilder_verkleinern.py */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const WURZEL = path.join(__dirname, "..", "app");
const ZIEL = path.join(WURZEL, "handbuch", "Handbuch.pdf");
const TYPEN = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png" };
const VERSION = fs.readFileSync(path.join(__dirname, "..", "VERSION"), "utf8").trim();

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
  const seite = await browser.newPage({ locale: "de-DE" });
  await seite.goto(url);
  await seite.waitForSelector("#kennung");
  await seite.fill("#kennung", "xv10001");
  await seite.fill("#passwort", "RuV-Plan#2026!");
  await seite.click("button[type=submit]");
  await seite.waitForSelector(".kopf");
  await seite.evaluate(() => { window.BDFarben.anwenden("hell", "klassik"); location.hash = "#/handbuch"; });
  await seite.waitForSelector(".hb-kapitel");
  await seite.evaluate(() => Promise.all([].map.call(document.images, (b) => { b.loading = "eager"; return b.complete ? 0 : new Promise((ok) => { b.onload = b.onerror = ok; }); })));
  await seite.evaluate(() => document.fonts.ready);
  await seite.waitForTimeout(500);
  const fuss = '<div style="width:100%;font-size:8px;color:#5f6b7a;padding:0 15mm;display:flex;justify-content:space-between;font-family:sans-serif">' +
    "<span>Budgetdashboard · Handbuch · Version " + VERSION + '</span><span>Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span></div>';
  await seite.pdf({ path: ZIEL, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: fuss });
  console.log("app/handbuch/Handbuch.pdf (" + Math.round(fs.statSync(ZIEL).size / 1024) + " KB)");
  await browser.close();
  server.close();
})().catch((f) => { console.error(f); process.exit(1); });
