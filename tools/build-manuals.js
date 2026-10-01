// Erzeugt die PDF-Fassungen der Handbücher aus BudgetDashboard/Manuals/*.html.
// Aufruf: node tools/build-manuals.js   (benötigt Node und das Paket "playwright" mit Chromium)
// Die HTML-Dateien sind die einzige Quelle. Nach jeder Änderung an App oder Handbuch neu ausführen.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manuals = path.join(root, 'BudgetDashboard', 'Manuals');
const wwwroot = path.join(root, 'BudgetDashboard', 'wwwroot');

let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules', 'playwright')); }

const list = [
  ['nutzer', 'Handbuch für Nutzende'],
  ['abteilungsleitung', 'Handbuch für die Abteilungsleitung'],
  ['admin', 'Handbuch für die Administration'],
];
const logoPath = fs.readFileSync(path.join(wwwroot, 'favicon.svg'), 'utf8').match(/<path[^>]*d="([^"]*)"/)[1];
const css = fs.readFileSync(path.join(wwwroot, 'css', 'site.css'), 'utf8').replace(/url\("\.\.\/fonts\//g, 'url("file://' + path.join(wwwroot, 'fonts') + '/');

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  for (const [key, title] of list) {
    const body = fs.readFileSync(path.join(manuals, key + '.html'), 'utf8');
    const html = `<!doctype html><html lang="de" data-theme="hell"><head><meta charset="utf-8"><title>${title}</title><style>${css}
      body{display:block;min-height:0}.manual{max-width:none}.pdf-head{display:flex;align-items:center;gap:20px;background:#001957;color:#fff;padding:18px 24px;margin:0 0 24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .pdf-head svg{height:40px;width:auto}.pdf-head h1{font:700 22px/1.2 var(--font-sans);margin:0}.pdf-head p{margin:2px 0 0;font-size:13px;color:#f79506}
      .manual h2{break-after:avoid}.manual h3{break-after:avoid}.manual table,.manual .callout,.manual .toc{break-inside:avoid}
      .manual th{-webkit-print-color-adjust:exact;print-color-adjust:exact}.manual tbody tr:nth-child(even){background:#fff4e0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .manual .toc{background:#fff4e0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .manual a{color:#001957}.manual{font-size:13.5px;line-height:21px}.manual h2{font-size:22px;margin-top:28px}.manual h3{font-size:16px;margin-top:18px}
    </style></head><body><div class="pdf-head"><svg viewBox="42.5 42.5 104.9 42.6" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="${logoPath}"/></svg><div><h1>Budget-Dashboard 2.0 · ${title}</h1></div></div><article class="manual" style="padding:0 24px">${body}</article></body></html>`;
    const page = await browser.newPage();
    const tmp = path.join(require('os').tmpdir(), 'handbuch-' + key + '.html');
    fs.writeFileSync(tmp, html);
    await page.goto('file://' + tmp, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: path.join(manuals, key + '.pdf'), format: 'A4', printBackground: true,
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font:9px Arial;color:#707070;padding:0 12mm;display:flex;justify-content:space-between"><span>Budget-Dashboard 2.0 · ${title}</span><span>Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span></div>`,
    });
    await page.close();
    console.log('PDF erzeugt:', key + '.pdf');
  }
  await browser.close();
})();
