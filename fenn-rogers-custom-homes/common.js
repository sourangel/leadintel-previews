/* common.js: every page. Phone menu, "plan your build" jumps, the estimate form,
   the project lightbox and the floor plan filters. Each piece guards itself. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function safe(fn) { try { fn(); } catch (e) { if (window.console) console.error(e); } }

  /* ---------------------------------------------------------------- menu */
  safe(function () {
    var dlg = $("#menu");
    if (!dlg || typeof dlg.showModal !== "function") {
      $$("[data-open-menu]").forEach(function (b) { b.addEventListener("click", function () { location.href = "tel:"; }); });
      return;
    }
    $$("[data-open-menu]").forEach(function (b) { b.addEventListener("click", function () { dlg.showModal(); document.documentElement.style.overflow = "hidden"; }); });
    $$("[data-close-menu]", dlg).forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });
    dlg.addEventListener("close", function () { document.documentElement.style.overflow = ""; });
    $$("a", dlg).forEach(function (a) { a.addEventListener("click", function () { dlg.close(); }); });
  });

  /* ---------------------------------------- jump to the estimate form */
  safe(function () {
    var target = $("#estimate");
    if (!target) return;
    $$("[data-go-estimate]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var dlg = $("#menu"); if (dlg && dlg.open) dlg.close();
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        var first = $("input[name=name]", target);
        setTimeout(function () { if (first) first.focus({ preventScroll: true }); }, reduce ? 0 : 600);
      });
    });
  });

  /* ------------------------------------------------------------ estimate form */
  safe(function () {
    var form = $("#estimate form");
    if (!form) return;
    var status = $("[data-form-status]", form);
    function say(state, msg) { status.setAttribute("data-state", state); status.textContent = msg; }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if ($("input[name=_gotcha]", form).value) { say("ok", "Thanks."); return; }       // bot: look successful, send nothing
      if (form.getAttribute("data-demo") === "true") { say("err", "Demo only: this form isn't connected yet, so nothing was sent."); return; }
      var submit = $("[type=submit]", form);
      submit.disabled = true; say("", "Sending...");
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.success !== false }; }); })
        .then(function (res) { if (!res.ok) throw new Error("rejected"); say("ok", "Got it. We'll be in touch soon."); form.reset(); })
        .catch(function () { var t = $(".estimate__phone"); say("err", "That didn't go through. Please call " + (t ? t.textContent : "us") + " instead."); })
        .then(function () { submit.disabled = false; });
    });
  });

  /* --------------------------------------------------------------- lightbox */
  safe(function () {
    var lb = $("#lightbox"), gal = $("#gallery");
    if (!lb || !gal || typeof lb.showModal !== "function") return;
    var imgs = $$("[data-lightbox]", gal), img = $("#lbImg"), cap = $("#lbCap"), i = 0;
    function show() {
      var b = imgs[i], im = $("img", b);
      img.src = im.currentSrc || im.src; img.alt = im.alt;
      var f = b.parentNode.querySelector("figcaption"); cap.textContent = f ? f.textContent.trim() : "";
    }
    imgs.forEach(function (b, n) { b.addEventListener("click", function () { i = n; show(); lb.showModal(); }); });
    lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
    $$("[data-lb]", lb).forEach(function (b) {
      b.addEventListener("click", function () {
        var a = b.getAttribute("data-lb");
        if (a === "close") lb.close(); else { i = (i + (a === "next" ? 1 : -1) + imgs.length) % imgs.length; show(); }
      });
    });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { i = (i + 1) % imgs.length; show(); }
      if (e.key === "ArrowLeft") { i = (i - 1 + imgs.length) % imgs.length; show(); }
    });
  });

  /* ------------------------------------------------------------ plan filters */
  safe(function () {
    var list = $("#plansList");
    if (!list) return;
    var rows = $$(".plan", list), count = $("#plansCount");
    var fs = $("#f-size"), fb = $("#f-beds"), fa = $("#f-baths"), fg = $("#f-gar");
    function num(v) { var n = parseFloat(String(v).split("-")[0]); return isNaN(n) ? 0 : n; }
    function apply() {
      var size = fs.value, bMin = +fb.value || 0, baMin = +fa.value || 0, gMin = +fg.value || 0, shown = 0;
      rows.forEach(function (r) {
        var sf = +r.dataset.sf, ok = true;
        if (size) { var p = size.split("-"); ok = sf >= +p[0] && sf <= +p[1]; }
        if (ok && bMin) ok = num(r.dataset.beds) >= bMin;
        if (ok && baMin) ok = num(r.dataset.baths) >= baMin;
        if (ok && gMin) ok = num(r.dataset.gar) >= gMin;
        r.hidden = !ok; if (ok) shown++;
      });
      count.textContent = shown === 1 ? "1 plan" : shown + " plans";
    }
    [fs, fb, fa, fg].forEach(function (s) { s.addEventListener("change", apply); });
    apply();
  });
})();
