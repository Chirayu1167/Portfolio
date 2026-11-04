/* Chirayu Mahajan — portfolio
   No animation library: CSS handles the visuals, JS only toggles classes and
   drives three small canvases (dust, signal, static). Every effect either
   ends in the visible state or is removed when it finishes. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var pad = function (n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; };
  var hero = $('#hero');

  /* ------------------------------------------------------------------
     NAV (mobile panel)
  ------------------------------------------------------------------ */
  var toggle = $('#nav-toggle'), panel = $('#nav-panel');
  function setPanel(open) {
    panel.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
  }
  toggle.addEventListener('click', function () { setPanel(!panel.classList.contains('is-open')); });
  $$('a', panel).forEach(function (a) { a.addEventListener('click', function () { setPanel(false); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) { setPanel(false); toggle.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (panel.classList.contains('is-open') && !e.target.closest('#nav')) setPanel(false);
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 1000) setPanel(false); });

  /* ------------------------------------------------------------------
     TWO WORLDS: Hawkins (normal) and the Upside Down.
     Sections declare data-world; crossing between them plays one brief cut.
  ------------------------------------------------------------------ */
  var atmosEl = $('.atmos'), worldEl = $('#world'), worldText = $('#world-text'), crossEl = $('#cross');
  var world = 'up', worldInit = false, lastCross = 0, sporeTarget = 1, sporeLevel = 1;
  var LABELS = { up: 'The Upside Down', normal: 'Hawkins, Indiana' };

  function setWorld(w, sec) {
    if (worldInit && w === world) return;
    var first = !worldInit; worldInit = true; world = w;
    atmosEl.setAttribute('data-world', w); doc.setAttribute('data-world', w);
    if (worldText) worldText.textContent = LABELS[w];
    sporeTarget = w === 'up' ? 1 : 0.12;
    if (reduce) { sporeLevel = sporeTarget; return; }
    if (first) return;
    var now = performance.now();
    if (now - lastCross < 1400) return;
    lastCross = now; crossing(sec);
  }
  function crossing(sec) {
    crossEl.classList.remove('is-crossing'); void crossEl.offsetWidth; crossEl.classList.add('is-crossing');
    setTimeout(function () { crossEl.classList.remove('is-crossing'); }, 900);
    if (worldEl) { worldEl.classList.remove('is-flick'); void worldEl.offsetWidth; worldEl.classList.add('is-flick'); setTimeout(function () { worldEl.classList.remove('is-flick'); }, 800); }
    setTimeout(function () {
      var h = sec && $('.sec-title', sec);
      if (h && !h.hasAttribute('data-reveal')) glitchEl(h);
    }, 380);
    signalInterference();
  }
  document.addEventListener('atmos:cross', function () { crossing(null); });

  /* ------------------------------------------------------------------
     SECTION SPY, PROGRESS BAR, READOUT
  ------------------------------------------------------------------ */
  var sections = $$('section[data-label]');
  var links = $$('.nav__links a, .nav__panel a');
  var roSec = $('#ro-sec'), roPct = $('#ro-pct'), progress = $('#progress');
  var currentId = '';

  function setActive(id) {
    if (id === currentId) return;
    currentId = id;
    links.forEach(function (a) {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    var idx = sections.findIndex(function (s) { return s.id === id; });
    if (idx >= 0) {
      roSec.textContent = pad(idx, 2) + ' ' + sections[idx].dataset.label;
      setWorld(sections[idx].dataset.world || 'normal', sections[idx]);
    }
  }
  if (hasIO) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  var scrollTick = false, lastPct = -1;
  function onScroll() {
    scrollTick = false;
    var max = doc.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
    progress.style.setProperty('--p', p.toFixed(4));
    atmosEl.classList.toggle('is-covered', window.scrollY < hero.offsetHeight * 0.5);
    var pct = Math.round(p * 100);
    if (pct !== lastPct) { lastPct = pct; roPct.textContent = pad(pct, 3) + '%'; }
  }
  window.addEventListener('scroll', function () {
    if (!scrollTick) { scrollTick = true; requestAnimationFrame(onScroll); }
    scheduleSweep();
  }, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------
     FILM GRAIN (one generated tile, moved with CSS steps())
  ------------------------------------------------------------------ */
  (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'), d = x.createImageData(128, 128);
    for (var i = 0; i < d.data.length; i += 4) {
      var v = Math.random() * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    $('#grain').style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
  })();

  /* ------------------------------------------------------------------
     SCROLL REVEAL
     Hidden state exists only while this block is active. Elements are
     revealed once, stay revealed in both scroll directions, and the
     data-reveal attribute is removed afterwards so hover styles are free.
  ------------------------------------------------------------------ */
  var sweepTimer = 0;
  function reveal(el) {
    if (el.classList.contains('is-in')) return;
    var delay = parseFloat(el.style.getPropertyValue('--d')) || 0;
    el.classList.add('is-in');
    setTimeout(function () { el.removeAttribute('data-reveal'); el.style.removeProperty('--d'); }, 2000 + delay * 1000);
  }
  function sweep() {
    // safety net: anything on screen that is still waiting gets revealed
    $$('[data-reveal]:not(.is-in)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight * 0.98) reveal(el);
    });
  }
  var sweepBusy = false;
  function scheduleSweep() {
    clearTimeout(sweepTimer); sweepTimer = setTimeout(sweep, 250);
    if (!sweepBusy) { sweepBusy = true; setTimeout(function () { sweepBusy = false; sweep(); }, 350); }
  }

  if (!reduce && hasIO) {
    $$('[data-stagger]').forEach(function (parent) {
      Array.prototype.forEach.call(parent.children, function (child, i) {
        if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', '');
        child.style.setProperty('--d', (Math.min(i, 6) * 0.08).toFixed(2) + 's');
      });
    });
    doc.classList.add('js-reveal');
    // A fully clipped element (clip-path wipe) never reports as intersecting, so
    // wipe elements are revealed when their parent scrolls into view instead.
    var kids = new Map(), targets = new Set();
    $$('[data-reveal]').forEach(function (el) {
      if (el.getAttribute('data-reveal') === 'wipe' && el.parentElement) {
        var par = el.parentElement;
        if (!kids.has(par)) kids.set(par, []);
        kids.get(par).push(el); targets.add(par);
      } else targets.add(el);
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var t = en.target;
        if (t.hasAttribute('data-reveal')) reveal(t);
        (kids.get(t) || []).forEach(function (k) { setTimeout(function () { reveal(k); }, 120); });
        io.unobserve(t);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    targets.forEach(function (el) { io.observe(el); });
    window.addEventListener('load', sweep);
    window.addEventListener('resize', scheduleSweep);
    setTimeout(sweep, 600);
  }

  /* hero entrance is pure CSS; drop the hook once each piece has finished */
  $$('[data-seq]').forEach(function (el) {
    el.addEventListener('animationend', function (e) {
      if (e.target === el && e.animationName === 'seq-in') el.removeAttribute('data-seq');
    });
  });

  /* ------------------------------------------------------------------
     AMBIENT DUST + SPORES (very slow; spores belong to the Upside Down)
  ------------------------------------------------------------------ */
  var dustCanvas = $('#dust'), dctx = dustCanvas.getContext('2d');
  var dust = [], spores = [], dw = 0, dh = 0, dustRaf = 0, dustLast = 0;
  function sizeDust() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    dw = window.innerWidth; dh = window.innerHeight;
    dustCanvas.width = Math.round(dw * dpr); dustCanvas.height = Math.round(dh * dpr);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = dw < 700 ? 20 : 36, m = dw < 700 ? 12 : 26, i;
    dust = []; spores = [];
    for (i = 0; i < n; i++) dust.push({ x: Math.random() * dw, y: Math.random() * dh, s: 0.6 + Math.random() * 1.0,
      a: 0.07 + Math.random() * 0.2, vy: 0.006 + Math.random() * 0.016, ph: Math.random() * 6.28, red: Math.random() < 0.1 });
    for (i = 0; i < m; i++) spores.push({ x: Math.random() * dw, y: Math.random() * dh, s: 1.2 + Math.random() * 2.1,
      a: 0.12 + Math.random() * 0.22, vy: 0.005 + Math.random() * 0.012, ph: Math.random() * 6.28, red: Math.random() < 0.5 });
  }
  function drawDust(t, dt) {
    dctx.clearRect(0, 0, dw, dh);
    var i, p;
    for (i = 0; i < dust.length; i++) {
      p = dust[i];
      if (dt) { p.y -= p.vy * dt; p.x += Math.sin(t * 0.0003 + p.ph) * 0.008 * dt; if (p.y < -4) { p.y = dh + 4; p.x = Math.random() * dw; } }
      dctx.fillStyle = p.red ? 'rgba(198,40,40,' + (p.a * 0.9).toFixed(3) + ')' : 'rgba(232,228,220,' + p.a.toFixed(3) + ')';
      dctx.fillRect(p.x, p.y, p.s, p.s);
    }
    if (dt) sporeLevel += (sporeTarget - sporeLevel) * Math.min(1, dt / 900);
    if (sporeLevel > 0.02) {
      for (i = 0; i < spores.length; i++) {
        p = spores[i];
        if (dt) { p.y -= p.vy * dt; p.x += Math.sin(t * 0.00025 + p.ph) * 0.012 * dt; if (p.y < -8) { p.y = dh + 8; p.x = Math.random() * dw; } }
        var al = p.a * sporeLevel, rgb = p.red ? '198,40,40' : '232,228,220';
        dctx.fillStyle = 'rgba(' + rgb + ',' + (al * 0.16).toFixed(3) + ')';
        dctx.beginPath(); dctx.arc(p.x, p.y, p.s * 3.2, 0, 6.283); dctx.fill();
        dctx.fillStyle = 'rgba(' + rgb + ',' + al.toFixed(3) + ')';
        dctx.beginPath(); dctx.arc(p.x, p.y, p.s * 0.8, 0, 6.283); dctx.fill();
      }
    }
  }
  function dustLoop(t) {
    dustRaf = 0;
    if (t - dustLast >= 33) { var dt = Math.min(t - dustLast, 64); dustLast = t; drawDust(t, dt); }
    if (!document.hidden) dustRaf = requestAnimationFrame(dustLoop);
  }
  sizeDust(); drawDust(0, 0);
  if (!reduce) {
    dustRaf = requestAnimationFrame(dustLoop);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !dustRaf) { dustLast = performance.now(); dustRaf = requestAnimationFrame(dustLoop); }
    });
  }
  var rzT; window.addEventListener('resize', function () { clearTimeout(rzT); rzT = setTimeout(function () { sizeDust(); drawDust(0, 0); }, 200); });

  /* ------------------------------------------------------------------
     SIGNAL MODULE (oscilloscope; spikes when interference fires)
  ------------------------------------------------------------------ */
  var sigEl = $('#signal'), wave = $('#sig-wave'), sctx = wave.getContext('2d');
  var sigState = $('#sig-state'), sigCount = $('#sig-count'), sigXY = $('#sig-xy');
  var samples = [], sw = 0, sh = 0, spike = 0, sigRaf = 0, sigVisible = true, interference = 0, stateTimer = 0;

  function sizeWave() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    sw = wave.clientWidth; sh = wave.clientHeight;
    wave.width = Math.round(sw * dpr); wave.height = Math.round(sh * dpr);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    samples = []; for (var i = 0; i < Math.ceil(sw / 2) + 2; i++) samples.push(0);
  }
  function drawWave(now) {
    sctx.clearRect(0, 0, sw, sh);
    sctx.strokeStyle = 'rgba(232,228,220,0.08)'; sctx.lineWidth = 1;
    sctx.beginPath(); sctx.moveTo(0, sh / 2 + 0.5); sctx.lineTo(sw, sh / 2 + 0.5); sctx.stroke();
    sctx.strokeStyle = spike > 0.05 ? 'rgba(198,40,40,0.95)' : 'rgba(232,228,220,0.72)';
    sctx.beginPath();
    for (var i = 0; i < samples.length; i++) {
      var x = i * 2, y = sh / 2 - samples[i];
      if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
    }
    sctx.stroke();
  }
  function stepWave(now) {
    var base = (Math.random() - 0.5) * 1.6 + Math.sin(now / 700) * 1.2;
    var ph = (now % 2600) / 2600;
    if (ph < 0.05) base += Math.sin(ph / 0.05 * Math.PI) * 13;     // small recurring pulse
    base += (Math.random() - 0.5) * 2 * spike * 20;                  // interference
    spike *= 0.955; if (spike < 0.01) spike = 0;
    samples.push(base); samples.shift();
  }
  var sigLast = 0;
  function sigLoop(now) {
    sigRaf = 0;
    if (now - sigLast >= 33) { sigLast = now; stepWave(now); drawWave(now); }   // 30 fps scope
    if (sigVisible && !document.hidden) sigRaf = requestAnimationFrame(sigLoop);
  }
  function startSig() { if (!sigRaf && !reduce) sigRaf = requestAnimationFrame(sigLoop); }
  sizeWave();
  if (reduce) { samples[Math.floor(samples.length * 0.6)] = 10; drawWave(0); }
  else {
    startSig();
    if (hasIO) new IntersectionObserver(function (en) { sigVisible = en[0].isIntersecting; startSig(); }).observe(sigEl);
    document.addEventListener('visibilitychange', startSig);
  }
  window.addEventListener('resize', function () { clearTimeout(sizeWave._t); sizeWave._t = setTimeout(function () { sizeWave(); if (reduce) drawWave(0); }, 200); });

  function signalInterference() {
    spike = 1; interference++;
    sigCount.textContent = pad(interference, 2);
    sigState.textContent = 'Unstable'; sigEl.classList.add('is-unstable');
    clearTimeout(stateTimer);
    stateTimer = setTimeout(function () { sigState.textContent = 'Stable'; sigEl.classList.remove('is-unstable'); }, 1600);
  }

  /* ------------------------------------------------------------------
     HERO: cursor-lit grid + coordinates (mouse only)
  ------------------------------------------------------------------ */
  if (finePointer) {
    var hx = 0, hy = 0, heroTick = false, lastXY = '';
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      hx = e.clientX - r.left; hy = e.clientY - r.top;
      if (!heroTick) {
        heroTick = true;
        requestAnimationFrame(function () {
          heroTick = false;
          if (!reduce) { hero.style.setProperty('--mx', hx + 'px'); hero.style.setProperty('--my', hy + 'px'); }
          var t = 'X ' + pad(Math.round(hx), 4) + ' Y ' + pad(Math.round(hy), 4);
          if (t !== lastXY) { lastXY = t; sigXY.textContent = t; }
        });
      }
    }, { passive: true });
    if (!reduce) {
      hero.addEventListener('pointerenter', function () { hero.classList.add('is-lit'); });
      hero.addEventListener('pointerleave', function () { hero.classList.remove('is-lit'); });
    }
  }

  /* ------------------------------------------------------------------
     HERO SCENE PARALLAX (pointer on desktop, scroll everywhere)
     Loop runs only while the hero is on screen and values are still easing.
  ------------------------------------------------------------------ */
  var scene = $('#scene'), heroInView = true;
  if (hasIO) new IntersectionObserver(function (en) { heroInView = en[0].isIntersecting; scene.classList.toggle('is-paused', !heroInView); if (heroInView) kick(); }).observe(hero);
  var tpx = 0, tpy = 0, cpx = 0, cpy = 0, tsy = 0, csy = 0, pRaf = 0;
  function pLoop() {
    pRaf = 0;
    cpx += (tpx - cpx) * 0.07; cpy += (tpy - cpy) * 0.07; csy += (tsy - csy) * 0.18;
    scene.style.setProperty('--px', cpx.toFixed(3)); scene.style.setProperty('--py', cpy.toFixed(3)); scene.style.setProperty('--sy', csy.toFixed(1));
    if (heroInView && (Math.abs(tpx - cpx) > 0.002 || Math.abs(tpy - cpy) > 0.002 || Math.abs(tsy - csy) > 0.2)) pRaf = requestAnimationFrame(pLoop);
  }
  function kick() { if (!pRaf && !reduce) pRaf = requestAnimationFrame(pLoop); }
  if (!reduce) {
    window.addEventListener('scroll', function () { tsy = Math.min(window.scrollY, hero.offsetHeight); kick(); }, { passive: true });
    tsy = Math.min(window.scrollY, hero.offsetHeight); csy = tsy; kick();
    if (finePointer) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        tpx = ((e.clientX - r.left) / r.width - 0.5) * 2; tpy = ((e.clientY - r.top) / r.height - 0.5) * 2; kick();
      }, { passive: true });
      hero.addEventListener('pointerleave', function () { tpx = 0; tpy = 0; kick(); });
    }
  }

  /* ------------------------------------------------------------------
     OCCASIONAL EVENTS: heading glitch, light flicker, VHS tracking, lightning.
     One scheduler, widely spaced; lightning only happens in the Upside Down.
  ------------------------------------------------------------------ */
  var atmos = $('.atmos');
  var glitchables = $$('[data-glitch]'), onScreen = new Set();
  if (hasIO) {
    var gio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) onScreen.add(en.target); else onScreen.delete(en.target); });
    });
    glitchables.forEach(function (el) { gio.observe(el); });
  }
  function restart(el, cls, ms) {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms);
  }
  function glitchEl(el) {
    if (!el || el.classList.contains('is-glitching')) return;
    el.classList.add('is-glitching');
    setTimeout(function () { el.classList.remove('is-glitching'); }, 280);
  }
  function glitch() {
    var cands = Array.from(onScreen).filter(function (el) {
      return !el.hasAttribute('data-reveal') && !el.hasAttribute('data-seq') && !el.classList.contains('is-glitching');
    });
    var headings = cands.filter(function (el) { return el.tagName !== 'SPAN'; });
    var pool = headings.length && Math.random() < 0.85 ? headings : cands;
    if (!pool.length) return;
    glitchEl(pool[Math.floor(Math.random() * pool.length)]);
    signalInterference();
    if (heroInView && Math.random() < 0.5) restart(scene, 'is-tracking', 950);
  }
  function flicker() {
    restart(atmos, 'is-flicker', 420);
    if (heroInView) restart(scene, 'is-flicker', 450);
  }
  var bolts = $$('.bolt'), lastBolt = 0;
  function flashPage() { restart(crossEl, 'is-flash', 1050); }
  function strike() {
    lastBolt = performance.now();
    flashPage();
    if (!heroInView || !bolts.length) return;
    var b = bolts[Math.floor(Math.random() * bolts.length)];
    b.style.setProperty('--bx', (22 + Math.random() * 56).toFixed(0) + '%');
    b.style.setProperty('--bf', Math.random() < 0.5 ? '1' : '-1');
    restart(b, 'is-striking', 1050); restart(scene, 'is-bolt', 1050);
    signalInterference();
  }
  document.addEventListener('atmos:strike', strike);
  document.addEventListener('atmos:glitch', glitch);
  function pick() {
    var now = performance.now(), r = Math.random();
    if (world === 'up' && now - lastBolt > 15000 && r < 0.42) strike();
    else if (r < 0.78) glitch(); else flicker();
  }
  function schedule(first) {
    setTimeout(function () {
      if (!document.hidden) pick();
      schedule(false);
    }, first ? 6500 : 7000 + Math.random() * 8000);
  }
  if (!reduce) schedule(true);

  /* ------------------------------------------------------------------
     PROJECT PREVIEWS: static for projects without a screenshot
  ------------------------------------------------------------------ */
  function drawStatic(cv) {
    var x = cv.getContext('2d'), w = cv.width, h = cv.height, d = x.createImageData(w, h);
    for (var i = 0; i < d.data.length; i += 4) {
      var v = 20 + Math.random() * 150, hot = Math.random() < 0.03;
      d.data[i] = v + (hot ? 70 : 0); d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
  }
  $$('.exp').forEach(function (row) {
    var cv = $('canvas.static', row), prev = $('.preview', row), timer = 0;
    if (cv) drawStatic(cv);
    if (reduce) return;
    function on() {
      if (cv && !timer) timer = setInterval(function () { drawStatic(cv); }, 100);
      prev.classList.add('is-aberrating');
      setTimeout(function () { prev.classList.remove('is-aberrating'); }, 180);
    }
    function off() { if (timer) { clearInterval(timer); timer = 0; } }
    row.addEventListener('pointerenter', on); row.addEventListener('pointerleave', off);
    row.addEventListener('focusin', on); row.addEventListener('focusout', off);
  });

  /* ------------------------------------------------------------------
     PROJECT ROWS: the revealed scene follows the pointer slightly
  ------------------------------------------------------------------ */
  if (finePointer && !reduce) {
    $$('.exp').forEach(function (row) {
      var tick = false, nx = 0, ny = 0;
      row.addEventListener('pointermove', function (e) {
        var r = row.getBoundingClientRect();
        nx = ((e.clientX - r.left) / r.width - 0.5) * 2; ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
        if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; row.style.setProperty('--mx', nx.toFixed(3)); row.style.setProperty('--my', ny.toFixed(3)); }); }
      }, { passive: true });
      row.addEventListener('pointerleave', function () { row.style.setProperty('--mx', 0); row.style.setProperty('--my', 0); });
    });
  }

  /* ------------------------------------------------------------------
     ALPHABET WALL: when it scrolls into view the lights spell a message
  ------------------------------------------------------------------ */
  var wall = $('#wall');
  if (wall && !reduce && hasIO) {
    var cells = {}, allCells = $$('.cell', wall), wallVisible = false, spelled = false;
    allCells.forEach(function (c) { (cells[c.dataset.l] = cells[c.dataset.l] || []).push(c); });
    var lit = function (c, ms) { restart(c, 'is-lit', ms); };
    var spell = function (msg) {
      var t = 0;
      msg.split('').forEach(function (ch) {
        if (ch === ' ') { t += 750; return; }
        var c = cells[ch] && cells[ch][0];
        if (c) (function (c, at) { setTimeout(function () { lit(c, 560); }, at); })(c, t);
        t += 680;
      });
      return t;
    };
    new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        wallVisible = e.isIntersecting;
        if (e.isIntersecting && !spelled) {
          spelled = true;
          var total = spell('SAY HELLO');
          setTimeout(function () {
            setInterval(function () {
              if (document.hidden || !wallVisible) return;
              lit(allCells[Math.floor(Math.random() * allCells.length)], 420);
            }, 3200);
          }, total + 1200);
        }
      });
    }, { threshold: 0.6 }).observe(wall);
  }
})();
