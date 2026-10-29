/* Budgetdashboard: Beispieldaten für den Browserbetrieb (Artefakt, Demo). Alle Namen sind erfunden.
   Testzugänge: xv00000 (Administrator), xv10001 (Abteilungsleitung), xv10002 und xv10003 (Gruppenleitung),
   xv10004 (Key Account Manager), alle mit dem Passwort RuV-Plan#2026!. xv10005 hat noch ein Einmalpasswort. */
(function (wurzel) {
  "use strict";
  var PASSWORT = "RuV-Plan#2026!";

  function person(kennung, vorname, nachname, rolle, einmal) {
    return {
      kennung: kennung, vorname: vorname, nachname: nachname, rolle: rolle, salz: "", hash: "", einmalpasswort: "",
      mussPasswortAendern: !!einmal, design: "auto", farbe: "klassik", erstellt: new Date().toISOString(), letzteAnmeldung: "",
      _startPasswort: einmal || PASSWORT, _einmal: !!einmal
    };
  }

  function werte(pkId, pkAd, werbung, reise, sonstiges) {
    return { pkId: pkId, pkAd: pkAd, werbung: werbung, reise: reise, sonstiges: sonstiges };
  }

  /* Erfundene IST-Werte: Plan je Position mal Faktor, anteilig bis zum Vormonat */
  function istAus(plan, faktor, anteil) {
    var w = {};
    Object.keys(plan).forEach(function (k, i) { w[k] = Math.round(plan[k] * faktor * anteil * (0.94 + (i % 3) * 0.05) * 100) / 100; });
    return w;
  }

  function fuelle(daten) {
    var jahr = new Date().getFullYear();
    daten.benutzer.push(
      person("xv10001", "Sabine", "Hofmann", "al"),
      person("xv10002", "Thomas", "Becker", "gl"),
      person("xv10003", "Julia", "Wagner", "gl"),
      person("xv10004", "Daniel", "Schulz", "kam"),
      person("xv10005", "Laura", "Fischer", "kam", "Kq7#mPz2-wHte")
    );
    daten.kostenstellen = [
      { nummer: "410", benutzer: ["xv10001"], unter: ["411", "412"] },
      { nummer: "411", benutzer: ["xv10002"], unter: [] },
      { nummer: "412", benutzer: ["xv10002", "xv10003"], unter: [] },
      { nummer: "413", benutzer: [], unter: [] }
    ];
    daten.projekte = [
      { nummer: "41000101", benutzer: ["xv10004"], ks: "410" },
      { nummer: "41000102", benutzer: ["xv10004", "xv10005"], ks: "410" },
      { nummer: "41000103", benutzer: [], ks: "" }
    ];
    daten.budgets[String(jahr)] = {
      "ks-410": werte(124000, 0, 18000, 14500, 9800),
      "ks-411": werte(286500, 154000, 12000, 31000, 6500),
      "ks-412": werte(198000, 212500, 8500, 42000, 11200),
      "pn-41000101": werte(64000, 38000, 22000, 15500, 4000),
      "pn-41000102": werte(52000, 61000, 9000, 18000, 2500)
    };
    daten.budgets[String(jahr - 1)] = {
      "ks-410": werte(118000, 0, 16500, 13000, 9000),
      "ks-411": werte(275000, 149000, 11000, 29500, 6000),
      "ks-412": werte(190000, 205000, 8000, 39000, 10500),
      "pn-41000101": werte(60000, 35000, 20000, 14000, 3500)
    };
    /* Erfundene Projektkosten, manuell erfasst */
    var tag = function (monat, t) { return jahr + "-" + ("0" + monat).slice(-2) + "-" + ("0" + t).slice(-2); };
    var bisMonat = Math.max(1, new Date().getMonth() + 1);
    daten.kosten = [
      ["41000101", 1, 20, "werbung", 4800, "Messestand Frühjahr"], ["41000101", 2, 14, "reise", 2350.4, "Roadshow Nord"],
      ["41000101", 4, 8, "pkAd", 12000, "Einsatz Außendienst-Trainer"], ["41000101", 6, 3, "sonstiges", 980, "Seminarunterlagen"],
      ["41000102", 3, 11, "werbung", 6200, "Kampagne Vertriebsstart"], ["41000102", 5, 22, "reise", 3140.75, "Workshops Regionen"],
      ["41000102", 7, 1, "pkId", 15500, "Projektleitung Innendienst"]
    ].filter(function (x) { return x[1] <= bisMonat; }).map(function (x, i) {
      return { id: "kdemo" + i, pn: x[0], datum: tag(x[1], x[2]), kostenart: x[3], betrag: x[4], text: x[5], erfasst: new Date().toISOString(), von: "xv10001", geaendert: new Date().toISOString(), geaendertVon: "xv10001" };
    });
    var heute = new Date(), m = heute.getMonth(), istJahr = m === 0 ? jahr - 1 : jahr, monat = m === 0 ? 12 : m;
    var stand = new Date(heute.getTime() - 3 * 864e5).toISOString().slice(0, 10);
    daten.ist = {};
    [["410", 0.97, 1.0], ["411", 0.91, 0.96], ["412", 1.09, 1.04]].forEach(function (x) {
      var plan = daten.budgets[String(istJahr)] && daten.budgets[String(istJahr)]["ks-" + x[0]];
      var vorPlan = daten.budgets[String(istJahr - 1)] && daten.budgets[String(istJahr - 1)]["ks-" + x[0]];
      if (!plan || !vorPlan) return;
      daten.ist["ks-" + x[0]] = {
        stand: stand, monat: istJahr + "-" + ("0" + monat).slice(-2),
        aktuell: { jahr: istJahr, werte: istAus(plan, x[1], monat / 12) },
        vorjahrZeitraum: { jahr: istJahr - 1, werte: istAus(vorPlan, x[2], monat / 12) },
        vorjahr: { jahr: istJahr - 1, werte: istAus(vorPlan, x[2], 1) },
        datei: "KST-Bericht " + x[0] + " (Beispiel).xlsx", importiert: new Date().toISOString(), von: "xv10001"
      };
    });
    /* Der KST-Bericht der übergreifenden 410 enthält schon 411, 412 und die Projektkosten auf 410 */
    var oben = daten.ist["ks-410"];
    if (oben) {
      ["411", "412"].forEach(function (u) {
        var e = daten.ist["ks-" + u];
        if (!e) return;
        ["aktuell", "vorjahrZeitraum", "vorjahr"].forEach(function (t) {
          Object.keys(e[t].werte).forEach(function (k) { oben[t].werte[k] = Math.round((oben[t].werte[k] + e[t].werte[k]) * 100) / 100; });
        });
      });
      daten.kosten.forEach(function (x) {
        if (x.datum.slice(0, 4) !== String(istJahr) || Number(x.datum.slice(5, 7)) > monat) return;
        oben.aktuell.werte[x.kostenart] = Math.round((oben.aktuell.werte[x.kostenart] + x.betrag) * 100) / 100;
      });
    }
    /* Bei der übergreifenden 410 steht das Gesamtplanbudget inklusive 411, 412 und ihrer Projektnummern */
    Object.keys(daten.budgets).forEach(function (j) {
      var b = daten.budgets[j];
      if (!b["ks-410"]) return;
      ["ks-411", "ks-412", "pn-41000101", "pn-41000102"].forEach(function (u) { if (b[u]) Object.keys(b[u]).forEach(function (k) { b["ks-410"][k] += b[u][k]; }); });
    });
  }

  wurzel.BDDemo = { fuelle: fuelle, PASSWORT: PASSWORT };
})(typeof self !== "undefined" ? self : this);
