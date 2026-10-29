/* Tests der Regeln in app/js/daten.js: node --test tests/logik.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const D = require("../app/js/daten.js");
const DEMO = require("../app/js/demo-daten.js").BDDemo;

function daten() {
  const d = D.leereDaten();
  const b = (k, v, n, r) => Object.assign(D.neuerBenutzer(k, { vorname: v, nachname: n, rolle: r }), { mussPasswortAendern: false });
  d.benutzer.push(b("xv00000", "Admin", "Budget", "admin"), b("xv10001", "Sabine", "Hofmann", "al"), b("xv10002", "Thomas", "Becker", "gl"), b("xv10004", "Daniel", "Schulz", "kam"));
  return d;
}

test("Passwortregeln nach aktuellen Kriterien", () => {
  assert.deepStrictEqual(D.passwortMaengel("RuV-Plan#2026!"), []);
  assert.ok(D.passwortMaengel("Kurz#1a").includes("mindestens 12 Zeichen"));
  assert.ok(D.passwortMaengel("ohnegrossbuchstaben#1").includes("einen Großbuchstaben"));
  assert.ok(D.passwortMaengel("OhneSonderzeichen12").includes("ein Sonderzeichen"));
  assert.ok(D.passwortMaengel("Mein#Passwort2026").includes("keine gängigen Wörter oder Zahlenfolgen"));
  assert.ok(D.passwortMaengel("Xaaaa#Bcdef12").includes("kein Zeichen viermal hintereinander"));
  const person = { kennung: "xv12345", vorname: "Sabine", nachname: "Hofmann" };
  assert.ok(D.passwortMaengel("Sabine#Garten77", person).includes("nicht Deine XV-Nummer oder Deinen Namen"));
  assert.ok(D.passwortMaengel("Xv12345#Garten", person).includes("nicht Deine XV-Nummer oder Deinen Namen"));
  assert.deepStrictEqual(D.passwortMaengel("Garten#Laube77", person), []);
});

test("Einmalpasswörter erfüllen die Regeln", () => {
  for (let i = 0; i < 200; i++) assert.deepStrictEqual(D.passwortMaengel(D.einmalpasswort()), []);
});

test("XV-Nummer", () => {
  assert.ok(D.istGueltigeKennung("XV12345"));
  assert.ok(!D.istGueltigeKennung("xv1234"));
  assert.ok(!D.istGueltigeKennung("ab12345"));
});

test("Beträge lesen", () => {
  assert.strictEqual(D.leseBetrag("1.234,56"), 1234.56);
  assert.strictEqual(D.leseBetrag("1234,5"), 1234.5);
  assert.strictEqual(D.leseBetrag("1234.5"), 1234.5);
  assert.strictEqual(D.leseBetrag("12.500 €"), 12500);
  assert.strictEqual(D.leseBetrag(""), 0);
  assert.strictEqual(D.leseBetrag(9800), 9800);
  assert.strictEqual(D.leseBetrag("-3"), null);
  assert.strictEqual(D.leseBetrag("abc"), null);
  assert.strictEqual(D.leseBetrag("1,234"), null);
  assert.strictEqual(D.leseBetrag("1000000000"), null);
});

test("Kostenstellen und Projektnummern: Format, Zuweisung nur zur passenden Rolle", () => {
  const d = daten();
  assert.match(D.speichereNummer(d, "ks", "", "4100", []), /genau 3 Ziffern/);
  assert.match(D.speichereNummer(d, "pn", "", "123", []), /genau 8 Ziffern/);
  assert.strictEqual(D.speichereNummer(d, "ks", "", "411", ["xv10002", "xv10004", "xv00000", "xv10001"]), "");
  assert.deepStrictEqual(D.findeNummer(d, "ks", "411").benutzer, ["xv10001", "xv10002"]);
  assert.strictEqual(D.speichereNummer(d, "ks", "", "410", []), "");
  assert.deepStrictEqual(d.kostenstellen.map((n) => n.nummer), ["410", "411"]);
  assert.match(D.speichereNummer(d, "ks", "", "410", []), /gibt es schon/);
  assert.strictEqual(D.speichereNummer(d, "pn", "", "41000101", ["xv10004", "xv10002"]), "");
  assert.deepStrictEqual(D.findeNummer(d, "pn", "41000101").benutzer, ["xv10004"]);
  assert.deepStrictEqual(D.nummernVon(d, "xv10002", "ks"), ["411"]);
});

test("Zuweisungen über den Benutzer setzen, Rollenwechsel nimmt unpassende Nummern", () => {
  const d = daten();
  D.speichereNummer(d, "ks", "", "411", []);
  D.speichereNummer(d, "ks", "", "412", []);
  D.setzeNummernFuer(d, "xv10002", { ks: ["411", "412"], pn: [] });
  assert.deepStrictEqual(D.nummernVon(d, "xv10002", "ks"), ["411", "412"]);
  D.findeBenutzer(d, "xv10002").rolle = "kam";
  D.setzeNummernFuer(d, "xv10002", { ks: ["411"], pn: [] });
  assert.deepStrictEqual(D.nummernVon(d, "xv10002", "ks"), []);
});

test("Planbudget: Sachkosten und Gesamt, Umbenennen und Löschen", () => {
  const d = daten();
  D.speichereNummer(d, "ks", "", "411", []);
  assert.match(D.setzeBudget(d, "2026", "ks", "999", {}), /gibt es nicht/);
  assert.match(D.setzeBudget(d, "2026", "ks", "411", { reise: "x" }), /Reise\/KfZ/);
  assert.strictEqual(D.setzeBudget(d, 2026, "ks", "411", { pkId: "100.000", pkAd: 50000, werbung: "1.000,50", reise: "2000", sonstiges: "" }), "");
  const w = D.budgetVon(d, 2026, "ks", "411");
  assert.deepStrictEqual([w.sachkosten, w.personalkosten, w.gesamt, w.vorhanden], [3000.5, 150000, 153000.5, true]);
  assert.strictEqual(D.budgetVon(d, 2025, "ks", "411").vorhanden, false);
  D.speichereNummer(d, "ks", "411", "420", []);
  assert.strictEqual(D.budgetVon(d, 2026, "ks", "420").gesamt, 153000.5);
  D.loescheNummer(d, "ks", "420");
  assert.deepStrictEqual(d.budgets, {});
});

test("Rechte der Rollen", () => {
  const d = daten();
  const [admin, al, gl, kam] = d.benutzer;
  assert.ok(D.Rechte.einstellungen(admin) && !D.Rechte.einstellungen(al));
  assert.ok(D.Rechte.budgets(al) && !D.Rechte.budgets(admin) && !D.Rechte.budgets(gl));
  assert.ok(D.Rechte.benutzer(admin) && D.Rechte.benutzer(al) && !D.Rechte.benutzer(gl) && !D.Rechte.benutzer(kam));
  assert.match(D.pruefeBenutzer(d, al, null, { kennung: "xv20000", vorname: "A", nachname: "B", rolle: "admin" }), /nur ein Administrator/);
  assert.match(D.pruefeBenutzer(d, al, admin, { vorname: "A", nachname: "B", rolle: "admin" }), /nur ein Administrator/);
  assert.strictEqual(D.pruefeBenutzer(d, al, null, { kennung: "xv20000", vorname: "A", nachname: "B", rolle: "gl" }), "");
  assert.match(D.pruefeBenutzer(d, admin, admin, { vorname: "A", nachname: "B", rolle: "al" }), /nicht selbst/);
  assert.match(D.pruefeLoeschen(d, al, al), /eigenes Konto/);
  assert.match(D.pruefeLoeschen(d, al, admin), /nur ein Administrator/);
  assert.deepStrictEqual(D.erlaubteRollen(al).map((r) => r.id), ["al", "gl", "kam"]);
});

test("Sicht je Rolle wie im Server", () => {
  const d = daten();
  d.benutzer[2].einmalpasswort = "Geheim#2026xy";
  d.benutzer[2].hash = "h"; d.benutzer[2].salz = "s";
  D.speichereNummer(d, "ks", "", "411", ["xv10002", "xv10001"]);
  D.speichereNummer(d, "ks", "", "412", ["xv10001"]);
  D.speichereNummer(d, "pn", "", "41000101", ["xv10004"]);
  D.setzeBudget(d, "2026", "ks", "411", { pkId: 1 });
  D.setzeBudget(d, "2026", "ks", "412", { pkId: 2 });
  D.setzeBudget(d, "2026", "pn", "41000101", { pkId: 3 });
  const gl = D.sicht(d, "xv10002");
  assert.deepStrictEqual(gl.benutzer.map((b) => b.kennung), ["xv10002"]);
  assert.strictEqual(gl.benutzer[0].einmalpasswort, "");
  assert.ok(!("hash" in gl.benutzer[0]));
  assert.deepStrictEqual(gl.kostenstellen, [{ nummer: "411", benutzer: ["xv10002"] }]);
  assert.deepStrictEqual(Object.keys(gl.budgets["2026"]), ["ks-411"]);
  const kam = D.sicht(d, "xv10004");
  assert.deepStrictEqual(Object.keys(kam.budgets["2026"]), ["pn-41000101"]);
  const admin = D.sicht(d, "xv00000");
  assert.deepStrictEqual(admin.budgets, {});
  assert.strictEqual(admin.benutzer.length, 4);
  assert.strictEqual(admin.benutzer[2].einmalpasswort, "Geheim#2026xy");
  const al = D.sicht(d, "xv10001");
  assert.strictEqual(Object.keys(al.budgets["2026"]).length, 3);
});

test("Kalenderjahre und Begrüßung", () => {
  const d = daten();
  d.budgets["2019"] = {};
  assert.deepStrictEqual(D.jahre(d, new Date(2026, 5, 1)), [2028, 2027, 2026, 2025, 2019]);
  assert.strictEqual(D.begruessung(new Date(2026, 0, 1, 7)), "Guten Morgen");
  assert.strictEqual(D.begruessung(new Date(2026, 0, 1, 13)), "Guten Tag");
  assert.strictEqual(D.begruessung(new Date(2026, 0, 1, 20)), "Guten Abend");
  assert.strictEqual(D.begruessung(new Date(2026, 0, 1, 2)), "Hallo");
});

test("Beispieldaten: Testzugänge erfüllen die Passwortregeln", async () => {
  const d = await D.startDaten(DEMO.fuelle);
  assert.strictEqual(d.benutzer[0].kennung, D.STANDARD_ADMIN);
  assert.deepStrictEqual(D.passwortMaengel(D.STANDARD_PASSWORT), []);
  assert.strictEqual(d.benutzer.filter((b) => b.mussPasswortAendern).length, 1);
  assert.ok(d.benutzer.every((b) => b.hash && !b._startPasswort));
});

test("Gleiche Konstanten in JavaScript und api.ashx", () => {
  const fs = require("fs"), path = require("path");
  const cs = fs.readFileSync(path.join(__dirname, "..", "app", "api.ashx"), "utf8");
  const js = fs.readFileSync(path.join(__dirname, "..", "app", "js", "design.js"), "utf8");
  assert.ok(cs.includes('StandardPasswort = "' + D.STANDARD_PASSWORT + '"'));
  const farben = [...js.matchAll(/id: "([a-z]+)", name:/g)].map((m) => m[1]);
  assert.strictEqual(farben.length, 10);
  farben.forEach((f) => assert.ok(cs.includes('"' + f + '"'), f));
  const app = fs.readFileSync(path.join(__dirname, "..", "app", "js", "app.js"), "utf8");
  const version = fs.readFileSync(path.join(__dirname, "..", "VERSION"), "utf8").trim();
  assert.ok(app.includes('var VERSION = "' + version + '"'));
  assert.ok(cs.includes('Version = "' + version + '"'));
});
