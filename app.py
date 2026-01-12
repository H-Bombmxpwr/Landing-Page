from flask import Flask, render_template, jsonify, abort
import requests
import random
import json
import os
import glob

app = Flask(__name__)

# Image extensions to look for
IMAGE_EXTENSIONS = ['*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.webp']

def load_projects():
    """Load projects from JSON file"""
    with open('static/data/projects.json', 'r') as f:
        return json.load(f)

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
    subcategory_order = ['Websites', 'Mobile Applications', 'Other Software']

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
    return render_template('index.html',
                         featured_project=featured,
                         active_page='home',
                         page_id='home-page',
                         collage_density='low')

@app.route('/about')
def about():
    return render_template('about.html',
                         active_page='about',
                         page_id='about-page',
                         collage_density='medium')

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

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html',
                         page_id='error-page',
                         collage_density='minimal'), 404

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
