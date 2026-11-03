/* Chirayu Mahajan — portfolio
   No animation library: CSS handles the visuals, JS only toggles classes and
   drives three small canvases (dust, signal, static). Every effect either
   ends in the visible state or is removed when it finishes. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var pad = function (n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; };

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
    if (idx >= 0) roSec.textContent = pad(idx, 2) + ' ' + sections[idx].dataset.label;
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
  function scheduleSweep() { clearTimeout(sweepTimer); sweepTimer = setTimeout(sweep, 300); }

  if (!reduce && hasIO) {
    $$('[data-stagger]').forEach(function (parent) {
      Array.prototype.forEach.call(parent.children, function (child, i) {
        if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', '');
        child.style.setProperty('--d', (Math.min(i, 6) * 0.08).toFixed(2) + 's');
      });
    });
    doc.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    $$('[data-reveal]').forEach(function (el) { io.observe(el); });
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
     AMBIENT DUST (very slow; paused when hidden)
  ------------------------------------------------------------------ */
  var dustCanvas = $('#dust'), dctx = dustCanvas.getContext('2d');
  var dust = [], dw = 0, dh = 0, dustRaf = 0, dustLast = 0;
  function sizeDust() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    dw = window.innerWidth; dh = window.innerHeight;
    dustCanvas.width = Math.round(dw * dpr); dustCanvas.height = Math.round(dh * dpr);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = dw < 700 ? 22 : 42;
    dust = [];
    for (var i = 0; i < n; i++) {
      dust.push({ x: Math.random() * dw, y: Math.random() * dh, s: 0.6 + Math.random() * 1.1,
        a: 0.08 + Math.random() * 0.22, vy: 0.006 + Math.random() * 0.016, ph: Math.random() * 6.28,
        red: Math.random() < 0.12 });
    }
  }
  function drawDust(t, dt) {
    dctx.clearRect(0, 0, dw, dh);
    for (var i = 0; i < dust.length; i++) {
      var p = dust[i];
      if (dt) { p.y -= p.vy * dt; p.x += Math.sin(t * 0.0003 + p.ph) * 0.008 * dt; if (p.y < -4) { p.y = dh + 4; p.x = Math.random() * dw; } }
      dctx.fillStyle = p.red ? 'rgba(198,40,40,' + (p.a * 0.9).toFixed(3) + ')' : 'rgba(232,228,220,' + p.a.toFixed(3) + ')';
      dctx.fillRect(p.x, p.y, p.s, p.s);
    }
  }
  function dustLoop(t) {
    dustRaf = 0;
    if (t - dustLast >= 33) {            // 30 fps is plenty for slow dust
      var dt = Math.min(t - dustLast, 64); dustLast = t;
      drawDust(t, dt);
    }
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
  var hero = $('#hero');
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
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
     OCCASIONAL INTERFERENCE (glitch on one visible heading, or a light flicker)
  ------------------------------------------------------------------ */
  var atmos = $('.atmos');
  var glitchables = $$('[data-glitch]'), onScreen = new Set();
  if (hasIO) {
    var gio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) onScreen.add(en.target); else onScreen.delete(en.target); });
    });
    glitchables.forEach(function (el) { gio.observe(el); });
  }
  function glitch() {
    var cands = Array.from(onScreen).filter(function (el) {
      return !el.hasAttribute('data-reveal') && !el.hasAttribute('data-seq') && !el.classList.contains('is-glitching');
    });
    var headings = cands.filter(function (el) { return el.tagName !== 'SPAN'; });
    var pool = headings.length && Math.random() < 0.85 ? headings : cands;
    if (!pool.length) return;
    var el = pool[Math.floor(Math.random() * pool.length)];
    el.classList.add('is-glitching');
    setTimeout(function () { el.classList.remove('is-glitching'); }, 280);
    signalInterference();
  }
  function flicker() {
    atmos.classList.remove('is-flicker'); void atmos.offsetWidth; atmos.classList.add('is-flicker');
    setTimeout(function () { atmos.classList.remove('is-flicker'); }, 420);
  }
  function schedule(first) {
    setTimeout(function () {
      if (!document.hidden) { if (Math.random() < 0.7) glitch(); else flicker(); }
      schedule(false);
    }, first ? 5200 : 8000 + Math.random() * 9000);
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
})();
