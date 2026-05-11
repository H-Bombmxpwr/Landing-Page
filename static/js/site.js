/* Site-wide behavior shared by every page.
 * - Sets the footer year
 * - Records the visit (once per session) and refreshes the counter display
 * - Reveals .animate-on-scroll elements as they enter the viewport
 */
(function () {
  function setYear() {
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  function visitCounter() {
    var el = document.getElementById('visit-count-text');
    if (!el) return;

    function display(n) {
      if (typeof n === 'number') el.textContent = n.toLocaleString();
    }

    try {
      if (!sessionStorage.getItem('hunterVisited')) {
        fetch('/api/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({ path: window.location.pathname })
        })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            if (!d) return;
            if (d.counted !== false) sessionStorage.setItem('hunterVisited', '1');
            display(d.count);
          })
          .catch(function () {});
      } else {
        fetch('/api/visit-count')
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { if (d) display(d.count); })
          .catch(function () {});
      }
    } catch (e) {}
  }

  function scrollReveal() {
    var items = document.querySelectorAll('.animate-on-scroll');
    if (!items.length) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('animate-in'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  function phosphorToggle() {
    var current;
    try {
      current = localStorage.getItem('phosphorTheme');
    } catch (e) { current = null; }
    if (current !== 'green' && current !== 'amber') current = 'amber';

    var buttons = document.querySelectorAll('.phosphor-toggle .theme-opt');
    if (!buttons.length) return;

    function apply(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('phosphorTheme', theme); } catch (e) {}
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.theme === theme ? 'true' : 'false');
      });
    }

    apply(current);

    buttons.forEach(function (b) {
      b.addEventListener('click', function () { apply(b.dataset.theme); });
    });
  }

  /* Track the last non-/lyrics page so the lyrics back-link can return there. */
  function trackLastPage() {
    try {
      var here = window.location.pathname;
      if (here !== '/lyrics' && here !== '/all-lyrics') {
        sessionStorage.setItem('lastNonLyricsPath', here + window.location.search);
      }
    } catch (e) {}
  }

  function init() {
    setYear();
    visitCounter();
    scrollReveal();
    phosphorToggle();
    trackLastPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
