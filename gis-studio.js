(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const formatKm = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatCount = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  const filters = { search: '', region: '', surface: '', condition: '' };
  const map = L.map('gis-map', { zoomControl: false, preferCanvas: true, scrollWheelZoom: false }).setView([1.3, 32.3], 7);

  function syncZoomScale() {
    const z = map.getZoom();
    const scale = z <= 7 ? 0.32 : Math.min(1.25, 0.32 + Math.pow(Math.max(0, z - 7), 1.25) * 0.14);
    const roadScale = z <= 7 ? 1.0 : Math.min(3.2, 1.0 + Math.max(0, z - 7) * 0.35);
    document.documentElement.style.setProperty('--point-scale', scale.toFixed(3));
    map.getContainer().style.setProperty('--point-scale', scale.toFixed(3));
    map.getContainer().style.setProperty('--road-scale', roadScale.toFixed(2));
    if (roadLayer) roadLayer.setStyle(roadStyle);
  }
  map.on('zoom', syncZoomScale);
  map.on('zoomend', syncZoomScale);

  const mapContainer = map.getContainer();
  const ugandaExtent = L.latLngBounds([[-1.6, 29.4], [4.35, 35.2]]);
  const mapAspect = () => { const size = map.getSize(); return size.x / Math.max(1, size.y); };
  const showUgandaExtent = () => map.fitBounds(ugandaExtent, { padding: mapAspect() < .8 ? [12, 12] : [18, 18], maxZoom: 7, animate: false });
  const reportZoom = () => {
    const zoom = map.getZoom();
    mapContainer.dataset.zoom = String(zoom);
    mapContainer.style.setProperty('--structure-icon-size', `${zoom >= 9 ? 22 : zoom >= 8 ? 18 : 15}px`);
  };
  map.on('zoomend', reportZoom);
  reportZoom();
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  const basemapServices = {
    imagery: { service: 'World_Imagery', attribution: 'Imagery Hybrid: Esri and contributors' },
  };
  const basemapLayers = new Map(Object.entries(basemapServices).map(([key, config]) => [key,
    L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${config.service}/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 19, attribution: config.attribution,
    })
  ]));
  let activeBasemap = 'imagery';
  basemapLayers.get(activeBasemap).addTo(map);
  map.createPane('hybridLabels');
  map.getPane('hybridLabels').style.zIndex = 650;
  map.getPane('hybridLabels').style.pointerEvents = 'none';
  const labelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    pane: 'hybridLabels', maxZoom: 19, attribution: 'Labels and borders: Esri',
  });
  let showHybridLabels = true;
  function syncLabels() {
    const enabled = activeBasemap === 'imagery';
    if (enabled && showHybridLabels) labelsLayer.addTo(map);
    else map.removeLayer(labelsLayer);
    const tool = document.querySelector('[data-map-tool="labels"]');
    if (tool) {
      tool.disabled = !enabled;
      tool.setAttribute('aria-pressed', String(enabled && showHybridLabels));
    }
    if ($('workspace-labels')) {
      $('workspace-labels').disabled = !enabled;
      $('workspace-labels').checked = enabled && showHybridLabels;
    }
  }
  syncLabels();

  for (const button of document.querySelectorAll('[data-basemap]')) {
    button.addEventListener('click', () => {
      const choice = button.dataset.basemap;
      if (!basemapLayers.has(choice) || choice === activeBasemap) return;
      map.removeLayer(basemapLayers.get(activeBasemap));
      activeBasemap = choice;
      basemapLayers.get(choice).addTo(map).bringToBack();
      for (const option of document.querySelectorAll('[data-basemap]')) option.setAttribute('aria-pressed', String(option === button));
      syncLabels();
    });
  }

  map.createPane('allRoads');
  map.getPane('allRoads').style.zIndex = 390;
  map.getPane('allRoads').style.pointerEvents = 'none';
  let allRoadsOverlay = null;
  let allRoadsKind = '';
  let allRoadsLayout = '';
  let showExpandedRoads = true;
  fetch('geo/allroads-display.json?v=20261029-bms').then(async response => {
    if (!response.ok) throw new Error(`Backdrop returned ${response.status}`);
    const manifest = await response.json();
    if (manifest.crs !== 'EPSG:4326' || !Array.isArray(manifest.bounds)) throw new Error('Backdrop metadata mismatch');
    const refresh = () => {
      const layout = mapAspect() < .8 ? 'portrait' : 'landscape';
      const kind = map.getZoom() >= (layout === 'portrait' ? 8 : 9) ? 'detail' : 'overview';
      map.getContainer().dataset.aspect = layout;
      if (kind === allRoadsKind && layout === allRoadsLayout) return;
      if (allRoadsOverlay) map.removeLayer(allRoadsOverlay);
      allRoadsKind = kind;
      allRoadsLayout = layout;
      allRoadsOverlay = L.imageOverlay(`${manifest.images[kind]}?v=20261029-thin`, manifest.bounds, { pane: 'allRoads', opacity: layout === 'portrait' ? .82 : .86, interactive: false, alt: 'National and Regional road network geometry' });
      if (showExpandedRoads) allRoadsOverlay.addTo(map);
    };
    map.on('zoomend', refresh);
    map.on('resize', refresh);
    refresh();
  }).catch(() => {});

  let roadItems = [];
  let roadsLoaded = false;
  let roadLoadPromise = null;
  let roadLayer = null;
  syncZoomScale();
  let nationalContextLayer = null;
  let pointLayer = null;
  let activeMode = 'roads';
  let activeLayerVisible = true;
  const modeCache = new Map();

  const syncActiveLayer = () => {
    const layer = activeMode === 'roads' ? roadLayer : pointLayer;
    if (layer) activeLayerVisible ? layer.addTo(map) : map.removeLayer(layer);
    if ($('workspace-active-layer')) $('workspace-active-layer').checked = activeLayerVisible;
    if ($('workspace-active-label')) $('workspace-active-label').textContent = document.querySelector(`.section-tabs [data-mode="${activeMode}"]`)?.textContent.trim() || 'National Road Network';
  };
  const syncLayerPanel = () => {
    syncActiveLayer();
    if ($('workspace-expanded-roads')) $('workspace-expanded-roads').checked = showExpandedRoads;
    if ($('workspace-position-legend')) $('workspace-position-legend').hidden = !['bridges', 'culverts'].includes(activeMode);
    syncLabels();
  };

  const catalogue = $('map-workspace-catalogue');
  for (const mode of document.querySelectorAll('.section-tabs button[data-mode]')) {
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = mode.textContent.trim();
    item.dataset.catalogueMode = mode.dataset.mode;
    item.addEventListener('click', () => { mode.click(); openWorkspacePanel('contents'); });
    catalogue.append(item);
  }
  function openWorkspacePanel(tab) {
    $('map-workspace-panel').hidden = false;
    $('map-workspace-title').textContent = tab === 'catalogue' ? 'Catalogue' : tab === 'contents' ? 'Contents' : tab === 'details' ? 'Details' : 'Basemaps';
    for (const button of document.querySelectorAll('[data-workspace-tab]')) button.setAttribute('aria-expanded', String(button.dataset.workspaceTab === tab));
    for (const section of ['catalogue', 'contents', 'details', 'basemaps']) $(`map-workspace-${section}`).hidden = section !== tab;
    for (const item of catalogue.querySelectorAll('[data-catalogue-mode]')) item.setAttribute('aria-current', String(item.dataset.catalogueMode === activeMode));
    syncLayerPanel();
  }
  function showFeatureDetails(content) {
    $('map-workspace-details').replaceChildren(content);
    openWorkspacePanel('details');
  }
  for (const button of document.querySelectorAll('[data-workspace-tab]')) {
    button.addEventListener('click', () => {
      const panel = $('map-workspace-panel');
      const open = !panel.hidden && button.getAttribute('aria-expanded') === 'true';
      if (open) { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); }
      else openWorkspacePanel(button.dataset.workspaceTab);
    });
  }
  $('map-workspace-close').addEventListener('click', () => {
    $('map-workspace-panel').hidden = true;
    for (const tab of document.querySelectorAll('[data-workspace-tab]')) tab.setAttribute('aria-expanded', 'false');
  });
  $('workspace-active-layer').addEventListener('change', event => { activeLayerVisible = event.target.checked; syncActiveLayer(); });
  $('workspace-expanded-roads').addEventListener('change', () => document.querySelector('[data-map-tool="roads"]').click());
  $('workspace-labels').addEventListener('change', () => document.querySelector('[data-map-tool="labels"]').click());

  let charts = {};
  function updateNationalContext() {
    if (!nationalContextLayer) return;
    if (activeMode === 'roads') map.removeLayer(nationalContextLayer);
    else if (!map.hasLayer(nationalContextLayer)) nationalContextLayer.addTo(map).bringToBack();
    $('national-context-label').hidden = activeMode === 'roads';
  }
  function prepareNationalContext(national) {
    const lines = national.filter(item => item.geometry && ['LineString', 'MultiLineString'].includes(item.geometry.type));
    nationalContextLayer = L.geoJSON({ type: 'FeatureCollection', features: lines }, {
      interactive: false,
      style: { color: '#F59E0B', weight: 1.5, opacity: .82 },
    });
    updateNationalContext();
  }
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

  const measureStatus = $('map-measure-status');
  let measureMode = null;
  let measurePoints = [];
  let measureShape = null;
  const earthRadiusKm = 6371.0088;
  const measureArea = points => {
    if (points.length < 3) return 0;
    const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length * Math.PI / 180;
    const xy = points.map(point => [earthRadiusKm * point.lng * Math.PI / 180 * Math.cos(meanLat), earthRadiusKm * point.lat * Math.PI / 180]);
    return Math.abs(xy.reduce((sum, point, i) => sum + point[0] * xy[(i + 1) % xy.length][1] - xy[(i + 1) % xy.length][0] * point[1], 0)) / 2;
  };
  const resetMeasure = () => {
    measureMode = null; measurePoints = [];
    if (measureShape) { map.removeLayer(measureShape); measureShape = null; }
    map.doubleClickZoom.enable();
    for (const button of document.querySelectorAll('[data-map-tool="distance"],[data-map-tool="area"]')) button.setAttribute('aria-pressed', 'false');
    measureStatus.hidden = true;
  };
  const updateMeasure = () => {
    if (measureShape) map.removeLayer(measureShape);
    measureShape = measureMode === 'area' ? L.polygon(measurePoints, { color: '#0071E3', weight: 2, fillOpacity: .16 }).addTo(map)
      : L.polyline(measurePoints, { color: '#0071E3', weight: 2.5, dashArray: '6 4' }).addTo(map);
    const distance = measurePoints.slice(1).reduce((sum, point, i) => sum + map.distance(measurePoints[i], point) / 1000, 0);
    measureStatus.textContent = `${measureMode === 'area' ? `Area: ${formatKm.format(measureArea(measurePoints))} km²` : `Distance: ${formatKm.format(distance)} km`}. Click to add points; double-click to finish; Escape to clear.`;
    measureStatus.hidden = false;
  };
  map.on('click', event => { if (measureMode) { measurePoints.push(event.latlng); updateMeasure(); } });
  map.on('mousemove', event => { $('map-coordinates').textContent = `N ↑  ${event.latlng.lat.toFixed(5)}°, ${event.latlng.lng.toFixed(5)}°`; });
  map.on('dblclick', event => { if (measureMode) { L.DomEvent.stop(event.originalEvent); measureMode = null; map.doubleClickZoom.enable(); measureStatus.textContent += ' Measurement complete. Escape to clear.'; } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') resetMeasure(); });

  for (const button of document.querySelectorAll('[data-map-tool]')) {
    button.addEventListener('click', () => {
      const action = button.dataset.mapTool;
      if (action === 'zoom-in') map.zoomIn();
      else if (action === 'zoom-out') map.zoomOut();
      else if (action === 'extent') showUgandaExtent();
      else if (action === 'clear') resetMeasure();
      else if (action === 'distance' || action === 'area') {
        resetMeasure(); measureMode = action; measurePoints = []; map.doubleClickZoom.disable();
        button.setAttribute('aria-pressed', 'true'); measureStatus.hidden = false;
        measureStatus.textContent = `Measure ${action}. Click the map to add points; double-click to finish; Escape to clear.`;
      } else if (action === 'locate') {
        map.locate({ setView: true, maxZoom: 13, enableHighAccuracy: false });
        measureStatus.hidden = false; measureStatus.textContent = 'Finding approximate location...';
      } else if (action === 'roads') {
        showExpandedRoads = !showExpandedRoads;
        if (allRoadsOverlay) { if (showExpandedRoads) allRoadsOverlay.addTo(map); else map.removeLayer(allRoadsOverlay); }
        button.setAttribute('aria-pressed', String(showExpandedRoads));
        $('workspace-expanded-roads').checked = showExpandedRoads;
      } else if (action === 'labels') {
        showHybridLabels = !showHybridLabels;
        syncLabels();
      } else if (action === 'fullscreen') {
        const shell = document.querySelector('.map-shell');
        if (document.fullscreenElement) document.exitFullscreen();
        else shell.requestFullscreen?.().then(() => map.invalidateSize());
      }
    });
  }
  map.on('locationfound', event => {
    L.circleMarker(event.latlng, { radius: 7, color: '#fff', weight: 2, fillColor: '#0071E3', fillOpacity: 1 }).addTo(map).bindPopup('Approximate location').openPopup();
    measureStatus.textContent = 'Approximate location shown.';
  });
  map.on('locationerror', () => { measureStatus.hidden = false; measureStatus.textContent = 'Location unavailable in this browser session.'; });
  document.addEventListener('fullscreenchange', () => map.invalidateSize());

  const value = (properties, key) => properties?.[key];
  const condition = properties => ['Good', 'Fair', 'Poor'].includes(value(properties, 'Condition')) ? value(properties, 'Condition') : 'Good';
  const surface = properties => ['Paved', 'Unpaved'].includes(value(properties, 'Surface  1')) ? value(properties, 'Surface  1') : 'Unpaved';
  const length = properties => { const raw = value(properties, 'Length Km'); if (raw === null || raw === undefined || raw === '') return null; const n = Number(raw); return Number.isFinite(n) && n >= 0 ? n : null; };
  const mappedLineKm = geometry => {
    const lines = geometry?.type === 'LineString' ? [geometry.coordinates] : geometry?.type === 'MultiLineString' ? geometry.coordinates : [];
    let kilometres = 0;
    for (const line of lines) for (let index = 1; index < line.length; index++) {
      const [lon1, lat1] = line[index - 1], [lon2, lat2] = line[index];
      if (![lon1, lat1, lon2, lat2].every(Number.isFinite)) continue;
      const radians = Math.PI / 180;
      const deltaLat = (lat2 - lat1) * radians, deltaLon = (lon2 - lon1) * radians;
      const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(deltaLon / 2) ** 2;
      kilometres += 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
    }
    return kilometres;
  };
  const recordedNumber = (properties, key) => {
    const raw = value(properties, key);
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const category = (properties, key) => {
    const raw = value(properties, key);
    return typeof raw === 'string' && raw.trim() ? raw.trim() : 'Standard';
  };
  const subRegion = raw => ({ North: 'Northern', South: 'Southern', East: 'Eastern', West: 'Western', 'North East': 'North Eastern' })[raw] || raw || 'Central';
  const title = properties => value(properties, 'Link Name') || value(properties, 'Road No 1') || 'National Road Corridor';
  const text = item => document.createTextNode(String(item ?? ''));
  const linkId = raw => typeof raw === 'string' && raw.includes('_') ? raw : 'Link ID not verified';
  const displayField = (key, raw) => key === 'Link Id 1' || key === 'Link_Number' || key === 'Link_ID'
    ? linkId(raw) : typeof raw === 'string' ? raw.replaceAll('_', ' ') : raw;
  const fmtDate = raw => {
    const s = String(raw || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  };

  function matches(item) {
    const p = item.properties || {};
    const searchText = `${title(p)} ${value(p, 'Road No 1') || ''}`.toLocaleLowerCase();
    return (!filters.search || searchText.includes(filters.search)) &&
      (!filters.region || value(p, 'Region') === filters.region) &&
      (!filters.surface || surface(p) === filters.surface) &&
      (!filters.condition || condition(p) === filters.condition);
  }

  function popup(properties) {
    const panel = document.createElement('div');
    panel.className = 'road-popup';
    const heading = document.createElement('strong'); heading.append(text(title(properties))); panel.append(heading);
    for (const [label, entry] of [
      ['Link ID', linkId(value(properties, 'Link Id 1'))],
      ['Road number', value(properties, 'Road No 1')],
      ['Functional Class', value(properties, 'Road Cla 1') || 'National Road Network'],
      ['Surface Type', surface(properties)],
      ['Condition', condition(properties)],
      ['Region', value(properties, 'Region')],
      ['Station', value(properties, 'Maintenance Station') || value(properties, 'Maintena 2')],
      ['Physical length', length(properties) === null ? '0.00 km' : `${formatKm.format(length(properties))} km`],
    ]) {
      const row = document.createElement('div'); const lead = document.createElement('span');
      lead.append(text(`${label}: `)); row.append(lead, text(entry)); panel.append(row);
    }
    return panel;
  }

  function roadStyle(item) {
    const p = item.properties || {};
    const cls = String(p['Road Cla 1'] || '');
    const isPaved = surface(p) === 'Paved';
    const z = map ? map.getZoom() : 7;
    const roadScale = z <= 7 ? 1.0 : Math.min(3.2, 1.0 + Math.max(0, z - 7) * 0.35);
    const classColor = cls.includes('Class M') ? '#7C3AED'
      : cls.includes('Class A') ? '#DC2626'
      : cls.includes('Class B') ? '#EA580C'
      : '#0071E3';
    const baseWeight = cls.includes('Class M') ? 3.2 : cls.includes('Class A') ? 2.9 : cls.includes('Class B') ? 2.5 : 2.1;
    return {
      color: classColor,
      weight: (isPaved ? baseWeight : baseWeight * 0.58) * roadScale,
      opacity: isPaved ? 0.96 : 0.88,
      dashArray: isPaved ? null : '2 5',
    };
  }

  function drawMap(visible) {
    if (roadLayer) map.removeLayer(roadLayer);
    roadLayer = L.geoJSON(visible, {
      style: roadStyle,
      onEachFeature: (item, layer) => {
        layer.bindPopup(popup(item.properties || {}), { maxWidth: 300 });
        layer.on('click', () => { if (!measureMode) showFeatureDetails(popup(item.properties || {})); });
        const baseWeight = layer.options.weight;
        layer.on('mouseover', () => layer.setStyle({ weight: baseWeight + 1.2, opacity: 1 }));
        layer.on('mouseout', () => roadLayer.resetStyle(layer));
      }
    }).addTo(map);
    syncActiveLayer();
  }
  map.on('resize', () => { if (roadLayer) roadLayer.setStyle(roadStyle); });

  function tally(items, key, measure) {
    const result = new Map();
    for (const item of items) {
      const p = item.properties || {};
      const cat = key(p);
      const amount = measure(p);
      if (amount !== null) result.set(cat, (result.get(cat) || 0) + amount);
    }
    return result;
  }

  function chart(id, labels, values, colours, horizontal = false, type = 'bar', unit = 'km') {
    charts[id]?.destroy();
    const circular = ['doughnut', 'pie', 'polarArea'].includes(type);
    const radial = circular || type === 'radar';
    const fmt = unit === 'km' ? formatKm : formatCount;
    const dataset = {
      data: values,
      backgroundColor: type === 'radar' ? '#0071E333' : colours,
      borderColor: type === 'radar' ? '#0071E3' : circular ? '#ffffff' : 'transparent',
      borderWidth: radial ? 2 : 0,
      borderRadius: type === 'bar' ? 6 : 0,
      maxBarThickness: 36,
      pointBackgroundColor: type === 'radar' ? '#0071E3' : colours,
      pointBorderColor: '#fff',
      pointRadius: type === 'line' ? 5 : 3,
      pointHoverRadius: 8,
      showLine: type !== 'line',
      hoverOffset: circular ? 8 : 0,
    };
    charts[id] = new Chart($(id), {
      type,
      data: { labels, datasets: [dataset] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x',
        animation: { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: circular, position: 'bottom', labels: { color: '#0F172A', boxWidth: 10, boxHeight: 10, padding: 8, font: { family: 'Arial', size: 11, weight: '600' } } },
          tooltip: { backgroundColor: '#FFFFFF', titleColor: '#0F172A', bodyColor: '#334155', borderColor: '#E2E8F0', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: context => `${fmt.format(Number(context.raw))} ${unit}` } }
        },
        scales: type === 'radar' || type === 'polarArea' ? {
          r: { beginAtZero: true, angleLines: { color: '#E2E8F0' }, grid: { color: '#E2E8F0' }, pointLabels: { color: '#0F172A', font: { family: 'Arial', size: 10 } }, ticks: { display: false } }
        } : circular ? {} : {
          x: { grid: { display: false }, ticks: { color: '#334155', font: { family: 'Arial', size: 10 } } },
          y: { beginAtZero: true, grid: { color: '#E2E8F0' }, ticks: { color: '#334155', font: { family: 'Arial', size: 10 } } }
        },
        onClick: (_, elements) => {
          if (!elements.length) return;
          const selected = labels[elements[0].index];
          if (id === 'surface-chart') { filters.surface = filters.surface === selected ? '' : selected; $('surface-filter').value = filters.surface; }
          if (id === 'condition-chart') { filters.condition = filters.condition === selected ? '' : selected; $('condition-filter').value = filters.condition; }
          if (id === 'region-chart') { filters.region = filters.region === selected ? '' : selected; $('region-filter').value = filters.region; }
          if (['surface-chart', 'condition-chart', 'region-chart'].includes(id)) update();
        }
      }
    });
  }

  function update() {
    if (!roadsLoaded) {
      $('map-status').textContent = roadLoadPromise ? 'Loading mapped National Roads' : 'Mapped road layer unavailable';
      $('selection-summary').textContent = 'Loading 21,284.02 km mapped extent...';
      return;
    }
    const visible = roadItems.filter(matches);
    if (activeMode === 'roads') drawMap(visible);
    const km = visible.reduce((sum, item) => sum + (length(item.properties || {}) || 0), 0);
    const pct = (km / 21284.02 * 100).toFixed(2);
    $('metric-value').textContent = formatKm.format(km);
    $('selection-summary').textContent = `${formatKm.format(km)} km (${pct}% of the 21,284.02 km mapped road layer)`;
    $('map-status').textContent = 'Mapped National Roads on map';

    const surfaceData = tally(visible, surface, length);
    chart('surface-chart', ['Paved', 'Unpaved'], ['Paved', 'Unpaved'].map(k => Number((surfaceData.get(k) || 0).toFixed(2))), ['#0071E3', '#D97706'], false, 'doughnut', 'km');

    const conditionData = tally(visible, condition, length);
    const condVals = ['Good', 'Fair', 'Poor'].map(k => Number((conditionData.get(k) || 0).toFixed(2)));
    chart('condition-chart', ['Good', 'Fair', 'Poor'], condVals, ['#16A34A', '#D97706', '#DC2626'], false, 'bar', 'km');

    const regionData = tally(visible, p => value(p, 'Region') || 'Central', length);
    const regions = Array.from(new Set(roadItems.map(f => value(f.properties || {}, 'Region') || 'Central'))).sort();
    chart('region-chart', regions, regions.map(k => Number((regionData.get(k) || 0).toFixed(2))), '#0071E3', true, 'bar', 'km');

    const classes = [...new Set(roadItems.map(item => category(item.properties || {}, 'Road Cla 1')))].sort();
    const classLengths = tally(visible, p => category(p, 'Road Cla 1'), length);
    chart('class-chart', classes, classes.map(k => Number((classLengths.get(k) || 0).toFixed(2))), ['#DC2626', '#EA580C', '#0071E3', '#7C3AED'], false, 'bar', 'km');

    const trafficWeighted = new Map(classes.map(k => [k, { sum: 0, km: 0 }]));
    for (const item of visible) {
      const p = item.properties || {};
      const key = category(p, 'Road Cla 1');
      const aadt = recordedNumber(p, 'Aadt 2026 Live');
      const len = length(p) || 0;
      if (trafficWeighted.has(key) && aadt !== null && len > 0) {
        const entry = trafficWeighted.get(key);
        entry.sum += aadt * len;
        entry.km += len;
      }
    }
    chart('traffic-chart', classes, classes.map(k => {
      const e = trafficWeighted.get(k);
      return e && e.km > 0 ? Math.round(e.sum / e.km) : 0;
    }), '#16A34A', false, 'bar', 'veh/day');
    if (activeMode === 'roads') window.TransportChartGallery?.render('roads', roadItems, visible, item => length(item.properties || {}) || 0);
    if (activeMode === 'roads') window.dispatchEvent(new CustomEvent('transportdataready', { detail: { mode: 'roads', items: visible } }));
  }

  const transportModes = {
    bridges: {
      title: 'Bridges (552)', files: ['bridges.geojson'], colour: '#0071E3', countLabel: 'National Bridges (552)', statusUnit: 'bridges',
      group: p => category(p, 'Maintenance_Region'),
      description: 'Published mapped inventory of 552 Bridges across 6 Maintenance Regions and 23 Maintenance Stations: 247 Good, 71 Satisfactory, 162 Marginal, 52 Poor, 13 Critical and 7 Under Construction. Some Link IDs and positions require review.',
      fields: [['Bridge Name', 'Bridge_Name'], ['Bridge Number', 'Bridge_Number'], ['Link ID', 'Link_Number'], ['Road Name', 'Road_Name'], ['River Crossing', 'River_Crossing'], ['Condition Band', 'Condition_Band'], ['Region', 'Maintenance_Region'], ['Station', 'Maintenance_Station'], ['Longitude (X)', 'Longitude'], ['Latitude (Y)', 'Latitude']],
    },
    culverts: {
      title: 'Major Culverts (452)', files: ['major_culverts.geojson'], colour: '#0891B2', countLabel: 'Major Culverts (452)', statusUnit: 'major culverts',
      group: p => category(p, 'Maintenance_Region'),
      description: 'Published mapped inventory of 452 Major Culverts across 6 Maintenance Regions and 23 Maintenance Stations: 403 Good, 39 Satisfactory, 4 Marginal, 1 Poor, 4 Critical and 1 Under Construction. Some Link IDs and positions require review.',
      fields: [['Culvert Number', 'Culvert_Number'], ['Link ID', 'Link_Number'], ['Road Name', 'Road_Name'], ['Structure Type', 'Culvert_Structure_Type'], ['Condition Band', 'Condition_Band'], ['Region', 'Maintenance_Region'], ['Station', 'Maintenance_Station'], ['Longitude (X)', 'Longitude'], ['Latitude (Y)', 'Latitude']],
    },
    traffic: {
      title: 'Traffic Census Stations (298)', files: ['traffic_count_stations.geojson'], colour: '#D97706', countLabel: 'Traffic Census Stations', statusUnit: 'stations',
      group: p => subRegion(category(p, 'REGION')),
      description: 'Published mapped inventory of 298 traffic census stations across 6 Maintenance Regions. The layer does not establish a live feed, current speed or current traffic volumes.',
      fields: [['Station Code', 'TCS_NAME'], ['Station Number', 'TCS_NO_'], ['Link ID', 'Link_ID'], ['Road Corridor', 'Link_Name'], ['Station Category', 'STATIONS'], ['Region', 'REGION']],
    },
    ferries: {
      title: 'Ferry Crossings (20)', files: ['ferry_crossings.geojson'], colour: '#0071E3', countLabel: 'Ferry Crossings', statusUnit: 'crossings',
      group: p => category(p, 'Water_body'),
      description: 'Published mapped inventory of 20 ferry crossings across Lake Victoria, Lake Kyoga, Lake Albert, Lake Bisina, River Nile and River Semliki. Current schedules and operations are not verified.',
      fields: [['Crossing', 'Ferry_cros'], ['Water Body', 'Water_body'], ['Status', 'Category']],
    },
    aviation: {
      title: 'Aviation Aerodromes (13)', files: ['airports.geojson'], colour: '#7C3AED', countLabel: 'Aviation Aerodromes', statusUnit: 'aerodromes',
      group: p => category(p, 'Category'),
      description: 'Published mapped inventory of 13 aviation aerodromes. Current passenger, cargo and operational figures are not verified by this layer.',
      fields: [['Aerodrome', 'F9'], ['Category', 'Category'], ['Region', 'Region']],
    },
    safety: {
      title: 'Road Safety Observations', files: ['kampala_traffic_incidents.geojson'], colour: '#DC2626', countLabel: 'Safety Observations', statusUnit: 'observations',
      group: p => category(p, 'severity'),
      description: 'Published road safety observations categorised by severity, collision type and road class. This is a static historical layer, not a current incident feed.',
      fields: [['Incident Type', 'incident_type'], ['Severity', 'severity'], ['Road Corridor', 'road_name'], ['Road Class', 'road_class'], ['Date', 'date']],
    },
    freight: {
      title: 'Weighbridge Stations (21)', files: ['weighbridges.geojson'], colour: '#EA580C', countLabel: 'Weighbridge Facilities', statusUnit: 'facilities',
      group: p => category(p, 'Status'),
      description: 'Published mapped inventory of 21 weighbridge facilities. Live operational status is not verified.',
      fields: [['Facility', 'Weighbridge Name'], ['Status', 'Status'], ['Region', 'Region']],
    },
    rail: {
      title: 'Rail Corridors (1,538.00 km)', files: ['mgr.geojson', 'sgr_alignment.geojson'], colour: '#16A34A', countLabel: 'Railway Network (km)', statusUnit: 'km',
      group: p => category(p, '_transportKind'),
      description: 'Published mapped rail geometry comprises 1,266.00 km of Metre-Gauge Railway and 272.00 km of planned Standard-Gauge Railway alignment. Mapped geometry is not proof of current operational length.',
      fields: [['Corridor Name', 'Name'], ['Operational Status', 'Status'], ['Physical Length (km)', 'Length Km']],
    },
  };

  const tabHeadings = {
    roads: 'Mapped National Roads (21,284.02 km)',
    bridges: 'National Bridges (552)',
    culverts: 'Major Culverts (452)',
    traffic: 'Traffic Census Stations (298)',
    ferries: 'Inland Water Ferry Crossings (20)',
    aviation: 'Civil Aviation Aerodromes (13)',
    safety: 'Road Safety Observation Register',
    freight: 'Axle Load Weighbridge Stations (21)',
    rail: 'National Railway Network (1,266.00 km MGR · 272.00 km SGR)',
  };
  function updateIntro(key) {
    const heading = $('page-title');
    heading.textContent = tabHeadings[key];
    $('intro-kicker').textContent = `DATA SCIENCE TRIALS / ${key === 'culverts' ? 'MAJOR CULVERTS' : key.toUpperCase()}`;
    $('intro-note').textContent = key === 'roads'
      ? 'The National Roads Network register totals 21,284.02 km (6,406.69 km Paved [30.10%], 14,877.33 km Unpaved [69.90%]) with 552 Bridges and 452 Major Culverts, synchronised weekly from the Unified SQL Database and projected to 2040 under Vision 2040.'
      : transportModes[key].description;
    const networkSeries = $('network-time-series');
    if (networkSeries) networkSeries.hidden = key !== 'roads';
    $('intro-aside-title').textContent = key === 'roads' ? 'Interactive map and registers' : `${transportModes[key].title}: map & registers`;
    $('intro-table-link').href = `./data-explorer.html?dataset=${encodeURIComponent(({ roads: 'roads', bridges: 'bridges', culverts: 'culverts', traffic: 'stations', ferries: 'ferries', aviation: 'aviation', safety: 'safety', freight: 'freight', rail: 'mgr' })[key])}`;
    $('intro-table-link').firstChild.textContent = `Open ${key === 'culverts' ? 'major culvert' : key} register `;
  }

  async function loadMode(key) {
    if (!modeCache.has(key)) {
      const spec = transportModes[key];
      modeCache.set(key, Promise.all(spec.files.map(async file => {
        let response;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await fetch(`geo/${file}?v=20261118-v200`);
            break;
          } catch (error) {
            if (error?.name !== 'AbortError' || attempt === 1) throw error;
            $('map-status').textContent = `Retrying ${spec.title.toLowerCase()}`;
          }
        }
        if (!response.ok) throw new Error(`${file} returned ${response.status}`);
        const data = await response.json();
        const kind = file === 'bridges.geojson' ? 'Bridges' : file === 'major_culverts.geojson' ? 'Major Culverts' :
          file === 'mgr.geojson' ? 'Metre-Gauge Railway (1,266.00 km)' : file === 'sgr_alignment.geojson' ? 'Standard-Gauge Alignment (272.00 km)' : '';
        return data.features.filter(item => item.geometry && item.properties &&
          (item.geometry.type === 'Point' || (key === 'rail' && ['LineString', 'MultiLineString'].includes(item.geometry.type))))
          .map(item => ({ ...item, properties: { ...item.properties, _transportKind: kind } }));
      })).then(groups => groups.flat()).catch(error => {
        modeCache.delete(key);
        throw error;
      }));
    }
    return modeCache.get(key);
  }

  function pointPopup(properties, spec) {
    const panel = document.createElement('div');
    const heading = document.createElement('strong');
    heading.append(text(properties.Name || properties.Bridge_Name || properties.Ferry_cros || properties.F9 || properties.TCS_NAME ||
      properties['Weighbridge Name'] || properties.incident_type || properties.Culvert_Number || spec.title));
    panel.append(heading);
    for (const [label, key] of spec.fields) {
      let entry = properties[key];
      if (entry === null || entry === undefined || entry === '') continue;
      if (key === 'date') entry = fmtDate(entry);
      const row = document.createElement('div'); row.append(text(`${label}: ${key === 'REGION' ? subRegion(entry) : displayField(key, entry)}`)); panel.append(row);
    }
    return panel;
  }

  const markerShapes = {
    traffic: '<path d="M5 20V4m14 16V4M5 8h14M8 13h2m4 0h2M9 8v6m6-6v6"/>',
    ferries: '<path d="M3 15h18l-3 4H6zM8 15V6h8v9M8 9h8M4 21c2-1 4-1 6 0 2-1 4-1 6 0 2-1 4-1 6 0"/>',
    aviation: '<path d="M12 2v20m0-8L3 17v-3l9-5 9 5v3zM9 20l3-2 3 2"/>',
    safety: '<path d="M12 3 2 21h20L12 3Zm0 6v5m0 3v1"/>',
    freight: '<path d="M2 7h12v10H2zM14 10h4l4 4v3h-8zM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
  };
  const markerIcons = new Map();
  function markerIcon(key, colour) {
    const cacheKey = `${key}:${colour}`;
    if (markerIcons.has(cacheKey)) return markerIcons.get(cacheKey);
    let html;
    let iconSize;
    let iconAnchor;
    if (key === 'bridges') {
      html = `<span class="marker-shadow"></span><svg viewBox="0 0 32 30" aria-hidden="true" class="marker-object"><path d="M2 13 16 8l14 5-14 5Z" fill="#93C5FD" stroke="#fff"/><path d="M2 13v5l14 5v-5Z" fill="#3B82F6" stroke="#EFF6FF"/><path d="M16 18v5l14-5v-5Z" fill="#0071E3" stroke="#EFF6FF"/><path d="M7 21v6m18-7v7M4 27h24" fill="none" stroke="#1E3A8A" stroke-width="2.5"/><path d="M8 14h16" stroke="#fff" stroke-width="1.4"/></svg>`;
      iconSize = [22, 22]; iconAnchor = [11, 19];
    } else if (key === 'culverts') {
      html = `<span class="marker-shadow"></span><svg viewBox="0 0 32 30" aria-hidden="true" class="marker-object"><path d="M3 9 17 5l12 4-14 4Z" fill="#A5F3FC" stroke="#fff"/><path d="M3 9v16l12 3V13Z" fill="#06B6D4" stroke="#ECFEFF"/><path d="M15 13v15l14-4V9Z" fill="#0891B2" stroke="#ECFEFF"/><path d="M18 26v-7a4 4 0 0 1 8 0v5Z" fill="#164E63" stroke="#CFFAFE" stroke-width="1.2"/><path d="M4 24h24" stroke="#F0FDFA" stroke-width="1.2"/></svg>`;
      iconSize = [22, 22]; iconAnchor = [11, 19];
    } else {
      html = `<svg class="marker-isometric" viewBox="0 0 48 54" aria-hidden="true" style="--marker-colour:${colour}"><ellipse cx="24" cy="48" rx="17" ry="4" fill="#0F172A33"/><path d="M6 32 24 23l18 9-18 9Z" fill="#F8FAFC" stroke="#fff"/><path d="M6 32v7l18 9v-7Z" fill="#94A3B8"/><path d="M24 41v7l18-9v-7Z" fill="#475569"/><circle cx="24" cy="20" r="15" fill="var(--marker-colour)" stroke="#fff" stroke-width="2"/><path d="M14 14c4-8 13-9 19-3" fill="none" stroke="#fff8" stroke-width="3" stroke-linecap="round"/><g transform="translate(12 8)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${markerShapes[key] || markerShapes.traffic}</g></svg>`;
      iconSize = [42, 50]; iconAnchor = [21, 47];
    }
    const icon = L.divIcon({ className: `transport-marker${key === 'bridges' || key === 'culverts' ? ' transport-marker--structure' : ''}`, html, iconSize, iconAnchor, popupAnchor: [0, -iconAnchor[1]] });
    markerIcons.set(cacheKey, icon);
    return icon;
  }

  function drawModePoints(items, spec) {
    if (roadLayer) map.removeLayer(roadLayer);
    if (pointLayer) map.removeLayer(pointLayer);
    pointLayer = L.geoJSON(items, {
      pointToLayer: (_item, latlng) => L.marker(latlng, { icon: markerIcon(activeMode, spec.colour), keyboard: true }),
      style: item => ({
        color: item.properties?._transportKind?.includes('Standard-Gauge') ? '#7C3AED' : item.properties?.Status === 'Operational' ? '#16A34A' : '#D97706',
        weight: item.properties?._transportKind?.includes('Standard-Gauge') ? 3.2 : 2.6,
        opacity: .94,
        dashArray: item.properties?.Status === 'Scheduled Rehabilitation' ? '4 4' : null
      }),
      onEachFeature: (item, layer) => {
        layer.bindPopup(pointPopup(item.properties || {}, spec), { maxWidth: 290 });
        layer.on('click', () => { if (!measureMode) showFeatureDetails(pointPopup(item.properties || {}, spec)); });
      },
    }).addTo(map);
    syncActiveLayer();
    showUgandaExtent();
  }

  async function showMode(key) {
    activeMode = key;
    syncLayerPanel();
    updateNationalContext();
    updateIntro(key);
    window.dispatchEvent(new CustomEvent('transportmodechange', { detail: { mode: key } }));
    showUgandaExtent();
    document.querySelector('.section-tabs a[href="./"]')?.removeAttribute('aria-current');
    for (const button of document.querySelectorAll('.section-tabs button[data-mode]')) {
      if (button.dataset.mode === key) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    const isRoad = key === 'roads';
    document.querySelector('.control-card').hidden = !isRoad;
    document.querySelector('.legend-card').hidden = false;
    $('road-analysis').hidden = !isRoad;
    $('mode-detail').hidden = isRoad;
    if (isRoad) {
      if (pointLayer) { map.removeLayer(pointLayer); pointLayer = null; }
      $('metric-kind').textContent = 'ROADS';
      $('metric-label').textContent = 'Mapped National Roads (km)';
      $('metric-note').textContent = 'Authoritative Master Register.';
      if (!roadsLoaded && !roadLoadPromise) loadRoadFeatures().catch(() => {});
      update();
      showUgandaExtent();
      return;
    }
    const spec = transportModes[key];
    if (roadLayer) { map.removeLayer(roadLayer); roadLayer = null; }
    if (pointLayer) { map.removeLayer(pointLayer); pointLayer = null; }
    charts['mode-chart']?.destroy();
    delete charts['mode-chart'];
    window.TransportChartGallery?.render(key, [], [], () => 0);
    $('map-status').textContent = `Loading ${spec.title}`;
    $('metric-kind').textContent = key.toUpperCase();
    $('metric-value').textContent = 'Loading';
    $('metric-label').textContent = spec.countLabel;
    $('metric-note').textContent = '';
    $('mode-title').textContent = spec.title;
    $('mode-description').textContent = spec.description;
    $('mode-table-link').href = `./data-explorer.html?dataset=${encodeURIComponent(({ bridges: 'bridges', culverts: 'culverts', traffic: 'stations', ferries: 'ferries', aviation: 'aviation', safety: 'safety', freight: 'freight', rail: 'mgr' })[key])}`;
    try {
      const items = await loadMode(key);
      if (activeMode !== key) return;
      drawModePoints(items, spec);
      const groups = key === 'rail' ? items.reduce((result, item) => {
        const group = spec.group(item.properties || {});
        const kmVal = Number(item.properties?.['Length Km']) || mappedLineKm(item.geometry);
        result.set(group, (result.get(group) || 0) + kmVal);
        return result;
      }, new Map()) : tally(items, spec.group, () => 1);
      const labels = [...groups.keys()].sort((a, b) => a.localeCompare(b));
      chart('mode-chart', labels, labels.map(label => Number(groups.get(label).toFixed(2))), spec.colour, true, 'bar', key === 'rail' ? 'km' : 'assets');
      $('mode-chart').setAttribute('aria-label', key === 'rail' ? 'Railway network length by corridor category in kilometres' : `${spec.title} distribution by category`);
      $('mode-chart-unit').textContent = key === 'rail' ? 'Physical route length (km)' : 'Distribution by category';
      window.TransportChartGallery?.render(key, items, items, item => key === 'rail' ? (Number(item.properties?.['Length Km']) || mappedLineKm(item.geometry)) : 1);
      window.dispatchEvent(new CustomEvent('transportdataready', { detail: { mode: key, items } }));
      $('map-status').textContent = `${spec.title} on map`;
      $('metric-kind').textContent = key.toUpperCase();
      $('metric-value').textContent = key === 'rail'
        ? formatKm.format(items.reduce((sum, item) => sum + (Number(item.properties?.['Length Km']) || mappedLineKm(item.geometry)), 0))
        : formatCount.format(items.length);
      $('metric-label').textContent = spec.countLabel;
      $('metric-note').textContent = 'Authoritative Master Register.';
    } catch (error) {
      if (activeMode !== key) return;
      $('map-status').textContent = 'Layer unavailable';
      $('mode-description').textContent = `${spec.description} Select this tab again to retry.`;
      console.error('Transport layer unavailable', error);
    }
  }

  function downloadCsv(headers, values, filename) {
    const escape = entry => {
      const raw = entry === null || entry === undefined ? '' : String(entry);
      const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const lines = [headers.map(escape).join(','), ...values.map(row => row.map(escape).join(','))];
    const url = URL.createObjectURL(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function downloadJson(data, filename, type) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  window.addEventListener('download-mapped-data', async event => {
    const fileType = event.detail?.format || 'csv';
    const mode = activeMode;
    if (mode === 'roads') {
      const exportRows = roadItems.filter(matches).map(item => {
        const p = item.properties || {};
        return { type: 'Feature', geometry: item.geometry, properties: {
          'Link ID': linkId(value(p, 'Link Id 1')), 'Road Name': title(p), Network: 'National Road Network',
          'Functional Class': category(p, 'Road Cla 1'), 'Surface Type': surface(p), 'Region': category(p, 'Region'),
          Condition: condition(p), 'Length (km)': length(p),
        } };
      });
      const headers = ['Link ID', 'Road Name', 'Network', 'Functional Class', 'Surface Type', 'Region', 'Condition', 'Length (km)'];
      if (fileType === 'geojson') downloadJson({ type: 'FeatureCollection', features: exportRows }, 'data-science-trials-mapped-roads.geojson', 'application/geo+json');
      else if (fileType === 'json') downloadJson(exportRows.map(item => item.properties), 'data-science-trials-mapped-roads.json', 'application/json');
      else downloadCsv(headers, exportRows.map(item => headers.map(key => item.properties[key])), 'data-science-trials-mapped-roads.csv');
      return;
    }
    const spec = transportModes[mode];
    if (!spec) return;
    try {
      const items = await loadMode(mode);
      const headers = ['Asset Category', ...spec.fields.map(([label]) => label)];
      const rows = items.map(item => [item.properties?._transportKind || spec.title, ...spec.fields.map(([, key]) => key === 'REGION' ? subRegion(item.properties?.[key]) : displayField(key, item.properties?.[key]))]);
      const exportRows = items.map((item, index) => ({ type: 'Feature', geometry: item.geometry, properties: Object.fromEntries(headers.map((header, column) => [header, rows[index][column]])) }));
      if (fileType === 'geojson') downloadJson({ type: 'FeatureCollection', features: exportRows }, `data-science-trials-${mode}-layer.geojson`, 'application/geo+json');
      else if (fileType === 'json') downloadJson(exportRows.map(item => item.properties), `data-science-trials-${mode}-layer.json`, 'application/json');
      else downloadCsv(headers, rows, `data-science-trials-${mode}-schedule.csv`);
    } catch (error) {
      console.error('Export failed', error);
    }
  });

  for (const button of document.querySelectorAll('.section-tabs button[data-mode]')) {
    button.addEventListener('click', () => {
      showMode(button.dataset.mode);
      $('explore').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  for (const [id, field] of [['road-search', 'search'], ['region-filter', 'region'], ['surface-filter', 'surface'], ['condition-filter', 'condition']]) {
    $(id).addEventListener(id === 'road-search' ? 'input' : 'change', event => {
      filters[field] = field === 'search' ? event.target.value.trim().toLocaleLowerCase() : event.target.value;
      update();
    });
  }
  $('reset-filters').addEventListener('click', () => {
    for (const field of Object.keys(filters)) filters[field] = '';
    for (const id of ['road-search', 'region-filter', 'surface-filter', 'condition-filter']) $(id).value = '';
    update();
  });

  function loadRoadFeatures() {
    if (roadLoadPromise) return roadLoadPromise;
    roadLoadPromise = fetch(`network.geojson?v=20261118-v200`).then(async response => {
      if (!response.ok) throw new Error(`Road register returned ${response.status}`);
      const data = await response.json();
      prepareNationalContext(data.features || []);
      roadItems = (data.features || []).filter(item => item.geometry && item.properties);
      roadsLoaded = true;
      const regions = Array.from(new Set(roadItems.map(f => value(f.properties, 'Region')).filter(Boolean))).sort();
      for (const region of regions) $('region-filter').add(new Option(region, region));
      if (activeMode === 'roads') { showUgandaExtent(); update(); }
    }).catch(error => {
      roadLoadPromise = null;
      if (activeMode === 'roads') {
        $('map-status').textContent = 'Road geometry unavailable';
        $('selection-summary').textContent = 'Select Roads to reload the 21,284.02 km mapped road layer.';
      }
      throw error;
    });
    return roadLoadPromise;
  }

  const requestedMode = new URLSearchParams(window.location.search).get('mode');
  if (requestedMode && (requestedMode === 'roads' || transportModes[requestedMode])) showMode(requestedMode);
  window.addEventListener('timeline-request', () => {
    if (activeMode === 'roads' && roadsLoaded) window.dispatchEvent(new CustomEvent('transportdataready', { detail: { mode: 'roads', items: roadItems.filter(matches) } }));
    else if (transportModes[activeMode]) {
      const mode = activeMode;
      loadMode(mode).then(items => {
        if (activeMode === mode) window.dispatchEvent(new CustomEvent('transportdataready', { detail: { mode, items } }));
      }).catch(() => {});
    }
  });
  loadRoadFeatures().catch(() => {});
})();
