/* site.js: this page's own behaviour. The engine (scrollcraft.js) drives acts;
   everything here is page-local and reads the engine's --sc-p, never edits it.

   1. mount the engine
   2. the slab: drag a trowel across raw concrete to finish it   (hero)
   3. the pour clock: workable time, driven by act progress      (signature move)
   4. the wipe handle on the Turn
   5. menu + estimate dialog + form                              (template plumbing)
*/
(function () {
  "use strict";

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /* ------------------------------------------------------------ 1. engine */
  ScrollCraft.mount(document.body);

  /* --------------------------------------------------------------- 2. slab */
  (function slab() {
    var cv = $("#slab"), hint = $("#hint");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var W = cv.width, H = cv.height;

    var rough = new Image(), fine = new Image(), loaded = 0;
    rough.src = "assets/slab-rough.webp"; fine.src = "assets/slab-smooth.webp";
    rough.onload = fine.onload = function () { if (++loaded === 2) start(); };

    var mask = document.createElement("canvas"); mask.width = W; mask.height = H;
    var mctx = mask.getContext("2d");
    var tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H;
    var tctx = tmp.getContext("2d");
    var probe = document.createElement("canvas"); probe.width = 32; probe.height = 18;
    var pctx = probe.getContext("2d", { willReadFrequently: true });

    var dirty = false, userStamps = 0, played = false, done = false, introRunning = false;

    function paint() {
      ctx.drawImage(rough, 0, 0, W, H);
      tctx.globalCompositeOperation = "copy";
      tctx.drawImage(fine, 0, 0, W, H);
      tctx.globalCompositeOperation = "destination-in";
      tctx.drawImage(mask, 0, 0);
      ctx.drawImage(tmp, 0, 0);
      dirty = false;
    }

    // A trowel is a wide flat blade, so the brush is a soft ellipse.
    function stamp(x, y) {
      mctx.save();
      mctx.translate(x, y);
      mctx.scale(1.7, 0.75);
      var r = 78;
      var g = mctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = g;
      mctx.beginPath(); mctx.arc(0, 0, r, 0, Math.PI * 2); mctx.fill();
      mctx.restore();
      dirty = true;
    }
    function line(x0, y0, x1, y1) {
      var n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 22));
      for (var i = 1; i <= n; i++) stamp(lerp(x0, x1, i / n), lerp(y0, y1, i / n));
    }

    function coverage() {
      pctx.clearRect(0, 0, 32, 18);
      pctx.drawImage(mask, 0, 0, 32, 18);
      // only the part of the slab the visitor can see: the far edge is cropped by the
      // tilt, so measuring the whole canvas would make "finished" unreachable
      var d = pctx.getImageData(0, 0, 32, 18).data, sum = 0, n = 0;
      for (var row = 7; row < 17; row++) for (var col = 5; col < 27; col++) {
        sum += d[(row * 32 + col) * 4 + 3] > 70 ? 1 : 0; n++;
      }
      return sum / n;
    }

    function frame() {
      if (dirty) paint();
      requestAnimationFrame(frame);
    }

    function setHint(on, text) {
      if (!hint) return;
      if (text) { hint.textContent = text; hint.setAttribute("aria-hidden", "true"); }
      hint.classList.toggle("is-on", !!on);
    }

    // pointer: offsetX/Y are in the canvas's own (untransformed) CSS pixels even
    // though the slab is tilted in 3D, which is exactly what we need.
    var last = null;
    function toCanvas(e) { return [e.offsetX * W / cv.clientWidth, e.offsetY * H / cv.clientHeight]; }
    cv.addEventListener("pointerdown", function (e) { last = toCanvas(e); stamp(last[0], last[1]); begin(); });
    cv.addEventListener("pointerup", function () { last = null; });
    cv.addEventListener("pointerleave", function () { last = null; });
    cv.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" && e.buttons === 0 && !last) return;
      var p = toCanvas(e);
      if (last) line(last[0], last[1], p[0], p[1]); else stamp(p[0], p[1]);
      last = e.pointerType === "mouse" ? p : p;
      begin();
    });
    function begin() {
      userStamps++;
      if (!played) { played = true; hint && hint.classList.add("is-played"); }
      if (!done && userStamps % 10 === 0 && coverage() > 0.6) {
        done = true;
        if (hint) { hint.classList.remove("is-played"); hint.classList.add("is-done"); }
        setHint(true, "Nice trowel work. Now watch the pros.");
      }
    }

    function intro() {
      if (reduce) {
        // static: a diagonal band already finished, nothing moves
        for (var i = 0; i <= 40; i++) stamp(lerp(W * 0.1, W * 0.9, i / 40), lerp(H * 0.82, H * 0.3, i / 40));
        paint(); setHint(true); return;
      }
      introRunning = true;
      var passes = [[0.06, 0.8, 0.94, 0.8], [0.94, 0.6, 0.06, 0.6], [0.06, 0.4, 0.94, 0.4]];
      var t0 = performance.now(), T = 2600, lx = null, ly = null;
      (function step(now) {
        if (played) { introRunning = false; return; }          // the visitor took over
        var t = clamp((now - t0) / T, 0, 1) * passes.length;
        var pi = Math.min(passes.length - 1, Math.floor(t)), u = t - pi, P = passes[pi];
        var x = lerp(P[0], P[2], u) * W, y = (lerp(P[1], P[3], u) + Math.sin(u * 9) * 0.025) * H;
        if (lx !== null) line(lx, ly, x, y);
        lx = x; ly = y;
        if (t < passes.length) requestAnimationFrame(step);
        else { introRunning = false; setHint(true); }
      })(t0);
    }

    function start() {
      paint();
      requestAnimationFrame(frame);
      setTimeout(intro, reduce ? 0 : 600);
    }
  })();

  /* -------------------------------------------------------- 3. pour clock */
  (function clock() {
    var tag = $("[data-clock-tag]");
    if (!tag) return;
    var acts = { stakes: $("#stakes"), wrong: $("#wrong"), turn: $("#turn"), how: $("#how") };
    var close = $("#contact");
    var timeEls = $$("[data-clock-time]"), bar = $("[data-clock-bar]"), stateEl = $("[data-clock-state]");
    var P = function (el) { return el ? parseFloat(el.style.getPropertyValue("--sc-p")) || 0 : 0; };
    var lastKey = "";

    function fmt(m) {
      var s = Math.max(0, Math.round(m * 60));
      return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }

    function read() {
      var stakes = P(acts.stakes), wrong = P(acts.wrong), turn = P(acts.turn), how = P(acts.how);
      var closing = close && close.getBoundingClientRect().top < innerHeight * 0.6;
      var m = 90, state = "Truck's on site", mood = "", text = null, hide = false;

      if (closing) { text = "CURED"; m = 90; state = "Ready for you"; mood = "done"; }
      else if (how >= 0.995) { m = 22; state = "Finished with time to spare"; mood = "done"; hide = true; }
      else if (how > 0) {
        var h = smooth(how / 0.8);
        m = lerp(90, 22, h);
        state = how < 0.7 ? "Pouring on schedule" : "Finished with time to spare";
        mood = how >= 0.7 ? "done" : "";
      }
      else if (turn > 0) {
        var r = smooth((turn - 0.45) / 0.3);
        m = lerp(0, 90, r);
        if (r < 0.05) { state = "Set. Too late."; mood = "late"; }
        else { state = "New truck, fresh start"; }
      }
      else if (wrong > 0) {
        m = lerp(45, 0, smooth(wrong / 0.85));
        if (wrong >= 0.85) { state = "Set before they finished"; mood = "late"; }
        else if (wrong > 0.4) { state = "Rushing it"; mood = "late"; }
        else state = "Clock's running";
      }
      else if (stakes > 0) { m = lerp(90, 45, stakes); state = "Clock's running"; }

      var shown = text || fmt(m);
      var key = shown + "|" + state + "|" + mood + "|" + hide;
      if (key === lastKey) return;
      lastKey = key;
      timeEls.forEach(function (el) { el.textContent = shown; });
      stateEl.textContent = state;
      if (mood) tag.setAttribute("data-mood", mood); else tag.removeAttribute("data-mood");
      tag.setAttribute("data-hide", hide ? "true" : "false");
      bar.style.transform = "scaleX(" + (text ? 1 : clamp(m / 90, 0, 1)).toFixed(3) + ")";
    }
    (function loop() { read(); requestAnimationFrame(loop); })();
  })();

  /* ------------------------------------------------------- 4. wipe handle */
  (function turnHandle() {
    var el = $("#turn");
    if (!el || reduce) return;
    (function loop() {
      var p = parseFloat(el.style.getPropertyValue("--sc-p")) || 0;
      // same window and easing the engine uses for data-sc-reveal-at="0.12 0.7"
      el.style.setProperty("--turn-x", smooth((p - 0.12) / (0.7 - 0.12)).toFixed(4));
      requestAnimationFrame(loop);
    })();
  })();

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
