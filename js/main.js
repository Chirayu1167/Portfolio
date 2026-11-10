(function () {
  'use strict';
  const CM = window.CM;
  const { clamp, lerp, sm, ss } = CM.u;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const root = document.documentElement;
  const fx = root.classList.contains('fx');
  const ac = new AbortController();
  const on = (t, e, f, o) => t.addEventListener(e, f, Object.assign({ signal: ac.signal, passive: true }, o || {}));

  /* ---------- nav (always on) ---------- */
  const toggle = $('#nav-toggle'), links = $('#nav-links');
  const setMenu = (open) => { links.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = open ? 'Close' : 'Menu'; };
  on(toggle, 'click', () => setMenu(!links.classList.contains('is-open')));
  on(links, 'click', (e) => { if (e.target.closest('a')) setMenu(false); });
  on(document, 'keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- shared state ---------- */
  const el = { hero: $('#top'), about: $('#about'), projects: $('#projects'), experience: $('#experience'), achievements: $('#achievements'), contact: $('#contact') };
  const KEYS = ['hero', 'about', 'projects', 'experience', 'achievements', 'contact'];
  const M = {};
  const st = { sy: window.scrollY, vh: window.innerHeight, vw: window.innerWidth, p: [0, 0, 0, 0, 0, 0], a: 0, m: 0, d: 0, front: 0, px: 0, py: 0, mx: -9999, my: -9999, stepF: 0 };
  CM.state = st;
  let vhProbe = null, tx = 0, ty = 0;
  const navLinks = $$('a', links);
  let curNav = null;

  function measure() {
    st.vh = vhProbe ? vhProbe.offsetHeight || window.innerHeight : window.innerHeight;
    st.vw = window.innerWidth;
    KEYS.forEach((k) => { const r = el[k].getBoundingClientRect(); M[k] = { top: r.top + window.scrollY, h: r.height }; });
  }
  function updNav(y) {
    let cur = null;
    ['about', 'projects', 'experience', 'achievements', 'contact'].forEach((k) => { if (M[k] && M[k].top <= y + st.vh * 0.35) cur = k; });
    if (cur === curNav) return;
    curNav = cur;
    navLinks.forEach((a) => { if (cur && a.getAttribute('href') === '#' + cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }

  /* ---------- achievements curve (built always; scrubbed in fx mode) ---------- */
  const curve = { box: $('#curve'), raw: $('#curve-raw'), ema: $('#curve-ema'), marks: $('#curve-marks'), epoch: $('#epoch'), rows: $$('#ck-list .ck'), pts: [], lenR: 0, lenE: 0 };
  function buildCurve() {
    const n = 180, X0 = 40, X1 = 790, Y0 = 22, Y1 = 296, raw = [], ema = [];
    let e = 0;
    for (let k = 0; k < n; k++) {
      const x = k / (n - 1), loss = 0.1 + 0.92 * Math.exp(-4.4 * x);
      const y = loss + (Math.sin(k * 1.9) * 0.55 + Math.sin(k * 0.71 + 1.3) * 0.45) * 0.085 * (1 - x * 0.8) * (0.35 + loss);
      const py = Y0 + (1 - clamp(y, 0, 1.1) / 1.1) * (Y1 - Y0), px = X0 + x * (X1 - X0);
      e = k === 0 ? py : e * 0.88 + py * 0.12;
      raw.push([px, py]); ema.push([px, e]);
    }
    const d = (a) => a.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    curve.raw.setAttribute('d', d(raw)); curve.ema.setAttribute('d', d(ema));
    curve.lenR = curve.raw.getTotalLength(); curve.lenE = curve.ema.getTotalLength();
    curve.raw.style.strokeDasharray = curve.lenR; curve.ema.style.strokeDasharray = curve.lenE;
    let html = '';
    curve.rows.forEach((row, i) => {
      const f = parseFloat(row.dataset.f), p = ema[Math.round(f * (n - 1))], best = i === curve.rows.length - 1;
      curve.pts.push({ f, row });
      html += '<g class="curve__mk' + (best ? ' curve__mk--best' : '') + '"><line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + p[0] + '" y2="300"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (best ? 8 : 5) + '"/>' + (best ? '<circle class="halo" cx="' + p[0] + '" cy="' + p[1] + '" r="15"/>' : '') + '</g>';
    });
    curve.marks.innerHTML = html;
    curve.mk = $$('.curve__mk', curve.marks);
    setCurve(fx ? 0 : 1);
  }
  function setCurve(p) {
    curve.raw.style.strokeDashoffset = curve.lenR * (1 - p); curve.ema.style.strokeDashoffset = curve.lenE * (1 - p);
    curve.epoch.textContent = String(Math.round(p * 240)).padStart(3, '0');
    curve.pts.forEach((c, i) => { const lit = p >= c.f - 0.02; c.row.classList.toggle('is-lit', lit); curve.mk[i].classList.toggle('on', lit); });
  }
  buildCurve();

  if (!fx) {
    on(window, 'scroll', () => updNav(window.scrollY));
    measure(); updNav(window.scrollY);
    on(window, 'resize', () => { measure(); updNav(window.scrollY); });
    return;
  }

  /* =====================  cinematic mode  ===================== */
  vhProbe = document.createElement('div');
  vhProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(vhProbe);

  /* ---------- hero: decode name as the activation front passes ---------- */
  const name = $('#name'), chars = [], SCR = '01#%&@$*+=?<>';
  const lede = { el: $('#stream'), words: $('#stream').textContent.trim().split(/\s+/), n: -1 };
  let heroT = window.scrollY > 240 ? 9 : 0, heroDone = false;
  function setupHero() {
    if (!chars.length) {
      $$('.ln', name).forEach((ln) => {
        const txt = ln.textContent; ln.textContent = '';
        for (const ch of txt) { const s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true'); s.textContent = ch; ln.appendChild(s); chars.push({ el: s, ch, state: -1, tick: 0 }); }
      });
    }
    chars.forEach((c) => { c.el.style.width = ''; c.el.textContent = c.ch; c.el.className = 'ch'; });
    chars.forEach((c) => { c.w = c.el.getBoundingClientRect().width; });
    chars.forEach((c) => { c.el.style.width = c.w + 'px'; const r = c.el.getBoundingClientRect(); c.cx = r.left + r.width / 2; c.state = -1; });
    root.classList.add('ready');
    if (heroDone) chars.forEach((c) => { c.el.className = 'ch is-on'; c.state = 2; });
  }
  function stepHero(dt) {
    heroT += dt;
    st.front = sm(clamp(heroT / 3.0)) * 1.2;
    if (!heroDone) {
      const X = st.front * st.vw;
      for (const c of chars) {
        const d = X - c.cx, s = d < 0 ? 0 : d < 90 ? 1 : 2;
        if (s === 1 && heroT - c.tick > 0.055) { c.el.textContent = SCR[(Math.random() * SCR.length) | 0]; c.tick = heroT; }
        if (s !== c.state) { c.state = s; c.el.className = 'ch' + (s === 1 ? ' is-scr' : s === 2 ? ' is-on' : ''); if (s === 2) c.el.textContent = c.ch; }
      }
      if (heroT > 3.6) heroDone = true;
    }
    const k = Math.floor(clamp((heroT - 1.3) / 1.4) * (lede.words.length + 0.001));
    if (k !== lede.n) { lede.n = k; lede.el.textContent = lede.words.slice(0, k).join(' '); }
    if (heroT > 2.7) $('#hero-cta').classList.add('on');
  }
  const heroIn = $('#hero-in'), hint = $('.hero__hint');
  const hLast = { o: -1 };
  function updHero() {
    const p = st.p[0], o = 1 - ss(0.5, 0.9, p);
    if (Math.abs(o - hLast.o) > 0.003) {
      hLast.o = o; heroIn.style.opacity = o.toFixed(3); heroIn.style.transform = 'translate3d(0,' + (-p * 70).toFixed(1) + 'px,0)';
      hint.style.opacity = (1 - ss(0, 0.07, p)).toFixed(3);
      heroIn.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    }
  }

  /* ---------- scroll-scrubbed reveals ---------- */
  const scans = $$('[data-scan]'), locks = $$('[data-lock]'), scanLast = new Map();
  function updScans() {
    const vh = st.vh, rects = scans.map((e) => e.getBoundingClientRect());
    scans.forEach((e, i) => {
      const r = rects[i], v = clamp((vh * 0.95 - r.top) / (vh * 0.3 + Math.min(r.height, vh * 0.6) * 0.4));
      const q = Math.round(v * 400) / 400;
      if (scanLast.get(e) === q) return;
      scanLast.set(e, q); e.style.setProperty('--r', q); e.style.setProperty('--s', q > 0.01 && q < 0.99 ? 1 : 0);
    });
    locks.forEach((e) => {
      const r = e.getBoundingClientRect(), L = ss(0, 1, clamp((vh * 0.85 - r.top) / (vh * 0.45)));
      const q = Math.round(L * 200) / 200;
      if (scanLast.get(e) === q) return;
      scanLast.set(e, q); e.style.setProperty('--L', q);
      $$('.bb', e).forEach((b, k) => { const c = k ? 0.91 : 0.98; b.firstElementChild.textContent = (k ? 'blazer ' : 'ai-engineer ') + (c * q).toFixed(2); });
    });
  }

  /* ---------- projects: pinned inference viewfinder ---------- */
  const pr = { sec: el.projects, arts: $$('#proj-list .proj'), rail: $('#rail'), count: $('#proj-count'), pinned: false, last: [], act: -1 };
  pr.n = pr.arts.length;
  pr.arts.forEach((a, i) => {
    const li = document.createElement('li'), b = document.createElement('button'), nm = $('h3', a).firstChild.textContent.trim();
    b.type = 'button'; b.setAttribute('aria-label', 'Go to ' + nm); b.innerHTML = '<span>' + nm + '</span>';
    on(b, 'click', () => window.scrollTo({ top: M.projects.top + (i + 0.5) * st.vh, behavior: 'smooth' }));
    li.appendChild(b); pr.rail.appendChild(li);
    const shot = $('.proj__shot', a);
    on(shot, 'pointermove', (e) => { const r = shot.getBoundingClientRect(); shot.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); shot.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px'); });
    $$('.bb', a).forEach((bb) => on(bb, 'click', () => { const hot = bb.classList.contains('is-hot'); $$('.bb', a).forEach((o) => o.classList.remove('is-hot')); if (!hot) bb.classList.add('is-hot'); }));
  });
  function setPinned(onOff) {
    if (onOff === pr.pinned) return;
    pr.pinned = onOff; pr.sec.classList.toggle('is-pinned', onOff); root.style.setProperty('--n', pr.n);
    if (!onOff) { pr.last = []; pr.act = -1; pr.arts.forEach((a) => { a.removeAttribute('style'); $('.proj__body', a).removeAttribute('style'); $('.proj__shot', a).removeAttribute('style'); }); }
  }
  function updProjects() {
    if (!pr.pinned) return;
    const f = st.stepF, n = pr.n, e = clamp(1 - (M.projects.top - st.sy) / (0.85 * st.vh));
    pr.arts.forEach((a, i) => {
      const fi = f - i, last = pr.last[i] || (pr.last[i] = {});
      const r = i === 0 ? e : ss(-0.2, 0, fi);
      const covered = i < n - 1 && ss(-0.2, 0, f - (i + 1)) >= 1;
      const vis = r > 0.001 && !covered;
      let op;
      if (i === 0) op = Math.min(ss(0.35, 0.85, e), 1 - ss(0.78, 0.9, fi));
      else op = fi < -0.1 ? 0 : fi < 0 ? ss(-0.1, 0, fi) : i === n - 1 ? 1 : 1 - ss(0.78, 0.9, fi);
      const L = fi >= 0 ? ss(0, 0.45, fi) : 0;
      if (last.vis !== vis) { last.vis = vis; a.style.visibility = vis ? 'visible' : 'hidden'; a.style.zIndex = i + 1; }
      const act = op > 0.5;
      if (last.act !== act) { last.act = act; a.style.pointerEvents = act ? 'auto' : 'none'; }
      if (!vis) return;
      const shot = $('.proj__shot', a), body = $('.proj__body', a), det = $('.det', a);
      if (last.r === undefined || Math.abs(last.r - r) > 0.002) { last.r = r; shot.style.setProperty('--r', r.toFixed(3)); }
      if (last.op === undefined || Math.abs(last.op - op) > 0.01) { last.op = op; body.style.opacity = op.toFixed(2); body.style.transform = 'translate3d(0,' + ((1 - op) * 14).toFixed(1) + 'px,0)'; }
      det.style.setProperty('--L', L.toFixed(3));
      det.style.setProperty('--dx', (Math.sin(f * 5.2 + i * 1.3) * 3 * L).toFixed(2) + 'px');
      det.style.setProperty('--dy', (Math.cos(f * 4.1 + i) * 2 * L).toFixed(2) + 'px');
      const q = Math.round(L * 100);
      if (last.q !== q) { last.q = q; $$('.bb', det).forEach((b) => { b.firstElementChild.textContent = b.dataset.l + ' ' + (parseFloat(b.dataset.c) * L).toFixed(2); }); }
    });
    const idx = clamp(Math.floor(f + 0.12), 0, n - 1);
    if (idx !== pr.act) {
      pr.act = idx; pr.count.textContent = 'exp_0' + (idx + 1) + ' / 0' + n;
      $$('button', pr.rail).forEach((b, i) => { b.classList.toggle('is-on', i === idx); if (i === idx) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    }
  }

  /* ---------- experience: a signal travels the synapse ---------- */
  const xp = { box: $('#xp'), svg: $('#xp-svg'), items: $$('.xp__item'), built: false };
  function buildXp() {
    const b = xp.box.getBoundingClientRect(), w = Math.round(b.width), h = Math.round(b.height);
    if (!w || !h) return;
    const pts = xp.items.map((li) => { const r = $('.xp__dot', li).getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }; });
    const p0 = pts[0], p1 = pts[1], dy = p1.y - p0.y;
    const d = 'M' + p0.x + ' 0 L' + p0.x + ' ' + p0.y + ' C' + p0.x + ' ' + (p0.y + dy * 0.55) + ' ' + p1.x + ' ' + (p1.y - dy * 0.55) + ' ' + p1.x + ' ' + p1.y + ' L' + p1.x + ' ' + (h - 4);
    let html = '<path class="xp__base" d="' + d + '"/><path class="xp__draw" id="xd" d="' + d + '"/>';
    const sd = [[-1, 0.3], [1, 0.55], [-1, 0.85]];
    pts.forEach((p, k) => sd.forEach((s, j) => {
      const len = 46 + ((k * 3 + j) % 3) * 22, ex = p.x + s[0] * len * (k ? 1 : 0.7), ey = p.y + (j - 1) * 30 + 10;
      html += '<path class="xp__br" data-k="' + k + '" d="M' + p.x + ' ' + p.y + ' Q' + (p.x + s[0] * len * 0.2) + ' ' + (ey - 20) + ' ' + ex + ' ' + ey + '"/><circle class="xp__bt" data-k="' + k + '" cx="' + ex + '" cy="' + ey + '" r="2.4"/>';
    }));
    pts.forEach((p, k) => { html += '<circle class="xp__ring" data-k="' + k + '" cx="' + p.x + '" cy="' + p.y + '" r="13"/><circle class="xp__node" data-k="' + k + '" cx="' + p.x + '" cy="' + p.y + '" r="7"/>'; });
    html += '<circle class="xp__pulse" id="xpp" r="5"/>';
    xp.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); xp.svg.innerHTML = html;
    xp.draw = $('#xd'); xp.len = xp.draw.getTotalLength(); xp.draw.style.strokeDasharray = xp.len;
    xp.pulse = $('#xpp'); xp.brs = $$('.xp__br', xp.svg); xp.bts = $$('.xp__bt', xp.svg); xp.nodes = $$('.xp__node', xp.svg); xp.rings = $$('.xp__ring', xp.svg);
    xp.brs.forEach((p) => { const l = p.getTotalLength(); p.style.strokeDasharray = l; p.style.strokeDashoffset = l; p._l = l; });
    xp.f = pts.map((p) => p.y / h); xp.built = true;
  }
  function updXp() {
    if (!xp.built) return;
    const r = xp.box.getBoundingClientRect(), p = clamp((st.vh * 0.72 - r.top) / (r.height * 0.9));
    xp.draw.style.strokeDashoffset = xp.len * (1 - p);
    const pt = xp.draw.getPointAtLength(xp.len * p);
    xp.pulse.setAttribute('cx', pt.x.toFixed(1)); xp.pulse.setAttribute('cy', pt.y.toFixed(1)); xp.pulse.style.opacity = p > 0.005 && p < 0.995 ? 1 : 0;
    xp.items.forEach((li, k) => {
      const live = p >= xp.f[k] - 0.02;
      li.classList.toggle('is-live', live); xp.nodes[k].classList.toggle('on', live); xp.rings[k].classList.toggle('on', live);
    });
    xp.brs.forEach((b, i) => { const k = +b.dataset.k, q = clamp((p - xp.f[k]) / 0.1); b.style.strokeDashoffset = b._l * (1 - q); xp.bts[i].style.opacity = q > 0.98 ? 1 : 0; });
  }

  /* ---------- achievements ---------- */
  function updCurve() {
    const r = curve.box.getBoundingClientRect();
    setCurve(clamp((st.vh * 0.9 - r.top) / (st.vh * 0.55 + r.height * 0.5)));
  }

  /* ---------- contact: lights out, handshake ---------- */
  const ct = { inner: $('#contact-in'), links: $$('#links a'), leds: $$('#links .led'), status: $('#status-t'), txt: null };
  const PH = [[0.12, 0.42, 'handshake…'], [0.42, 0.78, 'opening channels…'], [0.78, 1.01, 'connection established']];
  function updContact() {
    const d = st.d, p = st.p[5];
    ct.inner.style.opacity = ss(0.6, 1, d).toFixed(3);
    if (d < 0.4) { CM.contact = null; return; }
    const rs = ct.links.map((a) => a.getBoundingClientRect()), mob = st.vw < 760;
    const right = Math.max.apply(null, rs.map((r) => r.right));
    CM.contact = mob ? { mobile: true, bx: 10, lx: rs[0].left, ys: rs.map((r) => r.top + r.height / 2) } : { mobile: false, bx: right + 34, lx: right, ys: rs.map((r) => r.top + r.height / 2) };
    ct.leds.forEach((l, k) => l.classList.toggle('on', p > 0.62 + k * 0.06));
    let txt = '';
    for (const ph of PH) if (p >= ph[0] && p < ph[1]) txt = ph[2].slice(0, Math.ceil(clamp((p - ph[0]) / ((ph[1] - ph[0]) * 0.55)) * ph[2].length));
    if (txt !== ct.txt) { ct.txt = txt; ct.status.textContent = txt; }
  }

  /* ---------- global scroll model ---------- */
  const NAMES = ['input · initialize', 'data · embeddings', 'vision · inference', 'agents · memory', 'training · convergence', 'deploy · connect'];
  const hudN = $('#hud-n'), hudT = $('#hud-t');
  let hudI = -1, bgLast = -1, progLast = -1;
  const PAPER = [243, 238, 228], FOREST = [17, 32, 27], FG0 = [22, 24, 26], FG1 = [236, 240, 232];
  const mixc = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',') + ')';

  function compute() {
    const y = st.sy, vh = st.vh, gp = (s) => clamp((y - s.top + 0.7 * vh) / (s.h + 0.4 * vh));
    st.p[0] = clamp(y / Math.max(1, M.hero.h - vh));
    st.p[1] = gp(M.about);
    if (pr.pinned) st.stepF = clamp((y - M.projects.top) / vh, 0, pr.n); else st.stepF = gp(M.projects) * pr.n;
    st.p[2] = st.stepF / pr.n;
    st.p[3] = gp(M.experience); st.p[4] = gp(M.achievements);
    st.p[5] = clamp((y - M.contact.top) / Math.max(1, M.contact.h - vh));
    let T = 0;
    for (let i = 0; i < 5; i++) {
      const b = M[KEYS[i + 1]].top, w0 = b - (i === 4 ? 0.75 : 0.85) * vh, w1 = b - (i === 4 ? 0.3 : 0.1) * vh;
      T += ss(w0, w1, y);
    }
    if (T >= 5 - 1e-6) { st.a = 4; st.m = 1; } else { st.a = Math.min(4, Math.floor(T)); st.m = T - st.a; }
    st.d = ss(M.contact.top - 0.75 * vh, M.contact.top - 0.3 * vh, y);
  }

  let last = 0, raf = 0, t = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; t += dt;
    const target = window.scrollY;
    st.sy += (target - st.sy) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - st.sy) < 0.3) st.sy = target;
    st.px += (tx - st.px) * (1 - Math.exp(-dt * 5)); st.py += (ty - st.py) * (1 - Math.exp(-dt * 5));

    stepHero(dt);
    compute();
    updHero(); updScans(); updProjects(); updXp(); updCurve(); updContact(); updNav(target);

    const bg = Math.round(st.d * 500);
    if (bg !== bgLast) { bgLast = bg; root.style.setProperty('--bg', mixc(PAPER, FOREST, st.d)); root.style.setProperty('--fg', mixc(FG0, FG1, st.d)); root.style.setProperty('--d', st.d.toFixed(3)); }
    const pg = Math.round((target / Math.max(1, document.documentElement.scrollHeight - st.vh)) * 1000);
    if (pg !== progLast) { progLast = pg; root.style.setProperty('--prog', (pg / 1000).toFixed(3)); }
    const si = clamp(Math.round(st.a + st.m), 0, 5);
    if (si !== hudI) { hudI = si; hudN.textContent = '0' + (si + 1); hudT.textContent = NAMES[si]; }

    CM.system.draw(st, t, dt);
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  on(document, 'visibilitychange', () => { if (document.hidden) stop(); else start(); });

  /* ---------- anchors: cinematic smooth scroll ---------- */
  on(document, 'click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.metaKey || e.ctrlKey) return;
    const id = a.getAttribute('href').slice(1), k = id === 'top' ? 'hero' : id, tgt = M[k];
    if (!tgt) return;
    e.preventDefault();
    window.scrollTo({ top: k === 'hero' ? 0 : tgt.top, behavior: 'smooth' });
    history.replaceState(null, '', '#' + id);
  }, { passive: false });

  /* ---------- pointer ---------- */
  on(window, 'pointermove', (e) => { if (e.pointerType === 'touch') return; tx = (e.clientX / st.vw) * 2 - 1; ty = (e.clientY / st.vh) * 2 - 1; st.mx = e.clientX; st.my = e.clientY; });
  on(document.documentElement, 'pointerleave', () => { st.mx = -9999; st.my = -9999; });

  /* ---------- layout ---------- */
  let rz = 0, lastW = 0, lastH = 0;
  function pinFits() {
    return !pr.arts.some((a) => a.scrollHeight > a.clientHeight + 2);
  }
  function layout(force) {
    setPinned(window.innerHeight >= 560);
    if (pr.pinned && !pinFits()) setPinned(false);
    measure();
    const ch = CM.system.resize();
    lastW = st.vw; lastH = st.vh;
    setupHero(); buildXp();
    if (ch || force) st.sy = window.scrollY;
  }
  function onResize() {
    clearTimeout(rz);
    rz = setTimeout(() => {
      const dh = Math.abs((vhProbe.offsetHeight || window.innerHeight) - lastH);
      if (window.innerWidth !== lastW || dh > 150) layout(); else { measure(); buildXp(); }
    }, 140);
  }
  on(window, 'resize', onResize);
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(onResize); ro.observe(document.body); on(window, 'pagehide', () => ro.disconnect()); }

  function boot() {
    if (!CM.system.init()) return;
    layout(true);
    start();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { CM.system.rebuildMono(); layout(); });
  }
  on(window, 'pagehide', () => { stop(); ac.abort(); });
  const go = () => { let done = false; const f = () => { if (!done) { done = true; boot(); } }; if (document.fonts && document.fonts.ready) { document.fonts.ready.then(f); setTimeout(f, 700); } else f(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
