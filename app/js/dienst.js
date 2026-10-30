/* Budgetdashboard: Datendienst. Zwei Betriebsarten mit gleicher Schnittstelle:
   - Browser: alles im localStorage (Artefakt, Demo).
   - Server: api.ashx auf dem IIS; Anmeldung, Passwörter und Rechte prüft der Server.
   Die Oberfläche bekommt in beiden Fällen nur die Sicht ihrer Rolle (BDDaten.sicht bzw. BdKern.Sicht).
   Jede Änderung liefert {daten, benutzer} mit der neuen Sicht. */
(function (wurzel) {
  "use strict";
  var D = wurzel.BDDaten;
  var DEMO = wurzel.BDDemo;
  var API = "api.ashx";
  var KOPF = { "X-Budgetdashboard": "1" };

  /* Browserbetrieb: Die Anmeldung gilt wie auf dem Server 7 Tage, bis zum Abmelden. */
  var SITZUNG = "budgetdashboard-sitzung";
  var SITZUNGSDAUER = 7 * 24 * 60 * 60 * 1000;

  function sitzungLesen() {
    try {
      var s = JSON.parse(localStorage.getItem(SITZUNG) || "null");
      if (s && s.kennung && s.ablauf > Date.now()) return s.kennung;
      localStorage.removeItem(SITZUNG);
    } catch (e) { /* ohne Speicher */ }
    return null;
  }
  function sitzungSetzen(kennung) {
    try {
      if (kennung) localStorage.setItem(SITZUNG, JSON.stringify({ kennung: kennung, ablauf: Date.now() + SITZUNGSDAUER }));
      else localStorage.removeItem(SITZUNG);
    } catch (e) { /* ohne Speicher */ }
  }

  // BETA-ANMELDEN-ALS Anfang: Administrator, der sich im Browserbetrieb als anderer Benutzer angemeldet hat
  var ALS_ADMIN = "budgetdashboard-als-admin";
  function alsAdminLesen() { try { return localStorage.getItem(ALS_ADMIN) || ""; } catch (e) { return ""; } }
  function alsAdminSetzen(k) { try { if (k) localStorage.setItem(ALS_ADMIN, k); else localStorage.removeItem(ALS_ADMIN); } catch (e) { /* ohne Speicher */ } }
  // BETA-ANMELDEN-ALS Ende

  function fehler(text, code) { var f = new Error(text); f.code = code || ""; return f; }

  /* ---------- Browserbetrieb ---------- */

  var speicher = null;

  function ergebnis(kennung) {
    var daten = D.sicht(speicher, kennung);
    return { daten: daten, benutzer: D.findeBenutzer(daten, kennung), alsAdmin: alsAdminLesen() /* BETA-ANMELDEN-ALS */ };
  }

  function oeffentlicheDaten(quelle) {
    var d = D.leereDaten();
    d.einstellungen = D.kopie(quelle.einstellungen);
    return d;
  }

  /* Holt das angemeldete Konto aus dem vollständigen Stand; ohne gültige Sitzung: abgemeldet */
  function ich() {
    var b = D.findeBenutzer(speicher, sitzungLesen());
    if (!b) throw fehler("Deine Anmeldung ist abgelaufen. Melde Dich bitte neu an.", "abgemeldet");
    if (b.mussPasswortAendern && !alsAdminLesen() /* BETA-ANMELDEN-ALS */) throw fehler("Lege bitte zuerst Dein eigenes Passwort fest.", "eingabe");
    return b;
  }

  /* Führt eine Änderung aus und speichert; schlägt etwas fehl, bleibt der alte Stand erhalten. */
  function aendern(aktion) {
    var vorher = JSON.stringify(speicher);
    var b;
    return Promise.resolve().then(function () {
      b = ich();
      return aktion(b);
    }).then(function (text) {
      if (text) throw fehler(text, "eingabe");
      speicher.stand = (speicher.stand || 0) + 1;
      return D.Speicher.speichern(speicher);
    }).then(function () { return ergebnis(b.kennung); }, function (f) {
      speicher = JSON.parse(vorher);
      throw f;
    });
  }

  function recht(ok) { return ok ? "" : "Dafür fehlen Dir die Rechte."; }

  var Browser = {
    modus: "browser",
    start: function () {
      return D.Speicher.laden().then(function (daten) {
        if (daten) return daten;
        return D.startDaten(DEMO ? DEMO.fuelle : null).then(function (neu) {
          return D.Speicher.speichern(neu).then(function () { return neu; }, function () { return neu; });
        });
      }).then(function (daten) {
        speicher = daten;
        var kennung = sitzungLesen();
        if (kennung && D.findeBenutzer(speicher, kennung)) return ergebnis(kennung);
        return { daten: oeffentlicheDaten(speicher), benutzer: null };
      });
    },
    anmelden: function (daten, kennung, passwort) {
      return D.pruefeAnmeldung(speicher, kennung, passwort).then(function (b) {
        if (!b) return null;
        b.letzteAnmeldung = new Date().toISOString();
        sitzungSetzen(b.kennung);
        alsAdminSetzen(""); // BETA-ANMELDEN-ALS
        return D.Speicher.speichern(speicher).then(function () { return ergebnis(b.kennung); }, function () { return ergebnis(b.kennung); });
      });
    },
    abmelden: function () { sitzungSetzen(null); alsAdminSetzen(""); /* BETA-ANMELDEN-ALS */ return Promise.resolve(oeffentlicheDaten(speicher)); },
    // BETA-ANMELDEN-ALS Anfang
    anmeldenAls: function (daten, b, kennung) {
      var echt = D.findeBenutzer(speicher, sitzungLesen()), ziel = D.findeBenutzer(speicher, kennung);
      if (!echt || echt.rolle !== "admin" || alsAdminLesen()) return Promise.reject(fehler("„Anmelden als“ gibt es nur für Administratoren.", "eingabe"));
      if (!ziel || ziel.kennung === echt.kennung) return Promise.reject(fehler("Diesen Benutzer gibt es nicht.", "eingabe"));
      alsAdminSetzen(echt.kennung);
      sitzungSetzen(ziel.kennung);
      return Promise.resolve(ergebnis(ziel.kennung));
    },
    zurueckAlsAdmin: function () {
      var admin = D.findeBenutzer(speicher, alsAdminLesen());
      if (!admin) { alsAdminSetzen(""); sitzungSetzen(null); return Promise.reject(fehler("Melde Dich bitte neu an.", "abgemeldet")); }
      alsAdminSetzen("");
      sitzungSetzen(admin.kennung);
      return Promise.resolve(ergebnis(admin.kennung));
    },
    // BETA-ANMELDEN-ALS Ende
    /* alt null: erste Anmeldung mit Einmalpasswort. Liefert "" oder einen Fehlertext. */
    passwortSetzen: function (daten, b, alt, neu) {
      var echt = D.findeBenutzer(speicher, sitzungLesen());
      if (!echt) return Promise.reject(fehler("Deine Anmeldung ist abgelaufen. Melde Dich bitte neu an.", "abgemeldet"));
      if (alsAdminLesen()) return Promise.resolve("Das Passwort ändert nur die Person selbst, nicht der Administrator über „Anmelden als“."); // BETA-ANMELDEN-ALS
      var maengel = D.passwortMaengel(neu, echt);
      if (maengel.length) return Promise.resolve("Dein Passwort braucht noch " + maengel.join(", ") + ".");
      var pruefung = echt.mussPasswortAendern
        ? D.passwortHash(neu, echt.salz).then(function (h) { return h === echt.hash ? "Wähle bitte ein anderes Passwort als Dein Einmalpasswort." : ""; })
        : D.pruefeAnmeldung(speicher, echt.kennung, alt || "").then(function (ok) {
          if (!ok) return "Dein aktuelles Passwort stimmt nicht. Prüfe bitte Deine Eingabe.";
          return alt === neu ? "Wähle bitte ein anderes Passwort als Dein bisheriges." : "";
        });
      return pruefung.then(function (text) {
        if (text) return text;
        return D.setzePasswort(echt, neu, false).then(function () { return D.Speicher.speichern(speicher); }).then(function () {
          b.mussPasswortAendern = false;
          b.einmalpasswort = "";
          return "";
        });
      });
    },
    profilSpeichern: function (daten, b, felder) {
      return aendern(function (ich) {
        var v = String(felder.vorname || "").trim(), n = String(felder.nachname || "").trim();
        if (!v || !n) return "Gib bitte Deinen Vor- und Nachnamen ein.";
        if (v.length > 40 || n.length > 40) return "Vor- und Nachname haben höchstens 40 Zeichen.";
        ich.vorname = v;
        ich.nachname = n;
      });
    },
    designSpeichern: function (daten, b, design, farbe) {
      var echt = D.findeBenutzer(speicher, b.kennung);
      if (echt) { echt.design = design; echt.farbe = farbe; }
      return D.Speicher.speichern(speicher).then(function () { return true; }, function () { return false; });
    },
    einstellungenSpeichern: function (daten, b, felder) {
      return aendern(function (ich) {
        if (!D.Rechte.einstellungen(ich)) return recht(false);
        var t = String(felder.titel || "").trim();
        if (!t) return "Gib dem Tool bitte einen Titel.";
        if (t.length > 60) return "Der Titel hat höchstens 60 Zeichen.";
        speicher.einstellungen.titel = t;
      });
    },
    /* felder: {kennung, vorname, nachname, rolle, nummern:{ks:[], pn:[]}} */
    benutzerAnlegen: function (daten, b, felder, passwort) {
      return aendern(function (ich) {
        var text = D.pruefeBenutzer(speicher, ich, null, felder);
        if (text) return text;
        var nb = D.neuerBenutzer(felder.kennung, { vorname: felder.vorname.trim(), nachname: felder.nachname.trim(), rolle: felder.rolle });
        var maengel = D.passwortMaengel(passwort, nb);
        if (maengel.length) return "Das Einmalpasswort braucht noch " + maengel.join(", ") + ".";
        return D.setzePasswort(nb, passwort, true).then(function () {
          speicher.benutzer.push(nb);
          D.setzeNummernFuer(speicher, nb.kennung, felder.nummern || {});
        });
      });
    },
    benutzerAendern: function (daten, b, kennung, felder) {
      return aendern(function (ich) {
        var ziel = D.findeBenutzer(speicher, kennung);
        if (!ziel) return "Diesen Benutzer gibt es nicht mehr.";
        var text = D.pruefeBenutzer(speicher, ich, ziel, felder);
        if (text) return text;
        ziel.vorname = felder.vorname.trim();
        ziel.nachname = felder.nachname.trim();
        ziel.rolle = felder.rolle;
        D.setzeNummernFuer(speicher, ziel.kennung, felder.nummern || {});
      });
    },
    benutzerLoeschen: function (daten, b, kennung) {
      return aendern(function (ich) {
        var text = D.pruefeLoeschen(speicher, ich, D.findeBenutzer(speicher, kennung));
        if (text) return text;
        D.loescheBenutzer(speicher, kennung);
      });
    },
    passwortZuruecksetzen: function (daten, b, kennung, passwort) {
      return aendern(function (ich) {
        var ziel = D.findeBenutzer(speicher, kennung);
        if (!ziel) return "Diesen Benutzer gibt es nicht mehr.";
        if (!D.darfKontoVerwalten(ich, ziel)) return "Administratoren verwaltet nur ein Administrator.";
        if (ziel.kennung === ich.kennung) return "Dein eigenes Passwort änderst Du in Deinem Profil.";
        var maengel = D.passwortMaengel(passwort, ziel);
        if (maengel.length) return "Das Einmalpasswort braucht noch " + maengel.join(", ") + ".";
        return D.setzePasswort(ziel, passwort, true).then(function () { return ""; });
      });
    },
    nummerSpeichern: function (daten, b, art, alt, nummer, kennungen, unter, oben) {
      return aendern(function (ich) { return recht(D.Rechte.nummern(ich)) || D.speichereNummer(speicher, art, alt, nummer, kennungen, unter, oben); });
    },
    nummerLoeschen: function (daten, b, art, nummer) {
      return aendern(function (ich) {
        if (!D.Rechte.nummern(ich)) return recht(false);
        if (!D.findeNummer(speicher, art, nummer)) return "Diese Nummer gibt es nicht mehr.";
        D.loescheNummer(speicher, art, nummer);
      });
    },
    budgetSpeichern: function (daten, b, jahr, art, nummer, werte) {
      return aendern(function (ich) { return recht(D.Rechte.budgets(ich)) || D.setzeBudget(speicher, jahr, art, nummer, werte, ich.kennung); });
    },
    budgetsUebernehmen: function (daten, b, von, nach, ueberschreiben) {
      return aendern(function (ich) { return recht(D.Rechte.budgets(ich)) || D.uebernehmeBudgets(speicher, von, nach, !!ueberschreiben, ich.kennung); });
    },
    ampelSpeichern: function (daten, b, imPlanBis, knappBis) {
      return aendern(function (ich) { return (ich.rolle === "al" ? "" : "Die Ampel stellt nur die Abteilungsleitung ein.") || D.setzeAmpel(speicher, imPlanBis, knappBis); });
    },
    /* Gesamtsicherung: vollständiger Stand zum Herunterladen (nur Administrator) */
    sicherungHolen: function () {
      try { if (ich().rolle !== "admin") return Promise.reject(fehler("Sicherungen verwaltet nur ein Administrator.", "eingabe")); } catch (f) { return Promise.reject(f); }
      return Promise.resolve({ art: "budgetdashboard-sicherung", version: "", erstellt: new Date().toISOString(), daten: D.kopie(speicher) });
    },
    /* Im Browser gibt es keine automatischen Sicherungen */
    sicherungenListe: function () { return Promise.resolve([]); },
    sicherungEinspielen: function (daten, b, quelle) {
      var echt;
      try { echt = ich(); } catch (f) { return Promise.reject(f); }
      if (echt.rolle !== "admin") return Promise.reject(fehler("Sicherungen verwaltet nur ein Administrator.", "eingabe"));
      var r = D.pruefeSicherung(quelle.daten, echt.kennung);
      if (r.fehler) return Promise.reject(fehler(r.fehler, "eingabe"));
      var vorher = speicher;
      speicher = D.vervollstaendige(r.daten);
      speicher.stand = Math.max(vorher.stand || 0, speicher.stand || 0) + 1;
      return D.Speicher.speichern(speicher).then(function () { return ergebnis(echt.kennung); }, function (f) { speicher = vorher; D.vervollstaendige(speicher); throw f; });
    },
    istImportieren: function (daten, b, nummer, eintrag) {
      return aendern(function (ich) { return recht(D.Rechte.ist(ich)) || D.setzeIst(speicher, nummer, eintrag, ich.kennung); });
    },
    kostenSpeichern: function (daten, b, id, felder) {
      return aendern(function (ich) {
        var alt = id ? speicher.kosten.filter(function (x) { return x.id === id; })[0] : null;
        return recht(D.Rechte.kosten(ich, speicher, (felder || {}).pn) && (!alt || D.Rechte.kosten(ich, speicher, alt.pn))) || D.speichereKosten(speicher, id, felder, ich.kennung);
      });
    },
    kostenLoeschen: function (daten, b, id) {
      return aendern(function (ich) {
        var alt = speicher.kosten.filter(function (x) { return x.id === id; })[0];
        return (alt ? recht(D.Rechte.kosten(ich, speicher, alt.pn)) : "") || D.loescheKosten(speicher, id);
      });
    },
    istWiederherstellen: function (daten, b, id) {
      return aendern(function (ich) { return recht(D.Rechte.nummern(ich)) || D.stelleIstWiederHer(speicher, id, ich.kennung); });
    },
    /* Nur für den Browserbetrieb: zurück auf die Beispieldaten */
    zuruecksetzen: function () {
      return D.startDaten(DEMO ? DEMO.fuelle : null).then(function (neu) {
        speicher = neu;
        sitzungSetzen(null);
        return D.Speicher.speichern(neu).then(function () { return oeffentlicheDaten(speicher); });
      });
    }
  };

  /* ---------- Serverbetrieb ---------- */

  function anfrage(aktion, koerper) {
    var optionen = { method: koerper === undefined ? "GET" : "POST", headers: Object.assign({}, KOPF), credentials: "same-origin", cache: "no-store" };
    if (koerper !== undefined) {
      optionen.headers["Content-Type"] = "application/json; charset=utf-8";
      optionen.body = JSON.stringify(koerper);
    }
    return fetch(API + "?aktion=" + encodeURIComponent(aktion), optionen).then(function (antwort) {
      return antwort.text().then(function (text) {
        var json = {};
        try { json = text ? JSON.parse(text) : {}; } catch (e) { json = {}; }
        if (antwort.ok) return json;
        if (antwort.status === 401) throw fehler(json.fehler || "Deine Anmeldung ist abgelaufen. Melde Dich bitte neu an.", "abgemeldet");
        if (antwort.status === 400 || antwort.status === 403 || antwort.status === 404 || antwort.status === 429) throw fehler(json.fehler || "Prüfe bitte Deine Eingabe.", "eingabe");
        throw fehler(json.fehler || "Der Server hat nicht geantwortet. Probiere es bitte gleich noch einmal.", "server");
      });
    }, function () {
      throw fehler("Wir erreichen den Server gerade nicht. Prüfe bitte Deine Verbindung.", "netz");
    });
  }

  function uebernehmen(s) {
    var daten = D.vervollstaendige(s.daten);
    return { daten: daten, benutzer: D.findeBenutzer(daten, s.ich), alsAdmin: s.alsAdmin || "" /* BETA-ANMELDEN-ALS */ };
  }

  function oeffentlich() {
    return anfrage("oeffentlich").then(function (o) {
      var daten = D.leereDaten();
      daten.einstellungen = Object.assign(daten.einstellungen, o.einstellungen || {});
      return daten;
    });
  }

  var Server = {
    modus: "server",
    start: function () {
      return anfrage("sitzung").then(uebernehmen, function (f) {
        if (f.code !== "abgemeldet") throw f;
        return oeffentlich().then(function (daten) { return { daten: daten, benutzer: null }; });
      });
    },
    anmelden: function (daten, kennung, passwort) {
      return anfrage("anmelden", { kennung: kennung, passwort: passwort }).then(uebernehmen, function (f) {
        if (f.code === "abgemeldet") return null;
        throw f;
      });
    },
    abmelden: function () { return anfrage("abmelden", {}).then(oeffentlich, oeffentlich); },
    // BETA-ANMELDEN-ALS Anfang
    anmeldenAls: function (daten, b, kennung) { return anfrage("anmelden-als", { kennung: kennung }).then(uebernehmen); },
    zurueckAlsAdmin: function () { return anfrage("zurueck-als-admin", {}).then(uebernehmen); },
    // BETA-ANMELDEN-ALS Ende
    passwortSetzen: function (daten, b, alt, neu) {
      return anfrage("passwort", { alt: alt, neu: neu }).then(function () {
        b.mussPasswortAendern = false;
        b.einmalpasswort = "";
        return "";
      }, function (f) {
        if (f.code === "eingabe") return f.message;
        throw f;
      });
    },
    profilSpeichern: function (daten, b, felder) { return anfrage("profil", { vorname: felder.vorname, nachname: felder.nachname }).then(uebernehmen); },
    designSpeichern: function (daten, b, design, farbe) {
      return anfrage("design", { design: design, farbe: farbe }).then(function () { return true; }, function () { return false; });
    },
    einstellungenSpeichern: function (daten, b, felder) { return anfrage("einstellungen", { titel: felder.titel }).then(uebernehmen); },
    benutzerAnlegen: function (daten, b, felder, passwort) {
      return anfrage("benutzer-anlegen", { kennung: felder.kennung, vorname: felder.vorname, nachname: felder.nachname, rolle: felder.rolle, nummern: felder.nummern || {}, passwort: passwort }).then(uebernehmen);
    },
    benutzerAendern: function (daten, b, kennung, felder) {
      return anfrage("benutzer-aendern", { kennung: kennung, vorname: felder.vorname, nachname: felder.nachname, rolle: felder.rolle, nummern: felder.nummern || {} }).then(uebernehmen);
    },
    benutzerLoeschen: function (daten, b, kennung) { return anfrage("benutzer-loeschen", { kennung: kennung }).then(uebernehmen); },
    passwortZuruecksetzen: function (daten, b, kennung, passwort) { return anfrage("passwort-zuruecksetzen", { kennung: kennung, passwort: passwort }).then(uebernehmen); },
    nummerSpeichern: function (daten, b, art, alt, nummer, kennungen, unter, oben) {
      var k = { art: art, alt: alt || "", nummer: nummer, benutzer: kennungen || [] };
      if (Array.isArray(unter)) k.unter = unter;
      if (typeof oben === "string") k.oben = oben;
      if (typeof unter === "string") k.ks = unter;
      return anfrage("nummer-speichern", k).then(uebernehmen);
    },
    nummerLoeschen: function (daten, b, art, nummer) { return anfrage("nummer-loeschen", { art: art, nummer: nummer }).then(uebernehmen); },
    budgetSpeichern: function (daten, b, jahr, art, nummer, werte) {
      return anfrage("budget-speichern", { jahr: String(jahr), art: art, nummer: nummer, werte: werte }).then(uebernehmen);
    },
    istImportieren: function (daten, b, nummer, eintrag) {
      return anfrage("ist-importieren", { nummer: nummer, eintrag: eintrag }).then(uebernehmen);
    },
    kostenSpeichern: function (daten, b, id, felder) {
      return anfrage("kosten-speichern", { id: id || "", pn: felder.pn, datum: felder.datum, betrag: felder.betrag, text: felder.text || "" }).then(uebernehmen);
    },
    kostenLoeschen: function (daten, b, id) { return anfrage("kosten-loeschen", { id: id }).then(uebernehmen); },
    budgetsUebernehmen: function (daten, b, von, nach, ueberschreiben) {
      return anfrage("budgets-uebernehmen", { von: String(von), nach: String(nach), ueberschreiben: !!ueberschreiben }).then(uebernehmen);
    },
    ampelSpeichern: function (daten, b, imPlanBis, knappBis) { return anfrage("ampel-speichern", { imPlanBis: imPlanBis, knappBis: knappBis }).then(uebernehmen); },
    sicherungHolen: function () { return anfrage("sicherung"); },
    sicherungenListe: function () { return anfrage("sicherungen").then(function (r) { return r.liste || []; }); },
    sicherungEinspielen: function (daten, b, quelle) { return anfrage("sicherung-einspielen", quelle).then(uebernehmen); },
    istWiederherstellen: function (daten, b, id) { return anfrage("ist-wiederherstellen", { id: id }).then(uebernehmen); }
  };

  function ermitteln() {
    if (!/^https?:$/.test(location.protocol) || typeof fetch !== "function") return Promise.resolve(Browser);
    var abbruch = typeof AbortController === "function" ? new AbortController() : null;
    var zeit = setTimeout(function () { if (abbruch) abbruch.abort(); }, 4000);
    return fetch(API + "?aktion=ping", { headers: KOPF, cache: "no-store", signal: abbruch ? abbruch.signal : undefined })
      .then(function (a) { return a.ok ? a.json() : null; })
      .then(function (j) { clearTimeout(zeit); return j && j.modus === "server" ? Server : Browser; },
        function () { clearTimeout(zeit); return Browser; });
  }

  wurzel.BDDienst = { ermitteln: ermitteln, Browser: Browser, Server: Server };
})(typeof self !== "undefined" ? self : this);
