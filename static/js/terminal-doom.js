/* DOOM embed for the in-page terminal.
 *
 * The `doom` command appends an <iframe> to the terminal output that
 * loads "Yet Another Doom Clone" by Nicholas Carlini, vendored locally
 * under /static/vendor/doom-clone/. The upstream game is GPL-3.0
 * licensed and lives in that directory unmodified, alongside its
 * LICENSE file. This wrapper does not relink or modify the game; it
 * embeds it via <iframe> as an aggregation only.
 *
 * Upstream: https://github.com/carlini/js13k2019-yet-another-doom-clone
 *
 * Click the iframe to give it keyboard focus; press the ✕ button or
 * Esc (while the host page still has focus) to close.
 *
 * Exposes window.TerminalDoom.start(outputEl, onExit).
 */
(function () {
  var EMBED_URL = '/static/vendor/doom-clone/doom.html';

  function start(outputEl, onExit) {
    if (document.getElementById('term-doom-frame')) return;

    var container = document.createElement('div');
    container.className = 'term-doom-frame';
    container.id = 'term-doom-frame';

    var bar = document.createElement('div');
    bar.className = 'term-doom-bar';

    var label = document.createElement('span');
    label.className = 'term-doom-label';
    label.textContent = 'yet another doom clone · n. carlini · GPL-3.0 · click frame to play';

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'term-doom-close';
    close.setAttribute('aria-label', 'Close DOOM');
    close.textContent = '✕ close';

    bar.appendChild(label);
    bar.appendChild(close);

    var iframe = document.createElement('iframe');
    iframe.src = EMBED_URL;
    iframe.className = 'term-doom-iframe';
    iframe.title = 'DOOM (shareware)';
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('webkitallowfullscreen', 'true');
    iframe.setAttribute('mozallowfullscreen', 'true');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('referrerpolicy', 'no-referrer');

    container.appendChild(bar);
    container.appendChild(iframe);
    outputEl.appendChild(container);
    outputEl.scrollTop = outputEl.scrollHeight;

    // Animate the terminal-output height grow instead of snapping it,
    // so the page doesn't jolt the moment doom is summoned.
    var origHeight = outputEl.style.height;
    var origTransition = outputEl.style.transition;
    var startHeight = outputEl.getBoundingClientRect().height + 'px';
    outputEl.style.height = startHeight;
    outputEl.style.transition = 'height 0.32s var(--ease, ease)';
    // force layout so the transition actually fires
    void outputEl.offsetHeight;
    outputEl.style.height = '520px';

    // Bring the iframe into view smoothly so the user lands on the game
    // even while doom's many scripts are still parsing on the main thread.
    setTimeout(function () {
      try {
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        container.scrollIntoView();
      }
    }, 60);

    // Tell the rest of the page (lyric rotator, etc.) to hold still so
    // height changes elsewhere don't push the iframe around mid-play.
    document.dispatchEvent(new CustomEvent('doom:start'));

    var done = false;
    function teardown() {
      if (done) return;
      done = true;
      outputEl.style.height = origHeight;
      outputEl.style.transition = origTransition;
      if (container.parentNode) container.parentNode.removeChild(container);
      document.removeEventListener('keydown', keyHandler);
      document.dispatchEvent(new CustomEvent('doom:exit'));
      if (typeof onExit === 'function') onExit();
    }

    function keyHandler(e) {
      // Esc only works if the iframe doesn't have focus. When the user
      // clicks the iframe its document captures keys instead of ours.
      // Keep this handler anyway so quitting works before they click in.
      if (e.key === 'Escape') {
        e.preventDefault();
        teardown();
      }
    }

    close.addEventListener('click', teardown);
    document.addEventListener('keydown', keyHandler);
  }

  window.TerminalDoom = { start: start };
})();
