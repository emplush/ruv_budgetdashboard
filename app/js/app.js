/* Budgetdashboard: Oberfläche (Anmeldung, Start, Übersicht, Verwaltung, Profil). */
(function () {
  "use strict";

  var VERSION = "0.2.0";
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
  function uebernehmen(r) {
    zustand.daten = r.daten;
    zustand.benutzer = r.benutzer;
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
    return { seite: teile[0] || "start", unter: teile[1] || "" };
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
  function betragFeld(z) { return z ? (Number(z) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""; }

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
      "<p>Die Planbudgets Deiner Kostenstellen und Projekte auf einen Blick.</p></div>" +
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
    if (D.Rechte.budgets(b)) n.push({ id: "uebersicht", name: "Übersicht", icon: "diagramBarchart" });
    if (D.Rechte.benutzer(b)) n.push({ id: "verwaltung", name: "Verwaltung", icon: "settings" });
    return n;
  }

  function kopfHtml(aktiv) {
    var b = zustand.benutzer;
    return '<header class="kopf"><div class="kopf__leiste">' +
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
      '<button type="button" data-abmelden>' + icon("logout") + "Abmelden</button>" +
      "</div></div></div></div></header>";
  }

  function fussHtml() {
    return '<footer class="fuss"><span>' + esc(zustand.daten.einstellungen.titel) + " · Version " + VERSION + "</span>" +
      (Dienst.modus === "browser" ? "<span>Browserbetrieb: Die Daten liegen nur in diesem Browser.</span>" : "") + "</footer>";
  }

  function seite(aktiv, titel, inhalt, breit) {
    document.title = (titel ? titel + " · " : "") + zustand.daten.einstellungen.titel;
    app.innerHTML = kopfHtml(aktiv) + '<main class="seite' + (breit ? " seite--breit" : "") + '" id="inhalt">' + inhalt + "</main>" + fussHtml();
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

  function jahrwahlHtml() {
    return '<label class="jahrwahl"><span>Kalenderjahr</span><select data-jahr>' + D.jahre(zustand.daten).map(function (j) {
      return '<option value="' + j + '"' + (j === zustand.jahr ? " selected" : "") + ">" + j + "</option>";
    }).join("") + "</select></label>";
  }

  function verbindeJahrwahl() {
    var s = app.querySelector("[data-jahr]");
    if (s) s.addEventListener("change", function () { zustand.jahr = Number(s.value); zeige(); });
  }

  /* ---------- Planbudget-Darstellung ---------- */

  /* Balken mit den Anteilen von Personalkosten ID, Personalkosten AD und Sachkosten */
  function anteilHtml(w) {
    if (!w.gesamt) return "";
    var teile = [["pkId", "Personalkosten ID", w.pkId], ["pkAd", "Personalkosten AD", w.pkAd], ["sach", "Sachkosten", w.sachkosten]];
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

  /* Eine Karte je Kostenstelle oder Projektnummer, nie gemischt */
  function budgetKarte(art, nummer) {
    var g = D.gesamtBudgetVon(zustand.daten, zustand.jahr, art, nummer), w = g.gesamt;
    var oben = art === "ks" ? D.uebergeordnete(zustand.daten, nummer) : "";
    return '<article class="karte budget" data-nummer="' + esc(art + "-" + nummer) + '">' +
      '<p class="topline">' + (g.uebergreifend ? "Übergreifende Kostenstelle" : esc(D.ARTEN[art].name)) + "</p>" +
      '<h2 class="budget__nummer">' + esc(nummer) + "</h2>" +
      (oben ? '<p class="leise klein">Gehört zur übergreifenden Kostenstelle ' + esc(oben) + ".</p>" : "") +
      (w.vorhanden
        ? '<p class="budget__gesamt"><span class="leise klein">Planbudget ' + zustand.jahr + (g.uebergreifend ? " inklusive zugeordneter Kostenstellen" : "") + "</span><strong>" + euro(w.gesamt) + "</strong></p>" +
          anteilHtml(w) + positionenHtml(w) + (g.uebergreifend ? zusammensetzungHtml(g) : "")
        : '<p class="leer-hinweis">Für ' + zustand.jahr + " ist noch kein Planbudget eingetragen.</p>") +
      (g.uebergreifend ? '<p class="budget__link"><a class="btn btn--rahmen" href="#/bericht/' + esc(nummer) + '">' + icon("diagramBarchart") + " Bericht ansehen</a></p>" : "") +
      "</article>";
  }

  /* Woraus sich das Planbudget einer übergreifenden Kostenstelle zusammensetzt */
  function zusammensetzungHtml(g) {
    return '<table class="positionen positionen--zusammensetzung"><caption>Zusammensetzung</caption><tbody>' +
      '<tr><th scope="row">Eigenes Budget</th><td class="zahl">' + euro(g.eigen.gesamt) + "</td></tr>" +
      g.unter.map(function (u) {
        return '<tr><th scope="row">Kostenstelle ' + esc(u.nummer) + '</th><td class="zahl">' + (u.budget.vorhanden ? euro(u.budget.gesamt) : '<span class="leise">–</span>') + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function eigeneBereiche(b) {
    var html = "";
    ["ks", "pn"].forEach(function (art) {
      var nummern = D.nummernVon(zustand.daten, b.kennung, art);
      if (!nummern.length) return;
      html += '<section class="bereich"><h2 class="bereich__titel">Meine ' + esc(D.ARTEN[art].mehrzahl) + "</h2>" +
        '<div class="raster">' + nummern.map(function (n) { return budgetKarte(art, n); }).join("") + "</div></section>";
    });
    return html;
  }

  function kennzahl(titel, wert, unter) {
    return '<div class="kennzahl"><span class="kennzahl__titel">' + esc(titel) + '</span><strong class="kennzahl__wert">' + wert + "</strong>" +
      (unter ? '<span class="kennzahl__unter">' + unter + "</span>" : "") + "</div>";
  }

  /* ---------- Start ---------- */

  function zeigeStart() {
    var b = zustand.benutzer, daten = zustand.daten;
    var kopf = '<div class="seite__kopf"><div><p class="topline">' + esc(D.rollenName(b.rolle)) + "</p><h1>" + esc(D.begruessung()) + ", " + esc(b.vorname || b.kennung) + "</h1></div>" +
      (b.rolle !== "admin" ? jahrwahlHtml() : "") + "</div>";
    var inhalt = "";
    if (b.rolle === "admin") {
      inhalt = '<p class="einleitung">Hier pflegst Du die Grundlagen des Tools: Benutzer, Kostenstellen, Projektnummern und Einstellungen.</p>' +
        '<div class="kacheln">' +
        startKachel("#/verwaltung/benutzer", "peopleTwo", "Benutzer", daten.benutzer.length + " Konten") +
        startKachel("#/verwaltung/kostenstellen", "folderOpen", "Kostenstellen", daten.kostenstellen.length + " angelegt") +
        startKachel("#/verwaltung/projekte", "briefcase", "Projektnummern", daten.projekte.length + " angelegt") +
        startKachel("#/verwaltung/einstellungen", "settings", "Einstellungen", "Titel des Tools") + "</div>";
    } else if (b.rolle === "al") {
      var ks = summeArt("ks"), pn = summeArt("pn");
      var gesamt = D.summe([ks, pn]);
      inhalt = '<div class="kennzahlen">' +
        kennzahl("Planbudget " + zustand.jahr, euro(gesamt.gesamt), "Kostenstellen und Projektnummern") +
        kennzahl("Kostenstellen", euro(ks.gesamt), daten.kostenstellen.length + " Kostenstellen") +
        kennzahl("Projektnummern", euro(pn.gesamt), daten.projekte.length + " Projektnummern") +
        kennzahl("Ohne Planbudget", String(ohnePlan()), "Kostenstellen und Projektnummern") + "</div>" +
        '<div class="knopfreihe" style="margin:1.5rem 0 2rem"><a class="btn btn--primaer" href="#/uebersicht">' + icon("diagramBarchart") + " Zur Übersicht der Planbudgets</a>" +
        '<a class="btn btn--rahmen" href="#/verwaltung/benutzer">' + icon("peopleTwo") + " Benutzer verwalten</a></div>" + eigeneBereiche(b);
    } else {
      var eigen = eigeneBereiche(b);
      inhalt = eigen || '<div class="karte leer-karte"><h2>Noch nichts zugewiesen</h2><p>Dir ist noch keine ' + esc(b.rolle === "kam" ? "Projektnummer" : "Kostenstelle") +
        " zugewiesen. Wende Dich bitte an Deine Abteilungsleitung.</p></div>";
    }
    seite("start", "", kopf + inhalt);
    verbindeJahrwahl();
  }

  function startKachel(link, ic, titel, unter) {
    return '<a class="startkachel" href="' + link + '"><span class="startkachel__icon">' + icon(ic) + '</span><span class="startkachel__titel">' + esc(titel) +
      '</span><span class="startkachel__unter">' + esc(unter) + "</span></a>";
  }

  function summeArt(art) {
    return D.summe(D.liste(zustand.daten, art).map(function (n) { return D.budgetVon(zustand.daten, zustand.jahr, art, n.nummer); }));
  }

  function ohnePlan() {
    var zahl = 0;
    ["ks", "pn"].forEach(function (art) {
      D.liste(zustand.daten, art).forEach(function (n) { if (!D.budgetVon(zustand.daten, zustand.jahr, art, n.nummer).vorhanden) zahl++; });
    });
    return zahl;
  }

  /* ---------- Übersicht der Abteilungsleitung ---------- */

  function namenVon(kennungen) {
    return kennungen.map(function (k) { var b = D.findeBenutzer(zustand.daten, k); return b ? D.anzeigeName(b) : k; });
  }

  function zeigeUebersicht() {
    var daten = zustand.daten;
    var ks = summeArt("ks"), pn = summeArt("pn"), gesamt = D.summe([ks, pn]);
    var html = '<div class="seite__kopf"><div><p class="topline">Abteilungsleitung</p><h1>Planbudgets ' + zustand.jahr + "</h1></div>" + jahrwahlHtml() + "</div>" +
      '<div class="kennzahlen">' +
      kennzahl("Planbudget gesamt", euro(gesamt.gesamt), "") +
      kennzahl("Personalkosten", euro(gesamt.personalkosten), "ID " + euro(gesamt.pkId) + " · AD " + euro(gesamt.pkAd)) +
      kennzahl("Sachkosten", euro(gesamt.sachkosten), "Werbung, Reise/KfZ, Sonstiges") +
      kennzahl("Ohne Planbudget", String(ohnePlan()), "Kostenstellen und Projektnummern") + "</div>" +
      tabelleHtml("ks") + tabelleHtml("pn");
    seite("uebersicht", "Übersicht", html, true);
    verbindeJahrwahl();
    app.querySelectorAll("[data-budget]").forEach(function (k) {
      k.addEventListener("click", function () {
        var t = k.getAttribute("data-budget").split("-");
        budgetDialog(t[0], t[1]);
      });
    });
  }

  function tabelleHtml(art) {
    var a = D.ARTEN[art], l = D.liste(zustand.daten, art);
    /* Übergreifende Kostenstellen stehen mit ihren zugeordneten Kostenstellen und einer Zwischensumme zusammen */
    var reihe = [];
    l.forEach(function (n) {
      if (art === "ks" && D.uebergeordnete(zustand.daten, n.nummer)) return;
      var unter = art === "ks" ? (n.unter || []) : [];
      reihe.push({ n: n, art: unter.length ? "oben" : "" });
      unter.forEach(function (u) { var e = D.findeNummer(zustand.daten, "ks", u); if (e) reihe.push({ n: e, art: "unter" }); });
      if (unter.length) reihe.push({ n: n, art: "teilsumme" });
    });
    var zeilen = reihe.map(function (r) {
      var n = r.n;
      if (r.art === "teilsumme") {
        var g = D.gesamtBudgetVon(zustand.daten, zustand.jahr, "ks", n.nummer).gesamt;
        return '<tr class="teilsumme"><th scope="row" colspan="2">Gesamt übergreifende Kostenstelle ' + esc(n.nummer) + "</th>" +
          D.POSITIONEN.map(function (p) { return '<td class="zahl">' + euro(g[p.id]) + "</td>"; }).join("") +
          '<td class="zahl summe">' + euro(g.sachkosten) + '</td><td class="zahl summe"><strong>' + euro(g.gesamt) + "</strong></td>" +
          '<td><a class="icon-btn" href="#/bericht/' + esc(n.nummer) + '" aria-label="Bericht übergreifende Kostenstelle ' + esc(n.nummer) + '" title="Bericht ansehen">' + icon("diagramBarchart") + "</a></td></tr>";
      }
      var w = D.budgetVon(zustand.daten, zustand.jahr, art, n.nummer);
      var namen = namenVon(n.benutzer);
      var klassen = [w.vorhanden ? "" : "ohne", r.art === "unter" ? "unter" : ""].filter(Boolean).join(" ");
      return "<tr" + (klassen ? ' class="' + klassen + '"' : "") + '><th scope="row"><strong>' + esc(n.nummer) + "</strong>" +
        (r.art === "oben" ? ' <span class="chip chip--akzent" title="Fasst Kostenstellen zusammen">übergreifend</span><br><span class="leise klein">eigenes Budget</span>' : "") + "</th>" +
        '<td class="klein">' + (namen.length ? esc(namen.join(", ")) : '<span class="leise">niemand</span>') + "</td>" +
        D.POSITIONEN.map(function (p) { return '<td class="zahl">' + (w.vorhanden ? euro(w[p.id]) : "–") + "</td>"; }).join("") +
        '<td class="zahl summe">' + (w.vorhanden ? euro(w.sachkosten) : "–") + '</td><td class="zahl summe"><strong>' + (w.vorhanden ? euro(w.gesamt) : "–") + "</strong></td>" +
        '<td><button type="button" class="icon-btn" data-budget="' + esc(art + "-" + n.nummer) + '" aria-label="Planbudget ' + esc(a.name + " " + n.nummer) + (w.vorhanden ? " bearbeiten" : " eintragen") +
        '" title="' + (w.vorhanden ? "Planbudget bearbeiten" : "Planbudget eintragen") + '">' + icon(w.vorhanden ? "pencil" : "plus") + "</button></td></tr>";
    }).join("");
    var s = summeArt(art);
    return '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>' + esc(a.mehrzahl) + "</h2>" +
      '<a class="leise klein" href="#/verwaltung/' + (art === "ks" ? "kostenstellen" : "projekte") + '">' + esc(a.mehrzahl) + " verwalten</a></div>" +
      (l.length ? '<div class="tabelle-huelle"><table class="budgettabelle"><thead><tr><th>' + esc(a.name) + "</th><th>Zugewiesen</th>" +
        D.POSITIONEN.map(function (p) { return '<th class="zahl">' + esc(p.name) + "</th>"; }).join("") +
        '<th class="zahl">Sachkosten</th><th class="zahl">Gesamt</th><th><span class="sr">Aktion</span></th></tr></thead><tbody>' + zeilen + "</tbody>" +
        '<tfoot><tr><th scope="row" colspan="2">Summe ' + esc(a.mehrzahl) + "</th>" +
        D.POSITIONEN.map(function (p) { return '<td class="zahl">' + euro(s[p.id]) + "</td>"; }).join("") +
        '<td class="zahl">' + euro(s.sachkosten) + '</td><td class="zahl"><strong>' + euro(s.gesamt) + "</strong></td><td></td></tr></tfoot></table></div>"
        : '<p class="leer-hinweis">Noch keine ' + esc(a.mehrzahl) + ' angelegt. <a href="#/verwaltung/' + (art === "ks" ? "kostenstellen" : "projekte") + '">Jetzt anlegen</a></p>') +
      "</section>";
  }

  function budgetDialog(art, nummer) {
    var w = D.budgetVon(zustand.daten, zustand.jahr, art, nummer);
    var jahr = zustand.jahr;
    function feld(p) {
      return '<div class="feld feld--betrag' + (p.sach ? " feld--unter" : "") + '"><label for="w-' + p.id + '">' + esc(p.name) + "</label>" +
        '<div class="betrag"><input id="w-' + p.id + '" name="' + p.id + '" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(betragFeld(w[p.id])) + '"><span>€</span></div></div>';
    }
    var form = oeffneDialog("Planbudget " + D.ARTEN[art].name + " " + nummer + " · " + jahr,
      '<p class="leise klein">Gib die Beträge in Euro ein, zum Beispiel 12.500,00. Leere Felder zählen als 0 €.</p>' +
      (art === "ks" && (D.findeNummer(zustand.daten, "ks", nummer).unter || []).length
        ? '<p class="hinweis-box klein">Das ist das eigene Budget der übergreifenden Kostenstelle. Die Planbudgets der Kostenstellen ' +
          esc(D.findeNummer(zustand.daten, "ks", nummer).unter.join(", ")) + " kommen in der Summe dazu.</p>" : "") +
      feld(D.POSITIONEN[0]) + feld(D.POSITIONEN[1]) +
      '<fieldset class="sachkosten"><legend>Sachkosten</legend>' + D.POSITIONEN.filter(function (p) { return p.sach; }).map(feld).join("") + "</fieldset>" +
      '<div class="summenzeile"><span>Sachkosten</span><strong data-sach></strong></div>' +
      '<div class="summenzeile summenzeile--gesamt"><span>Planbudget gesamt</span><strong data-gesamt></strong></div>' +
      '<p class="fehlertext" hidden></p>',
      '<button type="button" class="btn btn--rahmen" data-schliessen>Abbrechen</button><button type="submit" class="btn btn--primaer">Planbudget speichern</button>',
      function (f) {
        var werte = {};
        D.POSITIONEN.forEach(function (p) { werte[p.id] = f[p.id].value; });
        for (var i = 0; i < D.POSITIONEN.length; i++) {
          if (D.leseBetrag(werte[D.POSITIONEN[i].id]) === null) {
            zeigeFehler(f, "Prüfe bitte den Betrag bei „" + D.POSITIONEN[i].name + "“. Erlaubt sind Beträge ab 0 €, zum Beispiel 12.500,00.");
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
    form.querySelectorAll(".betrag input").forEach(function (i) {
      i.addEventListener("blur", function () { var z = D.leseBetrag(i.value); if (z !== null && i.value.trim()) i.value = betragFeld(z) || "0,00"; });
    });
    rechne();
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
    { id: "gesamt", name: "Planbudget gesamt", gesamt: true }
  ];

  function zeigeBericht(nummer) {
    var g = D.gesamtBudgetVon(zustand.daten, zustand.jahr, "ks", nummer);
    var spalten = [{ name: "Eigenes Budget", w: g.eigen }].concat(g.unter.map(function (u) { return { name: "Kostenstelle " + u.nummer, w: u.budget }; }));
    spalten.push({ name: "Gesamt", w: g.gesamt, gesamt: true });
    var html = '<div class="seite__kopf"><div><p class="topline">Bericht übergreifende Kostenstelle</p><h1>Kostenstelle ' + esc(nummer) + " · " + zustand.jahr + "</h1></div>" + jahrwahlHtml() + "</div>" +
      '<div class="kennzahlen">' +
      kennzahl("Planbudget gesamt", euro(g.gesamt.gesamt), "eigenes Budget und " + g.unter.length + " zugeordnete Kostenstellen") +
      kennzahl("Eigenes Budget", euro(g.eigen.gesamt), "Kostenstelle " + esc(nummer)) +
      kennzahl("Zugeordnete Kostenstellen", euro(D.summe(g.unter.map(function (u) { return u.budget; })).gesamt), esc(g.unter.map(function (u) { return u.nummer; }).join(", "))) +
      kennzahl("Ohne Planbudget", String(spalten.slice(0, -1).filter(function (x) { return !x.w.vorhanden; }).length), "von " + (spalten.length - 1) + " Teilen") + "</div>" +
      '<section class="karte bereich-tabelle"><div class="bereich-tabelle__kopf"><h2>Planbudget nach Positionen</h2>' +
      '<button type="button" class="btn btn--rahmen" data-kopieren>' + icon("copy") + " Tabelle kopieren</button></div>" +
      '<p class="leise klein">Mit „Tabelle kopieren“ fügst Du die Werte direkt in Excel ein und kannst sie dort mit Deinem Dokument abgleichen. Die IST-Werte kommen mit dem IST-Import dazu.</p>' +
      '<div class="tabelle-huelle"><table class="budgettabelle berichtstabelle"><thead><tr><th>Position</th>' +
      spalten.map(function (sp) { return '<th class="zahl' + (sp.gesamt ? " summe" : "") + '">' + esc(sp.name) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      BERICHT_ZEILEN.map(function (z) {
        return "<tr" + (z.summe ? ' class="teilsumme"' : z.gesamt ? ' class="gesamtzeile"' : "") + '><th scope="row">' + esc(z.name) + "</th>" +
          spalten.map(function (sp) { return '<td class="zahl' + (sp.gesamt ? " summe" : "") + '">' + (z.gesamt ? "<strong>" + euro(sp.w[z.id]) + "</strong>" : euro(sp.w[z.id])) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div></section>";
    seite("bericht", "Bericht " + nummer, html, true);
    verbindeJahrwahl();
    app.querySelector("[data-kopieren]").addEventListener("click", function () {
      var zahl = function (z) { return (Number(z) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }); };
      var text = ["Kostenstelle " + nummer + " " + zustand.jahr].concat(spalten.map(function (sp) { return sp.name; })).join("\t") + "\n" +
        BERICHT_ZEILEN.map(function (z) { return [z.name].concat(spalten.map(function (sp) { return zahl(sp.w[z.id]); })).join("\t"); }).join("\n");
      kopiere(text).then(function () { meldung("Die Tabelle ist kopiert. Füge sie in Excel mit Strg+V ein."); }, function () { meldung("Das Kopieren hat nicht geklappt. Markiere die Tabelle bitte von Hand.", true); });
    });
  }

  /* ---------- Verwaltung ---------- */

  function reiterListe() {
    var b = zustand.benutzer;
    var r = [
      { id: "benutzer", name: "Benutzer", icon: "peopleTwo" },
      { id: "kostenstellen", name: "Kostenstellen", icon: "folderOpen" },
      { id: "projekte", name: "Projektnummern", icon: "briefcase" }
    ];
    if (D.Rechte.einstellungen(b)) r.push({ id: "einstellungen", name: "Einstellungen", icon: "settings" });
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
      (l.length ? '<div class="tabelle-huelle"><table><thead><tr><th>' + esc(a.name) + "</th><th>Zugewiesen</th>" + (art === "ks" ? "<th>Übergreifend</th>" : "") +
        (D.Rechte.budgets(ich) ? '<th class="zahl">Planbudget ' + jahr + "</th>" : "") + '<th><span class="sr">Aktionen</span></th></tr></thead><tbody>' +
        l.map(function (n) {
          var namen = namenVon(n.benutzer);
          var w = D.budgetVon(daten, jahr, art, n.nummer);
          return '<tr data-zeile="' + esc(n.nummer) + '"><th scope="row"><strong>' + esc(n.nummer) + "</strong></th>" +
            '<td><div class="chips">' + (namen.length ? namen.map(function (x) { return '<span class="chip">' + esc(x) + "</span>"; }).join("") : '<span class="leise">niemand</span>') + "</div></td>" +
            (art === "ks" ? "<td>" + uebergreifendText(daten, n) + "</td>" : "") +
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
        bestaetige(a.name + " löschen", "Möchtest Du die " + a.name + " " + nr + " löschen? Alle Planbudgets dieser " + a.name + " in allen Kalenderjahren gehen dabei verloren.", a.name + " löschen")
          .then(function (ja) { if (ja) Dienst.nummerLoeschen(daten, ich, art, nr).then(nachAenderung("Die " + a.name + " " + nr + " ist gelöscht."), serverFehler); });
      });
    });
  }

  function uebergreifendText(daten, n) {
    var oben = D.uebergeordnete(daten, n.nummer);
    if ((n.unter || []).length) return '<span class="klein">fasst ' + esc(n.unter.join(", ")) + " zusammen</span>";
    if (oben) return '<span class="klein">gehört zu ' + esc(oben) + "</span>";
    return '<span class="leise">–</span>';
  }

  /* Auswahl der zugeordneten Kostenstellen für eine übergreifende Kostenstelle */
  function unterHtml(daten, eintrag) {
    var selbst = eintrag ? eintrag.nummer : "";
    var oben = selbst ? D.uebergeordnete(daten, selbst) : "";
    var kopf = '<fieldset class="zuweisung" data-unter><legend>Übergreifende Kostenstelle</legend>';
    if (oben) return kopf + '<p class="leise klein">Diese Kostenstelle gehört zur übergreifenden Kostenstelle ' + esc(oben) + " und kann deshalb keine weiteren zusammenfassen.</p></fieldset>";
    var andere = daten.kostenstellen.filter(function (n) { return n.nummer !== selbst; });
    if (!andere.length) return kopf + '<p class="leise klein">Lege zuerst weitere Kostenstellen an, um sie hier zuzuordnen.</p></fieldset>';
    return kopf + '<p class="hilfe" style="margin-top:0">Wähle die Kostenstellen, die diese Kostenstelle zusammenfasst. Ihr Planbudget ergibt sich dann aus dem eigenen Budget plus den Planbudgets der zugeordneten Kostenstellen.</p>' +
      '<div class="zuweisung__liste">' + andere.map(function (n) {
        var gehoert = D.uebergeordnete(daten, n.nummer);
        var gesperrt = (n.unter || []).length ? "selbst übergreifend" : gehoert && gehoert !== selbst ? "gehört zu " + gehoert : "";
        return '<label class="check"><input type="checkbox" name="unter" value="' + esc(n.nummer) + '"' + (gehoert && gehoert === selbst ? " checked" : "") + (gesperrt ? " disabled" : "") + "> " +
          esc(n.nummer) + (gesperrt ? ' <span class="leise klein">' + esc(gesperrt) + "</span>" : "") + "</label>";
      }).join("") + "</div></fieldset>";
  }

  function nummerDialog(art, eintrag) {
    var daten = zustand.daten, ich = zustand.benutzer, a = D.ARTEN[art];
    var personen = daten.benutzer.filter(function (b) { return D.passtZurArt(b, art); })
      .sort(function (x, y) { return D.anzeigeName(x).localeCompare(D.anzeigeName(y), "de"); });
    oeffneDialog(eintrag ? a.name + " " + eintrag.nummer + " bearbeiten" : "Neue " + a.name,
      '<div class="feld"><label for="n-nummer">' + esc(a.name) + '</label><input id="n-nummer" name="nummer" type="text" inputmode="numeric" maxlength="' + a.stellen + '" placeholder="' +
      (art === "ks" ? "123" : "12345678") + '" value="' + esc(eintrag ? eintrag.nummer : "") + '"><p class="hilfe">Genau ' + a.stellen + " Ziffern." +
      (eintrag ? " Änderst Du die Nummer, wandern die Planbudgets mit." : "") + "</p></div>" +
      '<fieldset class="zuweisung"><legend>Zugewiesen an</legend>' +
      (personen.length ? '<div class="zuweisung__liste zuweisung__liste--breit">' + personen.map(function (b) {
        return '<label class="check"><input type="checkbox" name="person" value="' + esc(b.kennung) + '"' + (eintrag && eintrag.benutzer.indexOf(b.kennung) >= 0 ? " checked" : "") + "> " +
          esc(D.anzeigeName(b)) + ' <span class="leise klein">' + esc(b.kennung) + " · " + esc(D.rollenName(b.rolle)) + "</span></label>";
      }).join("") + "</div>" : '<p class="leise klein">Es gibt noch keine ' + (art === "ks" ? "Gruppenleitung oder Abteilungsleitung" : "Key Account Manager") + ". Lege sie unter Benutzer an.</p>") +
      '<p class="hilfe">Optional. Mehrere Personen sind möglich.</p></fieldset>' + (art === "ks" ? unterHtml(daten, eintrag) : "") + '<p class="fehlertext" hidden></p>',
      '<button type="button" class="btn btn--rahmen" data-schliessen>Abbrechen</button><button type="submit" class="btn btn--primaer">' + (eintrag ? "Änderungen speichern" : a.name + " anlegen") + "</button>",
      function (f) {
        var nummer = f.nummer.value.trim();
        if (!D.istGueltigeNummer(art, nummer)) { zeigeFehler(f, "Eine " + a.name + " besteht aus genau " + a.stellen + " Ziffern."); f.nummer.focus(); return; }
        if ((!eintrag || eintrag.nummer !== nummer) && D.findeNummer(daten, art, nummer)) { zeigeFehler(f, "Die " + a.name + " " + nummer + " gibt es schon."); return; }
        var kennungen = Array.prototype.slice.call(f.querySelectorAll("[name=person]:checked")).map(function (c) { return c.value; });
        var unter = art === "ks" && f.querySelector("[name=unter]") ? Array.prototype.slice.call(f.querySelectorAll("[name=unter]:checked")).map(function (c) { return c.value; }) : undefined;
        Dienst.nummerSpeichern(daten, ich, art, eintrag ? eintrag.nummer : "", nummer, kennungen, unter)
          .then(nachAenderung("Die " + a.name + " " + nummer + " ist gespeichert."), function (x) { serverFehler(x, f); });
      });
  }

  function verwaltungEinstellungen(ziel) {
    var daten = zustand.daten, ich = zustand.benutzer;
    ziel.innerHTML = '<div class="raster">' +
      '<form class="karte" novalidate data-titel><h2>Titel der Anwendung</h2>' +
      '<div class="feld"><label for="e-titel">Titel</label><input id="e-titel" name="titel" type="text" maxlength="60" value="' + esc(daten.einstellungen.titel) + '">' +
      '<p class="hilfe">Steht in der Kopfzeile, auf der Anmeldeseite und im Tab des Browsers.</p></div>' +
      '<p class="fehlertext" hidden></p><button type="submit" class="btn btn--primaer">Titel speichern</button></form>' +
      (Dienst.modus === "browser" ? '<div class="karte"><h2>Beispieldaten</h2><p>Setze das Tool auf die Beispieldaten zurück. Alle Änderungen in diesem Browser gehen dabei verloren.</p>' +
        '<button type="button" class="btn btn--gefahr" data-zuruecksetzen>Auf Beispieldaten zurücksetzen</button></div>' : "") +
      "</div>";
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

  /* ---------- Steuerung ---------- */

  function zeige() {
    if (!zustand.daten) return;
    if (dialog.open) schliesseDialog();
    if (!zustand.benutzer) { zeigeAnmeldung(); return; }
    if (zustand.benutzer.mussPasswortAendern) { zeigePasswortFestlegen(); return; }
    var r = route(), b = zustand.benutzer;
    if (r.seite === "uebersicht" && D.Rechte.budgets(b)) zeigeUebersicht();
    else if (r.seite === "bericht" && darfBericht(b, r.unter)) zeigeBericht(r.unter);
    else if (r.seite === "verwaltung" && D.Rechte.benutzer(b)) zeigeVerwaltung(r.unter);
    else if (r.seite === "profil") zeigeProfil();
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
      window.addEventListener("hashchange", zeige);
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
