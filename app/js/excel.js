/*
 * Budgetdashboard: Excel-Dateien (.xlsx) lesen, ohne Fremdbibliothek.
 * Übernommen aus der Lernprogrammübersicht (emplush/ruv_lernprogramme_uebersicht), nur der Leseteil.
 * Wie ein KST-Bericht gedeutet wird, regelt BDDaten.istAuslesen.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BDExcel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- ZIP lesen ---------- */

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  function entpacken(bytes) {
    if (typeof require === 'function' && typeof window === 'undefined') {
      return Promise.resolve(new Uint8Array(require('zlib').inflateRawSync(Buffer.from(bytes))));
    }
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('Dein Browser kann Excel-Dateien nicht entpacken. Bitte nutze einen aktuellen Browser, zum Beispiel Edge oder Chrome.'));
    }
    var strom = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(strom).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  /** Liest das Inhaltsverzeichnis einer ZIP-Datei: { pfad: { methode, start, laenge } } */
  function zipVerzeichnis(b) {
    var ende = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
      if (u32(b, i) === 0x06054b50) { ende = i; break; }
    }
    if (ende < 0) throw new Error('Die Datei ist keine Excel-Datei im Format .xlsx.');
    var anzahl = u16(b, ende + 10), pos = u32(b, ende + 16);
    var dec = new TextDecoder('utf-8'), dateien = {};
    for (var n = 0; n < anzahl; n++) {
      if (u32(b, pos) !== 0x02014b50) throw new Error('Die Excel-Datei ist beschädigt.');
      var methode = u16(b, pos + 10), laenge = u32(b, pos + 20);
      var nl = u16(b, pos + 28), el = u16(b, pos + 30), kl = u16(b, pos + 32), lokal = u32(b, pos + 42);
      var name = dec.decode(b.subarray(pos + 46, pos + 46 + nl));
      var start = lokal + 30 + u16(b, lokal + 26) + u16(b, lokal + 28);
      dateien[name] = { methode: methode, start: start, laenge: laenge };
      pos += 46 + nl + el + kl;
    }
    return dateien;
  }

  function zipText(b, dateien, pfad) {
    var e = dateien[pfad];
    if (!e) return Promise.resolve(null);
    var roh = b.subarray(e.start, e.start + e.laenge);
    var p = e.methode === 0 ? Promise.resolve(roh) : e.methode === 8 ? entpacken(roh) : Promise.reject(new Error('Die Excel-Datei nutzt eine unbekannte Komprimierung.'));
    return p.then(function (x) { return new TextDecoder('utf-8').decode(x); });
  }

  /* ---------- XML ---------- */

  function entitaeten(s) {
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, function (m, e) {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e];
    });
  }

  function attribute(s) {
    var a = {}, re = /([\w:]+)\s*=\s*"([^"]*)"/g, m;
    while ((m = re.exec(s))) a[m[1]] = entitaeten(m[2]);
    return a;
  }

  /** Text aller <t>-Elemente, ohne Lautschrift-Angaben (rPh) */
  function texte(xml) {
    var s = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''), aus = '', re = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g, m;
    while ((m = re.exec(s))) aus += m[1] ? entitaeten(m[1]) : '';
    return aus;
  }

  function spalteNr(ref) {
    var buchst = /^[A-Z]+/.exec(ref)[0], n = 0;
    for (var i = 0; i < buchst.length; i++) n = n * 26 + (buchst.charCodeAt(i) - 64);
    return n - 1;
  }

  function spalteName(nr) {
    var s = '';
    nr += 1;
    while (nr > 0) { var r = (nr - 1) % 26; s = String.fromCharCode(65 + r) + s; nr = Math.floor((nr - 1) / 26); }
    return s;
  }

  function blattLesen(xml, gemeinsam) {
    var zeilen = [], re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, m;
    while ((m = re.exec(xml))) {
      var a = attribute(m[1]), inhalt = m[2] || '';
      if (!a.r) continue;
      var wert = '', v = /<v>([\s\S]*?)<\/v>/.exec(inhalt);
      if (a.t === 's') wert = v ? (gemeinsam[parseInt(v[1], 10)] || '') : '';
      else if (a.t === 'inlineStr') wert = texte(inhalt);
      else if (a.t === 'b') wert = v ? (v[1] === '1' ? 'WAHR' : 'FALSCH') : '';
      else wert = v ? entitaeten(v[1]) : '';
      if (wert === '') continue;
      var zeile = parseInt(/\d+$/.exec(a.r)[0], 10) - 1, spalte = spalteNr(a.r);
      (zeilen[zeile] || (zeilen[zeile] = []))[spalte] = wert;
    }
    return zeilen;
  }

  /**
   * Liest alle Arbeitsblätter einer .xlsx-Datei.
   * @param bytes ArrayBuffer oder Uint8Array
   * @returns Promise<[{ name, zeilen: [[Zellwert]] }]>
   */
  function arbeitsmappeLesen(bytes) {
    var b;
    try {
      b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      var dateien = zipVerzeichnis(b);
    } catch (e) { return Promise.reject(e); }
    if (!dateien['xl/workbook.xml']) return Promise.reject(new Error('Die Datei ist keine Excel-Datei im Format .xlsx.'));
    return Promise.all([zipText(b, dateien, 'xl/workbook.xml'), zipText(b, dateien, 'xl/_rels/workbook.xml.rels'), zipText(b, dateien, 'xl/sharedStrings.xml')]).then(function (t) {
      var ziele = {}, re = /<Relationship\b([^>]*?)\/?>/g, m;
      while ((m = re.exec(t[1] || ''))) { var r = attribute(m[1]); ziele[r.Id] = r.Target; }
      var gemeinsam = [], reSi = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g;
      while ((m = reSi.exec(t[2] || ''))) gemeinsam.push(m[1] ? texte(m[1]) : '');
      var blaetter = [], reS = /<sheet\b([^>]*?)\/?>/g;
      while ((m = reS.exec(t[0]))) {
        var a = attribute(m[1]), ziel = ziele[a['r:id']];
        if (!ziel) continue;
        var pfad = ziel.charAt(0) === '/' ? ziel.slice(1) : 'xl/' + ziel.replace(/^\.\//, '');
        blaetter.push({ name: a.name || '', pfad: pfad });
      }
      return Promise.all(blaetter.map(function (bl) { return zipText(b, dateien, bl.pfad); })).then(function (xmls) {
        return blaetter.map(function (bl, i) { return { name: bl.name, zeilen: xmls[i] ? blattLesen(xmls[i], gemeinsam) : [] }; });
      });
    });
  }

  return { arbeitsmappeLesen: arbeitsmappeLesen, spalteName: spalteName };
});
