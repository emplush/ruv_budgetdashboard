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
