# Yet Another Doom Clone — vendored copy

Original work:  https://github.com/carlini/js13k2019-yet-another-doom-clone
Author:         Nicholas Carlini
License:        GNU GPL v3 (see LICENSE in this directory)

This is the upstream js13kGames 2019 entry, vendored unmodified into
`static/vendor/doom-clone/` so the in-page terminal can iframe it at
`/static/vendor/doom-clone/doom.html` without an external host.

Do not modify these files. If upgrading, replace them in-place from
the upstream repository; the inline `<script src="src/...">` paths
inside `doom.html` rely on this exact directory layout.

The wrapper that mounts this game inside the terminal lives in
`static/js/terminal-doom.js` and is a separate file — it does not
modify or relink the upstream code, it only embeds it via `<iframe>`.
