/* The "system": one persistent set of nodes that morphs through six scenes as you scroll.
 *   0 input network (initialises)   1 raw data -> embeddings   2 vision / feature map
 *   3 agents + memory graph         4 loss landscape converging 5 monogram + connection
 * Everything is a pure function of (scroll state, time), so scrolling up reverses it exactly.
 * Drawing is one 2D canvas, DPR-capped, with a small fixed node budget. */
(function () {
  'use strict';
  const CM = (window.CM = window.CM || {});
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => t * t * (3 - 2 * t);
  const ss = (a, b, x) => sm(clamp((x - a) / (b - a)));
  const TAU = Math.PI * 2;
  CM.u = { clamp, lerp, sm, ss };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const INK = [22, 24, 26], EMBER = [232, 80, 31], FOREST = [46, 107, 84];
  const CLS = [EMBER, FOREST, INK];
  const MONO = '11px "JetBrains Mono", ui-monospace, Menlo, monospace';

  let cv, ctx, W = 0, H = 0, dpr = 1, N = 0, mobile = false;
  let Z, STAG, BEND, EA, EB, F;
  let S0, S1, S2, S3, S4, S5;
  const edges = [null, null, null, null, null, null];
  const adj = [null, null, null, null, null, null];
  const EDGE_A = [0.2, 0.13, 0.07, 0.22, 0.34, 0.2];
  const MUL = [0.95, 0.5, 0.5, 0.55, 0.55, 0.95];
  let pulses = [];
  let ar = 0, ag = 0, ab = 0;

  const buf = (n) => ({
    x: new Float32Array(n), y: new Float32Array(n), a: new Float32Array(n), r: new Float32Array(n),
    cr: new Float32Array(n), cg: new Float32Array(n), cb: new Float32Array(n),
    v: new Float32Array(n), g: new Float32Array(n), h: new Float32Array(n), shape: 0,
  });
  const rgba = (r, g, b, a) => 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';

  /* on dark (contact) every colour is lifted toward light; result lands in ar/ag/ab */
  function adapt(r, g, b, d) {
    if (d < 0.004) { ar = r; ag = g; ab = b; return; }
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    const k = (lum < 70 ? 0.86 : lum < 150 ? 0.55 : 0.3) * d;
    ar = r + (255 - r) * k; ag = g + (255 - g) * k; ab = b + (255 - b) * k;
  }
  function setc(E, i, c1, c2, t) {
    E.cr[i] = c1[0] + (c2[0] - c1[0]) * t; E.cg[i] = c1[1] + (c2[1] - c1[1]) * t; E.cb[i] = c1[2] + (c2[2] - c1[2]) * t;
  }
  function hide(E, i, x, y) {
    E.x[i] = x; E.y[i] = y; E.a[i] = 0; E.r[i] = 0; E.v[i] = 0; E.g[i] = 0; E.h[i] = 0;
    E.cr[i] = 22; E.cg[i] = 24; E.cb[i] = 26;
  }
  function setEdges(s, list, directed) {
    const e = new Int32Array(list.length * 2), ad = [];
    for (let k = 0; k < list.length; k++) {
      const i = list[k][0], j = list[k][1];
      e[k * 2] = i; e[k * 2 + 1] = j;
      (ad[i] || (ad[i] = [])).push(j);
      if (!directed) (ad[j] || (ad[j] = [])).push(i);
    }
    edges[s] = e; adj[s] = ad;
  }
  const gauss = (R) => R() + R() + R() - 1.5;

  /* ---------------- scene data (rebuilt on resize) ---------------- */
  function buildHero(R) {
    const L = mobile ? [3, 5, 6, 6, 5, 3] : [3, 6, 8, 8, 6, 3];
    const x0 = mobile ? W * 0.1 : W * 0.43, x1 = mobile ? W * 0.92 : W * 0.96;
    const y0 = mobile ? H * 0.11 : H * 0.17, y1 = mobile ? H * 0.49 : H * 0.83;
    const s = { x: [], y: [], layer: [], x0, x1, n: 0 }, start = [];
    for (let l = 0; l < L.length; l++) {
      start.push(s.x.length);
      for (let k = 0; k < L[l]; k++) {
        s.x.push(lerp(x0, x1, l / (L.length - 1)) + (R() - 0.5) * (mobile ? 6 : 14));
        s.y.push(lerp(y0, y1, (k + 0.5) / L[l]) + (R() - 0.5) * (mobile ? 6 : 12));
        s.layer.push(l);
      }
    }
    start.push(s.x.length);
    const m = mobile ? 12 : 30, lanes = L[0], lane = [[], [], []];
    for (let i = 0; i < m; i++) {
      const ln = i % lanes, k = Math.floor(i / lanes), per = m / lanes;
      const f = Math.pow((k + 1) / per, 0.8);
      s.x.push(lerp(mobile ? 0 : W * 0.03, x0 - W * 0.035, f));
      s.y.push(s.y[ln] + (R() - 0.5) * (mobile ? 5 : 10));
      s.layer.push(-1);
      lane[ln].push(s.x.length - 1);
    }
    s.n = s.x.length;
    const seen = new Set(), list = [];
    const add = (a, b) => { const k = a * 1000 + b; if (!seen.has(k)) { seen.add(k); list.push([a, b]); } };
    for (let l = 0; l < L.length - 1; l++) {
      for (let a = 0; a < L[l]; a++) {
        const c = Math.round((a / Math.max(1, L[l] - 1)) * (L[l + 1] - 1));
        for (let d = -1; d <= 1; d++) add(start[l] + a, start[l + 1] + clamp(c + d, 0, L[l + 1] - 1));
      }
    }
    for (let q = 0; q < lanes; q++) for (let k = 0; k < lane[q].length; k++) add(lane[q][k], k + 1 < lane[q].length ? lane[q][k + 1] : q);
    setEdges(0, list, true);
    S0 = s;
  }

  function buildAbout(R) {
    const n = mobile ? 60 : 100;
    const rx = mobile ? W * 0.06 : W * 0.56, ry = mobile ? H * 0.2 : H * 0.16;
    const rw = mobile ? W * 0.88 : W * 0.4, rh = mobile ? H * 0.6 : H * 0.68;
    const cf = [[0.28, 0.3], [0.74, 0.24], [0.58, 0.76]];
    const s = { n, nx: [], ny: [], cx: [], cy: [], cls: [], rx, ry, rw, rh, cf, axis: ry + rh * 0.5, gates: [0.14, 0.4, 0.66] };
    for (let i = 0; i < n; i++) {
      const c = i % 3;
      s.cls.push(c);
      s.nx.push(rx - rw * 0.35 + R() * rw * 0.75); s.ny.push(ry + R() * rh);
      s.cx.push(rx + rw * cf[c][0] + gauss(R) * rw * 0.11); s.cy.push(ry + rh * cf[c][1] + gauss(R) * rh * 0.12);
    }
    const seen = new Set(), list = [];
    for (let i = 0; i < n; i++) {
      const ds = [];
      for (let j = 0; j < n; j++) if (j !== i && s.cls[j] === s.cls[i]) ds.push([Math.hypot(s.cx[i] - s.cx[j], s.cy[i] - s.cy[j]), j]);
      ds.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < 2; k++) { const j = ds[k][1], key = Math.min(i, j) * 1000 + Math.max(i, j); if (!seen.has(key)) { seen.add(key); list.push([i, j]); } }
    }
    setEdges(1, list, false);
    S1 = s;
  }

  function buildLattice() {
    const cols = mobile ? 7 : 14, rows = 8, n = cols * rows;
    const x0 = mobile ? W * 0.05 : W * 0.03, x1 = mobile ? W * 0.95 : W * 0.97, y0 = H * 0.14, y1 = mobile ? H * 0.9 : H * 0.92;
    const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
    const s = { n, cols, rows, x0, y0, cw, ch, x: [], y: [], roi: [[0.22, 0.4], [0.7, 0.5], [0.36, 0.72], [0.8, 0.28], [0.5, 0.45], [0.15, 0.7]] };
    for (let i = 0; i < n; i++) { s.x.push(x0 + ((i % cols) + 0.5) * cw); s.y.push(y0 + (Math.floor(i / cols) + 0.5) * ch); }
    const list = [];
    for (let i = 0; i < n; i++) { if (i % cols < cols - 1) list.push([i, i + 1]); if (i + cols < n) list.push([i, i + cols]); }
    setEdges(2, list, true);
    S2 = s;
  }

  function buildAgents(R) {
    const rings = mobile ? [1, 6, 10, 12] : [1, 8, 16, 24];
    const cx = mobile ? W * 0.5 : W * 0.78, cy = H * 0.5;
    const Rr = mobile ? Math.min(H * 0.22, W * 0.4) : Math.min(H * 0.27, W * 0.2);
    const s = { n: 0, cx, cy, R: Rr, ring: [], a0: [], idx: [], rr: [0, 0.36, 0.68, 1] };
    const start = [];
    for (let r = 0; r < 4; r++) { start.push(s.ring.length); for (let j = 0; j < rings[r]; j++) { s.ring.push(r); s.idx.push(j); s.a0.push((j / rings[r]) * TAU + r * 0.45 + (R() - 0.5) * 0.12); } }
    s.n = s.ring.length; s.start = start; s.rings = rings;
    const list = [];
    for (let j = 0; j < rings[1]; j++) { list.push([start[1] + j, 0]); list.push([start[1] + j, start[1] + (j + 1) % rings[1]]); }
    for (let j = 0; j < rings[2]; j++) { list.push([start[2] + j, start[1] + Math.floor((j / rings[2]) * rings[1])]); if (j % 2 === 0) list.push([start[2] + j, start[2] + (j + 1) % rings[2]]); }
    for (let j = 0; j < rings[3]; j++) { list.push([start[3] + j, start[2] + Math.floor((j / rings[3]) * rings[2])]); }
    setEdges(3, list, false);
    S3 = s;
  }

  function buildDescent(R) {
    const M = mobile ? 8 : 12, K = mobile ? 6 : 8;
    const cx = mobile ? W * 0.5 : W * 0.72, cy = mobile ? H * 0.46 : H * 0.52;
    const Rmax = mobile ? Math.min(W * 0.46, H * 0.3) : Math.min(H * 0.38, W * 0.3);
    const s = { M, K, n: M * K, cx, cy, Rmax, a0: [], R0: [], sp: [], paths: [] };
    for (let r = 0; r < M; r++) { s.a0.push((r / M) * TAU + R() * 0.3); s.R0.push(Rmax * (0.55 + 0.45 * R())); s.sp.push(0.85 + R() * 0.4); }
    for (let j = 0; j < 7; j++) {
      const p = new Path2D(), rho = Rmax * (0.16 + 0.15 * j);
      for (let k = 0; k <= 72; k++) {
        const th = (k / 72) * TAU, rr = rho * (1 + 0.06 * Math.sin(3 * th + j * 0.7) + 0.035 * Math.cos(5 * th - j));
        if (k === 0) p.moveTo(rr * Math.cos(th), rr * Math.sin(th)); else p.lineTo(rr * Math.cos(th), rr * Math.sin(th));
      }
      p.closePath(); s.paths.push(p);
    }
    const list = [];
    for (let i = 0; i < s.n - M; i++) list.push([i, i + M]);
    setEdges(4, list, true);
    S4 = s;
  }

  function buildMono() {
    const reg = mobile ? { x: W * 0.14, y: H * 0.09, w: W * 0.72, h: H * 0.34 } : { x: W * 0.56, y: H * 0.2, w: W * 0.36, h: H * 0.58 };
    const oc = document.createElement('canvas'), ow = 420, oh = 240;
    oc.width = ow; oc.height = oh;
    const c = oc.getContext('2d');
    c.fillStyle = '#000'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 230px "Bricolage Grotesque", Arial, sans-serif';
    c.fillText('CM', ow / 2, oh / 2 + 6);
    const img = c.getImageData(0, 0, ow, oh).data;
    let step = 4, pts;
    for (;;) {
      pts = [];
      for (let y = 0; y < oh; y += step) for (let x = 0; x < ow; x += step) if (img[(y * ow + x) * 4 + 3] > 140) pts.push([x, y]);
      if (pts.length <= N || step > 16) break;
      step++;
    }
    if (pts.length > N) { const keep = []; for (let i = 0; i < N; i++) keep.push(pts[Math.floor((i / N) * pts.length)]); pts = keep; }
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    pts.forEach((p) => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); });
    const bw = Math.max(1, maxx - minx), bh = Math.max(1, maxy - miny);
    const k = Math.min(reg.w / bw, reg.h / bh);
    const ox = reg.x + (reg.w - bw * k) / 2, oy = reg.y + (reg.h - bh * k) / 2;
    const s = { n: pts.length, x: [], y: [], cx: reg.x + reg.w / 2, cy: reg.y + reg.h / 2, reg, step: step * k, ml: ox, mr: ox + bw * k, mb: oy + bh * k, mt: oy };
    pts.forEach((p) => { s.x.push(ox + (p[0] - minx) * k); s.y.push(oy + (p[1] - miny) * k); });
    const list = [], lim = step * 1.55 * k;
    for (let i = 0; i < s.n; i++) for (let j = i + 1; j < s.n; j++) if (Math.hypot(s.x[i] - s.x[j], s.y[i] - s.y[j]) <= lim) list.push([i, j]);
    setEdges(5, list, false);
    S5 = s;
  }

  function initPulses() {
    pulses = [];
    const n = mobile ? 14 : 34;
    for (let i = 0; i < n; i++) pulses.push({ s: 0, a: 0, b: 0, u: Math.random(), v: 0.4 + Math.random() * 0.5 });
  }

  function build() {
    mobile = W < 760;
    N = mobile ? 80 : 140;
    const R = rng(11);
    Z = new Float32Array(N); STAG = new Float32Array(N); BEND = new Float32Array(N);
    for (let i = 0; i < N; i++) { Z[i] = 0.6 + R() * 0.8; STAG[i] = R(); BEND[i] = R() * 2 - 1; }
    EA = buf(N); EB = buf(N); F = buf(N);
    buildHero(R); buildAbout(R); buildLattice(); buildAgents(R); buildDescent(R); buildMono();
    initPulses();
  }

  /* ---------------- scene evaluation ---------------- */
  function evalHero(E, st) {
    const s = S0, p = st.p[0], front = st.front, cx = W * 0.62, cy = H * 0.5, wave = 0.1 + p * 1.3;
    for (let i = 0; i < N; i++) {
      if (i >= s.n) { hide(E, i, cx, cy); continue; }
      const z = Z[i], x = s.x[i], y = s.y[i], net = s.layer[i] >= 0;
      const act = clamp((front - x / W) / 0.09);
      const sc = 1 + p * 0.85 * Math.pow(z, 1.6);
      E.x[i] = cx + (x - cx) * sc + st.px * 16 * (z - 1);
      E.y[i] = cy + (y - cy) * sc + st.py * 10 * (z - 1);
      const lp = net ? (x - s.x0) / (s.x1 - s.x0) : -0.5;
      const w = net ? Math.exp(-((lp - wave) * (lp - wave)) / 0.045) : 0;
      const flash = clamp(1 - (front - x / W) / 0.22) * act;
      const g = clamp(act * (net ? 0.3 : 0.5) + w * 0.75 * act + flash * 0.9);
      E.a[i] = 0.25 + 0.75 * act;
      E.r[i] = (net ? (mobile ? 3.2 : 4.6) : (mobile ? 1.6 : 2.1)) * (0.75 + 0.45 * z) * (1 + 0.35 * flash + 0.3 * w);
      setc(E, i, INK, EMBER, g);
      E.v[i] = act; E.g[i] = g; E.h[i] = act < 0.5 ? 1 : 0;
    }
    E.shape = 0;
  }

  function evalAbout(E, st, t) {
    const s = S1, p = st.p[1], ax = s.rx + s.rw * 0.5, ay = s.ry + s.rh * 0.5, vis = ss(0.82, 1, p);
    for (let i = 0; i < N; i++) {
      if (i >= s.n) { hide(E, i, ax, ay); continue; }
      const q = clamp(p * 1.5 - STAG[i] * 0.5 - 0.05), e = sm(q), raw = 1 - e;
      let x = lerp(s.nx[i], s.cx[i], e), y = lerp(s.ny[i], s.cy[i], e);
      const pinch = 1 - 0.74 * Math.pow(Math.sin(Math.PI * q), 1.3);
      y = s.axis + (y - s.axis) * pinch;
      E.x[i] = x + Math.sin(t * 1.2 + i * 1.3) * 3 * raw + st.px * 10 * (Z[i] - 1);
      E.y[i] = y + Math.cos(t * 1.0 + i * 2.1) * 3 * raw + st.py * 8 * (Z[i] - 1);
      const col = ss(0.55, 0.95, q);
      setc(E, i, INK, CLS[s.cls[i]], col);
      E.a[i] = 0.3 + 0.65 * ss(0.2, 0.9, q);
      E.r[i] = (mobile ? 2 : 2.4) + 1.6 * col * Z[i];
      E.v[i] = vis; E.g[i] = col; E.h[i] = 0;
    }
    E.shape = 0;
  }

  function evalLattice(E, st, t) {
    const s = S2, f = clamp(st.stepF, 0, 6), k = Math.min(5, Math.floor(f)), nx = Math.min(5, k + 1);
    const u = ss(0.78, 1, f - k);
    const rx = lerp(s.roi[k][0], s.roi[nx][0], u) * s.cols, ry = lerp(s.roi[k][1], s.roi[nx][1], u) * s.rows;
    st.roiX = rx; st.roiY = ry;
    const scan = ((t * 0.22) % 1) * (s.rows + 2) - 1;
    for (let i = 0; i < N; i++) {
      if (i >= s.n) { hide(E, i, W * 0.5, H * 0.5); continue; }
      const c = i % s.cols, r = Math.floor(i / s.cols);
      const d2 = (c + 0.5 - rx) * (c + 0.5 - rx) + (r + 0.5 - ry) * (r + 0.5 - ry);
      const act = Math.exp(-d2 / (2 * 2.3 * 2.3)), sb = Math.exp(-((r - scan) * (r - scan)) / 0.8) * 0.55;
      const z = Z[i];
      E.x[i] = s.x[i] + st.px * 12 * (z - 1); E.y[i] = s.y[i] + st.py * 9 * (z - 1);
      E.a[i] = 0.28 + 0.62 * act + 0.25 * sb;
      E.r[i] = (mobile ? 1.8 : 2.4) + 3.2 * act * z + 1.2 * sb;
      setc(E, i, INK, EMBER, clamp(act * 1.15 + sb * 0.35));
      E.v[i] = 1; E.g[i] = act; E.h[i] = 0;
    }
    E.shape = 1;
  }

  function evalAgents(E, st, t) {
    const s = S3, g = clamp(st.p[3] * 1.25), th = [0, 0.05, 0.38, 0.72];
    for (let i = 0; i < N; i++) {
      if (i >= s.n) { hide(E, i, s.cx, s.cy); continue; }
      const r = s.ring[i], vis = r === 0 ? 1 : ss(th[r], th[r] + 0.17, g);
      const ang = s.a0[i] + t * 0.07 * (r % 2 ? 1 : -1);
      const rad = s.R * s.rr[r] * (1 + 0.03 * Math.sin(t * 0.8 + i)) * (0.4 + 0.6 * vis);
      const z = Z[i];
      E.x[i] = s.cx + rad * Math.cos(ang) + st.px * 12 * (z - 1);
      E.y[i] = s.cy + rad * Math.sin(ang) * 0.86 + st.py * 9 * (z - 1);
      E.a[i] = vis;
      E.r[i] = r === 0 ? (mobile ? 7 : 9) : (mobile ? 2.4 : 3) + 1.2 * z;
      setc(E, i, r === 1 || r === 3 ? FOREST : INK, EMBER, r === 0 ? 1 : (1 - ss(0, 0.25, g - th[r])) * 0.8);
      E.v[i] = vis; E.g[i] = vis; E.h[i] = 0;
    }
    E.shape = 0;
  }

  function evalDescent(E, st) {
    const s = S4, p = st.p[4], c = Math.cos(-0.45), sn = Math.sin(-0.45);
    for (let i = 0; i < N; i++) {
      if (i >= s.n) { hide(E, i, s.cx, s.cy); continue; }
      const r = i % s.M, k = Math.floor(i / s.M);
      const q = clamp(p * 1.2 - k * 0.065 - 0.02);
      const rad = Math.max(3, s.R0[r] * Math.exp(-3.4 * q)), ang = s.a0[r] + 3.2 * q * s.sp[r];
      const ux = rad * Math.cos(ang), uy = rad * Math.sin(ang) * 0.72;
      E.x[i] = s.cx + ux * c - uy * sn + st.px * 8 * (Z[i] - 1);
      E.y[i] = s.cy + ux * sn + uy * c + st.py * 6 * (Z[i] - 1);
      E.a[i] = k === 0 ? 1 : 0.85 - 0.45 * (k / s.K);
      E.r[i] = k === 0 ? (mobile ? 3.4 : 4.4) : (mobile ? 1.8 : 2.4);
      setc(E, i, k === 0 ? EMBER : FOREST, k === 0 ? EMBER : INK, k === 0 ? 0 : k / s.K);
      E.v[i] = 1; E.g[i] = k === 0 ? 1 : 0; E.h[i] = 0;
    }
    E.shape = 0;
  }

  function evalMono(E, st, t) {
    const s = S5;
    for (let i = 0; i < N; i++) {
      if (i >= s.n) { hide(E, i, s.cx, s.cy); continue; }
      const z = Z[i];
      E.x[i] = s.x[i] + Math.sin(t * 0.9 + i * 1.7) * 1.3 + st.px * 8 * (z - 1);
      E.y[i] = s.y[i] + Math.cos(t * 0.8 + i * 1.3) * 1.3 + st.py * 6 * (z - 1);
      E.a[i] = 0.55 + 0.4 * z * 0.7;
      E.r[i] = (mobile ? 2.1 : 2.8) * (0.8 + 0.4 * z);
      setc(E, i, INK, EMBER, i % 7 === 0 ? 1 : 0);
      E.v[i] = 1; E.g[i] = i % 7 === 0 ? 1 : 0; E.h[i] = 0;
    }
    E.shape = 0;
  }

  const EVAL = [evalHero, evalAbout, evalLattice, evalAgents, evalDescent, evalMono];

  /* ---------------- drawing ---------------- */
  function drawEdges(s, w, E, d) {
    const e = edges[s];
    if (!e || w < 0.01) return;
    adapt(22, 24, 26, d);
    const lr = ar, lg = ag, lb = ab, base = EDGE_A[s] * w;
    ctx.lineWidth = s === 4 ? 1.2 : 0.8;
    for (let k = 0; k < e.length; k += 2) {
      const i = e[k], j = e[k + 1], v = Math.min(E.v[i], E.v[j]);
      if (v < 0.03) continue;
      const a = base * v * Math.min(1, F.a[i] + 0.15) * Math.min(1, F.a[j] + 0.15);
      ctx.strokeStyle = rgba(lr, lg, lb, a);
      ctx.beginPath(); ctx.moveTo(F.x[i], F.y[i]); ctx.lineTo(F.x[j], F.y[j]); ctx.stroke();
      if (s === 0) {
        const g = Math.min(E.g[i], E.g[j]);
        if (g > 0.35) { adapt(255, 122, 69, d); ctx.strokeStyle = rgba(ar, ag, ab, w * (g - 0.35) * 0.95); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(F.x[i], F.y[i]); ctx.lineTo(F.x[j], F.y[j]); ctx.stroke(); ctx.lineWidth = 0.8; }
      }
    }
  }

  function respawn(p, a, b, wA, wB) {
    const tot = wA + wB;
    if (tot < 0.02) return;
    let s = Math.random() * tot < wA ? a : b;
    if (!edges[s]) s = edges[a] ? a : b;
    const e = edges[s];
    if (!e) return;
    const k = ((Math.random() * e.length) / 2 | 0) * 2;
    p.s = s; p.a = e[k]; p.b = e[k + 1]; p.u = 0;
  }

  function drawPulses(st, dt, a, b, wA, wB, d) {
    adapt(255, 122, 69, d);
    const gr = ar, gg = ag, gb = ab;
    for (let q = 0; q < pulses.length; q++) {
      const p = pulses[q], w = p.s === a ? wA : p.s === b ? wB : 0;
      if (w < 0.06 || !edges[p.s]) { respawn(p, a, b, wA, wB); continue; }
      const E = p.s === a ? EA : EB;
      p.u += p.v * dt * (p.s === 0 ? 1.25 : 1);
      if (p.u >= 1) {
        const list = adj[p.s] && adj[p.s][p.b];
        if (list && list.length) { p.a = p.b; p.b = list[(Math.random() * list.length) | 0]; p.u -= 1; } else { respawn(p, a, b, wA, wB); continue; }
      }
      const v = Math.min(E.v[p.a], E.v[p.b]);
      if (v < 0.5) continue;
      const hx = lerp(F.x[p.a], F.x[p.b], p.u), hy = lerp(F.y[p.a], F.y[p.b], p.u), u2 = Math.max(0, p.u - 0.18);
      const tx = lerp(F.x[p.a], F.x[p.b], u2), ty = lerp(F.y[p.a], F.y[p.b], u2), al = w * v;
      ctx.strokeStyle = rgba(gr, gg, gb, al * 0.6); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = rgba(gr, gg, gb, al);
      ctx.beginPath(); ctx.arc(hx, hy, mobile ? 2.2 : 2.8, 0, TAU); ctx.fill();
    }
  }

  function label(txt, x, y, a, d, align) {
    adapt(22, 24, 26, d);
    ctx.fillStyle = rgba(ar, ag, ab, a); ctx.textAlign = align || 'left'; ctx.fillText(txt, x, y);
  }

  function overAbout(w, st, d) {
    const s = S1, p = st.p[1];
    ctx.font = MONO;
    adapt(22, 24, 26, d);
    ctx.setLineDash([3, 5]); ctx.lineWidth = 1;
    const names = ['raw', 'features', 'embeddings'];
    for (let k = 0; k < 3; k++) {
      const x = s.rx + s.rw * s.gates[k], on = ss(k * 0.22, k * 0.22 + 0.25, p);
      ctx.strokeStyle = rgba(ar, ag, ab, w * (0.12 + 0.2 * on)); ctx.beginPath(); ctx.moveTo(x, s.ry - 12); ctx.lineTo(x, s.ry + s.rh + 12); ctx.stroke();
      label(names[k], x, s.ry - 18, w * (0.35 + 0.45 * on), d, 'center');
    }
    ctx.setLineDash([]);
    const t3 = ['Languages', 'AI & ML', 'Build'], a = w * ss(0.85, 1, p);
    for (let c = 0; c < 3; c++) label(t3[c], s.rx + s.rw * s.cf[c][0], s.ry + s.rh * s.cf[c][1] - s.rh * 0.2, a * 0.85, d, 'center');
  }

  function overLattice(w, st, d) {
    const s = S2, x = s.x0 + st.roiX * s.cw, y = s.y0 + st.roiY * s.ch, rw = s.cw * 3.6, rh = s.ch * 3;
    ctx.font = MONO; adapt(232, 80, 31, d);
    ctx.strokeStyle = rgba(ar, ag, ab, w * 0.85); ctx.lineWidth = 1.5;
    ctx.strokeRect(x - rw / 2, y - rh / 2, rw, rh);
    if (!mobile) { ctx.fillStyle = rgba(ar, ag, ab, w * 0.035); ctx.fillRect(x - rw / 2, y - rh / 2, rw, rh); }
    ctx.fillStyle = rgba(ar, ag, ab, w * 0.9); ctx.textAlign = 'left'; ctx.fillText('roi', x - rw / 2 + 2, y - rh / 2 - 6);
  }

  function overAgents(w, st, d) {
    const s = S3, a = w * ss(0.05, 0.25, st.p[3]);
    ctx.font = MONO;
    label('memory', s.cx, s.cy + (mobile ? 22 : 26), a * 0.85, d, 'center');
    label('agents', s.cx + s.R * 0.68 + 14, s.cy - s.R * 0.68 * 0.86 - 6, a * ss(0.35, 0.6, st.p[3]) * 0.8, d, 'left');
  }

  function underDescent(w, st, d) {
    if (w < 0.01) return;
    const s = S4;
    adapt(22, 24, 26, d);
    ctx.save(); ctx.translate(s.cx, s.cy); ctx.rotate(-0.45); ctx.scale(1, 0.72); ctx.lineWidth = 1;
    for (let j = 0; j < s.paths.length; j++) { ctx.strokeStyle = rgba(ar, ag, ab, w * (0.16 - j * 0.008)); ctx.stroke(s.paths[j]); }
    ctx.restore();
  }
  function overDescent(w, st, d) {
    const s = S4, p = st.p[4], on = ss(0.7, 1, p);
    ctx.font = MONO; adapt(232, 80, 31, d);
    ctx.strokeStyle = rgba(ar, ag, ab, w * on * 0.9); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(s.cx, s.cy, 8 + on * 4, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(ar, ag, ab, w * on); ctx.textAlign = 'left'; ctx.fillText('minimum', s.cx + 18, s.cy - 14);
  }

  function overMono(w, st, t, d) {
    const c = CM.contact, p = st.p[5];
    if (!c || w < 0.02) return;
    adapt(232, 80, 31, d); const er = ar, eg = ag, eb = ab;
    adapt(22, 24, 26, d);
    const lr = ar, lg = ag, lb = ab, S = S5;
    ctx.lineWidth = 1.2;
    const trunk = ss(0.2, 0.4, p), bus = ss(0.38, 0.6, p);
    const mx = c.mobile ? S.cx : S.ml - 16, my = c.mobile ? S.mb + 16 : S.cy, bx = c.bx, ys = c.ys;
    const top = Math.min(my, ys[0]), bot = Math.max(my, ys[ys.length - 1]);
    ctx.strokeStyle = rgba(lr, lg, lb, w * 0.55);
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(lerp(mx, bx, trunk), my); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, my); ctx.lineTo(bx, lerp(my, top, bus)); ctx.moveTo(bx, my); ctx.lineTo(bx, lerp(my, bot, bus)); ctx.stroke();
    for (let k = 0; k < ys.length; k++) {
      const tk = ss(0.55 + k * 0.06, 0.65 + k * 0.06, p);
      ctx.strokeStyle = rgba(er, eg, eb, w * 0.9 * tk);
      ctx.beginPath(); ctx.moveTo(bx, ys[k]); ctx.lineTo(lerp(bx, c.lx, tk), ys[k]); ctx.stroke();
      ctx.fillStyle = rgba(er, eg, eb, w * tk); ctx.beginPath(); ctx.arc(bx, ys[k], 3, 0, TAU); ctx.fill();
    }
    if (p > 0.72) {
      const cyc = t * 0.45, k = Math.floor(cyc) % ys.length, u = cyc - Math.floor(cyc);
      const L1 = Math.abs(bx - mx), L2 = Math.abs(ys[k] - my), L3 = Math.abs(c.lx - bx), tot = L1 + L2 + L3, dd = u * tot;
      let x, y;
      if (dd < L1) { x = lerp(mx, bx, dd / L1); y = my; } else if (dd < L1 + L2) { x = bx; y = lerp(my, ys[k], (dd - L1) / L2); } else { x = lerp(bx, c.lx, (dd - L1 - L2) / L3); y = ys[k]; }
      ctx.fillStyle = rgba(er, eg, eb, w * 0.95); ctx.beginPath(); ctx.arc(x, y, 3.6, 0, TAU); ctx.fill();
    }
    const ping = ss(0.82, 0.95, p);
    if (ping > 0.01) {
      ctx.lineWidth = 1.5;
      for (let j = 0; j < 3; j++) {
        const tau = (t * 0.32 + j / 3) % 1;
        ctx.strokeStyle = rgba(er, eg, eb, w * ping * (1 - tau) * 0.45);
        ctx.beginPath(); ctx.arc(S.cx, S.cy, 20 + tau * Math.max(W, H) * 0.55, 0, TAU); ctx.stroke();
      }
    }
  }

  function draw(st, t, dt) {
    if (!ctx || !N) return;
    const d = st.d, a = st.a, b = Math.min(a + 1, 5), m = st.m;
    const blend = m > 0.002 && b !== a;
    EVAL[a](EA, st, t);
    if (blend) EVAL[b](EB, st, t);
    const wA = blend ? 1 - sm(m) : 1, wB = blend ? sm(m) : 0;
    const amul = mobile ? lerp(MUL[a], MUL[b], blend ? sm(m) : 0) : 1;
    for (let i = 0; i < N; i++) {
      const e = blend ? sm(clamp(m * 1.7 - STAG[i] * 0.7)) : 0;
      let x = lerp(EA.x[i], EB.x[i], e), y = lerp(EA.y[i], EB.y[i], e);
      if (blend) {
        const dx = EB.x[i] - EA.x[i], dy = EB.y[i] - EA.y[i], len = Math.hypot(dx, dy);
        if (len > 1) { const off = BEND[i] * Math.sin(Math.PI * e) * Math.min(len * 0.16, 70); x += (-dy / len) * off; y += (dx / len) * off; }
      }
      F.x[i] = x; F.y[i] = y;
      F.a[i] = lerp(EA.a[i], EB.a[i], e) * amul; F.r[i] = lerp(EA.r[i], EB.r[i], e);
      F.cr[i] = lerp(EA.cr[i], EB.cr[i], e); F.cg[i] = lerp(EA.cg[i], EB.cg[i], e); F.cb[i] = lerp(EA.cb[i], EB.cb[i], e);
      F.h[i] = lerp(EA.h[i], EB.h[i], e);
    }
    F.shape = m < 0.5 ? EA.shape : EB.shape;
    if (!mobile && st.mx > -999) {
      const R2 = 110 * 110;
      for (let i = 0; i < N; i++) {
        const dx = F.x[i] - st.mx, dy = F.y[i] - st.my, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 1) { const k = (1 - d2 / R2) * 16 / Math.sqrt(d2); F.x[i] += dx * k; F.y[i] += dy * k; }
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = MONO;

    if (a === 4) underDescent(wA, st, d); else if (b === 4) underDescent(wB, st, d);
    drawEdges(a, wA, EA, d);
    if (blend) drawEdges(b, wB, EB, d);
    const over = (s, w) => {
      if (w < 0.01) return;
      if (s === 1) overAbout(w, st, d); else if (s === 2) overLattice(w, st, d); else if (s === 3) overAgents(w, st, d);
      else if (s === 4) overDescent(w, st, d); else if (s === 5) overMono(w, st, t, d);
    };
    over(a, wA); if (blend) over(b, wB);
    drawPulses(st, dt, a, b, wA, wB, d);

    const sq = F.shape === 1;
    for (let i = 0; i < N; i++) {
      const al = F.a[i], r = F.r[i];
      if (al < 0.02 || r < 0.2) continue;
      adapt(F.cr[i], F.cg[i], F.cb[i], d);
      if (F.h[i] > 0.5) {
        ctx.strokeStyle = rgba(ar, ag, ab, al * 1.6); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(F.x[i], F.y[i], r, 0, TAU); ctx.stroke(); continue;
      }
      if (EA.g[i] > 0.6 && !sq) { ctx.fillStyle = rgba(ar, ag, ab, al * 0.16); ctx.beginPath(); ctx.arc(F.x[i], F.y[i], r * 2.6, 0, TAU); ctx.fill(); }
      ctx.fillStyle = rgba(ar, ag, ab, al);
      if (sq) ctx.fillRect(F.x[i] - r, F.y[i] - r, r * 2, r * 2);
      else { ctx.beginPath(); ctx.arc(F.x[i], F.y[i], r, 0, TAU); ctx.fill(); }
    }
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    const nw = Math.round(r.width), nh = Math.round(r.height);
    if (!nw || !nh) return false;
    dpr = Math.min(window.devicePixelRatio || 1, nw < 760 ? 1.75 : 2);
    const changed = nw !== W || nh !== H;
    W = nw; H = nh;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    build();
    return changed;
  }

  CM.system = {
    init() { cv = document.getElementById('system'); if (!cv) return false; ctx = cv.getContext('2d'); resize(); return true; },
    resize,
    rebuildMono() { if (cv && W) buildMono(); },
    draw,
    get size() { return { W, H, mobile }; },
  };
})();
