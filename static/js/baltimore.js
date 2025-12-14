(() => {
  const IMGS = (window.BMORE_IMAGES && window.BMORE_IMAGES.length)
    ? window.BMORE_IMAGES
    : [
        "/static/images/baltimore/harbor.jpg",
        "/static/images/baltimore/skyline.jpg",
        "/static/images/baltimore/rowhouses.jpg",
        "/static/images/baltimore/domino.jpg",
        "/static/images/baltimore/boh.jpg",
        "/static/images/baltimore/observe.jpg",
        "/static/images/baltimore/fedhill.jpg",
        "/static/images/baltimore/scottkey.jpg",
        "/static/images/baltimore/camden.jpg",
        "/static/images/baltimore/powerplant.jpg",
        "/static/images/baltimore/pickles.jpg",
        "/static/images/baltimore/mchenry.jpg",
        "/static/images/baltimore/homewood.jpg",
        "/static/images/baltimore/charles.jpg",
        "/static/images/baltimore/canton_gate.jpg",
        "/static/images/baltimore/red.jpg"
      ];

  let root = document.getElementById('bmore-collage');
  if (!root) {
    root = document.createElement('div');
    root.id = 'bmore-collage';
    document.body.appendChild(root);
  }

  const TILE_COUNT = 20;
  const spanClasses = ['','w2','w3','h2'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rand = a => a[Math.floor(Math.random() * a.length)];

  function setTileImage(tile, url) {
    tile.dataset.img = url;                 // store the chosen image
    tile.style.backgroundImage = `url("${url}")`;
  }

  function pickImageNotIn(excludeSet) {
    if (excludeSet.size >= IMGS.length) return rand(IMGS); // fallback
    let url;
    do { url = rand(IMGS); } while (excludeSet.has(url));
    return url;
  }

  function rectsTouch(a, b, tol = 10) {
    // "touching" / adjacent-ish (accounts for grid gaps)
    const horizTouch =
      Math.abs(a.right - b.left) <= tol || Math.abs(b.right - a.left) <= tol;
    const vertOverlap = a.bottom > b.top + tol && a.top < b.bottom - tol;

    const vertTouch =
      Math.abs(a.bottom - b.top) <= tol || Math.abs(b.bottom - a.top) <= tol;
    const horizOverlap = a.right > b.left + tol && a.left < b.right - tol;

    return (horizTouch && vertOverlap) || (vertTouch && horizOverlap);
  }

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

        // collect images of touching neighbors
        const neighborImgs = new Set();
        for (let j = 0; j < tiles.length; j++) {
          if (i === j) continue;
          if (rectsTouch(rects[i], rects[j])) {
            const nImg = tiles[j].dataset.img;
            if (nImg) neighborImgs.add(nImg);
          }
        }

        // if any neighbor shares my image, re-roll mine to something not used by neighbors
        if (neighborImgs.has(myImg)) {
          const exclude = new Set(neighborImgs);
          exclude.add(myImg);
          setTileImage(t, pickImageNotIn(exclude));
          changed = true;
        }
      }

      if (!changed) break; // stable
    }
  }

  function buildTiles() {
    root.innerHTML = '';
    for (let i = 0; i < TILE_COUNT; i++) {
      const t = document.createElement('div');
      t.className = `tile ${Math.random() < 0.35 ? rand(spanClasses) : ''}`;
      setTileImage(t, rand(IMGS));
      t.style.transform = `rotate(${(Math.random() * 2 - 1)}deg)`;
      root.appendChild(t);
    }

    // wait for layout, then fix adjacency
    requestAnimationFrame(() => fixAdjacentDuplicates());
  }

  function shuffleSome() {
    const tiles = Array.from(root.querySelectorAll('.tile'));
    const n = Math.max(3, Math.floor(tiles.length * 0.2));

    for (let i = 0; i < n; i++) {
      const tile = rand(tiles);
      tile.style.opacity = '0';

      setTimeout(() => {
        // when swapping, avoid matching any touching neighbors
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

        // optional: do a quick global clean-up after shuffles
        requestAnimationFrame(() => fixAdjacentDuplicates(2));
      }, 450);
    }
  }

  buildTiles();
  if (!reduceMotion) setInterval(shuffleSome, 45000);
})();
