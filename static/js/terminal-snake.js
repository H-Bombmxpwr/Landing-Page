/* ASCII snake — embedded in the terminal output.
 *
 * Controls: arrows / WASD / HJKL move · Q or Esc quit · R restart
 *
 * Exposes window.TerminalSnake.start(outputEl, onExit).
 * The game renders into a <pre> appended to outputEl, listens for keys
 * at the document level so the terminal input doesn't need focus, and
 * calls onExit() when the player quits.
 */
(function () {
  function start(outputEl, onExit) {
    var W = 32;         // playable columns
    var H = 12;         // playable rows
    var TICK_START = 130;
    var TICK_MIN   = 55;

    // body = list of {x, y}; index 0 is the head
    var dir = { x: 1, y: 0 };
    var pendingDir = dir;
    var body = [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }];
    var food = spawnFood();
    var score = 0;
    var alive = true;
    var quit = false;
    var tickMs = TICK_START;
    var timer = null;

    var screen = document.createElement('pre');
    screen.className = 'term-game';
    outputEl.appendChild(screen);
    outputEl.scrollTop = outputEl.scrollHeight;

    function inBody(x, y, skipHead) {
      for (var i = skipHead ? 1 : 0; i < body.length; i++) {
        if (body[i].x === x && body[i].y === y) return true;
      }
      return false;
    }

    function spawnFood() {
      var attempts = 200;
      while (attempts--) {
        var x = Math.floor(Math.random() * W);
        var y = Math.floor(Math.random() * H);
        if (!inBody(x, y, false)) return { x: x, y: y };
      }
      return { x: 0, y: 0 };
    }

    function render() {
      var rows = [];
      rows.push(
        'score: ' + String(score).padStart(4, '0') +
        '   length: ' + String(body.length).padStart(3, '0') +
        '     [↑↓←→/WASD] move   [Q] quit   [R] restart'
      );
      rows.push('');
      rows.push('┌' + '─'.repeat(W) + '┐');
      for (var y = 0; y < H; y++) {
        var row = '│';
        for (var x = 0; x < W; x++) {
          if (body[0].x === x && body[0].y === y) {
            row += alive ? '█' : 'X';
          } else if (inBody(x, y, true)) {
            row += '▓';
          } else if (food.x === x && food.y === y) {
            row += '●';
          } else {
            row += ' ';
          }
        }
        row += '│';
        rows.push(row);
      }
      rows.push('└' + '─'.repeat(W) + '┘');
      screen.textContent = rows.join('\n');
    }

    function tick() {
      if (!alive) return;

      // commit pending direction (block 180° reversal vs current dir)
      if (!(pendingDir.x === -dir.x && pendingDir.y === -dir.y) || body.length === 1) {
        dir = pendingDir;
      }

      var head = body[0];
      var nx = head.x + dir.x;
      var ny = head.y + dir.y;

      // wall collision
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) { alive = false; }
      // self collision — check against body minus the tail (which will move out)
      else if (inBody(nx, ny, true) && !(body[body.length - 1].x === nx && body[body.length - 1].y === ny)) {
        alive = false;
      }

      if (!alive) {
        render();
        screen.textContent +=
          '\n\nGAME OVER · score: ' + score + ' · length: ' + body.length +
          ' · [R] retry · [Q] quit';
        return;
      }

      var ate = (nx === food.x && ny === food.y);
      body.unshift({ x: nx, y: ny });
      if (ate) {
        score += 10;
        food = spawnFood();
        if (tickMs > TICK_MIN) tickMs = Math.max(TICK_MIN, tickMs - 4);
      } else {
        body.pop();
      }

      render();
      timer = setTimeout(tick, tickMs);
    }

    function setDir(x, y) {
      pendingDir = { x: x, y: y };
    }

    function keyHandler(e) {
      var k = e.key;
      if (k === 'ArrowUp'    || k === 'w' || k === 'W' || k === 'k' || k === 'K') { e.preventDefault(); setDir(0, -1); }
      else if (k === 'ArrowDown'  || k === 's' || k === 'S' || k === 'j' || k === 'J') { e.preventDefault(); setDir(0,  1); }
      else if (k === 'ArrowLeft'  || k === 'a' || k === 'A' || k === 'h' || k === 'H') { e.preventDefault(); setDir(-1, 0); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'l' || k === 'L') { e.preventDefault(); setDir( 1, 0); }
      else if (k === 'q' || k === 'Q' || k === 'Escape') { e.preventDefault(); teardown(); }
      else if (k === 'r' || k === 'R') { e.preventDefault(); teardown(true); start(outputEl, onExit); }
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
    timer = setTimeout(tick, tickMs);
  }

  window.TerminalSnake = { start: start };
})();
