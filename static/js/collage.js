/**
 * City Collage System
 * Manages background collages and theme switching between cities
 * Supports both static and dynamic (Unsplash) images
 */

(() => {
  // ============================================
  // CITY CONFIGURATION
  // ============================================
  const CITY_CONFIG = {
    baltimore: {
      name: 'Baltimore',
      primary: '#ff6a00',      // Orioles orange
      primary600: '#ff5c00',
      primary700: '#ef4b00',
      ring: 'rgba(255,106,0,.35)',
      accentLight: '#ffd2bf',
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
  // DYNAMIC IMAGE CACHE
  // ============================================
  const dynamicImageCache = {
    baltimore: null,
    dc: null,
    chicago: null
  };
  let dynamicImagesEnabled = window.DYNAMIC_IMAGES_ENABLED || false;
  let prefetchInProgress = false;

  // ============================================
  // COLLAGE SETTINGS
  // ============================================
  const DENSITY_LEVELS = {
    minimal: 12,
    low: 18,
    medium: 24,
    high: 36
  };
  let TILE_COUNT = 24;
  // Reduced span classes to fill more consistently (fewer large tiles = fewer gaps)
  const SPAN_CLASSES = ['', '', '', 'w2', 'h2'];
  const SHUFFLE_INTERVAL = 45000;
  const STORAGE_KEY = 'selectedCity';

  /**
   * Fetch dynamic images for a city from the API
   */
  async function fetchDynamicImages(city) {
    if (dynamicImageCache[city]) {
      return dynamicImageCache[city];
    }

    try {
      const response = await fetch(`/api/images/${city}`);
      const data = await response.json();

      if (data.images && data.images.length > 0) {
        dynamicImageCache[city] = data.images;
        // Also update the city config for immediate use
        CITY_CONFIG[city].dynamicImages = data.images;
        return data.images;
      }
    } catch (e) {
      console.warn(`Failed to fetch dynamic images for ${city}:`, e);
    }

    return null;
  }

  /**
   * Prefetch dynamic images for all cities
   */
  async function prefetchAllDynamicImages() {
    if (!dynamicImagesEnabled || prefetchInProgress) return;

    prefetchInProgress = true;

    try {
      // Fetch all cities in parallel
      await Promise.all([
        fetchDynamicImages('baltimore'),
        fetchDynamicImages('dc'),
        fetchDynamicImages('chicago')
      ]);
    } catch (e) {
      console.warn('Failed to prefetch dynamic images:', e);
    } finally {
      prefetchInProgress = false;
    }
  }

  /**
   * Set collage density based on page configuration
   */
  function setDensity(level) {
    const density = DENSITY_LEVELS[level] || DENSITY_LEVELS.medium;
    TILE_COUNT = density;

    const opacityMap = {
      minimal: 0.15,
      low: 0.18,
      medium: 0.22,
      high: 0.25
    };
    document.documentElement.style.setProperty('--collage-opacity', opacityMap[level] || 0.22);

    return density;
  }

  function initDensity() {
    const body = document.body;
    const densityAttr = body.dataset.collageDensity || 'medium';
    setDensity(densityAttr);
  }

  // ============================================
  // STATE
  // ============================================
  let currentCity = (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CITY_CONFIG[saved]) {
        return saved;
      }
    } catch (e) {}
    return 'baltimore';
  })();
  let root = null;
  let shuffleTimer = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];

  function getImages() {
    const config = CITY_CONFIG[currentCity];
    if (!config) return [];

    const staticImages = config.images || [];

    // Combine dynamic and static images when both are available
    if (dynamicImagesEnabled && dynamicImageCache[currentCity]) {
      return [...staticImages, ...dynamicImageCache[currentCity]];
    }

    // Fall back to static images only
    return staticImages;
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

    document.body.dataset.city = cityKey;
  }

  // ============================================
  // CITY SWITCHING
  // ============================================
  async function switchCity(cityKey) {
    if (!CITY_CONFIG[cityKey]) {
      console.warn(`Unknown city: ${cityKey}`);
      return;
    }

    currentCity = cityKey;

    try {
      localStorage.setItem(STORAGE_KEY, cityKey);
    } catch (e) {}

    applyTheme(cityKey);

    // If dynamic images enabled, ensure we have them cached
    if (dynamicImagesEnabled && !dynamicImageCache[cityKey]) {
      await fetchDynamicImages(cityKey);
    }

    buildTiles();
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

    options.forEach(option => {
      option.classList.toggle('active', option.dataset.city === cityKey);
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  async function init() {
    initDensity();

    root = document.getElementById('bmore-collage');
    if (!root) {
      root = document.createElement('div');
      root.id = 'bmore-collage';
      document.body.appendChild(root);
    }

    applyTheme(currentCity);

    // If dynamic images enabled, fetch them before building
    if (dynamicImagesEnabled) {
      // Fetch current city images first for fast initial render
      await fetchDynamicImages(currentCity);
      buildTiles();
      updateSliderUI(currentCity);

      // Then prefetch other cities in background
      prefetchAllDynamicImages();
    } else {
      buildTiles();
      updateSliderUI(currentCity);
    }

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
    getDensityLevels: () => DENSITY_LEVELS,
    prefetchImages: prefetchAllDynamicImages,
    isDynamicEnabled: () => dynamicImagesEnabled
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
