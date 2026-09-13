/* Interactive terminal portrait.
 *
 * Replaces the old static headshot. Renders into any [data-portrait] shell
 * (see templates/partials/portrait.html) and cycles four modes:
 *
 *   0 scope   CRT oscilloscope with phosphor persistence; mouse bends the trace
 *   1 ascii   character-grid bust; pupils track the cursor, blinks, glitches
 *   2 sch     animated schematic "self-portrait"; hover a block for its datasheet
 *   3 id      booting `whoami --verbose` card with a live DC clock
 *
 * Text modes paint two stacked <pre> layers (dim structure / lit features) so
 * we get two-tone phosphor without a span per cell. Everything inherits the
 * active --accent, so the footer green/amber toggle carries through for free.
 *
 * Bails out cheaply when the shell is absent, when off-screen, or when the tab
 * is hidden, and stops animating under prefers-reduced-motion.
 */
(function () {
  var COLS = 52;
  var ROWS = 23;
  var CYCLE_MS = 58000;

  /* Named so reordering the modes stays a one-line change. */
  var M_SCOPE = 0;
  var M_ASCII = 1;
  var M_SCH = 2;
  var M_ID = 3;

  var MODES = [
    { file: 'dev/scope0', status: '> move to sweep timebase + knob, click for next waveform' },
    { file: 'img/portrait.ascii', status: '> hover to look around, click to grin' },
    { file: 'hunter.sch', status: '> hover a block for its datasheet' },
    { file: 'hunter@local — id', status: '> whoami --verbose' }
  ];

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- grid helpers ----------------------------------------------- */

  function makeGrid() {
    var g = new Array(ROWS);
    for (var y = 0; y < ROWS; y++) {
      g[y] = new Array(COLS);
      for (var x = 0; x < COLS; x++) g[y][x] = ' ';
    }
    return g;
  }

  function put(grid, x, y, ch) {
    var xi = Math.round(x);
    var yi = Math.round(y);
    if (xi >= 0 && xi < COLS && yi >= 0 && yi < ROWS) grid[yi][xi] = ch;
  }

  function join(grid) {
    var out = [];
    for (var y = 0; y < ROWS; y++) out.push(grid[y].join(''));
    return out.join('\n');
  }

  function pad(s, n) {
    while (s.length < n) s += ' ';
    return s;
  }

  /* ---------- mode 0: ascii bust ----------------------------------------- */

  var CX = 25.5;
  var CY = 9.4;
  var RY = 6.4;
  /* The ellipses are centered on a cell center (x.5), so features have to be
   * placed off these integer columns/rows — rounding CX directly lands half a
   * cell to the right and drops the nose onto the mouth. */
  var CXI = 25;
  var CYI = 9;

  /* Returns { dim, lit } strings. `ar` is the cell height/width ratio, so the
   * head stays round whatever shape the container ends up being. */
  function renderFace(ar, gaze, blink, smile, glitch) {
    var rx = RY * ar;
    var dim = makeGrid();
    var lit = makeGrid();
    var xi, yi, x, y, dx, dy, d, t, half, sgn, i;

    for (yi = 0; yi < ROWS; yi++) {
      for (xi = 0; xi < COLS; xi++) {
        x = xi + 0.5;
        y = yi + 0.5;

        /* shoulders, with a collar notch */
        if (y > CY + RY + 1.4) {
          t = (y - (CY + RY + 1.4)) / 3.0;
          half = 6.0 + 14.0 * Math.min(1, t);
          if (Math.abs(x - CX) < half) {
            if (Math.abs(x - CX) > half - 1.8) lit[yi][xi] = '=';
            else if (Math.abs(x - CX) >= (y - (CY + RY + 1.0)) * 0.55) dim[yi][xi] = ':';
          }
        }

        /* neck */
        if (y > CY + RY - 1.5 && y <= CY + RY + 1.8 && Math.abs(x - CX) < 3.2) {
          dim[yi][xi] = '=';
          lit[yi][xi] = ' ';
        }

        /* head */
        dx = (x - CX) / rx;
        dy = (y - CY) / RY;
        d = dx * dx + dy * dy;
        if (d <= 1.0) {
          dim[yi][xi] = d > 0.68 ? '=' : '-';
          lit[yi][xi] = ' ';
        }
        /* hair, sweeping a little to one side */
        if (d <= 1.02 && y < CY - RY * 0.58 - 0.35 * dx) {
          dim[yi][xi] = ' ';
          lit[yi][xi] = '#';
        }
      }
    }

    /* brows */
    for (sgn = -1; sgn <= 1; sgn += 2) {
      for (i = -3; i <= 3; i++) {
        put(lit, CXI + sgn * 6 + i, CYI - 2 - (Math.abs(i) >= 3 ? 1 : 0), '#');
      }
    }

    /* eye sockets, then pupils aimed at the cursor */
    for (sgn = -1; sgn <= 1; sgn += 2) {
      var ex = CXI + sgn * 6;
      var ey = CYI;
      for (xi = ex - 3; xi <= ex + 3; xi++) {
        for (yi = ey - 2; yi <= ey + 2; yi++) {
          var ddx = (xi - ex) / 2.6;
          var ddy = (yi - ey) / 1.1;
          if (ddx * ddx + ddy * ddy <= 1.0) {
            put(dim, xi, yi, '.');
            put(lit, xi, yi, ' ');
          }
        }
      }
      if (blink < 0.5) {
        put(lit, ex + Math.round(gaze.x * 1.7), ey + Math.round(gaze.y * 0.8), '@');
      } else {
        for (i = -2; i <= 2; i++) put(lit, ex + i, ey, '=');
      }
    }

    /* nose */
    put(dim, CXI, CYI + 1, '+');
    put(dim, CXI - 1, CYI + 2, '=');
    put(dim, CXI, CYI + 2, ':');
    put(dim, CXI + 1, CYI + 2, '=');

    /* mouth — the corners lift as `smile` goes up */
    var mw = 2 + Math.round(smile);
    for (i = -mw; i <= mw; i++) {
      put(lit, CXI + i, CYI + 4 - (Math.abs(i) >= mw && smile > 0.4 ? 1 : 0), '@');
    }

    /* headphone band: column scan, filling the vertical gap between columns */
    var span = rx + 1.7;
    var prev = null;
    for (xi = Math.round(CX - span); xi <= CX + span; xi++) {
      t = (xi + 0.5 - CX) / span;
      if (Math.abs(t) > 1.0) continue;
      var by = Math.round(CY - (RY + 1.6) * Math.sqrt(Math.max(0, 1 - t * t)));
      if (prev !== null) {
        for (var yy = Math.min(prev, by); yy <= Math.max(prev, by); yy++) put(lit, xi, yy, '%');
      }
      put(lit, xi, by, '%');
      prev = by;
    }
    /* ear cups */
    for (sgn = -1; sgn <= 1; sgn += 2) {
      var cup = CX + sgn * (rx + 1.4);
      for (yi = Math.floor(CY - 2.0); yi <= CY + 2.5; yi++) {
        for (xi = Math.floor(cup - 1); xi <= cup + 1; xi++) put(lit, xi, yi, '%');
      }
    }

    if (glitch > 0) {
      glitchGrid(dim, glitch);
      glitchGrid(lit, glitch);
    }
    return { dim: join(dim), lit: join(lit) };
  }

  /* Tear a few rows sideways and speckle them — a CRT degauss twitch. */
  function glitchGrid(grid, amount) {
    var tears = Math.ceil(amount * 5);
    for (var n = 0; n < tears; n++) {
      var row = grid[(Math.random() * ROWS) | 0];
      var shift = ((Math.random() * 7) | 0) - 3;
      if (shift) {
        var copy = row.slice();
        for (var i = 0; i < COLS; i++) {
          var src = i - shift;
          row[i] = (src >= 0 && src < COLS) ? copy[src] : ' ';
        }
      }
      if (Math.random() < 0.5) row[(Math.random() * COLS) | 0] = '░';
    }
  }

  /* ---------- mode 2: schematic ------------------------------------------ */

  var SCHEMATIC = [
    '',
    '  VCC o---+----------+----------+----------+',
    '          |          |          |          |',
    '       +--+--+    +--+--+    +--+--+    +--+--+',
    '       |UIUC |    | JHU |    | DJ  |    |CHESS|',
    '       | EE  |    | ECE |    |128  |    |2000 |',
    '       +--+--+    +--+--+    +--+--+    +--+--+',
    '          |          |          |          |',
    '  BUS ----+----------+----------+----------+---+',
    '                                               |',
    '       +-------------+       +------------+    |',
    '  IN >-|     CPU     |------>|   BUILD    |->--+',
    '       |   3.6 GHz   |       |   v1.4.2   |',
    '       +------+------+       +-----+------+',
    '              |                    |',
    '            ==+==                +-+-+',
    '            100uF                |ICE|',
    '              |                  +-+-+',
    '             GND                   |',
    '                                  GND',
    '',
    '      hunter.sch    rev K    do not scale'
  ];

  /* [col, row, width, height, datasheet line] */
  var SCH_PARTS = [
    [7, 3, 7, 4, 'U1 UIUC · bs electrical engineering, urbana-champaign'],
    [18, 3, 7, 4, 'U2 JHU · ms electrical & computer engineering'],
    [29, 3, 7, 4, 'OSC1 DJ · free-running, 128 bpm nominal'],
    [40, 3, 7, 4, 'ALU1 CHESS · lichess @h-bombmxpwr, mixed results'],
    [7, 10, 15, 4, 'U4 CPU · 3.6 GHz, no heatsink'],
    [29, 10, 14, 4, 'U3 BUILD · ships projects, experiments, useless junk'],
    [12, 15, 5, 4, 'C1 100uF · decoupling, smooths out the bad days'],
    [33, 15, 5, 4, 'L1 ICE · hockey, softball hot corner, disc golf']
  ];

  /* Polylines the current pulses run along, in grid coordinates. */
  var SCH_TRACKS = [
    [[6, 1], [43, 1]],
    [[6, 8], [47, 8]],
    [[6, 11], [43, 11], [47, 11], [47, 8]],
    [[10, 6], [10, 8]],
    [[21, 6], [21, 8]],
    [[32, 6], [32, 8]],
    [[43, 6], [43, 8]],
    /* these two stop at the part they feed, so no pulse ever lands on the
     * 100uF / ICE / GND labels below them */
    [[14, 13], [14, 15]],
    [[35, 13], [35, 15]]
  ];

  function renderSchematic(t) {
    var dim = makeGrid();
    var lit = makeGrid();
    for (var yi = 0; yi < ROWS; yi++) {
      var line = SCHEMATIC[yi] || '';
      for (var xi = 0; xi < line.length && xi < COLS; xi++) {
        var ch = line.charAt(xi);
        if (ch === ' ') continue;
        /* labels read bright, wiring reads dim */
        if (/[A-Za-z0-9~]/.test(ch)) lit[yi][xi] = ch;
        else dim[yi][xi] = ch;
      }
    }
    SCH_TRACKS.forEach(function (track, ti) {
      for (var p = 0; p < 2; p++) {
        var u = (t * 0.00022 + ti * 0.13 + p / 2) % 1;
        var pt = alongPath(track, u);
        put(lit, pt[0], pt[1], '*');
      }
    });
    return { dim: join(dim), lit: join(lit) };
  }

  function alongPath(points, u) {
    var lengths = [];
    var total = 0;
    var i;
    for (i = 1; i < points.length; i++) {
      var seg = Math.abs(points[i][0] - points[i - 1][0]) +
                Math.abs(points[i][1] - points[i - 1][1]);
      lengths.push(seg);
      total += seg;
    }
    if (!total) return points[0];
    var target = u * total;
    for (i = 0; i < lengths.length; i++) {
      if (target <= lengths[i] || i === lengths.length - 1) {
        var f = lengths[i] ? target / lengths[i] : 0;
        return [
          points[i][0] + (points[i + 1][0] - points[i][0]) * f,
          points[i][1] + (points[i + 1][1] - points[i][1]) * f
        ];
      }
      target -= lengths[i];
    }
    return points[0];
  }

  /* ---------- mode 3: id card -------------------------------------------- */

  var ID_BUST = [
    '   ########   ',
    ' ##--------## ',
    ' #-  @   @  -#',
    ' #-    +    -#',
    ' #--  ===  --#',
    '  ##-------## ',
    '    =======   ',
    '  ::=======:: ',
    ':::::::::::::.'
  ];

  function dcClock() {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date());
    } catch (e) {
      return new Date().toTimeString().slice(0, 8);
    }
  }

  function idFields(started) {
    var visits = document.getElementById('visit-count-text');
    var loc = (window.SITE_LOCATION && window.SITE_LOCATION.city) || 'Washington, D.C.';
    return [
      ['user', 'hunter'],
      ['role', 'ee + cs'],
      ['edu', 'uiuc bs / jhu ms'],
      ['loc', loc.toLowerCase()],
      ['coord', '38.879663, -77.039341'],
      ['local', dcClock()],
      ['theme', document.documentElement.getAttribute('data-theme') || 'amber'],
      ['session', Math.floor((Date.now() - started) / 1000) + 's'],
      ['visits', visits ? visits.textContent.trim() : '—']
    ];
  }

  var ID_RULE = '+--------------------------------------------+';

  function renderIdCard(elapsed, started) {
    var dim = makeGrid();
    var lit = makeGrid();
    var top = 6;
    var script = [
      ['lit', 2, 1, '$ whoami --verbose'],
      ['dim', 2, 2, '[ok] portrait.dev online'],
      ['dim', 2, 4, ID_RULE]
    ];

    ID_BUST.forEach(function (line, i) {
      script.push(['lit', 3, top + i, line]);
    });
    idFields(started).forEach(function (pair, i) {
      script.push(['dim', 21, top + i, pad(pair[0], 8)]);
      script.push(['lit', 29, top + i, pair[1]]);
    });
    script.push(['dim', 2, top + ID_BUST.length + 1, ID_RULE]);

    /* Type it on, a few characters per frame. */
    var budget = reduceMotion ? Infinity : Math.floor(elapsed / 6);
    script.forEach(function (item) {
      var grid = item[0] === 'lit' ? lit : dim;
      var text = item[3];
      var take = Math.max(0, Math.min(text.length, budget));
      budget -= text.length;
      for (var i = 0; i < take; i++) {
        if (text.charAt(i) !== ' ') put(grid, item[1] + i, item[2], text.charAt(i));
      }
    });

    if (budget >= 0) {
      var caret = top + ID_BUST.length + 3;
      put(lit, 2, caret, '$');
      if (Math.floor(elapsed / 500) % 2 === 0) put(lit, 4, caret, '_');
    }
    return { dim: join(dim), lit: join(lit) };
  }

  /* ---------- mode 0: oscilloscope (canvas) ------------------------------ */

  var TWO_PI = Math.PI * 2;
  /* 10 horizontal divisions at 0.50 ms/div — fixes the timebase so the
   * frequency readout is a real consequence of the cursor, not decoration. */
  var TIMESPAN_MS = 5.0;
  var MS_PER_DIV = TIMESPAN_MS / 10;
  var V_PER_DIV = 1.0;
  /* a normalized amplitude of 1.0 spans 2 vertical divisions */
  var V_PER_UNIT = V_PER_DIV * 2;

  /* Signals you would actually put on a bench scope. Each fn(p, v) takes a
   * cycle phase p in [0,1) and the knob value v, and returns volts normalized
   * so 1.0 == 2 divisions. `cycles` caps how many periods the horizontal
   * cursor can sweep onto the screen; `param` is what the vertical cursor
   * controls, so every trace has a second axis worth exploring. */
  var WAVEFORMS = [
    {
      name: 'SINE',
      cycles: 8,
      param: {
        label: 'OFFS', min: -1.4, max: 1.4,
        fmt: function (v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + ' V'; }
      },
      fn: function (p, v) { return Math.sin(TWO_PI * p) + v / V_PER_UNIT; }
    },
    {
      name: 'SQUARE',
      cycles: 6,
      /* summed odd harmonics — the overshoot and ringing that appear as you
       * cut harmonics is Gibbs, which is what a bandwidth-limited square
       * genuinely looks like through a scope front end */
      param: {
        label: 'BW', min: 1, max: 21, snap: 2,
        fmt: function (v) { return v.toFixed(0) + ' harm'; }
      },
      fn: function (p, v) {
        var s = 0;
        for (var k = 1; k <= v; k += 2) s += Math.sin(TWO_PI * k * p) / k;
        return s * (4 / Math.PI) * 0.8;
      }
    },
    {
      name: 'TRIANGLE',
      cycles: 6,
      /* the symmetry knob on a function generator: 50% is a triangle, the
       * ends are rising and falling ramps */
      param: {
        label: 'SYM', min: 0.04, max: 0.96,
        fmt: function (v) { return (v * 100).toFixed(0) + '%'; }
      },
      fn: function (p, v) {
        return p < v ? (2 * p / v - 1) : (1 - 2 * (p - v) / (1 - v));
      }
    },
    {
      name: 'PWM',
      cycles: 6,
      param: {
        label: 'DUTY', min: 0.05, max: 0.95,
        fmt: function (v) { return (v * 100).toFixed(0) + '%'; }
      },
      fn: function (p, v) { return p < v ? 0.85 : -0.85; }
    },
    {
      name: 'RC STEP',
      cycles: 3,
      /* capacitor charging and discharging through a resistor */
      param: {
        label: 'TAU', min: 0.015, max: 0.3,
        fmt: function (v, periodMs) { return (v * periodMs * 1000).toFixed(0) + ' µs'; }
      },
      fn: function (p, v) {
        return p < 0.5 ? 1 - 2 * Math.exp(-p / v)
                       : -1 + 2 * Math.exp(-(p - 0.5) / v);
      }
    },
    {
      name: 'RINGING',
      cycles: 3,
      /* underdamped second-order step response */
      param: {
        label: 'ZETA', min: 0.02, max: 0.7,
        fmt: function (v) { return v.toFixed(2); }
      },
      fn: function (p, v) {
        /* y(t) = 1 - e^-zwt (cos wd t + z/sqrt(1-z^2) sin wd t), then shifted
         * so the trace steps between two levels instead of settling on the
         * centre line — a heavily damped step should still look like a step */
        var wn = TWO_PI * 4;
        var rt = Math.sqrt(1 - v * v);
        var wd = wn * rt;
        var y = 1 - Math.exp(-v * wn * p) *
                (Math.cos(wd * p) + (v / rt) * Math.sin(wd * p));
        return -0.8 + y * 1.3;
      }
    },
    {
      name: 'RECTIFIER',
      cycles: 5,
      /* full-wave rectified mains with a smoothing cap: the knob trades
       * ripple for DC exactly the way a bigger reservoir cap does */
      param: {
        label: 'CAP', min: 0, max: 1,
        fmt: function (v) { return (v * 100).toFixed(0) + '%'; }
      },
      fn: function (p, v) {
        var raw = Math.abs(Math.sin(TWO_PI * p));
        var out = raw;
        if (v > 0.001) {
          /* Time since the last rectified peak, wrapped peak-to-peak so the
           * cap keeps discharging across the half-cycle boundary instead of
           * snapping back to full. The +0.08 floor keeps a little ripple at
           * max: no real reservoir cap gives a perfectly flat rail. */
          var d = ((p * 2) % 1) - 0.25;
          if (d < 0) d += 1;
          out = Math.max(raw, Math.exp(-d * ((1 - v) * 14 + 0.08)));
        }
        return out * 1.6 - 0.8;
      }
    },
    {
      name: 'AM',
      cycles: 2,
      param: {
        label: 'DEPTH', min: 0, max: 0.95,
        fmt: function (v) { return (v * 100).toFixed(0) + '%'; }
      },
      fn: function (p, v) {
        return Math.sin(TWO_PI * p * 10) * (1 + v * Math.sin(TWO_PI * p)) / (1 + v);
      }
    }
  ];

  function Scope(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.wave = 0;
    this.aim = { x: 0.5, y: 0.5 };
    this.sweep = 0;
    this.buf = [];
    this.meas = '';
    this.w = 0;
    this.h = 0;
  }

  Scope.prototype.resize = function (w, h) {
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    this.w = w;
    this.h = h;
  };

  /* The measurement line shown under the stage, recomputed each draw. */
  Scope.prototype.readout = function () {
    return this.meas || MODES[M_SCOPE].status;
  };

  function formatHz(f) {
    return f >= 1000 ? (f / 1000).toFixed(2) + ' kHz' : f.toFixed(0) + ' Hz';
  }

  Scope.prototype.draw = function (dt, colors) {
    var ctx = this.ctx;
    var w = this.w;
    var h = this.h;
    if (!w || !h) return;

    /* phosphor decay: veil the whole screen a touch each frame */
    ctx.fillStyle = colors.fade;
    ctx.fillRect(0, 0, w, h);

    var pad = Math.round(h * 0.07);
    var gx = pad;
    var gy = pad;
    var gw = w - pad * 2;
    var gh = h - pad * 2 - Math.round(h * 0.1);
    var i, lx, ly;

    /* graticule: the standard 10 x 8 divisions */
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = 0; i <= 10; i++) {
      lx = Math.round(gx + (gw * i) / 10) + 0.5;
      ctx.moveTo(lx, gy);
      ctx.lineTo(lx, gy + gh);
    }
    for (i = 0; i <= 8; i++) {
      ly = Math.round(gy + (gh * i) / 8) + 0.5;
      ctx.moveTo(gx, ly);
      ctx.lineTo(gx + gw, ly);
    }
    ctx.stroke();

    var oy = gy + gh / 2;
    var ox = gx + gw / 2;

    /* centre axes carry the fine ticks on a real tube */
    ctx.strokeStyle = colors.axis;
    ctx.beginPath();
    ctx.moveTo(gx, Math.round(oy) + 0.5);
    ctx.lineTo(gx + gw, Math.round(oy) + 0.5);
    ctx.moveTo(Math.round(ox) + 0.5, gy);
    ctx.lineTo(Math.round(ox) + 0.5, gy + gh);
    var tick = Math.max(2, h * 0.014);
    if (gw / 50 >= 6) {
      for (i = 1; i < 50; i++) {
        lx = Math.round(gx + (gw * i) / 50) + 0.5;
        ctx.moveTo(lx, oy - tick);
        ctx.lineTo(lx, oy + tick);
      }
      for (i = 1; i < 40; i++) {
        ly = Math.round(gy + (gh * i) / 40) + 0.5;
        ctx.moveTo(ox - tick, ly);
        ctx.lineTo(ox + tick, ly);
      }
    }
    ctx.stroke();

    /* ---- the signal ---- */
    var wave = WAVEFORMS[this.wave];
    var p = wave.param;
    var cycles = 0.6 + this.aim.x * (wave.cycles - 0.6);
    var knob = p.min + (1 - this.aim.y) * (p.max - p.min);
    if (p.snap) knob = p.min + Math.round((knob - p.min) / p.snap) * p.snap;
    knob = Math.max(p.min, Math.min(p.max, knob));

    var freq = cycles / (TIMESPAN_MS / 1000);
    var periodMs = TIMESPAN_MS / cycles;

    var steps = Math.max(240, Math.round(gw));
    var ay = gh / 4;
    var buf = this.buf;
    var lo = 1e9;
    var hi = -1e9;
    for (i = 0; i <= steps; i++) {
      var val = wave.fn(((i / steps) * cycles) % 1, knob);
      if (val < lo) lo = val;
      if (val > hi) hi = val;
      /* a scope clips at the graticule edge rather than drawing off-screen */
      buf[i] = Math.max(gy, Math.min(gy + gh, oy - val * ay));
    }

    ctx.strokeStyle = colors.trace;
    ctx.lineWidth = Math.max(1, h * 0.007);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (i = 0; i <= steps; i++) {
      var px = gx + (gw * i) / steps;
      if (i === 0) ctx.moveTo(px, buf[i]);
      else ctx.lineTo(px, buf[i]);
    }
    ctx.stroke();

    /* the beam head, sweeping the trace left to right */
    this.sweep = (this.sweep + dt / 1400) % 1;
    var head = Math.round(this.sweep * steps);
    var tail = Math.max(0, head - Math.round(steps * 0.07));
    ctx.strokeStyle = colors.beam;
    ctx.lineWidth = Math.max(1.2, h * 0.009);
    ctx.beginPath();
    for (i = tail; i <= head; i++) {
      var bx = gx + (gw * i) / steps;
      if (i === tail) ctx.moveTo(bx, buf[i]);
      else ctx.lineTo(bx, buf[i]);
    }
    ctx.stroke();
    ctx.fillStyle = colors.beam;
    ctx.beginPath();
    ctx.arc(gx + (gw * head) / steps, buf[head], Math.max(1.5, h * 0.011), 0, TWO_PI);
    ctx.fill();

    /* trigger level marker on the right rail */
    var ts = Math.max(3, h * 0.018);
    ctx.beginPath();
    ctx.moveTo(gx + gw, oy);
    ctx.lineTo(gx + gw + ts, oy - ts * 0.7);
    ctx.lineTo(gx + gw + ts, oy + ts * 0.7);
    ctx.closePath();
    ctx.fill();

    this.meas = '> ' + wave.name + '  ·  f ' + formatHz(freq) +
                '  ·  Vpp ' + ((hi - lo) * V_PER_UNIT).toFixed(2) + ' V' +
                '  ·  ' + p.label + ' ' + p.fmt(knob, periodMs);

    /* Readout strip: source left, settings centered, trigger right. Measure
     * the three pieces and shrink to fit rather than guessing offsets — at
     * narrow widths the settings text used to run straight through TRIG. */
    var left = 'CH1  ' + wave.name;
    var mid = V_PER_DIV.toFixed(2) + 'V/div   ' + MS_PER_DIV.toFixed(2) + 'ms/div';
    var right = 'TRIG ▲';
    var font = function (px) { return px + "px 'IBM Plex Mono', 'Consolas', monospace"; };

    var fs = Math.max(7, Math.round(h * 0.052));
    ctx.font = font(fs);
    var gap = fs * 1.2;
    var need = ctx.measureText(left).width + ctx.measureText(mid).width +
               ctx.measureText(right).width + gap * 2;
    if (need > gw) {
      fs = Math.max(5, Math.floor(fs * (gw / need)));
      ctx.font = font(fs);
      gap = fs * 1.2;
    }

    var leftW = ctx.measureText(left).width;
    var midW = ctx.measureText(mid).width;
    var rightW = ctx.measureText(right).width;
    /* centered, but never allowed to cross either neighbour */
    var midX = Math.min(
      Math.max(gx + (gw - midW) / 2, gx + leftW + gap),
      gx + gw - rightW - gap - midW
    );

    ctx.textBaseline = 'alphabetic';
    var baseline = h - pad * 0.3;
    ctx.fillStyle = colors.beam;
    ctx.fillText(left, gx, baseline);
    ctx.fillStyle = colors.grid;
    ctx.fillText(mid, midX, baseline);
    ctx.fillStyle = colors.beam;
    ctx.fillText(right, gx + gw - rightW, baseline);
  };

  /* ---------- widget ------------------------------------------------------ */

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function Portrait(root) {
    this.root = root;
    this.stage = root.querySelector('[data-portrait-stage]');
    this.dim = root.querySelector('[data-portrait-dim]');
    this.lit = root.querySelector('[data-portrait-lit]');
    this.canvas = root.querySelector('[data-portrait-canvas]');
    this.hotspots = root.querySelector('[data-portrait-hotspots]');
    this.fileLabel = root.querySelector('[data-portrait-file]');
    this.statusEl = root.querySelector('[data-portrait-status]');
    this.progress = root.querySelector('[data-portrait-progress]');
    this.tabs = Array.prototype.slice.call(root.querySelectorAll('[data-portrait-tab]'));

    this.mode = 0;
    this.modeStart = now();
    this.started = Date.now();
    this.lastFrame = now();
    this.lastPaint = 0;
    this.visible = true;
    this.onScreen = true;
    this.hover = false;
    this.pinned = false;
    this.gaze = { x: 0, y: 0 };
    this.target = { x: 0, y: 0 };
    this.blink = 0;
    this.nextBlink = now() + 2600;
    this.smile = 0;
    this.grin = false;
    this.glitch = 0;
    this.ar = 1.7;
    this.colors = null;
    this.scope = new Scope(this.canvas);

    this.bind();
    this.measure();
    this.setMode(0, false);
  }

  Portrait.prototype.bind = function () {
    var self = this;

    this.tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        self.pinned = true;
        self.setMode(parseInt(tab.getAttribute('data-portrait-tab'), 10), true);
      });
    });

    this.root.addEventListener('pointerenter', function () { self.hover = true; });
    this.root.addEventListener('pointerleave', function () {
      self.hover = false;
      self.target.x = 0;
      self.target.y = 0;
      self.setStatus(MODES[self.mode].status);
    });

    this.stage.addEventListener('pointermove', function (e) {
      var r = self.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var nx = (e.clientX - r.left) / r.width;
      var ny = (e.clientY - r.top) / r.height;
      self.target.x = Math.max(-1, Math.min(1, (nx - 0.5) * 2.2));
      self.target.y = Math.max(-1, Math.min(1, (ny - 0.42) * 2.2));
      self.scope.aim.x = nx;
      self.scope.aim.y = ny;
    });

    this.stage.addEventListener('pointerdown', function () {
      if (self.mode === M_SCOPE) {
        self.scope.wave = (self.scope.wave + 1) % WAVEFORMS.length;
        scopeWave = self.scope.wave;
        self.canvas.setAttribute('aria-label', ariaFor(M_SCOPE));
        self.setStatus(self.scope.readout());
      } else if (self.mode === M_ASCII) {
        self.grin = !self.grin;
        self.glitch = 1;
      }
    });

    /* Drop the cached colors when the phosphor toggle flips. */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        self.colors = null;
        if (self.mode === M_SCOPE) self.scope.resize(self.stage.clientWidth, self.stage.clientHeight);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    window.addEventListener('resize', function () { self.measure(); });

    document.addEventListener('visibilitychange', function () {
      self.visible = !document.hidden;
      self.lastFrame = now();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          self.onScreen = entry.isIntersecting;
          self.lastFrame = now();
        });
      }, { threshold: 0.05 }).observe(this.root);
    }
  };

  /* Size both <pre> layers so the 52x23 grid fills the stage exactly, and
   * record the resulting cell aspect so the face can stay round. */
  Portrait.prototype.measure = function () {
    var w = this.stage.clientWidth;
    var h = this.stage.clientHeight;
    if (!w || !h) return;

    var cellW = w / COLS;
    var cellH = h / ROWS;
    this.ar = cellH / cellW;

    var size = cellW / advanceRatio();
    [this.dim, this.lit].forEach(function (el) {
      el.style.fontSize = size.toFixed(3) + 'px';
      el.style.lineHeight = cellH.toFixed(3) + 'px';
    });

    this.scope.resize(w, h);
    this.layoutHotspots();
  };

  /* How wide one character is, in ems, for whichever mono font actually loaded. */
  var cachedAdvance = null;
  function advanceRatio() {
    if (cachedAdvance) return cachedAdvance;
    try {
      var c = document.createElement('canvas').getContext('2d');
      c.font = "100px 'IBM Plex Mono', 'Consolas', monospace";
      var sample = '0000000000';
      var w = c.measureText(sample).width / sample.length / 100;
      cachedAdvance = (w > 0.3 && w < 1) ? w : 0.6;
    } catch (e) {
      cachedAdvance = 0.6;
    }
    return cachedAdvance;
  }

  Portrait.prototype.buildHotspots = function () {
    if (this.hotspots.childNodes.length) return;
    var self = this;
    SCH_PARTS.forEach(function (part) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'portrait-hotspot';
      btn.setAttribute('aria-label', part[4]);
      function show() { self.setStatus('> ' + part[4]); }
      function clear() { self.setStatus(MODES[self.mode].status); }
      btn.addEventListener('pointerenter', show);
      btn.addEventListener('focus', show);
      btn.addEventListener('pointerleave', clear);
      btn.addEventListener('blur', clear);
      self.hotspots.appendChild(btn);
    });
    this.layoutHotspots();
  };

  Portrait.prototype.layoutHotspots = function () {
    var kids = this.hotspots ? this.hotspots.children : null;
    if (!kids || !kids.length) return;
    for (var i = 0; i < kids.length; i++) {
      var part = SCH_PARTS[i];
      kids[i].style.left = (part[0] / COLS * 100) + '%';
      kids[i].style.top = (part[1] / ROWS * 100) + '%';
      kids[i].style.width = (part[2] / COLS * 100) + '%';
      kids[i].style.height = (part[3] / ROWS * 100) + '%';
    }
  };

  Portrait.prototype.setStatus = function (text) {
    if (this.statusEl && this.statusEl.textContent !== text) {
      this.statusEl.textContent = text;
    }
  };

  /* mirrors the active scope waveform so ariaFor can name it */
  var scopeWave = 0;

  function ariaFor(mode) {
    if (mode === M_SCOPE) return 'Oscilloscope trace of a ' + WAVEFORMS[scopeWave].name + ' waveform';
    if (mode === M_ASCII) return 'ASCII art portrait of Hunter wearing headphones';
    if (mode === M_SCH) return 'Schematic self-portrait wiring together education, DJing, chess and sports';
    return 'Terminal ID card for Hunter Baisden';
  }

  Portrait.prototype.setMode = function (index, manual) {
    this.mode = ((index % MODES.length) + MODES.length) % MODES.length;
    this.modeStart = now();

    var self = this;
    this.fileLabel.textContent = MODES[this.mode].file;
    this.setStatus(MODES[this.mode].status);
    this.tabs.forEach(function (tab, i) {
      tab.setAttribute('aria-selected', i === self.mode ? 'true' : 'false');
    });

    var isScope = this.mode === M_SCOPE;
    this.canvas.hidden = !isScope;
    this.dim.hidden = isScope;
    this.lit.hidden = isScope;
    this.hotspots.hidden = this.mode !== M_SCH;

    if (this.mode === M_SCH) this.buildHotspots();
    if (isScope) this.scope.resize(this.stage.clientWidth, this.stage.clientHeight);
    if (this.mode === M_ASCII && !reduceMotion) this.glitch = manual ? 1 : 0.6;

    var label = ariaFor(this.mode);
    this.lit.setAttribute('aria-label', label);
    this.canvas.setAttribute('aria-label', label);
  };

  /* Pull the live phosphor colors out of CSS so both themes just work. */
  Portrait.prototype.themeColors = function () {
    if (this.colors) return this.colors;
    var cs = getComputedStyle(document.documentElement);
    var accent = (cs.getPropertyValue('--accent') || '#9eff8a').trim();
    var bright = (cs.getPropertyValue('--accent-bright') || accent).trim();
    var surface = (cs.getPropertyValue('--surface-3') || '#11151a').trim();
    this.colors = {
      fade: withAlpha(surface, 0.17),
      grid: withAlpha(accent, 0.22),
      axis: withAlpha(accent, 0.4),
      trace: withAlpha(accent, 0.8),
      beam: bright
    };
    return this.colors;
  };

  function withAlpha(hex, alpha) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  Portrait.prototype.frame = function (t) {
    var dt = Math.min(120, t - this.lastFrame);
    this.lastFrame = t;
    if (!this.visible || !this.onScreen) return;

    var elapsed = t - this.modeStart;

    /* auto-cycle, unless the visitor is interacting or has pinned a mode */
    if (!reduceMotion && !this.hover && !this.pinned && elapsed > CYCLE_MS) {
      this.setMode(this.mode + 1, false);
      elapsed = 0;
    }
    if (this.progress) {
      var pct = (this.pinned || this.hover || reduceMotion) ? 0 : Math.min(1, elapsed / CYCLE_MS);
      this.progress.style.transform = 'scaleX(' + pct.toFixed(3) + ')';
    }

    if (this.mode === M_SCOPE) {
      this.scope.draw(dt, this.themeColors());
      this.setStatus(this.hover ? this.scope.readout() : MODES[M_SCOPE].status);
      return;
    }

    /* text modes repaint at ~25fps; 60 buys nothing at this grid size */
    if (t - this.lastPaint < 40) return;
    this.lastPaint = t;

    var out;
    if (this.mode === M_ASCII) {
      this.gaze.x += (this.target.x - this.gaze.x) * 0.18;
      this.gaze.y += (this.target.y - this.gaze.y) * 0.18;
      if (t > this.nextBlink) {
        this.blink = 1;
        if (t > this.nextBlink + 140) {
          this.blink = 0;
          this.nextBlink = t + 2200 + Math.random() * 3600;
        }
      }
      var wantSmile = (this.grin || this.hover) ? 1 : 0;
      this.smile += (wantSmile - this.smile) * 0.15;
      this.glitch = Math.max(0, this.glitch - dt / 320);
      out = renderFace(this.ar, this.gaze, this.blink, this.smile,
                       reduceMotion ? 0 : this.glitch);
    } else if (this.mode === M_SCH) {
      out = renderSchematic(reduceMotion ? 3000 : t);
    } else {
      out = renderIdCard(elapsed, this.started);
    }

    this.dim.textContent = out.dim;
    this.lit.textContent = out.lit;
  };

  function init() {
    var roots = document.querySelectorAll('[data-portrait]');
    if (!roots.length) return;
    var widgets = Array.prototype.map.call(roots, function (r) { return new Portrait(r); });

    /* The webfont changes the advance width; re-measure once it lands. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        cachedAdvance = null;
        widgets.forEach(function (w) { w.measure(); });
      });
    }

    function loop(t) {
      for (var i = 0; i < widgets.length; i++) widgets[i].frame(t);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
