/* Oberfläche gegen den echten Server (api.ashx über Mono):
   UI_TEST=1 PORT=8099 bash tests/server/server-test.sh &  dann  node tests/server-ui-test.js http://localhost:8099/ */
"use strict";
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const url = process.argv[2] || "http://localhost:8099/";

function pruefe(bedingung, text) {
  if (!bedingung) throw new Error("Fehlgeschlagen: " + text);
  console.log("ok  " + text);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/40[0-9]/.test(m.text())) fehler.push(m.text()); });
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
  pruefe(!(await page.isVisible("text=Browserbetrieb")), "Serverbetrieb erkannt");
  await anmelden("xv00000", "RuV-Plan#2026!");
  await page.waitForSelector(".startkachel");
  pruefe(true, "Administrator meldet sich an");

  await page.goto(url + "#/verwaltung/kostenstellen");
  await page.click("[data-kopfaktion] [data-neu]");
  await page.fill("#n-nummer", "411");
  await page.click("dialog button[type=submit]");
  await page.waitForSelector("tr[data-zeile='411']");
  pruefe(true, "Kostenstelle anlegen");

  await page.goto(url + "#/verwaltung/benutzer");
  await page.click("[data-kopfaktion] [data-neu]");
  await page.fill("#b-kennung", "xv10001");
  await page.fill("#b-vor", "Sabine");
  await page.fill("#b-nach", "Hofmann");
  await page.selectOption("#b-rolle", "al");
  await page.check("dialog input[value='411']");
  const einmal = await page.inputValue("#b-pw");
  await page.click("dialog button[type=submit]");
  await page.waitForSelector("tr[data-zeile='xv10001'] >> text=" + einmal);
  pruefe(true, "Abteilungsleitung mit Einmalpasswort anlegen");
  await abmelden();

  await anmelden("xv10001", einmal);
  await page.waitForSelector("text=Passwort festlegen");
  await page.fill("#neu", "Garten-Laube#26");
  await page.fill("#wdh", "Garten-Laube#26");
  await page.click("button[type=submit]");
  await page.waitForSelector("text=Meine Kostenstellen");
  pruefe(true, "eigenes Passwort festlegen");

  await page.goto(url + "#/uebersicht");
  await page.click("[data-budget='ks-411']");
  await page.fill("#w-pkId", "250.000,00");
  await page.fill("#w-sonstiges", "1500");
  await page.click("dialog button[type=submit]");
  await page.waitForSelector("text=Das Planbudget");
  pruefe(await page.isVisible("tr:has(th:has-text('411')) >> text=251.500,00 €"), "Planbudget auf dem Server speichern");
  await page.reload();
  await page.waitForSelector("text=Summe Kostenstellen");
  pruefe(await page.isVisible("tr:has(th:has-text('411')) >> text=251.500,00 €"), "Planbudget bleibt nach dem Neuladen");

  await page.goto(url + "#/profil");
  await page.click(".farbwahl__option:has-text('Rheingau')");
  await page.waitForTimeout(300);
  await abmelden();
  await anmelden("xv10001", "Garten-Laube#26");
  await page.waitForSelector("text=Meine Kostenstellen");
  pruefe(await page.getAttribute("html", "data-farbe") === "rheingau", "Farbdesign kommt vom Server");
  pruefe(fehler.length === 0, "keine Fehler in der Konsole" + (fehler.length ? ": " + fehler.join(" | ") : ""));
  await browser.close();
})().catch((f) => { console.error(f.message); process.exit(1); });
