from flask import Flask, render_template, jsonify, abort, url_for
from dotenv import load_dotenv
import requests
import random
import json
import os
import hashlib
import time
import threading
import ipaddress
import re
import sqlite3
import secrets
import urllib.parse
import urllib.request
from contextlib import contextmanager
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-change-in-production')

# Feature flags
SHOW_GAME = False    
SHOW_RESUME = False  
SHOW_BLOG = False    

# ============================================
# VISITOR COUNTER (SQLite-backed)
# DATA_DIR can be set to a Railway Volume mount path (e.g. /data) for persistence.
# ============================================
_data_dir = os.getenv('DATA_DIR', os.path.join('static', 'data'))
_visits_file = os.path.join(_data_dir, 'visits.json')         # legacy mirror
_visitor_db_file = os.path.join(_data_dir, 'visitors.sqlite3')
_visit_lock = threading.Lock()

_BOT_UA_RE = re.compile(
    r'(bot|crawl|spider|slurp|facebookexternalhit|preview|scanner|uptime|monitor|headless)',
    re.IGNORECASE,
)


def _utc_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'


@contextmanager
def _visitor_db():
    os.makedirs(_data_dir, exist_ok=True)
    conn = sqlite3.connect(_visitor_db_file, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout = 10000')
    try:
        conn.execute('PRAGMA journal_mode = WAL')
    except sqlite3.DatabaseError:
        pass
    try:
        yield conn
    finally:
        conn.close()


def _legacy_visit_count():
    try:
        with open(_visits_file, 'r') as f:
            return int(json.load(f).get('count', 0))
    except (FileNotFoundError, json.JSONDecodeError, TypeError, ValueError):
        return 0


def _write_visit_count_mirror(count):
    try:
        os.makedirs(_data_dir, exist_ok=True)
        tmp_path = _visits_file + '.tmp'
        with open(tmp_path, 'w') as f:
            json.dump({'count': int(count)}, f)
        os.replace(tmp_path, _visits_file)
    except Exception:
        pass


def _ensure_visitor_db():
    with _visitor_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS visitor_counter (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS visitor_events (
                id TEXT PRIMARY KEY,
                sequence INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                path TEXT,
                referrer_host TEXT,
                user_agent_family TEXT,
                country TEXT,
                region TEXT,
                city TEXT,
                lat REAL,
                lon REAL,
                geocode_status TEXT NOT NULL DEFAULT 'pending'
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_visitor_events_created ON visitor_events(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_visitor_events_geo ON visitor_events(lat, lon)")
        row = conn.execute("SELECT count FROM visitor_counter WHERE id = 1").fetchone()
        if not row:
            now = _utc_iso()
            conn.execute(
                "INSERT INTO visitor_counter (id, count, created_at, updated_at) VALUES (1, ?, ?, ?)",
                (_legacy_visit_count(), now, now),
            )
        conn.commit()


def _read_visit_count():
    try:
        _ensure_visitor_db()
        with _visitor_db() as conn:
            row = conn.execute("SELECT count FROM visitor_counter WHERE id = 1").fetchone()
            return int(row['count']) if row else _legacy_visit_count()
    except Exception:
        return _legacy_visit_count()


def get_real_ip():
    from flask import request
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.headers.get('X-Real-IP') or request.remote_addr or ''


def is_private_ip(ip):
    try:
        parsed = ipaddress.ip_address(ip)
        return parsed.is_private or parsed.is_loopback or parsed.is_reserved or parsed.is_link_local
    except ValueError:
        return True


def _is_likely_bot():
    from flask import request
    ua = request.headers.get('User-Agent', '')
    return bool(_BOT_UA_RE.search(ua))


def _ua_family():
    from flask import request
    ua = request.headers.get('User-Agent', '')
    if not ua:
        return 'unknown'
    checks = (
        ('mobile_safari', 'Mobile', 'Safari'),
        ('ios_webview', 'iPhone', 'AppleWebKit'),
        ('chrome', 'Chrome'),
        ('firefox', 'Firefox'),
        ('safari', 'Safari'),
        ('edge', 'Edg/'),
    )
    for label, *needles in checks:
        if all(n in ua for n in needles):
            return label
    return 'browser'


def _visit_path_from_request():
    from flask import request
    path = ''
    if request.is_json:
        data = request.get_json(silent=True) or {}
        path = str(data.get('path') or '')
    if not path:
        referrer = request.headers.get('Referer', '')
        parsed = urllib.parse.urlparse(referrer)
        path = parsed.path or ''
    if not path.startswith('/'):
        path = '/'
    return path[:160]


def _referrer_host():
    from flask import request
    referrer = request.headers.get('Referer', '')
    parsed = urllib.parse.urlparse(referrer)
    host = parsed.netloc.lower()
    return host[:120] if host else ''


def _geocode_ip(ip):
    if not ip or is_private_ip(ip):
        return {'geocode_status': 'local_or_private'}
    token = os.getenv('IPINFO_TOKEN', '').strip()
    quoted_ip = urllib.parse.quote(ip, safe='')
    url = f'https://ipinfo.io/{quoted_ip}/json'
    if token:
        url += f'?token={urllib.parse.quote(token)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'hunter-visitor-map/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            if getattr(resp, 'status', 200) != 200:
                return {'geocode_status': f'http_{getattr(resp, "status", "error")}'}
            data = json.loads(resp.read().decode('utf-8'))
    except Exception:
        return {'geocode_status': 'lookup_failed'}

    loc = data.get('loc', '')
    if not loc or ',' not in loc:
        return {'geocode_status': 'no_location'}
    try:
        lat_str, lon_str = loc.split(',', 1)
        lat = round(float(lat_str), 1)
        lon = round(float(lon_str), 1)
    except (TypeError, ValueError):
        return {'geocode_status': 'bad_location'}

    return {
        'geocode_status': 'mapped',
        'lat': lat,
        'lon': lon,
        'city': str(data.get('city') or '')[:120],
        'region': str(data.get('region') or '')[:120],
        'country': str(data.get('country') or '')[:12],
    }


def _update_visitor_event_location(event_id, ip):
    geo = _geocode_ip(ip)
    try:
        with _visitor_db() as conn:
            conn.execute(
                """
                UPDATE visitor_events
                   SET updated_at = ?,
                       country = ?,
                       region = ?,
                       city = ?,
                       lat = ?,
                       lon = ?,
                       geocode_status = ?
                 WHERE id = ?
                """,
                (
                    _utc_iso(),
                    geo.get('country', ''),
                    geo.get('region', ''),
                    geo.get('city', ''),
                    geo.get('lat'),
                    geo.get('lon'),
                    geo.get('geocode_status', 'lookup_failed'),
                    event_id,
                ),
            )
            conn.commit()
    except Exception:
        pass


def _record_visit_event():
    """Increment the public counter and insert one visitor event.

    Raw IPs and full user agents are intentionally not stored. The event is
    inserted before geolocation so the footer count and event count stay
    aligned even if the third-party lookup fails.
    """
    _ensure_visitor_db()
    now = _utc_iso()
    event_id = secrets.token_urlsafe(12)
    ip = get_real_ip()
    with _visit_lock:
        with _visitor_db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT count FROM visitor_counter WHERE id = 1").fetchone()
            current = int(row['count']) if row else _legacy_visit_count()
            count = current + 1
            conn.execute(
                "UPDATE visitor_counter SET count = ?, updated_at = ? WHERE id = 1",
                (count, now),
            )
            conn.execute(
                """
                INSERT INTO visitor_events
                    (id, sequence, created_at, updated_at, path, referrer_host, user_agent_family, geocode_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    count,
                    now,
                    now,
                    _visit_path_from_request(),
                    _referrer_host(),
                    _ua_family(),
                    'pending' if not is_private_ip(ip) else 'local_or_private',
                ),
            )
            conn.commit()
        _write_visit_count_mirror(count)
    if not is_private_ip(ip):
        threading.Thread(target=_update_visitor_event_location, args=(event_id, ip), daemon=True).start()
    return count

# Initialize visitor DB on startup
_ensure_visitor_db()

# Visits are recorded via POST /api/visit (triggered from base.html JS),
# not in @before_request — so refreshes/asset re-requests don't double-count
# and bots are filtered by user-agent.

def get_terminal_projects():
    """Compact project id/title/link payload for the in-page terminal filesystem."""
    try:
        projects = load_projects()
    except Exception:
        return {'personal': [], 'academic': []}

    def shape(p):
        links = {}
        if p.get('hasLive')     and p.get('liveLink'):     links['live']     = p['liveLink']
        if p.get('hasGithub')   and p.get('githubLink'):   links['github']   = p['githubLink']
        if p.get('hasVideo')    and p.get('videoLink'):    links['video']    = p['videoLink']
        if p.get('hasDownload') and p.get('downloadLink'): links['download'] = p['downloadLink']
        return {
            'id': p.get('id', ''),
            'title': p.get('title', ''),
            'links': links,
        }

    return {
        'personal': [shape(p) for p in projects.get('personal', []) if p.get('id')],
        'academic': [shape(p) for p in projects.get('academic', []) if p.get('id')],
    }


@app.context_processor
def inject_feature_flags():
    """Make feature flags available to all templates"""
    return {
        'show_game': SHOW_GAME,
        'show_resume': SHOW_RESUME,
        'show_blog': SHOW_BLOG,
        'visit_count': get_authoritative_visit_count(),
        'image_url': static_image_url,
        'terminal_projects': get_terminal_projects(),
    }

# Image extensions to look for
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'}
WEBP_SOURCE_EXTENSIONS = {'.png', '.jpg', '.jpeg'}


def normalize_static_path(path):
    return path.replace('\\', '/').lstrip('/')


def static_path_to_abspath(path):
    return os.path.join('static', *normalize_static_path(path).split('/'))


def prefer_webp_asset(path):
    normalized = normalize_static_path(path)
    stem, ext = os.path.splitext(normalized)
    if ext.lower() in WEBP_SOURCE_EXTENSIONS:
        webp_path = f'{stem}.webp'
        if os.path.exists(static_path_to_abspath(webp_path)):
            return webp_path
    return normalized


def dedupe_image_paths(paths):
    seen = set()
    result = []
    for path in paths:
        normalized = prefer_webp_asset(path)
        key = os.path.splitext(normalized)[0].lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def static_image_url(path):
    return url_for('static', filename=prefer_webp_asset(path))


def get_authoritative_visit_count():
    return _read_visit_count()


def get_authoritative_visitor_locations():
    try:
        _ensure_visitor_db()
        with _visitor_db() as conn:
            rows = conn.execute(
                """
                SELECT lat, lon, city, country
                  FROM visitor_events
                 WHERE lat IS NOT NULL AND lon IS NOT NULL
                """
            ).fetchall()
        return [dict(r) for r in rows]
    except Exception:
        return []


def get_visitor_snapshot():
    locations = get_authoritative_visitor_locations()
    total_visits = _read_visit_count()
    unique_countries = len({loc.get('country') for loc in locations if loc.get('country')})
    return {
        'locations': locations,
        'total_visits': total_visits,
        'unique_countries': unique_countries,
        'location_count': len(locations),
    }

def load_projects():
    """Load projects from JSON file"""
    with open('static/data/projects.json', 'r') as f:
        return json.load(f)

def load_blog_posts():
    """Load blog posts from JSON file"""
    try:
        with open('static/data/blog.json', 'r') as f:
            data = json.load(f)
            return data.get('posts', [])
    except FileNotFoundError:
        return []

def get_quick_stats():
    """Calculate quick stats for the home page"""
    from datetime import datetime
    projects = load_projects()
    all_projects = projects.get('personal', []) + projects.get('academic', [])

    # Count unique technologies
    all_tags = set()
    for project in all_projects:
        all_tags.update(project.get('tags', []))

    # Calculate years coding (from earliest project date)
    earliest_date = None
    for project in all_projects:
        date_str = project.get('date', '')
        if date_str:
            try:
                year, month = date_str.split('-')
                project_date = datetime(int(year), int(month), 1)
                if earliest_date is None or project_date < earliest_date:
                    earliest_date = project_date
            except:
                pass

    years_coding = 0
    if earliest_date:
        years_coding = (datetime.now() - earliest_date).days // 365

    return {
        'projects_count': len(all_projects),
        'tech_count': len(all_tags),
        'years_coding': max(years_coding, 5)
    }

def get_project_images(category, project_id, icon_image):
    """
    Scan project folder for images.
    Returns list of image paths relative to static folder.
    Icon image is excluded from gallery images.
    """
    # Map category to folder name
    folder_map = {
        'personal': 'personal',
        'academic': 'academic'
    }
    folder_name = folder_map.get(category, 'personal')

    project_folder = os.path.join('static', 'images', 'projects', folder_name, project_id)
    icon_stem = os.path.splitext(icon_image)[0].lower() if icon_image else ''

    images = []
    if os.path.isdir(project_folder):
        for name in sorted(os.listdir(project_folder)):
            filepath = os.path.join(project_folder, name)
            if not os.path.isfile(filepath):
                continue
            stem, ext = os.path.splitext(name)
            if ext.lower() not in IMAGE_EXTENSIONS:
                continue
            if icon_stem and stem.lower() == icon_stem:
                continue
            rel_path = os.path.relpath(filepath, 'static').replace('\\', '/')
            images.append(rel_path)

    return dedupe_image_paths(images)

def get_icon_image_path(category, project_id, icon_image):
    """
    Get the icon image path. First checks project folder, then falls back to root images folder.
    """
    folder_map = {
        'personal': 'personal',
        'academic': 'academic'
    }
    folder_name = folder_map.get(category, 'personal')

    project_rel_path = f'images/projects/{folder_name}/{project_id}/{icon_image}'
    root_rel_path = f'images/{icon_image}'

    for candidate in (project_rel_path, root_rel_path):
        resolved = prefer_webp_asset(candidate)
        if os.path.exists(static_path_to_abspath(resolved)):
            return resolved

    return prefer_webp_asset(project_rel_path)

def get_featured_project():
    """Get the project marked as homeFeatured, or fall back to random featured"""
    projects = load_projects()
    all_projects = projects.get('personal', []) + projects.get('academic', [])

    # First look for a project explicitly marked for home feature
    home_featured = [p for p in all_projects if p.get('homeFeatured', False)]
    if home_featured:
        project = home_featured[0]  # Take the first one marked
    else:
        # Fall back to random from featured projects
        featured = [p for p in all_projects if p.get('featured', False)]
        if featured:
            project = random.choice(featured)
        elif all_projects:
            project = random.choice(all_projects)
        else:
            return None

    # Determine category
    if project in projects.get('personal', []):
        project['category'] = 'personal'
    else:
        project['category'] = 'academic'

    # Get icon image path
    project['iconImagePath'] = get_icon_image_path(
        project['category'],
        project['id'],
        project.get('iconImage', '')
    )
    return project

def get_project_by_id(project_id):
    """Get a single project by ID with all images"""
    projects = load_projects()
    for category in ['personal', 'academic']:
        for project in projects.get(category, []):
            if project.get('id') == project_id:
                project['category'] = category
                # Get icon image path
                project['iconImagePath'] = get_icon_image_path(
                    category,
                    project_id,
                    project.get('iconImage', '')
                )
                # Get gallery images from project folder
                project['galleryImages'] = get_project_images(
                    category,
                    project_id,
                    project.get('iconImage', '')
                )
                return project
    return None

def enrich_project_list(projects, category):
    """Add icon image paths to a list of projects"""
    for project in projects:
        project['category'] = category
        project['iconImagePath'] = get_icon_image_path(
            category,
            project['id'],
            project.get('iconImage', '')
        )
    return projects

def group_personal_projects(projects):
    """Group personal projects by subcategory and sort by rank"""
    # Define the order of subcategories
    subcategory_order = ['Websites', 'Mobile Applications', 'Bots', 'Other Software']

    # Group projects by subcategory
    grouped = {}
    for project in projects:
        subcategory = project.get('subcategory', 'Other Software')
        if subcategory not in grouped:
            grouped[subcategory] = []
        grouped[subcategory].append(project)

    # Sort each group by rank
    for subcategory in grouped:
        grouped[subcategory].sort(key=lambda p: p.get('rank', 999))

    # Return as ordered list of tuples
    result = []
    for subcategory in subcategory_order:
        if subcategory in grouped:
            result.append((subcategory, grouped[subcategory]))

    # Add any remaining subcategories not in the predefined order
    for subcategory in grouped:
        if subcategory not in subcategory_order:
            result.append((subcategory, grouped[subcategory]))

    return result

def group_academic_projects(projects):
    """Group academic projects by university and sort by rank"""
    # Define the order of universities
    university_order = ['University of Illinois', 'Johns Hopkins University']

    # Group projects by university
    grouped = {}
    for project in projects:
        university = project.get('university', 'University of Illinois')
        if university not in grouped:
            grouped[university] = []
        grouped[university].append(project)

    # Sort each group by rank
    for university in grouped:
        grouped[university].sort(key=lambda p: p.get('rank', 999))

    # Return as ordered list of tuples
    result = []
    for university in university_order:
        if university in grouped:
            result.append((university, grouped[university]))

    # Add any remaining universities not in the predefined order
    for university in grouped:
        if university not in university_order:
            result.append((university, grouped[university]))

    return result

@app.route('/')
def index():
    featured = get_featured_project()
    stats = get_quick_stats()
    return render_template('index.html',
                         featured_project=featured,
                         stats=stats,
                         active_page='home',
                         page_id='home-page')

@app.route('/about')
def about():
    return render_template('about.html',
                         active_page='about',
                         page_id='about-page')

@app.route('/game')
def game():
    return render_template('game.html',
                         active_page='game',
                         page_id='game-page')

@app.route('/projects/personal')
def personal_projects():
    projects = load_projects()
    personal = enrich_project_list(projects.get('personal', []), 'personal')
    grouped = group_personal_projects(personal)
    return render_template('projects/personal.html',
                         grouped_projects=grouped,
                         active_page='personal',
                         page_id='personal-projects-page')

@app.route('/projects/academic')
def academic_projects():
    projects = load_projects()
    academic = enrich_project_list(projects.get('academic', []), 'academic')
    grouped = group_academic_projects(academic)
    return render_template('projects/academic.html',
                         grouped_projects=grouped,
                         active_page='academic',
                         page_id='academic-projects-page')

@app.route('/projects/<project_id>')
def project_detail(project_id):
    project = get_project_by_id(project_id)
    if not project:
        abort(404)

    category = project.get('category', 'personal')

    return render_template('projects/detail.html',
                         project=project,
                         active_page=category,
                         page_id='project-detail-page')

@app.route("/api/quote")
def get_quote():
    """Fetches a random quote from the ZenQuotes API and returns JSON"""
    try:
        response = requests.get("https://zenquotes.io/api/quotes")
        response.raise_for_status()
        quotes = response.json()

        if isinstance(quotes, list) and len(quotes) > 0:
            random_quote = random.choice(quotes)
            return jsonify({"quote": random_quote["q"], "author": random_quote["a"]})
        else:
            return jsonify({"error": "Invalid response from API"}), 500

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/lyrics/random')
def random_lyric():
    """Get a random lyric for the footer"""
    try:
        with open('static/data/lyrics.json', 'r') as f:
            lyrics_data = json.load(f)
        if lyrics_data:
            lyric = random.choice(lyrics_data)
            return jsonify(lyric)
        return jsonify({"error": "No lyrics available"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/visit', methods=['POST'])
def record_visit():
    """Record one visit. Bots are filtered by user-agent and not counted."""
    if _is_likely_bot():
        return jsonify({'count': _read_visit_count(), 'counted': False})
    count = _record_visit_event()
    return jsonify({'count': count, 'counted': True})


@app.route('/api/visit-count')
def get_visit_count_route():
    return jsonify({'count': _read_visit_count()})


@app.route('/api/reset-visitors', methods=['POST'])
def reset_visitors():
    """Reset visit counter and visitor events. Requires ADMIN_KEY header."""
    from flask import request
    admin_key = os.getenv('ADMIN_KEY', '')
    provided = request.headers.get('X-Admin-Key', '')
    if not admin_key or provided != admin_key:
        return jsonify({'error': 'unauthorized'}), 401
    _ensure_visitor_db()
    now = _utc_iso()
    with _visit_lock:
        with _visitor_db() as conn:
            conn.execute("DELETE FROM visitor_events")
            conn.execute(
                "UPDATE visitor_counter SET count = 0, updated_at = ? WHERE id = 1",
                (now,),
            )
            conn.commit()
        _write_visit_count_mirror(0)
    return jsonify({'status': 'reset', 'visits': 0, 'locations': 0})


@app.route('/api/visitor-locations')
def visitor_locations_api():
    """Return all visitor locations for the map"""
    return jsonify(get_visitor_snapshot())

@app.route('/visitors')
def visitors():
    visitor_snapshot = get_visitor_snapshot()
    return render_template('visitors.html',
                         active_page='visitors',
                         page_id='visitors-page',
                         total_visits=visitor_snapshot['total_visits'],
                         unique_countries=visitor_snapshot['unique_countries'],
                         location_count=visitor_snapshot['location_count'])

@app.route('/lyrics')
def all_lyrics():
    with open('static/data/lyrics.json', 'r') as f:
        lyrics_data = json.load(f)
    return render_template('lyrics/all.html',
                         lyrics=lyrics_data,
                         active_page='lyrics',
                         page_id='lyrics-page')

# Keep old route for backwards compatibility
@app.route('/all-lyrics')
def all_lyrics_redirect():
    return all_lyrics()

@app.route('/blog')
def blog():
    posts = load_blog_posts()
    return render_template('blog/index.html',
                         posts=posts,
                         active_page='blog',
                         page_id='blog-page')

@app.route('/blog/<post_id>')
def blog_post(post_id):
    posts = load_blog_posts()
    post = next((p for p in posts if p.get('id') == post_id), None)
    if not post:
        abort(404)
    return render_template('blog/post.html',
                         post=post,
                         active_page='blog',
                         page_id='blog-post-page')

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html',
                         page_id='error-page'), 404

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
