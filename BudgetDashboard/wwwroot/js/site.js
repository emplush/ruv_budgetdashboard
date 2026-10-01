// Bestätigung vor kritischen Aktionen (Elemente mit data-confirm).
document.addEventListener("click", function (event) {
  var target = event.target instanceof Element ? event.target.closest("[data-confirm]") : null;
  if (target && !window.confirm(target.getAttribute("data-confirm"))) {
    event.preventDefault();
  }
});

// Pop-ups (dialog-Elemente): öffnen über data-open, schließen über data-close oder Klick auf den Hintergrund.
document.addEventListener("click", function (event) {
  var el = event.target instanceof Element ? event.target : null;
  if (!el) return;
  var opener = el.closest("[data-open]");
  if (opener) {
    var dlg = document.getElementById(opener.getAttribute("data-open"));
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
    return;
  }
  if (el.closest("[data-close]")) {
    var parent = el.closest("dialog");
    if (parent) parent.close();
    return;
  }
  if (el instanceof HTMLDialogElement) el.close();
});

// Auswahlfelder mit data-autosubmit senden ihr Formular sofort beim Wechsel ab.
document.addEventListener("change", function (event) {
  var el = event.target;
  if (el instanceof HTMLSelectElement && el.hasAttribute("data-autosubmit") && el.form) el.form.submit();
});

// Netto und Brutto der Budgetposition rechnen sich gegenseitig (19 % Umsatzsteuer, Faktor 1,19).
(function () {
  var net = document.getElementById("netto");
  var gross = document.getElementById("betrag");
  if (!net || !gross) return;

  function parse(text) {
    text = String(text || "").trim().replace(/\s/g, "").replace(/€|EUR/gi, "");
    if (!/^(\d{1,3}(\.\d{3})+(,\d{1,2})?|\d+(,\d{1,2})?|\d+\.\d{1,2})$/.test(text)) return null;
    var whole, frac = "", comma = text.indexOf(",");
    if (comma >= 0) { whole = text.slice(0, comma).replace(/\./g, ""); frac = text.slice(comma + 1); }
    else if (/^\d+\.\d{1,2}$/.test(text)) { var dot = text.indexOf("."); whole = text.slice(0, dot); frac = text.slice(dot + 1); }
    else whole = text.replace(/\./g, "");
    if (whole.length > 11) return null;
    var cents = parseInt(whole, 10) * 100 + (frac ? parseInt((frac + "0").slice(0, 2), 10) : 0);
    return cents > 0 ? cents : null;
  }
  function format(cents) {
    return String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + String(cents % 100).padStart(2, "0");
  }
  function link(from, to, convert) {
    from.addEventListener("input", function () {
      var cents = parse(from.value);
      to.value = cents === null ? "" : format(convert(cents));
    });
    from.addEventListener("blur", function () {
      var cents = parse(from.value);
      if (cents !== null) from.value = format(cents);
    });
  }
  link(net, gross, function (c) { return Math.floor((c * 119 + 50) / 100); });
  link(gross, net, function (c) { return Math.floor((c * 100 + 59) / 119); });
})();
