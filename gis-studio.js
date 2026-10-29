(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const format = new Intl.NumberFormat('en-UG', { maximumFractionDigits: 1 });
  const filters = { search: '', region: '', surface: '', condition: '' };
  const map = L.map('gis-map', { zoomControl: false, preferCanvas: true, scrollWheelZoom: true, wheelPxPerZoomLevel: 120 }).setView([1.3, 32.3], 7);
  const mapContainer = map.getContainer();
  const activateWheelZoom = () => {
    map.scrollWheelZoom.enable();
    if (document.activeElement !== mapContainer) mapContainer.focus({ preventScroll: true });
  };
  mapContainer.addEventListener('pointerenter', activateWheelZoom);
  mapContainer.addEventListener('wheel', activateWheelZoom, { capture: true, passive: true });
  const ugandaExtent = L.latLngBounds([[-1.6, 29.4], [4.35, 35.2]]);
  const mapAspect = () => { const size = map.getSize(); return size.x / Math.max(1, size.y); };
  const showUgandaExtent = () => map.fitBounds(ugandaExtent, { padding: mapAspect() < .8 ? [12, 12] : [18, 18], maxZoom: 7, animate: false });
  const reportZoom = () => { map.getContainer().dataset.zoom = String(map.getZoom()); };
  map.on('zoomend', reportZoom);
  reportZoom();
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Imagery: Esri and contributors',
  }).addTo(map);
  map.createPane('hybridLabels');
  map.getPane('hybridLabels').style.zIndex = 650;
  map.getPane('hybridLabels').style.pointerEvents = 'none';
  const labelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    pane: 'hybridLabels', maxZoom: 19, attribution: 'Labels and borders: Esri',
  }).addTo(map);
  map.createPane('allRoads');
  map.getPane('allRoads').style.zIndex = 390;
  map.getPane('allRoads').style.pointerEvents = 'none';
  let allRoadsOverlay = null;
  let allRoadsKind = '';
  let allRoadsLayout = '';
  let showExpandedRoads = true;
  fetch('geo/allroads-display.json?v=20261029-bms').then(async response => {
    if (!response.ok) throw new Error(`Expanded road geometry returned ${response.status}`);
    const manifest = await response.json();
    if (manifest.crs !== 'EPSG:4326' || manifest.geometry_count !== 389366 || !Array.isArray(manifest.bounds)) throw new Error('Expanded road geometry metadata mismatch');
    const refresh = () => {
      const layout = mapAspect() < .8 ? 'portrait' : 'landscape';
      const kind = map.getZoom() >= (layout === 'portrait' ? 8 : 9) ? 'detail' : 'overview';
      map.getContainer().dataset.aspect = layout;
      if (kind === allRoadsKind && layout === allRoadsLayout) return;
      if (allRoadsOverlay) map.removeLayer(allRoadsOverlay);
      allRoadsKind = kind;
      allRoadsLayout = layout;
      allRoadsOverlay = L.imageOverlay(`${manifest.images[kind]}?v=20261029-thin`, manifest.bounds, { pane: 'allRoads', opacity: layout === 'portrait' ? .9 : .94, interactive: false, alt: 'Mapped National and DUCAR road geometry' });
      allRoadsOverlay.on('load', () => { const note = $('allroads-coverage'); if (note) note.textContent = 'Expanded National and DUCAR geometry shown. Search and charts cover a smaller subset.'; });
      allRoadsOverlay.on('error', () => { const note = $('allroads-coverage'); if (note) note.textContent = 'Expanded geometry unavailable. The searchable subset remains visible.'; });
      if (showExpandedRoads) allRoadsOverlay.addTo(map);
    };
    map.on('zoomend', refresh);
    map.on('resize', refresh);
    refresh();
  }).catch(error => { const note = $('allroads-coverage'); if (note) note.textContent = 'Expanded geometry unavailable. The searchable subset remains visible.'; console.error('Expanded road geometry unavailable', error); });
  let features = [];
  let roadLayer = null;
  let pointLayer = null;
  let activeMode = 'roads';
  const modeCache = new Map();
  let charts = {};
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
    measureShape = measureMode === 'area' ? L.polygon(measurePoints, { color: '#39e9dc', weight: 2, fillOpacity: .16 }).addTo(map)
      : L.polyline(measurePoints, { color: '#39e9dc', weight: 2, dashArray: '6 4' }).addTo(map);
    const distance = measurePoints.slice(1).reduce((sum, point, i) => sum + map.distance(measurePoints[i], point) / 1000, 0);
    measureStatus.textContent = `${measureMode === 'area' ? `Area: ${format.format(measureArea(measurePoints))} km²` : `Distance: ${format.format(distance)} km`}. Click to add points; double-click to finish; Escape to clear.`;
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
        measureStatus.hidden = false; measureStatus.textContent = 'Finding your location...';
      } else if (action === 'roads') {
        showExpandedRoads = !showExpandedRoads;
        if (allRoadsOverlay) { if (showExpandedRoads) allRoadsOverlay.addTo(map); else map.removeLayer(allRoadsOverlay); }
        button.setAttribute('aria-pressed', String(showExpandedRoads));
      } else if (action === 'labels') {
        const visible = map.hasLayer(labelsLayer);
        if (visible) map.removeLayer(labelsLayer); else labelsLayer.addTo(map);
        button.setAttribute('aria-pressed', String(!visible));
      } else if (action === 'fullscreen') {
        const shell = document.querySelector('.map-shell');
        if (document.fullscreenElement) document.exitFullscreen();
        else shell.requestFullscreen?.().then(() => map.invalidateSize());
      }
    });
  }
  map.on('locationfound', event => {
    L.circleMarker(event.latlng, { radius: 7, color: '#fff', weight: 2, fillColor: '#008ca9', fillOpacity: 1 }).addTo(map).bindPopup('Your approximate location').openPopup();
    measureStatus.textContent = 'Approximate location shown.';
  });
  map.on('locationerror', () => { measureStatus.hidden = false; measureStatus.textContent = 'Location unavailable or permission denied.'; });
  document.addEventListener('fullscreenchange', () => map.invalidateSize());
  const value = (properties, key) => properties?.[key];
  const condition = properties => ['Good', 'Fair', 'Poor'].includes(value(properties, 'Condition')) ? value(properties, 'Condition') : 'Not supplied';
  const surface = properties => ['Paved', 'Unpaved'].includes(value(properties, 'Surface  1')) ? value(properties, 'Surface  1') : 'Not supplied';
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
    return typeof raw === 'string' && raw.trim() ? raw.trim() : 'Not supplied';
  };
  const title = properties => value(properties, 'Link Name') || value(properties, 'Road No 1') || 'Unnamed road';
  const text = item => document.createTextNode(String(item ?? 'Not supplied'));

  function matches(feature) {
    const p = feature.properties || {};
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
      ['Road number', value(properties, 'Road No 1')], ['Network', value(properties, 'Road Type') || 'National Road Network'], ['Surface', surface(properties)],
      ['Condition', condition(properties)], ['Sub-region', value(properties, 'Region')],
      ['Mapped length', length(properties) === null ? 'Not supplied' : `${format.format(length(properties))} km`],
    ]) {
      const row = document.createElement('div'); const lead = document.createElement('span');
      lead.append(text(`${label}: `)); row.append(lead, text(entry)); panel.append(row);
    }
    return panel;
  }

  function roadStyle(feature) {
    const p = feature.properties || {};
    const isDucar = p['Road Type'] === 'DUCAR';
    const isCommunity = p['Road Cla 1'] === 'Community Access Road';
    const isPaved = surface(p) === 'Paved';
    return {
      color: isPaved ? (isDucar ? '#4e595e' : '#111111') : isCommunity ? '#e4ddca' : isDucar ? '#d8ba7b' : '#ff7a25',
      weight: isPaved ? (isDucar ? 1.4 : 2) : isCommunity ? .2 : isDucar ? .35 : .5,
      opacity: isCommunity ? .68 : .95,
      dashArray: null,
    };
  }

  function drawMap(visible) {
    if (roadLayer) map.removeLayer(roadLayer);
    roadLayer = L.geoJSON(visible, {
      style: roadStyle,
      onEachFeature: (feature, layer) => {
        layer.bindPopup(popup(feature.properties || {}), { maxWidth: 300 });
        const baseWeight = layer.options.weight;
        layer.on('mouseover', () => layer.setStyle({ weight: baseWeight + (surface(feature.properties || {}) === 'Paved' ? 1.2 : .3), opacity: 1 }));
        layer.on('mouseout', () => roadLayer.resetStyle(layer));
      }
    }).addTo(map);
  }
  map.on('resize', () => { if (roadLayer) roadLayer.setStyle(roadStyle); });

  function tally(items, key, measure) {
    const result = new Map();
    for (const item of items) {
      const p = item.properties || {};
      const category = key(p);
      const amount = measure(p);
      if (amount !== null) result.set(category, (result.get(category) || 0) + amount);
    }
    return result;
  }

  function chart(id, labels, values, colours, horizontal = false, type = 'bar') {
    charts[id]?.destroy();
    const circular = ['doughnut', 'pie', 'polarArea'].includes(type);
    const radial = circular || type === 'radar';
    const dataset = {
      data: values,
      backgroundColor: type === 'radar' ? '#c68bff40' : colours,
      borderColor: type === 'radar' ? '#c68bff' : circular ? '#182633' : 'transparent',
      borderWidth: radial ? 2 : 0,
      borderRadius: type === 'bar' ? 5 : 0,
      maxBarThickness: 36,
      pointBackgroundColor: type === 'radar' ? '#c68bff' : colours,
      pointBorderColor: '#fff',
      pointRadius: type === 'line' ? 6 : 3,
      pointHoverRadius: 9,
      showLine: type !== 'line',
      hoverOffset: circular ? 8 : 0,
    };
    charts[id] = new Chart($(id), {
      type,
      data: { labels, datasets: [dataset] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x',
        animation: { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700, easing: 'easeOutQuart' },
        plugins: { legend: { display: circular, position: 'bottom', labels: { color: '#d4e2e8', boxWidth: 7, boxHeight: 7, padding: 5, font: { size: 9 } } }, tooltip: { callbacks: { label: context => format.format(Number(context.raw)) } } },
        scales: type === 'radar' || type === 'polarArea' ? {
          r: { beginAtZero: true, angleLines: { color: '#ffffff25' }, grid: { color: '#ffffff25' }, pointLabels: { color: '#d4e2e8', font: { size: 10 } }, ticks: { display: false } }
        } : circular ? {} : {
          x: { grid: { display: false }, ticks: { color: '#b6c7d0', font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: '#ffffff18' }, ticks: { color: '#b6c7d0', font: { size: 10 } } }
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
    const visible = features.filter(matches);
    if (activeMode === 'roads') drawMap(visible);
    const km = visible.reduce((sum, feature) => sum + (length(feature.properties || {}) || 0), 0);
    $('metric-value').textContent = format.format(km);
    $('selection-summary').textContent = `Mapped National and DUCAR roads shown`;
    $('map-status').textContent = 'Road network on map';
    const surfaceData = tally(visible, surface, length);
    chart('surface-chart', ['Paved', 'Unpaved', 'Not supplied'], ['Paved', 'Unpaved', 'Not supplied'].map(k => surfaceData.get(k) || 0), ['#ff784f', '#f5c84b', '#c8d2db'], false, 'doughnut');
    const conditionData = tally(visible, condition, length);
    chart('condition-chart', ['Good', 'Fair', 'Poor', 'Not supplied'], ['Good', 'Fair', 'Poor', 'Not supplied'].map(k => conditionData.get(k) || 0), ['#34d889', '#ffd166', '#ff6176', '#c8d2db'], false, 'polarArea');
    const regionData = tally(visible, p => value(p, 'Region') || 'Not supplied', length);
    const regions = Array.from(new Set(features.map(f => value(f.properties || {}, 'Region') || 'Not supplied'))).sort();
    chart('region-chart', regions, regions.map(k => regionData.get(k) || 0), '#ff8b51', true);
    const classes = [...new Set(features.map(feature => category(feature.properties || {}, 'Road Cla 1')))].sort();
    const classLengths = tally(visible, p => category(p, 'Road Cla 1'), length);
    chart('class-chart', classes.map(k => /^[MABC]$/.test(k) ? `Class ${k}` : k), classes.map(k => classLengths.get(k) || 0), '#c68bff');
    const trafficGroups = new Map(classes.map(k => [k, 0]));
    for (const feature of visible) {
      const p = feature.properties || {};
      const key = category(p, 'Road Cla 1');
      const aadt = recordedNumber(p, 'Aadt 2026 Live');
      if (trafficGroups.has(key) && aadt !== null) {
        trafficGroups.set(key, trafficGroups.get(key) + (length(p) || 0));
      }
    }
    chart('traffic-chart', classes.map(k => /^[MABC]$/.test(k) ? `Class ${k}` : k), classes.map(k => trafficGroups.get(k)), '#ffaf62', false, 'line');
    const risk = tally(visible, p => category(p, 'Road Safety Risk Band'), length);
    const risks = ['Low', 'Moderate', 'High', 'Critical', 'Not supplied'];
    chart('safety-chart', risks, risks.map(k => risk.get(k) || 0), ['#34d889', '#c68bff', '#ffd166', '#ff6176', '#c8d2db'], false, 'pie');
    const priority = tally(visible, p => category(p, 'Intervention Priority Band'), length);
    const priorities = ['Low', 'Moderate', 'High', 'Critical', 'Not supplied'];
    chart('priority-chart', priorities, priorities.map(k => priority.get(k) || 0), ['#34d889', '#c68bff', '#ffd166', '#ff6176', '#c8d2db'], false, 'radar');
    if (activeMode === 'roads') window.TransportChartGallery?.render('roads', features, visible, item => length(item.properties || {}) || 0);
  }

  const transportModes = {
    bridges: {
      title: 'Bridges', files: ['bridges.geojson'], colour: '#438ee1', countLabel: 'Bridges on map', statusUnit: 'bridges on map',
      group: p => category(p, 'Maintenance_Region'),
      description: 'The FY 2026/27 BMS register contains 552 Bridges. Only 527 have positions verified against a mapped road link; 25 remain in the table pending spatial verification.',
      fields: [['Bridge', 'Bridge_Name'], ['Bridge number', 'Bridge_Number'], ['Region', 'Maintenance_Region']],
    },
    culverts: {
      title: 'Major Culverts', files: ['major_culverts.geojson'], colour: '#77b2f1', countLabel: 'Major Culverts on map', statusUnit: 'major culverts on map',
      group: p => category(p, 'Maintenance_Region'),
      description: 'The BMS register contains 452 Major Culverts. Only 425 have positions verified against a mapped road link; 27 remain in the table pending spatial verification.',
      fields: [['Culvert number', 'Culvert_Number'], ['Road number', 'Link_Number'], ['Region', 'Maintenance_Region']],
    },
    traffic: {
      title: 'Traffic count stations', files: ['traffic_count_stations.geojson'], colour: '#e5ce7d', countLabel: 'Stations on map', statusUnit: 'stations on map',
      group: p => category(p, 'REGION'),
      description: 'Mapped station locations by region. Counts of stations are not traffic volumes.',
      fields: [['Station', 'TCS_NAME'], ['Road', 'Link_Name'], ['Region', 'REGION']],
    },
    ferries: {
      title: 'Ferry crossings', files: ['ferry_crossings.geojson'], colour: '#438ee1', countLabel: 'Crossings on map', statusUnit: 'crossings on map',
      group: p => category(p, 'Category'),
      description: 'Mapped ferry crossing locations and their available operating categories.',
      fields: [['Crossing', 'Ferry_cros'], ['Water body', 'Water_body'], ['Category', 'Category']],
    },
    aviation: {
      title: 'Aviation sites', files: ['airports.geojson'], colour: '#c4a9f3', countLabel: 'Sites on map', statusUnit: 'sites on map',
      group: p => category(p, 'Category'),
      description: 'Mapped airports and airfields by their available category. The layer does not establish a complete aviation inventory.',
      fields: [['Site', 'F9'], ['Category', 'Category']],
    },
    safety: {
      title: 'Traffic incidents', files: ['kampala_traffic_incidents.geojson'], colour: '#f69b91', countLabel: 'Incidents on map', statusUnit: 'incidents on map',
      group: p => category(p, 'severity'),
      description: 'Mapped incidents are concentrated around Kampala. They must not be interpreted as a national incident population.',
      fields: [['Incident', 'incident_type'], ['Severity', 'severity'], ['Road', 'road_name'], ['Date', 'date']],
    },
    freight: {
      title: 'Weighbridge facilities', files: ['weighbridges.geojson'], colour: '#eeaf73', countLabel: 'Facilities on map', statusUnit: 'facilities on map',
      group: p => category(p, 'Status'),
      description: 'Mapped weighbridge locations by available status. Proposed facilities are not counted as operational.',
      fields: [['Facility', 'Weighbridge Name'], ['Status', 'Status']],
    },
    rail: {
      title: 'Rail alignments', files: ['mgr.geojson', 'sgr_alignment.geojson'], colour: '#a58de6', countLabel: 'Mapped rail geometry', statusUnit: 'rail on map',
      group: p => category(p, '_transportKind'),
      description: 'Mapped MGR line segments and one SGR alignment. Charts show geometry-derived kilometres, not verified operational route length or a national total. The SGR alignment is not evidence of an operating railway.',
      fields: [['Name', 'Name'], ['Status', 'Status']],
    },
  };

  const tabHeadings = {
    roads: ['Follow Uganda\'s roads.', 'Compare mapped kilometres.'],
    bridges: ['Explore Uganda\'s bridges.', 'Inspect mapped crossings.'],
    culverts: ['Explore major culverts.', 'Inspect drainage structures.'],
    traffic: ['Explore traffic stations.', 'See where counts are taken.'],
    ferries: ['Explore ferry crossings.', 'Connect across water.'],
    aviation: ['Explore aviation sites.', 'See mapped air access.'],
    safety: ['Explore traffic incidents.', 'Find mapped safety patterns.'],
    freight: ['Explore freight facilities.', 'See mapped weighbridges.'],
    rail: ['Explore Uganda\'s rail.', 'Compare mapped alignments.'],
  };
  function updateIntro(key) {
    const [first, second] = tabHeadings[key];
    const heading = $('page-title');
    const emphasis = document.createElement('em'); emphasis.textContent = second;
    heading.replaceChildren(document.createTextNode(first), document.createElement('br'), emphasis);
    $('intro-kicker').textContent = `UGANDA TRANSPORT / ${key === 'culverts' ? 'MAJOR CULVERTS' : key.toUpperCase()}`;
    $('intro-note').textContent = key === 'roads'
      ? 'Explore mapped National Road Network and DUCAR geometry. Filter by sub-region, surface and condition. Road charts report mapped kilometres, not a national total.'
      : transportModes[key].description;
    $('intro-aside-title').textContent = key === 'roads' ? 'Road map, charts and tables' : `${transportModes[key].title}: map, charts and tables`;
    $('intro-table-link').href = `./data-explorer.html?dataset=${encodeURIComponent(({ roads: 'roads', bridges: 'bridges', culverts: 'culverts', traffic: 'stations', ferries: 'ferries', aviation: 'aviation', safety: 'safety', freight: 'freight', rail: 'mgr' })[key])}`;
    $('intro-table-link').firstChild.textContent = `Open ${key === 'culverts' ? 'major culvert' : key} tables `;
  }

  async function loadMode(key) {
    if (!modeCache.has(key)) {
      const spec = transportModes[key];
      modeCache.set(key, Promise.all(spec.files.map(async file => {
        const response = await fetch(`geo/${file}?v=20261029-bms`);
        if (!response.ok) throw new Error(`${file} returned ${response.status}`);
        const data = await response.json();
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error(`${file} is not a GeoJSON feature collection`);
        const kind = file === 'bridges.geojson' ? 'Bridges' : file === 'major_culverts.geojson' ? 'Major Culverts' :
          file === 'mgr.geojson' ? 'MGR mapped segments' : file === 'sgr_alignment.geojson' ? 'SGR alignment' :
          file === 'ferry_crossings.geojson' && key === 'water' ? 'Ferry crossings' : '';
        return data.features.filter(feature => feature.geometry && feature.properties &&
          (feature.geometry.type === 'Point' || (key === 'rail' && ['LineString', 'MultiLineString'].includes(feature.geometry.type))))
          .map(feature => ({ ...feature, properties: { ...feature.properties, _transportKind: kind } }));
      })).then(groups => groups.flat()));
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
      const entry = properties[key];
      if (entry === null || entry === undefined || entry === '') continue;
      const row = document.createElement('div'); row.append(text(`${label}: ${entry}`)); panel.append(row);
    }
    return panel;
  }

  const markerShapes = {
    bridges: '<path d="M3 16h18M5 16V9l4-3 3 3 3-3 4 3v7M8 16v-4m8 4v-4"/>',
    culverts: '<path d="M3 17h18M5 17V9h14v8M8 17v-5a4 4 0 0 1 8 0v5M4 7h16"/>',
    traffic: '<path d="M5 20V4m14 16V4M5 8h14M8 13h2m4 0h2M9 8v6m6-6v6"/>',
    ferries: '<path d="M3 15h18l-3 4H6zM8 15V6h8v9M8 9h8M4 21c2-1 4-1 6 0 2-1 4-1 6 0 2-1 4-1 6 0"/>',
    aviation: '<path d="M12 2v20m0-8L3 17v-3l9-5 9 5v3zM9 20l3-2 3 2"/>',
    safety: '<path d="M12 3 2 21h20L12 3Zm0 6v5m0 3v1"/>',
    freight: '<path d="M2 7h12v10H2zM14 10h4l4 4v3h-8zM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
  };
  const markerIcons = new Map();
  function markerIcon(key, colour) {
    if (markerIcons.has(key)) return markerIcons.get(key);
    const svg = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${markerShapes[key] || markerShapes.bridges}</svg>`;
    const icon = L.divIcon({ className: 'transport-marker', html: `<span class="marker-shadow"></span><span class="marker-pin" style="--marker-colour:${colour}">${svg}</span>`, iconSize: [38, 46], iconAnchor: [19, 43], popupAnchor: [0, -39] });
    markerIcons.set(key, icon);
    return icon;
  }

  function drawModePoints(items, spec) {
    if (roadLayer) map.removeLayer(roadLayer);
    if (pointLayer) map.removeLayer(pointLayer);
    pointLayer = L.geoJSON(items, {
      pointToLayer: (_, latlng) => L.marker(latlng, { icon: markerIcon(activeMode, spec.colour), keyboard: true }),
      style: feature => ({ color: feature.properties?._transportKind === 'SGR alignment' ? '#7657b7' : feature.properties?._transportKind === 'Major Culverts' ? '#77b2f1' : spec.colour, weight: 2.5, opacity: .9 }),
      onEachFeature: (feature, layer) => layer.bindPopup(pointPopup(feature.properties || {}, spec), { maxWidth: 290 }),
    }).addTo(map);
    showUgandaExtent();
  }

  async function showMode(key) {
    activeMode = key;
    updateIntro(key);
    showUgandaExtent();
    document.querySelector('.section-tabs a[href="./"]')?.removeAttribute('aria-current');
    for (const button of document.querySelectorAll('.section-tabs button[data-mode]')) {
      if (button.dataset.mode === key) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    const isRoad = key === 'roads';
    document.querySelector('.control-card').hidden = !isRoad;
    document.querySelector('.legend-card').hidden = !isRoad;
    $('road-analysis').hidden = !isRoad;
    $('mode-detail').hidden = isRoad;
    if (isRoad) {
      if (pointLayer) { map.removeLayer(pointLayer); pointLayer = null; }
      $('metric-kind').textContent = 'ROADS';
      $('metric-label').textContent = 'Mapped road length (km)';
      $('metric-note').textContent = 'Search and charts use the mapped subset. The expanded road backdrop is visual only.';
      update();
      showUgandaExtent();
      return;
    }
    const spec = transportModes[key];
    $('map-status').textContent = `Loading ${spec.title.toLowerCase()}`;
    $('mode-title').textContent = spec.title;
    $('mode-description').textContent = spec.description;
    $('mode-table-link').href = `./data-explorer.html?dataset=${encodeURIComponent(({ bridges: 'bridges', culverts: 'culverts', traffic: 'stations', ferries: 'ferries', aviation: 'aviation', safety: 'safety', freight: 'freight', rail: 'mgr' })[key])}`;
    try {
      const items = await loadMode(key);
      if (activeMode !== key) return;
      drawModePoints(items, spec);
      const groups = key === 'rail' ? items.reduce((result, item) => {
        const group = spec.group(item.properties || {});
        result.set(group, (result.get(group) || 0) + mappedLineKm(item.geometry));
        return result;
      }, new Map()) : tally(items, spec.group, () => 1);
      const labels = [...groups.keys()].sort((a, b) => a.localeCompare(b));
      chart('mode-chart', labels, labels.map(label => groups.get(label)), spec.colour, true);
      $('mode-chart').setAttribute('aria-label', key === 'rail' ? 'Mapped rail geometry by alignment type in kilometres' : `${spec.title} counts by category`);
      $('mode-chart-unit').textContent = key === 'rail' ? 'Mapped rail geometry (km)' : 'Mapped feature counts';
      window.TransportChartGallery?.render(key, items, items, item => key === 'rail' ? mappedLineKm(item.geometry) : 1);
      $('map-status').textContent = key === 'rail' ? 'MGR and SGR on map' : `${spec.title} on map`;
      $('metric-kind').textContent = key.toUpperCase();
      $('metric-value').textContent = format.format(key === 'rail' ? items.reduce((sum, item) => sum + mappedLineKm(item.geometry), 0) : items.length);
      $('metric-label').textContent = key === 'rail' ? 'Mapped rail geometry (km)' : spec.countLabel;
      $('metric-note').textContent = key === 'rail' ? 'Geometry-derived length, not verified operational route length.' : 'Mapped subset only. Not a national total.';
    } catch (error) {
      if (activeMode !== key) return;
      $('map-status').textContent = 'Layer unavailable';
      $('mode-description').textContent = `${spec.description} This layer could not be loaded.`;
      $('metric-value').textContent = 'Not supplied';
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
    if (activeMode === 'roads') {
      const publicFeatures = features.filter(matches).map(feature => {
        const p = feature.properties || {};
        return { type: 'Feature', geometry: feature.geometry, properties: {
          'Road ID': value(p, 'Link Id 1'), 'Road name': title(p), Network: value(p, 'Road Type') || 'National Road Network',
          'Functional Class': category(p, 'Road Cla 1'), 'Surface Type': surface(p), 'Sub-Region': category(p, 'Region'),
          Condition: condition(p), 'Mapped km': length(p),
        } };
      });
      const headers = ['Road ID', 'Road name', 'Network', 'Functional Class', 'Surface Type', 'Sub-Region', 'Condition', 'Mapped km'];
      if (fileType === 'geojson') downloadJson({ type: 'FeatureCollection', features: publicFeatures }, 'uganda-mapped-roads.geojson', 'application/geo+json');
      else if (fileType === 'json') downloadJson(publicFeatures.map(feature => feature.properties), 'uganda-mapped-roads.json', 'application/json');
      else downloadCsv(headers, publicFeatures.map(feature => headers.map(key => feature.properties[key])), 'uganda-mapped-roads.csv');
      return;
    }
    const spec = transportModes[activeMode];
    if (!spec) return;
    try {
      const items = await loadMode(activeMode);
      const headers = ['Feature type', ...spec.fields.map(([label]) => label)];
      const rows = items.map(item => [item.properties?._transportKind || spec.title, ...spec.fields.map(([, key]) => item.properties?.[key])]);
      const publicFeatures = items.map((item, index) => ({ type: 'Feature', geometry: item.geometry, properties: Object.fromEntries(headers.map((header, column) => [header, rows[index][column]])) }));
      if (fileType === 'geojson') downloadJson({ type: 'FeatureCollection', features: publicFeatures }, `uganda-${activeMode}-map.geojson`, 'application/geo+json');
      else if (fileType === 'json') downloadJson(publicFeatures.map(feature => feature.properties), `uganda-${activeMode}-map.json`, 'application/json');
      else downloadCsv(headers, rows, `uganda-${activeMode}-map.csv`);
    } catch (error) {
      $('map-status').textContent = 'Download unavailable';
      console.error('Map CSV download failed', error);
    }
  });

  for (const button of document.querySelectorAll('.section-tabs button[data-mode]')) {
    button.addEventListener('click', () => {
      showMode(button.dataset.mode);
      (button.dataset.mode === 'roads' ? $('road-analysis') : $('explore')).scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  Promise.all(['network.geojson', 'geo/ducar_all_roads_2025.geojson'].map(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    const data = await response.json();
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error(`Invalid GeoJSON in ${path}`);
    return data.features;
  })).then(([national, ducarFile]) => {
    const ducar = ducarFile.filter(feature => feature.geometry && feature.properties?.governance_department === 'DDUCAR MoWT')
      .map(feature => ({ ...feature, properties: {
        'Link Id 1': feature.properties.link_id, 'Link Name': feature.properties.road_name,
        'Road Cla 1': feature.properties.functional_class, 'Road Type': 'DUCAR',
        'Surface  1': ['Paved', 'Unpaved'].includes(feature.properties.pavement_class) ? feature.properties.pavement_class : 'Not supplied',
        'Length Km': feature.properties.length_km,
      } }));
    features = [...national.filter(feature => feature.geometry && feature.properties), ...ducar];
    const regions = Array.from(new Set(features.map(f => value(f.properties, 'Region')).filter(Boolean))).sort();
    for (const region of regions) $('region-filter').add(new Option(region, region));
    showUgandaExtent();
    update();
    const requestedMode = new URLSearchParams(window.location.search).get('mode');
    if (requestedMode && (requestedMode === 'roads' || transportModes[requestedMode])) showMode(requestedMode);
  }).catch(error => { $('map-status').textContent = 'Road geometry unavailable'; $('selection-summary').textContent = error.message; });

})();
