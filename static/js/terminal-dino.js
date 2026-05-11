/* ASCII dino runner — embedded in the terminal output.
 * Controls: SPACE / ↑ / W = jump · Q / Esc = quit · R = restart
 *
 * Exposes window.TerminalDino.start(outputEl, onExit).
 * `outputEl` is the terminal output container; the game appends a <pre>
 * to it. `onExit` is called when the player quits.
 */
(function () {
  function start(outputEl, onExit) {
    var W = 52;          // grid width  (cols)
    var H = 5;           // grid height (rows above ground)
    var DINO_COL = 5;
    var GRAV = 0.65;
    var JUMP_V = 2.55;
    var MIN_GAP = 14;
    var SPEED_START = 90;
    var SPEED_MIN = 38;

    var dinoY = 0;
    var jumpV = 0;
    var cacti = [];
    var frame = 0;
    var score = 0;
    var alive = true;
    var quit  = false;
    var speed = SPEED_START;
    var timer = null;

    var screen = document.createElement('pre');
    screen.className = 'term-game';
    outputEl.appendChild(screen);
    outputEl.scrollTop = outputEl.scrollHeight;

    function render() {
      var rows = [];
      rows.push(
        'score: ' + String(score).padStart(4, '0') +
        '     [SPACE]/[↑] jump   [Q] quit   [R] restart'
      );
      rows.push('');
      for (var y = H - 1; y >= 0; y--) {
        var row = '';
        for (var x = 0; x < W; x++) {
          var hit = false;
          if (x === DINO_COL && Math.round(dinoY) === y) {
            row += alive ? 'D' : 'X';
            hit = true;
          }
          if (!hit && y === 0) {
            for (var i = 0; i < cacti.length; i++) {
              if (Math.round(cacti[i].x) === x) { row += '▲'; hit = true; break; }
            }
          }
          if (!hit) row += ' ';
        }
        rows.push(row);
      }
      rows.push('━'.repeat(W));
      screen.textContent = rows.join('\n');
    }

    function tick() {
      if (!alive) return;

      // physics
      if (dinoY > 0 || jumpV > 0) {
        dinoY += jumpV;
        jumpV -= GRAV;
        if (dinoY <= 0) { dinoY = 0; jumpV = 0; }
      }

      // move cacti left, drop the ones offscreen
      var next = [];
      for (var i = 0; i < cacti.length; i++) {
        var nx = cacti[i].x - 1;
        if (nx >= 0) next.push({ x: nx });
      }
      cacti = next;

      // spawn
      if (frame > 6 && frame % 11 === 0 && Math.random() < 0.55) {
        var lastX = cacti.length ? cacti[cacti.length - 1].x : -100;
        if ((W - 1) - lastX > MIN_GAP) cacti.push({ x: W - 1 });
      }

      // collision
      for (var j = 0; j < cacti.length; j++) {
        if (Math.abs(cacti[j].x - DINO_COL) < 1 && dinoY < 1) {
          alive = false;
        }
      }

      frame++;
      score = frame;
      if (frame % 60 === 0 && speed > SPEED_MIN) speed -= 3;

      render();
      if (alive) {
        timer = setTimeout(tick, speed);
      } else {
        screen.textContent +=
          '\n\nGAME OVER · score: ' + score +
          ' · [R] retry · [Q] quit';
      }
    }

    function keyHandler(e) {
      var k = e.key;
      if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'Spacebar') {
        e.preventDefault();
        if (alive && dinoY === 0) jumpV = JUMP_V;
      } else if (k === 'q' || k === 'Q' || k === 'Escape') {
        e.preventDefault();
        teardown();
      } else if (k === 'r' || k === 'R') {
        e.preventDefault();
        teardown(true);
        start(outputEl, onExit);
      }
    }

    function teardown(skipExit) {
      if (quit) return;
      quit = true;
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('keydown', keyHandler);
      if (!skipExit && typeof onExit === 'function') onExit();
    }

    document.addEventListener('keydown', keyHandler);
    render();
    timer = setTimeout(tick, speed);
  }

  window.TerminalDino = { start: start };
})();
