/* Page-specific decorative effects. Self-detects which page is rendered.
 * Each effect bails out cheaply if its target elements are absent.
 */
(function () {
  function statCounter() {
    var nums = document.querySelectorAll('.stat-number[data-count]');
    if (!nums.length || !('IntersectionObserver' in window)) {
      nums.forEach(function (el) {
        el.textContent = (el.dataset.count || '0') + '+';
      });
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseInt(el.dataset.count, 10) || 0;
        var current = 0;
        var step = Math.max(1, Math.ceil(target / 30));
        var timer = setInterval(function () {
          current += step;
          if (current >= target) {
            el.textContent = target + '+';
            clearInterval(timer);
          } else {
            el.textContent = current;
          }
        }, 45);
        obs.unobserve(el);
      });
    }, { threshold: 0.5 });

    nums.forEach(function (el) { obs.observe(el); });
  }

  function slideInLeftStagger() {
    var els = document.querySelectorAll('.slide-in-left');
    els.forEach(function (el, i) {
      el.style.animationDelay = (i * 0.08) + 's';
    });
  }

  function projectCardStagger() {
    var cards = document.querySelectorAll('.project-card');
    cards.forEach(function (card, i) {
      card.style.animationDelay = (i * 0.06) + 's';
    });

    if (!cards.length || !('IntersectionObserver' in window)) {
      cards.forEach(function (c) { c.classList.add('revealed'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        setTimeout(function () { entry.target.classList.add('revealed'); }, i * 70);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    cards.forEach(function (c) { obs.observe(c); });
  }

  function lyricCardWave() {
    var cards = document.querySelectorAll('.lyric-card');
    if (!cards.length || !('IntersectionObserver' in window)) {
      cards.forEach(function (c) { c.classList.add('wave-in'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var idx = parseInt(entry.target.dataset.index || '0', 10);
        entry.target.style.animationDelay = ((idx % 3) * 0.1) + 's';
        entry.target.classList.add('wave-in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.1 });
    cards.forEach(function (c) { obs.observe(c); });
  }

  function lyricsBackLink() {
    var el = document.querySelector('.lyrics-back-link');
    if (!el) return;
    var fallback = el.dataset.default || '/';

    var target = fallback;
    try {
      var stored = sessionStorage.getItem('lastNonLyricsPath');
      if (stored && stored !== window.location.pathname) {
        target = stored;
      } else if (document.referrer) {
        var ref = new URL(document.referrer);
        if (ref.origin === window.location.origin &&
            ref.pathname !== window.location.pathname &&
            ref.pathname !== '/lyrics' &&
            ref.pathname !== '/all-lyrics') {
          target = ref.pathname + ref.search;
        }
      }
    } catch (e) {}

    el.setAttribute('href', target);
  }

  function init() {
    statCounter();
    slideInLeftStagger();
    projectCardStagger();
    lyricCardWave();
    lyricsBackLink();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
