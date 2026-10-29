/* Budgetdashboard: Datenmodell, Regeln und Speicher.
   Läuft im Browser (window.BDDaten) und in Node (require) für die Tests.
   Die Regeln gibt es gleich noch einmal in api.ashx (BdKern); beide müssen zusammenpassen. */
(function (wurzel, fabrik) {
  if (typeof module === "object" && module.exports) module.exports = fabrik();
  else wurzel.BDDaten = fabrik();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SCHEMA = 1;
  var STANDARD_TITEL = "Budgetdashboard";
  var STANDARD_ADMIN = "xv00000";
  var STANDARD_PASSWORT = "RuV-Plan#2026!";
  var ITERATIONEN = 100000;

  /* Rollen: Gruppenleitung und Key Account Manager haben die gleichen Rechte, sehen aber
     Kostenstellen (Gruppenleitung) oder Projektnummern (Key Account Manager). */
  var ROLLEN = [
    { id: "admin", name: "Administrator" },
    { id: "al", name: "Abteilungsleitung" },
    { id: "gl", name: "Gruppenleitung" },
    { id: "kam", name: "Key Account Manager" }
  ];

  /* Kostenstellen (3 Ziffern) und Projektnummern (8 Ziffern) */
  var ARTEN = {
    ks: { id: "ks", name: "Kostenstelle", mehrzahl: "Kostenstellen", stellen: 3, rollen: ["al", "gl"] },
    pn: { id: "pn", name: "Projektnummer", mehrzahl: "Projektnummern", stellen: 8, rollen: ["kam"] }
  };

  /* Planbudget: zwei Personalkosten-Positionen und drei Unterpositionen der Sachkosten */
  var POSITIONEN = [
    { id: "pkId", name: "Personalkosten ID" },
    { id: "pkAd", name: "Personalkosten AD" },
    { id: "werbung", name: "Werbung", sach: true },
    { id: "reise", name: "Reise/KfZ", sach: true },
    { id: "sonstiges", name: "Sonstiges", sach: true }
  ];
  var MAX_BETRAG = 999999999.99;

  /* ---------- Hilfen ---------- */

  function jetzt() { return new Date().toISOString(); }

  function kopie(wert) { return JSON.parse(JSON.stringify(wert)); }

  function findeRolle(id) {
    for (var i = 0; i < ROLLEN.length; i++) if (ROLLEN[i].id === id) return ROLLEN[i];
    return null;
  }

  function rollenName(id) { var r = findeRolle(id); return r ? r.name : ""; }

  /* ---------- Kennung und Passwort ---------- */

  function normalisiereKennung(text) { return String(text || "").trim().toLowerCase(); }

  function istGueltigeKennung(text) { return /^xv\d{5}$/.test(normalisiereKennung(text)); }

  /* Häufige Bestandteile, die ein Passwort leicht erraten lassen */
  var GAENGIG = ["passwort", "password", "qwertz", "qwerty", "123456", "abcdef", "willkommen", "budget", "geheim", "admin"];

  var REGELN = ["mindestens 12 Zeichen", "einen Kleinbuchstaben", "einen Großbuchstaben", "eine Ziffer", "ein Sonderzeichen"];

  /* Liefert die nicht erfüllten Regeln; leere Liste heißt: Passwort passt.
     person (optional): {kennung, vorname, nachname}; das Passwort darf diese Angaben nicht enthalten. */
  function passwortMaengel(passwort, person) {
    var p = String(passwort || "");
    var maengel = [];
    if (p.length < 12) maengel.push(REGELN[0]);
    if (!/[a-zäöüß]/.test(p)) maengel.push(REGELN[1]);
    if (!/[A-ZÄÖÜ]/.test(p)) maengel.push(REGELN[2]);
    if (!/[0-9]/.test(p)) maengel.push(REGELN[3]);
    if (!/[^A-Za-z0-9äöüÄÖÜß]/.test(p)) maengel.push(REGELN[4]);
    var klein = p.toLowerCase();
    if (person) {
      var teile = [person.kennung, person.vorname, person.nachname].map(function (t) { return String(t || "").trim().toLowerCase(); });
      if (teile.some(function (t) { return t.length >= 3 && klein.indexOf(t) >= 0; })) maengel.push("nicht Deine XV-Nummer oder Deinen Namen");
    }
    if (GAENGIG.some(function (g) { return klein.indexOf(g) >= 0; })) maengel.push("keine gängigen Wörter oder Zahlenfolgen");
    if (/(.)\1\1\1/.test(p)) maengel.push("kein Zeichen viermal hintereinander");
    if (p.length > 200) maengel.push("höchstens 200 Zeichen");
    return maengel;
  }

  /* Einmalpasswort: 14 Zeichen, ohne leicht verwechselbare Zeichen */
  function einmalpasswort(zufall) {
    var z = zufall || function (n) {
      if (typeof crypto !== "undefined" && crypto.getRandomValues) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
      return Math.floor(Math.random() * n);
    };
    var gross = "ABCDEFGHJKLMNPQRSTUVWXYZ", klein = "abcdefghijkmnpqrstuvwxyz", ziffern = "23456789", zeichen = "#+-!?=%";
    function eins(menge) { return menge[z(menge.length)]; }
    for (var versuch = 0; versuch < 50; versuch++) {
      var teile = [eins(gross), eins(gross), eins(ziffern), eins(ziffern), eins(zeichen), eins(zeichen)];
      for (var i = 0; i < 8; i++) teile.push(eins(klein));
      for (var j = teile.length - 1; j > 0; j--) { var k = z(j + 1); var t = teile[j]; teile[j] = teile[k]; teile[k] = t; }
      var pw = teile.join("");
      if (!passwortMaengel(pw).length) return pw;
    }
    return "Rv-" + Date.now().toString(36) + "#Zq7x";
  }

  function hexAus(puffer) {
    return Array.prototype.map.call(new Uint8Array(puffer), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  function neuesSalz() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return hexAus(bytes.buffer);
  }

  /* PBKDF2-SHA256, 100.000 Runden. Gleiches Verfahren im Server (Rfc2898DeriveBytes). */
  function passwortHash(passwort, salz) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(passwort), "PBKDF2", false, ["deriveBits"])
      .then(function (schluessel) {
        return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salz), iterations: ITERATIONEN }, schluessel, 256);
      })
      .then(hexAus);
  }

  /* einmal: true = Einmalpasswort. Es bleibt bis zur ersten Anmeldung in der Benutzerverwaltung sichtbar. */
  function setzePasswort(benutzer, passwort, einmal) {
    var salz = neuesSalz();
    return passwortHash(passwort, salz).then(function (hash) {
      benutzer.salz = salz;
      benutzer.hash = hash;
      benutzer.mussPasswortAendern = !!einmal;
      benutzer.einmalpasswort = einmal ? passwort : "";
      benutzer.passwortGeaendert = jetzt();
      return benutzer;
    });
  }

  function pruefeAnmeldung(daten, kennung, passwort) {
    var b = findeBenutzer(daten, kennung);
    if (!b) return Promise.resolve(null);
    return passwortHash(passwort, b.salz).then(function (hash) { return hash === b.hash ? b : null; });
  }

  /* ---------- Grunddaten ---------- */

  function leereDaten() {
    return {
      schema: SCHEMA,
      stand: 0,
      einstellungen: { titel: STANDARD_TITEL },
      benutzer: [],
      kostenstellen: [],
      projekte: [],
      budgets: {},
      geaendert: jetzt()
    };
  }

  function neuerBenutzer(kennung, felder) {
    felder = felder || {};
    return {
      kennung: normalisiereKennung(kennung),
      vorname: felder.vorname || "",
      nachname: felder.nachname || "",
      rolle: findeRolle(felder.rolle) ? felder.rolle : "gl",
      salz: "",
      hash: "",
      einmalpasswort: "",
      mussPasswortAendern: true,
      design: "auto",
      farbe: "klassik",
      erstellt: jetzt(),
      letzteAnmeldung: ""
    };
  }

  /* Ergänzt fehlende Felder, damit ältere Stände weiterlaufen. */
  function vervollstaendige(daten) {
    var basis = leereDaten();
    Object.keys(basis).forEach(function (k) { if (daten[k] === undefined) daten[k] = basis[k]; });
    daten.einstellungen = Object.assign({}, basis.einstellungen, daten.einstellungen);
    if (!daten.budgets || typeof daten.budgets !== "object" || Array.isArray(daten.budgets)) daten.budgets = {};
    daten.benutzer.forEach(function (b) {
      var muster = neuerBenutzer(b.kennung);
      Object.keys(muster).forEach(function (k) { if (b[k] === undefined) b[k] = muster[k]; });
    });
    daten.kostenstellen.concat(daten.projekte).forEach(function (n) { if (!Array.isArray(n.benutzer)) n.benutzer = []; });
    return daten;
  }

  function startDaten(demo) {
    var daten = leereDaten();
    if (demo) demo(daten);
    var admin = neuerBenutzer(STANDARD_ADMIN, { vorname: "Admin", nachname: "Budget", rolle: "admin" });
    admin._startPasswort = STANDARD_PASSWORT;
    admin._einmal = false;
    daten.benutzer.unshift(admin);
    return Promise.all(daten.benutzer.filter(function (b) { return b._startPasswort; }).map(function (b) {
      var pw = b._startPasswort, einmal = b._einmal !== false;
      delete b._startPasswort;
      delete b._einmal;
      return setzePasswort(b, pw, einmal);
    })).then(function () { return daten; });
  }

  /* ---------- Benutzer und Rechte ---------- */

  function findeBenutzer(daten, kennung) {
    var k = normalisiereKennung(kennung);
    for (var i = 0; i < daten.benutzer.length; i++) if (daten.benutzer[i].kennung === k) return daten.benutzer[i];
    return null;
  }

  function anzeigeName(b) {
    var name = [b.vorname, b.nachname].filter(Boolean).join(" ");
    return name || b.kennung;
  }

  function anzahlAdmins(daten) { return daten.benutzer.filter(function (b) { return b.rolle === "admin"; }).length; }

  var Rechte = {
    benutzer: function (b) { return !!b && (b.rolle === "admin" || b.rolle === "al"); },
    nummern: function (b) { return !!b && (b.rolle === "admin" || b.rolle === "al"); },
    budgets: function (b) { return !!b && b.rolle === "al"; },
    einstellungen: function (b) { return !!b && b.rolle === "admin"; },
    /* Eigene Kostenstellen oder Projektnummern ansehen: alle außer Admin */
    eigene: function (b) { return !!b && b.rolle !== "admin"; }
  };

  /* Die Abteilungsleitung verwaltet alle Konten außer den Administratoren. */
  function darfKontoVerwalten(ich, ziel) {
    if (!Rechte.benutzer(ich)) return false;
    if (ich.rolle === "admin") return true;
    return !ziel || ziel.rolle !== "admin";
  }

  function erlaubteRollen(ich) {
    if (!Rechte.benutzer(ich)) return [];
    return ROLLEN.filter(function (r) { return ich.rolle === "admin" || r.id !== "admin"; });
  }

  /* Prüft Angaben für ein neues oder geändertes Konto. ziel: bestehendes Konto oder null. Liefert Fehlertext oder "". */
  function pruefeBenutzer(daten, ich, ziel, felder) {
    if (!Rechte.benutzer(ich)) return "Dafür fehlen Dir die Rechte.";
    if (!ziel) {
      if (!istGueltigeKennung(felder.kennung)) return "Die XV-Nummer besteht aus „xv“ und fünf Ziffern, zum Beispiel xv12345.";
      if (findeBenutzer(daten, felder.kennung)) return "Die XV-Nummer " + normalisiereKennung(felder.kennung) + " gibt es schon.";
    }
    if (!String(felder.vorname || "").trim() || !String(felder.nachname || "").trim()) return "Gib bitte Vor- und Nachnamen ein.";
    if (String(felder.vorname).trim().length > 40 || String(felder.nachname).trim().length > 40) return "Vor- und Nachname haben höchstens 40 Zeichen.";
    if (!findeRolle(felder.rolle)) return "Wähle bitte eine Rolle.";
    if (!darfKontoVerwalten(ich, ziel) || (felder.rolle === "admin" && ich.rolle !== "admin")) return "Administratoren verwaltet nur ein Administrator.";
    if (ziel && ziel.rolle === "admin" && felder.rolle !== "admin") {
      if (ziel.kennung === ich.kennung) return "Du kannst Dir die Rolle Administrator nicht selbst nehmen.";
      if (anzahlAdmins(daten) <= 1) return "Es muss mindestens ein Administrator bleiben.";
    }
    return "";
  }

  function pruefeLoeschen(daten, ich, ziel) {
    if (!ziel) return "Diesen Benutzer gibt es nicht mehr.";
    if (!darfKontoVerwalten(ich, ziel)) return "Administratoren verwaltet nur ein Administrator.";
    if (ziel.kennung === ich.kennung) return "Du kannst Dein eigenes Konto nicht löschen.";
    if (ziel.rolle === "admin" && anzahlAdmins(daten) <= 1) return "Es muss mindestens ein Administrator bleiben.";
    return "";
  }

  function loescheBenutzer(daten, kennung) {
    var k = normalisiereKennung(kennung);
    daten.benutzer = daten.benutzer.filter(function (b) { return b.kennung !== k; });
    daten.kostenstellen.concat(daten.projekte).forEach(function (n) { n.benutzer = n.benutzer.filter(function (x) { return x !== k; }); });
  }

  /* ---------- Kostenstellen und Projektnummern ---------- */

  function liste(daten, art) { return art === "pn" ? daten.projekte : daten.kostenstellen; }

  function istGueltigeNummer(art, nummer) {
    var a = ARTEN[art];
    return !!a && new RegExp("^\\d{" + a.stellen + "}$").test(String(nummer || ""));
  }

  function findeNummer(daten, art, nummer) {
    var l = liste(daten, art) || [];
    for (var i = 0; i < l.length; i++) if (l[i].nummer === nummer) return l[i];
    return null;
  }

  function sortiereNummern(l) { l.sort(function (a, b) { return a.nummer < b.nummer ? -1 : a.nummer > b.nummer ? 1 : 0; }); }

  /* Wer darf einer Kostenstelle oder Projektnummer zugewiesen werden? */
  function passtZurArt(b, art) { return !!b && ARTEN[art].rollen.indexOf(b.rolle) >= 0; }

  /* Legt eine Nummer an oder ändert sie. alt: bisherige Nummer ("" für neu). kennungen: zugewiesene Benutzer.
     Eine geänderte Nummer nimmt ihre Planbudgets mit. Liefert Fehlertext oder "". */
  function speichereNummer(daten, art, alt, nummer, kennungen) {
    var a = ARTEN[art];
    if (!a) return "Unbekannte Art.";
    nummer = String(nummer || "").trim();
    if (!istGueltigeNummer(art, nummer)) return "Eine " + a.name + " besteht aus genau " + a.stellen + " Ziffern.";
    var eintrag = alt ? findeNummer(daten, art, alt) : null;
    if (alt && !eintrag) return "Die " + a.name + " " + alt + " gibt es nicht mehr.";
    if (nummer !== alt && findeNummer(daten, art, nummer)) return "Die " + a.name + " " + nummer + " gibt es schon.";
    var zugewiesen = [];
    (kennungen || []).forEach(function (k) {
      var b = findeBenutzer(daten, k);
      if (passtZurArt(b, art) && zugewiesen.indexOf(b.kennung) < 0) zugewiesen.push(b.kennung);
    });
    zugewiesen.sort();
    if (!eintrag) { eintrag = { nummer: nummer, benutzer: [] }; liste(daten, art).push(eintrag); }
    if (alt && nummer !== alt) {
      Object.keys(daten.budgets).forEach(function (jahr) {
        var j = daten.budgets[jahr];
        if (j[art + "-" + alt]) { j[art + "-" + nummer] = j[art + "-" + alt]; delete j[art + "-" + alt]; }
      });
    }
    eintrag.nummer = nummer;
    eintrag.benutzer = zugewiesen;
    sortiereNummern(liste(daten, art));
    return "";
  }

  /* Löscht eine Nummer samt ihrer Planbudgets */
  function loescheNummer(daten, art, nummer) {
    if (art === "pn") daten.projekte = daten.projekte.filter(function (n) { return n.nummer !== nummer; });
    else daten.kostenstellen = daten.kostenstellen.filter(function (n) { return n.nummer !== nummer; });
    Object.keys(daten.budgets).forEach(function (jahr) {
      delete daten.budgets[jahr][art + "-" + nummer];
      if (!Object.keys(daten.budgets[jahr]).length) delete daten.budgets[jahr];
    });
  }

  /* Nummern eines Benutzers, aufsteigend */
  function nummernVon(daten, kennung, art) {
    var k = normalisiereKennung(kennung);
    return (liste(daten, art) || []).filter(function (n) { return n.benutzer.indexOf(k) >= 0; }).map(function (n) { return n.nummer; });
  }

  /* Setzt die Zuweisungen eines Benutzers neu. Nummern, die nicht zur Rolle passen, fallen weg. */
  function setzeNummernFuer(daten, kennung, nummern) {
    var b = findeBenutzer(daten, kennung);
    if (!b) return;
    ["ks", "pn"].forEach(function (art) {
      liste(daten, art).forEach(function (n) {
        var soll = passtZurArt(b, art) && (nummern[art] || []).indexOf(n.nummer) >= 0;
        var i = n.benutzer.indexOf(b.kennung);
        if (soll && i < 0) { n.benutzer.push(b.kennung); n.benutzer.sort(); }
        if (!soll && i >= 0) n.benutzer.splice(i, 1);
      });
    });
  }

  /* ---------- Planbudgets ---------- */

  /* Liest einen Betrag wie 1.234,56 oder 1234.5; leer = 0. Liefert null bei ungültiger Eingabe. */
  function leseBetrag(text) {
    if (typeof text === "number") return isFinite(text) && text >= 0 && text <= MAX_BETRAG ? Math.round(text * 100) / 100 : null;
    var t = String(text == null ? "" : text).replace(/\s|€|EUR/gi, "");
    if (!t) return 0;
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t) || /^\d+(,\d{1,2})?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    var z = Number(t);
    if (!isFinite(z) || z < 0 || z > MAX_BETRAG) return null;
    return Math.round(z * 100) / 100;
  }

  function betragText(zahl) {
    return (Number(zahl) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  function istJahr(jahr) { return /^(20[0-9]{2})$/.test(String(jahr)); }

  /* Planbudget einer Nummer in einem Jahr, mit Sachkosten und Gesamtbudget; fehlt es, sind alle Werte 0. */
  function budgetVon(daten, jahr, art, nummer) {
    var j = daten.budgets[String(jahr)] || {};
    var w = j[art + "-" + nummer] || null;
    var aus = { vorhanden: !!w };
    POSITIONEN.forEach(function (p) { aus[p.id] = w ? Number(w[p.id]) || 0 : 0; });
    aus.sachkosten = runde(aus.werbung + aus.reise + aus.sonstiges);
    aus.personalkosten = runde(aus.pkId + aus.pkAd);
    aus.gesamt = runde(aus.personalkosten + aus.sachkosten);
    return aus;
  }

  function runde(z) { return Math.round(z * 100) / 100; }

  /* werte: {pkId, pkAd, werbung, reise, sonstiges} als Zahl oder Text. Liefert Fehlertext oder "". */
  function setzeBudget(daten, jahr, art, nummer, werte) {
    if (!istJahr(jahr)) return "Wähle bitte ein Kalenderjahr.";
    if (!findeNummer(daten, art, nummer)) return "Die " + (ARTEN[art] ? ARTEN[art].name : "Nummer") + " " + nummer + " gibt es nicht mehr.";
    var neu = {};
    for (var i = 0; i < POSITIONEN.length; i++) {
      var z = leseBetrag(werte[POSITIONEN[i].id]);
      if (z === null) return "Prüfe bitte den Betrag bei „" + POSITIONEN[i].name + "“. Erlaubt sind Beträge ab 0 €, zum Beispiel 12.500,00.";
      neu[POSITIONEN[i].id] = z;
    }
    var j = daten.budgets[String(jahr)] || (daten.budgets[String(jahr)] = {});
    j[art + "-" + nummer] = neu;
    return "";
  }

  /* Summe über mehrere Planbudgets */
  function summe(budgets) {
    var s = { pkId: 0, pkAd: 0, werbung: 0, reise: 0, sonstiges: 0, sachkosten: 0, personalkosten: 0, gesamt: 0 };
    budgets.forEach(function (b) { Object.keys(s).forEach(function (k) { s[k] = runde(s[k] + (b[k] || 0)); }); });
    return s;
  }

  /* Kalenderjahre zur Auswahl: Vorjahr bis übernächstes Jahr und alle Jahre mit Planbudgets, absteigend */
  function jahre(daten, heute) {
    var j = (heute || new Date()).getFullYear();
    var menge = {};
    [j - 1, j, j + 1, j + 2].forEach(function (x) { menge[x] = 1; });
    Object.keys(daten.budgets || {}).forEach(function (x) { if (istJahr(x)) menge[x] = 1; });
    return Object.keys(menge).map(Number).sort(function (a, b) { return b - a; });
  }

  /* ---------- Begrüßung ---------- */

  function begruessung(datum) {
    var h = (datum || new Date()).getHours();
    if (h >= 5 && h < 11) return "Guten Morgen";
    if (h >= 11 && h < 18) return "Guten Tag";
    if (h >= 18 && h < 23) return "Guten Abend";
    return "Hallo";
  }

  /* ---------- Sicht je Rolle (gleiche Regeln wie BdKern.Sicht in api.ashx) ---------- */

  /* Gruppenleitung und Key Account Manager sehen nur sich selbst, ihre Nummern und deren Planbudgets.
     Admins sehen keine Planbudgets. Hash und Salz sind nie dabei, Einmalpasswörter nur für die Benutzerverwaltung. */
  function sicht(daten, kennung) {
    var ich = findeBenutzer(daten, kennung);
    var d = { schema: daten.schema, stand: daten.stand, einstellungen: kopie(daten.einstellungen), geaendert: daten.geaendert };
    var verwaltet = Rechte.benutzer(ich);
    d.benutzer = daten.benutzer.filter(function (b) { return verwaltet || b.kennung === ich.kennung; }).map(function (b) {
      var k = {};
      Object.keys(b).forEach(function (f) { if (f !== "hash" && f !== "salz") k[f] = b[f]; });
      if (!verwaltet) k.einmalpasswort = "";
      return k;
    });
    function nummern(l) {
      return l.filter(function (n) { return Rechte.nummern(ich) || n.benutzer.indexOf(ich.kennung) >= 0; })
        .map(function (n) { return { nummer: n.nummer, benutzer: Rechte.nummern(ich) ? n.benutzer.slice() : [ich.kennung] }; });
    }
    d.kostenstellen = nummern(daten.kostenstellen);
    d.projekte = nummern(daten.projekte);
    d.budgets = {};
    if (ich.rolle !== "admin") {
      var erlaubt = {};
      if (ich.rolle === "al") Object.keys(daten.budgets).forEach(function (j) { Object.keys(daten.budgets[j]).forEach(function (s) { erlaubt[s] = 1; }); });
      else {
        d.kostenstellen.forEach(function (n) { erlaubt["ks-" + n.nummer] = 1; });
        d.projekte.forEach(function (n) { erlaubt["pn-" + n.nummer] = 1; });
      }
      Object.keys(daten.budgets).forEach(function (j) {
        Object.keys(daten.budgets[j]).forEach(function (s) {
          if (!erlaubt[s]) return;
          (d.budgets[j] || (d.budgets[j] = {}))[s] = kopie(daten.budgets[j][s]);
        });
      });
    }
    return d;
  }

  /* ---------- Speicher ---------- */

  var SCHLUESSEL = "budgetdashboard-daten";

  function lokalerSpeicher() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  var Speicher = {
    laden: function () {
      var ls = lokalerSpeicher();
      if (!ls) return Promise.resolve(null);
      try {
        var text = ls.getItem(SCHLUESSEL);
        return Promise.resolve(text ? vervollstaendige(JSON.parse(text)) : null);
      } catch (e) {
        return Promise.resolve(null);
      }
    },
    speichern: function (daten) {
      daten.geaendert = jetzt();
      var ls = lokalerSpeicher();
      if (!ls) return Promise.reject(new Error("Dein Browser speichert gerade keine Daten."));
      try {
        ls.setItem(SCHLUESSEL, JSON.stringify(daten));
        return Promise.resolve(daten);
      } catch (e) {
        return Promise.reject(new Error("Der Speicher im Browser ist voll."));
      }
    }
  };

  return {
    SCHEMA: SCHEMA,
    STANDARD_TITEL: STANDARD_TITEL,
    STANDARD_ADMIN: STANDARD_ADMIN,
    STANDARD_PASSWORT: STANDARD_PASSWORT,
    ROLLEN: ROLLEN,
    ARTEN: ARTEN,
    POSITIONEN: POSITIONEN,
    REGELN: REGELN,
    kopie: kopie,
    findeRolle: findeRolle,
    rollenName: rollenName,
    normalisiereKennung: normalisiereKennung,
    istGueltigeKennung: istGueltigeKennung,
    passwortMaengel: passwortMaengel,
    einmalpasswort: einmalpasswort,
    passwortHash: passwortHash,
    setzePasswort: setzePasswort,
    pruefeAnmeldung: pruefeAnmeldung,
    leereDaten: leereDaten,
    neuerBenutzer: neuerBenutzer,
    vervollstaendige: vervollstaendige,
    startDaten: startDaten,
    findeBenutzer: findeBenutzer,
    anzeigeName: anzeigeName,
    anzahlAdmins: anzahlAdmins,
    Rechte: Rechte,
    darfKontoVerwalten: darfKontoVerwalten,
    erlaubteRollen: erlaubteRollen,
    pruefeBenutzer: pruefeBenutzer,
    pruefeLoeschen: pruefeLoeschen,
    loescheBenutzer: loescheBenutzer,
    liste: liste,
    istGueltigeNummer: istGueltigeNummer,
    findeNummer: findeNummer,
    passtZurArt: passtZurArt,
    speichereNummer: speichereNummer,
    loescheNummer: loescheNummer,
    nummernVon: nummernVon,
    setzeNummernFuer: setzeNummernFuer,
    leseBetrag: leseBetrag,
    betragText: betragText,
    istJahr: istJahr,
    budgetVon: budgetVon,
    setzeBudget: setzeBudget,
    summe: summe,
    jahre: jahre,
    begruessung: begruessung,
    sicht: sicht,
    Speicher: Speicher
  };
});
