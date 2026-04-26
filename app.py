from flask import Flask, render_template, jsonify, abort
from dotenv import load_dotenv
import requests
import random
import json
import os
import glob
import hashlib
import time
import threading
import ipaddress
from concurrent.futures import ThreadPoolExecutor, as_completed

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-change-in-production')

# Feature flags
SHOW_GAME = False    
SHOW_RESUME = False  
SHOW_BLOG = False    

# Dynamic background images configuration
DYNAMIC_IMAGES = True  # Set to True to fetch images from Unsplash instead of local files
UNSPLASH_ACCESS_KEY = os.getenv('UNSPLASH_ACCESS', '')  # From .env file
UNSPLASH_SECRET_KEY = os.getenv('UNSPLASH_SECRET', '')  # From .env file 

CITY_SEARCH_QUERIES = {
    'baltimore': [
        'inner harbor baltimore',
        'fells point baltimore',
        'camden yards orioles',
        'baltimore rowhouses',
        'fort mchenry',
        'federal hill baltimore',
        'mount vernon baltimore',
        'chesapeake bay baltimore',
        'national baltimore aquarium',
        'domino sugar baltimore',
        'baltimore canton coal',
        'national bohemian baltimore',
        'patterson park baltimore observatory'
    ],
    'dc': [
        'washington monument dc',
        'lincoln memorial',
        'capitol building washington',
        'georgetown washington dc',
        'nationals park dc',
        'dupont circle dc',
        'adams morgan dc',
        'tidal basin cherry blossoms',
        'smithsonian museum',
        'union station washington',
        'u street corridor dc',
        'decades bar dc',
        'union market dc',
        'h street dc'
    ],
    'chicago': [
        'millennium park chicago',
        'chicago bean cloudgate',
        'wrigley field cubs',
        'chicago riverwalk',
        'navy pier chicago',
        'magnificent mile',
        'lincoln park chicago',
        'chicago theater sign',
        'lake michigan chicago',
        'wicker park chicago',
        'logan square improv',
        'logan square chicago',
        'lincoln park zoo',
        'chicago cubs wrigley field',
        'chicago cta train car',
        'chicago metra train'
    ]
}

# Image cache (in-memory for speed, persisted to disk)
_image_cache = {}
_cache_file = 'static/data/image_cache.json'
_cache_lock = False

# Visit counter + visitor locations
# DATA_DIR can be set to a Railway Volume mount path (e.g. /data) for persistence across deploys
_visit_count = 0
_data_dir = os.getenv('DATA_DIR', 'static/data')
_visits_file = os.path.join(_data_dir, 'visits.json')
_locations_file = os.path.join(_data_dir, 'visitor_locations.json')
_visitor_locations = []
_locations_lock = threading.Lock()

def load_visit_count():
    """Load visit count from disk"""
    global _visit_count
    try:
        if os.path.exists(_visits_file):
            with open(_visits_file, 'r') as f:
                data = json.load(f)
                _visit_count = data.get('count', 0)
    except:
        _visit_count = 0

def increment_visit_count():
    """Increment and persist the visit count, always reading file first to prevent data loss"""
    global _visit_count
    try:
        os.makedirs(os.path.dirname(_visits_file), exist_ok=True)
        current = 0
        if os.path.exists(_visits_file):
            with open(_visits_file, 'r') as f:
                current = json.load(f).get('count', 0)
        current += 1
        _visit_count = current
        with open(_visits_file, 'w') as f:
            json.dump({'count': current}, f)
    except:
        _visit_count += 1

def load_visitor_locations():
    """Load visitor locations from disk"""
    global _visitor_locations
    try:
        if os.path.exists(_locations_file):
            with open(_locations_file, 'r') as f:
                data = json.load(f)
                _visitor_locations = data.get('locations', [])
    except:
        _visitor_locations = []

def save_visitor_location(entry):
    """Append a location entry and persist to disk, always reading file first to prevent data loss"""
    global _visitor_locations
    with _locations_lock:
        try:
            os.makedirs(os.path.dirname(_locations_file), exist_ok=True)
            # Read current file contents before writing so no worker can overwrite another's data
            current = []
            if os.path.exists(_locations_file):
                with open(_locations_file, 'r') as f:
                    current = json.load(f).get('locations', [])
            current.append(entry)
            with open(_locations_file, 'w') as f:
                json.dump({'locations': current}, f)
            _visitor_locations = current
        except:
            pass

def get_real_ip():
    """Get the real client IP, accounting for Railway's proxy"""
    from flask import request
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr

def is_private_ip(ip):
    """Return True for localhost / private network IPs"""
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return True

def geolocate_and_save(ip):
    """Geolocate an IP via ipinfo.io and save the approximate location (runs in background thread)"""
    try:
        resp = requests.get(f'https://ipinfo.io/{ip}/json', timeout=5)
        if resp.status_code != 200:
            return
        data = resp.json()
        loc = data.get('loc', '')
        if not loc:
            return
        lat_str, lon_str = loc.split(',')
        # Round to 1 decimal place (~11 km) for anonymization — no raw IPs stored
        lat = round(float(lat_str), 1)
        lon = round(float(lon_str), 1)
        entry = {
            'lat': lat,
            'lon': lon,
            'city': data.get('city', ''),
            'country': data.get('country', '')
        }
        save_visitor_location(entry)
    except:
        pass

def load_image_cache():
    """Load cached images from disk"""
    global _image_cache
    try:
        if os.path.exists(_cache_file):
            with open(_cache_file, 'r') as f:
                _image_cache = json.load(f)
    except:
        _image_cache = {}

def save_image_cache():
    """Save image cache to disk"""
    try:
        os.makedirs(os.path.dirname(_cache_file), exist_ok=True)
        with open(_cache_file, 'w') as f:
            json.dump(_image_cache, f)
    except:
        pass

def fetch_unsplash_images(query, count=10):
    """Fetch images from Unsplash API for a query with randomness"""
    if not UNSPLASH_ACCESS_KEY:
        return []

    try:
        url = 'https://api.unsplash.com/search/photos'
        # Add randomness by selecting a random page (1-3)
        random_page = random.randint(1, 3)
        params = {
            'query': query,
            'per_page': count,
            'page': random_page,
            'orientation': 'landscape',
            'content_filter': 'high',
            'order_by': random.choice(['relevant', 'latest'])  # Mix up ordering
        }
        headers = {'Authorization': f'Client-ID {UNSPLASH_ACCESS_KEY}'}
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()

        # Extract image URLs with their IDs for deduplication
        images = []
        for photo in data.get('results', []):
            photo_id = photo.get('id', '')
            urls = photo.get('urls', {})
            img_url = urls.get('regular') or urls.get('small')
            if img_url and photo_id:
                # Include photo_id in tuple for deduplication
                images.append((photo_id, img_url))
        return images
    except Exception as e:
        print(f"Error fetching Unsplash images for '{query}': {e}")
        return []

def get_dynamic_images_for_city(city):
    """Get dynamic images for a city, using cache if available"""
    global _image_cache, _cache_lock

    cache_key = f'dynamic_{city}'
    cache_time_key = f'dynamic_{city}_time'

    # Check if cache is fresh (less than 1 hour old)
    if cache_key in _image_cache:
        cache_time = _image_cache.get(cache_time_key, 0)
        if time.time() - cache_time < 3600:  # 1 hour cache
            return _image_cache[cache_key]

    # Prevent concurrent fetches
    if _cache_lock:
        return _image_cache.get(cache_key, [])

    _cache_lock = True

    try:
        queries = CITY_SEARCH_QUERIES.get(city, [city])
        all_images = []

        # Shuffle queries for variety each time
        shuffled_queries = queries.copy()
        random.shuffle(shuffled_queries)

        # Fetch images from multiple queries in parallel
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = {executor.submit(fetch_unsplash_images, q, 8): q for q in shuffled_queries}
            for future in as_completed(futures):
                images = future.result()
                all_images.extend(images)

        # Remove duplicates by photo ID and limit to 50 images
        seen_ids = set()
        unique_images = []
        for item in all_images:
            if isinstance(item, tuple) and len(item) == 2:
                photo_id, img_url = item
                if photo_id not in seen_ids:
                    seen_ids.add(photo_id)
                    unique_images.append(img_url)
            elif isinstance(item, str):
                # Fallback for old format
                if item not in seen_ids:
                    seen_ids.add(item)
                    unique_images.append(item)

            if len(unique_images) >= 50:
                break

        # Shuffle for variety
        random.shuffle(unique_images)

        # Cache the results (just URLs, not IDs)
        _image_cache[cache_key] = unique_images
        _image_cache[cache_time_key] = time.time()
        save_image_cache()

        return unique_images
    finally:
        _cache_lock = False

# Load cache, visit count, and visitor locations on startup
load_image_cache()
load_visit_count()
load_visitor_locations()

@app.before_request
def count_visit():
    """Increment visit counter once per browser session and geolocate in background"""
    from flask import request, session
    # Only count HTML page requests, not API calls or static files
    if not request.path.startswith('/api/') and not request.path.startswith('/static/'):
        if not session.get('visited'):
            session['visited'] = True
            session.permanent = False  # expires when browser closes
            increment_visit_count()
            # Geolocate in background — never blocks the page load
            ip = get_real_ip()
            if ip and not is_private_ip(ip):
                threading.Thread(target=geolocate_and_save, args=(ip,), daemon=True).start()

@app.context_processor
def inject_feature_flags():
    """Make feature flags available to all templates"""
    return {
        'show_game': SHOW_GAME,
        'show_resume': SHOW_RESUME,
        'show_blog': SHOW_BLOG,
        'dynamic_images': DYNAMIC_IMAGES,
        'visit_count': _visit_count
    }

# Image extensions to look for
IMAGE_EXTENSIONS = ['*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.webp']

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

    # Path to project images folder
    project_folder = os.path.join('static', 'images', 'projects', folder_name, project_id)

    images = []
    if os.path.exists(project_folder):
        for ext in IMAGE_EXTENSIONS:
            pattern = os.path.join(project_folder, ext)
            for filepath in glob.glob(pattern):
                # Get path relative to static folder
                rel_path = os.path.relpath(filepath, 'static').replace('\\', '/')
                # Exclude the icon image from gallery
                if icon_image and os.path.basename(filepath) != icon_image:
                    images.append(rel_path)

    return sorted(images)

def get_icon_image_path(category, project_id, icon_image):
    """
    Get the icon image path. First checks project folder, then falls back to root images folder.
    """
    folder_map = {
        'personal': 'personal',
        'academic': 'academic'
    }
    folder_name = folder_map.get(category, 'personal')

    # First check in project folder
    project_icon_path = os.path.join('static', 'images', 'projects', folder_name, project_id, icon_image)
    if os.path.exists(project_icon_path):
        return f'images/projects/{folder_name}/{project_id}/{icon_image}'

    # Fall back to root images folder (for backward compatibility)
    root_icon_path = os.path.join('static', 'images', icon_image)
    if os.path.exists(root_icon_path):
        return f'images/{icon_image}'

    # Return the project folder path even if it doesn't exist yet
    return f'images/projects/{folder_name}/{project_id}/{icon_image}'

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
                         page_id='home-page',
                         collage_density='minimal',
                         collage_layout='ambient',
                         dynamic_images=False)

@app.route('/about')
def about():
    return render_template('about.html',
                         active_page='about',
                         page_id='about-page',
                         collage_density='medium')

@app.route('/game')
def game():
    return render_template('game.html',
                         active_page='game',
                         page_id='game-page',
                         collage_density='minimal')

@app.route('/projects/personal')
def personal_projects():
    projects = load_projects()
    personal = enrich_project_list(projects.get('personal', []), 'personal')
    grouped = group_personal_projects(personal)
    return render_template('projects/personal.html',
                         grouped_projects=grouped,
                         active_page='personal',
                         page_id='personal-projects-page',
                         collage_density='high')

@app.route('/projects/academic')
def academic_projects():
    projects = load_projects()
    academic = enrich_project_list(projects.get('academic', []), 'academic')
    grouped = group_academic_projects(academic)
    return render_template('projects/academic.html',
                         grouped_projects=grouped,
                         active_page='academic',
                         page_id='academic-projects-page',
                         collage_density='high')

@app.route('/projects/<project_id>')
def project_detail(project_id):
    project = get_project_by_id(project_id)
    if not project:
        abort(404)

    category = project.get('category', 'personal')

    return render_template('projects/detail.html',
                         project=project,
                         active_page=category,
                         page_id='project-detail-page',
                         collage_density='minimal')

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

@app.route('/api/reset-visitors', methods=['POST'])
def reset_visitors():
    """Reset visit counter and location data. Requires ADMIN_KEY."""
    from flask import request
    admin_key = os.getenv('ADMIN_KEY', '')
    provided = request.headers.get('X-Admin-Key', '')
    if not admin_key or provided != admin_key:
        return jsonify({'error': 'unauthorized'}), 401
    global _visit_count, _visitor_locations
    _visit_count = 0
    _visitor_locations = []
    try:
        os.makedirs(os.path.dirname(_visits_file), exist_ok=True)
        with open(_visits_file, 'w') as f:
            json.dump({'count': 0}, f)
        with open(_locations_file, 'w') as f:
            json.dump({'locations': []}, f)
    except:
        pass
    return jsonify({'status': 'reset', 'visits': 0, 'locations': 0})

@app.route('/api/visitor-locations')
def visitor_locations_api():
    """Return all visitor locations for the map"""
    # Read visit count fresh from file so all gunicorn workers agree on the same number
    authoritative_count = _visit_count
    try:
        if os.path.exists(_visits_file):
            with open(_visits_file, 'r') as f:
                authoritative_count = json.load(f).get('count', _visit_count)
    except:
        pass
    unique_countries = len(set(loc['country'] for loc in _visitor_locations if loc.get('country')))
    return jsonify({
        'locations': _visitor_locations,
        'total_visits': authoritative_count,
        'unique_countries': unique_countries
    })

@app.route('/visitors')
def visitors():
    unique_countries = len(set(loc['country'] for loc in _visitor_locations if loc.get('country')))
    return render_template('visitors.html',
                         active_page='visitors',
                         page_id='visitors-page',
                         collage_density='minimal',
                         total_visits=_visit_count,
                         unique_countries=unique_countries,
                         location_count=len(_visitor_locations))

@app.route('/api/images/<city>')
def get_city_images(city):
    """Get images for a city - dynamic from Unsplash or static from local files"""
    if city not in ['baltimore', 'dc', 'chicago']:
        return jsonify({"error": "Invalid city"}), 400

    if DYNAMIC_IMAGES and UNSPLASH_ACCESS_KEY:
        images = get_dynamic_images_for_city(city)
        if images:
            return jsonify({"images": images, "source": "dynamic"})

    # Fallback to static images - return empty to use frontend defaults
    return jsonify({"images": [], "source": "static"})

@app.route('/api/images/prefetch')
def prefetch_all_images():
    """Prefetch dynamic images for all cities (call on page load for faster switching)"""
    if not DYNAMIC_IMAGES or not UNSPLASH_ACCESS_KEY:
        return jsonify({"status": "disabled"})

    result = {}
    for city in ['baltimore', 'dc', 'chicago']:
        images = get_dynamic_images_for_city(city)
        result[city] = len(images)

    return jsonify({"status": "ok", "counts": result})

@app.route('/lyrics')
def all_lyrics():
    with open('static/data/lyrics.json', 'r') as f:
        lyrics_data = json.load(f)
    return render_template('lyrics/all.html',
                         lyrics=lyrics_data,
                         active_page='lyrics',
                         page_id='lyrics-page',
                         collage_density='medium')

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
                         page_id='blog-page',
                         collage_density='medium')

@app.route('/blog/<post_id>')
def blog_post(post_id):
    posts = load_blog_posts()
    post = next((p for p in posts if p.get('id') == post_id), None)
    if not post:
        abort(404)
    return render_template('blog/post.html',
                         post=post,
                         active_page='blog',
                         page_id='blog-post-page',
                         collage_density='minimal')

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html',
                         page_id='error-page',
                         collage_density='minimal'), 404

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
