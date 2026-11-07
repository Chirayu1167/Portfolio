(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var toggle = document.getElementById('nav-toggle');
  var links = document.getElementById('nav-links');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile menu
  function setMenu(open) {
    links.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
  }
  toggle.addEventListener('click', function () { setMenu(!links.classList.contains('is-open')); });
  links.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // Active section in the menu
  var anchors = [].slice.call(links.querySelectorAll('a'));
  var map = {};
  anchors.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        anchors.forEach(function (a) { a.removeAttribute('aria-current'); });
        var a = map[en.target.id];
        if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  window.addEventListener('scroll', function () {
    if (window.scrollY < 120) anchors.forEach(function (a) { a.removeAttribute('aria-current'); });
  }, { passive: true });

  // Hero: confidence score settles as the box locks on
  var conf = document.getElementById('conf');
  if (conf && !reduce) {
    var target = 0.98, start = null;
    conf.textContent = '0.00';
    var delay = 900, dur = 700;
    function tick(t) {
      if (start === null) start = t;
      var p = Math.min(Math.max((t - start - delay) / dur, 0), 1);
      conf.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(2);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
})();
