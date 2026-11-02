/* Chirayu Mahajan — portfolio interactions
   Layers: (1) core UI that always works  (2) motion that needs GSAP + motion allowed */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var motion = hasGSAP && !reduce;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- text splitting ---------- */
  function splitChars(el, label, breakAfter) {
    var text = el.textContent.trim();
    if (label) el.setAttribute('aria-label', text);
    el.textContent = '';
    var chars = [];
    var tokens = [];
    text.split(' ').forEach(function (word, i, arr) {
      var parts = breakAfter ? word.split(new RegExp('(?<=' + breakAfter + ')')) : [word];
      parts.forEach(function (part, j) {
        tokens.push({ t: part, sep: j < parts.length - 1 ? 'wbr' : (i < arr.length - 1 ? 'space' : '') });
      });
    });
    tokens.forEach(function (tok) {
      var w = document.createElement('span');
      w.className = 'word-wrap';
      w.setAttribute('aria-hidden', 'true');
      Array.from(tok.t).forEach(function (ch) {
        var m = document.createElement('span'); m.className = 'char-mask';
        var c = document.createElement('span'); c.className = 'char'; c.textContent = ch;
        m.appendChild(c); w.appendChild(m); chars.push(c);
      });
      el.appendChild(w);
      if (tok.sep === 'space') el.appendChild(document.createTextNode(' '));
      if (tok.sep === 'wbr') el.appendChild(document.createElement('wbr'));
    });
    return chars;
  }

  function splitWords(el) {
    var text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    var words = [];
    text.split(/\s+/).forEach(function (w, i, arr) {
      var s = document.createElement('span');
      s.setAttribute('aria-hidden', 'true');
      s.textContent = w;
      el.appendChild(s); words.push(s);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return words;
  }

  function wrapMask(el) {
    var mask = document.createElement('span'); mask.className = 'mask';
    var inner = document.createElement('span'); inner.className = 'mask__in';
    while (el.firstChild) inner.appendChild(el.firstChild);
    mask.appendChild(inner); el.appendChild(mask);
    return inner;
  }

  /* ---------- menu (always works) ---------- */
  var menu = $('#menu');
  var toggle = $('.menu-toggle');
  var main = $('#main');
  var menuOpen = false;

  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle__text').textContent = open ? 'Close' : 'Menu';
    if (open) {
      menu.classList.add('is-open');
      main.setAttribute('inert', '');
      doc.style.overflow = 'hidden';
      if (motion) {
        gsap.fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'power4.inOut' });
        gsap.fromTo('.menu__link', { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.045, ease: 'power4.out', delay: 0.25 });
      }
      var first = $('.menu__link', menu);
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    } else {
      main.removeAttribute('inert');
      doc.style.overflow = '';
      var done = function () { menu.classList.remove('is-open'); menu.style.clipPath = ''; };
      if (motion) {
        gsap.to(menu, { clipPath: 'inset(0 0 100% 0)', duration: 0.6, ease: 'power4.inOut', onComplete: done });
      } else { done(); }
    }
  }
  toggle.addEventListener('click', function () { setMenu(!menuOpen); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOpen) { setMenu(false); toggle.focus(); }
  });
  $$('.menu__link').forEach(function (a) {
    a.addEventListener('click', function () {
      if (a.getAttribute('href').charAt(0) === '#') setMenu(false);
    });
  });

  /* ---------- section rail + header label (always works) ---------- */
  var sections = $$('section[data-label]');
  var rail = $('#rail');
  var headerLabel = $('#header-section-label');
  var header = $('#site-header');
  var railLinks = {};

  sections.forEach(function (s) {
    var a = document.createElement('a');
    a.href = '#' + s.id;
    a.setAttribute('aria-label', s.dataset.label);
    var sp = document.createElement('span'); sp.setAttribute('aria-hidden', 'true'); sp.textContent = s.dataset.label;
    a.appendChild(sp); rail.appendChild(a); railLinks[s.id] = a;
  });

  var currentId = null;
  function setActive(id) {
    if (id === currentId) return;
    currentId = id;
    Object.keys(railLinks).forEach(function (k) {
      if (k === id) railLinks[k].setAttribute('aria-current', 'true'); else railLinks[k].removeAttribute('aria-current');
    });
    $$('.menu__link').forEach(function (a) {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    var label = $('#' + id).dataset.label;
    var onLime = $('#' + id).dataset.theme === 'lime';
    header.classList.toggle('is-on-lime', onLime);
    rail.classList.toggle('is-on-lime', onLime);
    if (motion) {
      gsap.to(headerLabel, { yPercent: -110, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: function () {
        headerLabel.textContent = label;
        gsap.fromTo(headerLabel, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
      } });
    } else { headerLabel.textContent = label; }
  }

  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) setActive(en.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(function (s) { spy.observe(s); });

  /* ---------- scroll progress ---------- */
  var bar = $('.progress');
  if (!motion) {
    var ticking = false;
    var update = function () {
      var h = doc.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? window.scrollY / h : 0) + ')';
      ticking = false;
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- hero memory grid (the signature) ---------- */
  var canvas = $('.hero__memory');
  var memory = initMemory(canvas, reduce);

  function initMemory(cv, still) {
    var ctx = cv.getContext('2d');
    var w = 0, h = 0, dpr = 1, cell = 56, cols = 0, rows = 0, vals, seen;
    var lastWander = -1, last = null, lastMove = -1e9, running = false, visible = true, bootStart = -1, raf = 0;

    function resize() {
      var r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = parseFloat(getComputedStyle(doc).getPropertyValue('--cell')) || 56;
      cols = Math.ceil(w / cell); rows = Math.ceil(h / cell);
      vals = new Float32Array(cols * rows); seen = new Uint8Array(cols * rows);
      if (still) seedStill();
      draw();
    }

    function seedStill() {
      for (var c = 2; c < cols - 2; c++) {
        var r = Math.round(rows * 0.5 + Math.sin(c * 0.5) * rows * 0.2);
        if (r >= 0 && r < rows) { seen[r * cols + c] = 1; if (c % 5 === 0) vals[r * cols + c] = 0.8; }
      }
    }

    function mark(cx, cy, v) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
      var i = cy * cols + cx; vals[i] = Math.max(vals[i], v); seen[i] = 1;
    }
    function lightAt(px, py) {
      var cx = Math.floor(px / cell), cy = Math.floor(py / cell);
      mark(cx, cy, 1);
      
    }
    function trail(x, y) {
      if (last) {
        var dx = x - last.x, dy = y - last.y;
        var steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cell * 0.5)));
        for (var s = 1; s <= steps; s++) lightAt(last.x + dx * s / steps, last.y + dy * s / steps);
      } else lightAt(x, y);
      last = { x: x, y: y };
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var i = r * cols + c, x = c * cell, y = r * cell;
          if (seen[i]) { ctx.fillStyle = 'rgba(236,231,218,0.28)'; ctx.fillRect(x + cell / 2 - 1.5, y + cell / 2 - 1.5, 3, 3); }
          var v = vals[i];
          if (v > 0.02) {
            ctx.fillStyle = 'rgba(198,255,43,' + (v * 0.42).toFixed(3) + ')';
            ctx.fillRect(x + 1, y + 1, cell - 1, cell - 1);
          }
        }
      }
    }

    var prev = 0;
    function frame(t) {
      raf = 0;
      var dt = Math.min((t - prev) / 16.67, 4); prev = t;
      var k = Math.pow(0.985, dt);
      for (var i = 0; i < vals.length; i++) if (vals[i] > 0.001) vals[i] *= k; else vals[i] = 0;

      if (bootStart >= 0) {
        var p = (t - bootStart) / 1100;
        if (p >= 1) bootStart = -1;
        else {
          var col = Math.floor(p * cols);
          for (var n = 0; n < 3; n++) mark(col, Math.floor(Math.random() * rows), 1);
        }
      } else if (t - lastMove > 2400) {
        var a = t / 1000;
        if (Math.floor(t / 90) !== lastWander) { lastWander = Math.floor(t / 90); lightAt(w * (0.5 + 0.38 * Math.sin(a * 0.7)), h * (0.5 + 0.34 * Math.sin(a * 1.1 + 1.2))); }
        last = null;
      }
      draw();
      if (running && visible) raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && running && visible) raf = requestAnimationFrame(frame); }

    function onMove(e) {
      var r = cv.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) { last = null; return; }
      lastMove = performance.now();
      trail(e.clientX - r.left, e.clientY - r.top);
    }

    resize();
    window.addEventListener('resize', function () { clearTimeout(resize._t); resize._t = setTimeout(resize, 150); });

    if (!still) {
      running = true;
      window.addEventListener('pointermove', onMove, { passive: true });
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; start(); }).observe(cv);
      start();
    }
    return { boot: function () { if (!still) { bootStart = performance.now(); start(); } } };
  }

  /* ---------- everything below needs motion ---------- */
  if (!motion) {
    doc.classList.remove('motion-pending');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });

  /* progress bar scrubbed */
  gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });

  /* custom cursor */
  if (finePointer) {
    doc.classList.add('has-cursor');
    var cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), lab = $('.cursor__label');
    var dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'none' }), dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'none' });
    var rx = gsap.quickTo(ring, 'x', { duration: 0.5 }), ry = gsap.quickTo(ring, 'y', { duration: 0.5 });
    window.addEventListener('pointermove', function (e) { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      var v = e.target.closest('[data-cursor="view"]');
      var l = e.target.closest('a, button, [data-cursor-link]');
      cur.classList.toggle('is-view', !!v);
      cur.classList.toggle('is-link', !!l && !v);
      if (v) lab.textContent = v.dataset.cursorLabel || 'Open';
    });
    document.addEventListener('pointerleave', function () { cur.classList.remove('is-view', 'is-link'); });
  }

  /* magnetic elements */
  if (finePointer) {
    $$('.magnetic').forEach(function (el) {
      var qx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      var qy = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * 0.28);
        qy((e.clientY - (r.top + r.height / 2)) * 0.28);
      });
      el.addEventListener('pointerleave', function () { qx(0); qy(0); });
    });
  }

  /* hero prep */
  var nameChars = [];
  $$('.hero__word').forEach(function (wd) { nameChars = nameChars.concat(splitChars(wd, false)); });
  var ledeEl = $('.hero__lede');
  var ledeIn = wrapMask(ledeEl);

  gsap.set(nameChars, { yPercent: 115 });
  gsap.set(ledeIn, { yPercent: 110 });
  gsap.set(['.hero__side > *', '.hero__scroll'], { opacity: 0, y: 24 });
  gsap.set(['.brand', '.header-section', '.menu-toggle'], { opacity: 0, y: -16 });
  gsap.set('.rail', { opacity: 0 });

  /* cinematic entrance */
  var intro = gsap.timeline({
    onComplete: function () {
      doc.classList.remove('motion-pending');
      $('.curtain').style.display = 'none';
      ScrollTrigger.refresh();
    }
  });
  intro
    .to('.curtain__line', { scaleX: 1, duration: 0.8, ease: 'power3.inOut' })
    .to('.curtain__top', { yPercent: -100, duration: 1, ease: 'power4.inOut' }, '+=0.08')
    .to('.curtain__bottom', { yPercent: 100, duration: 1, ease: 'power4.inOut' }, '<')
    .to('.curtain__line', { opacity: 0, duration: 0.2 }, '<')
    .to(nameChars, { yPercent: 0, duration: 1.2, stagger: 0.05, ease: 'power4.out' }, '-=0.55')
    .to(ledeIn, { yPercent: 0, duration: 1, ease: 'power4.out' }, '-=0.95')
    .to(['.hero__side > *', '.hero__scroll'], { opacity: 1, y: 0, duration: 0.9, stagger: 0.1 }, '-=0.8')
    .to(['.brand', '.header-section', '.menu-toggle'], { opacity: 1, y: 0, duration: 0.8, stagger: 0.08 }, '-=1.1')
    .to('.rail', { opacity: 1, duration: 0.8 }, '-=0.8')
    .add(function () { memory.boot(); }, '-=1.5');

  /* hero scroll depth */
  gsap.to('.hero__name', { yPercent: -14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__top', { yPercent: -30, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__memory', { opacity: 0.1, ease: 'none', scrollTrigger: { trigger: '.hero', start: '40% top', end: 'bottom top', scrub: true } });

  /* section titles: masked character rise */
  $$('.section-title').forEach(function (t) {
    var chars = splitChars(t, true);
    gsap.from(chars, { yPercent: 115, duration: 1.1, stagger: 0.028, ease: 'power4.out',
      scrollTrigger: { trigger: t, start: 'top 88%', once: true } });
  });
  $$('.section-sub').forEach(function (s) {
    gsap.from(s, { opacity: 0, x: 24, duration: 1, scrollTrigger: { trigger: s, start: 'top 92%', once: true } });
  });

  /* hairlines draw */
  $$('[data-rule]').forEach(function (r) {
    gsap.from(r, { scaleX: 0, duration: 1.4, ease: 'power3.inOut', scrollTrigger: { trigger: r, start: 'top 92%', once: true } });
  });
  /* profile */
  var aboutFrame = $('.about__frame');
  gsap.from(aboutFrame, { clipPath: 'inset(0 0 100% 0)', duration: 1.5, ease: 'power4.inOut', scrollTrigger: { trigger: aboutFrame, start: 'top 85%', once: true } });
  gsap.fromTo('.about__frame img', { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: aboutFrame, start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.about__corner', { scale: 0, duration: 0.8, stagger: 0.15, delay: 0.6, scrollTrigger: { trigger: aboutFrame, start: 'top 80%', once: true } });

  $$('[data-scrub]').forEach(function (p) {
    var words = splitWords(p);
    gsap.set(words, { opacity: 0.16 });
    gsap.to(words, { opacity: 1, stagger: 0.12, ease: 'none',
      scrollTrigger: { trigger: p, start: 'top 82%', end: 'bottom 52%', scrub: 0.4 } });
  });
  gsap.from('.about__text .btn, .about__label', { opacity: 0, y: 20, duration: 0.9, stagger: 0.1, scrollTrigger: { trigger: '.about__text', start: 'top 75%', once: true } });

  /* masked numerals / ranks */
  $$('[data-mask]').forEach(function (el, i) {
    var inner = wrapMask(el);
    gsap.from(inner, { yPercent: 105, duration: 1.2, ease: 'power4.out', delay: (i % 4) * 0.08,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  gsap.from('.stat__label', { opacity: 0, y: 14, duration: 0.9, stagger: 0.1, scrollTrigger: { trigger: '.stats', start: 'top 80%', once: true } });

  /* experience */
  $$('[data-xp]').forEach(function (x) {
    var title = wrapMask($('.xp__title', x));
    gsap.from(title, { yPercent: 105, duration: 1.2, ease: 'power4.out', scrollTrigger: { trigger: x, start: 'top 80%', once: true } });
    gsap.from([$('.xp__meta', x), $('.xp__desc', x)], { opacity: 0, y: 24, duration: 1, stagger: 0.12, scrollTrigger: { trigger: x, start: 'top 78%', once: true } });
  });

  /* projects */
  $$('[data-project]').forEach(function (p) {
    var vis = $('.project__visual', p), media = $('.project__media', p);
    gsap.from(vis, { clipPath: p.classList.contains('project--ring') ? 'circle(0% at 50% 50%)' : 'inset(0 100% 0 0)', duration: 1.5, ease: 'power4.inOut',
      scrollTrigger: { trigger: p, start: 'top 72%', once: true } });
    if (!p.classList.contains('project--scan') && !p.classList.contains('project--ring')) gsap.fromTo(media, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: true } });

    var title = $('.project__title', p);
    var chars = splitChars(title, true);
    var st = { trigger: p, start: 'top 68%', once: true };
    gsap.from(chars, { yPercent: 115, duration: 1.1, stagger: 0.03, ease: 'power4.out', scrollTrigger: st });
    gsap.from($$('.project__body > :not(.project__title)', p), { opacity: 0, y: 22, duration: 0.9, stagger: 0.09, delay: 0.25, scrollTrigger: st });

    /* generative drawings */
    var draws = $$('.draw', p);
    if (draws.length) gsap.from(draws, { strokeDashoffset: 1, duration: 2, stagger: 0.25, ease: 'power2.inOut', scrollTrigger: { trigger: p, start: 'top 65%', once: true } });
    var bars = $$('.viz__bar', p);
    if (bars.length) gsap.from(bars, { scaleY: 0, duration: 1.1, stagger: { each: 0.025, from: 'start' }, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 65%', once: true } });
    var rows = $$('.viz__row', p);
    if (rows.length) gsap.from(rows, { scaleX: 0, transformOrigin: function (i) { return i % 2 ? '100% 50%' : '0% 50%'; }, duration: 0.8, stagger: 0.14, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 65%', once: true } });
    var nodes = $$('.viz__nodes rect', p);
    if (nodes.length) gsap.from(nodes, { scale: 0, transformOrigin: '50% 50%', duration: 0.6, stagger: 0.06, delay: 0.5, scrollTrigger: { trigger: p, start: 'top 65%', once: true } });
  });

  /* journey: line draws with scroll */
  var tl = $('[data-tl]');
  gsap.fromTo('.tl__line', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: tl, start: 'top 60%', end: 'bottom 70%', scrub: 0.4 } });
  $$('.tl__item').forEach(function (it) {
    gsap.from([$('.tl__year', it), $('.tl__text', it)], { opacity: 0, x: -40, duration: 1, stagger: 0.12, scrollTrigger: { trigger: it, start: 'top 82%', once: true } });
  });

  /* skills */
  var marquee = $('[data-marquee]');
  var drift = gsap.to(marquee, { xPercent: -50, duration: 46, ease: 'none', repeat: -1 });
  var tsNow = 1, tsTarget = 1;
  ScrollTrigger.create({
    trigger: '#skills', start: 'top bottom', end: 'bottom top',
    onUpdate: function (self) {
      var v = Math.min(Math.abs(self.getVelocity()) / 260, 6);
      tsTarget = (self.direction < 0 ? -1 : 1) * (1 + v);
    }
  });
  gsap.ticker.add(function () {
    tsTarget += ((tsTarget < 0 ? -1 : 1) - tsTarget) * 0.04;
    tsNow += (tsTarget - tsNow) * 0.1;
    drift.timeScale(tsNow);
  });
  $$('.skills__row').forEach(function (r) {
    gsap.from($$('.skill', r), { yPercent: 60, opacity: 0, duration: 0.9, stagger: 0.05, scrollTrigger: { trigger: r, start: 'top 85%', once: true } });
    gsap.from($('.skills__cat', r), { opacity: 0, x: -20, duration: 0.9, scrollTrigger: { trigger: r, start: 'top 85%', once: true } });
  });

  /* achievements */
  gsap.from('.ach__feature > div', { opacity: 0, y: 30, duration: 1, scrollTrigger: { trigger: '.ach', start: 'top 70%', once: true } });
  gsap.from('.ach__item', { opacity: 0, x: 40, duration: 1, stagger: 0.14, scrollTrigger: { trigger: '.ach__list', start: 'top 80%', once: true } });

  /* contact: lime panel opens as it arrives */
  var contact = $('#contact');
  gsap.fromTo(contact, { clipPath: 'inset(9% 5% 0% 5%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
    scrollTrigger: { trigger: contact, start: 'top bottom', end: 'top 25%', scrub: true } });
  var mailChars = splitChars($('.contact__mail'), true, '@');
  gsap.from(mailChars, { yPercent: 115, duration: 1.1, stagger: 0.02, ease: 'power4.out', scrollTrigger: { trigger: '.contact__mail', start: 'top 90%', once: true } });
  gsap.from('.contact__link', { opacity: 0, y: 30, duration: 0.9, stagger: 0.12, scrollTrigger: { trigger: '.contact__links', start: 'top 90%', once: true } });

  /* layout settles after fonts and images */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
