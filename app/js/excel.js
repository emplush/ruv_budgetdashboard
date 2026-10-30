/*
 * Budgetdashboard: Excel-Dateien (.xlsx) lesen, ohne Fremdbibliothek.
 * Leseteil übernommen aus der Lernprogrammübersicht (emplush/ruv_lernprogramme_uebersicht); dazu ein einfacher Schreibteil für den Export.
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

  /* ---------- Excel schreiben (für den Export, ohne Komprimierung) ---------- */

  var CRC_TABELLE = (function () {
    var t = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(b) {
    var c = 0xffffffff;
    for (var i = 0; i < b.length; i++) c = CRC_TABELLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function utf8(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    return new Uint8Array(Buffer.from(text, 'utf8'));
  }

  /** ZIP ohne Komprimierung (Methode 0): [{ pfad, text }] -> Uint8Array */
  function zipSchreiben(dateien) {
    var teile = [], verzeichnis = [], pos = 0;
    function w16(a, o, v) { a[o] = v & 0xff; a[o + 1] = (v >>> 8) & 0xff; }
    function w32(a, o, v) { a[o] = v & 0xff; a[o + 1] = (v >>> 8) & 0xff; a[o + 2] = (v >>> 16) & 0xff; a[o + 3] = (v >>> 24) & 0xff; }
    dateien.forEach(function (d) {
      var name = utf8(d.pfad), daten = utf8(d.text), crc = crc32(daten);
      var kopf = new Uint8Array(30 + name.length);
      w32(kopf, 0, 0x04034b50); w16(kopf, 4, 20); w16(kopf, 6, 0x0800); w16(kopf, 8, 0); w16(kopf, 10, 0); w16(kopf, 12, 0x21);
      w32(kopf, 14, crc); w32(kopf, 18, daten.length); w32(kopf, 22, daten.length); w16(kopf, 26, name.length); w16(kopf, 28, 0);
      kopf.set(name, 30);
      var z = new Uint8Array(46 + name.length);
      w32(z, 0, 0x02014b50); w16(z, 4, 20); w16(z, 6, 20); w16(z, 8, 0x0800); w16(z, 10, 0); w16(z, 12, 0); w16(z, 14, 0x21);
      w32(z, 16, crc); w32(z, 20, daten.length); w32(z, 24, daten.length); w16(z, 28, name.length);
      w32(z, 42, pos); z.set(name, 46);
      teile.push(kopf, daten); verzeichnis.push(z);
      pos += kopf.length + daten.length;
    });
    var groesse = verzeichnis.reduce(function (s, z) { return s + z.length; }, 0);
    var ende = new Uint8Array(22);
    w32(ende, 0, 0x06054b50); w16(ende, 8, dateien.length); w16(ende, 10, dateien.length); w32(ende, 12, groesse); w32(ende, 16, pos);
    var alle = teile.concat(verzeichnis, [ende]), laenge = alle.reduce(function (s, t) { return s + t.length; }, 0);
    var aus = new Uint8Array(laenge), o = 0;
    alle.forEach(function (t) { aus.set(t, o); o += t.length; });
    return aus;
  }

  function xml(text) {
    return String(text).replace(/[&<>"]/g, function (z) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]; })
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  }

  /* Formate: 0 Text, 1 fett, 2 EUR, 3 EUR fett, 4 Prozent, 5 Prozent fett, 6 Kopfzeile */
  var STILE = { text: 0, fett: 1, eur: 2, eurFett: 3, prozent: 4, prozentFett: 5, kopf: 6 };

  function zelleXml(z, ref) {
    if (z === null || z === undefined || z === '') return '';
    var wert = z, stil = 0;
    if (typeof z === 'object') { wert = z.wert; stil = STILE[z.stil] || 0; }
    if (wert === null || wert === undefined || wert === '') return stil ? '<c r="' + ref + '" s="' + stil + '"/>' : '';
    if (typeof wert === 'number' && isFinite(wert)) return '<c r="' + ref + '"' + (stil ? ' s="' + stil + '"' : '') + '><v>' + wert + '</v></c>';
    return '<c r="' + ref + '" t="inlineStr"' + (stil ? ' s="' + stil + '"' : '') + '><is><t xml:space="preserve">' + xml(wert) + '</t></is></c>';
  }

  function blattXml(b) {
    var spalten = (b.breiten || []).map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('');
    var zeilen = b.zeilen.map(function (z, r) {
      return '<row r="' + (r + 1) + '">' + z.map(function (c, i) { return zelleXml(c, spalteName(i) + (r + 1)); }).join('') + '</row>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (b.kopfzeilen ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + b.kopfzeilen + '" topLeftCell="A' + (b.kopfzeilen + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '') +
      (spalten ? '<cols>' + spalten + '</cols>' : '') + '<sheetData>' + zeilen + '</sheetData></worksheet>';
  }

  /** blaetter: [{ name, breiten:[Zeichen], kopfzeilen, zeilen:[[wert | {wert, stil}]] }] -> Uint8Array (.xlsx) */
  function arbeitsmappeSchreiben(blaetter) {
    var dateien = [
      { pfad: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        blaetter.map(function (b, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
      { pfad: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { pfad: 'xl/workbook.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        blaetter.map(function (b, i) { return '<sheet name="' + xml(String(b.name).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' },
      { pfad: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        blaetter.map(function (b, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (blaetter.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { pfad: 'xl/styles.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;EUR&quot;"/><numFmt numFmtId="165" formatCode="0.0 %"/></numFmts>' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6ECF5"/></patternFill></fill></fills>' +
        '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="7"><xf xfId="0" numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf xfId="0" numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/>' +
        '<xf xfId="0" numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf xfId="0" numFmtId="164" fontId="1" fillId="0" borderId="0" applyNumberFormat="1" applyFont="1"/>' +
        '<xf xfId="0" numFmtId="165" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf xfId="0" numFmtId="165" fontId="1" fillId="0" borderId="0" applyNumberFormat="1" applyFont="1"/>' +
        '<xf xfId="0" numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' }
    ];
    blaetter.forEach(function (b, i) { dateien.push({ pfad: 'xl/worksheets/sheet' + (i + 1) + '.xml', text: blattXml(b) }); });
    return zipSchreiben(dateien);
  }

  return { arbeitsmappeLesen: arbeitsmappeLesen, arbeitsmappeSchreiben: arbeitsmappeSchreiben, spalteName: spalteName };
});
