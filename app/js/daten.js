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
      ist: {},
      istSicherungen: [],
      kosten: [],
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
    if (!daten.ist || typeof daten.ist !== "object" || Array.isArray(daten.ist)) daten.ist = {};
    if (!Array.isArray(daten.istSicherungen)) daten.istSicherungen = [];
    if (!Array.isArray(daten.kosten)) daten.kosten = [];
    daten.projekte.forEach(function (n) { if (typeof n.ks !== "string") n.ks = ""; });
    daten.benutzer.forEach(function (b) {
      var muster = neuerBenutzer(b.kennung);
      Object.keys(muster).forEach(function (k) { if (b[k] === undefined) b[k] = muster[k]; });
    });
    daten.kostenstellen.concat(daten.projekte).forEach(function (n) { if (!Array.isArray(n.benutzer)) n.benutzer = []; });
    daten.kostenstellen.forEach(function (n) { if (!Array.isArray(n.unter)) n.unter = []; });
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

  /* Übergreifende Kostenstelle: fasst die Kostenstellen in „unter“ zusammen und hat zusätzlich ein eigenes Planbudget.
     Nur eine Ebene: Eine zugeordnete Kostenstelle ist selbst nicht übergreifend und gehört zu genau einer übergreifenden. */
  function uebergeordnete(daten, nummer) {
    for (var i = 0; i < daten.kostenstellen.length; i++) if ((daten.kostenstellen[i].unter || []).indexOf(nummer) >= 0) return daten.kostenstellen[i].nummer;
    return "";
  }

  /* Prüft die zugeordneten Kostenstellen für die Kostenstelle nummer (bisher alt). Liefert Fehlertext oder "". */
  function pruefeUnter(daten, alt, nummer, unter) {
    if (!unter.length) return "";
    var oben = alt ? uebergeordnete(daten, alt) : "";
    if (oben) return "Die Kostenstelle " + (alt || nummer) + " gehört schon zur übergreifenden Kostenstelle " + oben + " und kann deshalb keine Kostenstellen zusammenfassen.";
    for (var i = 0; i < unter.length; i++) {
      var u = unter[i], e = findeNummer(daten, "ks", u);
      if (u === nummer || u === alt) return "Eine Kostenstelle kann sich nicht selbst zugeordnet werden.";
      if (!e) return "Die Kostenstelle " + u + " gibt es nicht.";
      if ((e.unter || []).length) return "Die Kostenstelle " + u + " ist selbst übergreifend und kann nicht zugeordnet werden.";
      var andere = uebergeordnete(daten, u);
      if (andere && andere !== alt) return "Die Kostenstelle " + u + " gehört schon zur übergreifenden Kostenstelle " + andere + ".";
    }
    return "";
  }

  /* Legt eine Nummer an oder ändert sie. alt: bisherige Nummer ("" für neu). kennungen: zugewiesene Benutzer.
     unter: bei Kostenstellen die zugeordneten Kostenstellen, bei Projektnummern die Kostenstelle, von der die Projektkosten
     abgehen (Text); fehlt es, bleibt die Zuordnung.
     Eine geänderte Nummer nimmt ihre Planbudgets und Zuordnungen mit. Liefert Fehlertext oder "". */
  function speichereNummer(daten, art, alt, nummer, kennungen, unter) {
    var a = ARTEN[art];
    if (!a) return "Unbekannte Art.";
    nummer = String(nummer || "").trim();
    if (!istGueltigeNummer(art, nummer)) return "Eine " + a.name + " besteht aus genau " + a.stellen + " Ziffern.";
    var eintrag = alt ? findeNummer(daten, art, alt) : null;
    if (alt && !eintrag) return "Die " + a.name + " " + alt + " gibt es nicht mehr.";
    if (nummer !== alt && findeNummer(daten, art, nummer)) return "Die " + a.name + " " + nummer + " gibt es schon.";
    var neuUnter = null;
    if (art === "ks" && Array.isArray(unter)) {
      neuUnter = [];
      unter.forEach(function (u) { u = String(u || "").trim(); if (u && neuUnter.indexOf(u) < 0) neuUnter.push(u); });
      neuUnter.sort();
      var fehler = pruefeUnter(daten, alt, nummer, neuUnter);
      if (fehler) return fehler;
    }
    var neuKs = null;
    if (art === "pn" && typeof unter === "string") {
      neuKs = unter.trim();
      if (neuKs && !findeNummer(daten, "ks", neuKs)) return "Die Kostenstelle " + neuKs + " gibt es nicht.";
    }
    var zugewiesen = [];
    (kennungen || []).forEach(function (k) {
      var b = findeBenutzer(daten, k);
      if (passtZurArt(b, art) && zugewiesen.indexOf(b.kennung) < 0) zugewiesen.push(b.kennung);
    });
    zugewiesen.sort();
    if (!eintrag) { eintrag = art === "ks" ? { nummer: nummer, benutzer: [], unter: [] } : { nummer: nummer, benutzer: [], ks: "" }; liste(daten, art).push(eintrag); }
    if (alt && nummer !== alt) {
      Object.keys(daten.budgets).forEach(function (jahr) {
        var j = daten.budgets[jahr];
        if (j[art + "-" + alt]) { j[art + "-" + nummer] = j[art + "-" + alt]; delete j[art + "-" + alt]; }
      });
      if (art === "ks") {
        daten.kostenstellen.forEach(function (n) {
          var i = (n.unter || []).indexOf(alt);
          if (i >= 0) { n.unter[i] = nummer; n.unter.sort(); }
        });
        if (daten.ist["ks-" + alt]) { daten.ist["ks-" + nummer] = daten.ist["ks-" + alt]; delete daten.ist["ks-" + alt]; }
        daten.istSicherungen.forEach(function (x) { if (x.nummer === alt) x.nummer = nummer; });
        daten.projekte.forEach(function (n) { if (n.ks === alt) n.ks = nummer; });
      } else daten.kosten.forEach(function (x) { if (x.pn === alt) x.pn = nummer; });
    }
    eintrag.nummer = nummer;
    eintrag.benutzer = zugewiesen;
    if (neuUnter) eintrag.unter = neuUnter;
    if (neuKs !== null) eintrag.ks = neuKs;
    sortiereNummern(liste(daten, art));
    return "";
  }

  /* Löscht eine Nummer samt ihrer Planbudgets */
  function loescheNummer(daten, art, nummer) {
    if (art === "pn") {
      daten.projekte = daten.projekte.filter(function (n) { return n.nummer !== nummer; });
      daten.kosten = daten.kosten.filter(function (x) { return x.pn !== nummer; });
    } else {
      daten.projekte.forEach(function (n) { if (n.ks === nummer) n.ks = ""; });
      daten.kostenstellen = daten.kostenstellen.filter(function (n) { return n.nummer !== nummer; });
      daten.kostenstellen.forEach(function (n) { n.unter = (n.unter || []).filter(function (u) { return u !== nummer; }); });
      delete daten.ist["ks-" + nummer];
      daten.istSicherungen = daten.istSicherungen.filter(function (x) { return x.nummer !== nummer; });
    }
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

  /* Planbudget einer übergreifenden Kostenstelle: eigenes Budget plus die Planbudgets der zugeordneten Kostenstellen.
     Bei anderen Nummern ist gesamt gleich eigen. */
  /* Planbudget einer Kostenstelle: Eingetragen wird immer das Gesamtbudget. Es enthält die zugeordneten Kostenstellen und die
     Projektnummern dieser Kostenstelle. eigen = Rest, der auf der Kostenstelle selbst liegt; projekte = Plan ihrer Projektnummern.
     Ohne Eintrag bei einer übergreifenden gilt die Summe der zugeordneten (ohneEigenenEintrag). */
  function gesamtBudgetVon(daten, jahr, art, nummer) {
    var eingetragen = budgetVon(daten, jahr, art, nummer);
    if (art !== "ks") return { uebergreifend: false, eigen: eingetragen, unter: [], gesamt: eingetragen, eingetragen: eingetragen, projekte: summe([]), projektNummern: [] };
    var e = findeNummer(daten, "ks", nummer);
    var unter = (e && e.unter || []).map(function (u) { return { nummer: u, budget: budgetVon(daten, jahr, "ks", u) }; });
    var pns = (daten.projekte || []).filter(function (n) { return n.ks === nummer; });
    var projekte = summe(pns.map(function (n) { return budgetVon(daten, jahr, "pn", n.nummer); }));
    var abzug = summe(unter.map(function (u) { return u.budget; }).concat([projekte]));
    var gesamt, eigen;
    if (eingetragen.vorhanden || !unter.length) {
      gesamt = eingetragen;
      eigen = differenz(eingetragen, abzug);
      eigen.vorhanden = eingetragen.vorhanden;
      gesamt.widerspruch = eingetragen.vorhanden && eigen.gesamt < 0;
    } else {
      gesamt = abzug;
      gesamt.vorhanden = unter.some(function (u) { return u.budget.vorhanden; });
      gesamt.ohneEigenenEintrag = true;
      eigen = eingetragen;
    }
    return { uebergreifend: unter.length > 0, eigen: eigen, unter: unter, gesamt: gesamt, eingetragen: eingetragen, projekte: projekte, projektNummern: pns.map(function (n) { return n.nummer; }) };
  }

  /* Abteilungsbudget: oberste Kostenstellen mit ihrem Gesamtbudget plus Projektnummern ohne Kostenstelle */
  function abteilungsPlan(daten, jahr) {
    var ks = (daten.kostenstellen || []).filter(function (n) { return !uebergeordnete(daten, n.nummer); })
      .map(function (n) { return gesamtBudgetVon(daten, jahr, "ks", n.nummer).gesamt; });
    var frei = (daten.projekte || []).filter(function (n) { return !n.ks || !findeNummer(daten, "ks", n.ks); })
      .map(function (n) { return budgetVon(daten, jahr, "pn", n.nummer); });
    var k = summe(ks), p = summe(frei);
    return { kostenstellen: k, projekteOhneKs: p, gesamt: summe([k, p]) };
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

  /* ---------- IST-Daten (Import aus dem KST-Bericht, je Kostenstelle) ---------- */

  var MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  var MAX_SICHERUNGEN = 30;

  function zahl(text) {
    var t = String(text == null ? "" : text).trim();
    if (!t) return 0;
    var z = Number(t);
    return isFinite(z) ? runde(z) : null;
  }

  /* Deutet einen KST-Bericht (Zeilen wie von BDExcel: zeilen[zeile][spalte] als Text).
     Kostenstelle aus „KST163000“ (Stellen 2 bis 4), Datenstand und Abrechnungsmonat aus dem Kopf,
     IST-Spalten über „Ist“ / Jahr / „Dezember (kum)“ oder „aktMon (kum vt)“, Zeilen über die Bezeichnung in Spalte A.
     Liefert { fehler } oder { kst, stand, monat, aktuell, vorjahrZeitraum, vorjahr, warnungen }. */
  function istAuslesen(zeilen) {
    zeilen = zeilen || [];
    var kst = "", stand = "", monat = "";
    zeilen.forEach(function (z) {
      (z || []).forEach(function (w) {
        var t = String(w == null ? "" : w), m;
        if (!kst && (m = /KST\s*\d(\d{3})\d{2}(?!\d)/i.exec(t))) kst = m[1];
        if (!stand && (m = /Datenstand:?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i.exec(t))) stand = m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
        if (!monat && (m = /Abrechnungsmonat:?\s*(\d{1,2})\.(\d{4})/i.exec(t))) monat = m[2] + "-" + ("0" + m[1]).slice(-2);
      });
    });
    if (!kst) return { fehler: "In der Datei steht keine Kostenstelle (zum Beispiel KST163000 in Zelle B9)." };
    if (!stand) return { fehler: "In der Datei fehlt der Datenstand (zum Beispiel „Datenstand: 22.10.2026“)." };
    if (!monat) return { fehler: "In der Datei fehlt der Abrechnungsmonat (zum Beispiel „Abrechnungsmonat: 09.2026“)." };
    var spalten = [];
    for (var r = 0; r < zeilen.length - 3 && !spalten.length; r++) {
      (zeilen[r] || []).forEach(function (w, c) {
        if (String(w).trim() !== "Ist") return;
        var jahr = /(\d{4})/.exec(String((zeilen[r + 2] || [])[c] || "")), art = String((zeilen[r + 3] || [])[c] || "");
        if (!jahr) return;
        if (/Dezember/i.test(art)) spalten.push({ c: c, jahr: Number(jahr[1]), voll: true });
        else if (/aktMon/i.test(art)) spalten.push({ c: c, jahr: Number(jahr[1]), voll: false });
      });
    }
    var bis = spalten.filter(function (s) { return !s.voll; }).sort(function (a, b) { return b.jahr - a.jahr; });
    if (!bis.length) return { fehler: "In der Datei fehlt die Spalte mit dem IST des aktuellen Jahres („Ist“, Jahr, „aktMon (kum vt)“)." };
    var aktJahr = bis[0].jahr;
    if (Number(monat.slice(0, 4)) !== aktJahr) return { fehler: "Abrechnungsmonat " + monat.slice(5) + "." + monat.slice(0, 4) + " passt nicht zum IST-Jahr " + aktJahr + "." };
    function zeileVon(muster) {
      for (var i = 0; i < zeilen.length; i++) if (zeilen[i] && muster.test(String(zeilen[i][0] || "").trim())) return i;
      return -1;
    }
    var z = {
      pkAd: zeileVon(/^Personalkosten A{1,2}D\b/i), pkId: zeileVon(/^Personalkosten ID\b/i), sach: zeileVon(/^Sachkosten\b/i),
      werbung: zeileVon(/^Werbung/i), reise: zeileVon(/^Reise/i), primaer: zeileVon(/^Primärkosten I\b/i)
    };
    var fehlt = Object.keys(z).filter(function (k) { return z[k] < 0; });
    if (fehlt.length) return { fehler: "In der Datei fehlen Zeilen: " + fehlt.map(function (k) { return { pkAd: "Personalkosten AD", pkId: "Personalkosten ID", sach: "Sachkosten", werbung: "Werbung", reise: "Reise/Kfz", primaer: "Primärkosten I" }[k]; }).join(", ") + "." };
    if (!(z.sach < z.werbung && z.werbung < z.primaer && z.sach < z.reise && z.reise < z.primaer)) return { fehler: "Die Zeilen der Sachkosten stehen nicht in der erwarteten Reihenfolge." };
    var warnungen = [], kaputt = "";
    function werteVon(s) {
      function w(i) { var x = zahl((zeilen[i] || [])[s.c]); if (x === null) kaputt = "Zeile " + (i + 1); return x || 0; }
      var sonst = 0;
      for (var i = z.sach + 1; i < z.primaer; i++) if (i !== z.werbung && i !== z.reise) sonst += w(i);
      var werte = { pkId: w(z.pkId), pkAd: w(z.pkAd), werbung: w(z.werbung), reise: w(z.reise), sonstiges: runde(sonst) };
      var name = (s.voll ? "IST " + s.jahr + " gesamt" : "IST " + s.jahr + " bis " + MONATE[Number(monat.slice(5)) - 1]);
      if (Math.abs(werte.werbung + werte.reise + werte.sonstiges - w(z.sach)) > 0.05) warnungen.push(name + ": Die Sachkosten der Datei passen nicht zur Summe der einzelnen Zeilen.");
      if (Math.abs(werte.pkId + werte.pkAd + w(z.sach) - w(z.primaer)) > 0.05) warnungen.push(name + ": Personal- und Sachkosten ergeben nicht die Primärkosten I der Datei.");
      return werte;
    }
    var voll = spalten.filter(function (s) { return s.voll && s.jahr === aktJahr - 1; })[0];
    var vz = bis.filter(function (s) { return s.jahr === aktJahr - 1; })[0];
    var aus = {
      kst: kst, stand: stand, monat: monat,
      aktuell: { jahr: aktJahr, werte: werteVon(bis[0]) },
      vorjahrZeitraum: vz ? { jahr: vz.jahr, werte: werteVon(vz) } : null,
      vorjahr: voll ? { jahr: voll.jahr, werte: werteVon(voll) } : null,
      warnungen: warnungen
    };
    if (kaputt) return { fehler: "In der Datei steht in " + kaputt + " kein gültiger Betrag." };
    return aus;
  }

  function monatName(monat) { return MONATE[Number(String(monat).slice(5)) - 1] || ""; }

  /* „Stand 22.10.2026 · gebucht bis September 2026“ */
  function standText(stand, monat) {
    var s = String(stand || "").split("-");
    return "Stand " + s[2] + "." + s[1] + "." + s[0] + (monat ? " · gebucht bis " + monatName(monat) + " " + String(monat).slice(0, 4) : "");
  }

  function pruefeIstWerte(w) {
    if (!w || typeof w !== "object") return false;
    for (var i = 0; i < POSITIONEN.length; i++) {
      var z = w[POSITIONEN[i].id];
      if (typeof z !== "number" || !isFinite(z) || Math.abs(z) > MAX_BETRAG) return false;
    }
    return true;
  }

  function istTeil(t) {
    if (t == null) return null;
    if (!istJahr(t.jahr) || !pruefeIstWerte(t.werte)) return undefined;
    var w = {};
    POSITIONEN.forEach(function (p) { w[p.id] = runde(t.werte[p.id]); });
    return { jahr: Number(t.jahr), werte: w };
  }

  /* Ersetzt die IST-Daten einer Kostenstelle. Vorher legt es eine Sicherung des bisherigen Stands an. Liefert Fehlertext oder "". */
  function setzeIst(daten, nummer, e, kennung, jetztZeit) {
    if (!findeNummer(daten, "ks", nummer)) return "Die Kostenstelle " + nummer + " gibt es nicht.";
    e = e || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.stand || "") || !/^\d{4}-(0[1-9]|1[0-2])$/.test(e.monat || "")) return "Datenstand oder Abrechnungsmonat fehlen.";
    var akt = istTeil(e.aktuell), vz = istTeil(e.vorjahrZeitraum), vj = istTeil(e.vorjahr);
    if (!akt || vz === undefined || vj === undefined) return "Die IST-Werte sind unvollständig.";
    if (Number(e.monat.slice(0, 4)) !== akt.jahr) return "Abrechnungsmonat und IST-Jahr passen nicht zusammen.";
    var zeit = jetztZeit || jetzt();
    sichereIst(daten, nummer, kennung, zeit, "Import");
    daten.ist["ks-" + nummer] = {
      stand: e.stand, monat: e.monat, aktuell: akt, vorjahrZeitraum: vz, vorjahr: vj,
      datei: String(e.datei || "").slice(0, 120), importiert: zeit, von: kennung || ""
    };
    return "";
  }

  function sichereIst(daten, nummer, kennung, zeit, anlass) {
    var vorher = daten.ist["ks-" + nummer] || null;
    daten.istSicherungen.unshift({
      id: "s" + Date.parse(zeit).toString(36) + Math.random().toString(36).slice(2, 7),
      zeit: zeit, von: kennung || "", nummer: nummer, anlass: anlass, vorher: vorher ? kopie(vorher) : null
    });
    daten.istSicherungen = daten.istSicherungen.slice(0, MAX_SICHERUNGEN);
  }

  /* Stellt den Stand vor einem Import wieder her; der ersetzte Stand wird dabei selbst gesichert. */
  function stelleIstWiederHer(daten, id, kennung) {
    var s = daten.istSicherungen.filter(function (x) { return x.id === id; })[0];
    if (!s) return "Diese Sicherung gibt es nicht mehr.";
    if (!findeNummer(daten, "ks", s.nummer)) return "Die Kostenstelle " + s.nummer + " gibt es nicht mehr.";
    var vorher = s.vorher;
    sichereIst(daten, s.nummer, kennung, jetzt(), "Wiederherstellung");
    if (vorher) daten.ist["ks-" + s.nummer] = kopie(vorher);
    else delete daten.ist["ks-" + s.nummer];
    return "";
  }

  function mitSummen(w) {
    var aus = {};
    POSITIONEN.forEach(function (p) { aus[p.id] = w ? Number(w[p.id]) || 0 : 0; });
    aus.sachkosten = runde(aus.werbung + aus.reise + aus.sonstiges);
    aus.personalkosten = runde(aus.pkId + aus.pkAd);
    aus.gesamt = runde(aus.personalkosten + aus.sachkosten);
    return aus;
  }

  /* IST einer Kostenstelle in einem Jahr: bisMonat (12 = ganzes Jahr), vergleich = Vorjahr im gleichen Zeitraum */
  function importIstVon(daten, jahr, nummer) {
    var e = (daten.ist || {})["ks-" + nummer];
    jahr = Number(jahr);
    if (e && e.aktuell && e.aktuell.jahr === jahr) {
      var w = mitSummen(e.aktuell.werte);
      w.vorhanden = true; w.bisMonat = Number(e.monat.slice(5)); w.stand = e.stand; w.monat = e.monat;
      w.vergleich = e.vorjahrZeitraum ? mitSummen(e.vorjahrZeitraum.werte) : null;
      return w;
    }
    if (e && e.vorjahr && e.vorjahr.jahr === jahr) {
      var v = mitSummen(e.vorjahr.werte);
      v.vorhanden = true; v.bisMonat = 12; v.stand = e.stand; v.monat = jahr + "-12"; v.vergleich = null;
      return v;
    }
    var leer = mitSummen(null);
    leer.vorhanden = false; leer.bisMonat = 0; leer.stand = ""; leer.monat = ""; leer.vergleich = null;
    return leer;
  }

  /* ---------- Projektkosten (manuell erfasst, je Projektnummer und Kostenart) ---------- */

  function istDatum(t) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t || ""));
    if (!m || !istJahr(m[1])) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }

  /* felder: {pn, datum (JJJJ-MM-TT), kostenart (Position), betrag, text}. id leer = neu. Liefert Fehlertext oder "". */
  function speichereKosten(daten, id, felder, kennung, jetztZeit) {
    felder = felder || {};
    var pn = String(felder.pn || "");
    if (!findeNummer(daten, "pn", pn)) return "Die Projektnummer " + pn + " gibt es nicht.";
    if (!istDatum(felder.datum)) return "Gib bitte ein gültiges Datum ein.";
    if (!POSITIONEN.some(function (p) { return p.id === felder.kostenart; })) return "Wähle bitte die Kostenart.";
    var betrag = leseBetrag(felder.betrag);
    if (betrag === null || betrag === 0) return "Gib bitte einen Betrag größer als 0 € ein, zum Beispiel 1.250,00.";
    var text = String(felder.text || "").trim();
    if (text.length > 120) return "Die Beschreibung hat höchstens 120 Zeichen.";
    var zeit = jetztZeit || jetzt();
    var e = id ? daten.kosten.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !e) return "Diesen Eintrag gibt es nicht mehr.";
    if (!e) { e = { id: "k" + Date.parse(zeit).toString(36) + Math.random().toString(36).slice(2, 7), erfasst: zeit, von: kennung || "" }; daten.kosten.push(e); }
    e.pn = pn; e.datum = felder.datum; e.kostenart = felder.kostenart; e.betrag = betrag; e.text = text;
    e.geaendert = zeit; e.geaendertVon = kennung || "";
    daten.kosten.sort(function (a, b) { return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0; });
    return "";
  }

  function loescheKosten(daten, id) {
    if (!daten.kosten.some(function (x) { return x.id === id; })) return "Diesen Eintrag gibt es nicht mehr.";
    daten.kosten = daten.kosten.filter(function (x) { return x.id !== id; });
    return "";
  }

  function kostenVon(daten, jahr, pn) {
    return (daten.kosten || []).filter(function (x) { return x.pn === pn && x.datum.slice(0, 4) === String(jahr); });
  }

  /* IST einer Projektnummer aus den erfassten Kosten. bisMonat: nur Kosten bis zu diesem Monat (für den Vorjahresvergleich). */
  function projektIstVon(daten, jahr, pn, bisMonat) {
    var w = {};
    var liste = kostenVon(daten, jahr, pn).filter(function (x) { return !bisMonat || Number(x.datum.slice(5, 7)) <= bisMonat; });
    liste.forEach(function (x) { w[x.kostenart] = runde((w[x.kostenart] || 0) + x.betrag); });
    var aus = mitSummen(w);
    aus.vorhanden = liste.length > 0;
    var heute = new Date();
    aus.bisMonat = Number(jahr) < heute.getFullYear() ? 12 : Number(jahr) === heute.getFullYear() ? heute.getMonth() + 1 : 0;
    aus.stand = liste.reduce(function (m, x) { var t = String(x.geaendert || x.erfasst || "").slice(0, 10); return t > m ? t : m; }, "");
    aus.monat = "";
    aus.anzahl = liste.length;
    aus.vergleich = null;
    return aus;
  }

  /* IST einer Kostenstelle aus ihrem KST-Bericht. Die Projektkosten der Projektnummern dieser Kostenstelle sind darin
     schon enthalten und stehen nur zur Aufschlüsselung in .projekte. */
  function istVon(daten, jahr, nummer) {
    var basis = importIstVon(daten, jahr, nummer);
    var pns = (daten.projekte || []).filter(function (n) { return n.ks === nummer; });
    basis.projekte = summe(pns.map(function (n) { return projektIstVon(daten, jahr, n.nummer); }).filter(function (t) { return t.vorhanden; }));
    basis.projektNummern = pns.map(function (n) { return n.nummer; });
    return basis;
  }

  function differenz(a, b) {
    var d = summe([a]);
    Object.keys(d).forEach(function (k) { d[k] = runde(d[k] - (b[k] || 0)); });
    return d;
  }

  /* IST einer übergreifenden Kostenstelle. Ihr KST-Bericht enthält schon die zugeordneten Kostenstellen und alle Projektkosten.
     gesamt = eigener KST-Bericht; eigen = was nach Abzug der zugeordneten Kostenstellen auf ihr selbst liegt (mit ihren Projektkosten).
     Fehlt der eigene KST-Bericht, ist gesamt nur die Summe der zugeordneten (ohneEigenImport). */
  function gesamtIstVon(daten, jahr, art, nummer) {
    if (art !== "ks") { var p = projektIstVon(daten, jahr, nummer); return { uebergreifend: false, eigen: p, unter: [], gesamt: p, fehlend: 0 }; }
    var bericht = istVon(daten, jahr, nummer);
    var e = findeNummer(daten, "ks", nummer);
    var unter = (e && e.unter || []).map(function (u) { return { nummer: u, ist: istVon(daten, jahr, u) }; });
    if (!unter.length) return { uebergreifend: false, eigen: bericht, unter: [], gesamt: bericht, fehlend: bericht.vorhanden ? 0 : 1 };
    var da = unter.map(function (u) { return u.ist; }).filter(function (t) { return t.vorhanden; });
    var projekte = summe([bericht.projekte].concat(unter.map(function (u) { return u.ist.projekte; })));
    var g, eigen;
    if (bericht.vorhanden) {
      g = bericht;
      g.unterschiedlich = da.some(function (t) { return t.stand !== g.stand || t.monat !== g.monat; });
      eigen = differenz(bericht, summe(da.concat([bericht.projekte])));
      eigen.vorhanden = true; eigen.bisMonat = bericht.bisMonat; eigen.stand = bericht.stand; eigen.monat = bericht.monat;
      eigen.unterschiedlich = g.unterschiedlich;
      eigen.vergleich = bericht.vergleich && da.every(function (t) { return t.vergleich; })
        ? differenz(bericht.vergleich, summe(da.map(function (t) { return t.vergleich; }).concat(bericht.projektNummern.map(function (n) { return projektIstVon(daten, Number(jahr) - 1, n, bericht.bisMonat); })))) : null;
      eigen.projekte = summe([]); eigen.projektNummern = [];
      g.widerspruch = eigen.gesamt < 0;
    } else {
      eigen = bericht;
      g = summe(da);
      g.vorhanden = da.length > 0;
      g.ohneEigenImport = true;
      g.bisMonat = da.length ? Math.min.apply(null, da.map(function (t) { return t.bisMonat; })) : 0;
      g.stand = da.map(function (t) { return t.stand; }).sort()[0] || "";
      g.monat = da.map(function (t) { return t.monat; }).sort()[0] || "";
      g.unterschiedlich = da.some(function (t) { return t.stand !== g.stand || t.monat !== g.monat; });
      g.vergleich = da.length && da.every(function (t) { return t.vergleich; }) ? summe(da.map(function (t) { return t.vergleich; })) : null;
      g.widerspruch = false;
    }
    g.projekte = projekte;
    var pIst = bericht.projekte; pIst.vorhanden = bericht.projektNummern.length > 0; pIst.stand = bericht.stand; pIst.monat = bericht.monat; pIst.bisMonat = bericht.bisMonat; pIst.vergleich = null;
    return { uebergreifend: true, eigen: eigen, unter: unter, projekte: pIst, gesamt: g, fehlend: (bericht.vorhanden ? 0 : 1) + unter.length - da.length };
  }

  /* Kennzahlen IST gegen Plan */
  function kennzahlen(plan, ist) {
    var p = plan.gesamt, i = ist.gesamt, monate = ist.bisMonat || 12;
    var hoch = ist.bisMonat >= 12 ? i : runde(i / monate * 12);
    var k = {
      ist: i, plan: p,
      quote: p > 0 ? i / p : null,
      rest: runde(p - i),
      zeitanteil: monate / 12,
      hochrechnung: hoch,
      hochQuote: p > 0 ? hoch / p : null,
      abweichung: runde(hoch - p),
      vorjahr: ist.vergleich ? ist.vergleich.gesamt : null,
      vorjahrDiff: ist.vergleich ? runde(i - ist.vergleich.gesamt) : null,
      vorjahrQuote: ist.vergleich && ist.vergleich.gesamt ? (i - ist.vergleich.gesamt) / ist.vergleich.gesamt : null
    };
    k.ampel = k.hochQuote === null ? "" : k.hochQuote > 1 ? "rot" : k.hochQuote > 0.95 ? "gelb" : "gruen";
    return k;
  }

  function prozentText(q, mitVorzeichen) {
    if (q === null || q === undefined || !isFinite(q)) return "–";
    var t = (q * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
    return mitVorzeichen && q > 0 ? "+" + t : t;
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
    function nummern(l, art) {
      return l.filter(function (n) { return Rechte.nummern(ich) || n.benutzer.indexOf(ich.kennung) >= 0; })
        .map(function (n) {
          var k = { nummer: n.nummer, benutzer: Rechte.nummern(ich) ? n.benutzer.slice() : [ich.kennung] };
          if (art === "ks") k.unter = (n.unter || []).slice();
          return k;
        });
    }
    d.kostenstellen = nummern(daten.kostenstellen, "ks");
    d.projekte = nummern(daten.projekte, "pn");
    d.projekte.forEach(function (k) { k.ks = findeNummer(daten, "pn", k.nummer).ks || ""; });
    /* Zu eigenen übergreifenden Kostenstellen kommen die zugeordneten dazu (ohne Zuweisung), damit die Summe stimmt */
    if (!Rechte.nummern(ich)) {
      var da = {};
      d.kostenstellen.forEach(function (n) { da[n.nummer] = 1; });
      d.kostenstellen.slice().forEach(function (n) {
        n.unter.forEach(function (u) { if (!da[u] && findeNummer(daten, "ks", u)) { da[u] = 1; d.kostenstellen.push({ nummer: u, benutzer: [], unter: [] }); } });
      });
      sortiereNummern(d.kostenstellen);
      /* Projektnummern, deren Kosten von sichtbaren Kostenstellen abgehen, kommen ohne Zuweisung dazu */
      var pnDa = {};
      d.projekte.forEach(function (n) { pnDa[n.nummer] = 1; });
      daten.projekte.forEach(function (n) { if (n.ks && da[n.ks] && !pnDa[n.nummer]) { pnDa[n.nummer] = 1; d.projekte.push({ nummer: n.nummer, benutzer: [], ks: n.ks }); } });
      sortiereNummern(d.projekte);
    }
    var pnSichtbar = {};
    d.projekte.forEach(function (n) { pnSichtbar[n.nummer] = 1; });
    d.kosten = ich.rolle === "admin" ? [] : (daten.kosten || []).filter(function (x) { return ich.rolle === "al" || pnSichtbar[x.pn]; }).map(kopie);
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
    /* IST wie Planbudgets; Sicherungen nur als Liste ohne Werte für Abteilungsleitung und Administrator */
    d.ist = {};
    if (ich.rolle !== "admin") Object.keys(daten.ist || {}).forEach(function (s) {
      if (ich.rolle === "al" || (s.indexOf("ks-") === 0 && d.kostenstellen.some(function (n) { return "ks-" + n.nummer === s; }))) d.ist[s] = kopie(daten.ist[s]);
    });
    d.istSicherungen = verwaltet ? (daten.istSicherungen || []).map(function (x) {
      return { id: x.id, zeit: x.zeit, von: x.von, nummer: x.nummer, anlass: x.anlass, vorherStand: x.vorher ? x.vorher.stand : "", vorherMonat: x.vorher ? x.vorher.monat : "" };
    }) : [];
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
    uebergeordnete: uebergeordnete,
    pruefeUnter: pruefeUnter,
    gesamtBudgetVon: gesamtBudgetVon,
    abteilungsPlan: abteilungsPlan,
    MONATE: MONATE,
    istAuslesen: istAuslesen,
    monatName: monatName,
    standText: standText,
    setzeIst: setzeIst,
    stelleIstWiederHer: stelleIstWiederHer,
    istVon: istVon,
    gesamtIstVon: gesamtIstVon,
    istDatum: istDatum,
    speichereKosten: speichereKosten,
    loescheKosten: loescheKosten,
    kostenVon: kostenVon,
    projektIstVon: projektIstVon,
    kennzahlen: kennzahlen,
    prozentText: prozentText,
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
