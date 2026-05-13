/* Visitors page: render the Leaflet world map and fill the headline stats.
 * Depends on Leaflet (loaded separately) and #visitor-map being on the page.
 */
(function () {
  if (typeof L === 'undefined' || !document.getElementById('visitor-map')) return;

  var map = L.map('visitor-map', {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 10,
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: true,
    scrollWheelZoom: true
  });
  var markerLayer = L.layerGroup().addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  function pinIcon(count) {
    var multi = count > 1;
    var size = multi ? 32 : 26;
    var box = Math.ceil(size * 1.42);
    var inner = multi
      ? '<div class="visitor-pin visitor-pin--multi"><span>' + count + '</span></div>'
      : '<div class="visitor-pin"></div>';
    return L.divIcon({
      html: inner,
      className: 'visitor-pin-wrapper',
      iconSize: [box, box],
      iconAnchor: [Math.round(box / 2), box]
    });
  }

  fetch('/api/visitor-locations')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var loading = document.getElementById('map-loading');
      if (loading) loading.style.display = 'none';

      var totalVisits = data.total_visits || 0;
      var formatted = totalVisits.toLocaleString();
      var sv = document.getElementById('stat-visits');
      var sl = document.getElementById('stat-locations');
      var sc = document.getElementById('stat-countries');
      if (sv) sv.textContent = formatted;
      if (sl) sl.textContent = (data.locations || []).length.toLocaleString();
      if (sc) sc.textContent = data.unique_countries || 0;

      var footerCounter = document.querySelector('.visit-counter');
      if (footerCounter) {
        footerCounter.innerHTML = '<i class="fas fa-eye"></i> ' + formatted + ' visits';
      }

      var groups = {};
      (data.locations || []).forEach(function (loc) {
        var key = loc.lat + ',' + loc.lon;
        if (!groups[key]) {
          groups[key] = { lat: loc.lat, lon: loc.lon, city: loc.city, country: loc.country, count: 0 };
        }
        groups[key].count++;
      });

      var bounds = [];
      Object.keys(groups).forEach(function (key) {
        var g = groups[key];
        var label = [g.city, g.country].filter(Boolean).join(', ') || 'Unknown';
        var visits = g.count === 1 ? '1 visit' : g.count.toLocaleString() + ' visits';
        var popup = '<div class="map-popup"><i class="fas fa-map-marker-alt"></i> ' + label + '<br><small>' + visits + '</small></div>';
        var point = [g.lat, g.lon];
        bounds.push(point);
        L.marker(point, { icon: pinIcon(g.count) }).bindPopup(popup).addTo(markerLayer);
      });

      if (bounds.length) {
        map.fitBounds(bounds, { padding: [42, 42], maxZoom: 4 });
      }
      window.setTimeout(function () { map.invalidateSize(); }, 0);
    })
    .catch(function () {
      var loading = document.getElementById('map-loading');
      if (loading) {
        loading.innerHTML = '<i class="fas fa-exclamation-circle"></i> Could not load locations.';
      }
    });
})();
