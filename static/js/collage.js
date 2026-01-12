/**
 * City Collage System
 * Manages background collages and theme switching between cities
 * Easy to extend: just add more cities to CITY_CONFIG
 */

(() => {
  // ============================================
  // CITY CONFIGURATION - Easy to extend!
  // Add new cities here with their images and theme colors
  // ============================================
  const CITY_CONFIG = {
    baltimore: {
      name: 'Baltimore',
      primary: '#ff6a00',      // Orioles orange
      primary600: '#ff5c00',
      primary700: '#ef4b00',
      ring: 'rgba(255,106,0,.35)',
      accentLight: '#ffd2bf',
      // Images array - add more paths as needed
      images: window.BALTIMORE_IMAGES || []
    },
    dc: {
      name: 'DC',
      primary: '#c41e3a',      // DC United red / Capitals red
      primary600: '#b01830',
      primary700: '#9a1528',
      ring: 'rgba(196,30,58,.35)',
      accentLight: '#f5c6ce',
      images: window.DC_IMAGES || []
    },
    chicago: {
      name: 'Chicago',
      primary: '#41b6e6',      // Chicago light blue / Cubs-ish
      primary600: '#35a5d4',
      primary700: '#2994c2',
      ring: 'rgba(65,182,230,.35)',
      accentLight: '#c5e8f7',
      images: window.CHICAGO_IMAGES || []
    }
  };

  // ============================================
  // COLLAGE SETTINGS
  // ============================================
  const DENSITY_LEVELS = {
    minimal: 6,
    low: 10,
    medium: 15,
    high: 22
  };
  let TILE_COUNT = 20;
  const SPAN_CLASSES = ['', 'w2', 'w3', 'h2'];
  const SHUFFLE_INTERVAL = 45000; // ms between random tile swaps
  const STORAGE_KEY = 'selectedCity';

  /**
   * Set collage density based on page configuration
   */
  function setDensity(level) {
    const density = DENSITY_LEVELS[level] || DENSITY_LEVELS.medium;
    TILE_COUNT = density;

    // Adjust opacity based on density
    const opacityMap = {
      minimal: 0.15,
      low: 0.18,
      medium: 0.22,
      high: 0.25
    };
    document.documentElement.style.setProperty('--collage-opacity', opacityMap[level] || 0.22);

    return density;
  }

  /**
   * Initialize density from body data attribute
   */
  function initDensity() {
    const body = document.body;
    const densityAttr = body.dataset.collageDensity || 'medium';
    setDensity(densityAttr);
  }

  // ============================================
  // STATE
  // ============================================
  let currentCity = 'baltimore';
  let root = null;
  let shuffleTimer = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];

  function getImages() {
    return CITY_CONFIG[currentCity]?.images || [];
  }

  function setTileImage(tile, url) {
    tile.dataset.img = url;
    tile.style.backgroundImage = `url("${url}")`;
  }

  function pickImageNotIn(excludeSet) {
    const imgs = getImages();
    if (excludeSet.size >= imgs.length) return rand(imgs);
    let url;
    do { url = rand(imgs); } while (excludeSet.has(url));
    return url;
  }

  function rectsTouch(a, b, tol = 10) {
    const horizTouch = Math.abs(a.right - b.left) <= tol || Math.abs(b.right - a.left) <= tol;
    const vertOverlap = a.bottom > b.top + tol && a.top < b.bottom - tol;
    const vertTouch = Math.abs(a.bottom - b.top) <= tol || Math.abs(b.bottom - a.top) <= tol;
    const horizOverlap = a.right > b.left + tol && a.left < b.right - tol;
    return (horizTouch && vertOverlap) || (vertTouch && horizOverlap);
  }

  // ============================================
  // DUPLICATE ADJACENCY FIX
  // ============================================
  function fixAdjacentDuplicates(maxPasses = 6) {
    const tiles = Array.from(root.querySelectorAll('.tile'));
    if (tiles.length < 2) return;

    for (let pass = 0; pass < maxPasses; pass++) {
      const rects = tiles.map(t => t.getBoundingClientRect());
      let changed = false;

      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const myImg = t.dataset.img;
        if (!myImg) continue;

        const neighborImgs = new Set();
        for (let j = 0; j < tiles.length; j++) {
          if (i === j) continue;
          if (rectsTouch(rects[i], rects[j])) {
            const nImg = tiles[j].dataset.img;
            if (nImg) neighborImgs.add(nImg);
          }
        }

        if (neighborImgs.has(myImg)) {
          const exclude = new Set(neighborImgs);
          exclude.add(myImg);
          setTileImage(t, pickImageNotIn(exclude));
          changed = true;
        }
      }

      if (!changed) break;
    }
  }

  // ============================================
  // BUILD / REBUILD TILES
  // ============================================
  function buildTiles() {
    const imgs = getImages();
    if (!imgs.length) {
      console.warn(`No images configured for city: ${currentCity}`);
      return;
    }

    root.innerHTML = '';
    for (let i = 0; i < TILE_COUNT; i++) {
      const t = document.createElement('div');
      t.className = `tile ${Math.random() < 0.35 ? rand(SPAN_CLASSES) : ''}`;
      setTileImage(t, rand(imgs));
      t.style.transform = `rotate(${(Math.random() * 2 - 1)}deg)`;
      root.appendChild(t);
    }

    requestAnimationFrame(() => fixAdjacentDuplicates());
  }

  // ============================================
  // SHUFFLE SOME TILES PERIODICALLY
  // ============================================
  function shuffleSome() {
    const tiles = Array.from(root.querySelectorAll('.tile'));
    const n = Math.max(3, Math.floor(tiles.length * 0.2));

    for (let i = 0; i < n; i++) {
      const tile = rand(tiles);
      tile.style.opacity = '0';

      setTimeout(() => {
        const rect = tile.getBoundingClientRect();
        const neighborImgs = new Set();
        for (const other of tiles) {
          if (other === tile) continue;
          if (rectsTouch(rect, other.getBoundingClientRect())) {
            if (other.dataset.img) neighborImgs.add(other.dataset.img);
          }
        }

        setTileImage(tile, pickImageNotIn(neighborImgs));
        tile.style.transform = `rotate(${(Math.random() * 2 - 1)}deg)`;
        tile.style.opacity = '0.9';

        requestAnimationFrame(() => fixAdjacentDuplicates(2));
      }, 450);
    }
  }

  // ============================================
  // THEME APPLICATION
  // ============================================
  function applyTheme(cityKey) {
    const config = CITY_CONFIG[cityKey];
    if (!config) return;

    const r = document.documentElement;
    r.style.setProperty('--primary', config.primary);
    r.style.setProperty('--primary-600', config.primary600);
    r.style.setProperty('--primary-700', config.primary700);
    r.style.setProperty('--ring', config.ring);
    r.style.setProperty('--accent-light', config.accentLight);

    // Update body data attribute for CSS hooks
    document.body.dataset.city = cityKey;
  }

  // ============================================
  // CITY SWITCHING
  // ============================================
  function switchCity(cityKey) {
    if (!CITY_CONFIG[cityKey]) {
      console.warn(`Unknown city: ${cityKey}`);
      return;
    }

    currentCity = cityKey;

    // Persist selection
    try {
      localStorage.setItem(STORAGE_KEY, cityKey);
    } catch (e) {
      // localStorage may be unavailable
    }

    // Apply theme colors
    applyTheme(cityKey);

    // Rebuild collage with new images
    buildTiles();

    // Update slider UI
    updateSliderUI(cityKey);
  }

  function updateSliderUI(cityKey) {
    const slider = document.getElementById('city-slider');
    const options = document.querySelectorAll('.city-option');
    
    if (slider) {
      const cities = Object.keys(CITY_CONFIG);
      const index = cities.indexOf(cityKey);
      if (index !== -1) {
        slider.value = index;
      }
    }

    // Update active state on city options (flags + labels)
    options.forEach(option => {
      option.classList.toggle('active', option.dataset.city === cityKey);
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  function init() {
    // Initialize density from page data attribute
    initDensity();

    // Create or get collage root
    root = document.getElementById('bmore-collage');
    if (!root) {
      root = document.createElement('div');
      root.id = 'bmore-collage';
      document.body.appendChild(root);
    }

    // Load saved city preference
    let savedCity = 'baltimore';
    try {
      savedCity = localStorage.getItem(STORAGE_KEY) || 'baltimore';
    } catch (e) {
      // localStorage may be unavailable
    }

    // Validate saved city exists
    if (!CITY_CONFIG[savedCity]) {
      savedCity = 'baltimore';
    }

    currentCity = savedCity;

    // Apply theme and build
    applyTheme(currentCity);
    buildTiles();
    updateSliderUI(currentCity);

    // Start shuffle timer
    if (!reduceMotion) {
      if (shuffleTimer) clearInterval(shuffleTimer);
      shuffleTimer = setInterval(shuffleSome, SHUFFLE_INTERVAL);
    }
  }

  // ============================================
  // EXPOSE API
  // ============================================
  window.CityCollage = {
    switchCity,
    getCurrentCity: () => currentCity,
    getCityConfig: () => CITY_CONFIG,
    rebuild: buildTiles,
    setDensity,
    getDensityLevels: () => DENSITY_LEVELS
  };

  // Initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();