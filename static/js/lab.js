/* Lab page: small interactive trinkets, one per [data-trinket] card.
 *
 *   life       Conway's Game of Life with phosphor decay; draw with the mouse
 *   fourier    draw anything; its Fourier transform redraws it with epicycles
 *   lissajous  XY-mode scope; frequency ratio sliders, drag to scrub phase
 *   filter     square/triangle/saw through a simulated RC low/high-pass
 *   sierpinski chaos game: random jumps toward draggable corners
 *   pendulum   RK4 double pendulum with a ghost twin to show chaos
 *   sort       quick/merge/heap/insertion/bubble replayed op by op
 *   mandelbrot endless zoom: auto-dives when idle, hold to steer your own
 *   resistor   4-band color code, reverse lookup to E24, and a quiz
 *   adder      4-bit ripple-carry adder whose carry visibly ripples
 *
 * Every card also gets a fullscreen toggle (see the end of the file).
 *
 * Animation only runs while a card is on screen and the tab is visible.
 * Colors are read from the live CSS tokens, so the green/amber toggle in the
 * footer carries through without a reload.
 */
(function () {
  var cards = document.querySelectorAll('[data-trinket]');
  if (!cards.length) return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;

  /* ---------- shared helpers ---------------------------------------------- */

  var palette = (function () {
    var cache = null;
    var stamp = 0;
    return function () {
      var now = Date.now();
      if (!cache || now - stamp > 400) {
        var cs = getComputedStyle(document.documentElement);
        var v = function (name, fallback) { return cs.getPropertyValue(name).trim() || fallback; };
        cache = {
          accent: v('--accent', '#9eff8a'),
          bright: v('--accent-bright', '#c2ffb0'),
          line: v('--border-strong', '#2a3e2c'),
          grid: v('--border', '#1c2a1d'),
          muted: v('--muted', '#9aab95')
        };
        stamp = now;
      }
      return cache;
    };
  })();

  function fit(canvas) {
    var r = canvas.getBoundingClientRect();
    var d = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * d));
    canvas.height = Math.max(1, Math.round(r.height * d));
    var ctx = canvas.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return { ctx: ctx, w: r.width, h: r.height };
  }

  function pointer(e, el) {
    var r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function action(card, name, fn) {
    var btn = card.querySelector('[data-action="' + name + '"]');
    if (btn) btn.addEventListener('click', function () { fn(btn); });
    return btn;
  }

  /* Calls frame(dt) on every animation frame while the card is visible. */
  function loop(card, frame) {
    var visible = false;
    var raf = 0;
    var last = 0;
    function tick(t) {
      raf = 0;
      // A fullscreen card covers the rest, so only it keeps animating.
      var covered = expanded && expanded !== card;
      if (!visible || document.hidden || covered) { last = 0; return; }
      var dt = last ? Math.min(t - last, 50) : 16;
      last = t;
      frame(dt);
      raf = requestAnimationFrame(tick);
    }
    function start() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        start();
      }).observe(card);
    } else {
      visible = true;
      start();
    }
    document.addEventListener('visibilitychange', start);
    card.labWake = function () { visible = true; start(); };
  }

  function scopeGrid(g, c) {
    var ctx = g.ctx;
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 1; i < 10; i++) {
      var x = Math.round(g.w * i / 10) + 0.5;
      ctx.moveTo(x, 0); ctx.lineTo(x, g.h);
    }
    for (var j = 1; j < 8; j++) {
      var y = Math.round(g.h * j / 8) + 0.5;
      ctx.moveTo(0, y); ctx.lineTo(g.w, y);
    }
    ctx.stroke();
  }

  var resizers = [];
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizers.forEach(function (fn) { fn(); });
    }, 120);
  });

  var trinkets = {};
  var expanded = null;   // card currently shown fullscreen, if any

  /* ---------- life -------------------------------------------------------- */

  trinkets.life = function (card) {
    var canvas = card.querySelector('canvas');
    var readout = card.querySelector('[data-readout]');
    var CELL = 7;
    var DECAY = 8;
    var STEP_MS = 90;
    var GUN = [[1,5],[1,6],[2,5],[2,6],[11,5],[11,6],[11,7],[12,4],[12,8],[13,3],[13,9],
      [14,3],[14,9],[15,6],[16,4],[16,8],[17,5],[17,6],[17,7],[18,6],[21,3],[21,4],[21,5],
      [22,3],[22,4],[22,5],[23,2],[23,6],[25,1],[25,2],[25,6],[25,7],[35,3],[35,4],[36,3],[36,4]];
    var g, cols = 0, rows = 0, cells, next, ages;
    var gen = 0, acc = 0, dirty = true;
    var running = !reduceMotion;
    var runBtn;

    function setup() {
      g = fit(canvas);
      var nc = Math.floor(g.w / CELL);
      var nr = Math.floor(g.h / CELL);
      if (nc !== cols || nr !== rows) {
        cols = nc; rows = nr;
        cells = new Uint8Array(cols * rows);
        next = new Uint8Array(cols * rows);
        ages = new Uint8Array(cols * rows);
        seed();
      }
      dirty = true;
    }

    function wipe() {
      cells.fill(0);
      ages.fill(0);
      gen = 0;
      dirty = true;
    }

    function seed() {
      wipe();
      for (var i = 0; i < cells.length; i++) cells[i] = Math.random() < 0.22 ? 1 : 0;
    }

    function step() {
      for (var y = 0; y < rows; y++) {
        var up = ((y - 1 + rows) % rows) * cols;
        var mid = y * cols;
        var dn = ((y + 1) % rows) * cols;
        for (var x = 0; x < cols; x++) {
          var l = (x - 1 + cols) % cols;
          var r = (x + 1) % cols;
          var n = cells[up + l] + cells[up + x] + cells[up + r] +
                  cells[mid + l] + cells[mid + r] +
                  cells[dn + l] + cells[dn + x] + cells[dn + r];
          var i = mid + x;
          var alive = cells[i];
          var nv = (n === 3 || (alive && n === 2)) ? 1 : 0;
          next[i] = nv;
          if (alive && !nv) ages[i] = DECAY;
          else if (ages[i]) ages[i]--;
        }
      }
      var t = cells; cells = next; next = t;
      gen++;
      dirty = true;
    }

    function draw() {
      var c = palette();
      var ctx = g.ctx;
      var pop = 0;
      ctx.clearRect(0, 0, g.w, g.h);
      ctx.fillStyle = c.accent;
      for (var i = 0; i < cells.length; i++) {
        if (!cells[i] && !ages[i]) continue;
        if (cells[i]) { pop++; ctx.globalAlpha = 1; }
        else ctx.globalAlpha = ages[i] / DECAY * 0.28;
        ctx.fillRect((i % cols) * CELL + 1, ((i / cols) | 0) * CELL + 1, CELL - 1, CELL - 1);
      }
      ctx.globalAlpha = 1;
      readout.textContent = 'gen ' + gen + '  ·  pop ' + pop + (running ? '' : '  ·  paused');
      dirty = false;
    }

    function setRunning(on) {
      running = on;
      runBtn.textContent = on ? 'pause' : 'run';
      dirty = true;
    }

    var painting = false;
    var paintVal = 1;
    function paint(e) {
      var p = pointer(e, canvas);
      var x = Math.floor(p.x / CELL);
      var y = Math.floor(p.y / CELL);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      cells[y * cols + x] = paintVal;
      dirty = true;
    }
    canvas.addEventListener('pointerdown', function (e) {
      var p = pointer(e, canvas);
      var i = Math.floor(p.y / CELL) * cols + Math.floor(p.x / CELL);
      paintVal = cells[i] ? 0 : 1;
      painting = true;
      canvas.setPointerCapture(e.pointerId);
      paint(e);
    });
    canvas.addEventListener('pointermove', function (e) { if (painting) paint(e); });
    canvas.addEventListener('pointerup', function () { painting = false; });
    canvas.addEventListener('pointercancel', function () { painting = false; });

    runBtn = action(card, 'run', function () { setRunning(!running); });
    action(card, 'step', function () { setRunning(false); step(); });
    action(card, 'random', function () { seed(); });
    action(card, 'clear', function () { wipe(); setRunning(false); });
    action(card, 'gun', function () {
      wipe();
      var ox = 2;
      var oy = Math.max(0, Math.floor(rows / 2) - 5);
      GUN.forEach(function (p) {
        if (p[0] + ox < cols && p[1] + oy < rows) cells[(p[1] + oy) * cols + p[0] + ox] = 1;
      });
      setRunning(true);
    });

    setup();
    setRunning(running);
    resizers.push(setup);
    loop(card, function (dt) {
      if (running && !painting) {
        acc += dt;
        if (acc >= STEP_MS) { acc = 0; step(); }
      }
      if (dirty) draw();
    });
  };

  /* ---------- fourier epicycles ------------------------------------------ */

  /* The drawing is treated as one closed loop of complex numbers x + iy.
   * Its discrete Fourier transform gives one rotating circle per frequency;
   * stacked tip to tail (biggest first) they retrace the drawing. Points
   * carry a `pen` flag so jumps between separate strokes (eye to eye, say)
   * still count in the transform but are not inked. */
  trinkets.fourier = function (card) {
    var canvas = card.querySelector('canvas');
    var readout = card.querySelector('[data-readout]');
    var slider = card.querySelector('[data-terms]');
    var out = card.querySelector('[data-terms-out]');
    var N = 512;
    var CYCLE_MS = 10000;
    var IDLE_MS = 900;    // pause after the last stroke before transforming
    var g, scale;
    var shape = [];       // resampled target, normalized around the center
    var coeffs = [];      // sorted by amplitude, largest first
    var trail = [];
    var t = 0;
    var strokes = [];     // strokes in progress, canvas px
    var pen = false;
    var idleTimer = 0;

    slider.max = N;

    /* HUNTER in bubble script as one closed outline, x/y pairs normalized to
     * the canvas' short side. Generated offline: Script MT Bold, each letter
     * fattened, neighbours bridged, holes slit open, then the outer contour
     * resampled to 512 points. Busy enough to keep sharpening past 250. */
    var HUNTER = [
      -0.482,-0.096,-0.469,-0.096,-0.458,-0.093,-0.445,-0.092,-0.434,-0.095,-0.422,-0.092,-0.416,-0.082,
      -0.422,-0.072,-0.43,-0.062,-0.435,-0.051,-0.438,-0.039,-0.44,-0.027,-0.441,-0.015,-0.432,-0.017,
      -0.427,-0.029,-0.422,-0.04,-0.416,-0.051,-0.41,-0.061,-0.403,-0.072,-0.395,-0.081,-0.385,-0.088,
      -0.374,-0.092,-0.362,-0.095,-0.35,-0.095,-0.347,-0.084,-0.353,-0.073,-0.359,-0.063,-0.365,-0.052,
      -0.371,-0.041,-0.375,-0.03,-0.366,-0.028,-0.356,-0.035,-0.349,-0.045,-0.345,-0.056,-0.339,-0.067,
      -0.331,-0.076,-0.322,-0.085,-0.312,-0.091,-0.3,-0.096,-0.288,-0.097,-0.276,-0.094,-0.266,-0.088,
      -0.257,-0.079,-0.251,-0.068,-0.248,-0.056,-0.248,-0.044,-0.248,-0.032,-0.25,-0.02,-0.253,-0.008,
      -0.257,0.004,-0.26,0.016,-0.264,0.027,-0.268,0.039,-0.271,0.051,-0.266,0.06,-0.257,0.052,-0.25,
      0.041,-0.245,0.03,-0.241,0.018,-0.237,0.007,-0.234,-0.005,-0.231,-0.017,-0.227,-0.029,-0.224,
      -0.041,-0.221,-0.052,-0.217,-0.064,-0.213,-0.076,-0.209,-0.087,-0.199,-0.094,-0.186,-0.095,-0.174,
      -0.096,-0.164,-0.09,-0.165,-0.078,-0.168,-0.067,-0.171,-0.055,-0.174,-0.043,-0.177,-0.031,-0.18,
      -0.019,-0.183,-0.007,-0.186,0.005,-0.188,0.017,-0.191,0.029,-0.193,0.041,-0.194,0.053,-0.186,0.06,
      -0.176,0.053,-0.168,0.044,-0.157,0.039,-0.147,0.046,-0.136,0.041,-0.124,0.044,-0.119,0.055,-0.111,
      0.063,-0.104,0.053,-0.099,0.042,-0.094,0.031,-0.091,0.019,-0.087,0.007,-0.084,-0.005,-0.081,
      -0.017,-0.078,-0.029,-0.075,-0.04,-0.071,-0.052,-0.068,-0.064,-0.064,-0.075,-0.059,-0.087,-0.049,
      -0.094,-0.037,-0.096,-0.025,-0.096,-0.017,-0.088,-0.015,-0.075,-0.015,-0.063,-0.013,-0.051,-0.012,
      -0.039,-0.01,-0.027,-0.008,-0.015,-0.006,-0.003,0.001,-0.0,0.004,-0.012,0.006,-0.024,0.009,-0.036,
      0.012,-0.048,0.015,-0.06,0.02,-0.071,0.026,-0.082,0.035,-0.091,0.046,-0.096,0.058,-0.095,0.067,
      -0.088,0.072,-0.076,0.081,-0.069,0.091,-0.061,0.103,-0.058,0.112,-0.067,0.121,-0.075,0.13,-0.082,
      0.141,-0.088,0.153,-0.092,0.165,-0.095,0.177,-0.097,0.189,-0.096,0.201,-0.094,0.213,-0.091,0.225,
      -0.089,0.236,-0.086,0.242,-0.075,0.252,-0.07,0.264,-0.068,0.273,-0.076,0.283,-0.084,0.294,-0.09,
      0.305,-0.094,0.317,-0.096,0.329,-0.097,0.342,-0.096,0.353,-0.091,0.363,-0.084,0.369,-0.073,0.367,
      -0.061,0.36,-0.052,0.351,-0.044,0.34,-0.047,0.335,-0.058,0.329,-0.069,0.318,-0.067,0.31,-0.058,
      0.307,-0.046,0.308,-0.034,0.318,-0.028,0.33,-0.025,0.335,-0.014,0.332,-0.003,0.323,0.005,0.31,
      0.005,0.298,0.006,0.289,0.014,0.284,0.025,0.283,0.037,0.286,0.049,0.293,0.058,0.304,0.064,0.316,
      0.065,0.328,0.063,0.339,0.057,0.349,0.05,0.358,0.042,0.37,0.041,0.381,0.039,0.393,0.035,0.403,
      0.041,0.405,0.053,0.404,0.065,0.414,0.069,0.423,0.062,0.429,0.051,0.433,0.039,0.436,0.027,0.438,
      0.015,0.439,0.003,0.439,-0.009,0.444,-0.02,0.448,-0.032,0.454,-0.042,0.462,-0.052,0.471,-0.06,
      0.481,-0.067,0.471,-0.07,0.459,-0.067,0.448,-0.063,0.438,-0.056,0.429,-0.048,0.424,-0.037,0.427,
      -0.025,0.436,-0.017,0.436,-0.006,0.426,0.001,0.415,0.006,0.403,0.006,0.394,-0.001,0.388,-0.012,
      0.386,-0.024,0.387,-0.036,0.392,-0.048,0.398,-0.058,0.406,-0.067,0.416,-0.075,0.426,-0.082,0.437,
      -0.087,0.449,-0.091,0.46,-0.094,0.472,-0.096,0.485,-0.097,0.497,-0.097,0.509,-0.095,0.521,-0.092,
      0.532,-0.088,0.543,-0.082,0.552,-0.074,0.56,-0.064,0.565,-0.053,0.567,-0.041,0.565,-0.029,0.56,
      -0.018,0.552,-0.008,0.543,-0.001,0.532,0.005,0.532,0.016,0.536,0.028,0.537,0.04,0.536,0.052,0.543,
      0.058,0.552,0.05,0.561,0.041,0.572,0.042,0.575,0.054,0.571,0.065,0.562,0.074,0.553,0.082,0.543,
      0.089,0.532,0.094,0.52,0.097,0.508,0.095,0.497,0.089,0.489,0.08,0.485,0.068,0.484,0.056,0.485,
      0.044,0.48,0.045,0.474,0.056,0.467,0.065,0.458,0.074,0.449,0.082,0.438,0.088,0.427,0.093,0.415,
      0.096,0.403,0.097,0.391,0.095,0.379,0.091,0.37,0.084,0.361,0.075,0.35,0.081,0.34,0.087,0.328,
      0.092,0.317,0.095,0.304,0.097,0.292,0.097,0.28,0.095,0.268,0.092,0.257,0.087,0.248,0.079,0.24,
      0.07,0.234,0.059,0.231,0.047,0.232,0.035,0.235,0.023,0.24,0.012,0.248,0.003,0.257,-0.005,0.267,
      -0.012,0.264,-0.023,0.26,-0.035,0.255,-0.046,0.244,-0.051,0.232,-0.054,0.221,-0.049,0.209,-0.047,
      0.199,-0.044,0.198,-0.032,0.196,-0.02,0.196,-0.007,0.196,0.005,0.195,0.017,0.193,0.029,0.189,
      0.041,0.184,0.052,0.177,0.062,0.169,0.072,0.16,0.08,0.15,0.086,0.139,0.091,0.127,0.095,0.115,
      0.097,0.103,0.097,0.09,0.095,0.079,0.09,0.069,0.083,0.061,0.074,0.059,0.062,0.065,0.051,0.074,
      0.043,0.085,0.038,0.096,0.042,0.1,0.053,0.102,0.065,0.112,0.071,0.124,0.068,0.134,0.061,0.141,
      0.051,0.144,0.04,0.146,0.027,0.146,0.015,0.146,0.003,0.147,-0.009,0.15,-0.021,0.155,-0.032,0.164,
      -0.041,0.174,-0.048,0.174,-0.056,0.162,-0.058,0.15,-0.059,0.138,-0.056,0.128,-0.05,0.121,-0.04,
      0.119,-0.028,0.127,-0.019,0.133,-0.009,0.128,0.002,0.118,0.01,0.107,0.013,0.096,0.008,0.089,
      -0.002,0.086,-0.014,0.087,-0.026,0.087,-0.038,0.078,-0.046,0.068,-0.053,0.057,-0.057,0.045,-0.054,
      0.038,-0.044,0.034,-0.033,0.031,-0.021,0.028,-0.009,0.026,0.003,0.023,0.015,0.02,0.027,0.017,
      0.039,0.013,0.051,0.009,0.062,0.004,0.073,-0.001,0.084,-0.01,0.093,-0.022,0.096,-0.034,0.096,
      -0.043,0.089,-0.045,0.077,-0.046,0.065,-0.047,0.052,-0.049,0.04,-0.051,0.028,-0.053,0.016,-0.057,
      0.005,-0.064,0.014,-0.067,0.025,-0.071,0.037,-0.075,0.049,-0.08,0.06,-0.086,0.071,-0.093,0.08,
      -0.102,0.089,-0.113,0.094,-0.125,0.097,-0.137,0.095,-0.148,0.089,-0.156,0.08,-0.166,0.076,-0.175,
      0.084,-0.185,0.091,-0.197,0.095,-0.209,0.097,-0.22,0.093,-0.23,0.085,-0.238,0.076,-0.248,0.081,
      -0.258,0.089,-0.269,0.094,-0.281,0.097,-0.293,0.095,-0.303,0.089,-0.312,0.08,-0.317,0.069,-0.319,
      0.057,-0.319,0.045,-0.317,0.033,-0.314,0.021,-0.311,0.009,-0.308,-0.003,-0.312,-0.008,-0.321,0.0,
      -0.332,0.004,-0.343,-0.003,-0.352,-0.009,-0.362,-0.002,-0.371,0.005,-0.383,0.01,-0.39,0.019,
      -0.392,0.031,-0.392,0.043,-0.389,0.055,-0.378,0.059,-0.367,0.053,-0.359,0.044,-0.348,0.04,-0.341,
      0.049,-0.343,0.061,-0.351,0.071,-0.36,0.079,-0.37,0.086,-0.38,0.092,-0.392,0.096,-0.404,0.097,
      -0.416,0.093,-0.426,0.087,-0.434,0.077,-0.439,0.066,-0.442,0.054,-0.443,0.042,-0.443,0.03,-0.45,
      0.027,-0.454,0.039,-0.458,0.05,-0.464,0.061,-0.472,0.071,-0.48,0.079,-0.49,0.087,-0.501,0.092,
      -0.513,0.095,-0.525,0.097,-0.537,0.096,-0.549,0.093,-0.56,0.087,-0.569,0.079,-0.575,0.068,-0.573,
      0.057,-0.566,0.047,-0.556,0.039,-0.545,0.037,-0.536,0.045,-0.534,0.057,-0.53,0.068,-0.519,0.069,
      -0.511,0.059,-0.506,0.048,-0.504,0.036,-0.515,0.038,-0.526,0.037,-0.53,0.025,-0.525,0.015,-0.515,
      0.007,-0.505,0.0,-0.495,-0.006,-0.491,-0.018,-0.486,-0.029,-0.48,-0.04,-0.473,-0.05,-0.478,-0.059,
      -0.49,-0.061,-0.501,-0.058,-0.506,-0.047,-0.501,-0.036,-0.496,-0.025,-0.501,-0.015,-0.51,-0.007,
      -0.522,-0.007,-0.531,-0.015,-0.536,-0.026,-0.537,-0.038,-0.535,-0.05,-0.529,-0.061,-0.522,-0.071,
      -0.513,-0.079,-0.504,-0.087,-0.493,-0.093
    ];

    function hunter() {
      var out = [];
      for (var i = 0; i < HUNTER.length; i += 2) out.push({ x: HUNTER[i], y: HUNTER[i + 1] });
      return [out];
    }

    /* Join strokes into one loop; the first point of every stroke is reached
     * by a pen-up jump when there is more than one stroke. */
    function join(list) {
      var pts = [];
      list.forEach(function (s) {
        s.forEach(function (p, i) {
          pts.push({ x: p.x, y: p.y, pen: !(i === 0 && list.length > 1) });
        });
      });
      return pts;
    }

    /* Even arc-length resampling of a closed path to n points. */
    function resample(pts, n) {
      var closed = pts.concat([pts[0]]);
      var lens = [0];
      for (var i = 1; i < closed.length; i++) {
        lens.push(lens[i - 1] + Math.hypot(closed[i].x - closed[i - 1].x, closed[i].y - closed[i - 1].y));
      }
      var total = lens[lens.length - 1] || 1;
      var res = [];
      var j = 1;
      for (var k = 0; k < n; k++) {
        var target = k / n * total;
        while (j < lens.length - 1 && lens[j] < target) j++;
        var seg = lens[j] - lens[j - 1] || 1;
        var f = (target - lens[j - 1]) / seg;
        res.push({
          x: closed[j - 1].x + (closed[j].x - closed[j - 1].x) * f,
          y: closed[j - 1].y + (closed[j].y - closed[j - 1].y) * f,
          pen: closed[j].pen
        });
      }
      return res;
    }

    function dft(pts) {
      var n = pts.length;
      var res = [];
      for (var k = 0; k < n; k++) {
        var re = 0, im = 0;
        for (var m = 0; m < n; m++) {
          var a = -TAU * k * m / n;
          var c = Math.cos(a), s = Math.sin(a);
          re += pts[m].x * c - pts[m].y * s;
          im += pts[m].x * s + pts[m].y * c;
        }
        re /= n; im /= n;
        res.push({ f: k <= n / 2 ? k : k - n, amp: Math.hypot(re, im), ph: Math.atan2(im, re) });
      }
      res.sort(function (a, b) { return b.amp - a.amp; });
      return res;
    }

    function load(list) {
      shape = resample(join(list), N);
      coeffs = dft(shape);
      t = 0;
      trail = [];
    }

    function setup() {
      g = fit(canvas);
      scale = Math.min(g.w, g.h);
      trail = [];
    }

    function tip(time, count, cb) {
      var x = g.w / 2, y = g.h / 2;
      for (var i = 0; i < count; i++) {
        var co = coeffs[i];
        var px = x, py = y;
        var a = co.f * TAU * time + co.ph;
        x += scale * co.amp * Math.cos(a);
        y += scale * co.amp * Math.sin(a);
        if (cb) cb(px, py, x, y, scale * co.amp);
      }
      return { x: x, y: y, pen: shape[Math.min(N - 1, Math.floor(time * N))].pen };
    }

    function ink(ctx, pts) {
      ctx.beginPath();
      pts.forEach(function (p, i) {
        if (i && p.pen) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
    }

    function frame(dt) {
      var c = palette();
      var ctx = g.ctx;
      ctx.clearRect(0, 0, g.w, g.h);

      if (strokes.length) {
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        strokes.forEach(function (s) {
          ctx.beginPath();
          s.forEach(function (p, i) { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
          ctx.stroke();
        });
        readout.textContent = 'drawing ' + strokes.length + (strokes.length === 1 ? ' stroke' : ' strokes') +
          '\nkeep going, or pause and the transform kicks in';
        return;
      }

      var count = +slider.value;

      // faint target
      ctx.strokeStyle = c.line;
      ctx.lineWidth = 1;
      ink(ctx, shape.map(function (p) {
        return { x: g.w / 2 + p.x * scale, y: g.h / 2 + p.y * scale, pen: p.pen };
      }));

      if (reduceMotion) {
        // Skip the animation and show the full reconstruction.
        var full = [];
        for (var s = 0; s < N * 2; s++) full.push(tip(s / (N * 2), count));
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        ink(ctx, full);
      } else {
        t += dt / CYCLE_MS;
        if (t >= 1) { t -= 1; trail = []; }

        ctx.lineWidth = 1;
        var end = tip(t, count, function (px, py, x, y, r) {
          if (r > 0.6) {
            ctx.strokeStyle = c.line;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, TAU);
            ctx.stroke();
          }
          ctx.strokeStyle = c.muted;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
        trail.push(end);

        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 6;
        ink(ctx, trail);
        ctx.shadowBlur = 0;

        ctx.fillStyle = c.bright;
        ctx.beginPath();
        ctx.arc(end.x, end.y, 2.5, 0, TAU);
        ctx.fill();
      }

      readout.textContent = 'fourier transform of the drawing: ' + count + ' of ' + N +
        ' frequency terms,\neach a circle spinning at its own rate, stacked tip to tail';
    }

    function commit() {
      var list = strokes.filter(function (s) { return s.length > 2; });
      strokes = [];
      if (!list.length) return;
      load(list.map(function (s) {
        return s.map(function (p) { return { x: (p.x - g.w / 2) / scale, y: (p.y - g.h / 2) / scale }; });
      }));
    }

    canvas.addEventListener('pointerdown', function (e) {
      clearTimeout(idleTimer);
      pen = true;
      strokes.push([pointer(e, canvas)]);
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!pen) return;
      var s = strokes[strokes.length - 1];
      var p = pointer(e, canvas);
      var last = s[s.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 2) s.push(p);
    });
    function lift() {
      if (!pen) return;
      pen = false;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(commit, IDLE_MS);
    }
    canvas.addEventListener('pointerup', lift);
    canvas.addEventListener('pointercancel', lift);

    slider.addEventListener('input', function () {
      out.textContent = slider.value;
      t = 0;
      trail = [];
    });
    action(card, 'reset', function () { clearTimeout(idleTimer); strokes = []; load(hunter()); });

    setup();
    load(hunter());
    resizers.push(setup);
    loop(card, frame);
  };

  /* ---------- lissajous --------------------------------------------------- */

  trinkets.lissajous = function (card) {
    var canvas = card.querySelector('canvas');
    var readout = card.querySelector('[data-readout]');
    var sa = card.querySelector('[data-a]');
    var sb = card.querySelector('[data-b]');
    var g;
    var phase = 0;
    var drift = !reduceMotion;
    var driftBtn;

    function setup() { g = fit(canvas); }

    function frame(dt) {
      var c = palette();
      var ctx = g.ctx;
      var a = +sa.value, b = +sb.value;
      if (drift) phase = (phase + dt * 0.0005) % TAU;

      // Phosphor persistence: fade the previous frame instead of clearing it.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, g.w, g.h);
      ctx.globalAlpha = 0.5;
      scopeGrid(g, c);
      ctx.globalAlpha = 1;

      var cx = g.w / 2, cy = g.h / 2;
      var rx = g.w * 0.42, ry = g.h * 0.42;
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = c.accent;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (var i = 0; i <= 720; i++) {
        var s = i / 720 * TAU;
        var x = cx + rx * Math.sin(a * s + phase);
        var y = cy + ry * Math.sin(b * s);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      readout.textContent = 'x = sin(' + a + 't + ' + phase.toFixed(2) + ')   y = sin(' + b + 't)   ' + a + ':' + b;
    }

    [sa, sb].forEach(function (input) {
      var out = card.querySelector(input === sa ? '[data-a-out]' : '[data-b-out]');
      input.addEventListener('input', function () { out.textContent = input.value; });
    });

    var scrubbing = false;
    function scrub(e) { phase = pointer(e, canvas).x / g.w * TAU; }
    canvas.addEventListener('pointerdown', function (e) {
      scrubbing = true;
      canvas.setPointerCapture(e.pointerId);
      drift = false;
      driftBtn.textContent = 'drift';
      scrub(e);
    });
    canvas.addEventListener('pointermove', function (e) { if (scrubbing) scrub(e); });
    canvas.addEventListener('pointerup', function () { scrubbing = false; });
    canvas.addEventListener('pointercancel', function () { scrubbing = false; });

    driftBtn = action(card, 'drift', function (btn) {
      drift = !drift;
      btn.textContent = drift ? 'freeze' : 'drift';
    });
    driftBtn.textContent = drift ? 'freeze' : 'drift';

    setup();
    resizers.push(setup);
    loop(card, frame);
  };

  /* ---------- rc filter --------------------------------------------------- */

  trinkets.filter = function (card) {
    var canvas = card.querySelector('canvas');
    var readout = card.querySelector('[data-readout]');
    var slider = card.querySelector('[data-fc]');
    var F0 = 50;          // input frequency, Hz
    var PERIODS = 4;      // periods across the screen
    var WAVES = ['square', 'triangle', 'saw'];
    var wave = 0;
    var lowPass = true;
    var offset = 0;
    var g;

    function setup() { g = fit(canvas); }

    function input(time) {
      var p = (time * F0) % 1;
      if (p < 0) p += 1;
      if (wave === 0) return p < 0.5 ? 1 : -1;
      if (wave === 1) return 4 * Math.abs(p - 0.5) - 1;
      return 2 * p - 1;
    }

    function cutoff() { return 5 * Math.pow(1000, slider.value / 1000); }   // 5 Hz .. 5 kHz

    function fmtHz(f) { return f >= 1000 ? (f / 1000).toFixed(2) + ' kHz' : f.toFixed(f < 10 ? 1 : 0) + ' Hz'; }

    function frame(dt) {
      var c = palette();
      var ctx = g.ctx;
      var fc = cutoff();
      var rc = 1 / (TAU * fc);
      var w = Math.max(2, Math.round(g.w));
      var span = PERIODS / F0;
      var h = span / w;
      var alpha = h / (rc + h);
      if (!reduceMotion) offset += dt * 0.00004;   // slow-motion sweep

      // Run the filter long enough beforehand to reach steady state.
      var warm = Math.min(Math.ceil(Math.max(2 / F0, 6 * rc) / h), w * 40);
      var start = offset - warm * h;
      var y = 0;
      for (var k = 0; k < warm; k++) y += alpha * (input(start + k * h) - y);

      ctx.clearRect(0, 0, g.w, g.h);
      scopeGrid(g, c);
      var cy = g.h / 2;
      var amp = g.h * 0.32;

      var inPts = [], outPts = [];
      for (var i = 0; i < w; i++) {
        var x = input(offset + i * h);
        y += alpha * (x - y);
        inPts.push(cy - x * amp);
        outPts.push(cy - (lowPass ? y : x - y) * amp);
      }

      ctx.lineWidth = 1.2;
      ctx.strokeStyle = c.muted;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      inPts.forEach(function (v, i) { i ? ctx.lineTo(i, v) : ctx.moveTo(i, v); });
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.lineWidth = 2;
      ctx.strokeStyle = c.accent;
      ctx.shadowColor = c.accent;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      outPts.forEach(function (v, i) { i ? ctx.lineTo(i, v) : ctx.moveTo(i, v); });
      ctx.stroke();
      ctx.shadowBlur = 0;

      readout.textContent = (lowPass ? 'low-pass' : 'high-pass') + '  ·  fc ' + fmtHz(fc) +
        '  ·  RC ' + (rc * 1000).toFixed(2) + ' ms  ·  in: ' + F0 + ' Hz ' + WAVES[wave];
    }

    action(card, 'wave', function (btn) {
      wave = (wave + 1) % WAVES.length;
      btn.textContent = WAVES[wave];
    });
    action(card, 'mode', function (btn) {
      lowPass = !lowPass;
      btn.textContent = lowPass ? 'low-pass' : 'high-pass';
    });

    setup();
    resizers.push(setup);
    loop(card, frame);
  };

  /* ---------- resistor ---------------------------------------------------- */

  trinkets.resistor = function (card) {
    var svg = card.querySelector('svg');
    var readout = card.querySelector('[data-readout]');
    var C = {
      black:  { hex: '#141414', digit: 0, mult: 1 },
      brown:  { hex: '#6b3a1e', digit: 1, mult: 10,   tol: 1 },
      red:    { hex: '#c62828', digit: 2, mult: 100,  tol: 2 },
      orange: { hex: '#ef6c00', digit: 3, mult: 1e3 },
      yellow: { hex: '#f4cf1d', digit: 4, mult: 1e4 },
      green:  { hex: '#2e7d32', digit: 5, mult: 1e5,  tol: 0.5 },
      blue:   { hex: '#1565c0', digit: 6, mult: 1e6,  tol: 0.25 },
      violet: { hex: '#7b1fa2', digit: 7, mult: 1e7,  tol: 0.1 },
      grey:   { hex: '#8a8a8a', digit: 8, mult: 1e8,  tol: 0.05 },
      white:  { hex: '#f2f2f2', digit: 9, mult: 1e9 },
      gold:   { hex: '#c9a227', mult: 0.1,  tol: 5 },
      silver: { hex: '#b8b8b8', mult: 0.01, tol: 10 }
    };
    var DIGITS = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
    var OPTIONS = [
      DIGITS.slice(1),
      DIGITS,
      DIGITS.concat(['gold', 'silver']),
      ['brown', 'red', 'green', 'blue', 'violet', 'grey', 'gold', 'silver']
    ];
    var BAND_X = [104, 134, 164, 216];
    var state = [3, 7, 2, 6];   // yellow violet red gold -> 4.7 kΩ ±5%
    var quiz = false;
    var quizBtn;

    var NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs, parent) {
      var node = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
      (parent || svg).appendChild(node);
      return node;
    }

    var defs = el('defs', {});
    var clip = el('clipPath', { id: 'resistor-body' }, defs);
    el('rect', { x: 70, y: 55, width: 180, height: 70, rx: 30 }, clip);
    el('line', { x1: 8, y1: 90, x2: 80, y2: 90, stroke: '#9aa3a8', 'stroke-width': 5, 'stroke-linecap': 'round' });
    el('line', { x1: 240, y1: 90, x2: 312, y2: 90, stroke: '#9aa3a8', 'stroke-width': 5, 'stroke-linecap': 'round' });
    el('rect', { x: 70, y: 55, width: 180, height: 70, rx: 30, fill: '#d8c29a' });
    var bands = BAND_X.map(function (x, i) {
      var r = el('rect', {
        x: x, y: 55, width: 15, height: 70,
        'clip-path': 'url(#resistor-body)',
        'class': 'resistor-band',
        'data-band': i,
        tabindex: 0,
        role: 'button'
      });
      return r;
    });
    el('rect', { x: 70, y: 55, width: 180, height: 70, rx: 30, fill: 'url(#resistor-shine)', 'pointer-events': 'none' });
    var shine = el('linearGradient', { id: 'resistor-shine', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '0.28' }, shine);
    el('stop', { offset: '0.45', 'stop-color': '#fff', 'stop-opacity': '0' }, shine);
    el('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '0.25' }, shine);

    function names() { return state.map(function (s, i) { return OPTIONS[i][s]; }); }

    function fmtOhms(v) {
      var units = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k']];
      for (var i = 0; i < units.length; i++) {
        if (v >= units[i][0]) return +(v / units[i][0]).toPrecision(3) + ' ' + units[i][1] + 'Ω';
      }
      return +v.toPrecision(3) + ' Ω';
    }

    function render() {
      var n = names();
      bands.forEach(function (b, i) {
        b.setAttribute('fill', C[n[i]].hex);
        b.setAttribute('aria-label', 'band ' + (i + 1) + ': ' + n[i]);
      });
      var value = (C[n[0]].digit * 10 + C[n[1]].digit) * C[n[2]].mult;
      var label = fmtOhms(value) + '  ±' + C[n[3]].tol + '%';
      readout.textContent = n.join(' · ') + '\n' + (quiz ? '= ???   (click reveal)' : '= ' + label) +
        (note ? '\n' + note : '');
      note = '';
    }

    function nudge(i, dir) {
      var len = OPTIONS[i].length;
      state[i] = (state[i] + dir + len) % len;
      render();
    }

    bands.forEach(function (b, i) {
      b.addEventListener('click', function () { nudge(i, 1); });
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); nudge(i, -1); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); nudge(i, 1); }
        if (e.key === 'ArrowDown') { e.preventDefault(); nudge(i, -1); }
      });
    });

    function randomize() {
      // Mostly E12-ish parts with common tolerances so the quiz feels real.
      state = [
        Math.floor(Math.random() * 9),
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 7),
        [0, 1, 6, 6, 6, 7][Math.floor(Math.random() * 6)]
      ];
    }

    /* Reverse lookup: type a resistance, get the nearest E24 (5%) part. */
    var E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
    var SI = { r: 1, '': 1, k: 1e3, m: 1e6, g: 1e9 };
    var lookup = card.querySelector('[data-lookup]');
    var lookupInput = card.querySelector('[data-lookup-input]');
    var note = '';

    /* Accepts 470, 4.7k, 4k7, 2M2, 10 kΩ, 330 ohm. */
    function parseOhms(text) {
      var s = text.trim().toLowerCase().replace(/\s+/g, '').replace(/(ohms?|Ω)$/, '');
      var m = s.match(/^(\d+)([rkmg])(\d+)$/);
      if (m) return parseFloat(m[1] + '.' + m[3]) * SI[m[2]];
      m = s.match(/^(\d*\.?\d+)([rkmg]?)$/);
      return m ? parseFloat(m[1]) * SI[m[2]] : NaN;
    }

    function nearest(value) {
      var best = null;
      for (var exp = -2; exp <= 9; exp++) {
        E24.forEach(function (dd) {
          var v = dd * Math.pow(10, exp);
          var err = Math.abs(Math.log(v / value));
          if (!best || err < best.err) best = { dd: dd, exp: exp, v: v, err: err };
        });
      }
      return best;
    }

    lookup.addEventListener('submit', function (e) {
      e.preventDefault();
      var value = parseOhms(lookupInput.value);
      if (!(value > 0)) {
        note = 'could not read "' + lookupInput.value + '", try 470, 4.7k or 4k7';
        render();
        return;
      }
      var part = nearest(value);
      var multIndex = part.exp >= 0 ? part.exp : (part.exp === -1 ? 10 : 11);
      state = [Math.floor(part.dd / 10) - 1, part.dd % 10, multIndex, 6];
      quiz = false;
      quizBtn.textContent = 'quiz me';
      var off = (part.v / value - 1) * 100;
      note = Math.abs(off) < 0.05
        ? fmtOhms(value) + ' is a standard E24 value'
        : 'nearest E24 part to ' + fmtOhms(value) + ' (' + (off > 0 ? '+' : '') + off.toFixed(1) + '%)';
      render();
    });

    action(card, 'random', function () { randomize(); render(); });
    quizBtn = action(card, 'quiz', function (btn) {
      if (quiz) {
        quiz = false;
        btn.textContent = 'quiz me';
      } else {
        quiz = true;
        randomize();
        btn.textContent = 'reveal';
      }
      render();
    });

    render();
  };

  /* ---------- ripple-carry adder ----------------------------------------- */

  trinkets.adder = function (card) {
    var readout = card.querySelector('[data-readout]');
    var BITS = 4;
    var RIPPLE_MS = 110;
    var a = 5, b = 3;
    var timers = [];
    var lastSums = [0, 0, 0, 0, 0];
    var lastCarries = [0, 0, 0, 0, 0];

    function row(name) { return card.querySelector('[data-bits="' + name + '"]'); }
    function dec(name) { return card.querySelector('[data-dec="' + name + '"]'); }

    function build(name, value, onFlip) {
      var host = row(name);
      host.appendChild(document.createElement('span'));   // carry-out column
      var btns = [];
      for (var i = BITS - 1; i >= 0; i--) {
        (function (bit) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'bit';
          btn.setAttribute('aria-label', name + bit);
          btn.addEventListener('click', function () { onFlip(bit); });
          host.appendChild(btn);
          btns[bit] = btn;
        })(i);
      }
      return btns;
    }

    function leds(name, cls) {
      var host = row(name);
      var out = [];
      for (var i = BITS; i >= 0; i--) {
        var led = document.createElement('span');
        led.className = cls;
        host.appendChild(led);
        out[i] = led;
      }
      return out;
    }

    var aBtns = build('a', a, function (bit) { a ^= 1 << bit; update(); });
    var bBtns = build('b', b, function (bit) { b ^= 1 << bit; update(); });
    var carryLeds = leds('c', 'carry');
    var sumLeds = leds('s', 'led');

    function bin(v, n) { return (v >>> 0).toString(2).padStart(n, '0'); }

    function update() {
      timers.forEach(clearTimeout);
      timers = [];

      for (var i = 0; i < BITS; i++) {
        aBtns[i].setAttribute('aria-pressed', (a >> i) & 1 ? 'true' : 'false');
        aBtns[i].textContent = (a >> i) & 1;
        bBtns[i].setAttribute('aria-pressed', (b >> i) & 1 ? 'true' : 'false');
        bBtns[i].textContent = (b >> i) & 1;
      }
      dec('a').textContent = a;
      dec('b').textContent = b;

      // Full adders, LSB first; each stage lights up one tick after the last.
      var carry = 0;
      var carries = [0];
      var sums = [];
      for (var k = 0; k < BITS; k++) {
        var x = (a >> k) & 1, y = (b >> k) & 1;
        sums[k] = x ^ y ^ carry;
        carry = (x & y) | (carry & (x ^ y));
        carries[k + 1] = carry;
      }
      sums[BITS] = carry;
      lastSums = sums;
      lastCarries = carries;
      renderViews();

      sumLeds.forEach(function (led) { led.classList.remove('on'); });
      carryLeds.forEach(function (led) { led.classList.remove('on'); });
      for (var s = 0; s <= BITS; s++) {
        (function (stage) {
          function light() {
            sumLeds[stage].classList.toggle('on', !!sums[stage]);
            carryLeds[stage].classList.toggle('on', !!carries[stage]);
          }
          if (reduceMotion) light();
          else timers.push(setTimeout(light, stage * RIPPLE_MS));
        })(s);
      }

      var total = a + b;
      dec('s').textContent = total;
      readout.textContent = bin(a, BITS) + ' + ' + bin(b, BITS) + ' = ' + bin(total, BITS + 1) +
        '   (' + a + ' + ' + b + ' = ' + total + ', 0x' + total.toString(16).toUpperCase().padStart(2, '0') + ')' +
        (total > 15 ? '\ncarry out: 4 bits overflowed' : '');
    }

    action(card, 'random', function () {
      a = Math.floor(Math.random() * 16);
      b = Math.floor(Math.random() * 16);
      update();
    });
    action(card, 'max', function () { a = 15; b = 1; update(); });
    action(card, 'clear', function () { a = 0; b = 0; update(); });

    /* ---- alternate views: gate-level schematic and the Verilog ---------- */

    var VIEWS = ['bits', 'gates', 'verilog'];
    var view = 0;
    var selected = 0;                 // which bit the gate view zooms into
    var panes = {
      bits: card.querySelector('.adder'),
      gates: card.querySelector('.adder-gates'),
      verilog: card.querySelector('.adder-code')
    };
    var SVGNS = 'http://www.w3.org/2000/svg';
    var gs = panes.gates;
    var wires = {};
    var gates = {};
    var texts = {};
    var blocks = [];

    function node(tag, attrs, parent) {
      var n = document.createElementNS(SVGNS, tag);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      (parent || gs).appendChild(n);
      return n;
    }
    function wire(name, pts) {
      wires[name] = wires[name] || [];
      wires[name].push(node('polyline', { points: pts.map(function (p) { return p.join(','); }).join(' '), 'class': 'gw' }));
    }
    function label(name, x, y, anchor, cls) {
      texts[name] = node('text', { x: x, y: y, 'text-anchor': anchor || 'start', 'class': cls || 'gt' });
      return texts[name];
    }
    /* Gate outlines; (x, cy) is the left edge / vertical center, 40x30. */
    function gate(name, kind, x, cy) {
      var d;
      if (kind === 'and') {
        d = 'M' + x + ',' + (cy - 15) + ' H' + (x + 20) + ' A15,15 0 0 1 ' + (x + 20) + ',' + (cy + 15) + ' H' + x + ' Z';
      } else {
        d = 'M' + x + ',' + (cy - 15) + ' Q' + (x + 26) + ',' + (cy - 15) + ' ' + (x + 40) + ',' + cy +
            ' Q' + (x + 26) + ',' + (cy + 15) + ' ' + x + ',' + (cy + 15) + ' Q' + (x + 10) + ',' + cy + ' ' + x + ',' + (cy - 15) + ' Z';
      }
      var grp = node('g', {});
      if (kind === 'xor') {
        node('path', { d: 'M' + (x - 6) + ',' + (cy - 15) + ' Q' + (x + 4) + ',' + cy + ' ' + (x - 6) + ',' + (cy + 15), 'class': 'gx' }, grp);
      }
      gates[name] = node('path', { d: d, 'class': 'gg' }, grp);
      node('text', { x: x + 16, y: cy + 3, 'text-anchor': 'middle', 'class': 'gk' }, grp).textContent = kind;
    }

    function buildGates() {
      // chain of four full adders, MSB on the left like the binary number
      node('text', { x: 200, y: 12, 'text-anchor': 'middle', 'class': 'gh' }).textContent = '4-bit ripple carry: click a block';
      for (var i = 0; i < BITS; i++) {
        (function (bit) {
          var bx = 300 - bit * 90;
          var g = node('g', { 'class': 'gblock', tabindex: 0, role: 'button', 'aria-label': 'full adder ' + bit });
          blocks[bit] = node('rect', { x: bx, y: 30, width: 64, height: 28, 'class': 'gb' }, g);
          node('text', { x: bx + 32, y: 48, 'text-anchor': 'middle', 'class': 'gt' }, g).textContent = 'FA' + bit;
          label('ab' + bit, bx + 32, 25, 'middle');
          label('s' + bit, bx + 32, 72, 'middle');
          g.addEventListener('click', function () { selected = bit; renderViews(); });
          g.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selected = bit; renderViews(); }
          });
          wire('c' + bit, [[bx + 90, 44], [bx + 64, 44]]);
        })(i);
      }
      wire('c4', [[30, 44], [8, 44]]);
      label('c0lbl', 392, 40, 'end');
      label('c4lbl', 6, 40, 'start');

      // gate-level view of the selected full adder
      label('title', 200, 100, 'middle', 'gh');
      wire('a', [[40, 115], [70, 115], [70, 127], [112, 127]]);
      wire('a', [[70, 127], [70, 187], [112, 187]]);
      wire('b', [[40, 160], [85, 160], [85, 143], [112, 143]]);
      wire('b', [[85, 160], [85, 203], [112, 203]]);
      wire('cin', [[40, 270], [195, 270], [195, 153], [222, 153]]);
      wire('cin', [[195, 243], [222, 243]]);
      wire('x1', [[150, 135], [170, 135], [170, 137], [222, 137]]);
      wire('x1', [[170, 137], [170, 227], [222, 227]]);
      wire('g', [[145, 195], [285, 195], [285, 207], [312, 207]]);
      wire('p', [[255, 235], [295, 235], [295, 223], [312, 223]]);
      wire('s', [[260, 145], [385, 145]]);
      wire('cout', [[350, 215], [385, 215]]);
      gate('x1', 'xor', 110, 135);
      gate('g', 'and', 110, 195);
      gate('s', 'xor', 220, 145);
      gate('p', 'and', 220, 235);
      gate('cout', 'or', 310, 215);
      label('la', 36, 119, 'end');
      label('lb', 36, 164, 'end');
      label('lcin', 36, 274, 'end');
      label('ls', 388, 139, 'end');
      label('lcout', 388, 209, 'end');
      node('text', { x: 172, y: 128, 'class': 'gn' }).textContent = 'a^b';
      node('text', { x: 200, y: 190, 'class': 'gn' }).textContent = 'a&b';
      node('text', { x: 262, y: 250, 'class': 'gn' }).textContent = 'cin&(a^b)';
    }

    var CODE = [
      '// ripple_adder.v: four full adders, each carry feeds the next',
      'module full_adder(input a, b, cin, output s, cout);',
      '  assign s    = a ^ b ^ cin;',
      '  assign cout = (a & b) | (cin & (a ^ b));',
      'endmodule',
      '',
      'module ripple_adder4(input [3:0] a, b, output [4:0] sum);',
      '  wire [4:0] c;',
      "  assign c[0] = 1'b0;",
      '  genvar i;',
      '  generate for (i = 0; i < 4; i = i + 1) begin : fa',
      '    full_adder u(.a(a[i]), .b(b[i]), .cin(c[i]),',
      '                 .s(sum[i]), .cout(c[i+1]));',
      '  end endgenerate',
      '  assign sum[4] = c[4];',
      'endmodule',
      ''
    ];
    var TOKEN = /(\/\/.*$|\b(?:module|endmodule|input|output|wire|assign|genvar|generate|endgenerate|for|begin|end)\b|\d+'b[01]+|\[\d+:\d+\])/;
    var liveLine;

    function buildCode() {
      var pre = panes.verilog;
      CODE.forEach(function (line) {
        line.split(TOKEN).forEach(function (part, i) {
          if (!part) return;
          var span = document.createElement('span');
          if (i % 2) span.className = part.indexOf('//') === 0 ? 'vc' : /^[a-z]/.test(part) ? 'vk' : 'vn';
          span.textContent = part;
          pre.appendChild(span);
        });
        pre.appendChild(document.createTextNode('\n'));
      });
      liveLine = document.createElement('span');
      liveLine.className = 'vlive';
      pre.appendChild(liveLine);
    }

    function lit(el, on) { el.classList.toggle('on', !!on); }

    function renderViews() {
      var bit = selected;
      var x = (a >> bit) & 1, y = (b >> bit) & 1, cin = lastCarries[bit];
      var x1 = x ^ y, g = x & y, p = cin & x1;
      var vals = { a: x, b: y, cin: cin, x1: x1, g: g, p: p, s: x1 ^ cin, cout: g | p };
      Object.keys(wires).forEach(function (k) {
        var m = /^c(\d)$/.exec(k);
        var v = m ? lastCarries[+m[1]] : vals[k];
        wires[k].forEach(function (w) { lit(w, v); });
      });
      Object.keys(gates).forEach(function (k) { lit(gates[k], vals[k]); });
      for (var i = 0; i < BITS; i++) {
        blocks[i].classList.toggle('sel', i === bit);
        texts['ab' + i].textContent = 'a' + i + '=' + ((a >> i) & 1) + ' b' + i + '=' + ((b >> i) & 1);
        texts['s' + i].textContent = 's' + i + '=' + lastSums[i];
      }
      texts.c0lbl.textContent = 'c0=0';
      texts.c4lbl.textContent = 'c4=' + lastCarries[BITS];
      texts.title.textContent = 'inside FA' + bit;
      texts.la.textContent = 'a' + bit + '=' + x;
      texts.lb.textContent = 'b' + bit + '=' + y;
      texts.lcin.textContent = 'c' + bit + '=' + cin;
      texts.ls.textContent = 's' + bit + '=' + vals.s;
      texts.lcout.textContent = 'c' + (bit + 1) + '=' + vals.cout;

      var total = a + b;
      liveLine.textContent = "// live: a = 4'b" + bin(a, BITS) + ", b = 4'b" + bin(b, BITS) +
        "  ->  sum = 5'b" + bin(total, BITS + 1) + '  (' + a + ' + ' + b + ' = ' + total + ')';
    }

    function showView() {
      // toggleAttribute, not .hidden: SVG elements have no `hidden` property
      VIEWS.forEach(function (name, i) { panes[name].toggleAttribute('hidden', i !== view); });
      viewBtn.textContent = 'view: ' + VIEWS[view];
    }

    var viewBtn = action(card, 'view', function () {
      view = (view + 1) % VIEWS.length;
      showView();
    });

    buildGates();
    buildCode();
    showView();

    update();
  };

  /* ---------- sierpinski (chaos game) ------------------------------------ */

  /* Start anywhere, pick a random corner, jump part of the way toward it,
   * plot, repeat. With three corners and a half-way jump the random dots
   * can only ever land on the Sierpinski triangle. Corners are draggable. */
  trinkets.sierpinski = function (card) {
    var canvas = card.querySelector('canvas');
    var readout = card.querySelector('[data-readout]');
    var cornersBtn = card.querySelector('[data-action="corners"]');
    var MAX_POINTS = 90000;
    var PER_FRAME = 350;
    // corners -> [fraction of the distance jumped, forbid repeating a corner]
    var RULES = {
      3: [0.5, false, 'sierpinski triangle'],
      4: [0.5, true, 'no corner twice in a row'],
      5: [0.618, false, 'pentaflake'],
      6: [0.667, false, 'hexaflake']
    };
    var g, corners = [], n = 3, x = 0, y = 0, last = -1, count = 0, accent = '';
    var drag = -1;

    function place() {
      corners = [];
      var cx = g.w / 2;
      var cy = g.h / 2 + (n === 3 ? g.h * 0.06 : 0);
      var r = Math.min(g.w, g.h) * (n === 3 ? 0.5 : 0.44);
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + i * TAU / n + (n === 4 ? Math.PI / 4 : 0);
        corners.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
    }

    function restart() {
      g.ctx.clearRect(0, 0, g.w, g.h);
      x = g.w / 2; y = g.h / 2;
      count = 0;
      last = -1;
    }

    function setup() {
      g = fit(canvas);
      place();
      restart();
    }

    function frame() {
      var c = palette();
      var ctx = g.ctx;
      if (c.accent !== accent) { accent = c.accent; restart(); }
      var rule = RULES[n];
      if (count < MAX_POINTS && drag < 0) {
        ctx.fillStyle = c.accent;
        ctx.globalAlpha = 0.7;
        for (var i = 0; i < PER_FRAME; i++) {
          var k = Math.floor(Math.random() * n);
          if (rule[1] && k === last) continue;
          last = k;
          x += (corners[k].x - x) * rule[0];
          y += (corners[k].y - y) * rule[0];
          if (count++ > 20) ctx.fillRect(x, y, 1, 1);
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = c.bright;
      corners.forEach(function (p, i) {
        ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
        if (i === drag) {
          ctx.strokeStyle = c.bright;
          ctx.strokeRect(p.x - 8, p.y - 8, 16, 16);
        }
      });
      readout.textContent = count.toLocaleString() + ' points  ·  ' + n + ' corners, jump ' +
        Math.round(rule[0] * 100) + '% of the way  ·  ' + rule[2] +
        '\nevery dot is random; the pattern is not';
    }

    canvas.addEventListener('pointerdown', function (e) {
      var p = pointer(e, canvas);
      drag = -1;
      corners.forEach(function (q, i) {
        if (Math.hypot(q.x - p.x, q.y - p.y) < 18) drag = i;
      });
      if (drag >= 0) canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (drag < 0) return;
      var p = pointer(e, canvas);
      corners[drag].x = Math.max(0, Math.min(g.w, p.x));
      corners[drag].y = Math.max(0, Math.min(g.h, p.y));
      restart();
    });
    function drop() { drag = -1; }
    canvas.addEventListener('pointerup', drop);
    canvas.addEventListener('pointercancel', drop);

    action(card, 'corners', function () {
      n = n === 6 ? 3 : n + 1;
      cornersBtn.textContent = n + ' corners';
      place();
      restart();
    });
    action(card, 'restart', function () { place(); restart(); });

    setup();
    resizers.push(setup);
    loop(card, frame);
  };

  /* ---------- double pendulum -------------------------------------------- */

  /* Two unit masses on unit arms, integrated with RK4. A ghost copy starts
   * a thousandth of a radian away and drifts off: chaos, visibly. */
  trinkets.pendulum = function (card) {
    var canvas = card.querySelector('canvas');
    var readout = card.querySelector('[data-readout]');
    var G = 9.81;
    var SUBSTEPS = 6;
    var TRAIL = 260;
    var g, pivot, arm;
    var a = [2.0, 2.6, 0, 0];      // theta1, theta2, omega1, omega2
    var ghost = null;
    var showGhost = true;
    var trail = [];
    var running = !reduceMotion;
    var drag = 0;                  // 0 none, 1 or 2 = bob being dragged

    function deriv(s) {
      var t1 = s[0], t2 = s[1], w1 = s[2], w2 = s[3];
      var d = t1 - t2;
      var den = 3 - Math.cos(2 * d);
      var a1 = (-3 * G * Math.sin(t1) - G * Math.sin(t1 - 2 * t2) -
        2 * Math.sin(d) * (w2 * w2 + w1 * w1 * Math.cos(d))) / den;
      var a2 = (2 * Math.sin(d) * (2 * w1 * w1 + 2 * G * Math.cos(t1) + w2 * w2 * Math.cos(d))) / den;
      return [w1, w2, a1, a2];
    }

    function rk4(s, h) {
      function add(p, q, k) { return p.map(function (v, i) { return v + q[i] * k; }); }
      var k1 = deriv(s);
      var k2 = deriv(add(s, k1, h / 2));
      var k3 = deriv(add(s, k2, h / 2));
      var k4 = deriv(add(s, k3, h));
      return s.map(function (v, i) { return v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]); });
    }

    function bobs(s) {
      var x1 = pivot.x + arm * Math.sin(s[0]);
      var y1 = pivot.y + arm * Math.cos(s[0]);
      return [{ x: x1, y: y1 }, { x: x1 + arm * Math.sin(s[1]), y: y1 + arm * Math.cos(s[1]) }];
    }

    function respawnGhost() { ghost = [a[0] + 0.001, a[1], a[2], a[3]]; }

    function setup() {
      g = fit(canvas);
      pivot = { x: g.w / 2, y: g.h * 0.42 };
      arm = Math.min(g.w, g.h) * 0.24;
      trail = [];
    }

    function drawPendulum(ctx, s, color, alpha) {
      var b = bobs(s);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(b[0].x, b[0].y);
      ctx.lineTo(b[1].x, b[1].y);
      ctx.stroke();
      ctx.fillStyle = color;
      b.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    function wrap(v) { return Math.atan2(Math.sin(v), Math.cos(v)); }

    function frame(dt) {
      var c = palette();
      var ctx = g.ctx;
      if (running && !drag) {
        var h = dt / 1000 / SUBSTEPS;
        for (var i = 0; i < SUBSTEPS; i++) {
          a = rk4(a, h);
          if (ghost) ghost = rk4(ghost, h);
        }
        trail.push(bobs(a)[1]);
        if (trail.length > TRAIL) trail.shift();
      }

      ctx.clearRect(0, 0, g.w, g.h);
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 1.5;
      for (var k = 1; k < trail.length; k++) {
        ctx.globalAlpha = k / trail.length * 0.8;
        ctx.beginPath();
        ctx.moveTo(trail[k - 1].x, trail[k - 1].y);
        ctx.lineTo(trail[k].x, trail[k].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (showGhost && ghost) drawPendulum(ctx, ghost, c.muted, 0.45);
      drawPendulum(ctx, a, c.accent, 1);
      ctx.fillStyle = c.bright;
      ctx.fillRect(pivot.x - 3, pivot.y - 3, 6, 6);

      var gap = ghost ? Math.abs(wrap(ghost[1] - a[1])) : 0;
      readout.textContent = 'θ1 ' + Math.round(wrap(a[0]) * 180 / Math.PI) + '°  θ2 ' +
        Math.round(wrap(a[1]) * 180 / Math.PI) + '°' + (running ? '' : '  ·  paused') +
        (showGhost ? '\nghost started 0.001 rad off, now ' + gap.toFixed(3) + ' rad apart' : '\ndrag either bob to set it up');
    }

    canvas.addEventListener('pointerdown', function (e) {
      var p = pointer(e, canvas);
      var b = bobs(a);
      var d1 = Math.hypot(p.x - b[0].x, p.y - b[0].y);
      var d2 = Math.hypot(p.x - b[1].x, p.y - b[1].y);
      if (Math.min(d1, d2) > 40) return;
      drag = d2 <= d1 ? 2 : 1;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = pointer(e, canvas);
      if (drag === 1) a[0] = Math.atan2(p.x - pivot.x, p.y - pivot.y);
      else {
        var b1 = bobs(a)[0];
        a[1] = Math.atan2(p.x - b1.x, p.y - b1.y);
      }
      a[2] = 0; a[3] = 0;
      trail = [];
      respawnGhost();
    });
    function drop() {
      if (!drag) return;
      drag = 0;
      respawnGhost();
      setRunning(true);
    }
    canvas.addEventListener('pointerup', drop);
    canvas.addEventListener('pointercancel', drop);

    var runBtn = action(card, 'run', function () { setRunning(!running); });
    function setRunning(on) {
      running = on;
      runBtn.textContent = on ? 'pause' : 'run';
    }
    action(card, 'ghost', function (btn) {
      showGhost = !showGhost;
      btn.textContent = showGhost ? 'hide ghost' : 'show ghost';
    });
    action(card, 'kick', function () {
      a = [Math.PI * (0.5 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1),
           Math.PI * (Math.random() * 2 - 1), 0, 0];
      trail = [];
      respawnGhost();
      setRunning(true);
    });

    setup();
    respawnGhost();
    setRunning(running);
    resizers.push(setup);
    loop(card, frame);
  };

  /* ---------- sorting race ------------------------------------------------ */

  /* Each algorithm is a generator that yields every compare and write, so
   * the canvas can replay it a few operations per frame. */
  trinkets.sort = function (card) {
    var canvas = card.querySelector('canvas');
    var readout = card.querySelector('[data-readout]');
    var speed = card.querySelector('[data-speed]');
    var COUNT = 64;
    var g, arr = [], gen = null, hi = [], done = false, cmp = 0, writes = 0;
    var algo = 0;

    function swap(a, i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; }

    var ALGOS = [
      { name: 'quicksort', big: 'O(n log n)', run: function* (a) {
        function* q(lo, hi) {
          if (lo >= hi) return;
          var p = a[hi], i = lo;
          for (var j = lo; j < hi; j++) {
            yield ['cmp', j, hi];
            if (a[j] < p) { swap(a, i, j); yield ['set', i, j]; i++; }
          }
          swap(a, i, hi);
          yield ['set', i, hi];
          yield* q(lo, i - 1);
          yield* q(i + 1, hi);
        }
        yield* q(0, a.length - 1);
      } },
      { name: 'merge sort', big: 'O(n log n)', run: function* (a) {
        function* m(lo, hi) {
          if (hi <= lo) return;
          var mid = (lo + hi) >> 1;
          yield* m(lo, mid);
          yield* m(mid + 1, hi);
          var aux = a.slice(lo, hi + 1);
          var i = 0, j = mid + 1 - lo, k = lo;
          while (i <= mid - lo && j <= hi - lo) {
            yield ['cmp', lo + i, lo + j];
            a[k] = aux[i] <= aux[j] ? aux[i++] : aux[j++];
            yield ['set', k++];
          }
          while (i <= mid - lo) { a[k] = aux[i++]; yield ['set', k++]; }
          while (j <= hi - lo) { a[k] = aux[j++]; yield ['set', k++]; }
        }
        yield* m(0, a.length - 1);
      } },
      { name: 'heapsort', big: 'O(n log n)', run: function* (a) {
        function* sift(i, n) {
          for (;;) {
            var l = 2 * i + 1, r = l + 1, top = i;
            if (l < n) { yield ['cmp', l, top]; if (a[l] > a[top]) top = l; }
            if (r < n) { yield ['cmp', r, top]; if (a[r] > a[top]) top = r; }
            if (top === i) return;
            swap(a, i, top);
            yield ['set', i, top];
            i = top;
          }
        }
        for (var s = (a.length >> 1) - 1; s >= 0; s--) yield* sift(s, a.length);
        for (var e = a.length - 1; e > 0; e--) {
          swap(a, 0, e);
          yield ['set', 0, e];
          yield* sift(0, e);
        }
      } },
      { name: 'insertion sort', big: 'O(n²)', run: function* (a) {
        for (var i = 1; i < a.length; i++) {
          for (var j = i; j > 0; j--) {
            yield ['cmp', j - 1, j];
            if (a[j - 1] <= a[j]) break;
            swap(a, j - 1, j);
            yield ['set', j - 1, j];
          }
        }
      } },
      { name: 'bubble sort', big: 'O(n²)', run: function* (a) {
        for (var i = 0; i < a.length - 1; i++) {
          for (var j = 0; j < a.length - 1 - i; j++) {
            yield ['cmp', j, j + 1];
            if (a[j] > a[j + 1]) { swap(a, j, j + 1); yield ['set', j, j + 1]; }
          }
        }
      } }
    ];

    function shuffle() {
      arr = [];
      for (var i = 1; i <= COUNT; i++) arr.push(i);
      for (var k = arr.length - 1; k > 0; k--) swap(arr, k, Math.floor(Math.random() * (k + 1)));
      gen = null; hi = []; done = false; cmp = 0; writes = 0;
    }

    function start() {
      if (done) shuffle();
      gen = ALGOS[algo].run(arr);
    }

    function setup() { g = fit(canvas); }

    function frame() {
      var c = palette();
      var ctx = g.ctx;
      var ops = Math.round(Math.pow(2, +speed.value));
      if (gen) {
        for (var i = 0; i < ops; i++) {
          var r = gen.next();
          if (r.done) { gen = null; done = true; hi = []; break; }
          hi = r.value.slice(1);
          if (r.value[0] === 'cmp') cmp++; else writes++;
        }
      }
      ctx.clearRect(0, 0, g.w, g.h);
      var bw = g.w / arr.length;
      for (var k = 0; k < arr.length; k++) {
        var bh = arr[k] / COUNT * (g.h - 16);
        ctx.fillStyle = hi.indexOf(k) >= 0 ? c.bright : c.accent;
        ctx.globalAlpha = hi.indexOf(k) >= 0 || done ? 1 : 0.35 + 0.65 * arr[k] / COUNT;
        ctx.fillRect(k * bw + 1, g.h - bh, Math.max(1, bw - 2), bh);
      }
      ctx.globalAlpha = 1;
      var al = ALGOS[algo];
      readout.textContent = al.name + ' ' + al.big + '  ·  ' + cmp + ' compares  ·  ' + writes + ' writes' +
        (done ? '  ·  sorted' : gen ? '' : '  ·  press sort');
    }

    action(card, 'algo', function (btn) {
      algo = (algo + 1) % ALGOS.length;
      btn.textContent = ALGOS[algo].name;
      shuffle();
    });
    action(card, 'shuffle', shuffle);
    action(card, 'go', start);

    shuffle();
    setup();
    if (!reduceMotion) start();
    resizers.push(setup);
    loop(card, frame);
  };

  /* ---------- mandelbrot -------------------------------------------------- */

  /* z -> z² + c, tinted with the live accent.
   *
   * Continuous zoom without stalling: the last finished render is kept as a
   * bitmap and redrawn every frame, stretched to wherever the view is now,
   * while the next render is computed a few rows per frame at reduced
   * resolution. When it finishes it replaces the stretched one.
   *
   * Idle, it dives into seahorse valley (self-similar spirals all the way
   * down) and loops once 64-bit floats run out. Holding the mouse takes over:
   * hold to zoom in on the pointer, right-hold to zoom out, move to steer. */
  trinkets.mandelbrot = function (card) {
    var canvas = card.querySelector('canvas');
    var readout = card.querySelector('[data-readout]');
    var autoBtn = card.querySelector('[data-action="auto"]');
    var HOME = { x: -0.6, y: 0, span: 3.4 };
    var TARGET = { x: -0.743643887037158704752191506114774, y: 0.131825904205311970493132056385139 };
    var MIN_SPAN = 4e-13;          // below this, doubles can't tell pixels apart
    var AUTO_RATE = 0.35;          // e-folds per second while idling
    var HOLD_RATE = 0.9;           // e-folds per second while held
    var pixels = 150000;           // render resolution budget; adapts to render time
    var view = { x: HOME.x, y: HOME.y, span: HOME.span };
    var auto = !reduceMotion;
    var hold = 0;                  // +1 zooming in, -1 zooming out
    var cursor = null;
    var ctx, W, H;
    var done = null;               // { canvas, view } last complete render
    var job = null;                // render in progress
    var accent = '', rgb = [255, 176, 0];

    function hexRgb(hex) {
      var m = hex.replace('#', '');
      if (m.length === 3) m = m.replace(/./g, '$&$&');
      var n = parseInt(m, 16);
      return isNaN(n) ? [255, 176, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function iterations(span) {
      return Math.round(160 + 70 * Math.log2(HOME.span / span + 1));
    }

    function setup() {
      var g = fit(canvas);
      ctx = g.ctx;
      W = g.w;
      H = g.h;
      done = null;
      job = null;
    }

    function startJob() {
      var k = Math.min(1, Math.sqrt(pixels / (W * H)));
      var w = Math.max(1, Math.round(W * k));
      var h = Math.max(1, Math.round(H * k));
      var off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      var octx = off.getContext('2d');
      job = {
        view: { x: view.x, y: view.y, span: view.span },
        w: w, h: h, row: 0,
        canvas: off, ctx: octx,
        img: octx.createImageData(w, h),
        maxIter: iterations(view.span),
        started: performance.now()
      };
    }

    function work(budget) {
      var t0 = performance.now();
      var j = job, v = j.view, data = j.img.data;
      var scale = v.span / j.w;
      var max = j.maxIter;
      while (j.row < j.h && performance.now() - t0 < budget) {
        var ci = v.y + (j.row - j.h / 2) * scale;
        for (var col = 0; col < j.w; col++) {
          var cr = v.x + (col - j.w / 2) * scale;
          var zr = 0, zi = 0, zr2 = 0, zi2 = 0, n = 0;
          // main cardioid and period-2 bulb are inside: skip straight to max
          var q = (cr - 0.25) * (cr - 0.25) + ci * ci;
          if (q * (q + cr - 0.25) <= 0.25 * ci * ci || (cr + 1) * (cr + 1) + ci * ci <= 0.0625) n = max;
          while (n < max && zr2 + zi2 < 256) {
            zi = 2 * zr * zi + ci;
            zr = zr2 - zi2 + cr;
            zr2 = zr * zr;
            zi2 = zi * zi;
            n++;
          }
          var o = (j.row * j.w + col) * 4;
          var s = 0;
          if (n < max) {
            // smooth iteration count -> cyclic bands, so every depth has contrast
            var nu = n + 1 - Math.log(Math.log(zr2 + zi2) / 2 / Math.LN2) / Math.LN2;
            s = (0.3 + 0.7 * (0.5 + 0.5 * Math.cos(nu * 0.21))) * Math.min(1, nu / 18);
          }
          data[o] = rgb[0] * s;
          data[o + 1] = rgb[1] * s;
          data[o + 2] = rgb[2] * s;
          data[o + 3] = 255;
        }
        j.row++;
      }
      if (j.row >= j.h) {
        j.ctx.putImageData(j.img, 0, 0);
        done = { canvas: j.canvas, view: j.view, maxIter: j.maxIter };
        job = null;
        // Deep views get expensive; trade resolution to keep renders under ~0.6s.
        var took = performance.now() - j.started;
        pixels = Math.max(40000, Math.min(150000, pixels * (took > 600 ? 0.75 : took < 200 ? 1.2 : 1)));
      }
    }

    function zoomAbout(px, py, factor) {
      var scale = view.span / W;
      var cx = view.x + (px - W / 2) * scale;
      var cy = view.y + (py - H / 2) * scale;
      view.span = Math.min(HOME.span, Math.max(MIN_SPAN, view.span * factor));
      scale = view.span / W;
      view.x = cx - (px - W / 2) * scale;
      view.y = cy - (py - H / 2) * scale;
    }

    function fmtZoom(z) {
      return z < 1e6 ? Math.round(z).toLocaleString() + 'x' : z.toExponential(1).replace('e+', 'e') + 'x';
    }

    function frame(dt) {
      var c = palette();
      if (c.accent !== accent) {
        accent = c.accent;
        rgb = hexRgb(accent);
        done = null;
        job = null;
      }

      var sec = dt / 1000;
      if (hold && cursor) {
        zoomAbout(cursor.x, cursor.y, Math.exp(-hold * HOLD_RATE * sec));
      } else if (auto) {
        // drift the center onto the target while zooming in
        var pull = Math.min(1, 1.6 * sec);
        view.x += (TARGET.x - view.x) * pull;
        view.y += (TARGET.y - view.y) * pull;
        view.span *= Math.exp(-AUTO_RATE * sec);
        if (view.span <= MIN_SPAN) view = { x: HOME.x, y: HOME.y, span: HOME.span };
      }

      if (!job) startJob();
      work(done ? 9 : 30);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      if (done) {
        var k = done.view.span / view.span;
        var dw = W * k, dh = H * k;
        var dx = W / 2 + (done.view.x - view.x) / view.span * W - dw / 2;
        var dy = H / 2 + (done.view.y - view.y) / view.span * W - dh / 2;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(done.canvas, dx, dy, dw, dh);
      }

      var zoom = HOME.span / view.span;
      var mode = hold > 0 ? 'zooming in' : hold < 0 ? 'zooming out' :
        auto ? 'auto-diving into seahorse valley' : 'paused: hold to zoom, right-hold to zoom out';
      readout.textContent = 'zoom ' + fmtZoom(zoom) + '  ·  ' + iterations(view.span) + ' iterations  ·  ' + mode +
        (view.span <= MIN_SPAN * 1.01 ? '\nthat is as deep as 64-bit floats go' : '\n' + view.x.toFixed(12) +
          (view.y < 0 ? ' - ' : ' + ') + Math.abs(view.y).toFixed(12) + 'i');
    }

    function setAuto(on) {
      auto = on;
      autoBtn.textContent = on ? 'pause' : 'auto zoom';
    }

    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      cursor = pointer(e, canvas);
      hold = e.button === 2 ? -1 : 1;
      setAuto(false);
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) { cursor = pointer(e, canvas); });
    function release() { hold = 0; }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    action(card, 'auto', function () { setAuto(!auto); });
    action(card, 'home', function () {
      setAuto(false);
      view = { x: HOME.x, y: HOME.y, span: HOME.span };
    });

    setup();
    setAuto(auto);
    resizers.push(setup);
    loop(card, frame);
  };

  /* ---------- fullscreen -------------------------------------------------- */

  /* Every card gets an expand button. Uses the Fullscreen API when present;
   * otherwise (iPhone Safari) the card is pinned over the page with CSS. */
  function refit() {
    requestAnimationFrame(function () { resizers.forEach(function (fn) { fn(); }); });
  }

  function setExpanded(card) {
    if (expanded && expanded !== card) {
      expanded.classList.remove('lab-card--full');
      syncButton(expanded);
    }
    expanded = card;
    if (card) card.classList.add('lab-card--full');
    document.documentElement.classList.toggle('lab-locked', !!card);
    Array.prototype.forEach.call(cards, function (c) {
      syncButton(c);
      if (c.labWake) c.labWake();   // the observer settles on its own after
    });
    refit();
  }

  function syncButton(card) {
    var btn = card.querySelector('[data-fullscreen]');
    if (!btn) return;
    var on = card === expanded;
    btn.innerHTML = on ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>';
    btn.setAttribute('aria-label', on ? 'exit fullscreen' : 'fullscreen');
    btn.title = on ? 'exit fullscreen (esc)' : 'fullscreen';
  }

  function exitFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    setExpanded(null);
  }

  Array.prototype.forEach.call(cards, function (card) {
    var bar = card.querySelector('.lab-bar');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lab-full';
    btn.setAttribute('data-fullscreen', '');
    bar.appendChild(btn);
    syncButton(card);
    btn.addEventListener('click', function () {
      if (expanded === card) { exitFull(); return; }
      setExpanded(card);
      if (card.requestFullscreen) card.requestFullscreen().catch(function () {});
    });
  });

  /* Entry point for the footer terminal's `ssh <game>`, and for arriving at
   * /lab#play=<trinket> from another page. Real fullscreen needs a user
   * gesture, so a page-load open falls back to the pinned overlay. */
  function openTrinket(name) {
    var card = document.querySelector('[data-trinket="' + name + '"]');
    if (!card) return false;
    setExpanded(card);
    if (card.requestFullscreen) card.requestFullscreen().catch(function () {});
    return true;
  }
  window.labOpen = openTrinket;

  function openFromHash() {
    var m = /^#play=([\w-]+)$/.exec(window.location.hash);
    if (!m) return;
    history.replaceState(null, '', window.location.pathname);
    openTrinket(m[1]);
  }
  window.addEventListener('hashchange', openFromHash);

  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && expanded) setExpanded(null);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && expanded && !document.fullscreenElement) exitFull();
  });

  /* ---------- boot -------------------------------------------------------- */

  Array.prototype.forEach.call(cards, function (card) {
    var init = trinkets[card.getAttribute('data-trinket')];
    if (init) init(card);
  });
  openFromHash();
})();
