/* Pseudo-terminal that lives in the footer on every page.
 *
 * Filesystem is a real tree:
 *
 *   /
 *   ├── about              -> /about
 *   ├── personal           -> /projects/personal
 *   │   ├── album-poster   -> /projects/album-poster
 *   │   └── ...            (one node per personal project)
 *   ├── academic           -> /projects/academic
 *   │   ├── fpv-drone      -> /projects/fpv-drone
 *   │   └── ...
 *   ├── visitors           -> /visitors
 *   ├── lyrics             -> /lyrics
 *   ├── README.md          (file)
 *   └── lyrics.txt         (file, fetched live)
 *
 * `cd` updates a node reference; `ls` reads that node's children.
 * Project lists come from window.TERMINAL_PROJECTS, rendered server-side.
 *
 * The doom embed lives in terminal-doom.js.
 */
(function () {
  var root   = document.getElementById('terminal');
  if (!root) return;

  var output = document.getElementById('terminal-output');
  var input  = document.getElementById('terminal-input');
  var form   = document.getElementById('terminal-form');
  var cwdEl  = document.getElementById('terminal-cwd');
  var clearBtn = document.getElementById('terminal-clear');

  /* ---- build virtual filesystem ----------------------------------- */
  function makeDir(parent, name, opts) {
    opts = opts || {};
    var display;
    if (!parent) {
      display = '~';
    } else if (parent.display === '~') {
      display = '~/' + name;
    } else {
      display = parent.display + '/' + name;
    }
    var node = {
      kind: 'dir',
      name: name,
      display: display,
      routePath: opts.routePath || null,
      desc: opts.desc || '',
      links: opts.links || null,
      parent: parent,
      children: {}
    };
    if (parent) parent.children[name] = node;
    return node;
  }

  function makeFile(parent, name, opts) {
    opts = opts || {};
    var node = {
      kind: 'file',
      name: name,
      desc: opts.desc || '',
      content: opts.content || null,
      dynamic: opts.dynamic || null,   // function -> Promise<lines[]>
      parent: parent
    };
    if (parent) parent.children[name] = node;
    return node;
  }

  function buildFS() {
    var fsRoot = makeDir(null, '');
    var about    = makeDir(fsRoot, 'about',    { routePath: '/about',             desc: 'about me + links' });
    var personal = makeDir(fsRoot, 'personal', { routePath: '/projects/personal', desc: 'personal projects' });
    var academic = makeDir(fsRoot, 'academic', { routePath: '/projects/academic', desc: 'academic projects' });
    makeDir(fsRoot, 'visitors', { routePath: '/visitors', desc: 'visitor map' });
    makeDir(fsRoot, 'lyrics',   { routePath: '/lyrics',   desc: 'favorite lyrics' });

    makeFile(fsRoot, 'README.md',  { desc: 'site readme', content: README_TEXT });
    makeFile(fsRoot, 'lyrics.txt', { desc: 'random lyric (live)', dynamic: fetchLyric });
    makeFile(about,  'bio.txt',    { desc: 'extended bio', content: BIO_TEXT });

    var data = window.TERMINAL_PROJECTS || { personal: [], academic: [] };
    (data.personal || []).forEach(function (p) {
      if (!p || !p.id) return;
      makeDir(personal, p.id, {
        routePath: '/projects/' + p.id,
        desc: p.title || '',
        links: p.links || {}
      });
    });
    (data.academic || []).forEach(function (p) {
      if (!p || !p.id) return;
      makeDir(academic, p.id, {
        routePath: '/projects/' + p.id,
        desc: p.title || '',
        links: p.links || {}
      });
    });

    return fsRoot;
  }

  var README_TEXT = [
    '# hunter.baisden',
    '',
    'electrical engineer & computer scientist · baltimore, MD',
    '',
    'site for personal projects, academic work, lyrics, and the occasional',
    'useless thing. `ls` to see what is around, `cd <name>` to move in,',
    '`open` to actually navigate there.',
    '',
    'navigation:',
    '  · `open` follows the cwd inside this site — e.g. `cd personal`',
    '    then `open` jumps to /personal. `open <name>` is the shortcut.',
    '  · `ssh` is the *external* version: only works inside a project',
    '    directory, and opens that project\'s offsite links (live demo,',
    '    github, video, download). e.g. `cd personal/<id>` then `ssh` or',
    '    `ssh github` / `ssh live` / `ssh video` / `ssh download`.',
    '  · `home` snaps back to /, `random` rolls the dice.',
    '',
    'tips:',
    '  · tab completes commands and the items in the current directory',
    '  · `cd personal` then `ls` to see every personal project',
    '  · `doom` launches a playable doom clone inside the terminal'
  ].join('\n');

  var BIO_TEXT = [
    'Hunter Baisden — electrical engineer & computer scientist.',
    '',
    'Education: BS EE at UIUC, MS ECE at Johns Hopkins.',
    'Living in Baltimore, MD. Originally from Chicago.',
    'Off-hours: DJ, chess, hockey, softball, disc golf, movies, restaurants.'
  ].join('\n');

  function fetchLyric() {
    return fetch('/api/lyrics/random')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.lyrics) return ['(no lyric available)'];
        var lines = String(d.lyrics).split('\n').map(function (l) {
          return '│ ' + l;
        });
        lines.push('— ' + (d.song || '') + ' · ' + (d.artist || ''));
        return lines;
      })
      .catch(function () { return ['(lyric fetch failed)']; });
  }

  var fs  = buildFS();
  var cwd = fs;

  /* ---- shell state ------------------------------------------------- */
  var hist     = [];
  var histIdx  = 0;
  var mode     = 'shell';
  var bootTime = Date.now();

  /* ---- output primitives ------------------------------------------ */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function print(text, cls) {
    var line = document.createElement('div');
    line.className = 'term-line' + (cls ? ' ' + cls : '');
    line.textContent = text == null ? '' : text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
    return line;
  }

  function printHtml(html, cls) {
    var line = document.createElement('div');
    line.className = 'term-line' + (cls ? ' ' + cls : '');
    line.innerHTML = html;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
    return line;
  }

  function pad(s, w) {
    s = String(s);
    if (s.length >= w) return s + '  ';
    return s + ' '.repeat(w - s.length);
  }

  function promptHtml(value) {
    return '<span class="term-user">hunter@local</span>:' +
           '<span class="term-cwd">' + escapeHtml(cwd.display) + '</span>$ ' +
           escapeHtml(value || '');
  }

  function echo(value) { printHtml(promptHtml(value), 'cmd'); }

  function setCwd(node) {
    cwd = node;
    if (cwdEl) cwdEl.textContent = cwd.display;
  }

  /* Find the deepest fs node whose routePath matches a URL pathname.
     Used at boot so the terminal opens in the directory for the page
     you're on (home page -> root, /projects/personal -> personal/, a
     project detail page -> that project's dir, etc). */
  function nodeForPath(pathname) {
    var path = (pathname || '/').replace(/\/+$/, '') || '/';
    if (path === '/') return fs;
    var found = null;
    (function walk(node) {
      Object.keys(node.children).forEach(function (k) {
        var c = node.children[k];
        if (c.kind !== 'dir') return;
        if (c.routePath === path) found = c;
        walk(c);
      });
    })(fs);
    return found;
  }

  /* ---- path resolution -------------------------------------------- */
  function resolve(arg) {
    if (!arg) return cwd;
    if (arg === '~' || arg === '/' || arg === 'home') return fs;

    var node, parts;
    if (arg.charAt(0) === '/') {
      node = fs;
      parts = arg.split('/').filter(Boolean);
    } else {
      node = cwd;
      parts = arg.split('/').filter(Boolean);
    }
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === '..') {
        node = node.parent || fs;
      } else if (part === '.') {
        // stay
      } else if (node.kind === 'dir' && node.children[part]) {
        node = node.children[part];
      } else {
        return null;
      }
    }
    return node;
  }

  /* ---- commands ---------------------------------------------------- */
  var COMMANDS = {};

  COMMANDS.help = function () {
    print('available commands:', 'dim');
    var rows = [
      ['help',                'show this list'],
      ['ls [path]',           'list current directory (or named one)'],
      ['cd <path>',           'change directory (cd .., cd /, cd personal, cd /personal/<id>)'],
      ['pwd',                 'print working directory'],
      ['cat <file>',          'print a file (README.md, bio.txt, lyrics.txt)'],
      ['open [path]',         'navigate to the current cwd or named route'],
      ['go',                  'alias for `open` (no args = current cwd)'],
      ['home',                'navigate to the home page'],
      ['random',              'jump to a random page'],
      ['lyric',               'print a random song lyric'],
      ['ssh [live|github|video|download]', 'open a project link (only inside a project dir)'],
      ['doom',                'launch DOOM (jsdoom embed) in the terminal'],
      ['theme <green|amber>', 'switch phosphor color'],
      ['whoami',              'short bio'],
      ['echo <text>',         'echo back'],
      ['date',                'current date / time'],
      ['uptime',              'session uptime'],
      ['history',             'command history'],
      ['clear',               'clear the terminal']
    ];
    rows.forEach(function (r) {
      printHtml(
        '  <span class="term-dir">' + escapeHtml(r[0]) + '</span>' +
        ' '.repeat(Math.max(2, 22 - r[0].length)) +
        '<span class="dim">' + escapeHtml(r[1]) + '</span>'
      );
    });
    print('');
    print('tab = complete · ↑/↓ = history · ctrl+l = clear', 'dim');
  };

  COMMANDS.ls = function (args) {
    var node = cwd;
    if (args[0]) {
      var target = resolve(args[0]);
      if (!target) { print('ls: ' + args[0] + ': no such file or directory', 'err'); return; }
      if (target.kind === 'file') {
        print(target.name);
        return;
      }
      node = target;
    }
    var keys = Object.keys(node.children);
    if (!keys.length) { print('(empty)', 'dim'); return; }

    // sort: dirs first, then files; alpha within each
    keys.sort(function (a, b) {
      var na = node.children[a], nb = node.children[b];
      if (na.kind !== nb.kind) return na.kind === 'dir' ? -1 : 1;
      return a < b ? -1 : 1;
    });

    // width for the name column
    var maxName = 0;
    keys.forEach(function (k) {
      var n = node.children[k];
      var w = (n.kind === 'dir' ? k.length + 1 : k.length);
      if (w > maxName) maxName = w;
    });
    var col = Math.min(28, maxName + 2);

    keys.forEach(function (k) {
      var n = node.children[k];
      var label = n.kind === 'dir' ? k + '/' : k;
      var cls   = n.kind === 'dir' ? 'term-dir' : 'term-file';
      printHtml(
        '<span class="' + cls + '">' + escapeHtml(label) + '</span>' +
        ' '.repeat(Math.max(2, col - label.length)) +
        '<span class="dim">' + escapeHtml(n.desc || '') + '</span>'
      );
    });
  };

  COMMANDS.cd = function (args) {
    var arg = args[0];
    if (!arg || arg === '~' || arg === 'home') { setCwd(fs); return; }
    var target = resolve(arg);
    if (!target) { print('cd: no such directory: ' + arg, 'err'); return; }
    if (target.kind !== 'dir') { print('cd: not a directory: ' + arg, 'err'); return; }
    setCwd(target);
  };

  COMMANDS.pwd = function () {
    print(cwd === fs ? '/' : (cwd.routePath || cwd.display));
  };

  COMMANDS.cat = function (args) {
    var f = args[0];
    if (!f) { print('cat: usage: cat <file>', 'err'); return; }

    // resolve relative to cwd first, then fall back to root for top-level files
    var node = resolve(f);
    if (!node || node.kind !== 'file') {
      if (cwd !== fs && fs.children[f] && fs.children[f].kind === 'file') {
        node = fs.children[f];
      }
    }
    if (!node || node.kind !== 'file') {
      print('cat: ' + f + ': no such file', 'err');
      return;
    }

    if (typeof node.dynamic === 'function') {
      print('reading ' + node.name + ' ...', 'dim');
      node.dynamic().then(function (lines) {
        (lines || []).forEach(function (l) { print(l); });
      });
      return;
    }
    String(node.content || '').split('\n').forEach(function (l) { print(l); });
  };

  COMMANDS.open = function (args) {
    var target = args.length ? resolve(args[0]) : cwd;
    if (!target) { print('open: unknown route: ' + args[0], 'err'); return; }
    if (target.kind !== 'dir') { print('open: not a navigable route', 'err'); return; }
    if (!target.routePath) {
      // root has no routePath; treat as /
      var path = target === fs ? '/' : null;
      if (!path) { print('open: that directory has no route', 'err'); return; }
      print('opening ' + path + ' ...', 'dim');
      setTimeout(function () { window.location.href = path; }, 220);
      return;
    }
    print('opening ' + target.routePath + ' ...', 'dim');
    setTimeout(function () { window.location.href = target.routePath; }, 220);
  };

  COMMANDS.go = function (args) { COMMANDS.open(args); };

  COMMANDS.home = function () {
    if (window.location.pathname === '/') {
      print('already home', 'dim');
      return;
    }
    print('opening / ...', 'dim');
    setTimeout(function () { window.location.href = '/'; }, 220);
  };

  COMMANDS.random = function () {
    // pool = every node in the tree that has a routePath, plus the home page
    var pool = [{ name: 'home', routePath: '/' }];
    (function walk(node) {
      Object.keys(node.children).forEach(function (k) {
        var c = node.children[k];
        if (c.kind === 'dir' && c.routePath) pool.push(c);
        if (c.kind === 'dir') walk(c);
      });
    })(fs);
    var here = window.location.pathname;
    pool = pool.filter(function (n) { return n.routePath !== here; });
    if (!pool.length) { print('nowhere new to go', 'dim'); return; }
    var pick = pool[Math.floor(Math.random() * pool.length)];
    print('roll → ' + (pick.name || pick.routePath) + ' (' + pick.routePath + ')', 'dim');
    setTimeout(function () { window.location.href = pick.routePath; }, 280);
  };

  COMMANDS.lyric = function () {
    print('fetching lyric ...', 'dim');
    fetchLyric().then(function (lines) {
      (lines || []).forEach(function (l) {
        if (l.indexOf('│') === 0) {
          printHtml('<span class="term-quote">│</span>' + escapeHtml(l.slice(1)));
        } else if (l.indexOf('—') === 0) {
          print(l, 'dim');
        } else {
          print(l);
        }
      });
    });
  };

  COMMANDS.theme = function (args) {
    var t = (args[0] || '').toLowerCase();
    if (t !== 'green' && t !== 'amber') {
      print('theme: usage: theme <green|amber>', 'err');
      return;
    }
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('phosphorTheme', t); } catch (e) {}
    document.querySelectorAll('.phosphor-toggle .theme-opt').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.theme === t ? 'true' : 'false');
    });
    print('theme → ' + t, 'dim');
  };

  COMMANDS.whoami = function () {
    print('hunter — electrical engineer & computer scientist (baltimore, MD)');
  };

  COMMANDS.echo = function (args) { print(args.join(' ')); };

  COMMANDS.date = function () { print(new Date().toString()); };

  COMMANDS.uptime = function () {
    var s = Math.floor((Date.now() - bootTime) / 1000);
    var m = Math.floor(s / 60), h = Math.floor(m / 60);
    print('session up ' + (h ? (h + 'h ') : '') + (m % 60) + 'm ' + (s % 60) + 's');
  };

  COMMANDS.history = function () {
    if (!hist.length) { print('(no history yet)', 'dim'); return; }
    hist.forEach(function (c, i) {
      print('  ' + String(i + 1).padStart(3, ' ') + '  ' + c);
    });
  };

  COMMANDS.clear = function () { output.innerHTML = ''; };

  COMMANDS.doom = function () {
    if (!window.TerminalDoom || typeof window.TerminalDoom.start !== 'function') {
      print('doom: module not loaded', 'err');
      return;
    }
    print('launching DOOM — click the frame to capture input, ✕/Esc to quit', 'dim');
    print('');
    printHtml('<span class="term-dir">controls</span>');
    printHtml('  <span class="term-dir">W</span> / <span class="term-dir">A</span> / <span class="term-dir">S</span> / <span class="term-dir">D</span>     <span class="dim">move</span>');
    printHtml('  <span class="term-dir">mouse</span>             <span class="dim">aim</span>');
    printHtml('  <span class="term-dir">click</span>             <span class="dim">shoot</span>');
    printHtml('  <span class="term-dir">esc</span> / <span class="term-dir">✕</span>         <span class="dim">quit</span>');
    print('');
    mode = 'game';
    input.blur();
    window.TerminalDoom.start(output, function () {
      mode = 'shell';
      print('— exit doom —', 'dim');
      input.focus();
    });
  };

  /* `ssh` opens an external project link in a new tab. It only works
     inside a project directory (a node under personal/ or academic/
     that has .links populated). */
  function isProjectNode(node) {
    if (!node || !node.links) return false;
    var p = node.parent;
    return !!(p && (p.name === 'personal' || p.name === 'academic'));
  }

  COMMANDS.ssh = function (args) {
    if (!isProjectNode(cwd)) {
      print('ssh: only available inside a project directory.', 'err');
      print('     try `cd personal/<project>` or `cd academic/<project>` first.', 'dim');
      return;
    }
    var links = cwd.links || {};
    var available = Object.keys(links).filter(function (k) { return links[k]; });
    if (!available.length) {
      print('ssh: no external links for ' + cwd.name, 'err');
      return;
    }

    var which = (args[0] || '').toLowerCase();
    var target;
    if (which) {
      target = links[which];
      if (!target) {
        print('ssh: no `' + which + '` link for ' + cwd.name, 'err');
        print('     available: ' + available.join(', '), 'dim');
        return;
      }
    } else {
      // priority: live > github > video > download
      var order = ['live', 'github', 'video', 'download'];
      for (var i = 0; i < order.length; i++) {
        if (links[order[i]]) { which = order[i]; target = links[which]; break; }
      }
    }

    print('ssh ' + which + ' → ' + target, 'dim');
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  /* ---- parse + run ------------------------------------------------- */
  function run(line) {
    var trimmed = line.trim();
    echo(line);
    if (!trimmed) return;

    hist.push(trimmed);
    histIdx = hist.length;

    var parts = trimmed.split(/\s+/);
    var cmd   = parts[0];
    var args  = parts.slice(1);

    var fn = COMMANDS[cmd];
    if (typeof fn === 'function') {
      try { fn(args); }
      catch (e) { print(cmd + ': ' + (e && e.message || 'error'), 'err'); }
    } else {
      print(cmd + ': command not found. try `help`', 'err');
    }
  }

  /* ---- tab completion --------------------------------------------- */
  /* For path-aware completion (cd/ls/open/go/cat), only complete the
     final segment of the path against the children of the directory
     that segment lives in. */
  function pathCompletion(cmd, token) {
    var hadSlash = token.indexOf('/') !== -1;
    var lastSlash = token.lastIndexOf('/');
    var dirPart  = hadSlash ? token.substring(0, lastSlash + 1) : '';
    var leafPart = hadSlash ? token.substring(lastSlash + 1)    : token;

    // figure out the directory we should list against
    var base;
    if (token.charAt(0) === '/') {
      base = fs;
    } else if (!hadSlash) {
      base = cwd;
    } else {
      // walk the dirPart from cwd (or root if absolute already handled)
      base = resolve(dirPart) || null;
    }
    if (!base || base.kind !== 'dir') return { matches: [], replaceFrom: 0, prefix: leafPart };

    var pool;
    if (cmd === 'cat') {
      // files in this dir + (if we're not already at root) files in root
      var cwdFiles = Object.keys(base.children).filter(function (k) { return base.children[k].kind === 'file'; });
      var rootFiles = base === fs ? [] : Object.keys(fs.children).filter(function (k) { return fs.children[k].kind === 'file'; });
      pool = cwdFiles.concat(rootFiles.filter(function (k) { return cwdFiles.indexOf(k) === -1; }));
    } else {
      pool = Object.keys(base.children);
      // virtual entries
      pool.push('..');
      if (base === fs) pool.push('~', '/');
    }

    var matches = pool.filter(function (p) { return p.indexOf(leafPart) === 0; });
    return { matches: matches, replaceFrom: hadSlash ? (dirPart.length) : 0, prefix: leafPart, dirPart: dirPart };
  }

  function complete(value) {
    var endsWithSpace = /\s$/.test(value);
    var tokens = value.split(/\s+/).filter(Boolean);

    if (tokens.length === 0 || (tokens.length === 1 && !endsWithSpace)) {
      var prefix = tokens[0] || '';
      var matches = Object.keys(COMMANDS).filter(function (c) { return c.indexOf(prefix) === 0; });
      return { prefix: prefix, matches: matches, replaceFrom: 0, mode: 'cmd' };
    }

    var cmd    = tokens[0];
    var token  = endsWithSpace ? '' : tokens[tokens.length - 1];
    var argStart = endsWithSpace ? value.length : value.lastIndexOf(token);

    if (cmd === 'cd' || cmd === 'ls' || cmd === 'open' || cmd === 'go' || cmd === 'cat') {
      var pc = pathCompletion(cmd, token);
      return {
        prefix: pc.prefix,
        matches: pc.matches,
        replaceFrom: argStart + (pc.dirPart ? pc.dirPart.length : 0),
        mode: 'path'
      };
    }
    if (cmd === 'theme') {
      var themePool = ['green', 'amber'];
      return {
        prefix: token,
        matches: themePool.filter(function (p) { return p.indexOf(token) === 0; }),
        replaceFrom: argStart,
        mode: 'arg'
      };
    }
    if (cmd === 'ssh') {
      var sshPool = (isProjectNode(cwd) && cwd.links)
        ? Object.keys(cwd.links).filter(function (k) { return cwd.links[k]; })
        : [];
      return {
        prefix: token,
        matches: sshPool.filter(function (p) { return p.indexOf(token) === 0; }),
        replaceFrom: argStart,
        mode: 'arg'
      };
    }
    return { prefix: token, matches: [], replaceFrom: argStart, mode: 'none' };
  }

  function commonPrefix(strings) {
    if (!strings.length) return '';
    var p = strings[0];
    for (var i = 1; i < strings.length; i++) {
      while (strings[i].indexOf(p) !== 0) {
        p = p.slice(0, -1);
        if (!p) return '';
      }
    }
    return p;
  }

  function applyCompletion(value) {
    var c = complete(value);
    if (!c.matches.length) return value;

    if (c.matches.length === 1) {
      // dirs get a trailing '/', files/commands a trailing ' '
      var match = c.matches[0];
      var suffix = ' ';
      if (c.mode === 'path') {
        // figure out if it's a dir at the current base
        var base = (function () {
          var token = value.substring(c.replaceFrom - (c.prefix.length === 0 ? 0 : c.prefix.length));
          // crude: just check cwd then fs root
          var n = cwd.children[match] || fs.children[match];
          return n;
        })();
        if (base && base.kind === 'dir') suffix = '/';
      }
      return value.substring(0, c.replaceFrom) + match + suffix;
    }

    var cp = commonPrefix(c.matches);
    if (cp.length > c.prefix.length) {
      return value.substring(0, c.replaceFrom) + cp;
    }

    echo(value);
    print(c.matches.join('   '), 'dim');
    return value;
  }

  /* ---- key + form handling ---------------------------------------- */
  input.addEventListener('keydown', function (e) {
    if (mode === 'game') return;

    if (e.key === 'Tab') {
      e.preventDefault();
      input.value = applyCompletion(input.value);
      return;
    }
    if (e.key === 'ArrowUp') {
      if (!hist.length) return;
      e.preventDefault();
      histIdx = Math.max(0, histIdx - 1);
      input.value = hist[histIdx] || '';
      requestAnimationFrame(function () {
        input.setSelectionRange(input.value.length, input.value.length);
      });
      return;
    }
    if (e.key === 'ArrowDown') {
      if (!hist.length) return;
      e.preventDefault();
      histIdx = Math.min(hist.length, histIdx + 1);
      input.value = histIdx >= hist.length ? '' : (hist[histIdx] || '');
      return;
    }
    if ((e.key === 'l' || e.key === 'L') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      COMMANDS.clear();
      return;
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (mode === 'game') return;
    var value = input.value;
    input.value = '';
    run(value);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (mode === 'shell') { COMMANDS.clear(); input.focus(); }
    });
  }

  root.addEventListener('click', function (e) {
    if (mode !== 'shell') return;
    var tag = e.target && e.target.tagName;
    if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT') return;
    input.focus();
  });

  /* ---- global Tab keybind — focuses terminal input from anywhere -- */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    if (mode !== 'shell') return;

    var active = document.activeElement;
    if (active === input) return; // already in the terminal — let tab-complete handle it
    // Don't steal Tab from other text inputs / textareas / contenteditable
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
      return;
    }
    e.preventDefault();
    input.focus();
    root.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });

  /* ---- boot -------------------------------------------------------- */
  /* Start in the directory that matches the page you're on. The home
     page (and anything without a matching route) gets the root prompt. */
  var startNode = nodeForPath(window.location.pathname) || fs;
  setCwd(startNode);
  print('hunter@local — pseudo-terminal v1.0', 'dim');
  print('type `help` for commands · `doom` to play Doom `random` to wander', 'dim');
  print('tip: press TAB anywhere on the page to jump back to this prompt', 'dim');
  if (startNode !== fs) {
    printHtml('cwd set to <span class="term-cwd">' + escapeHtml(startNode.display) +
              '</span> to match this page · <span class="term-dir">cd /</span> for root', 'dim');
  }
  print('');
})();
