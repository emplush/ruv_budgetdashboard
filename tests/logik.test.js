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

test("Kostenstelle beim Anlegen einer übergreifenden zuordnen (oben)", () => {
  const d = daten();
  ["410", "411", "420"].forEach((n) => D.speichereNummer(d, "ks", "", n, []));
  D.speichereNummer(d, "ks", "410", "410", [], ["411"]);
  assert.strictEqual(D.speichereNummer(d, "ks", "", "412", [], undefined, "410"), "");
  assert.deepStrictEqual(D.findeNummer(d, "ks", "410").unter, ["411", "412"]);
  /* Wechsel zu einer anderen übergreifenden, dann keine */
  assert.strictEqual(D.speichereNummer(d, "ks", "412", "412", [], [], "420"), "");
  assert.deepStrictEqual([D.findeNummer(d, "ks", "410").unter, D.findeNummer(d, "ks", "420").unter], [["411"], ["412"]]);
  assert.strictEqual(D.speichereNummer(d, "ks", "412", "412", [], [], ""), "");
  assert.deepStrictEqual(D.findeNummer(d, "ks", "420").unter, []);
  /* ohne oben bleibt die Zuordnung */
  D.speichereNummer(d, "ks", "411", "411", ["xv10002"]);
  assert.strictEqual(D.uebergeordnete(d, "411"), "410");
  /* nur eine Ebene */
  assert.match(D.speichereNummer(d, "ks", "", "413", [], undefined, "411"), /selbst Unterkostenstelle von 410/);
  assert.match(D.speichereNummer(d, "ks", "410", "410", [], undefined, "420"), /hat selbst Unterkostenstellen/);
  assert.match(D.speichereNummer(d, "ks", "", "413", [], ["420"], "410"), /keine Unterkostenstellen haben/);
  assert.match(D.speichereNummer(d, "ks", "420", "420", [], undefined, "420"), /nicht zu sich selbst/);
  assert.match(D.speichereNummer(d, "ks", "", "413", [], undefined, "999"), /gibt es nicht/);
  assert.strictEqual(D.findeNummer(d, "ks", "413"), null);
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

test("Übergreifende Kostenstelle: Regeln, Summe, Sicht", () => {
  const d = daten();
  ["410", "411", "412", "413"].forEach((n) => D.speichereNummer(d, "ks", "", n, []));
  D.speichereNummer(d, "ks", "410", "410", ["xv10002"], ["412", "411", "411"]);
  assert.deepStrictEqual(D.findeNummer(d, "ks", "410").unter, ["411", "412"]);
  assert.strictEqual(D.uebergeordnete(d, "411"), "410");
  assert.match(D.speichereNummer(d, "ks", "413", "413", [], ["410"]), /selbst übergreifend/);
  assert.match(D.speichereNummer(d, "ks", "411", "411", [], ["413"]), /keine Unterkostenstellen haben/);
  assert.match(D.speichereNummer(d, "ks", "413", "413", [], ["412"]), /übergreifenden Kostenstelle 410/);
  assert.match(D.speichereNummer(d, "ks", "413", "413", [], ["413"]), /nicht selbst/);
  D.speichereNummer(d, "ks", "410", "410", ["xv10002"]);
  assert.deepStrictEqual(D.findeNummer(d, "ks", "410").unter, ["411", "412"]);
  D.setzeBudget(d, "2026", "ks", "411", { pkId: 1000, reise: 50 });
  /* Ohne eigenen Eintrag: Summe der zugeordneten */
  let g = D.gesamtBudgetVon(d, "2026", "ks", "410");
  assert.deepStrictEqual([g.gesamt.ohneEigenenEintrag, g.gesamt.gesamt, g.eigen.vorhanden], [true, 1050, false]);
  /* Eingetragen wird das Gesamtbudget, eigenes Budget ist der Rest */
  D.setzeBudget(d, "2026", "ks", "410", { pkId: 1100, reise: 55 });
  g = D.gesamtBudgetVon(d, "2026", "ks", "410");
  assert.deepStrictEqual([g.uebergreifend, g.eigen.gesamt, g.eigen.pkId, g.eigen.reise, g.gesamt.gesamt, g.gesamt.widerspruch, g.unter.length, g.unter[1].budget.vorhanden], [true, 105, 100, 5, 1155, false, 2, false]);
  const gl = D.sicht(d, "xv10002");
  assert.deepStrictEqual(gl.kostenstellen.map((n) => n.nummer + ":" + n.benutzer.join(",")), ["410:xv10002", "411:", "412:"]);
  assert.deepStrictEqual(Object.keys(gl.budgets["2026"]).sort(), ["ks-410", "ks-411"]);
  assert.deepStrictEqual(D.nummernVon(gl, "xv10002", "ks"), ["410"]);
  D.speichereNummer(d, "ks", "411", "421", []);
  assert.deepStrictEqual(D.findeNummer(d, "ks", "410").unter, ["412", "421"]);
  D.loescheNummer(d, "ks", "412");
  assert.deepStrictEqual(D.findeNummer(d, "ks", "410").unter, ["421"]);
  D.speichereNummer(d, "ks", "410", "410", [], []);
  assert.strictEqual(D.gesamtBudgetVon(d, "2026", "ks", "410").uebergreifend, false);
});

test("IST: KST-Bericht lesen, importieren, sichern, wiederherstellen", async () => {
  const X = require("../app/js/excel.js");
  const blaetter = await X.arbeitsmappeLesen(require("fs").readFileSync(require("path").join(__dirname, "daten", "kst-bericht-beispiel.xlsx")));
  const e = D.istAuslesen(blaetter[0].zeilen);
  assert.strictEqual(e.fehler, undefined);
  assert.deepStrictEqual([e.kst, e.stand, e.monat, e.aktuell.jahr, e.vorjahr.jahr, e.vorjahrZeitraum.jahr], ["413", "2026-10-22", "2026-09", 2026, 2025, 2025]);
  assert.deepStrictEqual(e.aktuell.werte, { pkId: 160000.25, pkAd: 310000.5, werbung: 30000.1, reise: 55000, sonstiges: 11370 });
  assert.strictEqual(e.vorjahr.werte.sonstiges, 16100);
  assert.deepStrictEqual(e.warnungen, []);
  const kaputt = blaetter[0].zeilen.map((z) => z && z.slice());
  kaputt[21][3] = "1";
  assert.strictEqual(D.istAuslesen(kaputt).warnungen.length, 2);
  assert.match(D.istAuslesen([["Text", "ohne Kostenstelle"]]).fehler, /keine Kostenstelle/);

  const d = daten();
  ["410", "413"].forEach((n) => D.speichereNummer(d, "ks", "", n, []));
  D.speichereNummer(d, "ks", "410", "410", ["xv10002"], ["413"]);
  assert.match(D.setzeIst(d, "999", e, "xv10001"), /gibt es nicht/);
  assert.match(D.setzeIst(d, "413", Object.assign({}, e, { monat: "2025-09" }), "xv10001"), /passen nicht/);
  assert.strictEqual(D.setzeIst(d, "413", e, "xv10001"), "");
  assert.deepStrictEqual([d.istSicherungen.length, d.istSicherungen[0].vorher], [1, null]);
  const ist = D.istVon(d, 2026, "413");
  assert.deepStrictEqual([ist.vorhanden, ist.bisMonat, ist.gesamt, ist.sachkosten], [true, 9, 566370.85, 96370.1]);
  assert.deepStrictEqual([D.istVon(d, 2025, "413").bisMonat, D.istVon(d, 2025, "413").gesamt, D.istVon(d, 2024, "413").vorhanden], [12, 746100, false]);
  D.setzeBudget(d, "2026", "ks", "413", { pkId: 800000 });
  const k = D.kennzahlen(D.gesamtBudgetVon(d, 2026, "ks", "410").gesamt, D.gesamtIstVon(d, 2026, "ks", "410").gesamt);
  assert.deepStrictEqual([Math.round(k.quote * 1000), k.rest, k.hochrechnung, k.ampel, k.vorjahr], [708, 233629.15, 755161.13, "gruen", 557750]);
  assert.strictEqual(D.prozentText(k.quote), "70,8 %");
  assert.strictEqual(D.standText("2026-10-22", "2026-09"), "Stand 22.10.2026 · gebucht bis September 2026");
  const gl = D.sicht(d, "xv10002");
  assert.deepStrictEqual([Object.keys(gl.ist), gl.istSicherungen], [["ks-413"], []]);
  const admin = D.sicht(d, "xv00000");
  assert.deepStrictEqual([admin.ist, admin.istSicherungen.length, "vorher" in admin.istSicherungen[0]], [{}, 1, false]);
  D.setzeIst(d, "413", Object.assign({}, e, { stand: "2026-11-05" }), "xv10001");
  assert.strictEqual(d.istSicherungen[0].vorher.stand, "2026-10-22");
  assert.strictEqual(D.stelleIstWiederHer(d, d.istSicherungen[0].id, "xv00000"), "");
  assert.strictEqual(d.ist["ks-413"].stand, "2026-10-22");
  assert.strictEqual(D.stelleIstWiederHer(d, d.istSicherungen[d.istSicherungen.length - 1].id, "xv00000"), "");
  assert.strictEqual(d.ist["ks-413"], undefined);
  D.setzeIst(d, "413", e, "xv10001");
  D.speichereNummer(d, "ks", "413", "414", []);
  assert.ok(d.ist["ks-414"] && d.istSicherungen.every((x) => x.nummer === "414"));
  D.loescheNummer(d, "ks", "414");
  assert.deepStrictEqual([d.ist, d.istSicherungen], [{}, []]);
});

test("Projektkosten: erfassen, im IST der Kostenstelle enthalten, Sicht", () => {
  const d = daten();
  D.speichereNummer(d, "ks", "", "410", []);
  D.speichereNummer(d, "ks", "", "411", ["xv10002"]);
  D.speichereNummer(d, "ks", "410", "410", [], ["411"]);
  assert.match(D.speichereNummer(d, "pn", "", "41000101", ["xv10004"], "999"), /999/);
  assert.strictEqual(D.speichereNummer(d, "pn", "", "41000101", ["xv10004"], "411"), "");
  D.speichereNummer(d, "pn", "", "41000102", [], "");
  const k = (pn, datum, betrag) => D.speichereKosten(d, "", { pn, datum, betrag, text: "Test" }, "xv10001");
  assert.match(k("41000101", "2025-02-30", "10"), /Datum/);
  assert.match(k("41000101", "2025-03-01", "0"), /größer als 0/);
  assert.match(k("41000101", "2025-03-01", "-5"), /größer als 0/);
  assert.match(k("41009999", "2025-03-01", "10"), /gibt es nicht/);
  assert.strictEqual(k("41000101", "2025-03-01", "1.000,50"), "");
  assert.strictEqual(k("41000101", "2025-07-10", "200"), "");
  assert.strictEqual(k("41000102", "2025-07-10", "999"), "");
  assert.deepStrictEqual(d.kosten.map((x) => x.datum), ["2025-07-10", "2025-07-10", "2025-03-01"]);
  assert.ok(d.kosten.every((x) => !("kostenart" in x)));
  /* Projektnummern haben keine Kostenarten: alles in „projekt“ */
  const p = D.projektIstVon(d, 2025, "41000101");
  assert.deepStrictEqual([p.gesamt, p.projekt, p.sachkosten, p.anzahl, p.bisMonat], [1200.5, 1200.5, 0, 2, 12]);
  /* Rechte: Abteilungsleitung alle, Key Account Manager nur eigene, Gruppenleitung keine */
  const [uAdmin, uAl, uGl, uKam] = d.benutzer;
  assert.deepStrictEqual([D.Rechte.kosten(uAl, d, "41000102"), D.Rechte.kosten(uKam, d, "41000101"), D.Rechte.kosten(uKam, d, "41000102"), D.Rechte.kosten(uGl, d, "41000101"), D.Rechte.kosten(uAdmin, d, "41000101")],
    [true, true, false, false, false]);
  /* Planbudget einer Projektnummer: nur ein Betrag */
  assert.match(D.setzeBudget(d, "2025", "pn", "41000101", { betrag: "x" }), /Betrag/);
  assert.strictEqual(D.setzeBudget(d, "2025", "pn", "41000101", { betrag: "5.000" }), "");
  assert.deepStrictEqual(d.budgets["2025"]["pn-41000101"], { betrag: 5000 });
  const b = D.budgetVon(d, 2025, "pn", "41000101");
  assert.deepStrictEqual([b.gesamt, b.projekt, b.pkId, b.vorhanden], [5000, 5000, 0, true]);
  /* ältere Einträge mit Positionen zählen als Summe */
  d.budgets["2024"] = { "pn-41000101": { pkId: 100, werbung: 50 } };
  assert.strictEqual(D.budgetVon(d, 2024, "pn", "41000101").gesamt, 150);
  /* Projektkosten stecken schon im KST-Bericht: ohne Bericht kein IST, sie werden nur aufgeschlüsselt */
  const i = D.istVon(d, 2025, "411");
  assert.deepStrictEqual([i.vorhanden, i.gesamt, i.projekte.gesamt], [false, 0, 1200.5]);
  assert.strictEqual(D.gesamtIstVon(d, 2025, "ks", "410").gesamt.vorhanden, false);
  assert.strictEqual(D.gesamtIstVon(d, 2025, "pn", "41000102").gesamt.gesamt, 999);
  /* Sicht: Gruppenleitung sieht die Projektnummer ihrer Kostenstelle ohne Zuweisung, Admin keine Kosten */
  const gl = D.sicht(d, "xv10002");
  assert.deepStrictEqual(gl.projekte, [{ nummer: "41000101", benutzer: [], ks: "411" }]);
  assert.strictEqual(gl.kosten.length, 2);
  assert.strictEqual(D.sicht(d, "xv10004").kosten.length, 2);
  assert.strictEqual(D.sicht(d, "xv10001").kosten.length, 3);
  assert.deepStrictEqual(D.sicht(d, "xv00000").kosten, []);
  /* ändern, umbenennen, löschen */
  const id = d.kosten.find((x) => x.pn === "41000101" && x.betrag === 200).id;
  assert.strictEqual(D.speichereKosten(d, id, { pn: "41000101", datum: "2025-08-01", betrag: 50 }, "xv10001"), "");
  assert.strictEqual(D.projektIstVon(d, 2025, "41000101").gesamt, 1050.5);
  D.speichereNummer(d, "pn", "41000101", "41000109", ["xv10004"], "411");
  assert.strictEqual(d.kosten.filter((x) => x.pn === "41000109").length, 2);
  D.speichereNummer(d, "ks", "411", "419", ["xv10002"]);
  assert.strictEqual(D.findeNummer(d, "pn", "41000109").ks, "419");
  assert.strictEqual(D.loescheKosten(d, id), "");
  assert.match(D.loescheKosten(d, id), /nicht mehr/);
  D.loescheNummer(d, "ks", "419");
  assert.strictEqual(D.findeNummer(d, "pn", "41000109").ks, "");
  D.loescheNummer(d, "pn", "41000109");
  assert.deepStrictEqual(d.kosten.map((x) => x.pn), ["41000102"]);
});

test("IST der übergreifenden Kostenstelle: KST-Bericht enthält zugeordnete und Projektkosten (Beispiel von Michael)", () => {
  const d = daten();
  ["001", "101", "102"].forEach((n) => D.speichereNummer(d, "ks", "", n, []));
  D.speichereNummer(d, "ks", "001", "001", [], ["101", "102"]);
  D.speichereNummer(d, "pn", "", "20100000", [], "001");
  D.speichereKosten(d, "", { pn: "20100000", datum: "2026-02-01", betrag: 5000 }, "xv10001");
  const bericht = (gesamt, monat) => ({ stand: "2026-10-22", monat: monat || "2026-09", aktuell: { jahr: 2026, werte: { pkId: gesamt, pkAd: 0, werbung: 0, reise: 0, sonstiges: 0 } },
    vorjahrZeitraum: { jahr: 2025, werte: { pkId: gesamt / 2, pkAd: 0, werbung: 0, reise: 0, sonstiges: 0 } }, vorjahr: null });
  D.setzeIst(d, "101", bericht(30000), "xv10001");
  /* Ohne eigenen Bericht: nur die Summe der zugeordneten */
  let g = D.gesamtIstVon(d, 2026, "ks", "001");
  assert.deepStrictEqual([g.gesamt.vorhanden, g.gesamt.ohneEigenImport, g.gesamt.gesamt, g.fehlend], [true, true, 30000, 2]);
  D.setzeIst(d, "001", bericht(50000), "xv10001");
  g = D.gesamtIstVon(d, 2026, "ks", "001");
  /* 50.000 gesamt, 30.000 auf 101, 5.000 Projektkosten: auf 001 selbst bleiben 15.000 */
  assert.deepStrictEqual([g.gesamt.gesamt, g.unter[0].ist.gesamt, g.projekte.gesamt, g.eigen.gesamt], [50000, 30000, 5000, 15000]);
  assert.deepStrictEqual([g.gesamt.projekte.gesamt, g.eigen.vergleich.gesamt, g.fehlend, g.gesamt.widerspruch, g.gesamt.unterschiedlich], [5000, 10000, 1, false, false]);
  /* Plan genauso (Beispiel von Michael): 2.000.000 gesamt, 1.500.000 Unterkostenstelle, 200.000 Projektnummer, 300.000 bleiben */
  D.setzeBudget(d, "2026", "ks", "001", { pkId: 2000000 });
  D.setzeBudget(d, "2026", "ks", "101", { pkId: 1500000 });
  D.setzeBudget(d, "2026", "pn", "20100000", { betrag: 200000 });
  const p = D.gesamtBudgetVon(d, 2026, "ks", "001");
  assert.deepStrictEqual([p.gesamt.gesamt, p.projekte.gesamt, p.eigen.gesamt], [2000000, 200000, 300000]);
  /* Einzelbudget: Positionen ohne Unterkostenstellen, Projektnummern als eigener negativer Teil */
  assert.deepStrictEqual([p.eigen.pkId, p.eigen.projekt], [500000, -200000]);
  assert.strictEqual(D.abteilungsPlan(d, 2026).gesamt.gesamt, 2000000);
  D.setzeIst(d, "102", bericht(25000, "2026-08"), "xv10001");
  g = D.gesamtIstVon(d, 2026, "ks", "001");
  assert.deepStrictEqual([g.eigen.gesamt, g.gesamt.widerspruch, g.gesamt.unterschiedlich], [-10000, true, true]);
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
  D.setzeBudget(d, "2026", "pn", "41000101", { betrag: 3 });
  const gl = D.sicht(d, "xv10002");
  assert.deepStrictEqual(gl.benutzer.map((b) => b.kennung), ["xv10002"]);
  assert.strictEqual(gl.benutzer[0].einmalpasswort, "");
  assert.ok(!("hash" in gl.benutzer[0]));
  assert.deepStrictEqual(gl.kostenstellen, [{ nummer: "411", benutzer: ["xv10002"], unter: [] }]);
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
