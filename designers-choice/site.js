/* Designer's Choice Custom Homes: the continuous world.
   One fixed stage, ten stills of one lot, one camera. Scroll is the clock.
   The gold level line climbs the frame and the next stage of the house is
   built in its wake; the job card stamps each stage as the line passes it.
   Nothing here edits the scroll-craft engine: this page is bespoke. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const sine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x));

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const mqPortrait = matchMedia('(max-aspect-ratio: 1/1)');
  let reduce = mqReduce.matches;
  let fine = mqFine.matches;

  /* ------------------------------------------------------------ timeline
     Units are viewport heights of scroll. Stage 0 (the bare lot) is held, then
     legs 0 to 7 build stages 1 to 8 under the gold level line (stills that are
     edits of one another). Leg 8 is the drone lift: a real clip scrubbed by the
     wheel that rises over the finished house and reveals the backyard. Leg 9
     is the sunset dissolve, the peak, followed by the closing hold. */
  const LEG = 0.85, LIFT = 2.3, DUSK = 1.7;
  const HOLD = [0.9, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.5, 0.12];   // before leg i
  const LEN = [LEG, LEG, LEG, LEG, LEG, LEG, LEG, LEG, LIFT, DUSK];
  const END_HOLD = 1.3;
  const NL = LEN.length;            // 10 legs
  const N = 10;                     // 10 pole stages (0 to 9)
  const holdStart = [], legStart = [], legEnd = [];
  let total = 0;
  for (let i = 0; i < NL; i++) {
    holdStart[i] = total; total += HOLD[i];
    legStart[i] = total; total += LEN[i]; legEnd[i] = total;
  }
  total += END_HOLD;
  const STAGE_NAMES = ['Your lot', 'Dirt work', 'Footings', 'Plumbing', 'The slab', 'Framing', 'Roof trusses', 'Tile roof', 'Stucco and finishes', 'Home'];

  /* ------------------------------------------------------------- elements */
  const cam = $('#cam');
  const layers = $$('.layer:not(.layer--video)');
  const vid = $('#lift');
  const imgs = layers.map((l) => $('img', l));
  const level = $('#level');
  const haze = $('#haze');
  const glow = $('#glow');
  const warmEl = $('#warm');
  const fg = $('#fg');
  const fgL = $('.fg__l');
  const fgR = $('.fg__r');
  const spacer = $('#spacer');
  const beats = $$('.beat');
  const pole = $('#pole');
  const poleFill = $('#poleFill');
  const poleRows = $$('.pole__row');
  const live = $('#live');
  const root = document.documentElement;

  /* ---------------------------------------------------------- image sets */
  let setKey = '';
  let vidSrc = 'assets/lift.mp4';
  function pickSet() {
    const key = mqPortrait.matches ? 'm' : 's';
    if (key === setKey) return;
    setKey = key;
    imgs.forEach((img, i) => {
      const src = `assets/${key}${layers[i].dataset.n}.webp`;
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      layers[i].style.setProperty('--bg', `url(${src})`);
    });
    vidSrc = key === 's' ? 'assets/lift.mp4' : 'assets/lift-m.mp4';
    if (vid && vid.dataset.loaded) { vid.dataset.loaded = ''; vidLoad(); }
  }
  pickSet();
  mqPortrait.addEventListener('change', pickSet);

  // Stage 0 paints first; the rest arrive in build order while the visitor reads.
  function warm() {
    const q = imgs.map((_, i) => i).slice(1);
    const next = () => {
      const i = q.shift();
      if (i === undefined) return;
      const im = new Image();
      im.decoding = 'async';
      im.onload = im.onerror = () => setTimeout(next, 60);
      im.src = imgs[i].getAttribute('src');
    };
    next(); next();
  }
  if (document.readyState === 'complete') warm(); else addEventListener('load', warm, { once: true });

  /* ------------------------------------------------------------- measure */
  let vh = innerHeight || 800;
  let vw = innerWidth || 1280;
  function layout() {
    vh = innerHeight || document.documentElement.clientHeight || 800;
    vw = innerWidth || document.documentElement.clientWidth || 1280;
    spacer.style.height = Math.round((total + 1) * vh) + 'px';
    // empty band above/below a contained 9:16 still on tall phones (see site.css)
    const gap = Math.max(0, 1 - (vw / 0.5625) / vh) * 100;
    root.style.setProperty('--gt', (gap * 0.74).toFixed(2) + '%');
    root.style.setProperty('--gb', (gap * 0.26).toFixed(2) + '%');
    target = scrollY / vh;
  }

  /* ------------------------------------------------------------- beat windows
     Copy is windowed against the whole track: it ramps in, holds on a plateau,
     ramps out. The only transform is a drift capped at 4vh across the window. */
  const NB = beats.length;                       // 11: hero, 8 build beats, backyard, close
  const wins = beats.map((el, i) => {
    let from, to, rInV = 0.17, rOutV = 0.17;
    if (i === 0) { from = 0; to = legStart[0] + 0.34 * LEG; rInV = 0; rOutV = 0.2; }
    else if (i <= 7) { from = legStart[i - 1] + 0.4 * LEG; to = legStart[i] + 0.2 * LEG; }
    else if (i === 8) { from = legStart[7] + 0.4 * LEG; to = legStart[8] + 0.12 * LIFT; }
    else if (i === 9) { from = legStart[8] + 0.52 * LIFT; to = legEnd[8] + 0.18; }
    else { from = legStart[9] + 0.5 * DUSK; to = total + 0.01; rInV = 0.34; rOutV = 0; }
    return { el, from, to, len: to - from, rInV, rOutV, state: -1, last: -1 };
  });

  function renderBeats(t) {
    for (const w of wins) {
      let v;
      if (t < w.from) v = 0;
      else if (t < w.from + w.rInV) v = w.rInV ? smooth((t - w.from) / w.rInV) : 1;
      else if (t <= w.to - w.rOutV) v = 1;
      else v = w.rOutV ? smooth(1 - (t - (w.to - w.rOutV)) / w.rOutV) : 1;
      if (t > w.to) v = 0;
      if (w.el === beats[NB - 1] && t >= w.from) v = Math.max(v, smooth((t - w.from) / 0.34));
      v = clamp(v);
      const wp = clamp((t - w.from) / w.len);
      const dy = reduce ? 0 : (0.5 - wp) * 4;
      const key = v.toFixed(3) + '|' + dy.toFixed(2);
      if (key !== w.last) {
        w.last = key;
        w.el.style.opacity = v.toFixed(3);
        w.el.style.transform = reduce || w.el === beats[NB - 1] ? 'none' : `translate3d(0, ${dy.toFixed(2)}vh, 0)`;
      }
      const on = v > 0.5;
      if (on !== (w.state === 1)) {
        w.state = on ? 1 : 0;
        w.el.style.pointerEvents = on ? 'auto' : 'none';
        w.el.toggleAttribute('inert', !on);
      }
    }
  }

  /* ----------------------------------------------------------------- world */
  const layerState = layers.map(() => '');
  function setLayer(i, vis, op, clip) {
    const key = vis + '|' + op + '|' + clip;
    if (layerState[i] === key) return;
    layerState[i] = key;
    const el = layers[i];
    el.style.visibility = vis ? 'visible' : 'hidden';
    el.style.opacity = op;
    el.style.clipPath = clip;
  }

  /* the drone clip loads when the visitor is close, never before */
  let vidState = 'idle';   // idle | loading | ready | failed
  function vidLoad() {
    if (!vid || vidState === 'loading' || vidState === 'ready' || reduce) return;
    vidState = 'loading';
    vid.muted = true; vid.playsInline = true; vid.preload = 'auto';
    vid.addEventListener('loadeddata', () => { vidState = 'ready'; vid.dataset.loaded = '1'; vidLast = -1; kick(); }, { once: true });
    vid.addEventListener('error', () => { vidState = 'failed'; }, { once: true });
    vid.src = vidSrc;
    vid.load();
  }
  let vidLast = -1;
  function vidSeek(p) {
    if (vidState !== 'ready' || !vid.duration) return;
    const tt = clamp(p) * (vid.duration - 0.04);
    if (Math.abs(tt - vidLast) < 0.012) return;
    vidLast = tt;
    try { vid.currentTime = tt; } catch (e) {}
  }
  const vidStyle = { v: '', o: '' };
  function setVid(show, op) {
    const v = show ? 'visible' : 'hidden', o = op.toFixed(3);
    if (v !== vidStyle.v) { vid.style.visibility = v; vidStyle.v = v; }
    if (o !== vidStyle.o) { vid.style.opacity = o; vidStyle.o = o; }
  }

  function renderWorld(t) {
    let k = -1;
    for (let i = 0; i < NL; i++) if (t >= legStart[i]) k = i;
    const p = k < 0 ? 0 : clamp((t - legStart[k]) / LEN[k]);
    const inFlight = k >= 0 && p < 1;
    let lineY = -1, lineOp = 0;

    if (t > legStart[7] - 2.4) vidLoad();

    if (k <= 7) {
      // build legs: stage j is the newest one fully revealed; leg j builds stage j + 1
      const revealed = k < 0 ? 0 : (inFlight ? k : k + 1);
      for (let j = 0; j < 11; j++) {
        if (j > 8) setLayer(j, false, 1, 'none');
        else if (j < revealed) setLayer(j, false, 1, 'none');
        else if (j === revealed) setLayer(j, true, 1, 'none');
        else if (j === revealed + 1 && inFlight) {
          if (reduce) setLayer(j, true, smooth(p).toFixed(3), 'none');
          else {
            const top = (1 - sine(p)) * 100;
            setLayer(j, true, 1, 'inset(' + top.toFixed(3) + '% 0 0 0)');
            lineY = top / 100 * vh;
            lineOp = clamp(Math.min(p / 0.05, (1 - p) / 0.05));
          }
        } else setLayer(j, false, 1, 'none');
      }
      setVid(false, 0);
    } else if (k === 8) {
      // the lift: a real clip under the wheel, with the stills catching both ends
      for (let j = 0; j < 9; j++) setLayer(j, j === 8 && p < 1, 1, 'none');
      const useClip = !reduce && vidState === 'ready';
      if (useClip) {
        vidSeek(p);
        setVid(p > 0.004 && p < 1, smooth(p / 0.035));
        setLayer(9, p > 0.94, smooth((p - 0.94) / 0.06).toFixed(3), 'none');
      } else {
        setVid(false, 0);
        setLayer(9, p > 0, smooth(p).toFixed(3), 'none');
      }
      setLayer(10, false, 1, 'none');
      if (p >= 1) setLayer(8, false, 1, 'none');
    } else {
      for (let j = 0; j < 9; j++) setLayer(j, false, 1, 'none');
      setVid(false, 0);
      setLayer(9, p < 1, 1, 'none');
      setLayer(10, p > 0, (p >= 1 ? 1 : smooth((p - 0.04) / 0.9)).toFixed(3), 'none');
    }

    if (lineY >= 0) {
      level.style.opacity = lineOp.toFixed(3);
      level.style.transform = 'translate3d(0,' + lineY.toFixed(1) + 'px,0)';
    } else if (level.style.opacity !== '0') {
      level.style.opacity = '0';
    }

    warmEl.style.opacity = reduce ? '0' : (k === 9 ? Math.sin(Math.PI * p) * 0.55 : 0).toFixed(3);
    return { k, p };
  }

  /* -------------------------------------------------------- camera + depth */
  let px = 0, py = 0, tpx = 0, tpy = 0;
  function renderCamera(t) {
    const prog = clamp(t / legEnd[7]);
    const s = reduce ? 1 : 1 + 0.045 * prog;
    const x = reduce ? 0 : px * -10;
    const y = reduce ? 0 : py * -6;
    cam.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;

    // foreground plants: nearest plane, fastest, they leave as the grading begins
    const f = clamp(t / (legStart[0] + LEG * 0.8));
    const out = smooth((f - 0.35) / 0.65);
    const fx = reduce ? 0 : px * 22;
    const fy = reduce ? 0 : py * 10;
    fg.style.opacity = (1 - out).toFixed(3);
    fg.style.visibility = out >= 1 ? 'hidden' : 'visible';
    const e = f * f;
    if (!reduce) {
      fgL.style.transform = `translate3d(${(-e * 24 + fx).toFixed(2)}vw, ${(e * 12 + fy).toFixed(2)}vh, 0) scale(${(1 + f * 0.4).toFixed(3)})`;
      fgR.style.transform = `translate3d(${(e * 24 + fx).toFixed(2)}vw, ${(e * 12 + fy).toFixed(2)}vh, 0) scale(${(1 + f * 0.4).toFixed(3)})`;
    } else {
      fgL.style.transform = fgR.style.transform = 'none';
    }

    // the dust that rises while the land is cut, thinning to almost nothing
    let amt;
    if (t < legStart[0]) amt = 0.28 + 0.22 * (t / legStart[0]);
    else if (t < legStart[1]) amt = 0.5 + 0.5 * Math.sin(clamp((t - legStart[0]) / LEG) * Math.PI);
    else if (t < legStart[3]) amt = 0.5 * (1 - smooth((t - legStart[1]) / (legStart[3] - legStart[1]))) + 0.2;
    else amt = t < legStart[8] ? 0.2 : 0.1;
    dust.amt = amt;
    dust.dusk = t > legStart[9] ? clamp((t - legStart[9]) / DUSK) : 0;
    haze.style.opacity = reduce ? '0' : (Math.max(0, amt - 0.22) * 0.9).toFixed(3);
  }

  /* ------------------------------------------------------------------ pole */
  let curStage = -1;
  function renderPole(t, k, p) {
    // stage j (1 to 8) is stamped when the leg that built it completes; Home when the lift lands
    let stamped = 0;
    for (let j = 1; j < N; j++) if (t >= legEnd[j - 1] - 0.0001) stamped = j;
    let now = 0;
    for (let j = 1; j < N; j++) if (t >= legStart[j - 1] + 0.5 * LEN[j - 1]) now = j;
    const s = k < 0 ? 0 : Math.min(N - 1, k + p);
    poleFill.style.setProperty('--fill', (s / (N - 1)).toFixed(4));
    poleRows.forEach((row) => {
      const j = +row.dataset.stage;
      const isDone = j <= stamped && (j > 0 || stamped >= 1);
      const was = row.classList.contains('is-done');
      row.classList.toggle('is-done', isDone);
      row.classList.toggle('is-now', j === now);
      if (isDone && !was && !reduce) {
        row.classList.add('is-stamping');
        setTimeout(() => row.classList.remove('is-stamping'), 220);
      }
      if (isDone) row.setAttribute('aria-current', j === now ? 'step' : 'false'); else row.removeAttribute('aria-current');
    });
    pole.classList.toggle('is-signed', t >= legEnd[9] - 0.25);
    if (now !== curStage) {
      curStage = now;
      live.textContent = STAGE_NAMES[now];
    }
  }

  /* ------------------------------------------------------------- dust motes */
  const dust = { amt: 0.3, dusk: 0, cv: $('#dust'), ctx: null, pts: [], w: 0, h: 0, on: false };
  dust.ctx = dust.cv.getContext('2d');
  function dustSize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    dust.w = dust.cv.width = Math.round(vw * dpr * 0.5);
    dust.h = dust.cv.height = Math.round(vh * dpr * 0.5);
    const n = vw < 700 ? 34 : 64;
    dust.pts = Array.from({ length: n }, () => ({
      x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8,
      vx: 0.004 + Math.random() * 0.012, vy: -0.002 + Math.random() * 0.004, a: 0.25 + Math.random() * 0.55, ph: Math.random() * 6.28
    }));
  }
  function drawDust(dt, time) {
    const { ctx, w, h, pts } = dust;
    ctx.clearRect(0, 0, w, h);
    const warm = dust.dusk;
    const rr = Math.round(255), gg = Math.round(214 - 30 * warm), bb = Math.round(160 - 50 * warm);
    const amt = dust.amt * (1 - 0.55 * warm);
    for (const q of pts) {
      q.x += q.vx * dt * (0.4 + dust.amt * 1.4) * (1 - 0.6 * warm);
      q.y += (q.vy + Math.sin(time * 0.0004 + q.ph) * 0.002) * dt * 0.6;
      if (q.x > 1.05) q.x = -0.05;
      if (q.y < -0.05) q.y = 1.05; else if (q.y > 1.05) q.y = -0.05;
      const a = q.a * amt * 0.5;
      if (a < 0.01) continue;
      ctx.fillStyle = `rgba(${rr},${gg},${bb},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(q.x * w, q.y * h, q.r * (w / 900 + 0.5), 0, 6.283);
      ctx.fill();
    }
  }

  /* ------------------------------------------------------------- frame loop */
  let target = 0, cur = 0, lastT = 0, running = false;
  function frame(now) {
    const dt = Math.min(48, now - (lastT || now)); lastT = now;
    const rate = reduce ? 1 : 1 - Math.pow(1 - 0.13, dt / 16.667);
    const d = target - cur;
    cur = Math.abs(d) < 0.0003 ? target : cur + d * rate;
    px += (tpx - px) * (1 - Math.pow(1 - 0.08, dt / 16.667));
    py += (tpy - py) * (1 - Math.pow(1 - 0.08, dt / 16.667));
    render(cur);
    if (!reduce && !document.hidden) drawDust(dt, now);
    if (reduce) {
      running = false; lastT = 0;
      const still = Math.abs(target - cur) < 0.0003;
      if (!still) { running = true; requestAnimationFrame(frame); }
      return;
    }
    requestAnimationFrame(frame);
  }
  function kick() { if (!running) { running = true; lastT = 0; requestAnimationFrame(frame); } }

  function render(t) {
    const { k, p } = renderWorld(t);
    renderCamera(t);
    renderBeats(t);
    renderPole(t, k, p);
  }

  addEventListener('scroll', () => { target = scrollY / vh; kick(); }, { passive: true });
  addEventListener('resize', () => { layout(); dustSize(); kick(); });
  addEventListener('load', () => dispatchEvent(new Event('resize')));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => dispatchEvent(new Event('resize')));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  addEventListener('pointermove', (e) => {
    if (!fine || reduce || e.pointerType === 'touch') return;
    tpx = e.clientX / vw - 0.5;
    tpy = e.clientY / vh - 0.5;
    kick();
  }, { passive: true });

  mqReduce.addEventListener('change', () => { reduce = mqReduce.matches; layerState.fill(''); kick(); });
  mqFine.addEventListener('change', () => { fine = mqFine.matches; });

  /* ---------------------------------------------------------- navigation */
  function goTo(t) {
    const top = Math.max(0, Math.min(t, total)) * vh;
    scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }
  const stageT = (j) => j === 0 ? 0 : (j === N - 1 ? legStart[9] + 0.92 * DUSK : legEnd[j - 1] + 0.12);
  poleRows.forEach((row) => row.addEventListener('click', () => {
    goTo(stageT(+row.dataset.stage));
    row.classList.add('is-peek');
    setTimeout(() => row.classList.remove('is-peek'), 1600);
  }));
  $$('[data-go="close"]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const dlg = a.closest('dialog'); if (dlg) closeDrawer(dlg);
    goTo(total);
  }));
  $('.brand').addEventListener('click', (e) => { e.preventDefault(); goTo(0); });

  /* ------------------------------------------------------------- drawers */
  let openCount = 0;
  function openDrawer(dlg) {
    if (dlg.open) return;
    const others = $$('dialog.drawer[open]'); others.forEach((o) => closeDrawer(o));
    dlg.showModal();
    openCount++;
    root.classList.add('is-locked');
  }
  function closeDrawer(dlg) {
    if (!dlg.open) return;
    dlg.close();
  }
  $$('dialog.drawer').forEach((dlg) => {
    dlg.addEventListener('close', () => {
      if (!$$('dialog[open]').length) root.classList.remove('is-locked');
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
  });
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => {
    const dlg = $('#drawer-' + b.dataset.open);
    if (dlg) openDrawer(dlg);
  }));

  /* -------------------------------------------------------------- gallery */
  const GALLERY = [
    ['brown-hacienda', 'Hacienda with a tile roof and an arched entry'],
    ['pueblo-red', 'Pueblo-style home in terracotta stucco'],
    ['arched-door', 'Arched wrought-iron entry door'],
    ['kitchen', 'Kitchen with custom cabinets and granite'],
    ['curved-portal', 'Curved portal with a carved wood door'],
    ['pool', 'Pool with a rock waterfall'],
    ['portal-fountain', 'Covered portal with log posts and a fountain'],
    ['patio-fireplace', 'Courtyard fireplace and built-in bench'],
    ['fountain', 'Courtyard fountain'],
    ['master-tub', 'Master bath tub in stacked stone']
  ];
  const gal = $('#gallery');
  GALLERY.forEach(([name, cap], i) => {
    const fig = document.createElement('figure');
    fig.innerHTML = `<button type="button" aria-label="Enlarge: ${cap}"><img src="assets/gallery/${name}.webp" alt="${cap}" loading="lazy" decoding="async"></button><figcaption>${cap}</figcaption>`;
    $('button', fig).addEventListener('click', () => openLb(i));
    gal.appendChild(fig);
  });
  const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  let lbI = 0;
  function showLb() {
    const [name, cap] = GALLERY[lbI];
    lbImg.src = `assets/gallery/${name}.webp`; lbImg.alt = cap; lbCap.textContent = cap;
  }
  function openLb(i) { lbI = i; showLb(); lb.showModal(); }
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  $$('[data-lb]', lb).forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.lb;
    if (a === 'close') lb.close();
    else { lbI = (lbI + (a === 'next' ? 1 : -1) + GALLERY.length) % GALLERY.length; showLb(); }
  }));
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { lbI = (lbI + 1) % GALLERY.length; showLb(); }
    if (e.key === 'ArrowLeft') { lbI = (lbI - 1 + GALLERY.length) % GALLERY.length; showLb(); }
  });

  /* ---------------------------------------------------------------- plans */
  const PLANS = (window.DC_PLANS || '').trim().split('\n').map((l) => {
    const [sf, beds, baths, gar, file] = l.split('|');
    return { sf: +sf, beds, bedsMin: parseFloat(beds), baths: parseFloat(baths), bathsTxt: baths, gar: +gar, file };
  });
  const elList = $('#plansList'), elCount = $('#plansCount');
  const fSize = $('#f-size'), fBeds = $('#f-beds'), fBaths = $('#f-baths'), fGar = $('#f-gar');
  const isHome = (p) => p.bedsMin >= 3 || p.sf >= 1800;
  function renderPlans() {
    const size = fSize.value, bMin = +fBeds.value || 0, baMin = +fBaths.value || 0, gMin = +fGar.value || 0;
    const list = PLANS.filter((p) => {
      if (size === 'small') { if (!(p.bedsMin >= 1 && p.sf < 1200)) return false; }
      else if (size === 'garage') { if (!(p.bedsMin === 0 && p.sf < 1500 && p.gar > 0)) return false; }
      else if (size) {
        const [a, b] = size.split('-').map(Number);
        if (!(isHome(p) && p.sf >= a && p.sf <= b)) return false;
      }
      if (bMin && !(p.bedsMin >= bMin)) return false;
      if (baMin && !(p.baths >= baMin)) return false;
      if (gMin && !(p.gar >= gMin)) return false;
      return true;
    });
    elCount.textContent = list.length === 1 ? '1 plan' : `${list.length} plans`;
    elList.replaceChildren(...list.map((p) => {
      const li = document.createElement('li'); li.className = 'plan';
      const kind = p.bedsMin === 0 ? (p.sf < 1500 ? 'Garage' : '') : '';
      li.innerHTML = `<span class="plan__sf">${p.sf.toLocaleString('en-US')}<small>sq ft</small></span>
        <span class="plan__meta"><span>${p.bedsMin === 0 ? (kind || 'No bedrooms') : p.beds + ' bed'}</span><span>${p.bathsTxt} bath</span><span>${p.gar} car</span></span>
        <a class="plan__link" href="https://dcchi.com/display.php?plan=${encodeURIComponent(p.file)}" target="_blank" rel="noopener">View plan</a>`;
      return li;
    }));
    if (!list.length) { const li = document.createElement('li'); li.className = 'plans__empty'; li.textContent = 'No plans match those filters. Loosen one and try again, or bring Alex your own idea.'; elList.append(li); }
  }
  [fSize, fBeds, fBaths, fGar].forEach((s) => s.addEventListener('change', renderPlans));
  renderPlans();

  /* ----------------------------------------------------------------- boot */
  layout();
  dustSize();
  cur = target;
  render(cur);
  kick();
  // fonts, the late layout and embedded previews can all report a 0 viewport once
  setTimeout(() => dispatchEvent(new Event('resize')), 250);
})();
