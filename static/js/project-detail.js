/* Project detail page: image lightbox + most-recent Lichess game embed.
 * Reads its config from <script type="application/json" id="project-detail-data">
 */
(function () {
  var dataEl = document.getElementById('project-detail-data');
  if (!dataEl) return;

  var cfg = {};
  try { cfg = JSON.parse(dataEl.textContent || '{}'); } catch (e) { cfg = {}; }

  var images = Array.isArray(cfg.images) ? cfg.images : [];
  var lichessUser = cfg.lichessUser || '';
  var currentIndex = 0;
  var lightbox = document.getElementById('lightbox');
  var imgEl = document.getElementById('lightbox-img');
  var counter = document.getElementById('lightbox-counter');
  var prevBtn = document.querySelector('.lightbox-prev');
  var nextBtn = document.querySelector('.lightbox-next');

  function update() {
    if (!imgEl || !counter) return;
    imgEl.src = images[currentIndex];
    counter.textContent = (currentIndex + 1) + ' / ' + images.length;
    var hide = images.length <= 1;
    if (prevBtn) prevBtn.style.display = hide ? 'none' : 'flex';
    if (nextBtn) nextBtn.style.display = hide ? 'none' : 'flex';
    counter.style.display = hide ? 'none' : 'block';
  }

  window.openLightbox = function (index) {
    if (!lightbox) return;
    currentIndex = index;
    update();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeLightbox = function () {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  };

  window.navigateLightbox = function (direction, evt) {
    if (evt) evt.stopPropagation();
    if (!images.length) return;
    currentIndex = (currentIndex + direction + images.length) % images.length;
    update();
  };

  document.addEventListener('keydown', function (e) {
    if (!lightbox || !lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') window.closeLightbox();
    if (e.key === 'ArrowLeft') window.navigateLightbox(-1);
    if (e.key === 'ArrowRight') window.navigateLightbox(1);
  });

  if (lichessUser) {
    var container = document.getElementById('lichess-embed-container');
    if (container) {
      fetch('https://lichess.org/api/games/user/' + encodeURIComponent(lichessUser) + '?max=1&pgnInJson=true', {
        headers: { 'Accept': 'application/x-ndjson' }
      })
        .then(function (response) { return response.text(); })
        .then(function (text) {
          var line = text.trim().split('\n')[0];
          if (!line) throw new Error('No games found');
          var game = JSON.parse(line);
          var gameId = game.id;
          if (!gameId) throw new Error('No game ID');
          container.innerHTML = '<iframe src="https://lichess.org/embed/game/' + gameId +
            '?theme=auto&bg=auto" width="100%" height="400" frameborder="0" allowtransparency="true" ' +
            'style="border-radius: 0; max-width: 600px;"></iframe>';
        })
        .catch(function () {
          container.innerHTML = '<p>Could not load the most recent game. ' +
            '<a href="https://lichess.org/@/' + encodeURIComponent(lichessUser) +
            '" target="_blank" rel="noopener noreferrer">View on Lichess</a></p>';
        });
    }
  }
})();
