/* home.js: behaviour that belongs to the home page only. Reads the engine's
   --sc-p from each act; never edits the engine.

   1. the aerial slab: drag a trowel across fresh concrete       (hero)
   2. the dive: scroll flies the drone straight into the slab    (hero to stakes)
   3. the pour clock: workable time, driven by act progress      (signature move)
   4. the wipe handle on the rushed-vs-right driveway            (turn)
   5. testimonial bubbles that open on hover, tap or focus       (reviews)
*/
(function () {
  "use strict";

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var pOf = function (el) { return el ? parseFloat(el.style.getPropertyValue("--sc-p")) || 0 : 0; };

  /* ------------------------------------------------------------- 1. slab */
  (function slab() {
    var cv = $("#slab"), hint = $("#hint");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var W = cv.width, H = cv.height;

    var raw = new Image(), fine = new Image(), loaded = 0;
    raw.src = "assets/slab-raw.webp"; fine.src = "assets/slab-fine.webp";
    raw.onload = fine.onload = function () { if (++loaded === 2) start(); };

    var mask = document.createElement("canvas"); mask.width = W; mask.height = H;
    var mctx = mask.getContext("2d");
    var tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H;
    var tctx = tmp.getContext("2d");
    var probe = document.createElement("canvas"); probe.width = 32; probe.height = 16;
    var pctx = probe.getContext("2d", { willReadFrequently: true });

    var dirty = false, userStamps = 0, played = false, done = false;

    // draw an image to fill the canvas without stretching it
    function cover(c, img) {
      var s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      var w = img.naturalWidth * s, h = img.naturalHeight * s;
      c.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }
    function paint() {
      cover(ctx, raw);                                   // fresh, screeded, unfinished
      tctx.globalCompositeOperation = "copy"; cover(tctx, fine);
      tctx.globalCompositeOperation = "destination-in"; tctx.drawImage(mask, 0, 0);
      ctx.drawImage(tmp, 0, 0);                          // the troweled finish, where you've been
      dirty = false;
    }

    // A trowel is a wide flat blade, so the brush is a soft ellipse.
    function stamp(x, y) {
      mctx.save();
      mctx.translate(x, y);
      mctx.scale(1.8, 0.8);
      var r = 64;
      var g = mctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = g;
      mctx.beginPath(); mctx.arc(0, 0, r, 0, Math.PI * 2); mctx.fill();
      mctx.restore();
      dirty = true;
    }
    function line(x0, y0, x1, y1) {
      var n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 20));
      for (var i = 1; i <= n; i++) stamp(lerp(x0, x1, i / n), lerp(y0, y1, i / n));
    }
    function coverage() {
      pctx.clearRect(0, 0, 32, 16);
      pctx.drawImage(mask, 0, 0, 32, 16);
      var d = pctx.getImageData(0, 0, 32, 16).data, sum = 0, n = 0;
      for (var row = 1; row < 15; row++) for (var col = 1; col < 31; col++) {
        sum += d[(row * 32 + col) * 4 + 3] > 70 ? 1 : 0; n++;
      }
      return sum / n;
    }
    function frame() { if (dirty) paint(); requestAnimationFrame(frame); }
    function setHint(on, text) {
      if (!hint) return;
      if (text) hint.textContent = text;
      hint.classList.toggle("is-on", !!on);
    }

    // offsetX/Y are in the canvas's own CSS pixels even when the world is scaled or rotated.
    var last = null;
    function toCanvas(e) { return [e.offsetX * W / cv.clientWidth, e.offsetY * H / cv.clientHeight]; }
    cv.addEventListener("pointerdown", function (e) { last = toCanvas(e); stamp(last[0], last[1]); begin(); });
    cv.addEventListener("pointerup", function () { last = null; });
    cv.addEventListener("pointerleave", function () { last = null; });
    cv.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" && e.buttons === 0 && !last) return;
      var p = toCanvas(e);
      if (last) line(last[0], last[1], p[0], p[1]); else stamp(p[0], p[1]);
      last = p;
      begin();
    });
    function begin() {
      userStamps++;
      if (!played) { played = true; hint && hint.classList.add("is-played"); }
      if (!done && userStamps % 10 === 0 && coverage() > 0.55) {
        done = true;
        if (hint) { hint.classList.remove("is-played"); hint.classList.add("is-done"); }
        setHint(true, "Nice trowel work. Now see why timing matters.");
      }
    }

    function intro() {
      if (reduce) {                                       // static: a finished band, nothing moves
        for (var i = 0; i <= 40; i++) stamp(lerp(W * 0.1, W * 0.9, i / 40), lerp(H * 0.8, H * 0.3, i / 40));
        paint(); setHint(true); return;
      }
      var passes = [[0.06, 0.78, 0.94, 0.78], [0.94, 0.5, 0.06, 0.5], [0.06, 0.22, 0.94, 0.22]];
      var t0 = performance.now(), T = 2800, lx = null, ly = null;
      (function step(now) {
        if (played) return;                               // the visitor took over
        var t = clamp((now - t0) / T, 0, 1) * passes.length;
        var pi = Math.min(passes.length - 1, Math.floor(t)), u = t - pi, P = passes[pi];
        var x = lerp(P[0], P[2], u) * W, y = (lerp(P[1], P[3], u) + Math.sin(u * 9) * 0.03) * H;
        if (lx !== null) line(lx, ly, x, y);
        lx = x; ly = y;
        if (t < passes.length) requestAnimationFrame(step); else setHint(true);
      })(t0);
    }
    function start() { paint(); requestAnimationFrame(frame); setTimeout(intro, reduce ? 0 : 600); }
  })();

  /* -------------------------------------------------------------- 2. dive */
  (function dive() {
    var hero = $("#top"), world = $("[data-world]"), dark = $("[data-dark]"), hint = $("#hint");
    if (!hero || !world || reduce) return;
    var lastKey = "";
    (function loop() {
      var p = pOf(hero);
      // 0 to 0.26: the drone hovers. 0.26 to 0.88: it falls straight down into the slab.
      var d = clamp((p - 0.26) / 0.62, 0, 1);
      var e = Math.pow(d, 2.1);                           // accelerates, like a fall
      var hover = clamp(p / 0.26, 0, 1);
      var s = Math.exp(lerp(Math.log(1 + 0.04 * hover), Math.log(12), e));
      var rot = -5 * e;
      var black = smooth((p - 0.5) / 0.36);
      if (hint) hint.classList.toggle("is-gone", p > 0.16);   // the sticker goes once you start falling
      var key = s.toFixed(3) + "|" + black.toFixed(3);
      if (key !== lastKey) {
        lastKey = key;
        world.style.transform = "rotate(" + rot.toFixed(2) + "deg) scale(" + s.toFixed(3) + ")";
        dark.style.setProperty("--d", black.toFixed(3));
      }
      requestAnimationFrame(loop);
    })();
  })();

  /* ------------------------------------------------------- 3. pour clock */
  (function clock() {
    var tag = $("[data-clock-tag]");
    if (!tag) return;
    var acts = { stakes: $("#stakes"), wrong: $("#wrong"), turn: $("#turn"), how: $("#how") };
    var close = $("#contact");
    var timeEls = $$("[data-clock-time]"), bar = $("[data-clock-bar]"), stateEl = $("[data-clock-state]");
    var lastKey = "";

    function fmt(m) {
      var s = Math.max(0, Math.round(m * 60));
      return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }
    function read() {
      var stakes = pOf(acts.stakes), wrong = pOf(acts.wrong), turn = pOf(acts.turn), how = pOf(acts.how);
      var closing = close && close.getBoundingClientRect().top < innerHeight * 0.6;
      var m = 90, state = "Truck's on site", mood = "", text = null, hide = false;

      if (closing) { text = "CURED"; m = 90; state = "Ready for you"; mood = "done"; }
      else if (how >= 0.995) { m = 22; state = "Finished with time to spare"; mood = "done"; hide = true; }
      else if (how > 0) {
        m = lerp(90, 22, smooth(how / 0.8));
        state = how < 0.7 ? "Pouring on schedule" : "Finished with time to spare";
        mood = how >= 0.7 ? "done" : "";
      }
      else if (turn > 0) {
        var r = smooth((turn - 0.45) / 0.3);
        m = lerp(0, 90, r);
        if (r < 0.05) { state = "Set. Too late."; mood = "late"; } else state = "New truck, fresh start";
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

  /* ------------------------------------------------------ 4. wipe handle */
  (function turnHandle() {
    var el = $("#turn");
    if (!el || reduce) return;
    (function loop() {
      // same window and easing the engine uses for data-sc-reveal-at="0.12 0.7"
      el.style.setProperty("--turn-x", smooth((pOf(el) - 0.12) / (0.7 - 0.12)).toFixed(4));
      requestAnimationFrame(loop);
    })();
  })();

  /* ------------------------------------------------------- 5. bubbles */
  (function bubbles() {
    var box = $("[data-bubbles]");
    if (!box) return;
    var bubs = $$(".bub", box);

    // keep the opened card on screen: shift it away from the viewport edges
    function place(b) {
      var card = $(".bub__card", b), r = b.getBoundingClientRect();
      var half = Math.min(176, innerWidth * 0.43), halfH = Math.min(150, innerHeight * 0.4);
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = 0, dy = 0, m = 12;
      if (cx - half < m) dx = m - (cx - half);
      if (cx + half > innerWidth - m) dx = innerWidth - m - (cx + half);
      if (cy - halfH < 72) dy = 72 - (cy - halfH);
      if (cy + halfH > innerHeight - m) dy = innerHeight - m - (cy + halfH);
      card.style.setProperty("--sx", dx.toFixed(0) + "px");
      card.style.setProperty("--sy", dy.toFixed(0) + "px");
    }
    function openOnly(b) {
      bubs.forEach(function (o) { o.classList.toggle("is-open", o === b); });
      box.classList.toggle("has-open", !!b);
      if (b) place(b);
    }
    bubs.forEach(function (b) {
      b.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") openOnly(b); });
      b.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") openOnly(null); });
      // Focus opens a bubble for KEYBOARD users only. A tap also focuses the bubble, which used to
      // open it and then let the tap's own click close it again, so touch looked dead.
      b.addEventListener("focus", function () { if (b.matches(":focus-visible")) openOnly(b); });
      b.addEventListener("blur", function () { if (b.classList.contains("is-open")) openOnly(null); });
      b.addEventListener("click", function (e) {
        if (e.pointerType === "mouse") return;            // hover already handles the mouse
        openOnly(b.classList.contains("is-open") ? null : b);
        e.stopPropagation();
      });
      b.addEventListener("keydown", function (e) { if (e.key === "Escape") { openOnly(null); b.blur(); } });
    });
    document.addEventListener("click", function () { openOnly(null); });
  })();
})();
