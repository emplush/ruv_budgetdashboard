// Bestätigung vor kritischen Aktionen (Elemente mit data-confirm).
document.addEventListener("click", function (event) {
  var target = event.target instanceof Element ? event.target.closest("[data-confirm]") : null;
  if (target && !window.confirm(target.getAttribute("data-confirm"))) {
    event.preventDefault();
  }
});
