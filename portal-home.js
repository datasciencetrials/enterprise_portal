(() => {
  'use strict';
  const home = document.getElementById('portal-home');
  const workspace = document.getElementById('root');
  const openButton = document.getElementById('open-workspace');
  const mainTab = document.querySelector('.transport-tab.active');
  openButton.addEventListener('click', () => {
    home.hidden = true;
    workspace.hidden = false;
    mainTab.textContent = 'Portal home';
    mainTab.setAttribute('aria-label', 'Return to portal home');
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('resize'));
  });
  mainTab.addEventListener('click', event => {
    if (home.hidden) {
      event.preventDefault();
      home.hidden = false;
      workspace.hidden = true;
      mainTab.textContent = 'Main portal';
      mainTab.removeAttribute('aria-label');
      window.scrollTo(0, 0);
      setTimeout(() => map.invalidateSize(), 0);
    }
  });

  const map = L.map('portal-map', { preferCanvas: true, scrollWheelZoom: false, zoomControl: false }).setView([1.3, 32.3], 7);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Imagery: Esri and contributors',
  }).addTo(map);
  map.createPane('portalLabels');
  map.getPane('portalLabels').style.zIndex = 650;
  map.getPane('portalLabels').style.pointerEvents = 'none';
  const labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    pane: 'portalLabels', maxZoom: 19, attribution: 'Labels and borders: Esri',
  }).addTo(map);
  let tileErrors = 0;
  const status = document.getElementById('portal-map-status');
  for (const layer of [imagery, labels]) layer.on('tileerror', () => {
    tileErrors += 1;
    if (tileErrors === 1) status.textContent = 'Imagery unavailable; mapped lines remain visible';
  });

  let features = [];
  let roadLayer;
  const surfaceSelect = document.getElementById('portal-surface');
  const normaliseSurface = properties => {
    const raw = String(properties?.['Surface  1'] || '').toLowerCase();
    if (/bituminous|asphalt|concrete|paved/.test(raw)) return 'Paved';
    if (/gravel|earth|unpaved/.test(raw)) return 'Unpaved';
    return 'Not recorded';
  };
  function draw() {
    if (roadLayer) map.removeLayer(roadLayer);
    const visible = features.filter(feature => !surfaceSelect.value || normaliseSurface(feature.properties) === surfaceSelect.value);
    roadLayer = L.geoJSON(visible, {
      style: feature => ({ color: normaliseSurface(feature.properties) === 'Unpaved' ? '#ffc758' : '#43deed', weight: 2, opacity: .88 }),
      onEachFeature: (feature, layer) => {
        const panel = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = String(feature.properties?.['Link Name'] || feature.properties?.['Road No 1'] || 'Mapped road link');
        panel.append(name);
        const detail = document.createElement('p');
        detail.textContent = `Surface: ${normaliseSurface(feature.properties)}`;
        panel.append(detail);
        layer.bindPopup(panel);
      },
    }).addTo(map);
    document.getElementById('portal-visible-count').textContent = new Intl.NumberFormat('en-UG').format(visible.length);
    if (!tileErrors) status.textContent = `${visible.length} mapped links visible`;
  }
  surfaceSelect.addEventListener('change', draw);
  fetch('network.geojson').then(response => {
    if (!response.ok) throw new Error(`Road geometry returned ${response.status}`);
    return response.json();
  }).then(data => {
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid road geometry');
    features = data.features.filter(feature => feature.geometry && feature.properties);
    draw();
    const bounds = roadLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(.08));
  }).catch(() => { status.textContent = 'Mapped road geometry unavailable'; });
})();
