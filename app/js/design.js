/* Design vor dem ersten Zeichnen setzen, damit nichts aufblitzt (eigene Datei wegen Content-Security-Policy).
   Hell oder dunkel steht in data-theme, das Farbdesign überschreibt die Farbvariablen aus app.css.
   "auto" folgt der Einstellung des Betriebssystems. Alle Farben stammen aus der R+V-Palette (tokens.css) oder sind Abtönungen davon. */
(function (wurzel) {
  "use strict";

  /* Je Design: name, kurz (Beschreibung), muster (Vorschaufarben) und für hell und dunkel
     - kopf: Farbe der Kopfleiste, Schrift darauf (weiss oder blau), Akzent für die aktive Seite und Endfarbe des Verlaufs
     - werte: Variablen aus app.css, die das Design überschreibt
     "klassik" ist der Standard aus app.css und braucht keine Überschreibungen. */
  var FARBEN = [
    { id: "klassik", name: "Klassik", kurz: "Weiß, Dunkelblau und Orange", muster: ["#001957", "#eb6504", "#00dcdc"], hell: {}, dunkel: {} },
    {
      id: "wiesbaden", name: "Wiesbaden", kurz: "Petrol und Mint", muster: ["#0b4f59", "#109da8", "#c9e9ec"],
      hell: { kopf: ["#0b4f59", "weiss", "#00dcdc", "#10808c"], werte: { hg: "#f1f7f8", "flaeche-2": "#e6f2f3", akzent: "#109da8", "akzent-text": "#ffffff", topline: "#0b6f7a", aktion: "#0b4f59", "aktion-hover": "#109da8", "aktion-text": "#ffffff", link: "#0b6f7a", ring: "#109da8", chip: "#d6edef", linie: "#dbe8ea", glanz: "rgba(16, 157, 168, .14)" } },
      dunkel: { kopf: ["#0b4f59", "weiss", "#00dcdc", "#0f6f7a"], werte: { hg: "#021f26", flaeche: "#06303a", "flaeche-2": "#0b3f4b", akzent: "#00dcdc", "akzent-text": "#021f26", topline: "#00dcdc", "text-2": "#bfeaea", chip: "rgba(0, 220, 220, .16)", sand: "#0e3a40", eingabe: "#021f26" } }
    },
    {
      id: "rheingau", name: "Rheingau", kurz: "Kräftiges Grün", muster: ["#5b7a03", "#a7d54c", "#e4f2c7"],
      hell: { kopf: ["#4a6402", "weiss", "#daf1ab", "#759a03"], werte: { hg: "#f5f8ee", "flaeche-2": "#ecf3df", akzent: "#759a03", "akzent-text": "#ffffff", topline: "#5b7a03", aktion: "#5b7a03", "aktion-hover": "#759a03", "aktion-text": "#ffffff", link: "#4a6402", ring: "#759a03", chip: "#e2efc6", linie: "#e1e8d2", glanz: "rgba(117, 154, 3, .14)" } },
      dunkel: { kopf: ["#3c5102", "weiss", "#c5e878", "#5b7a03"], werte: { hg: "#0f1a02", flaeche: "#1a2a05", "flaeche-2": "#24380a", akzent: "#a7d54c", "akzent-text": "#0f1a02", topline: "#c5e878", aktion: "#a7d54c", "aktion-hover": "#c5e878", link: "#c5e878", ring: "#a7d54c", "text-2": "#daf1ab", chip: "rgba(167, 213, 76, .16)", sand: "#26340f", eingabe: "#0f1a02" } }
    },
    {
      id: "taunus", name: "Taunus", kurz: "Stahlblau und Himmelblau", muster: ["#155784", "#7db5d7", "#d3e8f6"],
      hell: { kopf: ["#0f4a73", "weiss", "#bee0f5", "#3875a6"], werte: { hg: "#f1f6fa", "flaeche-2": "#e6eff7", akzent: "#155784", "akzent-text": "#ffffff", topline: "#3875a6", aktion: "#155784", "aktion-hover": "#3875a6", "aktion-text": "#ffffff", link: "#155784", ring: "#3875a6", chip: "#d8e9f5", linie: "#dbe5ee", glanz: "rgba(56, 117, 166, .14)" } },
      dunkel: { kopf: ["#155784", "weiss", "#bee0f5", "#2a6a99"], werte: { hg: "#061a2c", flaeche: "#0c2840", "flaeche-2": "#133553", akzent: "#7db5d7", "akzent-text": "#001957", topline: "#bee0f5", aktion: "#7db5d7", "aktion-hover": "#bee0f5", link: "#bee0f5", ring: "#7db5d7", "text-2": "#bee0f5", chip: "rgba(125, 181, 215, .18)", sand: "#16304a", eingabe: "#061a2c" } }
    },
    {
      id: "sandstein", name: "Sandstein", kurz: "Dunkelbraun und Sand", muster: ["#583720", "#c47d47", "#fbe5c7"],
      hell: { kopf: ["#4a2e1a", "weiss", "#eabe8d", "#8a5530"], werte: { hg: "#faf6f0", "flaeche-2": "#f4ece0", text: "#4a2e1a", akzent: "#a45f33", "akzent-text": "#ffffff", topline: "#a45f33", aktion: "#583720", "aktion-hover": "#a45f33", "aktion-text": "#ffffff", link: "#a45f33", ring: "#c47d47", chip: "#f6e5cd", linie: "#ebe1d3", sand: "#fff4e0", glanz: "rgba(196, 125, 71, .14)" } },
      dunkel: { kopf: ["#583720", "weiss", "#eabe8d", "#7a4b2b"], werte: { hg: "#1e130b", flaeche: "#2b1c10", "flaeche-2": "#3a2616", text: "#fff4e0", akzent: "#eabe8d", "akzent-text": "#1e130b", topline: "#eabe8d", aktion: "#eabe8d", "aktion-hover": "#fbe5c7", "aktion-text": "#1e130b", link: "#eabe8d", ring: "#eabe8d", "text-2": "#fbe5c7", chip: "rgba(234, 190, 141, .16)", sand: "#3a2616", eingabe: "#1e130b" } }
    },
    {
      id: "abendrot", name: "Abendrot", kurz: "Leuchtendes Orange", muster: ["#eb6504", "#f79506", "#fde0bf"],
      hell: { kopf: ["#e35d00", "blau", "#001957", "#f79506"], werte: { hg: "#fdf7f1", "flaeche-2": "#fbeee1", akzent: "#eb6504", "akzent-text": "#ffffff", topline: "#c25300", aktion: "#001957", "aktion-hover": "#155784", "aktion-text": "#ffffff", link: "#a45f33", ring: "#eb6504", chip: "#fde3c6", linie: "#f0e3d5", glanz: "rgba(235, 101, 4, .14)" } },
      dunkel: { kopf: ["#eb6504", "blau", "#001957", "#f79506"], werte: { hg: "#1f0e02", flaeche: "#2e1606", "flaeche-2": "#3d1f0a", akzent: "#f79506", "akzent-text": "#1f0e02", topline: "#f79506", aktion: "#f79506", "aktion-hover": "#eabe8d", link: "#f79506", ring: "#f79506", "text-2": "#fbe5c7", chip: "rgba(247, 149, 6, .18)", sand: "#3d1f0a", eingabe: "#1f0e02" } }
    },
    {
      id: "genossenschaft", name: "Genossenschaft", kurz: "Dunkelblau und Hellgrün", muster: ["#001957", "#a7d54c", "#eef6dd"],
      hell: { kopf: ["#001957", "weiss", "#a7d54c", "#0e3d80"], werte: { hg: "#f5f8ef", "flaeche-2": "#ecf3e0", akzent: "#759a03", "akzent-text": "#ffffff", topline: "#5b7a03", aktion: "#001957", "aktion-hover": "#155784", "aktion-text": "#ffffff", ring: "#759a03", chip: "#e2efc6", linie: "#e1e8d5", glanz: "rgba(167, 213, 76, .2)" } },
      dunkel: { kopf: ["#5b7a03", "weiss", "#daf1ab", "#759a03"], werte: { akzent: "#a7d54c", "akzent-text": "#001957", topline: "#c5e878", aktion: "#a7d54c", "aktion-hover": "#c5e878", link: "#c5e878", ring: "#a7d54c", chip: "rgba(167, 213, 76, .16)" } }
    },
    {
      id: "schiefer", name: "Schiefer", kurz: "Graphit und Mint", muster: ["#3a3d42", "#888888", "#00dcdc"],
      hell: { kopf: ["#2b2e33", "weiss", "#00dcdc", "#4d5259"], werte: { hg: "#f4f5f6", "flaeche-2": "#eceef0", text: "#22252a", akzent: "#109da8", "akzent-text": "#ffffff", topline: "#5c5f64", aktion: "#3a3d42", "aktion-hover": "#5c5f64", "aktion-text": "#ffffff", link: "#167b8a", ring: "#109da8", chip: "#e4e6e9", linie: "#e0e2e5", glanz: "rgba(58, 61, 66, .1)" } },
      dunkel: { kopf: ["#3a3d42", "weiss", "#00dcdc", "#55595f"], werte: { hg: "#151618", flaeche: "#202226", "flaeche-2": "#2b2e33", akzent: "#00dcdc", "akzent-text": "#151618", topline: "#c7c7c7", "text-2": "#c7c7c7", chip: "rgba(255, 255, 255, .1)", sand: "#2b2e33", eingabe: "#151618" } }
    },
    {
      id: "mitternacht", name: "Mitternacht", kurz: "Nachtblau und Orange", muster: ["#000d2e", "#f79506", "#d5ddee"],
      hell: { kopf: ["#000d2e", "weiss", "#f79506", "#00296b"], werte: { hg: "#f2f4f9", "flaeche-2": "#e8ecf5", akzent: "#f79506", "akzent-text": "#001957", topline: "#eb6504", aktion: "#000d2e", "aktion-hover": "#155784", "aktion-text": "#ffffff", chip: "#dfe5f1", linie: "#dce1eb", glanz: "rgba(0, 41, 107, .12)" } },
      dunkel: { kopf: ["#001957", "weiss", "#f79506", "#0a3478"], werte: { hg: "#000814", flaeche: "#00102b", "flaeche-2": "#001a40", aktion: "#f79506", "aktion-hover": "#eabe8d", eingabe: "#000814", sand: "#001a40" } }
    },
    {
      id: "rheinufer", name: "Rheinufer", kurz: "Mint und Sand", muster: ["#00dcdc", "#109da8", "#fff4e0"],
      hell: { kopf: ["#00c8cc", "blau", "#001957", "#7de8e0"], werte: { hg: "#fbf8f2", "flaeche-2": "#ecf7f6", akzent: "#109da8", "akzent-text": "#ffffff", topline: "#a45f33", aktion: "#109da8", "aktion-hover": "#138c99", "aktion-text": "#ffffff", link: "#167b8a", ring: "#109da8", chip: "#f8ead4", linie: "#ece5d8", glanz: "rgba(0, 220, 220, .16)" } },
      dunkel: { kopf: ["#109da8", "blau", "#001957", "#21b8c0"], werte: { hg: "#1d1810", flaeche: "#29221a", "flaeche-2": "#352c22", akzent: "#00dcdc", "akzent-text": "#1d1810", topline: "#eabe8d", "text-2": "#fbe5c7", chip: "rgba(0, 220, 220, .14)", sand: "#352c22", eingabe: "#1d1810" } }
    }
  ];

  /* Variablen für eine farbige Kopf- und Fußleiste */
  function kopfWerte(k) {
    var weiss = k[1] === "weiss";
    return {
      kopf: k[3] ? "linear-gradient(105deg, " + k[0] + " 0%, " + k[0] + " 35%, " + k[3] + " 100%)" : k[0], "kopf-voll": k[0], "kopf-akzent": k[2], "kopf-akzent-text": k[2] === "#001957" ? "#ffffff" : "#001957",
      "kopf-text": weiss ? "#ffffff" : "#001957",
      "kopf-hover": weiss ? "rgba(255, 255, 255, .14)" : "rgba(0, 25, 87, .12)",
      "kopf-eingabe": weiss ? "rgba(255, 255, 255, .12)" : "rgba(255, 255, 255, .55)",
      "kopf-rand": weiss ? "rgba(255, 255, 255, .45)" : "rgba(0, 25, 87, .45)",
      "kopf-linie": "transparent", "kopf-schatten": "0 6px 24px rgba(0, 13, 46, .18)"
    };
  }

  var GESETZT = [];

  function finde(id) {
    for (var i = 0; i < FARBEN.length; i++) if (FARBEN[i].id === id) return FARBEN[i];
    return FARBEN[0];
  }

  var systemDunkel = wurzel.matchMedia ? wurzel.matchMedia("(prefers-color-scheme: dark)") : null;
  var gewaehlt = { modus: "auto", farbe: "klassik" };

  /* "auto" wird zu "hell" oder "dunkel" je nach Betriebssystem */
  function aufgeloest(modus) {
    if (modus === "hell" || modus === "dunkel") return modus;
    return systemDunkel && systemDunkel.matches ? "dunkel" : "hell";
  }

  /* modus: "auto", "hell" oder "dunkel"; farbe: id aus FARBEN */
  function anwenden(modus, farbe) {
    var html = document.documentElement;
    var f = finde(farbe);
    gewaehlt = { modus: modus === "hell" || modus === "dunkel" ? modus : "auto", farbe: f.id };
    var m = aufgeloest(gewaehlt.modus);
    var teil = f[m];
    var werte = {};
    if (teil.kopf) Object.assign(werte, kopfWerte(teil.kopf));
    if (teil.werte) Object.assign(werte, teil.werte);
    html.setAttribute("data-theme", m);
    html.setAttribute("data-farbe", f.id);
    // Logo und Suchfeld richten sich nach der Schrift auf der Kopfleiste
    html.setAttribute("data-kopf", teil.kopf ? (teil.kopf[1] === "weiss" ? "dunkel" : "hell") : m);
    GESETZT.forEach(function (n) { html.style.removeProperty("--" + n); });
    GESETZT = Object.keys(werte);
    GESETZT.forEach(function (n) { html.style.setProperty("--" + n, werte[n]); });
  }

  var modus = null, farbe = null;
  try { modus = localStorage.getItem("budgetdashboard-design"); farbe = localStorage.getItem("budgetdashboard-farbe"); } catch (e) { /* ohne Speicher gilt die Systemeinstellung */ }
  anwenden(modus, farbe);
  // Im automatischen Modus folgt das Tool einem Wechsel im Betriebssystem sofort
  if (systemDunkel) {
    var folgen = function () { if (gewaehlt.modus === "auto") anwenden("auto", gewaehlt.farbe); };
    if (systemDunkel.addEventListener) systemDunkel.addEventListener("change", folgen);
    else if (systemDunkel.addListener) systemDunkel.addListener(folgen);
  }

  wurzel.BDFarben = { liste: FARBEN, finde: finde, anwenden: anwenden, gewaehlt: function () { return gewaehlt; } };
})(window);
