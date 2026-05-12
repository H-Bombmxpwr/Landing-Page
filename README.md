# Landing Page

Personal site for Hunter Baisden. Live at [hxr.life](https://hxr.life).

Flask app rendered server-side with vanilla JS on top — no framework, no
build step. The look is brutalist-terminal: IBM Plex Mono everywhere,
hard 1px borders, no rounded corners, a subtle dot grid behind the
content, and a switchable phosphor accent (green or amber) that
persists in `localStorage`.

## What's on the site

- **Home** — hero card with portrait, quick stats, featured project,
  links into Personal / Academic, and a rotating lyric block.
- **Personal Projects** & **Academic Projects** — grouped by
  subcategory / university, loaded from `static/data/projects.json`.
- **Project detail pages** — gallery + lightbox, external links,
  optional embedded most-recent Lichess game for chess-related entries.
- **About** — bio, education, social links with original brand colors.
- **Visitors** — Leaflet map of approximate visitor locations
  (city-level only; no IPs stored). Counter is SQLite-backed and
  POST'd once per session from the client.
- **Lyrics** — `/lyrics` lists the full collection;
  `/api/lyrics/random` powers the home-page rotator and the
  terminal's `lyric` command.
- **404** — themed error page.

## The terminal

There's a working pseudo-terminal in the footer of every page.
It models the site as a virtual filesystem so you can `cd` into
directories and `ls` to see what's there.

```
help                   list every command
ls / cd / pwd          navigate the virtual filesystem
                       (cd personal then ls shows every project)
cat README.md          built-in readme
cat lyrics.txt         random lyric, fetched live
open / go              navigate to the current cwd or named route
random                 jump to a random page
ssh [live|github|...]  open a project link in a new tab
                       (only inside a project dir)
lyric                  print a random lyric in-place
doom                   launch the vendored Doom clone in an iframe
theme green|amber      switch phosphor color
whoami / echo / date / uptime / history / clear
```

**Keys:** `Tab` anywhere on the site jumps focus to the terminal
prompt. Once focused, `Tab` completes commands and paths (cwd-aware),
`↑`/`↓` cycle history, `Ctrl+L` clears.

## Tech

- **Backend:** Flask, SQLite (visitor counter), `ipinfo.io` for
  city-level geocoding behind a token (optional).
- **Frontend:** vanilla JS, no bundler, no framework. Each subsystem
  has its own file under `static/js/` (`terminal.js`,
  `terminal-doom.js`, `visitors-map.js`, etc.). Styles split across
  `static/css/style.css` (site-wide) and `static/css/terminal.css`
  (terminal panel).
- **Type:** IBM Plex Mono via Google Fonts.
- **Vendored:** [Yet Another Doom Clone](https://github.com/carlini/js13k2019-yet-another-doom-clone)
  by Nicholas Carlini, GPL-3.0, under `static/vendor/doom-clone/`
  with its `LICENSE` and a `README.md` recording the source and
  attribution. The terminal embeds it via `<iframe>` as mere
  aggregation; the rest of the site is not GPL-licensed.

## Running locally

```bash
python -m venv .venv
.venv/Scripts/activate     # or `source .venv/bin/activate`
pip install -r requirements.txt
python app.py
```

Then open <http://127.0.0.1:5000>. The Flask dev server runs with
`debug=False`, so template changes require a restart.

Optional environment variables (in `.env`):

| Var | Purpose |
| --- | --- |
| `SECRET_KEY` | Flask session secret |
| `DATA_DIR` | Override where `visits.json` + `visitors.sqlite3` live (set to a persistent volume mount in production) |
| `IPINFO_TOKEN` | Geocoding token for visitor map (works without one, just rate-limited) |
| `ADMIN_KEY` | Header value required by `POST /api/reset-visitors` |
| `PORT` | Override the dev-server port (default 5000) |

## Project layout

```
app.py                        Flask routes + visitor counter
templates/                    Jinja templates (base.html + per page)
static/
  css/                        style.css, terminal.css
  js/                         site.js, effects.js, terminal.js, …
  data/                       projects.json, lyrics.json,
                              visits.json, visitors.sqlite3
  images/                     portrait + per-project galleries
  vendor/doom-clone/          GPL-3.0 vendored game (unmodified)
scripts/
  convert_images_to_webp.py   one-shot util for prepping images
```

## Deployment

Procfile + `runtime.txt` + `requirements.txt` are wired for Railway.
The visitor SQLite needs a persistent volume — point `DATA_DIR` at
the mount path so the counter survives redeploys.
