/* Budgetdashboard: Oberfläche (Anmeldung, Start, Übersicht, Verwaltung, Profil). */
(function () {
  "use strict";

  var VERSION = "0.11.1";
  var D = window.BDDaten;
  var DESIGN = "budgetdashboard-design";
  var FARBE = "budgetdashboard-farbe";

  var zustand = { daten: null, benutzer: null, jahr: new Date().getFullYear() };
  var Dienst = null;
  var app = document.getElementById("app");
  var dialog = document.getElementById("dialog");

  /* ---------- Hilfen ---------- */

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (z) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z];
    });
  }

  function icon(name) { return '<i class="ruv-i-' + name + '" aria-hidden="true"></i>'; }

  function meldung(text, fehler) {
    var box = document.getElementById("meldungen");
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    var m = document.createElement("div");
    m.className = "meldung" + (fehler ? " meldung--fehler" : "");
    m.innerHTML = icon(fehler ? "danger" : "checkmarkCircle") + "<span>" + esc(text) + "</span>";
    box.appendChild(m);
    setTimeout(function () { m.remove(); }, fehler ? 6500 : 3500);
  }

  /* Übernimmt die neue Sicht nach einer Änderung */
  /* Jede Ansicht startet mit dem aktuellen Kalenderjahr; eine andere Wahl gilt nur, bis Du die Ansicht wechselst */
  function aktuellesJahr() { zustand.jahr = new Date().getFullYear(); }

  function uebernehmen(r) {
    if (zustand.benutzer !== r.benutzer && (!zustand.benutzer || !r.benutzer || zustand.benutzer.kennung !== r.benutzer.kennung)) aktuellesJahr();
    zustand.daten = r.daten;
    zustand.benutzer = r.benutzer;
    zustand.alsAdmin = r.alsAdmin || ""; // BETA-ANMELDEN-ALS
    document.title = zustand.daten.einstellungen.titel;
    return r;
  }

  /* Abgelaufene Anmeldung: neu starten. Eingabefehler zeigt das Formular selbst (form), sonst eine Meldung. */
  function serverFehler(f, form) {
    if (form && f.code === "eingabe") { zeigeFehler(form, f.message); return; }
    meldung(f.message, true);
    if (f.code === "abgemeldet") Dienst.start().then(function (r) { uebernehmen(r); zeige(); });
  }

  function route() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    var teile = h.split("/");
    return { seite: teile[0] || "start", unter: teile[1] || "", zusatz: teile[2] || "" };
  }

  function gehe(ziel) {
    if (location.hash === ziel) zeige();
    else location.hash = ziel;
  }

  /* modus: "auto", "hell" oder "dunkel"; farbe: Farbdesign aus js/design.js */
  function setzeDesign(modus, farbe, imProfil) {
    window.BDFarben.anwenden(modus, farbe);
    var g = window.BDFarben.gewaehlt();
    try { localStorage.setItem(DESIGN, g.modus); localStorage.setItem(FARBE, g.farbe); } catch (e) { /* gilt dann bis zum Neuladen */ }
    if (imProfil && zustand.benutzer) {
      zustand.benutzer.design = g.modus;
      zustand.benutzer.farbe = g.farbe;
      Dienst.designSpeichern(zustand.daten, zustand.benutzer, g.modus, g.farbe);
    }
  }

  function aktuellesDesign() { return document.documentElement.getAttribute("data-theme") === "dunkel" ? "dunkel" : "hell"; }

  function farbwahlHtml() {
    var aktiv = window.BDFarben.gewaehlt().farbe;
    return '<fieldset class="farbwahl"><legend class="sr">Farbdesign wählen</legend>' + window.BDFarben.liste.map(function (f) {
      return '<label class="farbwahl__option"><input type="radio" name="farbe" value="' + esc(f.id) + '"' + (f.id === aktiv ? " checked" : "") + ">" +
        '<span class="farbwahl__muster" aria-hidden="true">' + f.muster.map(function (m) { return '<span style="background:' + esc(m) + '"></span>'; }).join("") + "</span>" +
        '<span class="farbwahl__name">' + esc(f.name) + '</span><span class="farbwahl__kurz">' + esc(f.kurz) + "</span></label>";
    }).join("") + "</fieldset>";
  }

  function initialen(b) {
    var v = (b.vorname || "").charAt(0), n = (b.nachname || "").charAt(0);
    return (v + n).toUpperCase() || b.kennung.slice(0, 2).toUpperCase();
  }

  function datumZeit(iso) {
    if (!iso) return "noch nie";
    var d = new Date(iso);
    return d.toLocaleDateString("de-DE") + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
  }

  function euro(z) { return esc(D.betragText(z)); }

  /* Betrag für ein Eingabefeld: 12.500,00 oder leer */
  function betragFeld(z) { return z ? D.zahlText(z, 2) : ""; }
  /* Betragsfeld: Tausenderpunkte schon beim Tippen, beim Verlassen immer zwei Nachkommastellen */
  function betragEingabe(i) {
    if (i.getAttribute("data-betrag-feld")) return;
    i.setAttribute("data-betrag-feld", "1");
    i.addEventListener("input", function () {
      var v = i.value, pos = i.selectionStart === null ? v.length : i.selectionStart;
      var vorher = v.slice(0, pos).replace(/[^\d,]/g, "").length;
      var teile = v.replace(/[^\d,]/g, "").split(","), ganz = teile.shift().replace(/^0+(?=\d)/, "");
      var neu = ganz.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (teile.length ? "," + teile.join("").slice(0, 2) : "");
      if (neu === v) return;
      i.value = neu;
      var n = 0, p = 0;
      while (p < neu.length && n < vorher) { if (/[\d,]/.test(neu[p])) n++; p++; }
      try { i.setSelectionRange(p, p); } catch (e) { /* Feld ohne Auswahl */ }
    });
    i.addEventListener("blur", function () { var z = D.leseBetrag(i.value); if (z !== null && i.value.trim()) i.value = betragFeld(z) || "0,00"; });
  }
  // Auch Betragsfelder in Dialogen (zum Beispiel Kosten) bekommen das Format beim ersten Fokus
  document.addEventListener("focusin", function (e) { if (e.target && e.target.matches && e.target.matches(".betrag input")) betragEingabe(e.target); });

  /* In die Zwischenablage kopieren. Ohne https (IIS über http) fehlt navigator.clipboard,
     dann hilft der ältere Weg über ein unsichtbares Textfeld im offenen Dialog. */
  function kopiere(text, behaelter) {
    function altWeg() {
      var feld = document.createElement("textarea");
      feld.value = text;
      feld.setAttribute("readonly", "");
      feld.style.position = "fixed";
      feld.style.top = "0";
      feld.style.left = "0";
      feld.style.opacity = "0";
      (behaelter || document.body).appendChild(feld);
      feld.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      feld.remove();
      return ok ? Promise.resolve() : Promise.reject(new Error("kopieren"));
    }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(altWeg);
    return altWeg();
  }

  function regelnHtml(passwort, person) {
    var maengel = D.passwortMaengel(passwort, person);
    var zusatz = maengel.filter(function (m) { return D.REGELN.indexOf(m) < 0; });
    return D.REGELN.map(function (r) {
      var ok = passwort && maengel.indexOf(r) < 0;
      return '<li class="' + (ok ? "ok" : "") + '">' + icon(ok ? "checkmarkCircle" : "minus") + "<span>" + esc(r) + "</span></li>";
    }).join("") + (passwort ? zusatz.map(function (m) { return '<li class="fehlt">' + icon("danger") + "<span>" + esc(m) + "</span></li>"; }).join("") : "") +
      '<li class="hinweis">' + icon("infoCircleFilled") + "<span>nicht Deine XV-Nummer, Deinen Namen oder gängige Wörter wie „Passwort“</span></li>";
  }

  /* ---------- Dialog ---------- */

  function oeffneDialog(titel, inhalt, fuss, beimAbsenden, breit) {
    dialog.className = "dialog" + (breit ? " dialog--breit" : "");
    dialog.innerHTML = '<form method="dialog" novalidate>' +
      '<div class="dialog__kopf"><h2 id="dialog-titel">' + esc(titel) + '</h2>' +
      '<button type="button" class="icon-btn" data-schliessen aria-label="Schließen">' + icon("cross") + "</button></div>" +
      '<div class="dialog__inhalt">' + inhalt + "</div>" +
      '<div class="dialog__fuss">' + fuss + "</div></form>";
    var form = dialog.querySelector("form");
    dialog.querySelectorAll("[data-schliessen]").forEach(function (b) { b.addEventListener("click", schliesseDialog); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (beimAbsenden) beimAbsenden(form);
      else schliesseDialog();
    });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    var erstes = form.querySelector(".dialog__inhalt input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([readonly]), .dialog__inhalt select");
    if (erstes) erstes.focus();
    return form;
  }

  function schliesseDialog() {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    dialog.innerHTML = "";
  }

  function bestaetige(titel, text, knopf) {
    return new Promise(function (ok) {
      var entschieden = false;
      oeffneDialog(titel, "<p>" + esc(text) + "</p>",
        '<button type="button" class="btn btn--rahmen" data-schliessen>Abbrechen</button>' +
        '<button type="submit" class="btn btn--gefahr">' + esc(knopf) + "</button>",
        function () { entschieden = true; schliesseDialog(); ok(true); });
      dialog.addEventListener("close", function nachSchliessen() {
        dialog.removeEventListener("close", nachSchliessen);
        if (!entschieden) ok(false);
      });
    });
  }

  function zeigeFehler(form, text) {
    var f = form.querySelector(".fehlertext");
    if (!f) { if (text) meldung(text, true); return; }
    f.textContent = text;
    f.hidden = !text;
  }

  /* ---------- Anmeldung ---------- */

  function markeAnfang() {
    return '<section class="anmeldung__marke"><img class="anmeldung__logo" src="img/logo-negativ.svg" alt="R+V">';
  }

  function zeigeAnmeldung() {
    var titel = zustand.daten.einstellungen.titel;
    document.title = titel;
    app.innerHTML =
      '<main class="anmeldung">' + markeAnfang() +
      '<div><p class="topline">Training und Entwicklung Vertrieb</p><h1>' + esc(titel) + "</h1>" +
      "<p>Plan und IST Deiner Kostenstellen und Projektnummern auf einen Blick.</p></div>" +
      '<p class="klein">Version ' + VERSION + "</p></section>" +
      '<section class="anmeldung__form">' +
      '<button type="button" class="icon-btn ecke" data-design aria-label="Hell oder dunkel">' + icon("moon-star") + "</button>" +
      "<form novalidate><h2>Willkommen</h2><p class=\"leise\">Melde Dich bitte mit Deiner XV-Nummer an.</p>" +
      '<div class="feld"><label for="kennung">XV-Nummer</label>' +
      '<input id="kennung" name="kennung" type="text" autocomplete="username" placeholder="xv12345" maxlength="7" required></div>' +
      '<div class="feld"><label for="passwort">Passwort</label>' +
      '<input id="passwort" name="passwort" type="password" autocomplete="current-password" required></div>' +
      '<p class="fehlertext" hidden></p>' +
      '<button type="submit" class="btn btn--primaer" style="width:100%">Anmelden</button>' +
      '<p class="anmeldung__wechsel">Noch keinen Zugang? Wende Dich bitte an Deine Abteilungsleitung.</p>' +
      "</form></section></main>";

    var form = app.querySelector("form");
    app.querySelector("[data-design]").addEventListener("click", function () {
      setzeDesign(aktuellesDesign() === "hell" ? "dunkel" : "hell", window.BDFarben.gewaehlt().farbe);
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var kennung = D.normalisiereKennung(form.kennung.value);
      var passwort = form.passwort.value;
      form.kennung.removeAttribute("aria-invalid");
      if (!D.istGueltigeKennung(kennung)) {
        form.kennung.setAttribute("aria-invalid", "true");
        zeigeFehler(form, "Deine XV-Nummer besteht aus „xv“ und fünf Ziffern, zum Beispiel xv12345.");
        form.kennung.focus();
        return;
      }
      if (!passwort) { zeigeFehler(form, "Gib bitte Dein Passwort ein."); form.passwort.focus(); return; }
      var knopf = form.querySelector("[type=submit]");
      knopf.disabled = true;
      Dienst.anmelden(zustand.daten, kennung, passwort).then(function (r) {
        knopf.disabled = false;
        if (!r) {
          zeigeFehler(form, "XV-Nummer und Passwort passen nicht zusammen. Prüfe bitte Deine Eingabe.");
          form.passwort.value = "";
          form.passwort.focus();
          return;
        }
        uebernehmen(r);
        setzeDesign(r.benutzer.design || "auto", r.benutzer.farbe || "klassik");
        if (!location.hash || location.hash === "#/") location.hash = "#/start";
        zeige();
      }, function (f) {
        knopf.disabled = false;
        zeigeFehler(form, f && f.code ? f.message : "Die Anmeldung hat nicht geklappt. Lade die Seite bitte neu.");
      });
    });
    form.kennung.focus();
  }

  function zeigePasswortFestlegen() {
    var b = zustand.benutzer;
    app.innerHTML =
      '<main class="anmeldung">' + markeAnfang() +
      '<div><p class="topline">Erste Anmeldung</p><h1>' + esc(D.begruessung()) + ", " + esc(b.vorname || b.kennung) + "</h1>" +
      "<p>Du hast Dich mit Deinem Einmalpasswort angemeldet. Wähle jetzt Dein eigenes Passwort. Danach geht es direkt zu Deinem Budgetdashboard.</p></div><span></span></section>" +
      '<section class="anmeldung__form"><form novalidate>' +
      "<h2>Passwort festlegen</h2>" +
      '<div class="feld"><label for="neu">Neues Passwort</label><input id="neu" name="neu" type="password" autocomplete="new-password">' +
      '<ul class="regeln" id="regeln">' + regelnHtml("", b) + "</ul></div>" +
      '<div class="feld"><label for="wdh">Neues Passwort wiederholen</label><input id="wdh" name="wdh" type="password" autocomplete="new-password"></div>' +
      '<p class="fehlertext" hidden></p>' +
      '<div class="knopfreihe"><button type="submit" class="btn btn--primaer">Passwort speichern</button>' +
      '<button type="button" class="btn btn--rahmen" data-abmelden>Abmelden</button></div>' +
      "</form></section></main>";
    var form = app.querySelector("form");
    form.neu.addEventListener("input", function () { document.getElementById("regeln").innerHTML = regelnHtml(form.neu.value, b); });
    app.querySelector("[data-abmelden]").addEventListener("click", abmelden);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var neu = form.neu.value;
      var maengel = D.passwortMaengel(neu, b);
      if (maengel.length) { zeigeFehler(form, "Dein Passwort braucht noch " + maengel.join(", ") + "."); return; }
      if (neu !== form.wdh.value) { zeigeFehler(form, "Die beiden Passwörter sind verschieden. Gib sie bitte noch einmal ein."); return; }
      Dienst.passwortSetzen(zustand.daten, b, null, neu).then(function (text) {
        if (text) { zeigeFehler(form, text); return; }
        meldung("Dein Passwort ist gespeichert.");
        gehe("#/start");
      }, serverFehler);
    });
    form.neu.focus();
  }

  function abmelden() {
    zustand.benutzer = null;
    history.replaceState(null, "", location.pathname + location.search);
    return Dienst.abmelden(zustand.daten).then(function (daten) {
      zustand.daten = daten;
      zeige();
    });
  }

  /* ---------- Rahmen ---------- */

  function navigation() {
    var b = zustand.benutzer;
    var n = [{ id: "start", name: "Start", icon: "house" }];
    if (D.Rechte.budgets(b)) n.push({ id: "uebersicht", name: "Planbudgets", icon: "money" }, { id: "ist", name: "IST-Werte", icon: "diagramBarchart" });
    if (D.Rechte.benutzer(b)) n.push({ id: "verwaltung", name: "Verwaltung", icon: "settings" });
    return n;
  }

  // BETA-ANMELDEN-ALS Anfang: Hinweisleiste, solange der Administrator als anderer Benutzer angemeldet ist
  function alsAdminHtml() {
    if (!zustand.alsAdmin || !zustand.benutzer) return "";
    return '<div class="als-admin" role="status">' + icon("infoCircleFilled") + "<span><strong>Beta:</strong> Du bist als " + esc(D.anzeigeName(zustand.benutzer)) + " (" + esc(zustand.benutzer.kennung) + ") angemeldet und siehst das Tool mit deren Rechten.</span>" +
      '<button type="button" class="btn btn--rahmen" data-zurueck-admin>' + icon("login") + " Zurück zum Administrator</button></div>";
  }
  // BETA-ANMELDEN-ALS Ende

  function kopfHtml(aktiv) {
    var b = zustand.benutzer;
    return alsAdminHtml() /* BETA-ANMELDEN-ALS */ + '<header class="kopf"><div class="kopf__leiste">' +
      '<a class="kopf__marke" href="#/start"><img class="logo-hell" src="img/logo-positiv.svg" alt="R+V"><img class="logo-dunkel" src="img/logo-negativ.svg" alt="R+V">' +
      '<span class="kopf__titel">' + esc(zustand.daten.einstellungen.titel) + "</span></a>" +
      '<nav class="kopf__nav" aria-label="Hauptnavigation">' + navigation().map(function (n) {
        return '<a href="#/' + n.id + '"' + (aktiv === n.id ? ' aria-current="page"' : "") + ">" + icon(n.icon) + ' <span class="nav-text">' + esc(n.name) + "</span></a>";
      }).join("") + "</nav>" +
      '<div class="kopf__rechts">' +
      '<button type="button" class="icon-btn" data-design aria-label="Zum ' + (aktuellesDesign() === "hell" ? "dunklen" : "hellen") + ' Design wechseln">' + icon("moon-star") + "</button>" +
      '<div class="menue"><button type="button" class="avatar" data-menue aria-haspopup="true" aria-expanded="false" aria-label="Menü für ' + esc(D.anzeigeName(b)) + '">' + esc(initialen(b)) + "</button>" +
      '<div class="menue__liste" hidden>' +
      '<div class="menue__kopf"><strong>' + esc(D.anzeigeName(b)) + '</strong><br><span class="leise klein">' + esc(b.kennung) + " · " + esc(D.rollenName(b.rolle)) + "</span></div>" +
      '<a href="#/profil">' + icon("person") + "Mein Profil</a>" +
      '<a href="#/handbuch">' + icon("bookOpen") + "Handbuch</a>" +
      '<button type="button" data-abmelden>' + icon("logout") + "Abmelden</button>" +
      "</div></div></div></div></header>";
  }

  function fussHtml() {
    return '<footer class="fuss"><span>' + esc(zustand.daten.einstellungen.titel) + " · Version " + VERSION + "</span>" +
      (Dienst.modus === "browser" ? "<span>Browserbetrieb: Die Daten liegen nur in diesem Browser.</span>" : "") + "</footer>";
  }

  function seite(aktiv, titel, inhalt, breit) {
    document.title = (titel ? titel + " · " : "") + zustand.daten.einstellungen.titel;
    breit = true; // alle Seiten nutzen die ganze Breite
    app.innerHTML = kopfHtml(aktiv) + '<main class="seite' + (breit ? " seite--breit" : "") + '" id="inhalt">' + druckkopfHtml(titel) + inhalt + "</main>" + fussHtml();
    // BETA-ANMELDEN-ALS Anfang
    app.querySelectorAll("[data-zurueck-admin]").forEach(function (k) {
      k.addEventListener("click", function () {
        Dienst.zurueckAlsAdmin().then(function (r) { uebernehmen(r); setzeDesign(r.benutzer.design || "auto", r.benutzer.farbe || "klassik"); location.hash = "#/verwaltung/benutzer"; zeige(); meldung("Du bist wieder als Administrator angemeldet."); }, serverFehler);
      });
    });
    // BETA-ANMELDEN-ALS Ende
    app.querySelectorAll("[data-design]").forEach(function (k) {
      k.addEventListener("click", function () {
        setzeDesign(aktuellesDesign() === "hell" ? "dunkel" : "hell", window.BDFarben.gewaehlt().farbe, true);
        zeige();
      });
    });
    app.querySelectorAll("[data-abmelden]").forEach(function (k) { k.addEventListener("click", abmelden); });
    var menueKnopf = app.querySelector("[data-menue]");
    var liste = app.querySelector(".menue__liste");
    menueKnopf.addEventListener("click", function (e) {
      e.stopPropagation();
      var offen = liste.hidden;
      liste.hidden = !offen;
      menueKnopf.setAttribute("aria-expanded", String(offen));
    });
    liste.addEventListener("keydown", function (e) { if (e.key === "Escape") { liste.hidden = true; menueKnopf.focus(); } });
  }

  /* Im Artefakt (eingebettet) gibt es keinen Druckdialog, dort fehlt der PDF-Knopf */
  var imRahmen = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

  function jahrwahlHtml() {
    return '<div class="kopfaktionen"><label class="jahrwahl"><span>Kalenderjahr</span><select data-jahr>' + D.jahre(zustand.daten).map(function (j) {
      return '<option value="' + j + '"' + (j === zustand.jahr ? " selected" : "") + ">" + j + "</option>";
    }).join("") + "</select></label>" +
      '<button type="button" class="btn btn--rahmen" data-excel title="Planbudgets, IST-Werte und Projektkosten des Kalenderjahres als Excel-Datei">' + icon("documentXls") + " Als Excel herunterladen</button>" +
      (imRahmen ? "" : '<button type="button" class="btn btn--rahmen" data-pdf title="Öffnet den Druckdialog. Wähle dort „Als PDF speichern“.">' + icon("documentPdf") + " Als PDF speichern</button>") + "</div>";
  }

  function verbindeJahrwahl() {
    var s = app.querySelector("[data-jahr]");
    if (s) s.addEventListener("change", function () { zustand.jahr = Number(s.value); protokollAnzahl = 30; zeige(); });
    var xls = app.querySelector("[data-excel]");
    if (xls) xls.addEventListener("click", excelHerunterladen);
    var pdf = app.querySelector("[data-pdf]");
    if (pdf) pdf.addEventListener("click", function () { window.print(); });
  }

  /* Datei speichern: im Claude-Artefakt über die Plattform (mit Rückfrage), sonst über einen Download-Link */
  function dateiSpeichern(name, blob, fehlerText) {
    if (window.claude && typeof window.claude.use === "function") {
      return window.claude.use("downloads").then(function (dl) {
        if (!dl) { meldung("Hier kann das Tool keine Dateien speichern.", true); return; }
        return dl.save({ filename: name, data: blob }).catch(function (f) { if (!f || f.code !== "declined") meldung(fehlerText, true); });
      });
    }
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    return Promise.resolve();
  }

  function heuteIso() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }

  function datumDe(iso) { var t = String(iso || "").slice(0, 10).split("-"); return t.length === 3 ? t[2] + "." + t[1] + "." + t[0] : ""; }

  /* Excel-Datei mit drei Blättern aus allem, was die angemeldete Person im gewählten Kalenderjahr sieht */
  function excelBlaetter() {
    var daten = zustand.daten, jahr = zustand.jahr;
    function eur(v, fett) { return { wert: v, stil: fett ? "eurFett" : "eur" }; }
    function k(t) { return { wert: t, stil: "kopf" }; }
    var posten = D.POSITIONEN.map(function (p) { return p.name; });
    var plan = [[k("Art"), k("Nummer"), k("Gehört zu")].concat(posten.map(k), [k("Sachkosten"), k("Planbudget (eingetragen)"), k("Gesamtbudget")])];
    var ist = [[k("Art"), k("Nummer"), k("Stand"), k("Gebucht bis")].concat(posten.map(k), [k("Sachkosten"), k("IST"), k("Gesamtbudget"), k("IST in % vom Plan")])];
    D.liste(daten, "ks").forEach(function (n) {
      var w = D.budgetVon(daten, jahr, "ks", n.nummer), g = D.gesamtBudgetVon(daten, jahr, "ks", n.nummer).gesamt;
      var oben = D.uebergeordnete(daten, n.nummer);
      plan.push(["Kostenstelle", n.nummer, oben ? "Kostenstelle " + oben : ""].concat(w.vorhanden
        ? D.POSITIONEN.map(function (p) { return eur(w[p.id]); }).concat([eur(w.sachkosten), eur(w.gesamt, true), eur(g.gesamt, true)])
        : ["kein Planbudget"]));
      var i = D.gesamtIstVon(daten, jahr, "ks", n.nummer).gesamt;
      ist.push(["Kostenstelle", n.nummer].concat(i.vorhanden
        ? [datumDe(i.stand), i.monat ? String(i.monat).slice(5) + "." + String(i.monat).slice(0, 4) : ""].concat(D.POSITIONEN.map(function (p) { return eur(i[p.id]); }),
          [eur(i.sachkosten), eur(i.gesamt, true), g.gesamt > 0 ? eur(g.gesamt) : "", g.gesamt > 0 ? { wert: i.gesamt / g.gesamt, stil: "prozent" } : ""])
        : ["keine IST-Werte"]));
    });
    D.liste(daten, "pn").forEach(function (n) {
      var w = D.budgetVon(daten, jahr, "pn", n.nummer), i = D.projektIstVon(daten, jahr, n.nummer);
      plan.push(["Projektnummer", n.nummer, n.ks ? "Kostenstelle " + n.ks : ""].concat(w.vorhanden ? ["", "", "", "", "", "", eur(w.gesamt, true), eur(w.gesamt, true)] : ["kein Planbudget"]));
      ist.push(["Projektnummer", n.nummer].concat(i.vorhanden
        ? [datumDe(i.stand), "", "", "", "", "", "", "", eur(i.gesamt, true), w.gesamt > 0 ? eur(w.gesamt) : "", w.gesamt > 0 ? { wert: i.gesamt / w.gesamt, stil: "prozent" } : ""]
        : ["noch keine Kosten erfasst"]));
    });
    var kosten = [[k("Projektnummer"), k("Kostenstelle"), k("Datum"), k("Betrag"), k("Beschreibung"), k("Erfasst von")]];
    (daten.kosten || []).filter(function (x) { return x.datum.slice(0, 4) === String(jahr); }).sort(function (a, b) {
      return a.pn === b.pn ? (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0) : a.pn < b.pn ? -1 : 1;
    }).forEach(function (x) {
      var n = D.findeNummer(daten, "pn", x.pn);
      kosten.push([x.pn, n && n.ks ? n.ks : "", datumDe(x.datum), eur(x.betrag), x.text || "", nameVon(x.von)]);
    });
    var breitePosten = posten.map(function () { return 16; });
    return [
      { name: "Planbudgets " + jahr, kopfzeilen: 1, breiten: [15, 12, 17].concat(breitePosten, [16, 22, 18]), zeilen: plan },
      { name: "IST-Werte " + jahr, kopfzeilen: 1, breiten: [15, 12, 12, 12].concat(breitePosten, [16, 18, 18, 16]), zeilen: ist },
      { name: "Projektkosten " + jahr, kopfzeilen: 1, breiten: [15, 13, 12, 16, 50, 24], zeilen: kosten }
    ];
  }

  function excelHerunterladen() {
    var blob;
    try {
      blob = new Blob([window.BDExcel.arbeitsmappeSchreiben(excelBlaetter())], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    } catch (f) { meldung("Die Excel-Datei ließ sich gerade nicht erstellen. Probiere es bitte noch einmal.", true); return; }
    dateiSpeichern("Budgetdashboard_" + zustand.jahr + "_" + heuteIso() + ".xlsx", blob, "Die Excel-Datei ließ sich gerade nicht speichern. Probiere es bitte noch einmal.");
  }

  /* Drucken und PDF: immer im hellen Standarddesign, danach zurück zum gewählten Design */
  var vorDruck = null;
  window.addEventListener("beforeprint", function () {
    if (vorDruck || !window.BDFarben) return;
    vorDruck = window.BDFarben.gewaehlt();
    window.BDFarben.anwenden("hell", "klassik");
  });
  window.addEventListener("afterprint", function () {
    if (!vorDruck) return;
    window.BDFarben.anwenden(vorDruck.modus, vorDruck.farbe);
    vorDruck = null;
  });

  function druckkopfHtml(titel) {
    var b = zustand.benutzer, jetzt = new Date();
    return '<div class="druckkopf" aria-hidden="true"><img src="img/logo-positiv.svg" alt=""><div><strong>' + esc(zustand.daten.einstellungen.titel) + (titel ? " · " + esc(titel) : "") + "</strong>" +
      "<span>Erstellt am " + esc(jetzt.toLocaleDateString("de-DE")) + ", " + esc(jetzt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })) + " Uhr" + (b ? " von " + esc(D.anzeigeName(b)) : "") + "</span></div></div>";
  }

  /* ---------- Planbudget-Darstellung ---------- */

  /* Balken mit den Anteilen von Personalkosten ID, Personalkosten AD und Sachkosten */
  function anteilHtml(w) {
    if (!w.gesamt) return "";
    var teile = [["pkId", "Personalkosten ID", w.pkId], ["pkAd", "Personalkosten AD", w.pkAd], ["sach", "Sachkosten", w.sachkosten]];
    if (w.projekt > 0) teile.push(["projekt", "Projektnummern", w.projekt]);
    return '<div class="anteil" role="img" aria-label="Aufteilung: ' + teile.map(function (t) { return t[1] + " " + Math.round(t[2] / w.gesamt * 100) + " %"; }).join(", ") + '">' +
      teile.filter(function (t) { return t[2] > 0; }).map(function (t) {
        return '<span class="anteil__teil anteil__teil--' + t[0] + '" style="width:' + (t[2] / w.gesamt * 100).toFixed(2) + '%"></span>';
      }).join("") + "</div>" +
      '<ul class="legende">' + teile.map(function (t) {
        return '<li><span class="legende__punkt legende__punkt--' + t[0] + '"></span>' + esc(t[1]) + ' <span class="leise">' + Math.round(t[2] / w.gesamt * 100) + " %</span></li>";
      }).join("") + "</ul>";
  }

  function positionenHtml(w) {
    return '<table class="positionen"><tbody>' +
      "<tr><th scope=\"row\">Personalkosten ID</th><td class=\"zahl\">" + euro(w.pkId) + "</td></tr>" +
      "<tr><th scope=\"row\">Personalkosten AD</th><td class=\"zahl\">" + euro(w.pkAd) + "</td></tr>" +
      '<tr class="positionen__bereich"><th scope="row">Sachkosten</th><td class="zahl">' + euro(w.sachkosten) + "</td></tr>" +
      '<tr class="positionen__unter"><th scope="row">Werbung</th><td class="zahl">' + euro(w.werbung) + "</td></tr>" +
      '<tr class="positionen__unter"><th scope="row">Reise/KfZ</th><td class="zahl">' + euro(w.reise) + "</td></tr>" +
      '<tr class="positionen__unter"><th scope="row">Sonstiges</th><td class="zahl">' + euro(w.sonstiges) + "</td></tr>" +
      '</tbody><tfoot><tr><th scope="row">Planbudget gesamt</th><td class="zahl">' + euro(w.gesamt) + "</td></tr></tfoot></table>";
  }

  /* ---------- IST gegen Plan ---------- */

  function prozent(q, vz) { return esc(D.prozentText(q, vz)); }

  function istUeberschrift(ist) {
    if (!ist.monat) return "IST " + zustand.jahr + " (erfasste Kosten)";
    return "IST " + zustand.jahr + (ist.bisMonat < 12 ? " bis " + D.monatName(ist.monat) : " gesamt");
  }

  function standHtml(ist) {
    return '<p class="stand">' + icon("calendar") + "<span>" + esc(D.standText(ist.stand, ist.monat)) +
      (ist.unterschiedlich ? (ist.ohneEigenImport ? " (ältester Teil)" : ", Unterkostenstellen mit anderem Stand") : "") + "</span></p>";
  }

  /* Balken: IST in Prozent vom Plan, Strich = verstrichener Anteil des Jahres */
  function fortschrittHtml(k) {
    var breite = k.quote === null ? 0 : Math.max(0, Math.min(1, k.quote)) * 100;
    return '<div class="fortschritt fortschritt--' + (k.ampel || "leer") + '" role="img" aria-label="IST ' + esc(D.prozentText(k.quote)) + " vom Plan, " +
      Math.round(k.zeitanteil * 100) + ' % des Jahres vergangen"><span class="fortschritt__balken" style="width:' + breite.toFixed(2) + '%"></span>' +
      '<span class="fortschritt__zeit" style="left:' + (k.zeitanteil * 100).toFixed(2) + '%"></span></div>';
  }

  function ampelText(k) {
    return { rot: "über Plan", gelb: "knapp", gruen: "im Plan" }[k.ampel] || "ohne Plan";
  }

  /* IST-Bereich einer Karte: Stand, Anteil vom Plan, wichtigste Werte und Positionen */
  function istBereichHtml(art, plan, ist, vj) {
    var titel = art === "pn" ? "IST " + zustand.jahr + " (erfasste Kosten)" : istUeberschrift(ist);
    if (!ist.vorhanden) {
      return "<h3>" + esc(art === "pn" ? "IST " + zustand.jahr : "IST " + zustand.jahr) + "</h3>" + '<p class="leer-hinweis">' +
        (art === "pn" ? "Für " + zustand.jahr + " sind noch keine Projektkosten erfasst."
          : "Für " + zustand.jahr + " gibt es noch keine IST-Werte. Sie kommen aus dem KST-Bericht, den die Abteilungsleitung importiert.") + "</p>";
    }
    var k = D.kennzahlen(plan, ist);
    return "<h3>" + esc(titel) + "</h3>" + standHtml(ist) +
      (plan.vorhanden
        ? '<p class="ist__quote"><strong>' + prozent(k.quote) + "</strong> vom Planbudget ausgegeben</p>" + fortschrittHtml(k) +
          '<p class="fortschritt__legende leise klein">Strich: ' + Math.round(k.zeitanteil * 100) + " % des Jahres sind gebucht.</p>"
        : '<p class="leise klein">Ohne Planbudget gibt es keinen Vergleich.</p>') +
      '<dl class="ist__werte">' +
      "<div><dt>IST</dt><dd>" + euro(k.ist) + "</dd></div>" +
      (plan.vorhanden ? "<div><dt>Restbudget</dt><dd" + (k.rest < 0 ? ' class="minus"' : "") + ">" + euro(k.rest) + "</dd></div>" : "") +
      (plan.vorhanden && ist.bisMonat < 12 ? "<div><dt>Zum zeitanteiligen Plan</dt><dd>" + zzvHtml(k) + "</dd></div><div><dt>Hochrechnung Jahresende</dt><dd>" + euro(k.hochrechnung) + "</dd></div>" : "") +
      (k.vorjahr !== null ? "<div><dt>Vorjahr gleicher Zeitraum</dt><dd>" + euro(k.vorjahr) + ' <span class="leise">' + prozent(k.vorjahrQuote, true) + "</span></dd></div>" : "") +
      (art === "ks" && ist.projekte && ist.projekte.gesamt ? "<div><dt>davon Projektkosten</dt><dd>" + euro(ist.projekte.gesamt) + "</dd></div>" : "") +
      "</dl>" + (art === "pn" ? '<p class="leise klein">' + ist.anzahl + (ist.anzahl === 1 ? " Eintrag" : " Einträge") + " ohne Kostenarten, Details auf der Seite der Projektnummer.</p>" : istPositionenHtml(plan, ist, vj));
  }

  /* IST je Position mit Anteil vom Plan (über 100 % rot), dazu das ganze Vorjahr, wenn es importiert ist */
  function istPositionenHtml(plan, ist, vj) {
    function zeile(name, id, klasse) {
      var q = plan[id] > 0 ? ist[id] / plan[id] : null;
      return "<tr" + (klasse ? ' class="' + klasse + '"' : "") + '><th scope="row">' + name + "</th>" + (vj ? '<td class="zahl leise">' + euro(vj[id]) + "</td>" : "") + '<td class="zahl">' + euro(ist[id]) + "</td>" +
        '<td class="zahl' + (q !== null && q > 1 ? " minus" : " leise") + '">' + prozent(q) + "</td></tr>";
    }
    return '<table class="positionen positionen--ist"><thead><tr><th><span class="sr">Position</span></th>' + (vj ? '<th class="zahl" title="IST des ganzen Vorjahres">' + (zustand.jahr - 1) + " gesamt</th>" : "") + '<th class="zahl">IST</th><th class="zahl">vom Plan</th></tr></thead><tbody>' +
      zeile("Personalkosten ID", "pkId") + zeile("Personalkosten AD", "pkAd") + zeile("Sachkosten", "sachkosten", "positionen__bereich") +
      zeile("Werbung", "werbung", "positionen__unter") + zeile("Reise/KfZ", "reise", "positionen__unter") + zeile("Sonstiges", "sonstiges", "positionen__unter") +
      '</tbody><tfoot><tr><th scope="row">Gesamt</th>' + (vj ? '<td class="zahl leise">' + euro(vj.gesamt) + "</td>" : "") + '<td class="zahl">' + euro(ist.gesamt) + '</td><td class="zahl">' + prozent(plan.gesamt > 0 ? ist.gesamt / plan.gesamt : null) + "</td></tr></tfoot></table>";
  }

  /* IST des ganzen Vorjahres (Spalte „12 / Vorjahr“ der bisherigen Excel-Liste), nur wenn vollständig importiert */
  function vorjahrGesamt(nummer) {
    var v = D.gesamtIstVon(zustand.daten, zustand.jahr - 1, "ks", nummer).gesamt;
    return v.vorhanden && v.bisMonat === 12 ? v : null;
  }

  /* Kleiner Balken für Tabellen */
  function balkenHtml(k) {
    if (!k || k.quote === null) return '<span class="leise">–</span>';
    return '<span class="mini"><span class="fortschritt fortschritt--klein fortschritt--' + (k.ampel || "leer") + '" aria-hidden="true"><span class="fortschritt__balken" style="width:' +
      (Math.max(0, Math.min(1, k.quote)) * 100).toFixed(1) + '%"></span><span class="fortschritt__zeit" style="left:' + (k.zeitanteil * 100).toFixed(1) + '%"></span></span><strong>' + prozent(k.quote) + "</strong></span>";
  }

  /* IST zum zeitanteiligen Plan (wie „IST / Plan ZZV“ in der bisherigen Excel-Liste): IST / (Plan × gebuchte Monate / 12) */
  function zzvAus(q) { return { hochQuote: q, ampel: q === null ? null : D.ampelVon(q) }; }

  function zzvHtml(k) {
    if (!k || k.hochQuote === null) return '<span class="leise">–</span>';
    return '<span class="zzv zzv--' + k.ampel + '">' + prozent(k.hochQuote) + ' <span class="zzv__text">' + esc(ampelText(k)) + "</span></span>";
  }

  /* Balkendiagramm Plan, IST und Vorjahr je Kostenart; eine Skala, Werte direkt am Balken */
  function diagrammHtml(plan, ist, vorjahr, hinweis) {
    var reihen = [{ id: "plan", name: "Plan " + zustand.jahr, w: plan }, { id: "ist", name: ist.monat ? istUeberschrift(ist) : "IST " + zustand.jahr, w: ist }];
    if (vorjahr) reihen.push({ id: "vj", name: "IST " + (zustand.jahr - 1) + (ist.monat && ist.bisMonat < 12 ? " bis " + D.monatName(ist.monat) : " gesamt"), w: vorjahr });
    var gruppen = [["pkAd", "Personalkosten AD"], ["pkId", "Personalkosten ID"], ["sachkosten", "Sachkosten"]];
    if (reihen.some(function (r) { return r.w.projekt > 0; })) gruppen.push(["projekt", "Projektnummern ohne Kostenstelle"]);
    var max = 0;
    gruppen.forEach(function (g) { reihen.forEach(function (r) { max = Math.max(max, r.w[g[0]] || 0); }); });
    if (!max) return "";
    return '<figure class="diagramm"><figcaption><strong>Plan und IST nach Kostenarten</strong>' + (hinweis ? ' <span class="leise klein">' + esc(hinweis) + "</span>" : "") + "</figcaption>" +
      '<ul class="diagramm__legende">' + reihen.map(function (r) { return '<li><span class="diagramm__punkt diagramm__punkt--' + r.id + '"></span>' + esc(r.name) + "</li>"; }).join("") + "</ul>" +
      '<div class="diagramm__gruppen">' + gruppen.map(function (g) {
        return '<div class="diagramm__gruppe"><span class="diagramm__titel">' + esc(g[1]) + "</span>" + reihen.map(function (r) {
          var v = r.w[g[0]] || 0;
          return '<div class="diagramm__zeile" title="' + esc(g[1] + " · " + r.name + ": " + D.betragText(v)) + '"><span class="diagramm__balken diagramm__balken--' + r.id + '" style="width:' + (v / max * 100).toFixed(2) + '%"></span>' +
            '<span class="diagramm__wert">' + euro(v) + "</span></div>";
        }).join("") + "</div>";
      }).join("") + "</div></figure>";
  }

  function ampelHtml(k) {
    if (!k || !k.ampel) return '<span class="leise">–</span>';
    return '<span class="ampel ampel--' + k.ampel + '" title="IST zum zeitanteiligen Plan">' + prozent(k.hochQuote) + " · " + esc(ampelText(k)) + "</span>";
  }

  /* Eine Karte je Kostenstelle oder Projektnummer, nie gemischt: links das Planbudget, rechts das IST */
  function budgetKarte(art, nummer) {
    if (art === "ks") return budgetKarteKs(nummer);
    var daten = zustand.daten, jahr = zustand.jahr;
    var g = D.gesamtBudgetVon(daten, jahr, art, nummer), w = g.gesamt;
    var ist = D.gesamtIstVon(daten, jahr, art, nummer).gesamt;
    var oben = art === "ks" ? D.uebergeordnete(daten, nummer) : "";
    var pnKs = art === "pn" ? (D.findeNummer(daten, "pn", nummer) || {}).ks : "";
    var k = ist.vorhanden && w.vorhanden ? D.kennzahlen(w, ist) : null;
    var hinweis = oben ? "Gehört zur übergreifenden Kostenstelle " + oben + "."
      : pnKs ? "Gehört zur Kostenstelle " + pnKs + "."
      : g.uebergreifend ? "Fasst die Kostenstellen " + g.unter.map(function (u) { return u.nummer; }).join(", ") + " zusammen." : "";
    return '<article class="karte budget" id="' + esc("nr-" + art + "-" + nummer) + '" data-nummer="' + esc(art + "-" + nummer) + '">' +
      '<div class="budget__kopf"><div><p class="topline">' + (g.uebergreifend ? "Übergreifende Kostenstelle" : esc(D.ARTEN[art].name)) + "</p>" +
      '<h2 class="budget__nummer">' + esc(nummer) + "</h2>" + (hinweis ? '<p class="leise klein">' + esc(hinweis) + "</p>" : "") + "</div>" +
      (k ? '<div class="budget__status">' + ampelHtml(k) + '<span class="klein"><strong>' + prozent(k.quote) + "</strong> ausgegeben · Rest " + euro(k.rest) + "</span></div>" : "") + "</div>" +
      '<div class="budget__bereiche">' +
      '<section class="budget__bereich" aria-label="Planbudget"><h3>Planbudget ' + jahr + "</h3>" +
      (w.vorhanden
        ? '<p class="budget__gesamt"><strong>' + euro(w.gesamt) + "</strong>" + (g.uebergreifend || g.projektNummern.length ? '<span class="leise klein">Gesamtbudget inklusive ' + (g.uebergreifend ? "Unterkostenstellen" + (g.projektNummern.length ? " und " : "") : "") + (g.projektNummern.length ? "Projektnummern" : "") + "</span>" : "") + "</p>" +
          (art === "pn" ? '<p class="leise klein">Projektnummern haben ein Budget ohne Kostenarten.</p>' : anteilHtml(w) + positionenHtml(w)) + (g.uebergreifend || g.projektNummern.length ? zusammensetzungHtml(g) : "")
        : '<p class="leer-hinweis">Für ' + jahr + " ist noch kein Planbudget eingetragen.</p>") + "</section>" +
      '<section class="budget__bereich budget__bereich--ist" aria-label="IST">' + istBereichHtml(art, w, ist, art === "ks" ? vorjahrGesamt(nummer) : null) + "</section></div>" +
      (g.uebergreifend || art === "pn" ? '<p class="budget__link">' +
        (g.uebergreifend ? '<a class="btn btn--rahmen" href="#/bericht/' + esc(nummer) + '">' + icon("diagramBarchart") + " Bericht ansehen</a>" : "") +
        (art === "pn" ? '<a class="btn ' + (D.Rechte.kosten(zustand.benutzer, daten, nummer) ? "btn--primaer" : "btn--rahmen") + '" href="#/projekt/' + esc(nummer) + '">' + icon("money") +
          (D.Rechte.kosten(zustand.benutzer, daten, nummer) ? " Kosten erfassen und ansehen" : " Projektkosten ansehen") + "</a>" : "") + "</p>" : "") +
      "</article>";
  }

  /* ---------- Karte einer Kostenstelle (Gruppenleitung und alle mit eigener Kostenstelle) ---------- */

  var KOSTENARTEN = [
    { id: "pkId", name: "Personalkosten ID" }, { id: "pkAd", name: "Personalkosten AD" }, { id: "personalkosten", name: "Personalkosten", summe: true },
    { id: "werbung", name: "Werbung", unter: true }, { id: "reise", name: "Reise/KfZ", unter: true }, { id: "sonstiges", name: "Sonstiges", unter: true },
    { id: "sachkosten", name: "Sachkosten", summe: true }
  ];

  /* Auffälligkeiten in Sätzen: Kosten ohne Plan, über dem zeitanteiligen Plan, wann das Budget aufgebraucht ist, Vorjahr */
  function auffaelligkeiten(plan, ist, k) {
    var h = [], mon = ist.bisMonat || 12;
    if (plan.vorhanden && k.ist > k.plan) h.push({ art: "rot", text: "Das Planbudget ist um " + D.betragText(k.ist - k.plan) + " überschritten." });
    else if (plan.vorhanden && mon < 12 && k.ist > 0) {
      var monate = k.plan / (k.ist / mon);
      if (monate < 12) h.push({ art: "rot", text: "Bei gleichem Tempo ist das Planbudget im " + D.MONATE[Math.max(0, Math.ceil(monate) - 1)] + " aufgebraucht. Hochrechnung: " + D.betragText(k.hochrechnung) + "." });
    }
    KOSTENARTEN.forEach(function (z) {
      if (z.summe) return;
      var p = plan[z.id], i = ist[z.id];
      if (!(p > 0) && i > 0) h.push({ art: "rot", text: z.name + ": " + D.betragText(i) + " IST ohne Planbudget." });
      else if (p > 0 && mon < 12 && i / (p * mon / 12) > 1.1) h.push({ art: "gelb", text: z.name + ": " + D.prozentText(i / (p * mon / 12) - 1) + " über dem zeitanteiligen Plan." });
    });
    if (k.vorjahrQuote !== null && Math.abs(k.vorjahrQuote) >= 0.1) h.push({ art: "info", text: "Das IST liegt " + D.prozentText(Math.abs(k.vorjahrQuote)) + (k.vorjahrQuote > 0 ? " über" : " unter") + " dem Vorjahr im gleichen Zeitraum." });
    if (!h.some(function (x) { return x.art === "rot" || x.art === "gelb"; })) h.unshift({ art: "gut", text: "Alle Kostenarten liegen im zeitanteiligen Plan." });
    return '<ul class="hinweise">' + h.slice(0, 5).map(function (x) {
      return '<li class="hinweise__eintrag hinweise__eintrag--' + x.art + '">' + icon(x.art === "gut" ? "checkmarkCircle" : x.art === "info" ? "infoCircleFilled" : "warning") + "<span>" + esc(x.text) + "</span></li>";
    }).join("") + "</ul>";
  }

  /* IST je Kostenart: ausgegeben mit Balken, Restbudget in Euro und Prozent, Hochrechnung und Prognose zum Jahresende */
  function istKostenartenHtml(plan, ist, vj) {
    var mon = ist.bisMonat || 12;
    function zeile(z, klasse) {
      var p = plan.vorhanden ? plan[z.id] : 0, i = ist[z.id], rest = p - i;
      var q = p > 0 ? i / p : null, zq = p > 0 ? i / (p * mon / 12) : null;
      var kk = { quote: q, zeitanteil: mon / 12, ampel: zq === null ? "" : D.ampelVon(zq) };
      var hoch = mon >= 12 ? i : i / mon * 12, prog = p - hoch;
      return "<tr" + (klasse ? ' class="' + klasse + '"' : "") + '><th scope="row">' + esc(z.name) + "</th>" +
        '<td class="zahl"><strong>' + euro(i) + "</strong></td>" +
        '<td class="spalte-balken">' + (q !== null ? balkenHtml(kk) : i > 0 ? '<span class="chip chip--fehler">ohne Plan</span>' : '<span class="leise">–</span>') + "</td>" +
        '<td class="zahl' + (rest < 0 ? " minus" : "") + '">' + (plan.vorhanden ? euro(rest) : "–") + "</td>" +
        '<td class="zahl' + (rest < 0 ? " minus" : " leise") + '">' + (p > 0 ? prozent(rest / p) : "–") + "</td>" +
        '<td class="zahl">' + euro(hoch) + "</td>" +
        '<td class="zahl' + (p > 0 && hoch > p ? " minus" : "") + '">' + (p > 0 ? "<strong>" + prozent(hoch / p) + "</strong>" : "–") + "</td>" +
        '<td class="zahl' + (plan.vorhanden && prog < 0 ? " minus" : plan.vorhanden ? " plus" : "") + '">' + (plan.vorhanden ? (prog > 0 ? "+" : "") + euro(prog) : "–") + "</td>" +
        (vj ? '<td class="zahl leise">' + euro(vj[z.id]) + "</td>" : "") + "</tr>";
    }
    return '<div class="tabelle-huelle"><table class="budgettabelle kostenarten"><thead><tr><th>Kostenart</th><th class="zahl">IST</th><th>vom Plan</th>' +
      '<th class="zahl">Restbudget</th><th class="zahl">Rest in %</th><th class="zahl" title="IST gleichmäßig bis Dezember fortgeschrieben">Hochrechnung</th><th class="zahl" title="Hochrechnung im Verhältnis zum Planbudget">Prognose in %</th><th class="zahl" title="Plan minus Hochrechnung: Plus bleibt übrig, Minus wird überschritten">Prognose Rest</th>' +
      (vj ? '<th class="zahl">IST ' + (zustand.jahr - 1) + " gesamt</th>" : "") + "</tr></thead><tbody>" +
      KOSTENARTEN.map(function (z) { return zeile(z, z.summe ? "teilsumme" : z.unter ? "einrueck" : ""); }).join("") +
      "</tbody><tfoot>" + zeile({ id: "gesamt", name: "Gesamt" }, "") + "</tfoot></table></div>";
  }

  /* Plan je Kostenart mit Anteil am Planbudget */
  function planKostenartenHtml(plan) {
    function zeile(z, klasse) {
      return "<tr" + (klasse ? ' class="' + klasse + '"' : "") + '><th scope="row">' + esc(z.name) + '</th><td class="zahl">' + euro(plan[z.id]) + '</td><td class="zahl leise">' + (plan.gesamt > 0 ? prozent(plan[z.id] / plan.gesamt) : "–") + "</td></tr>";
    }
    return '<div class="tabelle-huelle"><table class="budgettabelle kostenarten"><thead><tr><th>Kostenart</th><th class="zahl">Plan</th><th class="zahl">Anteil</th></tr></thead><tbody>' +
      KOSTENARTEN.map(function (z) { return zeile(z, z.summe ? "teilsumme" : z.unter ? "einrueck" : ""); }).join("") +
      "</tbody><tfoot>" + zeile({ id: "gesamt", name: "Gesamt" }, "") + "</tfoot></table></div>";
  }

  /* Prognose als Verlauf über das Jahr: zeitanteiliger Plan, IST bis zum gebuchten Monat, gleichmäßig fortgeschrieben bis Dezember,
     Vorjahr (gleicher Zeitraum und ganzes Jahr) zum Vergleich. Eine Skala, Werte direkt am Linienende. */
  function prognoseHtml(plan, ist, vj) {
    var mon = ist.bisMonat || 12, hoch = mon >= 12 ? ist.gesamt : ist.gesamt / mon * 12;
    var vjm = ist.vergleich ? ist.vergleich.gesamt : null, vjg = vj ? vj.gesamt : null;
    var max = Math.max(plan.vorhanden ? plan.gesamt : 0, hoch, vjg || 0, vjm || 0) * 1.08 || 1;
    var B = 680, H = 240, L = 8, R = 190, T = 14, U = 30, w = B - L - R, h = H - T - U;
    function x(m) { return (L + m / 12 * w).toFixed(1); }
    function y(v) { return (T + h - v / max * h).toFixed(1); }
    function linie(punkte, klasse, titel) { return '<polyline class="prognose__linie prognose__linie--' + klasse + '" points="' + punkte.map(function (pt) { return x(pt[0]) + "," + y(pt[1]); }).join(" ") + '"><title>' + esc(titel) + "</title></polyline>"; }
    function marke(m, v, klasse, titel) { return '<circle class="prognose__punkt prognose__punkt--' + klasse + '" cx="' + x(m) + '" cy="' + y(v) + '" r="4.5"><title>' + esc(titel) + "</title></circle>"; }
    var labels = [];
    function label(v, text, klasse) { labels.push({ y: Number(y(v)), text: text, klasse: klasse }); }
    var svg = "";
    [0.25, 0.5, 0.75, 1].forEach(function (f) { svg += '<line class="prognose__raster" x1="' + L + '" x2="' + (L + w) + '" y1="' + y(max * f / 1.08) + '" y2="' + y(max * f / 1.08) + '"></line>'; });
    svg += '<line class="prognose__basis" x1="' + L + '" x2="' + (L + w) + '" y1="' + y(0) + '" y2="' + y(0) + '"></line>';
    for (var m = 1; m <= 12; m++) if (m % 3 === 0 || m === mon) svg += '<text class="prognose__achse" x="' + x(m) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(D.MONATE[m - 1].slice(0, 3)) + "</text>";
    svg += '<line class="prognose__heute" x1="' + x(mon) + '" x2="' + x(mon) + '" y1="' + T + '" y2="' + (T + h) + '"></line>';
    if (plan.vorhanden) {
      svg += '<line class="prognose__planlinie" x1="' + L + '" x2="' + (L + w) + '" y1="' + y(plan.gesamt) + '" y2="' + y(plan.gesamt) + '"></line>';
      svg += linie([[0, 0], [12, plan.gesamt]], "plan", "Zeitanteiliger Plan: " + D.betragText(plan.gesamt * mon / 12) + " bis " + D.MONATE[mon - 1]);
      label(plan.gesamt, "Plan " + D.betragText(plan.gesamt), "plan");
    }
    if (vjg !== null && vjm !== null) { svg += linie([[0, 0], [mon, vjm], [12, vjg]], "vj", "Vorjahr: " + D.betragText(vjm) + " bis " + D.MONATE[mon - 1] + ", " + D.betragText(vjg) + " gesamt"); label(vjg, "Vorjahr " + D.betragText(vjg), "vj"); }
    svg += linie([[0, 0], [mon, ist.gesamt]], "ist", "IST bis " + D.MONATE[mon - 1] + ": " + D.betragText(ist.gesamt));
    if (mon < 12) svg += linie([[mon, ist.gesamt], [12, hoch]], "prognose", "Prognose Dezember: " + D.betragText(hoch));
    svg += marke(mon, ist.gesamt, "ist", "IST bis " + D.MONATE[mon - 1] + ": " + D.betragText(ist.gesamt));
    if (mon < 12) { svg += marke(12, hoch, "prognose", "Prognose Dezember: " + D.betragText(hoch)); label(hoch, "Prognose " + D.betragText(hoch), "ist"); }
    else label(ist.gesamt, "IST " + D.betragText(ist.gesamt), "ist");
    /* Beschriftungen am rechten Rand ohne Überlappung */
    labels.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 15) labels[i].y = labels[i - 1].y + 15;
    labels.forEach(function (l) { svg += '<text class="prognose__label prognose__label--' + l.klasse + '" x="' + (L + w + 8) + '" y="' + (l.y + 4).toFixed(1) + '">' + esc(l.text) + "</text>"; });
    var diff = plan.vorhanden ? plan.gesamt - hoch : null;
    return '<figure class="prognose"><figcaption><strong>Prognose bis Dezember</strong> <span class="leise klein">' +
      (mon < 12 ? "IST bis " + esc(D.MONATE[mon - 1]) + ", danach gleichmäßig fortgeschrieben" : "ganzes Jahr gebucht") + "</span></figcaption>" +
      '<ul class="diagramm__legende"><li><span class="prognose__muster prognose__muster--ist"></span>IST <span class="prognose__wert">' + euro(ist.gesamt) + "</span></li>" +
      (mon < 12 ? '<li><span class="prognose__muster prognose__muster--prognose"></span>Prognose <span class="prognose__wert">' + euro(hoch) + "</span></li>" : "") +
      (plan.vorhanden ? '<li><span class="prognose__muster prognose__muster--plan"></span>Plan zeitanteilig <span class="prognose__wert">' + euro(plan.gesamt) + "</span></li>" : "") +
      (vjg !== null && vjm !== null ? '<li><span class="prognose__muster prognose__muster--vj"></span>Vorjahr <span class="prognose__wert">' + euro(vjg) + "</span></li>" : "") + "</ul>" +
      '<svg class="prognose__svg" viewBox="0 0 ' + B + " " + H + '" role="img" aria-label="Prognose: ' + esc(D.betragText(hoch)) + " zum Jahresende" + (diff !== null ? ", Plan " + esc(D.betragText(plan.gesamt)) : "") + '">' + svg + "</svg>" +
      (diff !== null ? '<p class="prognose__fazit ' + (diff < 0 ? "minus" : "plus") + '">' + (plan.gesamt > 0 ? "Prognose: " + esc(D.prozentText(hoch / plan.gesamt)) + " vom Planbudget ausgeschöpft. " : "") +
        (diff < 0 ? "Bei gleichem Tempo wird das Planbudget um " + esc(D.betragText(-diff)) + " überschritten."
        : "Bei gleichem Tempo bleiben zum Jahresende " + esc(D.betragText(diff)) + " übrig.") + "</p>" : "") + "</figure>";
  }

  function budgetKarteKs(nummer) {
    var daten = zustand.daten, jahr = zustand.jahr;
    var g = D.gesamtBudgetVon(daten, jahr, "ks", nummer), w = g.gesamt;
    var gi = D.gesamtIstVon(daten, jahr, "ks", nummer), ist = gi.gesamt;
    var oben = D.uebergeordnete(daten, nummer), vj = vorjahrGesamt(nummer);
    var k = ist.vorhanden ? D.kennzahlen(w, ist) : null, mon = ist.vorhanden ? ist.bisMonat || 12 : 0;
    var hinweis = oben ? "Unterkostenstelle von " + oben : g.uebergreifend ? "Mit den Unterkostenstellen " + g.unter.map(function (u) { return u.nummer; }).join(", ") : "";
    function kpi(titel, wert, unter, klasse) {
      return '<div class="kpi' + (klasse ? " " + klasse : "") + '"><span class="kpi__titel">' + esc(titel) + '</span><strong class="kpi__wert">' + wert + "</strong>" + (unter ? '<span class="kpi__unter">' + unter + "</span>" : "") + "</div>";
    }
    var kpis = kpi("Planbudget " + jahr, w.vorhanden ? euro(w.gesamt) : "–", w.vorhanden ? (g.uebergreifend || g.projektNummern.length ? "inklusive " + (g.uebergreifend ? "Unterkostenstellen" : "Projektnummern") : "Personal- und Sachkosten") : "noch nicht eingetragen");
    if (k) {
      var restMonate = 12 - mon;
      kpis += kpi(istUeberschrift(ist), euro(k.ist), w.vorhanden ? "<strong>" + prozent(k.quote) + "</strong> vom Plan" : "kein Plan zum Vergleich") +
        (w.vorhanden ? kpi("Restbudget", euro(k.rest), k.rest < 0 ? "überschritten" : restMonate > 0 ? euro(k.rest / restMonate) + " je Restmonat" : prozent(k.rest / k.plan) + " vom Plan", k.rest < 0 ? "kpi--minus" : "") : "") +
        (w.vorhanden && mon < 12 ? kpi("Hochrechnung Jahresende", euro(k.hochrechnung), (k.plan > 0 ? "<strong>" + prozent(k.hochrechnung / k.plan) + "</strong> vom Plan · " : "") + (k.abweichung > 0 ? "+" : "") + euro(k.abweichung) + " zum Plan", k.abweichung > 0 ? "kpi--minus" : "") : "") +
        (k.vorjahr !== null ? kpi("Vorjahr gleicher Zeitraum", euro(k.vorjahr), prozent(k.vorjahrQuote, true) + " Veränderung") : "");
    }
    return '<article class="karte budget budget--ks" id="' + esc("nr-ks-" + nummer) + '" data-nummer="ks-' + esc(nummer) + '">' +
      '<div class="budget__kopf"><div><p class="topline">Kostenstelle</p><h2 class="budget__nummer">' + esc(nummer) + "</h2>" + (hinweis ? '<p class="leise klein">' + esc(hinweis) + "</p>" : "") + "</div>" +
      (k && w.vorhanden ? '<div class="budget__status">' + ampelHtml(k) + '<span class="leise klein">' + esc(D.standText(ist.stand, ist.monat)) + "</span></div>"
        : ist.vorhanden ? '<div class="budget__status"><span class="leise klein">' + esc(D.standText(ist.stand, ist.monat)) + "</span></div>" : "") + "</div>" +
      '<div class="kpis">' + kpis + "</div>" +
      (k && w.vorhanden
        ? '<div class="verbrauch"><div class="verbrauch__kopf"><span><strong>' + prozent(k.quote) + "</strong> vom Planbudget ausgegeben</span><span>" + Math.round(k.zeitanteil * 100) + " % des Jahres gebucht · " + zzvHtml(k) + "</span></div>" + fortschrittHtml(k) +
          '<div class="verbrauch__skala"><span>0,00 EUR</span><span>Plan ' + euro(k.plan) + "</span></div></div>"
        : !ist.vorhanden ? '<p class="leer-hinweis">Für ' + jahr + " gibt es noch keine IST-Werte. Sie kommen aus dem KST-Bericht, den die Abteilungsleitung importiert.</p>" : "") +
      (k ? '<div class="budget__raster budget__raster--prognose"><section class="budget__abschnitt">' + prognoseHtml(w, ist, vj) + "</section>" +
        '<section class="budget__abschnitt"><h3>Auf einen Blick</h3>' + auffaelligkeiten(w, ist, k) + "</section></div>" : "") +
      (k ? '<section class="budget__abschnitt budget__abschnitt--ist"><h3>' + esc(istUeberschrift(ist)) + " je Kostenart</h3>" + istKostenartenHtml(w, ist, vj) +
        '<p class="leise klein">Balken = IST vom Plan, Strich = gebuchter Anteil des Jahres, Farbe = Stand zum zeitanteiligen Plan. „Prognose in %“ = so viel vom Planbudget wird bis Dezember ausgeschöpft, „Prognose Rest“ = Plan minus Hochrechnung.</p></section>' : "") +
      '<div class="budget__raster budget__raster--plan">' +
      '<section class="budget__abschnitt budget__abschnitt--plan"><h3>Planbudget ' + jahr + " je Kostenart</h3>" +
      (w.vorhanden ? anteilHtml(w) + planKostenartenHtml(w) : '<p class="leer-hinweis">Für ' + jahr + " ist noch kein Planbudget eingetragen.</p>") + "</section>" +
      (k ? '<section class="budget__abschnitt budget__abschnitt--diagramm">' + diagrammHtml(w.vorhanden ? w : D.summe([]), ist, ist.vergleich, "") + "</section>" : "") + "</div>" +
      (g.uebergreifend || g.projektNummern.length ? '<section class="budget__abschnitt"><h3>Zusammensetzung</h3>' + zusammensetzungKs(g, gi) +
        (g.uebergreifend ? '<p class="budget__link"><a class="btn btn--rahmen" href="#/bericht/' + esc(nummer) + '">' + icon("diagramBarchart") + " Bericht ansehen</a></p>" : "") + "</section>" : "") +
      "</article>";
  }

  /* Einzelbudget, Unterkostenstellen und Projektnummern einer Kostenstelle mit Plan, IST und Rest */
  function zusammensetzungKs(g, gi) {
    var daten = zustand.daten, jahr = zustand.jahr;
    var teile = [];
    if (g.uebergreifend) teile.push({ name: g.gesamt === g.eingetragen ? "Einzelbudget" : "Einzelbudget", w: g.eigen, i: gi.eigen });
    g.unter.forEach(function (u, x) { teile.push({ name: "Kostenstelle " + u.nummer, w: u.budget, i: gi.unter[x].ist }); });
    g.projektNummern.forEach(function (pn) { teile.push({ name: "Projektnummer " + pn, link: "#/projekt/" + pn, w: D.budgetVon(daten, jahr, "pn", pn), i: D.projektIstVon(daten, jahr, pn) }); });
    return '<div class="tabelle-huelle"><table class="budgettabelle einzelbudgets"><thead><tr><th>Teil</th><th class="zahl">Plan</th><th class="zahl">IST</th><th>ausgegeben</th><th class="zahl">Restbudget</th><th title="IST zum zeitanteiligen Plan">zeitanteilig</th></tr></thead><tbody>' +
      teile.map(function (t, x) {
        var kk = t.i.vorhanden && t.w.vorhanden ? D.kennzahlen(t.w, t.i) : null;
        return '<tr class="unter' + (x === teile.length - 1 ? " letzte" : "") + '"><th scope="row">' + (t.link ? '<a href="' + esc(t.link) + '">' + esc(t.name) + "</a>" : esc(t.name)) + "</th>" +
          '<td class="zahl">' + (t.w.vorhanden ? euro(t.w.gesamt) : "–") + '</td><td class="zahl">' + (t.i.vorhanden ? euro(t.i.gesamt) : '<span class="leise">keine IST-Werte</span>') + "</td>" +
          "<td>" + balkenHtml(kk) + '</td><td class="zahl' + (kk && kk.rest < 0 ? " minus" : "") + '">' + (kk ? euro(kk.rest) : "–") + "</td><td>" + ampelHtml(kk) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* Woraus sich das Planbudget einer übergreifenden Kostenstelle zusammensetzt */
  function zusammensetzungHtml(g) {
    return '<table class="positionen positionen--zusammensetzung"><caption>Zusammensetzung</caption><tbody>' +
      '<tr><th scope="row">Eigenes Budget</th><td class="zahl' + (g.eigen.gesamt < 0 ? " minus" : "") + '">' + (g.eigen.vorhanden ? euro(g.eigen.gesamt) : '<span class="leise">–</span>') + "</td></tr>" +
      g.unter.map(function (u) {
        return '<tr><th scope="row">Kostenstelle ' + esc(u.nummer) + '</th><td class="zahl">' + (u.budget.vorhanden ? euro(u.budget.gesamt) : '<span class="leise">–</span>') + "</td></tr>";
      }).join("") +
      (g.projektNummern.length ? '<tr><th scope="row">Projektnummern ' + esc(g.projektNummern.join(", ")) + '</th><td class="zahl">' + euro(g.projekte.gesamt) + "</td></tr>" : "") + "</tbody></table>";
  }

  /* Auf einen Blick: alle eigenen Nummern einer Art in einer Tabelle, Summe ohne Doppelzählung */
  function blickHtml(art, nummern) {
    var daten = zustand.daten, jahr = zustand.jahr, plaene = [], iste = [];
    var zeilen = nummern.map(function (n) {
      var w = D.gesamtBudgetVon(daten, jahr, art, n).gesamt, ist = D.gesamtIstVon(daten, jahr, art, n).gesamt;
      var k = ist.vorhanden && w.vorhanden ? D.kennzahlen(w, ist) : null;
      var oben = art === "ks" ? D.uebergeordnete(daten, n) : "";
      if (!oben || nummern.indexOf(oben) < 0) { plaene.push(w); if (ist.vorhanden) iste.push(ist); }
      return '<tr><th scope="row"><button type="button" class="link-btn" data-springe="' + esc("nr-" + art + "-" + n) + '">' + esc(n) + "</button></th>" +
        '<td class="zahl">' + (w.vorhanden ? euro(w.gesamt) : '<span class="leise">–</span>') + '</td><td class="zahl">' + (ist.vorhanden ? euro(ist.gesamt) : '<span class="leise">–</span>') + "</td>" +
        "<td>" + balkenHtml(k) + '</td><td class="zahl' + (k && k.rest < 0 ? " minus" : "") + '">' + (k ? euro(k.rest) : '<span class="leise">–</span>') + "</td><td>" + ampelHtml(k) + "</td></tr>";
    }).join("");
    var sp = D.summe(plaene), si = D.summe(iste);
    return '<section class="karte bereich-tabelle blick"><h2>' + esc(D.ARTEN[art].mehrzahl) + " auf einen Blick</h2>" +
      '<div class="tabelle-huelle"><table class="budgettabelle"><thead><tr><th>' + esc(D.ARTEN[art].name) + '</th><th class="zahl">Planbudget</th><th class="zahl">IST</th><th>ausgegeben</th><th class="zahl">Restbudget</th><th title="IST zum zeitanteiligen Plan">zeitanteilig</th></tr></thead>' +
      "<tbody>" + zeilen + "</tbody>" +
      (plaene.length > 1 ? '<tfoot><tr><th scope="row">Gesamt</th><td class="zahl">' + euro(sp.gesamt) + '</td><td class="zahl">' + (iste.length ? euro(si.gesamt) : "–") + '</td><td colspan="3"></td></tr></tfoot>' : "") +
      "</table></div></section>";
  }

  function eigeneBereiche(b) {
    var html = "";
    ["ks", "pn"].forEach(function (art) {
      var nummern = D.nummernVon(zustand.daten, b.kennung, art);
      if (!nummern.length) return;
      html += '<section class="bereich"><h2 class="bereich__titel">Meine ' + esc(D.ARTEN[art].mehrzahl) + "</h2>" +
        (nummern.length > 1 ? blickHtml(art, nummern) : "") +
        '<div class="stapel">' + nummern.map(function (n) { return budgetKarte(art, n); }).join("") + "</div></section>";
    });
    return html;
  }

  function kennzahl(titel, wert, unter) {
    return '<div class="kennzahl"><span class="kennzahl__titel">' + esc(titel) + '</span><strong class="kennzahl__wert">' + wert + "</strong>" +
      (unter ? '<span class="kennzahl__unter">' + unter + "</span>" : "") + "</div>";
  }

  function verbindeSprunglinks() {
    app.querySelectorAll("[data-springe]").forEach(function (k) {
      k.addEventListener("click", function () {
        var ziel = document.getElementById(k.getAttribute("data-springe"));
        if (ziel) { ziel.scrollIntoView({ behavior: "smooth", block: "start" }); ziel.setAttribute("tabindex", "-1"); ziel.focus({ preventScroll: true }); }
      });
    });
  }

  function zeigeStart() {
    var b = zustand.benutzer, daten = zustand.daten;
    var inhalt = "", leer = false;
    if (b.rolle === "admin") {
      var staende = Object.keys(daten.ist || {}).length;
      inhalt = '<p class="einleitung">Hier pflegst Du die Grundlagen des Tools: Benutzer, Kostenstellen, Projektnummern, KST-Berichte und Einstellungen.</p>' +
        '<div class="kacheln">' +
        startKachel("#/verwaltung/benutzer", "peopleTwo", "Benutzer", daten.benutzer.length + " Konten") +
        startKachel("#/verwaltung/kostenstellen", "folderOpen", "Kostenstellen", daten.kostenstellen.length + " angelegt") +
        startKachel("#/verwaltung/projekte", "briefcase", "Projektnummern", daten.projekte.length + " angelegt") +
        startKachel("#/verwaltung/ist", "documentXls", "KST-Berichte", staende === 1 ? "1 Kostenstelle mit IST-Werten" : staende + " Kostenstellen mit IST-Werten") +
        startKachel("#/verwaltung/einstellungen", "settings", "Einstellungen", "Titel und Datensicherung") + "</div>";
    } else if (b.rolle === "al") {
      inhalt = abteilungHtml() + einzelbudgetsHtml();
    } else {
      var eigen = eigeneBereiche(b);
      leer = !eigen;
      inhalt = eigen || '<div class="karte leer-karte"><h2>Noch nichts zugewiesen</h2><p>Dir ist noch keine ' + esc(b.rolle === "kam" ? "Projektnummer" : "Kostenstelle") +
        " zugewiesen. Wende Dich bitte an Deine Abteilungsleitung.</p></div>";
    }
    /* Jahr und PDF nur, wenn es etwas zu zeigen gibt */
    var kopf = '<div class="seite__kopf"><div><p class="topline">' + esc(D.rollenName(b.rolle)) + "</p><h1>" + esc(D.begruessung()) + ", " + esc(b.vorname || b.kennung) + "</h1></div>" +
      (b.rolle !== "admin" && !leer ? jahrwahlHtml() : "") + "</div>";
    seite("start", "", kopf + inhalt, b.rolle !== "admin");
    verbindeJahrwahl();
    verbindeSprunglinks();
  }

  function startKachel(link, ic, titel, unter) {
    return '<a class="startkachel" href="' + link + '"><span class="startkachel__icon">' + icon(ic) + '</span><span class="startkachel__titel">' + esc(titel) +
      '</span><span class="startkachel__unter">' + esc(unter) + "</span></a>";
  }

  function ohnePlan() {
    var zahl = 0;
    ["ks", "pn"].forEach(function (art) {
      D.liste(zustand.daten, art).forEach(function (n) { if (!D.budgetVon(zustand.daten, zustand.jahr, art, n.nummer).vorhanden) zahl++; });
    });
    return zahl;
  }

  /* Abteilung gesamt: oberste Kostenstellen mit ihrem Gesamtbudget (enthält zugeordnete Kostenstellen und Projektnummern) */
  function abteilung() {
    var daten = zustand.daten, jahr = zustand.jahr;
    var a = { planMitIst: [], iste: [], vergleiche: [], hoch: 0, ohneIst: [], stand: "", monat: "", unterschiedlich: false };
    D.liste(daten, "ks").forEach(function (n) {
      if (D.uebergeordnete(daten, n.nummer)) return;
      var w = D.gesamtBudgetVon(daten, jahr, "ks", n.nummer).gesamt, ist = D.gesamtIstVon(daten, jahr, "ks", n.nummer).gesamt;
      if (!ist.vorhanden) { if (w.vorhanden) a.ohneIst.push(n.nummer); return; }
      var k = D.kennzahlen(w, ist);
      a.planMitIst.push(w); a.iste.push(ist); a.hoch += k.hochrechnung;
      a.vergleiche.push(ist.vergleich);
      if (a.stand && (ist.stand !== a.stand || ist.monat !== a.monat)) a.unterschiedlich = true;
      if (!a.stand || ist.stand < a.stand) a.stand = ist.stand;
      if (!a.monat || ist.monat < a.monat) a.monat = ist.monat;
    });
    var ap = D.abteilungsPlan(daten, jahr);
    a.plan = ap.gesamt; a.planKs = ap.kostenstellen; a.planIst = D.summe(a.planMitIst); a.ist = D.summe(a.iste);
    a.vorjahr = a.vergleiche.length && a.vergleiche.every(function (v) { return v; }) ? D.summe(a.vergleiche).gesamt : null;
    a.pnFrei = ap.projekteOhneKs;
    return a;
  }

  function abteilungHtml() {
    var a = abteilung(), jahr = zustand.jahr, p = a.plan, ohne = ohnePlan();
    var plan = '<section class="budget__bereich" aria-label="Planbudget der Abteilung"><h3>Planbudget ' + jahr + "</h3>" +
      (p.gesamt ? '<p class="budget__gesamt"><strong>' + euro(p.gesamt) + '</strong><span class="leise klein">Gesamtbudgets der Kostenstellen, inklusive Projektnummern</span></p>' + anteilHtml(p) +
        '<dl class="ist__werte">' + (a.pnFrei.gesamt ? "<div><dt>Projektnummern ohne Kostenstelle</dt><dd>" + euro(a.pnFrei.gesamt) + "</dd></div>" : "") +
        "<div><dt>Personalkosten</dt><dd>" + euro(p.personalkosten) + "</dd></div><div><dt>Sachkosten</dt><dd>" + euro(p.sachkosten) + "</dd></div></dl>"
        : '<p class="leer-hinweis">Für ' + jahr + " ist noch kein Planbudget eingetragen.</p>") +
      (ohne ? '<p class="hinweis-box klein">' + ohne + (ohne === 1 ? " Kostenstelle oder Projektnummer hat" : " Kostenstellen oder Projektnummern haben") + ' noch kein Planbudget. <a href="#/uebersicht">Planbudgets eintragen</a></p>' : "") +
      "</section>";
    var ist;
    if (!a.iste.length) {
      ist = "<h3>IST " + jahr + '</h3><p class="leer-hinweis">Für ' + jahr + ' gibt es noch keine IST-Werte. <a href="#/verwaltung/ist">KST-Bericht importieren</a></p>';
    } else {
      var w = a.ist; w.vorhanden = true; w.stand = a.stand; w.monat = a.monat; w.bisMonat = Number(a.monat.slice(5)); w.vergleich = null; w.unterschiedlich = a.unterschiedlich;
      var k = D.kennzahlen(a.planIst, w);
      ist = "<h3>" + esc(istUeberschrift(w)) + "</h3>" + standHtml(w) +
        '<p class="ist__quote"><strong>' + prozent(k.quote) + "</strong> vom Planbudget ausgegeben</p>" + fortschrittHtml(D.kennzahlen(a.planIst, w)) +
        '<p class="fortschritt__legende leise klein">Strich: ' + Math.round(k.zeitanteil * 100) + " % des Jahres sind gebucht.</p>" +
        '<dl class="ist__werte"><div><dt>IST</dt><dd>' + euro(w.gesamt) + "</dd></div>" +
        "<div><dt>Restbudget</dt><dd" + (k.rest < 0 ? ' class="minus"' : "") + ">" + euro(k.rest) + "</dd></div>" +
        "<div><dt>Zum zeitanteiligen Plan</dt><dd>" + zzvHtml(zzvAus(a.planIst.gesamt > 0 ? a.hoch / a.planIst.gesamt : null)) + "</dd></div>" +
        "<div><dt>Hochrechnung Jahresende</dt><dd>" + euro(a.hoch) + "</dd></div>" +
        (a.vorjahr !== null ? "<div><dt>Vorjahr gleicher Zeitraum</dt><dd>" + euro(a.vorjahr) + ' <span class="leise">' + prozent(a.vorjahr ? (w.gesamt - a.vorjahr) / a.vorjahr : null, true) + "</span></dd></div>" : "") + "</dl>" +
        (a.ohneIst.length ? '<p class="hinweis-box klein">Noch ohne IST-Werte: Kostenstelle ' + esc(a.ohneIst.join(", ")) + ". Prozent und Restbudget beziehen sich nur auf die Kostenstellen mit IST-Werten. " +
          '<a href="#/verwaltung/ist">KST-Bericht importieren</a></p>' : "");
    }
    return '<section class="karte budget budget--abteilung"><div class="budget__kopf"><div><p class="topline">Abteilung gesamt</p><h2 class="budget__nummer">Abteilungsbudget ' + jahr + "</h2></div></div>" +
      '<div class="budget__bereiche">' + plan + '<section class="budget__bereich budget__bereich--ist" aria-label="IST der Abteilung">' + ist + "</section></div>" +
      (a.iste.length ? diagrammHtml(a.planIst, a.ist, a.vorjahr !== null ? D.summe(a.vergleiche) : null, "Kostenstellen mit IST-Werten") : "") + "</section>";
  }

  /* Einzelbudgets: jede Kostenstelle mit Plan, IST, Anteil und zeitanteiligem Plan; übergreifende mit Gesamtzeile */
  function einzelbudgetsHtml() {
    var daten = zustand.daten, jahr = zustand.jahr;
    function zeile(klasse, kopf, wer, w, ist, extra) {
      var k = ist.vorhanden && w.vorhanden ? D.kennzahlen(w, ist) : null;
      return "<tr" + (klasse ? ' class="' + klasse + '"' : "") + ">" + kopf + '<td class="klein spalte-wer">' + wer + "</td>" +
        '<td class="zahl">' + (w.vorhanden ? euro(w.gesamt) : '<span class="leise">–</span>') + '</td><td class="zahl">' + (ist.vorhanden ? euro(ist.gesamt) : '<span class="leise">keine IST-Werte</span>') + "</td>" +
        "<td>" + balkenHtml(k) + '</td><td class="zahl' + (k && k.rest < 0 ? " minus" : "") + '">' + (k ? euro(k.rest) : '<span class="leise">–</span>') + "</td><td>" + ampelHtml(k) + "</td><td>" + (extra || "") + "</td></tr>";
    }
    var ks = ksReihe().map(function (r) {
      var nr = r.n.nummer, wer = esc(namenVon(r.n.benutzer).join(", ") || "niemand");
      if (r.art === "teilsumme") return "";
      if (r.art === "oben") {
        var gi = D.gesamtIstVon(daten, jahr, "ks", nr);
        return zeile("teilsumme", '<th scope="row"><strong>' + ksLink(nr) + "</strong></th>", wer,
            D.gesamtBudgetVon(daten, jahr, "ks", nr).gesamt, gi.gesamt,
            '<a class="icon-btn" href="#/bericht/' + esc(nr) + '" aria-label="Bericht Kostenstelle ' + esc(nr) + '" title="Bericht ansehen">' + icon("diagramBarchart") + "</a>") +
          zeile("unter", '<th scope="row" title="ohne Unterkostenstellen und Projektnummern"><a href="#/kostenstelle/' + esc(nr) + '/eigen" title="Details nur ' + esc(nr) + ' selbst">' + esc(nr) + "</a></th>", "", D.gesamtBudgetVon(daten, jahr, "ks", nr).eigen, gi.eigen);
      }
      return zeile(r.art === "unter" ? "unter" + (r.letzte ? " letzte" : "") : "", '<th scope="row">' + ksLink(nr) + "</th>", wer, D.budgetVon(daten, jahr, "ks", nr), D.istVon(daten, jahr, nr));
    }).join("");
    var pn = D.liste(daten, "pn").map(function (n) {
      return zeile("", '<th scope="row"><a href="#/projekt/' + esc(n.nummer) + '">' + esc(n.nummer) + "</a>" + (n.ks ? '<br><span class="leise klein">in Kostenstelle ' + esc(n.ks) + "</span>" : "") + "</th>",
        esc(namenVon(n.benutzer).join(", ") || "niemand"), D.budgetVon(daten, jahr, "pn", n.nummer), D.projektIstVon(daten, jahr, n.nummer));
    }).join("");
    function tabelle(titel, spalte, zeilen, leer, text) {
      return '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>' + titel + "</h2></div>" + (text ? '<p class="leise klein">' + text + "</p>" : "") +
        (zeilen ? '<div class="tabelle-huelle"><table class="budgettabelle einzelbudgets"><thead><tr><th>' + spalte + '</th><th class="spalte-wer">Verantwortlich</th><th class="zahl">Planbudget</th><th class="zahl">IST</th><th>ausgegeben</th><th class="zahl">Restbudget</th><th title="IST zum zeitanteiligen Plan">zeitanteilig</th><th><span class="sr">Bericht</span></th></tr></thead><tbody>' +
          zeilen + "</tbody></table></div>" : '<p class="leer-hinweis">' + leer + "</p>") + "</section>";
    }
    return tabelle("Einzelbudgets der Kostenstellen " + jahr, "Kostenstelle", ks, "Noch keine Kostenstellen angelegt.",
        "Unterkostenstellen hängen eingerückt an ihrer Kostenstelle, die erste eingerückte Zeile ist deren Einzelbudget. Mit Klick auf die Nummer öffnest Du die Details. „Zeitanteilig“ vergleicht das IST mit dem Plan bis zum gebuchten Monat: " + esc(D.ampelText()) + ".") +
      tabelle("Projektnummern " + jahr, "Projektnummer", pn, "Noch keine Projektnummern angelegt.", "Planbudget und Kosten einer Projektnummer sind Teil ihrer Kostenstelle. IST sind die erfassten Projektkosten; im KST-Bericht der Kostenstelle sind sie schon enthalten.");
  }

  /* ---------- Planbudgets und IST-Werte der Abteilungsleitung ---------- */

  function namenVon(kennungen) {
    return kennungen.map(function (k) { var b = D.findeBenutzer(zustand.daten, k); return b ? D.anzeigeName(b) : k; });
  }

  function zeigeUebersicht() {
    var ap = D.abteilungsPlan(zustand.daten, zustand.jahr), p = ap.gesamt;
    var html = '<div class="seite__kopf"><div><p class="topline">Abteilungsleitung</p><h1>Planbudgets ' + zustand.jahr + "</h1></div>" + jahrwahlHtml() + "</div>" +
      '<p class="einleitung">Hier trägst Du die Planbudgets ein: Klicke in der Zeile auf den Stift oder das Plus. Die IST-Werte findest Du unter <a href="#/ist">IST-Werte</a>.</p>' +
      (D.uebernahmeListe(zustand.daten, zustand.jahr - 1, zustand.jahr, true).length ? '<div class="knopfreihe knopfreihe--oben"><button type="button" class="btn btn--rahmen" data-uebernahme>' + icon("copy") +
        " Planbudgets aus " + (zustand.jahr - 1) + " übernehmen</button></div>" : "") +
      '<div class="kennzahlen">' +
      kennzahl("Abteilungsbudget", euro(p.gesamt), ap.projekteOhneKs.gesamt ? "davon Projektnummern ohne Kostenstelle " + euro(ap.projekteOhneKs.gesamt) : "Gesamtbudgets der Kostenstellen") +
      kennzahl("Personalkosten", euro(p.personalkosten), "ID " + euro(p.pkId) + " · AD " + euro(p.pkAd)) +
      kennzahl("Sachkosten", euro(p.sachkosten), "Werbung, Reise/KfZ, Sonstiges") +
      kennzahl("Ohne Planbudget", String(ohnePlan()), "Kostenstellen und Projektnummern") + "</div>" +
      tabelleHtml("ks") + tabelleHtml("pn") + protokollHtml();
    seite("uebersicht", "Planbudgets", html, true);
    verbindeJahrwahl();
    var ueb = app.querySelector("[data-uebernahme]");
    if (ueb) ueb.addEventListener("click", uebernahmeDialog);
    var mehr = app.querySelector("[data-protokoll-mehr]");
    if (mehr) mehr.addEventListener("click", function () { protokollAnzahl += 30; zeige(); });
    app.querySelectorAll("[data-budget]").forEach(function (k) {
      k.addEventListener("click", function () {
        var t = k.getAttribute("data-budget").split("-");
        budgetDialog(t[0], t[1]);
      });
    });
  }

  function uebernahmeDialog() {
    var daten = zustand.daten, nach = zustand.jahr, von = nach - 1;
    var vorhanden = Object.keys(daten.budgets[String(nach)] || {}).length;
    var form = oeffneDialog("Planbudgets aus " + von + " übernehmen",
      "<p>Das Tool trägt die Planbudgets aus " + von + " für " + nach + " ein. Danach passt Du einzelne Werte wie gewohnt an. Jede Übernahme steht im Änderungsprotokoll.</p>" +
      (vorhanden ? '<label class="check"><input type="checkbox" name="ueberschreiben"> Vorhandene Planbudgets für ' + nach + " überschreiben</label>" : "") +
      '<p class="hinweis-box klein" data-anzahl></p><p class="fehlertext" hidden></p>',
      '<button type="button" class="btn btn--rahmen" data-schliessen>Abbrechen</button><button type="submit" class="btn btn--primaer">Jetzt übernehmen</button>',
      function (f) {
        var ueberschreiben = !!(f.ueberschreiben && f.ueberschreiben.checked), n = D.uebernahmeListe(daten, von, nach, ueberschreiben).length;
        if (!n) { zeigeFehler(f, "Es gibt nichts zu übernehmen. Alle Planbudgets für " + nach + " sind schon eingetragen."); return; }
        Dienst.budgetsUebernehmen(daten, zustand.benutzer, von, nach, ueberschreiben)
          .then(nachAenderung(n === 1 ? "Ein Planbudget aus " + von + " ist übernommen." : n + " Planbudgets aus " + von + " sind übernommen."), function (x) { serverFehler(x, f); });
      });
    function zaehle() {
      var u = form.ueberschreiben && form.ueberschreiben.checked, n = D.uebernahmeListe(daten, von, nach, u).length;
      form.querySelector("[data-anzahl]").textContent = n === 0 ? "Alle Planbudgets aus " + von + " sind für " + nach + " schon eingetragen."
        : (n === 1 ? "Ein Planbudget wird übernommen." : n + " Planbudgets werden übernommen.") + (vorhanden && !u ? " Bereits eingetragene Planbudgets für " + nach + " bleiben, wie sie sind." : "");
    }
    if (form.ueberschreiben) form.ueberschreiben.addEventListener("change", zaehle);
    zaehle();
  }

  /* ---------- Änderungsprotokoll der Planbudgets (nur Abteilungsleitung) ---------- */

  var protokollAnzahl = 30;

  function protokollWerte(art, w) {
    if (!w) return null;
    if (art === "pn") return { gesamt: w.betrag !== undefined ? Number(w.betrag) || 0 : D.POSITIONEN.reduce(function (s, p) { return s + (Number(w[p.id]) || 0); }, 0) };
    var aus = { gesamt: 0 };
    D.POSITIONEN.forEach(function (p) { aus[p.id] = Number(w[p.id]) || 0; aus.gesamt += aus[p.id]; });
    aus.gesamt = Math.round(aus.gesamt * 100) / 100;
    return aus;
  }

  function protokollAenderung(e) {
    var v = protokollWerte(e.art, e.vorher), n = protokollWerte(e.art, e.nachher);
    if (!v) return "neu eingetragen";
    if (!n) return "entfernt";
    if (e.art === "pn") return "Budget " + euro(v.gesamt) + " → " + euro(n.gesamt);
    var teile = D.POSITIONEN.filter(function (p) { return v[p.id] !== n[p.id]; }).map(function (p) { return esc(p.name) + " " + euro(v[p.id]) + " → " + euro(n[p.id]); });
    return teile.length ? teile.join("<br>") : "keine Änderung der Beträge";
  }

  function protokollHtml() {
    var jahr = String(zustand.jahr);
    var alle = (zustand.daten.budgetProtokoll || []).filter(function (e) { return e.jahr === jahr; });
    var kopf = '<section class="karte bereich-tabelle" id="protokoll"><div class="bereich-tabelle__kopf"><h2>Änderungsprotokoll ' + esc(jahr) + "</h2>" +
      (alle.length ? '<span class="leise klein">' + (alle.length === 1 ? "1 Eintrag" : alle.length + " Einträge") + "</span>" : "") + "</div>" +
      '<p class="leise klein">Wer hat wann welches Planbudget eingetragen oder geändert. Das Tool hebt die letzten ' + D.MAX_PROTOKOLL.toLocaleString("de-DE") + " Einträge über alle Kalenderjahre auf.</p>";
    if (!alle.length) return kopf + '<p class="leer-hinweis">Für ' + esc(jahr) + " hat noch niemand ein Planbudget eingetragen oder geändert.</p></section>";
    var zeilen = alle.slice(0, protokollAnzahl).map(function (e) {
      var v = protokollWerte(e.art, e.vorher), n = protokollWerte(e.art, e.nachher);
      return "<tr><td>" + esc(datumZeit(e.zeit)) + "</td><td>" + esc(nameVon(e.von)) + "</td>" +
        '<th scope="row">' + esc(D.ARTEN[e.art].name) + " <strong>" + esc(e.nummer) + "</strong></th>" +
        '<td class="klein">' + protokollAenderung(e) + '</td><td class="zahl">' + (n ? euro(n.gesamt) : "–") + (v ? '<br><span class="leise klein">vorher ' + euro(v.gesamt) + "</span>" : "") + "</td>" +
        '<td class="klein">' + esc(e.anlass || "Eingabe") + "</td></tr>";
    }).join("");
    return kopf + '<div class="tabelle-huelle"><table class="budgettabelle protokolltabelle"><thead><tr><th>Zeitpunkt</th><th>Wer</th><th>Nummer</th><th>Änderung</th><th class="zahl">Planbudget</th><th>Anlass</th></tr></thead><tbody>' +
      zeilen + "</tbody></table></div>" +
      (alle.length > protokollAnzahl ? '<div class="knopfreihe"><button type="button" class="btn btn--rahmen" data-protokoll-mehr>Weitere anzeigen (' + (alle.length - protokollAnzahl) + " mehr)</button></div>" : "") + "</section>";
  }

  function zeigeIstWerte() {
    var html = '<div class="seite__kopf"><div><p class="topline">Abteilungsleitung</p><h1>IST-Werte ' + zustand.jahr + "</h1></div>" + jahrwahlHtml() + "</div>" +
      '<div class="knopfreihe knopfreihe--oben"><a class="btn btn--primaer" href="#/verwaltung/ist">' + icon("documentXls") + " KST-Bericht importieren</a></div>" +
      istKennzahlenHtml() + istTabelleHtml("ks") + istTabelleHtml("pn");
    seite("ist", "IST-Werte", html, true);
    verbindeJahrwahl();
  }

  /* Reihenfolge der Kostenstellen: übergreifende mit ihren zugeordneten und einer Zwischensumme */
  function ksReihe() {
    var reihe = [];
    D.liste(zustand.daten, "ks").forEach(function (n) {
      if (D.uebergeordnete(zustand.daten, n.nummer)) return;
      var unter = n.unter || [];
      reihe.push({ n: n, art: unter.length ? "oben" : "" });
      unter.forEach(function (u) { var e = D.findeNummer(zustand.daten, "ks", u); if (e) reihe.push({ n: e, art: "unter" }); });
      if (unter.length && reihe[reihe.length - 1].art === "unter") reihe[reihe.length - 1].letzte = true;
      if (unter.length) reihe.push({ n: n, art: "teilsumme" });
    });
    return reihe;
  }

  function istKennzahlenHtml() {
    var a = abteilung();
    if (!a.iste.length) return '<p class="leer-hinweis">Für ' + zustand.jahr + ' gibt es noch keine IST-Werte. <a href="#/verwaltung/ist">KST-Bericht importieren</a></p>';
    var q = a.planIst.gesamt > 0 ? a.ist.gesamt / a.planIst.gesamt : null;
    return '<div class="kennzahlen kennzahlen--ist">' +
      kennzahl("IST " + zustand.jahr, euro(a.ist.gesamt), esc(D.standText(a.stand, a.monat)) + (a.unterschiedlich ? " (ältester Stand)" : "")) +
      kennzahl("IST in % vom Plan", prozent(q), a.ohneIst.length ? "ohne Kostenstelle " + esc(a.ohneIst.join(", ")) : "alle Kostenstellen") +
      kennzahl("Restbudget", euro(a.planIst.gesamt - a.ist.gesamt), "Plan " + euro(a.planIst.gesamt)) +
      kennzahl("Zum zeitanteiligen Plan", zzvHtml(zzvAus(a.planIst.gesamt > 0 ? a.hoch / a.planIst.gesamt : null)), "Hochrechnung Jahresende " + euro(a.hoch)) + "</div>";
  }

  function istTabelleHtml(art) {
    var daten = zustand.daten, jahr = zustand.jahr;
    var reihe = art === "pn" ? D.liste(daten, "pn").map(function (n) { return { n: n, art: "" }; }) : [];
    /* Übergreifende Kostenstelle oben mit ihrem Gesamtwert, darunter ihr Einzelbudget und die Unterkostenstellen */
    if (art === "ks") ksReihe().forEach(function (r) {
      if (r.art === "oben") reihe.push({ n: r.n, art: "teilsumme" }, { n: r.n, art: "oben" });
      else if (r.art !== "teilsumme") reihe.push(r);
    });
    var zeilen = reihe.map(function (r) {
      var nr = r.n.nummer, plan, ist;
      if (r.art === "teilsumme") { plan = D.gesamtBudgetVon(daten, jahr, "ks", nr).gesamt; ist = D.gesamtIstVon(daten, jahr, "ks", nr).gesamt; }
      else if (art === "pn") { plan = D.budgetVon(daten, jahr, "pn", nr); ist = D.projektIstVon(daten, jahr, nr); }
      else if (r.art === "oben") { plan = D.gesamtBudgetVon(daten, jahr, "ks", nr).eigen; ist = D.gesamtIstVon(daten, jahr, "ks", nr).eigen; }
      else { plan = D.budgetVon(daten, jahr, "ks", nr); ist = D.istVon(daten, jahr, nr); }
      var kopf = r.art === "teilsumme" ? '<th scope="row"><strong>' + ksLink(nr) + "</strong></th>"
        : '<th scope="row"' + (r.art === "oben" ? ' title="ohne Unterkostenstellen und Projektnummern"' : "") + "><strong>" + (art === "pn" ? '<a href="#/projekt/' + esc(nr) + '">' + esc(nr) + "</a>" : ksLink(nr)) + "</strong>" +
          (art === "pn" && r.n.ks ? '<br><span class="leise klein">Kostenstelle ' + esc(r.n.ks) + "</span>" : "") + "</th>";
      var klasse = r.art === "teilsumme" ? "teilsumme" : r.art === "unter" || r.art === "oben" ? "unter" + (r.letzte ? " letzte" : "") : "";
      if (!ist.vorhanden) return "<tr" + (klasse ? ' class="' + klasse + ' ohne"' : ' class="ohne"') + ">" + kopf + '<td colspan="8" class="leise klein">' + (art === "pn" ? "noch keine Kosten erfasst" : "keine IST-Werte") + "</td></tr>";
      var k = D.kennzahlen(plan, ist);
      return "<tr" + (klasse ? ' class="' + klasse + '"' : "") + ">" + kopf +
        '<td class="klein">' + esc(D.standText(ist.stand, ist.monat).replace("Stand ", "")) + "</td>" +
        '<td class="zahl">' + euro(k.plan) + '</td><td class="zahl">' + euro(k.ist) + '</td><td class="zahl summe"><strong>' + prozent(k.quote) + "</strong></td>" +
        '<td class="zahl' + (k.rest < 0 ? " minus" : "") + '">' + euro(k.rest) + '</td><td class="zahl">' + euro(k.hochrechnung) + "</td>" +
        '<td class="zahl">' + (k.vorjahrQuote === null ? "–" : prozent(k.vorjahrQuote, true)) + "</td>" +
        '<td>' + ampelHtml(k) + "</td></tr>";
    }).join("");
    if (art === "pn") return '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>Projektnummern: IST gegen Plan ' + jahr + "</h2></div>" +
      '<p class="leise klein">IST sind die erfassten Projektkosten. Sie stecken schon im KST-Bericht der Kostenstelle.</p>' +
      (zeilen ? '<div class="tabelle-huelle"><table class="budgettabelle"><thead><tr><th>Projektnummer</th><th>Stand</th><th class="zahl">Plan</th><th class="zahl">IST</th><th class="zahl">IST in %</th>' +
        '<th class="zahl">Restbudget</th><th class="zahl">Hochrechnung</th><th class="zahl">zum Vorjahr</th><th>zeitanteilig</th></tr></thead><tbody>' + zeilen + "</tbody></table></div>"
        : '<p class="leer-hinweis">Noch keine Projektnummern angelegt.</p>') + "</section>";
    return '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>Kostenstellen: IST gegen Plan ' + jahr + "</h2>" +
      (D.Rechte.budgets(zustand.benutzer) ? '<a class="leise klein" href="#/verwaltung/ist">IST-Werte importieren</a>' : "") + "</div>" +
      '<p class="leise klein">Die IST-Werte kommen aus dem KST-Bericht je Kostenstelle. Mit Klick auf die Nummer öffnest Du die Details. „Zeitanteilig“ vergleicht das IST mit dem Plan bis zum gebuchten Monat: ' + esc(D.ampelText()) + ". Die Hochrechnung schreibt das IST gleichmäßig bis Dezember fort.</p>" +
      (zeilen ? '<div class="tabelle-huelle"><table class="budgettabelle"><thead><tr><th>Kostenstelle</th><th>Stand · gebucht bis</th><th class="zahl">Plan</th><th class="zahl">IST</th><th class="zahl">IST in %</th>' +
        '<th class="zahl">Restbudget</th><th class="zahl">Hochrechnung</th><th class="zahl">zum Vorjahr</th><th>zeitanteilig</th></tr></thead><tbody>' + zeilen + "</tbody></table></div>"
        : '<p class="leer-hinweis">Noch keine Kostenstellen angelegt.</p>') + "</section>";
  }

  function tabelleHtml(art) {
    var a = D.ARTEN[art], l = D.liste(zustand.daten, art), daten = zustand.daten, jahr = zustand.jahr;
    /* Übergreifende Kostenstellen: oben das Gesamtbudget, direkt darunter ihr Einzelbudget, dann die Unterkostenstellen */
    var reihe = art === "ks" ? ksReihe() : l.map(function (n) { return { n: n, art: "" }; });
    /* Spalte Projektnummern nur, wenn Projektnummern zu Kostenstellen gehören: Beim Einzelbudget werden sie abgezogen */
    var mitPn = art === "ks" && (daten.projekte || []).some(function (p) { return p.ks && D.findeNummer(daten, "ks", p.ks); });
    function betraege(w, mitMinus) {
      function z(v, klasse) { return '<td class="zahl' + (klasse ? " " + klasse : "") + (mitMinus && v < 0 ? " minus" : "") + '">' + (w.vorhanden ? euro(v) : "–") + "</td>"; }
      if (art === "pn") return '<td class="zahl summe gruppe"><strong>' + (w.vorhanden ? euro(w.gesamt) : "–") + "</strong></td>";
      return z(w.pkId, "gruppe") + z(w.pkAd) + z(w.werbung, "gruppe") + z(w.reise) + z(w.sonstiges) + z(w.sachkosten, "summe") +
        (mitPn ? '<td class="zahl gruppe">' + (w.vorhanden && w.projekt ? euro(w.projekt) : '<span class="leise">–</span>') + "</td>" : "") +
        '<td class="zahl summe gruppe' + (mitMinus && w.gesamt < 0 ? " minus" : "") + '"><strong>' + (w.vorhanden ? euro(w.gesamt) : "–") + "</strong></td>";
    }
    function kopf(n, zusatz) {
      var namen = namenVon(n.benutzer);
      return '<th scope="row"><strong>' + (art === "pn" ? '<a href="#/projekt/' + esc(n.nummer) + '">' + esc(n.nummer) + "</a>" : esc(n.nummer)) + "</strong>" + (zusatz ? ' <span class="planbudget__art">' + esc(zusatz) + "</span>" : "") +
        '<span class="planbudget__wer">' + (namen.length ? esc(namen.join(", ")) : "niemand verantwortlich") + "</span></th>" +
        (art === "pn" ? "<td>" + (n.ks ? "Kostenstelle " + esc(n.ks) : '<span class="leise">keiner zugeordnet</span>') + "</td>" : "");
    }
    var zeilen = reihe.map(function (r) {
      var n = r.n;
      if (r.art === "teilsumme") return "";
      var w = D.budgetVon(daten, jahr, art, n.nummer);
      var gb = art === "ks" ? D.gesamtBudgetVon(daten, jahr, "ks", n.nummer) : null;
      /* Einzelbudget-Zeile bei Unterkostenstellen oder eigenen Projektnummern */
      var mitEinzel = art === "ks" && r.art !== "unter" && (r.art === "oben" || gb.projektNummern.length > 0);
      /* Übergreifend: oben das errechnete Gesamtbudget ohne Stift, eingetragen wird in der Einzelbudget-Zeile */
      var oben = gb && gb.uebergreifend, zeigen = oben ? gb.gesamt : w;
      function aktionen(mitBericht) {
        return '<td><div class="liste__aktionen"><button type="button" class="icon-btn" data-budget="' + esc(art + "-" + n.nummer) + '" aria-label="Planbudget ' + esc(a.name + " " + n.nummer) + (w.vorhanden ? " bearbeiten" : " eintragen") +
          '" title="' + (w.vorhanden ? "Planbudget bearbeiten" : "Planbudget eintragen") + '">' + icon(w.vorhanden ? "pencil" : "plus") + "</button>" +
          (art === "pn" ? '<a class="icon-btn" href="#/projekt/' + esc(n.nummer) + '" aria-label="Projektkosten ' + esc(n.nummer) + '" title="Projektkosten">' + icon("money") + "</a>" : "") +
          (mitBericht ? '<a class="icon-btn" href="#/bericht/' + esc(n.nummer) + '" aria-label="Bericht Kostenstelle ' + esc(n.nummer) + '" title="Bericht ansehen">' + icon("diagramBarchart") + "</a>" : "") + "</div></td>";
      }
      var klassen = [zeigen.vorhanden ? "" : "ohne", r.art === "unter" ? "unter" : "", r.letzte ? "letzte" : "", mitEinzel ? "oben" : ""].filter(Boolean).join(" ");
      var html = "<tr" + (klassen ? ' class="' + klassen + '"' : "") + ">" + kopf(n) + betraege(zeigen) + (oben ? "<td></td>" : aktionen(false)) + "</tr>";
      if (mitEinzel) {
        var e = gb.eigen;
        var ek = '<th scope="row" title="Einzelbudget: eigenes Budget ohne Unterkostenstellen und Projektnummern"><strong>' + esc(n.nummer) + "</strong></th>";
        var letzte = oben ? "" : " letzte";
        html += gb.eingetragen.vorhanden
          ? '<tr class="unter einzel' + letzte + (e.gesamt < 0 ? " fehlerzeile" : "") + '">' + ek + betraege(e, true) + (oben ? aktionen(true) : "<td></td>") + "</tr>"
          : '<tr class="unter einzel ohne' + letzte + '">' + ek + '<td colspan="' + (mitPn ? 8 : 7) + '" class="leise klein">Noch kein Einzelbudget für ' + esc(n.nummer) + " eingetragen.</td>" + (oben ? aktionen(true) : "<td></td>") + "</tr>";
      }
      return html;
    }).join("");
    var s = art === "ks" ? D.abteilungsPlan(daten, jahr).kostenstellen : D.summe(l.map(function (n) { return D.budgetVon(daten, jahr, "pn", n.nummer); }));
    return '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>' + esc(a.mehrzahl) + "</h2>" +
      '<a class="leise klein" href="#/verwaltung/' + (art === "ks" ? "kostenstellen" : "projekte") + '">' + esc(a.mehrzahl) + " verwalten</a></div>" +
      (art === "ks" ? '<p class="leise klein">Eine Kostenstelle mit Unterkostenstellen steht zweimal da: oben mit dem Gesamtbudget und eingerückt mit ihrem Einzelbudget, das Du einträgst. Das Gesamtbudget rechnet das Tool aus: Einzelbudget plus Unterkostenstellen. Projektnummern einer Kostenstelle sind in ihrem Budget enthalten.</p>' : "") +
      (l.length ? '<div class="tabelle-huelle"><table class="budgettabelle planbudgettabelle' + (art === "pn" ? " planbudgettabelle--pn" : "") + '"><thead>' +
        (art === "pn" ? '<tr><th>Projektnummer</th><th>Kostenstelle</th><th class="zahl gruppe">Budget</th><th><span class="sr">Aktion</span></th></tr>'
          : '<tr class="gruppenkopf"><th rowspan="2">' + esc(a.name) + '</th><th colspan="2" class="gruppe">Personalkosten</th><th colspan="4" class="gruppe">Sachkosten</th>' +
            (mitPn ? '<th rowspan="2" class="zahl gruppe" title="Projektnummern dieser Kostenstelle, beim Einzelbudget abgezogen">Projekt&shy;nummern</th>' : "") +
            '<th rowspan="2" class="zahl gruppe">Gesamt</th><th rowspan="2"><span class="sr">Aktion</span></th></tr>' +
            '<tr><th class="zahl gruppe">ID</th><th class="zahl">AD</th><th class="zahl gruppe">Werbung</th><th class="zahl">Reise/KfZ</th><th class="zahl">Sonstiges</th><th class="zahl">Summe</th></tr>') +
        "</thead><tbody>" + zeilen + "</tbody>" +
        '<tfoot><tr><th scope="row"' + (art === "pn" ? ' colspan="2"' : "") + ">Summe " + esc(a.mehrzahl) + (art === "ks" ? '<span class="planbudget__wer">Unterkostenstellen nur einmal</span>' : "") + "</th>" + betraege(Object.assign({ vorhanden: true }, s)) + "<td></td></tr></tfoot></table></div>"
        : '<p class="leer-hinweis">Noch keine ' + esc(a.mehrzahl) + ' angelegt. <a href="#/verwaltung/' + (art === "ks" ? "kostenstellen" : "projekte") + '">Jetzt anlegen</a></p>') +
      "</section>";
  }


  /* Hinweis im Dialog: Gesamtbudget enthält zugeordnete Kostenstellen und Projektnummern */
  function gesamtHinweisHtml(art, nummer, jahr) {
    if (art !== "ks") {
      var ks = (D.findeNummer(zustand.daten, "pn", nummer) || {}).ks;
      return ks ? '<p class="hinweis-box klein">Dieses Planbudget ist Teil des Gesamtbudgets der Kostenstelle ' + esc(ks) + ".</p>" : "";
    }
    var g = D.gesamtBudgetVon(zustand.daten, jahr, "ks", nummer), teile = [];
    if (g.unter.length) teile.push("die Unterkostenstellen " + g.unter.map(function (u) { return u.nummer; }).join(", "));
    if (g.projektNummern.length) teile.push("die Projektnummern " + g.projektNummern.join(", "));
    if (!teile.length) return "";
    var unterSumme = g.unter.reduce(function (x, u) { return x + u.budget.gesamt; }, 0);
    return '<p class="hinweis-box klein">' + (g.unter.length ? "Trage hier das Einzelbudget von " + esc(nummer) + " ein. Die Unterkostenstellen " + esc(g.unter.map(function (u) { return u.nummer; }).join(", ")) +
      " mit zusammen " + euro(unterSumme) + " rechnet das Tool zum Gesamtbudget dazu." : "") +
      (g.projektNummern.length ? (g.unter.length ? " " : "") + "Das Budget enthält die Projektnummern " + esc(g.projektNummern.join(", ")) + " mit zusammen " + euro(g.projekte.gesamt) + "." : "") + "</p>";
  }

  function budgetDialog(art, nummer) {
    var w = D.budgetVon(zustand.daten, zustand.jahr, art, nummer);
    var jahr = zustand.jahr;
    if (art === "pn") return pnBudgetDialog(nummer, w, jahr);
    /* Übergreifende Kostenstelle: eingetragen wird ihr eigenes Budget, nicht das Gesamtbudget */
    function summenName() {
      var g = D.gesamtBudgetVon(zustand.daten, jahr, "ks", nummer);
      return !g.uebergreifend ? "Planbudget gesamt" : g.projektNummern.length ? "Budget " + esc(nummer) + " mit Projektnummern" : "Einzelbudget " + esc(nummer);
    }
    function feld(p) {
      return '<div class="feld feld--betrag' + (p.sach ? " feld--unter" : "") + '"><label for="w-' + p.id + '">' + esc(p.name) + "</label>" +
        '<div class="betrag"><input id="w-' + p.id + '" name="' + p.id + '" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(betragFeld(w[p.id])) + '"><span>EUR</span></div></div>';
    }
    var form = oeffneDialog("Planbudget " + D.ARTEN[art].name + " " + nummer + " · " + jahr,
      '<p class="leise klein">Gib die Beträge in EUR mit zwei Nachkommastellen ein, zum Beispiel 12.500,00. Leere Felder zählen als 0,00 EUR.</p>' +
      gesamtHinweisHtml(art, nummer, jahr) +
      feld(D.POSITIONEN[0]) + feld(D.POSITIONEN[1]) +
      '<fieldset class="sachkosten"><legend>Sachkosten</legend>' + D.POSITIONEN.filter(function (p) { return p.sach; }).map(feld).join("") + "</fieldset>" +
      '<div class="summenzeile"><span>Sachkosten</span><strong data-sach></strong></div>' +
      '<div class="summenzeile summenzeile--gesamt"><span>' + summenName() + '</span><strong data-gesamt></strong></div>' +
      '<p class="fehlertext" hidden></p>',
      '<button type="button" class="btn btn--rahmen" data-schliessen>Abbrechen</button><button type="submit" class="btn btn--primaer">Planbudget speichern</button>',
      function (f) {
        var werte = {};
        D.POSITIONEN.forEach(function (p) { werte[p.id] = f[p.id].value; });
        for (var i = 0; i < D.POSITIONEN.length; i++) {
          if (D.leseBetrag(werte[D.POSITIONEN[i].id]) === null) {
            zeigeFehler(f, "Prüfe bitte den Betrag bei „" + D.POSITIONEN[i].name + "“. Erlaubt sind Beträge ab 0,00 EUR, zum Beispiel 12.500,00 EUR.");
            f[D.POSITIONEN[i].id].focus();
            return;
          }
        }
        Dienst.budgetSpeichern(zustand.daten, zustand.benutzer, jahr, art, nummer, werte).then(function (r) {
          uebernehmen(r);
          schliesseDialog();
          meldung("Das Planbudget " + jahr + " für " + D.ARTEN[art].name + " " + nummer + " ist gespeichert.");
          zeige();
        }, function (x) { serverFehler(x, f); });
      });
    function rechne() {
      var z = {};
      D.POSITIONEN.forEach(function (p) { z[p.id] = D.leseBetrag(form[p.id].value) || 0; });
      var sach = z.werbung + z.reise + z.sonstiges;
      form.querySelector("[data-sach]").textContent = D.betragText(sach);
      form.querySelector("[data-gesamt]").textContent = D.betragText(z.pkId + z.pkAd + sach);
    }
    form.addEventListener("input", rechne);
    form.querySelectorAll(".betrag input").forEach(betragEingabe);
    rechne();
  }

  /* Projektnummern haben nur ein Budget als Summe, ohne Kostenarten */
  function pnBudgetDialog(nummer, w, jahr) {
    var n = D.findeNummer(zustand.daten, "pn", nummer);
    var form = oeffneDialog("Planbudget Projektnummer " + nummer + " · " + jahr,
      '<p class="leise klein">Projektnummern haben ein Budget ohne Kostenarten. Gib den Betrag in Euro ein, zum Beispiel 25.000,00.' +
      (n && n.ks ? " Er ist Teil des Gesamtbudgets der Kostenstelle " + esc(n.ks) + "." : "") + "</p>" +
      '<div class="feld feld--betrag"><label for="w-betrag">Budget</label><div class="betrag"><input id="w-betrag" name="betrag" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' +
      esc(w.vorhanden ? betragFeld(w.gesamt) : "") + '"><span>EUR</span></div></div><p class="fehlertext" hidden></p>',
      '<button type="button" class="btn btn--rahmen" data-schliessen>Abbrechen</button><button type="submit" class="btn btn--primaer">Planbudget speichern</button>',
      function (f) {
        if (D.leseBetrag(f.betrag.value) === null) { zeigeFehler(f, "Prüfe bitte den Betrag. Erlaubt sind Beträge ab 0,00 EUR, zum Beispiel 25.000,00 EUR."); f.betrag.focus(); return; }
        Dienst.budgetSpeichern(zustand.daten, zustand.benutzer, jahr, "pn", nummer, { betrag: f.betrag.value }).then(function (r) {
          uebernehmen(r);
          schliesseDialog();
          meldung("Das Planbudget " + jahr + " für Projektnummer " + nummer + " ist gespeichert.");
          zeige();
        }, function (x) { serverFehler(x, f); });
      });
    var i = form.querySelector("[name=betrag]");
    betragEingabe(i);
  }

  /* ---------- Bericht übergreifende Kostenstelle ---------- */

  /* Den Bericht sehen die Abteilungsleitung und alle, denen die übergreifende Kostenstelle zugewiesen ist */
  function darfBericht(b, nummer) {
    var e = D.findeNummer(zustand.daten, "ks", nummer);
    if (!e || !(e.unter || []).length || b.rolle === "admin") return false;
    return D.Rechte.budgets(b) || D.nummernVon(zustand.daten, b.kennung, "ks").indexOf(nummer) >= 0;
  }

  var BERICHT_ZEILEN = [
    { id: "pkId", name: "Personalkosten ID" }, { id: "pkAd", name: "Personalkosten AD" }, { id: "personalkosten", name: "Personalkosten", summe: true },
    { id: "werbung", name: "Werbung" }, { id: "reise", name: "Reise/KfZ" }, { id: "sonstiges", name: "Sonstiges" }, { id: "sachkosten", name: "Sachkosten", summe: true },
    { id: "projekt", name: "Projektnummern", projekt: true }, { id: "gesamt", name: "Planbudget gesamt", gesamt: true }
  ];

  /* Hinweise für den Abgleich: fehlende KST-Berichte, unterschiedliche Stände, Rest unter 0 */
  function berichtHinweise(nummer, gi, g) {
    var h = [];
    if (g.gesamt.ohneEigenenEintrag && g.gesamt.vorhanden) h.push("Für " + nummer + " fehlt noch das Einzelbudget. „Gesamt“ zeigt deshalb nur die Summe der Unterkostenstellen.");
    if (g.gesamt.widerspruch) h.push("Die Projektnummern haben zusammen mehr Planbudget als " + nummer + " selbst. Bitte prüfe die Planbudgets.");
    if (gi.gesamt.ohneEigenImport && gi.gesamt.vorhanden) h.push("Der KST-Bericht von " + nummer + " fehlt noch. „Gesamt“ zeigt deshalb nur die Summe der Unterkostenstellen.");
    var ohne = gi.unter.filter(function (u) { return !u.ist.vorhanden; }).map(function (u) { return u.nummer; });
    if (ohne.length && !gi.gesamt.ohneEigenImport) h.push("Für " + ohne.join(", ") + " gibt es noch keine IST-Werte. Ihre Kosten stecken deshalb noch im eigenen Rest von " + nummer + ".");
    if (gi.gesamt.unterschiedlich) h.push("Die KST-Berichte haben unterschiedliche Stände. Für einen genauen Abgleich importiere sie bitte zum gleichen Monat.");
    if (gi.gesamt.widerspruch) h.push("Die Unterkostenstellen haben zusammen mehr IST als der KST-Bericht von " + nummer + ". Bitte prüfe die Stände der Berichte.");
    return h.length ? '<ul class="warnungen">' + h.map(function (t) { return "<li>" + icon("warning") + "<span>" + esc(t) + "</span></li>"; }).join("") + "</ul>" : "";
  }

  function zeigeBericht(nummer) {
    var daten = zustand.daten, jahr = zustand.jahr;
    var g = D.gesamtBudgetVon(daten, jahr, "ks", nummer), gi = D.gesamtIstVon(daten, jahr, "ks", nummer);
    var spalten = [{ name: "Eigenes Budget", w: g.eigen, i: gi.eigen }].concat(g.unter.map(function (u, x) { return { name: "Kostenstelle " + u.nummer, w: u.budget, i: gi.unter[x].ist }; }));
    if (g.projektNummern.length) { var pw = g.projekte; pw.vorhanden = true; gi.projekte.projekte = { gesamt: gi.projekte.gesamt }; spalten.push({ name: "Projektnummern", w: pw, i: gi.projekte }); }
    spalten.push({ name: "Gesamt", w: g.gesamt, i: gi.gesamt, gesamt: true });
    var mitIst = gi.gesamt.vorhanden;
    /* Zeile Projektnummern nur, wenn die Kostenstelle Projektnummern hat: beim eigenen Budget abgezogen, in ihrer Spalte das Budget */
    var zeilenListe = BERICHT_ZEILEN.filter(function (z) { return !z.projekt || g.projektNummern.length; });
    function tabelle(titel, zeilen, kopfzeile) {
      return '<div class="tabelle-huelle"><table class="budgettabelle berichtstabelle"><caption class="sr">' + esc(titel) + "</caption><thead><tr><th>" + esc(kopfzeile) + "</th>" +
        spalten.map(function (sp) { return '<th class="zahl' + (sp.gesamt ? " summe" : "") + '">' + esc(sp.name) + "</th>"; }).join("") + "</tr></thead><tbody>" + zeilen + "</tbody></table></div>";
    }
    function zeile(name, klasse, wert) {
      return "<tr" + (klasse ? ' class="' + klasse + '"' : "") + '><th scope="row">' + esc(name) + "</th>" +
        spalten.map(function (sp) { return '<td class="zahl' + (sp.gesamt ? " summe" : "") + '">' + wert(sp) + "</td>"; }).join("") + "</tr>";
    }
    function positionen(feld, gesamtName) {
      return zeilenListe.map(function (z) {
        return zeile(z.gesamt ? gesamtName : z.name, z.summe ? "teilsumme" : z.gesamt ? "gesamtzeile" : "", function (sp) {
          var w = sp[feld];
          if (feld === "i" && !w.vorhanden) return '<span class="leise">–</span>';
          return z.gesamt ? "<strong>" + euro(w[z.id]) + "</strong>" : euro(w[z.id]);
        });
      }).join("");
    }
    /* Vergleich Plan und IST je Spalte */
    var VERGLEICH = [
      { name: "Planbudget", wert: function (k) { return euro(k.plan); }, roh: function (k) { return k.plan; } },
      { name: "IST", wert: function (k) { return euro(k.ist); }, roh: function (k) { return k.ist; } },
      { name: "IST in % vom Plan", klasse: "teilsumme", wert: function (k) { return "<strong>" + prozent(k.quote) + "</strong>"; }, roh: function (k) { return k.quote; }, prozent: true },
      { name: "Restbudget", wert: function (k) { return euro(k.rest); }, roh: function (k) { return k.rest; } },
      { name: "Hochrechnung Jahresende", wert: function (k) { return euro(k.hochrechnung); }, roh: function (k) { return k.hochrechnung; } },
      { name: "IST zum zeitanteiligen Plan", wert: function (k) { return prozent(k.hochQuote); }, roh: function (k) { return k.hochQuote; }, prozent: true },
      { name: "Vorjahr gleicher Zeitraum", wert: function (k) { return k.vorjahr === null ? "–" : euro(k.vorjahr); }, roh: function (k) { return k.vorjahr; } },
      { name: "Veränderung zum Vorjahr", wert: function (k) { return k.vorjahrQuote === null ? "–" : prozent(k.vorjahrQuote, true); }, roh: function (k) { return k.vorjahrQuote; }, prozent: true }
    ];
    var kz = function (sp) { return sp.i.vorhanden ? D.kennzahlen(sp.w, sp.i) : null; };
    var kg = mitIst ? D.kennzahlen(g.gesamt, gi.gesamt) : null;
    var html = zurueckHtml("#/uebersicht") + '<div class="seite__kopf"><div><p class="topline">Bericht übergreifende Kostenstelle</p><h1>Kostenstelle ' + esc(nummer) + " · " + jahr + "</h1></div>" + jahrwahlHtml() + "</div>" +
      '<div class="kennzahlen">' +
      kennzahl("Planbudget gesamt", euro(g.gesamt.gesamt), "inklusive " + g.unter.length + " Unterkostenstellen") +
      (kg ? kennzahl(istUeberschrift(gi.gesamt), euro(kg.ist), esc(D.standText(gi.gesamt.stand, gi.gesamt.monat))) +
        kennzahl("IST in % vom Plan", prozent(kg.quote), "Restbudget " + euro(kg.rest)) +
        kennzahl("Zum zeitanteiligen Plan", zzvHtml(kg), "Hochrechnung Jahresende " + euro(kg.hochrechnung))
        : kennzahl("Eigenes Budget", euro(g.eigen.gesamt), "Kostenstelle " + esc(nummer)) +
        kennzahl("Zugeordnete Kostenstellen", euro(D.summe(g.unter.map(function (u) { return u.budget; })).gesamt), esc(g.unter.map(function (u) { return u.nummer; }).join(", "))) +
        kennzahl("IST-Werte", "–", "noch nicht importiert")) + "</div>" +
      '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>Bericht ' + jahr + "</h2>" +
      '<button type="button" class="btn btn--rahmen" data-kopieren>' + icon("copy") + " Bericht kopieren</button></div>" +
      '<p class="leise klein">Mit „Bericht kopieren“ fügst Du alle Tabellen direkt in Excel ein und kannst sie dort mit Deinen KST-Berichten abgleichen. ' +
      "„IST gesamt“ in der Spalte Gesamt entspricht den Primärkosten I im KST-Bericht von " + esc(nummer) + ". „Eigenes Budget“ ist, was ohne Unterkostenstellen und Projektnummern auf " + esc(nummer) + " selbst liegt.</p>" + berichtHinweise(nummer, gi, g) +
      "<h3>Planbudget nach Positionen</h3>" + tabelle("Planbudget nach Positionen", positionen("w", "Planbudget gesamt"), "Position") +
      (mitIst
        ? "<h3>" + esc(istUeberschrift(gi.gesamt)) + " nach Positionen</h3>" +
          tabelle("IST nach Positionen", zeile("Stand", "standzeile", function (sp) { return sp.i.vorhanden ? esc(D.standText(sp.i.stand, sp.i.monat).replace("Stand ", "")) : '<span class="leise">keine IST-Werte</span>'; }) +
            positionen("i", "IST gesamt") + zeile("davon Projektkosten", "standzeile", function (sp) { return sp.i.vorhanden && sp.i.projekte ? euro(sp.i.projekte.gesamt || 0) : '<span class="leise">–</span>'; }), "Position") +
          "<h3>Plan gegen IST</h3>" + tabelle("Plan gegen IST", VERGLEICH.map(function (v) {
            return zeile(v.name, v.klasse || "", function (sp) { var k = kz(sp); return k ? v.wert(k) : '<span class="leise">–</span>'; });
          }).join(""), "Kennzahl")
        : '<p class="leer-hinweis">Für ' + jahr + " gibt es noch keine IST-Werte für diese Kostenstelle und ihre Unterkostenstellen.</p>") +
      "</section>";
    seite("bericht", "Bericht " + nummer, html, true);
    verbindeJahrwahl();
    app.querySelector("[data-kopieren]").addEventListener("click", function () {
      var zahl = function (z) { return (Number(z) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }); };
      var pz = function (q) { return q === null || q === undefined || !isFinite(q) ? "" : (q * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }) + " %"; };
      function block(titel, zeilen) { return [titel].concat(spalten.map(function (sp) { return sp.name; })).join("\t") + "\n" + zeilen.join("\n"); }
      var teile = [block("Planbudget Kostenstelle " + nummer + " " + jahr, zeilenListe.map(function (z) { return [z.gesamt ? "Planbudget gesamt" : z.name].concat(spalten.map(function (sp) { return zahl(sp.w[z.id]); })).join("\t"); }))];
      if (mitIst) {
        teile.push(block(istUeberschrift(gi.gesamt) + " Kostenstelle " + nummer, [["Stand"].concat(spalten.map(function (sp) { return sp.i.vorhanden ? D.standText(sp.i.stand, sp.i.monat).replace("Stand ", "") : ""; })).join("\t")]
          .concat(zeilenListe.map(function (z) { return [z.gesamt ? "IST gesamt" : z.name].concat(spalten.map(function (sp) { return sp.i.vorhanden ? zahl(sp.i[z.id]) : ""; })).join("\t"); }))
          .concat([["davon Projektkosten"].concat(spalten.map(function (sp) { return sp.i.vorhanden && sp.i.projekte ? zahl(sp.i.projekte.gesamt || 0) : ""; })).join("\t")])));
        teile.push(block("Plan gegen IST", VERGLEICH.map(function (v) {
          return [v.name].concat(spalten.map(function (sp) { var k = kz(sp), r = k ? v.roh(k) : null; return r === null ? "" : v.prozent ? pz(r) : zahl(r); })).join("\t");
        })));
      }
      kopiere(teile.join("\n\n")).then(function () { meldung("Der Bericht ist kopiert. Füge ihn in Excel mit Strg+V ein."); }, function () { meldung("Das Kopieren hat nicht geklappt. Markiere die Tabellen bitte von Hand.", true); });
    });
  }

  /* ---------- Detailseite einer Kostenstelle (Abteilungsleitung): IST im Detail, bezogen auf das Planbudget ---------- */

  /* Zurück zur Übersicht: dorthin, woher man kam (innerhalb des Tools), sonst zur passenden Übersicht */
  function merkeHerkunft(alt) {
    var h = String(alt || "").split("#")[1] || "";
    var seiteAlt = h.replace(/^\/?/, "").split("/")[0];
    if (["kostenstelle", "projekt", "bericht"].indexOf(seiteAlt) < 0) zustand.herkunft = "#" + (h.charAt(0) === "/" ? h : "/" + h);
  }
  function zurueckHtml(standard) {
    return '<a class="zurueck" href="' + esc(zustand.herkunft || standard) + '">' + icon("arrow-left") + " Zurück zur Übersicht</a>";
  }

  function ksLink(nr, text) { return '<a href="#/kostenstelle/' + esc(nr) + '" title="Details Kostenstelle ' + esc(nr) + '">' + esc(text || nr) + "</a>"; }

  function zeigeKostenstelle(nummer, nurEigen) {
    var daten = zustand.daten, jahr = zustand.jahr;
    var g = D.gesamtBudgetVon(daten, jahr, "ks", nummer), gi = D.gesamtIstVon(daten, jahr, "ks", nummer);
    /* Übergreifende Kostenstelle: wahlweise nur ihr eigener Teil (Einzelbudget und eigenes IST, ohne Unterkostenstellen und Projektnummern) */
    nurEigen = nurEigen && g.uebergreifend;
    var plan = nurEigen ? g.eigen : g.gesamt, ist = nurEigen ? gi.eigen : gi.gesamt, vj = nurEigen ? null : vorjahrGesamt(nummer), vz = ist.vorhanden ? ist.vergleich : null;
    var umschalter = g.uebergreifend ? '<nav class="umschalter" aria-label="Ansicht"><a href="#/kostenstelle/' + esc(nummer) + '"' + (nurEigen ? "" : ' aria-current="page"') + ">Gesamt mit Unterkostenstellen</a>" +
      '<a href="#/kostenstelle/' + esc(nummer) + '/eigen"' + (nurEigen ? ' aria-current="page"' : "") + ">Nur " + esc(nummer) + " selbst</a></nav>" +
      (nurEigen ? '<p class="leise klein">Einzelbudget und eigenes IST von ' + esc(nummer) + ": ohne Unterkostenstellen und ohne Projektnummern.</p>" : "") : "";
    var oben = D.uebergeordnete(daten, nummer), n = D.findeNummer(daten, "ks", nummer);
    var wer = namenVon(n.benutzer);
    var html = zurueckHtml("#/ist") + '<div class="seite__kopf"><div><p class="topline"><a href="#/ist">IST-Werte</a> · Kostenstelle</p><h1>Kostenstelle ' + esc(nummer) + " · " + jahr + "</h1>" +
      '<p class="leise klein">' + esc(wer.length ? "Verantwortlich: " + wer.join(", ") : "Noch niemand verantwortlich") +
      (oben ? " · Unterkostenstelle von " : "") + (oben ? ksLink(oben) : "") +
      (g.uebergreifend ? " · Unterkostenstellen " + g.unter.map(function (u) { return ksLink(u.nummer); }).join(", ") : "") + "</p></div>" + jahrwahlHtml() + "</div>" + umschalter;
    if (!ist.vorhanden) {
      /* Ohne IST trotzdem das Planbudget zeigen */
      html += '<section class="karte"><h2>' + (nurEigen ? "Einzelbudget " : "Planbudget ") + jahr + "</h2>" +
        (plan.vorhanden ? '<p class="budget__gesamt"><strong>' + euro(plan.gesamt) + "</strong></p>" + anteilHtml(plan) + planKostenartenHtml(plan)
          : '<p class="leer-hinweis">Für ' + jahr + " ist noch kein Planbudget eingetragen." + (D.Rechte.budgets(zustand.benutzer) ? ' <a href="#/uebersicht">Planbudgets eintragen</a>' : "") + "</p>") + "</section>";
      html += '<p class="leer-hinweis">Für ' + jahr + " gibt es noch keine IST-Werte für die Kostenstelle " + esc(nummer) + (nurEigen ? ". Den eigenen Teil rechnet das Tool aus dem KST-Bericht von " + esc(nummer) + " aus" : "") + '. <a href="#/verwaltung/ist">KST-Bericht importieren</a></p>';
      seite("ist", "Kostenstelle " + nummer, html, true);
      verbindeJahrwahl();
      return;
    }
    var k = D.kennzahlen(plan, ist), mon = ist.bisMonat || 12, restMonate = 12 - mon;
    var zeitPlan = function (w) { return D.runde ? D.runde(w * mon / 12) : Math.round(w * mon / 12 * 100) / 100; };
    var proMonat = restMonate > 0 && plan.vorhanden ? k.rest / restMonate : null;
    html += '<div class="kennzahlen kennzahlen--sechs">' +
      kennzahl(nurEigen ? "Einzelbudget " + jahr : "Planbudget " + jahr, plan.vorhanden ? euro(plan.gesamt) : "–", nurEigen ? "ohne Unterkostenstellen und Projektnummern" : g.uebergreifend || g.projektNummern.length ? "Gesamtbudget inklusive " + (g.uebergreifend ? "Unterkostenstellen" : "Projektnummern") : "") +
      kennzahl(istUeberschrift(ist), euro(k.ist), (plan.vorhanden ? "<strong>" + prozent(k.quote) + "</strong> vom Plan · Rest " + euro(k.rest) + "<br>" : "") + esc(D.standText(ist.stand, ist.monat))) +
      (plan.vorhanden
        ? kennzahl("Zum zeitanteiligen Plan", zzvHtml(k), "Plan bis " + D.monatName(ist.monat) + ": " + euro(zeitPlan(plan.gesamt))) +
          kennzahl("Hochrechnung Jahresende", euro(k.hochrechnung), (plan.gesamt > 0 ? "<strong>" + prozent(k.hochrechnung / plan.gesamt) + "</strong> vom Plan · " : "") + (k.hochrechnung - plan.gesamt > 0 ? "über Plan um " : "unter Plan um ") + euro(Math.abs(k.hochrechnung - plan.gesamt)))
        : kennzahl("Planbudget", "–", "noch nicht eingetragen")) +
      kennzahl("Je Monat", euro(k.ist / mon), proMonat !== null ? "IST im Schnitt · verfügbar je Restmonat " + euro(proMonat) : "IST im Schnitt") +
      (k.vorjahr !== null ? kennzahl("Vorjahr gleicher Zeitraum", euro(k.vorjahr), "Veränderung " + prozent(k.vorjahrQuote, true)) : "") + "</div>";
    if (g.uebergreifend && !nurEigen) html += berichtHinweise(nummer, gi, g);

    /* Positionen: Plan, IST, zeitanteiliger Plan, Abweichung, Hochrechnung, Vorjahr */
    function zelle(v, klasse) { return '<td class="zahl' + (klasse ? " " + klasse : "") + '">' + v + "</td>"; }
    var zeilen = [], zeilen2 = [];
    BERICHT_ZEILEN.filter(function (z) { return !z.projekt; }).forEach(function (z) {
      var p = plan.vorhanden ? plan[z.id] : null, i = ist[z.id], zp = p === null ? null : zeitPlan(p);
      var hoch = mon >= 12 ? i : Math.round(i / mon * 12 * 100) / 100;
      var q = p > 0 ? i / p : null, zq = zp > 0 ? i / zp : null;
      var klasse = z.summe ? "teilsumme" : z.gesamt ? "gesamtzeile" : "";
      var kopf = "<tr" + (klasse ? ' class="' + klasse + '"' : "") + '><th scope="row">' + esc(z.gesamt ? "Gesamt" : z.name) + "</th>";
      zeilen.push(kopf + zelle(p === null ? "–" : euro(p)) + zelle("<strong>" + euro(i) + "</strong>") + zelle(prozent(q), q !== null && q > 1 ? "minus" : "leise") +
        zelle(p === null ? "–" : euro(p - i), p !== null && p - i < 0 ? "minus" : "") +
        zelle(zp === null ? "–" : euro(zp), "leise") + zelle(zp === null ? "–" : euro(i - zp), zp !== null && i - zp > 0 ? "minus" : "") +
        "<td>" + (zq === null ? '<span class="leise">–</span>' : zzvHtml(zzvAus(zq))) + "</td></tr>");
      zeilen2.push(kopf + zelle(euro(hoch)) + zelle(p === null ? "–" : euro(hoch - p), p !== null && hoch - p > 0 ? "minus" : "") +
        zelle(vz ? euro(vz[z.id]) : "–", "leise") + zelle(vz && vz[z.id] ? prozent((i - vz[z.id]) / vz[z.id], true) : "–", "leise") +
        (vj ? zelle(euro(vj[z.id]), "leise") + zelle(vj[z.id] ? prozent((hoch - vj[z.id]) / vj[z.id], true) : "–", "leise") : "") + "</tr>");
    });
    var bis = esc(D.monatName(ist.monat));
    html += '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>Plan und IST je Position</h2></div>' +
      '<p class="leise klein">„Plan bis ' + bis + "“ ist der zeitanteilige Plan (" + mon + " von 12 Monaten). Eine Abweichung über 0 heißt: mehr ausgegeben als zeitanteilig geplant.</p>" +
      '<div class="tabelle-huelle"><table class="budgettabelle detailtabelle"><thead><tr><th>Position</th><th class="zahl">Plan</th><th class="zahl">IST</th><th class="zahl">vom Plan</th><th class="zahl">Restbudget</th>' +
      '<th class="zahl">Plan bis ' + bis + '</th><th class="zahl">Abweichung</th><th>zeitanteilig</th></tr></thead><tbody>' + zeilen.join("") + "</tbody></table></div>" +
      diagrammHtml(plan.vorhanden ? plan : D.summe([]), ist, vz, "") + "</section>" +
      '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>Hochrechnung und Vorjahr je Position</h2></div>' +
      '<p class="leise klein">Die Hochrechnung schreibt das IST gleichmäßig bis Dezember fort. „Zum Vorjahr“ vergleicht mit dem gleichen Zeitraum ' + (jahr - 1) + (vj ? ", „Hochrechnung zum Vorjahr“ mit dem ganzen Jahr " + (jahr - 1) : "") + ".</p>" +
      '<div class="tabelle-huelle"><table class="budgettabelle detailtabelle"><thead><tr><th>Position</th><th class="zahl">Hochrechnung</th><th class="zahl">zum Plan</th>' +
      '<th class="zahl">IST ' + (jahr - 1) + " bis " + bis + '</th><th class="zahl">IST zum Vorjahr</th>' + (vj ? '<th class="zahl">IST ' + (jahr - 1) + ' gesamt</th><th class="zahl">Hochrechnung zum Vorjahr</th>' : "") +
      "</tr></thead><tbody>" + zeilen2.join("") + "</tbody></table></div></section>";

    /* Zusammensetzung: eigener Teil, Unterkostenstellen und Projektnummern */
    if (!nurEigen && (g.uebergreifend || g.projektNummern.length)) {
      var teile = [];
      if (g.uebergreifend) teile.push({ name: esc(nummer), hinweis: "ohne Unterkostenstellen und Projektnummern", w: g.eigen, i: gi.eigen });
      g.unter.forEach(function (u, x) { teile.push({ name: ksLink(u.nummer), hinweis: "Unterkostenstelle", w: u.budget, i: gi.unter[x].ist }); });
      g.projektNummern.forEach(function (pn) { teile.push({ name: '<a href="#/projekt/' + esc(pn) + '">' + esc(pn) + "</a>", hinweis: "Projektnummer", w: D.budgetVon(daten, jahr, "pn", pn), i: D.projektIstVon(daten, jahr, pn) }); });
      html += '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>Zusammensetzung</h2>' +
        (g.uebergreifend ? '<a class="btn btn--rahmen" href="#/bericht/' + esc(nummer) + '">' + icon("diagramBarchart") + " Bericht ansehen</a>" : "") + "</div>" +
        '<div class="tabelle-huelle"><table class="budgettabelle einzelbudgets"><thead><tr><th>Teil</th><th class="zahl">Planbudget</th><th class="zahl">IST</th><th>ausgegeben</th><th class="zahl">Restbudget</th><th class="zahl">Anteil am IST</th><th title="IST zum zeitanteiligen Plan">zeitanteilig</th></tr></thead><tbody>' +
        teile.map(function (t) {
          var kk = t.i.vorhanden && t.w.vorhanden ? D.kennzahlen(t.w, t.i) : null;
          return '<tr><th scope="row">' + t.name + '<br><span class="leise klein">' + esc(t.hinweis) + "</span></th>" +
            zelle(t.w.vorhanden ? euro(t.w.gesamt) : "–") + zelle(t.i.vorhanden ? euro(t.i.gesamt) : '<span class="leise">keine IST-Werte</span>') +
            "<td>" + balkenHtml(kk) + "</td>" + zelle(kk ? euro(kk.rest) : "–", kk && kk.rest < 0 ? "minus" : "") +
            zelle(t.i.vorhanden && ist.gesamt ? prozent(t.i.gesamt / ist.gesamt) : "–", "leise") + "<td>" + ampelHtml(kk) + "</td></tr>";
        }).join("") + "</tbody></table></div></section>";
    }
    seite("ist", "Kostenstelle " + nummer, html, true);
    verbindeJahrwahl();
  }

  /* ---------- Verwaltung ---------- */

  function reiterListe() {
    var b = zustand.benutzer;
    var r = [
      { id: "benutzer", name: "Benutzer", icon: "peopleTwo" },
      { id: "kostenstellen", name: "Kostenstellen", icon: "folderOpen" },
      { id: "projekte", name: "Projektnummern", icon: "briefcase" },
      { id: "ist", name: "KST-Berichte", icon: "documentXls" }
    ];
    if (D.Rechte.einstellungen(b) || D.Rechte.budgets(b)) r.push({ id: "einstellungen", name: "Einstellungen", icon: "settings" });
    return r;
  }

  function zeigeVerwaltung(unter) {
    var reiter = reiterListe();
    if (!reiter.some(function (r) { return r.id === unter; })) unter = "benutzer";
    var aktiv = reiter.filter(function (r) { return r.id === unter; })[0];
    seite("verwaltung", aktiv.name,
      '<div class="seite__kopf"><div><p class="topline">Verwaltung</p><h1>' + esc(aktiv.name) + "</h1></div><div data-kopfaktion></div></div>" +
      '<nav class="reiter" aria-label="Verwaltung">' + reiter.map(function (r) {
        return '<a href="#/verwaltung/' + r.id + '"' + (r.id === unter ? ' aria-current="page"' : "") + ">" + icon(r.icon) + esc(r.name) + "</a>";
      }).join("") + "</nav><div data-verwaltung></div>");
    var ziel = app.querySelector("[data-verwaltung]");
    var kopfaktion = app.querySelector("[data-kopfaktion]");
    if (unter === "benutzer") verwaltungBenutzer(ziel, kopfaktion);
    else if (unter === "einstellungen") verwaltungEinstellungen(ziel);
    else if (unter === "ist") verwaltungIst(ziel);
    else verwaltungNummern(unter === "projekte" ? "pn" : "ks", ziel, kopfaktion);
  }

  /* Nach einer Änderung in der Verwaltung: Sicht übernehmen und den Reiter neu zeichnen */
  function nachAenderung(text) {
    return function (r) {
      uebernehmen(r);
      schliesseDialog();
      if (text) meldung(text);
      zeige();
      return r;
    };
  }

  function einmalHtml(b) {
    if (!b.mussPasswortAendern) return '<span class="chip">Aktiv</span>';
    return '<span class="chip chip--warn">Einmalpasswort</span>' +
      (b.einmalpasswort ? ' <code class="einmal" title="Einmalpasswort, gültig bis zur ersten Anmeldung">' + esc(b.einmalpasswort) + "</code>" +
        '<button type="button" class="icon-btn icon-btn--klein" data-kopieren="' + esc(b.einmalpasswort) + '" aria-label="Einmalpasswort von ' + esc(b.kennung) + ' kopieren" title="Kopieren">' + icon("copy") + "</button>" : "");
  }

  function verwaltungBenutzer(ziel, kopfaktion) {
    var daten = zustand.daten, ich = zustand.benutzer;
    kopfaktion.innerHTML = '<button type="button" class="btn btn--primaer" data-neu>' + icon("plus") + " Neuer Benutzer</button>";
    kopfaktion.querySelector("[data-neu]").addEventListener("click", function () { benutzerDialog(null); });
    var liste = daten.benutzer.slice().sort(function (a, b) {
      var r = D.ROLLEN.map(function (x) { return x.id; });
      return r.indexOf(a.rolle) - r.indexOf(b.rolle) || D.anzeigeName(a).localeCompare(D.anzeigeName(b), "de");
    });
    ziel.innerHTML = '<div class="karte"><p class="leise klein">' + liste.length + " Benutzer. Ein Einmalpasswort bleibt hier sichtbar, bis die Person es bei der ersten Anmeldung ändert." +
      (ich.rolle === "al" ? " Konten von Administratoren verwaltet nur ein Administrator." : "") + "</p>" +
      '<div class="tabelle-huelle"><table><thead><tr><th>XV-Nummer</th><th>Name</th><th>Rolle</th><th>Kostenstellen / Projektnummern</th><th>Passwort</th><th>Letzte Anmeldung</th><th><span class="sr">Aktionen</span></th></tr></thead><tbody>' +
      liste.map(function (b) {
        var darf = D.darfKontoVerwalten(ich, b);
        var ks = D.nummernVon(daten, b.kennung, "ks"), pn = D.nummernVon(daten, b.kennung, "pn");
        return '<tr data-zeile="' + esc(b.kennung) + '"><td><strong>' + esc(b.kennung) + "</strong>" + (b.kennung === ich.kennung ? ' <span class="leise klein">(Du)</span>' : "") + "</td>" +
          "<td>" + esc(D.anzeigeName(b)) + "</td>" +
          '<td><span class="chip' + (b.rolle === "admin" ? " chip--akzent" : "") + '">' + esc(D.rollenName(b.rolle)) + "</span></td>" +
          '<td><div class="chips">' + (ks.map(function (n) { return '<span class="chip chip--ks" title="Kostenstelle">KST ' + esc(n) + "</span>"; }).join("") +
            pn.map(function (n) { return '<span class="chip chip--pn" title="Projektnummer">PN ' + esc(n) + "</span>"; }).join("") || '<span class="leise">–</span>') + "</div></td>" +
          '<td class="passwortzelle">' + einmalHtml(b) + "</td>" +
          '<td class="klein">' + esc(datumZeit(b.letzteAnmeldung)) + "</td>" +
          '<td><div class="liste__aktionen">' +
          (ich.rolle === "admin" && !zustand.alsAdmin && b.kennung !== ich.kennung ? '<button type="button" class="icon-btn" data-als="' + esc(b.kennung) + '" aria-label="Als ' + esc(b.kennung) + ' anmelden" title="Anmelden als (Beta)">' + icon("login") + "</button>" : "") + /* BETA-ANMELDEN-ALS */
          '<button type="button" class="icon-btn" data-bearbeiten="' + esc(b.kennung) + '" aria-label="' + esc(b.kennung) + ' bearbeiten" title="Bearbeiten"' + (darf ? "" : " disabled") + ">" + icon("pencil") + "</button>" +
          '<button type="button" class="icon-btn" data-reset="' + esc(b.kennung) + '" aria-label="Neues Einmalpasswort für ' + esc(b.kennung) + '" title="Neues Einmalpasswort"' + (darf && b.kennung !== ich.kennung ? "" : " disabled") + ">" + icon("lockClosed") + "</button>" +
          '<button type="button" class="icon-btn icon-btn--gefahr" data-loeschen="' + esc(b.kennung) + '" aria-label="' + esc(b.kennung) + ' löschen" title="Löschen"' + (darf && b.kennung !== ich.kennung ? "" : " disabled") + ">" + icon("bin") + "</button>" +
          "</div></td></tr>";
      }).join("") + "</tbody></table></div></div>";

    ziel.querySelectorAll("[data-kopieren]").forEach(function (k) {
      k.addEventListener("click", function () {
        kopiere(k.getAttribute("data-kopieren")).then(function () { meldung("Das Einmalpasswort ist kopiert."); }, function () {
          meldung("Kopieren klappt hier nicht. Markiere das Passwort bitte und kopiere es mit Strg+C.", true);
        });
      });
    });
    ziel.querySelectorAll("[data-bearbeiten]").forEach(function (k) { k.addEventListener("click", function () { benutzerDialog(D.findeBenutzer(daten, k.getAttribute("data-bearbeiten"))); }); });
    // BETA-ANMELDEN-ALS Anfang
    ziel.querySelectorAll("[data-als]").forEach(function (k) {
      k.addEventListener("click", function () {
        var b = D.findeBenutzer(daten, k.getAttribute("data-als"));
        bestaetige("Anmelden als (Beta)", "Möchtest Du Dich als " + D.anzeigeName(b) + " (" + b.kennung + ") anmelden? Du siehst und änderst dann alles mit deren Rechten. Das Passwort und ein aktives Einmalpasswort bleiben unverändert. Über die Leiste oben kommst Du zurück.", "Anmelden als " + b.kennung)
          .then(function (ja) {
            if (!ja) return;
            Dienst.anmeldenAls(daten, ich, b.kennung).then(function (r) { uebernehmen(r); setzeDesign(r.benutzer.design || "auto", r.benutzer.farbe || "klassik"); location.hash = "#/start"; zeige(); }, serverFehler);
          });
      });
    });
    // BETA-ANMELDEN-ALS Ende
    ziel.querySelectorAll("[data-reset]").forEach(function (k) {
      k.addEventListener("click", function () {
        var b = D.findeBenutzer(daten, k.getAttribute("data-reset"));
        bestaetige("Neues Einmalpasswort", "Möchtest Du für " + D.anzeigeName(b) + " (" + b.kennung + ") ein neues Einmalpasswort erzeugen? Das bisherige Passwort gilt dann nicht mehr.", "Einmalpasswort erzeugen")
          .then(function (ja) {
            if (!ja) return;
            Dienst.passwortZuruecksetzen(daten, ich, b.kennung, D.einmalpasswort())
              .then(nachAenderung("Das neue Einmalpasswort für " + b.kennung + " steht in der Liste."), serverFehler);
          });
      });
    });
    ziel.querySelectorAll("[data-loeschen]").forEach(function (k) {
      k.addEventListener("click", function () {
        var b = D.findeBenutzer(daten, k.getAttribute("data-loeschen"));
        var fehler = D.pruefeLoeschen(daten, ich, b);
        if (fehler) { meldung(fehler, true); return; }
        bestaetige("Benutzer löschen", "Möchtest Du " + D.anzeigeName(b) + " (" + b.kennung + ") löschen? Die Zuweisungen zu Kostenstellen und Projektnummern entfallen. Die Planbudgets bleiben erhalten.", "Benutzer löschen")
          .then(function (ja) { if (ja) Dienst.benutzerLoeschen(daten, ich, b.kennung).then(nachAenderung(b.kennung + " ist gelöscht."), serverFehler); });
      });
    });
  }

  /* Checkboxen für die Zuweisung im Benutzerdialog, passend zur gewählten Rolle */
  function zuweisungHtml(rolle, kennung) {
    var daten = zustand.daten;
    return ["ks", "pn"].filter(function (art) { return D.ARTEN[art].rollen.indexOf(rolle) >= 0; }).map(function (art) {
      var a = D.ARTEN[art], l = D.liste(daten, art);
      var aktiv = kennung ? D.nummernVon(daten, kennung, art) : [];
      return '<fieldset class="zuweisung" data-art="' + art + '"><legend>' + esc(a.mehrzahl) + "</legend>" +
        (l.length ? '<div class="zuweisung__liste">' + l.map(function (n) {
          return '<label class="check"><input type="checkbox" name="nr-' + art + '" value="' + esc(n.nummer) + '"' + (aktiv.indexOf(n.nummer) >= 0 ? " checked" : "") + "> " + esc(n.nummer) + "</label>";
        }).join("") + "</div>" : '<p class="leise klein">Noch keine ' + esc(a.mehrzahl) + " angelegt.</p>") +
        '<p class="hilfe">Optional. Mehrfachauswahl ist möglich.</p></fieldset>';
    }).join("") || '<p class="leise klein">Administratoren bekommen keine Kostenstellen oder Projektnummern.</p>';
  }

  function benutzerDialog(b) {
    var daten = zustand.daten, ich = zustand.benutzer;
    var neu = !b;
    var rollen = D.erlaubteRollen(ich);
    var startRolle = b ? b.rolle : "gl";
    var form = oeffneDialog(neu ? "Neuer Benutzer" : "Benutzer bearbeiten",
      (neu ? '<div class="feld"><label for="b-kennung">XV-Nummer</label><input id="b-kennung" name="kennung" type="text" maxlength="7" placeholder="xv12345">' +
        '<p class="hilfe">„xv“ und fünf Ziffern. Die XV-Nummer ist der Benutzername und lässt sich später nicht ändern.</p></div>'
        : '<p>XV-Nummer: <strong>' + esc(b.kennung) + "</strong></p>") +
      '<div class="zweispaltig"><div class="feld"><label for="b-vor">Vorname</label><input id="b-vor" name="vorname" type="text" maxlength="40" value="' + esc(b ? b.vorname : "") + '"></div>' +
      '<div class="feld"><label for="b-nach">Nachname</label><input id="b-nach" name="nachname" type="text" maxlength="40" value="' + esc(b ? b.nachname : "") + '"></div></div>' +
      '<div class="feld"><label for="b-rolle">Rolle</label><select id="b-rolle" name="rolle">' + rollen.map(function (r) {
        return '<option value="' + r.id + '"' + (r.id === startRolle ? " selected" : "") + ">" + esc(r.name) + "</option>";
      }).join("") + "</select>" +
      '<p class="hilfe">Gruppenleitungen bekommen Kostenstellen, Key Account Manager Projektnummern. Beide sehen die Planbudgets ihrer Nummern.</p></div>' +
      '<div data-zuweisung>' + zuweisungHtml(startRolle, b && b.kennung) + "</div>" +
      (neu ? '<div class="feld" style="margin-top:1rem"><label for="b-pw">Einmalpasswort</label><div class="mit-knopf"><input id="b-pw" name="passwort" type="text" autocomplete="off" value="' + esc(D.einmalpasswort()) + '">' +
        '<button type="button" class="btn btn--rahmen btn--klein" data-neues-pw>' + icon("reload") + " Neu</button></div>" +
        '<p class="hilfe">Bleibt in der Benutzerliste sichtbar, bis die Person es bei der ersten Anmeldung durch ein eigenes Passwort ersetzt.</p></div>' : "") +
      '<p class="fehlertext" hidden></p>',
      '<button type="button" class="btn btn--rahmen" data-schliessen>Abbrechen</button><button type="submit" class="btn btn--primaer">' + (neu ? "Benutzer anlegen" : "Änderungen speichern") + "</button>",
      function (f) {
        var nummern = {};
        ["ks", "pn"].forEach(function (art) {
          nummern[art] = Array.prototype.slice.call(f.querySelectorAll("[name=nr-" + art + "]:checked")).map(function (c) { return c.value; });
        });
        var felder = { kennung: neu ? D.normalisiereKennung(f.kennung.value) : b.kennung, vorname: f.vorname.value.trim(), nachname: f.nachname.value.trim(), rolle: f.rolle.value, nummern: nummern };
        var fehler = D.pruefeBenutzer(daten, ich, b, felder);
        if (fehler) { zeigeFehler(f, fehler); return; }
        if (neu) {
          var maengel = D.passwortMaengel(f.passwort.value, felder);
          if (maengel.length) { zeigeFehler(f, "Das Einmalpasswort braucht noch " + maengel.join(", ") + "."); return; }
          Dienst.benutzerAnlegen(daten, ich, felder, f.passwort.value)
            .then(nachAenderung(felder.kennung + " ist angelegt. Das Einmalpasswort steht in der Liste."), function (x) { serverFehler(x, f); });
        } else {
          Dienst.benutzerAendern(daten, ich, b.kennung, felder).then(nachAenderung("Die Änderungen für " + b.kennung + " sind gespeichert."), function (x) { serverFehler(x, f); });
        }
      });
    form.rolle.addEventListener("change", function () { form.querySelector("[data-zuweisung]").innerHTML = zuweisungHtml(form.rolle.value, b && b.kennung); });
    var neuPw = form.querySelector("[data-neues-pw]");
    if (neuPw) neuPw.addEventListener("click", function () { form.passwort.value = D.einmalpasswort(); });
  }

  function verwaltungNummern(art, ziel, kopfaktion) {
    var daten = zustand.daten, ich = zustand.benutzer, a = D.ARTEN[art];
    kopfaktion.innerHTML = '<button type="button" class="btn btn--primaer" data-neu>' + icon("plus") + " Neue " + esc(a.name) + "</button>";
    kopfaktion.querySelector("[data-neu]").addEventListener("click", function () { nummerDialog(art, null); });
    var l = D.liste(daten, art);
    var jahr = new Date().getFullYear();
    ziel.innerHTML = '<div class="karte"><p class="leise klein">' + esc(a.mehrzahl) + " haben genau " + a.stellen + " Ziffern. Zuweisen kannst Du sie " +
      (art === "ks" ? "Gruppenleitungen und Abteilungsleitungen" : "Key Account Managern") + ", gern auch mehreren Personen.</p>" +
      (l.length ? '<div class="tabelle-huelle"><table><thead><tr><th>' + esc(a.name) + "</th><th>Verantwortlich</th>" + (art === "ks" ? "<th>Unterkostenstellen</th>" : "<th>Kostenstelle</th>") +
        (D.Rechte.budgets(ich) ? '<th class="zahl">Planbudget ' + jahr + "</th>" : "") + '<th><span class="sr">Aktionen</span></th></tr></thead><tbody>' +
        l.map(function (n) {
          var namen = namenVon(n.benutzer);
          var w = D.budgetVon(daten, jahr, art, n.nummer);
          return '<tr data-zeile="' + esc(n.nummer) + '"><th scope="row"><strong>' + esc(n.nummer) + "</strong></th>" +
            '<td><div class="chips">' + (namen.length ? namen.map(function (x) { return '<span class="chip">' + esc(x) + "</span>"; }).join("") : '<span class="leise">niemand</span>') + "</div></td>" +
            (art === "ks" ? "<td>" + uebergreifendText(daten, n) + "</td>" : "<td>" + (n.ks ? "Kostenstelle " + esc(n.ks) : '<span class="leise">–</span>') + "</td>") +
            (D.Rechte.budgets(ich) ? '<td class="zahl">' + (w.vorhanden ? euro(w.gesamt) : '<span class="leise">–</span>') + "</td>" : "") +
            '<td><div class="liste__aktionen">' +
            '<button type="button" class="icon-btn" data-bearbeiten="' + esc(n.nummer) + '" aria-label="' + esc(a.name + " " + n.nummer) + ' bearbeiten" title="Bearbeiten">' + icon("pencil") + "</button>" +
            '<button type="button" class="icon-btn icon-btn--gefahr" data-loeschen="' + esc(n.nummer) + '" aria-label="' + esc(a.name + " " + n.nummer) + ' löschen" title="Löschen">' + icon("bin") + "</button>" +
            "</div></td></tr>";
        }).join("") + "</tbody></table></div>"
        : '<p class="leer-hinweis">Noch keine ' + esc(a.mehrzahl) + " angelegt.</p>") + "</div>";
    ziel.querySelectorAll("[data-bearbeiten]").forEach(function (k) { k.addEventListener("click", function () { nummerDialog(art, D.findeNummer(daten, art, k.getAttribute("data-bearbeiten"))); }); });
    ziel.querySelectorAll("[data-loeschen]").forEach(function (k) {
      k.addEventListener("click", function () {
        var nr = k.getAttribute("data-loeschen");
        bestaetige(a.name + " löschen", "Möchtest Du die " + a.name + " " + nr + " löschen? Alle Planbudgets dieser " + a.name + " in allen Kalenderjahren gehen dabei verloren" + (art === "pn" ? ", ebenso die erfassten Projektkosten." : ", ebenso ihre IST-Werte.") , a.name + " löschen")
          .then(function (ja) { if (ja) Dienst.nummerLoeschen(daten, ich, art, nr).then(nachAenderung("Die " + a.name + " " + nr + " ist gelöscht."), serverFehler); });
      });
    });
  }

  function uebergreifendText(daten, n) {
    var oben = D.uebergeordnete(daten, n.nummer);
    if ((n.unter || []).length) return '<span class="klein">' + esc(n.unter.join(", ")) + "</span>";
    if (oben) return '<span class="klein leise">Unterkostenstelle von ' + esc(oben) + "</span>";
    return '<span class="leise">–</span>';
  }

  /* Zuordnung einer Kostenstelle: zu welcher übergreifenden sie gehört oder welche Unterkostenstellen sie hat (nur eine Ebene) */
  function unterHtml(daten, eintrag) {
    var selbst = eintrag ? eintrag.nummer : "";
    var oben = selbst ? D.uebergeordnete(daten, selbst) : "";
    var moeglich = daten.kostenstellen.filter(function (n) { return n.nummer !== selbst && !D.uebergeordnete(daten, n.nummer); });
    var andere = daten.kostenstellen.filter(function (n) { return n.nummer !== selbst; });
    var feldOben = '<div class="feld"><label for="n-oben">Gehört zu</label><select id="n-oben" name="oben"><option value="">keiner übergreifenden Kostenstelle</option>' +
      moeglich.map(function (n) { return '<option value="' + esc(n.nummer) + '"' + (n.nummer === oben ? " selected" : "") + ">Kostenstelle " + esc(n.nummer) + "</option>"; }).join("") +
      '</select><p class="hilfe" data-oben-hilfe>Wähle die übergreifende Kostenstelle, wenn diese eine Unterkostenstelle ist.</p></div>';
    var liste = '<fieldset class="zuweisung" data-unter><legend>Unterkostenstellen</legend>' + (andere.length
      ? '<p class="hilfe" style="margin-top:0" data-unter-hilfe>Optional. Ihr Planbudget und ihr IST sind im Gesamtbudget und im KST-Bericht dieser Kostenstelle enthalten.</p>' +
        '<div class="zuweisung__liste">' + andere.map(function (n) {
          var gehoert = D.uebergeordnete(daten, n.nummer);
          var gesperrt = (n.unter || []).length ? "hat selbst Unterkostenstellen" : gehoert && gehoert !== selbst ? "Unterkostenstelle von " + gehoert : "";
          return '<label class="check"><input type="checkbox" name="unter" value="' + esc(n.nummer) + '"' + (gehoert && gehoert === selbst ? " checked" : "") + (gesperrt ? " disabled data-gesperrt" : "") + "> " +
            esc(n.nummer) + (gesperrt ? ' <span class="leise klein">' + esc(gesperrt) + "</span>" : "") + "</label>";
        }).join("") + "</div>"
      : '<p class="leise klein">Es gibt noch keine weiteren Kostenstellen.</p>') + "</fieldset>";
    return feldOben + liste;
  }

  /* Entweder Unterkostenstelle oder übergreifend: sperrt jeweils die andere Auswahl */
  function verbindeUnter(form) {
    var wahl = form.querySelector("[name=oben]");
    if (!wahl) return;
    var boxen = Array.prototype.slice.call(form.querySelectorAll("[name=unter]"));
    var hilfeOben = form.querySelector("[data-oben-hilfe]"), hilfeUnter = form.querySelector("[data-unter-hilfe]");
    function abgleichen() {
      var hatUnter = boxen.some(function (b) { return b.checked; });
      wahl.disabled = hatUnter;
      hilfeOben.textContent = hatUnter ? "Sie hat selbst Unterkostenstellen und gehört deshalb zu keiner anderen." : "Wähle die übergreifende Kostenstelle, wenn diese eine Unterkostenstelle ist.";
      boxen.forEach(function (b) { b.disabled = b.hasAttribute("data-gesperrt") || !!wahl.value; });
      if (hilfeUnter) hilfeUnter.textContent = wahl.value ? "Als Unterkostenstelle von " + wahl.value + " hat sie keine eigenen Unterkostenstellen."
        : "Optional. Ihr Planbudget und ihr IST sind im Gesamtbudget und im KST-Bericht dieser Kostenstelle enthalten.";
    }
    wahl.addEventListener("change", abgleichen);
    boxen.forEach(function (b) { b.addEventListener("change", abgleichen); });
    abgleichen();
  }

  /* Kostenstelle, von der die Kosten einer Projektnummer abgehen */
  function pnKsHtml(daten, eintrag) {
    var ks = daten.kostenstellen.slice().sort(function (a, b) { return ((b.unter || []).length ? 1 : 0) - ((a.unter || []).length ? 1 : 0) || (a.nummer < b.nummer ? -1 : 1); });
    return '<div class="feld"><label for="n-pnks">Gehört zu Kostenstelle</label><select id="n-pnks" name="pnks"><option value="">keiner Kostenstelle</option>' +
      ks.map(function (n) { return '<option value="' + esc(n.nummer) + '"' + (eintrag && eintrag.ks === n.nummer ? " selected" : "") + ">" + esc(n.nummer) + ((n.unter || []).length ? " (übergreifend)" : "") + "</option>"; }).join("") +
      '</select><p class="hilfe">Die Projektkosten sind im KST-Bericht dieser Kostenstelle schon enthalten. Das Tool weist sie einzeln aus und zieht sie beim Rest der Kostenstelle ab.</p></div>';
  }

  function nummerDialog(art, eintrag) {
    var daten = zustand.daten, ich = zustand.benutzer, a = D.ARTEN[art];
    var personen = daten.benutzer.filter(function (b) { return D.passtZurArt(b, art); })
      .sort(function (x, y) { return D.anzeigeName(x).localeCompare(D.anzeigeName(y), "de"); });
    var form = oeffneDialog(eintrag ? a.name + " " + eintrag.nummer + " bearbeiten" : "Neue " + a.name,
      '<div class="feld"><label for="n-nummer">' + esc(a.name) + '</label><input id="n-nummer" name="nummer" type="text" inputmode="numeric" maxlength="' + a.stellen + '" placeholder="' +
      (art === "ks" ? "123" : "12345678") + '" value="' + esc(eintrag ? eintrag.nummer : "") + '"><p class="hilfe">Genau ' + a.stellen + " Ziffern." +
      (eintrag ? " Änderst Du die Nummer, wandern die Planbudgets mit." : "") + "</p></div>" +
      '<fieldset class="zuweisung"><legend>Verantwortlich</legend>' +
      (personen.length ? '<div class="zuweisung__liste zuweisung__liste--breit">' + personen.map(function (b) {
        return '<label class="check"><input type="checkbox" name="person" value="' + esc(b.kennung) + '"' + (eintrag && eintrag.benutzer.indexOf(b.kennung) >= 0 ? " checked" : "") + "> " +
          esc(D.anzeigeName(b)) + ' <span class="leise klein">' + esc(b.kennung) + " · " + esc(D.rollenName(b.rolle)) + "</span></label>";
      }).join("") + "</div>" : '<p class="leise klein">Es gibt noch keine ' + (art === "ks" ? "Gruppenleitung oder Abteilungsleitung" : "Key Account Manager") + ". Lege sie unter Benutzer an.</p>") +
      '<p class="hilfe">Optional. Mehrere Personen sind möglich.</p></fieldset>' + (art === "ks" ? unterHtml(daten, eintrag) : pnKsHtml(daten, eintrag)) + '<p class="fehlertext" hidden></p>',
      '<button type="button" class="btn btn--rahmen" data-schliessen>Abbrechen</button><button type="submit" class="btn btn--primaer">' + (eintrag ? "Änderungen speichern" : a.name + " anlegen") + "</button>",
      function (f) {
        var nummer = f.nummer.value.trim();
        if (!D.istGueltigeNummer(art, nummer)) { zeigeFehler(f, "Eine " + a.name + " besteht aus genau " + a.stellen + " Ziffern."); f.nummer.focus(); return; }
        if ((!eintrag || eintrag.nummer !== nummer) && D.findeNummer(daten, art, nummer)) { zeigeFehler(f, "Die " + a.name + " " + nummer + " gibt es schon."); return; }
        var kennungen = Array.prototype.slice.call(f.querySelectorAll("[name=person]:checked")).map(function (c) { return c.value; });
        var unter = art === "ks" ? Array.prototype.slice.call(f.querySelectorAll("[name=unter]:checked:not(:disabled)")).map(function (c) { return c.value; }) : undefined;
        var oben = art === "ks" && f.oben && !f.oben.disabled ? f.oben.value : undefined;
        if (art === "pn" && f.pnks) unter = f.pnks.value;
        Dienst.nummerSpeichern(daten, ich, art, eintrag ? eintrag.nummer : "", nummer, kennungen, unter, oben)
          .then(nachAenderung("Die " + a.name + " " + nummer + " ist gespeichert."), function (x) { serverFehler(x, f); });
      });
    if (art === "ks") verbindeUnter(form);
  }

  /* ---------- Projektkosten je Projektnummer ---------- */

  function darfProjekt(b, nummer) {
    return b.rolle !== "admin" && !!D.findeNummer(zustand.daten, "pn", nummer);
  }

  function datumText(t) { var s = String(t || "").split("-"); return s.length === 3 ? s[2] + "." + s[1] + "." + s[0] : ""; }


  function zeigeProjekt(nummer) {
    var daten = zustand.daten, jahr = zustand.jahr, ich = zustand.benutzer, darf = D.Rechte.kosten(ich, daten, nummer);
    var n = D.findeNummer(daten, "pn", nummer);
    var plan = D.budgetVon(daten, jahr, "pn", nummer), ist = D.projektIstVon(daten, jahr, nummer);
    var k = D.kennzahlen(plan, ist);
    var liste = D.kostenVon(daten, jahr, nummer);
    var html = zurueckHtml("#/start") + '<div class="seite__kopf"><div><p class="topline">Projektkosten</p><h1>Projektnummer ' + esc(nummer) + " · " + jahr + "</h1></div>" + jahrwahlHtml() + "</div>" +
      '<p class="einleitung">' + (n.ks ? "Gehört zur Kostenstelle <strong>" + esc(n.ks) + "</strong>. Die Kosten stecken schon in deren KST-Bericht, hier stehen sie einzeln."
        : "Diese Projektnummer ist noch keiner Kostenstelle zugeordnet. Das legst Du unter Verwaltung → Projektnummern fest.") + "</p>" +
      '<div class="kennzahlen">' +
      kennzahl("Planbudget " + jahr, plan.vorhanden ? euro(plan.gesamt) : "–", plan.vorhanden ? "" : "noch nicht eingetragen") +
      kennzahl("IST " + jahr, euro(ist.gesamt), ist.vorhanden ? esc(D.standText(ist.stand)) + " · " + ist.anzahl + (ist.anzahl === 1 ? " Eintrag" : " Einträge") : "noch keine Kosten erfasst") +
      kennzahl("IST in % vom Plan", prozent(k.quote), "Restbudget " + euro(k.rest)) +
      kennzahl("Veränderung zum Vorjahr", "–", "im Vorjahr keine Kosten erfasst") + "</div>" +
      '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>Erfasste Kosten ' + jahr + "</h2>" +
      (darf ? '<button type="button" class="btn btn--primaer" data-kosten-neu>' + icon("plus") + " Kosten erfassen</button>" : "") + "</div>" +
      (liste.length ? '<div class="tabelle-huelle"><table class="budgettabelle"><thead><tr><th>Datum</th><th class="zahl">Betrag</th><th>Beschreibung</th><th>Erfasst</th>' +
        (darf ? '<th><span class="sr">Aktionen</span></th>' : "") + "</tr></thead><tbody>" +
        liste.map(function (x) {
          return '<tr data-kosten="' + esc(x.id) + '"><td>' + esc(datumText(x.datum)) + '</td><td class="zahl">' + euro(x.betrag) + "</td>" +
            '<td class="klein">' + (x.text ? esc(x.text) : '<span class="leise">–</span>') + '</td><td class="klein">' + esc(nameVon(x.geaendertVon || x.von)) + "<br>" + esc(datumZeit(x.geaendert || x.erfasst)) + "</td>" +
            (darf ? '<td><div class="liste__aktionen"><button type="button" class="icon-btn" data-kosten-bearbeiten="' + esc(x.id) + '" aria-label="Eintrag bearbeiten" title="Bearbeiten">' + icon("pencil") + "</button>" +
              '<button type="button" class="icon-btn icon-btn--gefahr" data-kosten-loeschen="' + esc(x.id) + '" aria-label="Eintrag löschen" title="Löschen">' + icon("bin") + "</button></div></td>" : "") + "</tr>";
        }).join("") + "</tbody></table></div>"
        : '<p class="leer-hinweis">Für ' + jahr + " sind noch keine Kosten erfasst." + (darf ? " Mit „Kosten erfassen“ trägst Du die erste Ausgabe ein." : "") + "</p>") + "</section>";
    seite("projekt", "Projekt " + nummer, html, true);
    var vj = D.projektIstVon(daten, jahr - 1, nummer, ist.bisMonat || 12);
    if (vj.vorhanden && ist.vorhanden) {
      var kz = app.querySelectorAll(".kennzahl")[3];
      kz.querySelector(".kennzahl__wert").textContent = D.prozentText(vj.gesamt ? (ist.gesamt - vj.gesamt) / vj.gesamt : null, true);
      kz.querySelector(".kennzahl__unter").textContent = "Vorjahr bis " + D.MONATE[(ist.bisMonat || 12) - 1] + ": " + D.betragText(vj.gesamt);
    }
    verbindeJahrwahl();
    var neu = app.querySelector("[data-kosten-neu]");
    if (neu) neu.addEventListener("click", function () { kostenDialog(nummer, null); });
    app.querySelectorAll("[data-kosten-bearbeiten]").forEach(function (b) {
      b.addEventListener("click", function () { kostenDialog(nummer, liste.filter(function (x) { return x.id === b.getAttribute("data-kosten-bearbeiten"); })[0]); });
    });
    app.querySelectorAll("[data-kosten-loeschen]").forEach(function (b) {
      b.addEventListener("click", function () {
        var x = liste.filter(function (y) { return y.id === b.getAttribute("data-kosten-loeschen"); })[0];
        bestaetige("Eintrag löschen", "Möchtest Du den Eintrag vom " + datumText(x.datum) + " über " + D.betragText(x.betrag) + (x.text ? " („" + x.text + "“)" : "") + " löschen?", "Eintrag löschen")
          .then(function (ja) { if (ja) Dienst.kostenLoeschen(daten, ich, x.id).then(nachAenderung("Der Eintrag ist gelöscht."), serverFehler); });
      });
    });
  }

  function kostenDialog(nummer, x) {
    var daten = zustand.daten, ich = zustand.benutzer;
    var heute = new Date(), vorschlag = zustand.jahr === heute.getFullYear()
      ? heute.getFullYear() + "-" + ("0" + (heute.getMonth() + 1)).slice(-2) + "-" + ("0" + heute.getDate()).slice(-2) : zustand.jahr + "-12-31";
    oeffneDialog(x ? "Eintrag bearbeiten" : "Kosten erfassen · Projektnummer " + nummer,
      '<div class="feldreihe"><div class="feld"><label for="k-datum">Datum</label><input id="k-datum" name="datum" type="date" value="' + esc(x ? x.datum : vorschlag) + '"></div>' +
      '<div class="feld"><label for="k-betrag">Betrag</label><div class="betrag"><input id="k-betrag" name="betrag" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' +
      esc(x ? betragFeld(x.betrag) : "") + '"><span>EUR</span></div></div></div>' +
      '<div class="feld"><label for="k-text">Beschreibung</label><input id="k-text" name="text" type="text" maxlength="120" value="' + esc(x ? x.text : "") + '"></div>' +
      '<p class="fehlertext" hidden></p>',
      '<button type="button" class="btn btn--rahmen" data-schliessen>Abbrechen</button><button type="submit" class="btn btn--primaer">' + (x ? "Änderungen speichern" : "Kosten speichern") + "</button>",
      function (f) {
        var felder = { pn: nummer, datum: f.datum.value, betrag: f.betrag.value, text: f.text.value };
        if (!D.istDatum(felder.datum)) { zeigeFehler(f, "Gib bitte ein gültiges Datum ein."); return; }
        var b = D.leseBetrag(felder.betrag);
        if (b === null || b === 0) { zeigeFehler(f, "Gib bitte einen Betrag größer als 0,00 EUR ein, zum Beispiel 1.250,00 EUR."); return; }
        var text = x ? "Der Eintrag ist gespeichert." : "Die Kosten sind erfasst.";
        /* Datum in einem anderen Jahr: Der Eintrag verschwindet aus der Liste, deshalb Hinweis */
        if (felder.datum.slice(0, 4) !== String(zustand.jahr)) text += (x ? " Er zählt" : " Sie zählen") + " zum Jahr " + felder.datum.slice(0, 4) + ". Wähle oben dieses Kalenderjahr, um " + (x ? "ihn" : "sie") + " zu sehen.";
        Dienst.kostenSpeichern(daten, ich, x ? x.id : "", felder).then(nachAenderung(text), function (e) { serverFehler(e, f); });
      });
  }

  /* ---------- IST-Werte: Import je Kostenstelle und Sicherungen ---------- */

  function datumZeit(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("de-DE") + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
  }

  function nameVon(kennung) { var b = D.findeBenutzer(zustand.daten, kennung); return b ? D.anzeigeName(b) : kennung || "–"; }

  function verwaltungIst(ziel) {
    var daten = zustand.daten, ich = zustand.benutzer, darfImport = D.Rechte.ist(ich);
    var ks = daten.kostenstellen;
    var staende = ks.filter(function (n) { return daten.ist && daten.ist["ks-" + n.nummer]; });
    var html = "";
    if (darfImport) {
      html += '<form class="karte" data-import novalidate><h2>KST-Bericht importieren</h2>' +
        "<p>Wähle die Kostenstelle und ihren KST-Bericht (.xlsx). Das Tool ersetzt damit die bisherigen IST-Werte und sichert sie vorher.</p>" +
        (ks.length
          ? '<div class="import-felder"><div class="feld"><label for="i-ks">Kostenstelle</label><select id="i-ks" name="ks"><option value="">Bitte wählen</option>' +
            ks.map(function (n) { return '<option value="' + esc(n.nummer) + '">' + esc(n.nummer) + "</option>"; }).join("") + "</select></div>" +
            '<div class="feld"><label for="i-datei">KST-Bericht</label><input id="i-datei" name="datei" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div></div>' +
            '<div data-vorschau></div><p class="fehlertext" hidden></p>' +
            '<button type="submit" class="btn btn--primaer" data-importieren disabled>' + icon("documentXls") + " IST-Werte importieren</button>"
          : '<p class="leer-hinweis">Lege zuerst Kostenstellen an.</p>') + "</form>";
      html += '<section class="karte"><h2>Aktuelle IST-Stände</h2>' + (staende.length
        ? '<div class="tabelle-huelle"><table><thead><tr><th>Kostenstelle</th><th>Stand</th><th>Gebucht bis</th><th>Importiert</th><th>Datei</th></tr></thead><tbody>' +
          staende.map(function (n) {
            var e = daten.ist["ks-" + n.nummer];
            return '<tr><th scope="row"><strong>' + esc(n.nummer) + "</strong></th><td>" + esc(D.standText(e.stand).replace("Stand ", "")) + "</td><td>" + esc(D.monatName(e.monat) + " " + e.monat.slice(0, 4)) +
              '</td><td class="klein">' + esc(datumZeit(e.importiert)) + "<br>" + esc(nameVon(e.von)) + '</td><td class="klein">' + esc(e.datei || "–") + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : '<p class="leer-hinweis">Noch keine IST-Werte importiert.</p>') + "</section>";
    }
    var sich = daten.istSicherungen || [];
    html += '<section class="karte"><h2>Sicherungen</h2><p class="leise klein">Vor jedem Import sichert das Tool den bisherigen Stand. Mit „Wiederherstellen“ holst Du ihn zurück.</p>' + (sich.length
      ? '<div class="tabelle-huelle"><table><thead><tr><th>Zeitpunkt</th><th>Kostenstelle</th><th>Anlass</th><th>Gesicherter Stand</th><th><span class="sr">Aktion</span></th></tr></thead><tbody>' +
        sich.map(function (x) {
          return '<tr><td class="klein">' + esc(datumZeit(x.zeit)) + "<br>" + esc(nameVon(x.von)) + "</td><td><strong>" + esc(x.nummer) + "</strong></td><td>" + esc(x.anlass || "Import") + "</td><td>" +
            (x.vorherStand ? esc(D.standText(x.vorherStand, x.vorherMonat)) : '<span class="leise">keine IST-Werte</span>') + "</td>" +
            '<td><button type="button" class="btn btn--rahmen btn--klein" data-wiederherstellen="' + esc(x.id) + '">' + icon("reload") + " Wiederherstellen</button></td></tr>";
        }).join("") + "</tbody></table></div>"
      : '<p class="leer-hinweis">Noch keine Sicherungen vorhanden.</p>') + "</section>";
    ziel.innerHTML = '<div class="stapel">' + html + "</div>";

    ziel.querySelectorAll("[data-wiederherstellen]").forEach(function (k) {
      k.addEventListener("click", function () {
        var x = sich.filter(function (s) { return s.id === k.getAttribute("data-wiederherstellen"); })[0];
        bestaetige("Sicherung wiederherstellen", "Möchtest Du für die Kostenstelle " + x.nummer + " den Stand vom " + datumZeit(x.zeit) + " wiederherstellen? " +
          (x.vorherStand ? "Danach gilt wieder der " + D.standText(x.vorherStand, x.vorherMonat) + "." : "Danach hat die Kostenstelle keine IST-Werte mehr.") + " Der aktuelle Stand wird vorher gesichert.", "Wiederherstellen")
          .then(function (ja) { if (ja) Dienst.istWiederherstellen(daten, ich, x.id).then(nachAenderung("Der Stand der Kostenstelle " + x.nummer + " ist wiederhergestellt."), serverFehler); });
      });
    });

    var form = ziel.querySelector("[data-import]");
    if (!form || !form.ks) return;
    var gelesen = null, dateiName = "";
    var vorschau = form.querySelector("[data-vorschau]"), knopf = form.querySelector("[data-importieren]");
    function pruefen() {
      knopf.disabled = true;
      zeigeFehler(form, "");
      if (!gelesen) return;
      if (gelesen.fehler) { zeigeFehler(form, gelesen.fehler); return; }
      if (!D.findeNummer(daten, "ks", gelesen.kst)) { zeigeFehler(form, "Die Datei gehört zur Kostenstelle " + gelesen.kst + ". Diese Kostenstelle gibt es im Tool noch nicht. Lege sie bitte zuerst an."); return; }
      if (!form.ks.value) form.ks.value = gelesen.kst;
      if (form.ks.value !== gelesen.kst) { zeigeFehler(form, "Die Datei gehört zur Kostenstelle " + gelesen.kst + ", gewählt ist " + form.ks.value + ". Prüfe bitte Deine Auswahl oder die Datei."); return; }
      knopf.disabled = false;
    }
    function vorschauHtml(e) {
      var sp = [{ name: "IST " + e.aktuell.jahr + " bis " + D.monatName(e.monat), t: e.aktuell }];
      if (e.vorjahrZeitraum) sp.push({ name: "IST " + e.vorjahrZeitraum.jahr + " bis " + D.monatName(e.monat), t: e.vorjahrZeitraum });
      if (e.vorjahr) sp.push({ name: "IST " + e.vorjahr.jahr + " gesamt", t: e.vorjahr });
      var mit = sp.map(function (s) { return D.istVon({ ist: { "ks-x": { stand: e.stand, monat: e.monat, aktuell: s.t } } }, s.t.jahr, "x"); });
      var zeilen = [["Personalkosten ID", "pkId"], ["Personalkosten AD", "pkAd"], ["Werbung", "werbung"], ["Reise/KfZ", "reise"], ["Sonstiges", "sonstiges"], ["Sachkosten", "sachkosten"], ["Gesamt (Primärkosten I)", "gesamt"]];
      return '<div class="vorschau"><p><strong>Kostenstelle ' + esc(e.kst) + "</strong> · " + esc(D.standText(e.stand, e.monat)) + "</p>" +
        '<div class="tabelle-huelle"><table class="budgettabelle"><thead><tr><th>Position</th>' + sp.map(function (s) { return '<th class="zahl">' + esc(s.name) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        zeilen.map(function (z) {
          return "<tr" + (z[1] === "gesamt" || z[1] === "sachkosten" ? ' class="teilsumme"' : "") + '><th scope="row">' + esc(z[0]) + "</th>" + mit.map(function (w) { return '<td class="zahl">' + euro(w[z[1]]) + "</td>"; }).join("") + "</tr>";
        }).join("") + "</tbody></table></div>" +
        (e.warnungen.length ? '<ul class="warnungen">' + e.warnungen.map(function (w) { return "<li>" + icon("warning") + "<span>" + esc(w) + "</span></li>"; }).join("") + "</ul>"
          : '<p class="ok-hinweis">' + icon("checkmarkCircle") + "<span>Die Summen stimmen mit der Datei überein (Sachkosten und Primärkosten I).</span></p>") + "</div>";
    }
    form.ks.addEventListener("change", pruefen);
    form.datei.addEventListener("change", function () {
      var datei = form.datei.files && form.datei.files[0];
      gelesen = null; vorschau.innerHTML = ""; pruefen();
      if (!datei) return;
      dateiName = datei.name;
      datei.arrayBuffer().then(function (b) { return window.BDExcel.arbeitsmappeLesen(b); }).then(function (blaetter) {
        var erstes = null;
        for (var i = 0; i < blaetter.length; i++) {
          var e = D.istAuslesen(blaetter[i].zeilen);
          if (!e.fehler) { gelesen = e; break; }
          if (!erstes) erstes = e;
        }
        gelesen = gelesen || erstes || { fehler: "Die Datei enthält kein Arbeitsblatt." };
        if (!gelesen.fehler) vorschau.innerHTML = vorschauHtml(gelesen);
        pruefen();
      }).catch(function (x) { gelesen = { fehler: x && x.message ? x.message : "Die Datei lässt sich nicht lesen." }; pruefen(); });
    });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (knopf.disabled || !gelesen || gelesen.fehler) return;
      var e = gelesen, nr = form.ks.value;
      bestaetige("IST-Werte importieren", "Die IST-Werte der Kostenstelle " + nr + " werden durch den " + D.standText(e.stand, e.monat) + " ersetzt. Der bisherige Stand wird vorher gesichert.", "Importieren")
        .then(function (ja) {
          if (!ja) return;
          Dienst.istImportieren(daten, ich, nr, { stand: e.stand, monat: e.monat, aktuell: e.aktuell, vorjahrZeitraum: e.vorjahrZeitraum, vorjahr: e.vorjahr, datei: dateiName })
            .then(nachAenderung("Die IST-Werte der Kostenstelle " + nr + " sind importiert."), function (x) { serverFehler(x, form); });
        });
    });
  }

  function verwaltungEinstellungen(ziel) {
    if (D.Rechte.budgets(zustand.benutzer)) { einstellungenAmpel(ziel); return; }
    var daten = zustand.daten, ich = zustand.benutzer;
    ziel.innerHTML = '<div class="raster">' +
      '<div><form class="karte" novalidate data-titel><h2>Titel der Anwendung</h2>' +
      '<div class="feld"><label for="e-titel">Titel</label><input id="e-titel" name="titel" type="text" maxlength="60" value="' + esc(daten.einstellungen.titel) + '">' +
      '<p class="hilfe">Steht in der Kopfzeile, auf der Anmeldeseite und im Tab des Browsers.</p></div>' +
      '<p class="fehlertext" hidden></p><button type="submit" class="btn btn--primaer">Titel speichern</button></form>' +
      (Dienst.modus === "browser" ? '<div class="karte"><h2>Beispieldaten</h2><p>Setze das Tool auf die Beispieldaten zurück. Alle Änderungen in diesem Browser gehen dabei verloren.</p>' +
        '<button type="button" class="btn btn--gefahr" data-zuruecksetzen>Auf Beispieldaten zurücksetzen</button></div>' : "") + "</div>" +
      '<div class="karte" data-sicherung><h2>Datensicherung</h2>' +
      "<p>Lade den vollständigen Datenstand als Datei herunter: alle Konten, Nummern, Planbudgets, IST-Werte, Projektkosten und Einstellungen. Bewahre die Datei sicher auf, sie enthält auch die Passwort-Hashes.</p>" +
      '<div class="knopfreihe"><button type="button" class="btn btn--primaer" data-sicherung-holen>' + icon("floppyDisk") + " Sicherung herunterladen</button></div>" +
      '<h3 class="untertitel">Sicherung einspielen</h3>' +
      "<p>Ersetzt alle Daten durch den Stand aus einer Sicherungsdatei. " + (Dienst.modus === "server" ? "Vorher sichert der Server den aktuellen Stand automatisch." : "Lade vorher am besten eine Sicherung des aktuellen Stands herunter.") + "</p>" +
      '<div class="feld"><label for="e-sicherung">Sicherungsdatei (.json)</label><input id="e-sicherung" type="file" accept=".json,application/json" data-sicherung-datei></div>' +
      '<p class="fehlertext" hidden></p>' +
      (Dienst.modus === "server" ? '<h3 class="untertitel">Automatische Sicherungen</h3><p class="leise klein">Der Server sichert vor jeder Änderung den alten Stand. Hier siehst Du die neuesten.</p><div data-auto-sicherungen><p class="leise klein">Lädt …</p></div>' : "") +
      "</div></div>";
    var tf = ziel.querySelector("[data-titel]");
    tf.addEventListener("submit", function (e) {
      e.preventDefault();
      var t = tf.titel.value.trim();
      if (!t) { zeigeFehler(tf, "Gib dem Tool bitte einen Titel."); return; }
      Dienst.einstellungenSpeichern(daten, ich, { titel: t }).then(nachAenderung("Der Titel ist gespeichert."), function (x) { serverFehler(x, tf); });
    });
    var reset = ziel.querySelector("[data-zuruecksetzen]");
    if (reset) reset.addEventListener("click", function () {
      bestaetige("Beispieldaten laden", "Möchtest Du alle Daten in diesem Browser durch die Beispieldaten ersetzen? Du wirst danach abgemeldet.", "Jetzt zurücksetzen").then(function (ja) {
        if (!ja) return;
        Dienst.zuruecksetzen().then(function (d) {
          zustand.daten = d;
          zustand.benutzer = null;
          history.replaceState(null, "", location.pathname + location.search);
          meldung("Die Beispieldaten sind geladen.");
          zeige();
        });
      });
    });
    verbindeSicherung(ziel.querySelector("[data-sicherung]"));
  }

  function verbindeSicherung(karte) {
    karte.querySelector("[data-sicherung-holen]").addEventListener("click", function () {
      Dienst.sicherungHolen().then(function (s) {
        var blob = new Blob([JSON.stringify(s, null, 1)], { type: "application/json" });
        return dateiSpeichern("Budgetdashboard_Sicherung_" + heuteIso() + ".json", blob, "Die Sicherung ließ sich gerade nicht speichern. Probiere es bitte noch einmal.");
      }, serverFehler);
    });
    function einspielen(text, quelle) {
      bestaetige("Sicherung einspielen", text, "Jetzt einspielen").then(function (ja) {
        if (!ja) return;
        Dienst.sicherungEinspielen(zustand.daten, zustand.benutzer, quelle).then(nachAenderung("Die Sicherung ist eingespielt."), function (x) { serverFehler(x, karte); });
      });
    }
    var datei = karte.querySelector("[data-sicherung-datei]");
    datei.addEventListener("change", function () {
      var f = datei.files && datei.files[0];
      if (!f) return;
      zeigeFehler(karte, "");
      f.text().then(function (t) {
        var obj;
        try { obj = JSON.parse(t); } catch (x) { obj = null; }
        datei.value = "";
        var r = obj ? D.pruefeSicherung(obj, zustand.benutzer.kennung) : { fehler: "Diese Datei ist keine Sicherung des Budgetdashboards." };
        if (r.fehler) { zeigeFehler(karte, r.fehler); return; }
        var erstellt = obj.erstellt ? " vom " + datumZeit(obj.erstellt) : "";
        einspielen("Möchtest Du alle Daten durch die Sicherung „" + f.name + "“" + erstellt + " ersetzen? Änderungen seit dieser Sicherung gehen verloren.", { daten: obj.art ? obj.daten : obj });
      });
    });
    var liste = karte.querySelector("[data-auto-sicherungen]");
    if (!liste) return;
    Dienst.sicherungenListe().then(function (l) {
      if (!l.length) { liste.innerHTML = '<p class="leise klein">Noch keine automatischen Sicherungen.</p>'; return; }
      liste.innerHTML = '<ul class="sicherungsliste">' + l.slice(0, 10).map(function (x) {
        return "<li><span>" + esc(datumZeit(x.zeit)) + ' <span class="leise klein">(' + esc(Math.max(1, Math.round(x.groesse / 1024)).toLocaleString("de-DE")) + " KB)</span></span>" +
          '<button type="button" class="btn btn--rahmen btn--klein" data-wiederherstellen="' + esc(x.name) + '">Wiederherstellen</button></li>';
      }).join("") + "</ul>";
      liste.querySelectorAll("[data-wiederherstellen]").forEach(function (k) {
        k.addEventListener("click", function () {
          var x = l.filter(function (y) { return y.name === k.getAttribute("data-wiederherstellen"); })[0];
          einspielen("Möchtest Du alle Daten auf den Stand vom " + datumZeit(x.zeit) + " zurücksetzen? Änderungen seit diesem Zeitpunkt gehen verloren.", { name: x.name });
        });
      });
    }, function (f) { liste.innerHTML = '<p class="leise klein">' + esc(f.message) + "</p>"; });
  }

  /* Ampelgrenzen: nur die Abteilungsleitung */
  function einstellungenAmpel(ziel) {
    var g = D.ampelGrenzen(), std = D.AMPEL_STANDARD;
    ziel.innerHTML = '<div class="raster"><form class="karte" novalidate data-ampel><h2>Ampel</h2>' +
      "<p>Die Ampel vergleicht die Hochrechnung zum Jahresende mit dem Planbudget. Lege fest, ab wann sie gelb und rot zeigt. Die Grenzen gelten für alle im Tool.</p>" +
      '<div class="zweispaltig"><div class="feld"><label for="a-gruen">Im Plan bis (%)</label><input id="a-gruen" name="gruen" type="number" min="50" max="150" step="1" inputmode="numeric" value="' + g.imPlanBis + '">' +
      '<p class="hilfe">Bis hierhin zeigt die Ampel grün. Standard: ' + std.imPlanBis + " %.</p></div>" +
      '<div class="feld"><label for="a-rot">Knapp bis (%)</label><input id="a-rot" name="rot" type="number" min="51" max="200" step="1" inputmode="numeric" value="' + g.knappBis + '">' +
      '<p class="hilfe">Bis hierhin gelb, darüber rot. Standard: ' + std.knappBis + " %.</p></div></div>" +
      '<p class="hinweis-box klein" data-ampel-vorschau></p><p class="fehlertext" hidden></p>' +
      '<div class="knopfreihe"><button type="submit" class="btn btn--primaer">Ampel speichern</button>' +
      '<button type="button" class="btn btn--rahmen" data-ampel-standard>Auf Standard zurücksetzen</button></div></form></div>';
    var f = ziel.querySelector("[data-ampel]");
    function werte() { return [Number(String(f.gruen.value).replace(",", ".")), Number(String(f.rot.value).replace(",", "."))]; }
    function vorschau() {
      var w = werte(), text = f.gruen.value === "" || f.rot.value === "" ? "Gib bitte beide Grenzen ein." : D.pruefeAmpel(w[0], w[1]);
      f.querySelector("[data-ampel-vorschau]").textContent = text || "Grün: Hochrechnung bis " + w[0] + " % vom Plan · Gelb: bis " + w[1] + " % · Rot: darüber.";
    }
    f.gruen.addEventListener("input", vorschau);
    f.rot.addEventListener("input", vorschau);
    vorschau();
    function speichern(a, b, text) {
      Dienst.ampelSpeichern(zustand.daten, zustand.benutzer, a, b).then(nachAenderung(text), function (x) { serverFehler(x, f); });
    }
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var w = werte(), fehler = f.gruen.value === "" || f.rot.value === "" ? "Gib bitte beide Grenzen ein." : D.pruefeAmpel(w[0], w[1]);
      if (fehler) { zeigeFehler(f, fehler); return; }
      speichern(w[0], w[1], "Die Ampel ist gespeichert.");
    });
    f.querySelector("[data-ampel-standard]").addEventListener("click", function () { speichern(std.imPlanBis, std.knappBis, "Die Ampel nutzt wieder die Standardgrenzen."); });
  }

  /* ---------- Profil ---------- */

  function zeigeProfil() {
    var b = zustand.benutzer, daten = zustand.daten;
    var g = window.BDFarben.gewaehlt();
    var ks = D.nummernVon(daten, b.kennung, "ks"), pn = D.nummernVon(daten, b.kennung, "pn");
    seite("profil", "Mein Profil",
      '<div class="seite__kopf"><div><p class="topline">Mein Profil</p><h1>' + esc(D.anzeigeName(b)) + "</h1></div></div>" +
      '<div class="raster">' +
      '<div><form class="karte" novalidate data-angaben><h2>Deine Angaben</h2>' +
      '<p>XV-Nummer: <strong>' + esc(b.kennung) + '</strong><br>Rolle: ' + esc(D.rollenName(b.rolle)) +
      (ks.length ? "<br>Kostenstellen: " + esc(ks.join(", ")) : "") + (pn.length ? "<br>Projektnummern: " + esc(pn.join(", ")) : "") + "</p>" +
      '<div class="zweispaltig"><div class="feld"><label for="p-vor">Vorname</label><input id="p-vor" name="vorname" type="text" maxlength="40" autocomplete="given-name" value="' + esc(b.vorname) + '"></div>' +
      '<div class="feld"><label for="p-nach">Nachname</label><input id="p-nach" name="nachname" type="text" maxlength="40" autocomplete="family-name" value="' + esc(b.nachname) + '"></div></div>' +
      '<p class="hilfe" style="margin-top:-.5rem">Deine XV-Nummer, Rolle und Zuweisungen ändert die Abteilungsleitung oder ein Administrator.</p>' +
      '<p class="fehlertext" hidden></p><button type="submit" class="btn btn--primaer">Angaben speichern</button></form>' +
      '<form class="karte" novalidate data-pw><h2>Passwort ändern</h2>' +
      '<div class="feld"><label for="p-alt">Aktuelles Passwort</label><input id="p-alt" name="alt" type="password" autocomplete="current-password"></div>' +
      '<div class="feld"><label for="p-neu">Neues Passwort</label><input id="p-neu" name="neu" type="password" autocomplete="new-password"><ul class="regeln" data-regeln>' + regelnHtml("", b) + "</ul></div>" +
      '<div class="feld"><label for="p-wdh">Neues Passwort wiederholen</label><input id="p-wdh" name="wdh" type="password" autocomplete="new-password"></div>' +
      '<p class="fehlertext" hidden></p><button type="submit" class="btn btn--primaer">Passwort ändern</button></form></div>' +
      '<div class="karte"><h2>Design</h2><fieldset class="modus"><legend>Hell oder dunkel</legend>' +
      [["auto", "Automatisch", "folgt Deinem Betriebssystem"], ["hell", "Hell", ""], ["dunkel", "Dunkel", ""]].map(function (m) {
        return '<label class="modus__option"><input type="radio" name="modus" value="' + m[0] + '"' + (g.modus === m[0] ? " checked" : "") + "><span>" + esc(m[1]) + "</span>" +
          (m[2] ? '<span class="leise klein">' + esc(m[2]) + "</span>" : "") + "</label>";
      }).join("") + "</fieldset>" +
      '<h3 class="untertitel">Farbdesign</h3><p class="leise klein">Zehn Farbwelten aus dem R+V-Design. Jede gibt es hell und dunkel.</p>' + farbwahlHtml() + "</div>" +
      "</div>");

    app.querySelectorAll("[name=modus]").forEach(function (r) {
      r.addEventListener("change", function () {
        setzeDesign(r.value, window.BDFarben.gewaehlt().farbe, true);
        zeige();
        meldung(r.value === "auto" ? "Das Design folgt jetzt Deinem Betriebssystem." : r.value === "hell" ? "Du nutzt jetzt das helle Design." : "Du nutzt jetzt das dunkle Design.");
      });
    });
    app.querySelectorAll("[name=farbe]").forEach(function (r) {
      r.addEventListener("change", function () {
        setzeDesign(window.BDFarben.gewaehlt().modus, r.value, true);
        meldung("Dein Farbdesign „" + window.BDFarben.finde(r.value).name + "“ ist gespeichert.");
      });
    });

    var af = app.querySelector("[data-angaben]");
    af.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!af.vorname.value.trim() || !af.nachname.value.trim()) { zeigeFehler(af, "Gib bitte Deinen Vor- und Nachnamen ein."); return; }
      Dienst.profilSpeichern(daten, b, { vorname: af.vorname.value, nachname: af.nachname.value }).then(nachAenderung("Deine Angaben sind gespeichert."), function (x) { serverFehler(x, af); });
    });

    var pf = app.querySelector("[data-pw]");
    pf.neu.addEventListener("input", function () { pf.querySelector("[data-regeln]").innerHTML = regelnHtml(pf.neu.value, b); });
    pf.addEventListener("submit", function (e) {
      e.preventDefault();
      var neu = pf.neu.value;
      if (!pf.alt.value) { zeigeFehler(pf, "Gib bitte Dein aktuelles Passwort ein."); pf.alt.focus(); return; }
      var maengel = D.passwortMaengel(neu, b);
      if (maengel.length) { zeigeFehler(pf, "Dein neues Passwort braucht noch " + maengel.join(", ") + "."); pf.neu.focus(); return; }
      if (neu !== pf.wdh.value) { zeigeFehler(pf, "Die beiden neuen Passwörter sind verschieden."); pf.wdh.focus(); return; }
      if (neu === pf.alt.value) { zeigeFehler(pf, "Wähle bitte ein anderes Passwort als Dein bisheriges."); return; }
      Dienst.passwortSetzen(daten, b, pf.alt.value, neu).then(function (text) {
        if (text) { zeigeFehler(pf, text); return; }
        zeigeFehler(pf, "");
        meldung("Dein neues Passwort ist gespeichert.");
        pf.reset();
        pf.querySelector("[data-regeln]").innerHTML = regelnHtml("", b);
      }, serverFehler);
    });
  }

  /* ---------- Handbuch (Inhalt in js/handbuch.js, PDF aus tools/handbuch_pdf.js) ---------- */

  var HANDBUCH_PDF = "handbuch/Handbuch.pdf";

  function zeigeHandbuch() {
    var kapitel = (window.BDHandbuch && window.BDHandbuch.kapitel) || [];
    var heute = new Date().toLocaleDateString("de-DE");
    var kopf = '<div class="seite__kopf"><div><p class="topline">Hilfe</p><h1>Handbuch</h1></div>' +
      '<div class="kopfaktionen"><button type="button" class="btn btn--primaer" data-handbuch-pdf>' + icon("documentPdf") + " Handbuch als PDF herunterladen</button></div></div>";
    var deckblatt = '<div class="hb-deckblatt" aria-hidden="true"><img src="img/logo-positiv.svg" alt=""><p class="topline">Training und Entwicklung Vertrieb</p>' +
      "<h1>Budgetdashboard</h1><p class=\"hb-deckblatt__unter\">Handbuch für alle Funktionen</p><p class=\"leise\">Version " + VERSION + " · Stand " + esc(heute) + "</p></div>";
    var inhalt = '<nav class="hb-inhalt karte" aria-label="Inhalt des Handbuchs"><h2>Inhalt</h2><ol>' + kapitel.map(function (k) {
      return '<li><a href="#hb-' + k.id + '" data-hb-sprung="' + k.id + '">' + esc(k.titel) + "</a></li>";
    }).join("") + "</ol></nav>";
    var text = '<div class="hb-text">' + kapitel.map(function (k, i) {
      return '<section class="hb-kapitel karte" id="hb-' + k.id + '"><p class="hb-fuer">' + (i + 1) + " · Für " + esc(k.fuer) + "</p><h2>" + esc(k.titel) + "</h2>" + k.html + "</section>";
    }).join("") + "</div>";
    seite("handbuch", "Handbuch", kopf + '<div class="hb">' + deckblatt + inhalt + text + "</div>");
    app.querySelectorAll("[data-hb-sprung]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var ziel = document.getElementById("hb-" + a.getAttribute("data-hb-sprung"));
        if (ziel) ziel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    app.querySelector("[data-handbuch-pdf]").addEventListener("click", handbuchHerunterladen);
  }

  /* Im Claude-Artefakt speichert die Plattform die Datei (mit Rückfrage), sonst ein normaler Download-Link */
  function handbuchHerunterladen() {
    var name = "Budgetdashboard_Handbuch_" + VERSION + ".pdf";
    if (window.claude && typeof window.claude.use === "function") {
      return window.claude.use("downloads").then(function (dl) {
        if (!dl) { meldung("Hier kann das Tool keine Dateien speichern.", true); return; }
        return fetch(HANDBUCH_PDF).then(function (r) {
          if (!r.ok) throw new Error("fehlt");
          return r.blob();
        }).then(function (blob) { return dl.save({ filename: name, data: blob }); }).catch(function (f) {
          if (!f || f.code !== "declined") meldung("Das Handbuch ließ sich gerade nicht speichern. Probiere es bitte noch einmal.", true);
        });
      });
    }
    var a = document.createElement("a");
    a.href = HANDBUCH_PDF;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- Steuerung ---------- */

  function zeige() {
    if (!zustand.daten) return;
    if (dialog.open) schliesseDialog();
    if (!zustand.benutzer) { zeigeAnmeldung(); return; }
    if (zustand.benutzer.mussPasswortAendern && !zustand.alsAdmin /* BETA-ANMELDEN-ALS */) { zeigePasswortFestlegen(); return; }
    var r = route(), b = zustand.benutzer;
    if (r.seite === "uebersicht" && D.Rechte.budgets(b)) zeigeUebersicht();
    else if (r.seite === "ist" && D.Rechte.budgets(b)) zeigeIstWerte();
    else if (r.seite === "bericht" && darfBericht(b, r.unter)) zeigeBericht(r.unter);
    else if (r.seite === "kostenstelle" && D.Rechte.budgets(b) && D.findeNummer(zustand.daten, "ks", r.unter)) zeigeKostenstelle(r.unter, r.zusatz === "eigen");
    else if (r.seite === "projekt" && darfProjekt(b, r.unter)) zeigeProjekt(r.unter);
    else if (r.seite === "verwaltung" && D.Rechte.benutzer(b)) zeigeVerwaltung(r.unter);
    else if (r.seite === "profil") zeigeProfil();
    else if (r.seite === "handbuch") zeigeHandbuch();
    else zeigeStart();
    window.scrollTo(0, 0);
  }

  function start() {
    window.BDDienst.ermitteln().then(function (d) {
      Dienst = d;
      if (Dienst.modus === "browser" && (!window.crypto || !window.crypto.subtle)) {
        throw new Error("Ohne Server braucht das Budgetdashboard eine sichere Verbindung (https). Öffne es bitte über die richtige Adresse.");
      }
      return Dienst.start();
    }).then(function (r) {
      uebernehmen(r);
      if (r.benutzer) setzeDesign(r.benutzer.design || "auto", r.benutzer.farbe || "klassik");
      window.addEventListener("hashchange", function (e) { merkeHerkunft(e.oldURL); aktuellesJahr(); zeige(); });
      document.addEventListener("click", function (e) {
        var liste = app.querySelector(".menue__liste");
        if (liste && !liste.hidden && !liste.contains(e.target)) {
          liste.hidden = true;
          app.querySelector("[data-menue]").setAttribute("aria-expanded", "false");
        }
      });
      zeige();
    }).catch(function (f) {
      app.innerHTML = '<main class="seite"><h1>Das Tool startet gerade nicht</h1><p>' + esc(f.message) + "</p>" +
        '<button type="button" class="btn btn--primaer" data-neu-laden>Neu laden</button></main>';
      app.querySelector("[data-neu-laden]").addEventListener("click", function () { location.reload(); });
    });
  }

  start();
})();
