/* common.js: runs on every page (home and service pages).
   Mounts the scroll engine, drives the header menu, and runs the estimate form.
   Page-specific behaviour lives in home.js. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  ScrollCraft.mount(document.body);

  /* --------------------------------------------------------------- 5. menu */
  (function menu() {
    var bar = $("#bar"), btn = $(".bar__menu");
    if (!btn) return;
    function set(open) { bar.classList.toggle("bar--open", open); btn.setAttribute("aria-expanded", String(open)); }
    btn.addEventListener("click", function () { set(!bar.classList.contains("bar--open")); });
    $$("#bar-links a").forEach(function (a) { a.addEventListener("click", function () { set(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  })();

  /* ------------------------------------------------------ estimate dialog */
  (function dialog() {
    var dlg = $("#estimate");
    if (!dlg || typeof dlg.showModal !== "function") {
      // very old browser: send them to the phone instead of a dead button
      $$("[data-open-form]").forEach(function (b) {
        b.addEventListener("click", function () { var t = $(".bar__phone"); if (t) location.href = t.getAttribute("href"); });
      });
      return;
    }
    var form = $("form", dlg), status = $("[data-form-status]", dlg), opener = null;

    function open(e) {
      opener = e && e.currentTarget;
      status.textContent = ""; status.removeAttribute("data-state");
      dlg.showModal();
      document.documentElement.style.overflow = "hidden";
      var first = $("input[name=name]", dlg); if (first) first.focus();
    }
    function close() { dlg.close(); }
    dlg.addEventListener("close", function () {
      document.documentElement.style.overflow = "";
      if (opener && opener.focus) opener.focus();
    });
    $$("[data-open-form]").forEach(function (b) { b.addEventListener("click", open); });
    $$("[data-close-form]", dlg).forEach(function (b) { b.addEventListener("click", close); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });   // backdrop
    if (location.hash === "#estimate") open();

    function say(state, msg) { status.setAttribute("data-state", state); status.textContent = msg; }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if ($("input[name=_gotcha]", form).value) { say("ok", "Thanks."); return; }       // bot: look successful, send nothing
      if (form.getAttribute("data-demo") === "true") {
        say("err", "Demo only: this form isn't connected yet, so nothing was sent.");
        return;
      }
      var submit = $("[type=submit]", form);
      submit.disabled = true; say("", "Sending...");
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.success !== false, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error("rejected");
          say("ok", "Got it. We'll call you soon."); form.reset();
        })
        .catch(function () {
          var tel = $(".bar__phone span");
          say("err", "That didn't go through. Please call " + (tel ? tel.textContent : "us") + " instead.");
        })
        .then(function () { submit.disabled = false; });
    });
  })();
})();
