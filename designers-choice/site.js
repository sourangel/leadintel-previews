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
     Units are viewport heights of scroll. Stage i is held for HOLD[i], then
     leg i carries the world from stage i to stage i + 1. The last leg is the
     peak: the finished house going from afternoon to sunset. */
  const LEG = 0.85;
  const DUSK = 1.8;
  const HOLD = [0.9, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.4, 1.3];
  const LEN = [LEG, LEG, LEG, LEG, LEG, LEG, LEG, LEG, DUSK];
  const N = HOLD.length;
  const holdStart = [], legStart = [];
  let total = 0;
  for (let i = 0; i < N; i++) {
    holdStart[i] = total; total += HOLD[i];
    if (i < N - 1) { legStart[i] = total; total += LEN[i]; }
  }
  const STAGE_NAMES = ['Your lot', 'Dirt work', 'Footings', 'Plumbing', 'The slab', 'Framing', 'Roof trusses', 'Tile roof', 'Stucco and glass', 'Home'];

  /* ------------------------------------------------------------- elements */
  const cam = $('#cam');
  const layers = $$('.layer');
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
  function pickSet() {
    const key = mqPortrait.matches ? 'm' : 's';
    if (key === setKey) return;
    setKey = key;
    imgs.forEach((img, i) => {
      const src = `assets/${key}${i}.webp`;
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
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
    target = scrollY / vh;
  }

  /* ------------------------------------------------------------- beat windows
     Copy is windowed against the whole track: it ramps in, holds on a plateau,
     ramps out. The only transform is a drift capped at 4vh across the window. */
  const wins = beats.map((el, i) => {
    let from, to, rIn = 0.16, rOut = 0.16;
    if (i === 0) { from = 0; to = legStart[0] + 0.34 * LEG; rIn = 0; rOut = 0.3; }
    else if (i < 9) {
      from = legStart[i - 1] + 0.4 * LEN[i - 1];
      to = i < 8 ? legStart[i] + 0.2 * LEG : legStart[8] + 0.3;
    } else { from = legStart[8] + 1.22; to = total + 0.01; rIn = 0.45; rOut = 0; }
    const len = to - from;
    return { el, from, to, rIn, rOut, len, rInV: i === 9 ? 0.34 : (i === 0 ? 0 : 0.17), rOutV: i === 0 ? 0.2 : (i === 9 ? 0 : 0.17), state: -1, last: -1 };
  });

  function renderBeats(t) {
    for (const w of wins) {
      let v;
      if (t < w.from) v = 0;
      else if (t < w.from + w.rInV) v = w.rInV ? smooth((t - w.from) / w.rInV) : 1;
      else if (t <= w.to - w.rOutV) v = 1;
      else v = w.rOutV ? smooth(1 - (t - (w.to - w.rOutV)) / w.rOutV) : 1;
      if (t > w.to) v = 0;
      if (w.el === beats[9] && t >= w.from) v = Math.max(v, smooth((t - w.from) / 0.34));
      v = clamp(v);
      const wp = clamp((t - w.from) / w.len);
      const dy = reduce ? 0 : (0.5 - wp) * 4;
      const key = v.toFixed(3) + '|' + dy.toFixed(2);
      if (key !== w.last) {
        w.last = key;
        w.el.style.opacity = v.toFixed(3);
        w.el.style.transform = reduce || w.el === beats[9] ? 'none' : `translate3d(0, ${dy.toFixed(2)}vh, 0)`;
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

  function renderWorld(t) {
    // which leg are we in, and how far
    let k = -1;
    for (let i = 0; i < N - 1; i++) if (t >= legStart[i]) k = i;
    const p = k < 0 ? 0 : clamp((t - legStart[k]) / LEN[k]);
    const inFlight = k >= 0 && p < 1;
    // stage j is the newest one completely revealed; leg j builds stage j + 1
    const revealed = k < 0 ? 0 : (inFlight ? k : k + 1);
    let lineY = -1, lineOp = 0;

    for (let j = 0; j < N; j++) {
      if (j < revealed) setLayer(j, false, 1, 'none');
      else if (j === revealed) setLayer(j, true, 1, 'none');
      else if (j === revealed + 1 && inFlight) {
        if (k === N - 2 || reduce) {
          // dusk is a slow dissolve; reduced motion dissolves every stage
          setLayer(j, true, (k === N - 2 ? smooth((p - 0.08) / 0.8) : smooth(p)).toFixed(3), 'none');
        } else {
          const top = (1 - sine(p)) * 100;
          setLayer(j, true, 1, 'inset(' + top.toFixed(3) + '% 0 0 0)');
          lineY = top / 100 * vh;
          lineOp = clamp(Math.min(p / 0.05, (1 - p) / 0.05));
        }
      } else setLayer(j, false, 1, 'none');
    }

    if (lineY >= 0) {
      level.style.opacity = lineOp.toFixed(3);
      level.style.transform = 'translate3d(0,' + lineY.toFixed(1) + 'px,0)';
    } else if (level.style.opacity !== '0') {
      level.style.opacity = '0';
    }

    // dusk glow peaks as the sun meets the ridge
    const dp = k === N - 2 ? p : (k > N - 2 ? 1 : 0);
    const gl = dp <= 0 ? 0 : smooth((dp - 0.35) / 0.4) * (1 - smooth((dp - 0.9) / 0.1) * 0.6);
    glow.style.opacity = reduce ? '0' : gl.toFixed(3);
    warmEl.style.opacity = reduce ? '0' : (k === N - 2 ? Math.sin(Math.PI * p) * 0.9 : 0).toFixed(3);

    return { k, p };
  }

  /* -------------------------------------------------------- camera + depth */
  let px = 0, py = 0, tpx = 0, tpy = 0;
  function renderCamera(t) {
    const prog = clamp(t / total);
    const s = reduce ? 1 : 1 + 0.065 * prog;
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
    else amt = 0.2;
    dust.amt = amt;
    dust.dusk = t > legStart[8] ? clamp((t - legStart[8]) / DUSK) : 0;
    haze.style.opacity = reduce ? '0' : (Math.max(0, amt - 0.22) * 0.9).toFixed(3);
  }

  /* ------------------------------------------------------------------ pole */
  let curStage = -1;
  function renderPole(t, k, p) {
    // stage j is stamped when the leg that built it has completed
    let stamped = 0;
    for (let j = 1; j < N; j++) if (t >= holdStart[j] - 0.0001) stamped = j;
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
    pole.classList.toggle('is-signed', stamped === N - 1 && t >= holdStart[N - 1] + 0.2);
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
  const stageT = (j) => j === 0 ? 0 : holdStart[j] + (j === N - 1 ? 0.45 : HOLD[j] * 0.5);
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
