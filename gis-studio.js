(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const format = new Intl.NumberFormat('en-UG', { maximumFractionDigits: 1 });
  const filters = { search: '', region: '', surface: '', condition: '' };
  const map = L.map('gis-map', { zoomControl: false, preferCanvas: true, scrollWheelZoom: false }).setView([1.3, 32.3], 7);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Imagery: Esri and contributors',
  }).addTo(map);
  map.createPane('hybridLabels');
  map.getPane('hybridLabels').style.zIndex = 650;
  map.getPane('hybridLabels').style.pointerEvents = 'none';
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    pane: 'hybridLabels', maxZoom: 19, attribution: 'Labels and borders: Esri',
  }).addTo(map);
  let features = [];
  let roadLayer = null;
  let pointLayer = null;
  let activeMode = 'explore';
  const modeCache = new Map();
  let charts = {};
  const value = (properties, key) => properties?.[key];
  const condition = properties => ['Good', 'Fair', 'Poor'].includes(value(properties, 'Condition')) ? value(properties, 'Condition') : 'Not recorded';
  const surface = properties => ['Paved', 'Unpaved'].includes(value(properties, 'Surface  1')) ? value(properties, 'Surface  1') : 'Not recorded';
  const length = properties => { const n = Number(value(properties, 'Length Km')); return Number.isFinite(n) && n >= 0 ? n : null; };
  const recordedNumber = (properties, key) => {
    const raw = value(properties, key);
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const category = (properties, key) => {
    const raw = value(properties, key);
    return typeof raw === 'string' && raw.trim() ? raw.trim() : 'Not recorded';
  };
  const title = properties => value(properties, 'Link Name') || value(properties, 'Road No 1') || 'Unnamed road link';
  const text = item => document.createTextNode(String(item ?? 'Not recorded'));

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
      ['Road number', value(properties, 'Road No 1')], ['Surface', surface(properties)],
      ['Condition', condition(properties)], ['Sub-region', value(properties, 'Region')],
      ['Recorded length', length(properties) === null ? 'Not recorded' : `${format.format(length(properties))} km`],
    ]) {
      const row = document.createElement('div'); const lead = document.createElement('span');
      lead.append(text(`${label}: `)); row.append(lead, text(entry)); panel.append(row);
    }
    return panel;
  }

  function drawMap(visible) {
    if (roadLayer) map.removeLayer(roadLayer);
    roadLayer = L.geoJSON(visible, {
      style: () => ({ color: '#27d6df', weight: 1.8, opacity: .77 }),
      onEachFeature: (feature, layer) => {
        layer.bindPopup(popup(feature.properties || {}), { maxWidth: 300 });
        layer.on('mouseover', () => layer.setStyle({ weight: 5, opacity: 1 }));
        layer.on('mouseout', () => roadLayer.resetStyle(layer));
      }
    }).addTo(map);
  }

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

  function chart(id, labels, values, colours, horizontal = false) {
    charts[id]?.destroy();
    charts[id] = new Chart($(id), {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: colours, borderRadius: 5, maxBarThickness: 36 }] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => format.format(context.parsed[horizontal ? 'x' : 'y']) } } },
        scales: {
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
    if (activeMode === 'explore' || activeMode === 'roads') drawMap(visible);
    const km = visible.reduce((sum, feature) => sum + (length(feature.properties || {}) || 0), 0);
    const paved = visible.filter(feature => surface(feature.properties || {}) === 'Paved')
      .reduce((sum, feature) => sum + (length(feature.properties || {}) || 0), 0);
    $('metric-links').textContent = format.format(visible.length);
    $('metric-km').textContent = format.format(km);
    $('metric-paved').textContent = format.format(paved);
    $('selection-summary').textContent = `${format.format(visible.length)} of ${format.format(features.length)} mapped links shown`;
    $('map-status').textContent = `${format.format(visible.length)} links visible`;
    const surfaceData = tally(visible, surface, length);
    chart('surface-chart', ['Paved', 'Unpaved', 'Not recorded'], ['Paved', 'Unpaved', 'Not recorded'].map(k => surfaceData.get(k) || 0), ['#40c6d3', '#8cb4c9', '#a4b2c0']);
    const conditionData = tally(visible, condition, () => 1);
    chart('condition-chart', ['Good', 'Fair', 'Poor', 'Not recorded'], ['Good', 'Fair', 'Poor', 'Not recorded'].map(k => conditionData.get(k) || 0), ['#37e5cb', '#f6c760', '#fb7473', '#a4b2c0']);
    const regionData = tally(visible, p => value(p, 'Region') || 'Not recorded', length);
    const regions = Array.from(new Set(features.map(f => value(f.properties || {}, 'Region') || 'Not recorded'))).sort();
    chart('region-chart', regions, regions.map(k => regionData.get(k) || 0), '#40c6d3', true);
    const classes = ['M', 'A', 'B', 'C'];
    const classLengths = tally(visible, p => category(p, 'Road Cla 1'), length);
    chart('class-chart', classes.map(k => `Class ${k}`), classes.map(k => classLengths.get(k) || 0), '#48cbd6');
    const trafficGroups = new Map(classes.map(k => [k, { total: 0, count: 0 }]));
    for (const feature of visible) {
      const p = feature.properties || {};
      const key = category(p, 'Road Cla 1');
      const aadt = recordedNumber(p, 'Aadt 2026 Live');
      if (trafficGroups.has(key) && aadt !== null) {
        const group = trafficGroups.get(key);
        group.total += aadt;
        group.count++;
      }
    }
    chart('traffic-chart', classes.map(k => `Class ${k}`), classes.map(k => {
      const group = trafficGroups.get(k);
      return group.count ? group.total / group.count : null;
    }), '#68b3db');
    const risk = tally(visible, p => category(p, 'Road Safety Risk Band'), () => 1);
    const risks = ['Low', 'Moderate', 'High', 'Critical', 'Not recorded'];
    chart('safety-chart', risks, risks.map(k => risk.get(k) || 0), ['#35d3bf', '#a2cbd3', '#f3bd64', '#ed817c', '#8c9da8'], true);
    const priority = tally(visible, p => category(p, 'Intervention Priority Band'), () => 1);
    const priorities = ['Low', 'Moderate', 'High', 'Critical', 'Not recorded'];
    chart('priority-chart', priorities, priorities.map(k => priority.get(k) || 0), ['#35d3bf', '#a2cbd3', '#f3bd64', '#ed817c', '#8c9da8'], true);
    const coverageFields = [
      ['Length', p => length(p) !== null], ['Surface', p => surface(p) !== 'Not recorded'],
      ['Condition', p => condition(p) !== 'Not recorded'], ['Sub-region', p => category(p, 'Region') !== 'Not recorded'],
      ['AADT', p => recordedNumber(p, 'Aadt 2026 Live') !== null],
      ['Safety', p => category(p, 'Road Safety Risk Band') !== 'Not recorded'],
      ['Priority', p => category(p, 'Intervention Priority Band') !== 'Not recorded'],
    ];
    chart('coverage-chart', coverageFields.map(([label]) => label), coverageFields.map(([, hasValue]) =>
      visible.filter(feature => hasValue(feature.properties || {})).length), '#48cbd6', true);
  }

  const transportModes = {
    bridges: {
      title: 'Bridges and major culverts', files: ['bridges.geojson', 'major_culverts.geojson'], colour: '#77d4ff',
      group: p => category(p, '_transportKind'),
      description: 'Mapped bridge and major culvert points are shown separately. This layer is a subset, not the complete FY 2026/27 structures register.',
      fields: [['Structure', 'Bridge_Name'], ['Bridge number', 'Bridge_Number'], ['Culvert number', 'Culvert_Number'], ['Region', 'Maintenance_Region']],
    },
    traffic: {
      title: 'Traffic count stations', files: ['traffic_count_stations.geojson'], colour: '#e5ce7d',
      group: p => category(p, 'REGION'),
      description: 'Mapped station locations by region. Counts of stations are not traffic volumes.',
      fields: [['Station', 'TCS_NAME'], ['Road link', 'Link_Name'], ['Region', 'REGION']],
    },
    ferries: {
      title: 'Ferry crossings', files: ['ferry_crossings.geojson'], colour: '#73d6c7',
      group: p => category(p, 'Category'),
      description: 'Mapped ferry crossing locations and their recorded operating categories.',
      fields: [['Crossing', 'Ferry_cros'], ['Water body', 'Water_body'], ['Category', 'Category']],
    },
    aviation: {
      title: 'Aviation sites', files: ['airports.geojson'], colour: '#c4a9f3',
      group: p => category(p, 'Category'),
      description: 'Mapped airports and airfields by their recorded category. The layer does not establish a complete aviation inventory.',
      fields: [['Site', 'F9'], ['Category', 'Category']],
    },
    safety: {
      title: 'Recorded traffic incidents', files: ['kampala_traffic_incidents.geojson'], colour: '#f69b91',
      group: p => category(p, 'severity'),
      description: 'Mapped incident records are concentrated around Kampala. They must not be interpreted as a national incident population.',
      fields: [['Incident', 'incident_type'], ['Severity', 'severity'], ['Road', 'road_name'], ['Date', 'date']],
    },
    freight: {
      title: 'Weighbridge facilities', files: ['weighbridges.geojson'], colour: '#eeaf73',
      group: p => category(p, 'Status'),
      description: 'Mapped weighbridge locations by recorded status. Proposed facilities are not counted as operational.',
      fields: [['Facility', 'Weighbridge Name'], ['Status', 'Status']],
    },
    'rail-water': {
      title: 'Rail and waterways', files: ['mgr.geojson', 'sgr_alignment.geojson', 'ferry_crossings.geojson'], colour: '#79d9da',
      group: p => category(p, '_transportKind'),
      description: 'Mapped MGR line segments, one SGR alignment and ferry crossing points are shown. The SGR alignment is not evidence of an operating railway. These are mapped subsets, not national totals.',
      fields: [['Name', 'Name'], ['Status', 'Status'], ['Crossing', 'Ferry_cros'], ['Water body', 'Water_body']],
    },
  };

  async function loadMode(key) {
    if (!modeCache.has(key)) {
      const spec = transportModes[key];
      modeCache.set(key, Promise.all(spec.files.map(async file => {
        const response = await fetch(`geo/${file}`);
        if (!response.ok) throw new Error(`${file} returned ${response.status}`);
        const data = await response.json();
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error(`${file} is not a GeoJSON feature collection`);
        const kind = file === 'bridges.geojson' ? 'Bridges' : file === 'major_culverts.geojson' ? 'Major Culverts' :
          file === 'mgr.geojson' ? 'MGR mapped segments' : file === 'sgr_alignment.geojson' ? 'SGR alignment' :
          file === 'ferry_crossings.geojson' && key === 'rail-water' ? 'Ferry crossings' : '';
        return data.features.filter(feature => feature.geometry && feature.properties &&
          (feature.geometry.type === 'Point' || (key === 'rail-water' && ['LineString', 'MultiLineString'].includes(feature.geometry.type))))
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

  function drawModePoints(items, spec) {
    if (roadLayer) map.removeLayer(roadLayer);
    if (pointLayer) map.removeLayer(pointLayer);
    pointLayer = L.geoJSON(items, {
      pointToLayer: (_, latlng) => L.circleMarker(latlng, { radius: 6, color: '#081520', weight: 1.4, fillColor: spec.colour, fillOpacity: .92 }),
      style: feature => ({ color: feature.properties?._transportKind === 'SGR alignment' ? '#f2ad52' : spec.colour, weight: 2.5, opacity: .9 }),
      onEachFeature: (feature, layer) => layer.bindPopup(pointPopup(feature.properties || {}, spec), { maxWidth: 290 }),
    }).addTo(map);
    const bounds = pointLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(.12), { maxZoom: 10 });
  }

  async function showMode(key) {
    activeMode = key;
    document.querySelector('.section-tabs a[href="./"]')?.removeAttribute('aria-current');
    for (const button of document.querySelectorAll('.section-tabs button[data-mode]')) {
      if (button.dataset.mode === key) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    const isRoad = key === 'explore' || key === 'roads';
    document.querySelector('.control-card').hidden = !isRoad;
    document.querySelector('.legend-card').hidden = !isRoad;
    $('road-analysis').hidden = !isRoad;
    $('mode-detail').hidden = isRoad;
    if (isRoad) {
      if (pointLayer) { map.removeLayer(pointLayer); pointLayer = null; }
      $('metric-label-1').textContent = 'Road links';
      $('metric-label-2').textContent = 'Recorded km';
      $('metric-label-3').textContent = 'Paved km';
      $('metric-note').textContent = 'Map sample only. Not the national network total.';
      update();
      if (roadLayer?.getBounds().isValid()) map.fitBounds(roadLayer.getBounds().pad(.07));
      return;
    }
    const spec = transportModes[key];
    $('map-status').textContent = `Loading ${spec.title.toLowerCase()}`;
    $('mode-title').textContent = spec.title;
    $('mode-description').textContent = spec.description;
    try {
      const items = await loadMode(key);
      if (activeMode !== key) return;
      drawModePoints(items, spec);
      const groups = tally(items, spec.group, () => 1);
      const labels = [...groups.keys()].sort((a, b) => a.localeCompare(b));
      chart('mode-chart', labels, labels.map(label => groups.get(label)), spec.colour, true);
      $('map-status').textContent = `${format.format(items.length)} mapped records visible`;
      $('metric-links').textContent = format.format(items.length);
      $('metric-label-1').textContent = 'Mapped records';
      $('metric-km').textContent = format.format(labels.length);
      $('metric-label-2').textContent = 'Categories';
      $('metric-paved').textContent = key === 'rail-water' ? format.format(items.filter(item => item.geometry?.type === 'Point').length) : format.format(items.length);
      $('metric-label-3').textContent = key === 'rail-water' ? 'Ferry points' : 'Located points';
      $('metric-note').textContent = 'Mapped subset only. Not a national total.';
    } catch (error) {
      if (activeMode !== key) return;
      $('map-status').textContent = 'Layer unavailable';
      $('mode-description').textContent = `${spec.description} This layer could not be loaded.`;
      $('metric-links').textContent = 'Not recorded';
      $('metric-km').textContent = 'Not recorded';
      $('metric-paved').textContent = 'Not recorded';
      console.error('Transport layer unavailable', error);
    }
  }

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

  fetch('network.geojson').then(response => {
    if (!response.ok) throw new Error(`Road geometry returned ${response.status}`);
    return response.json();
  }).then(data => {
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid GeoJSON feature collection');
    features = data.features.filter(feature => feature.geometry && feature.properties);
    const regions = Array.from(new Set(features.map(f => value(f.properties, 'Region')).filter(Boolean))).sort();
    for (const region of regions) $('region-filter').add(new Option(region, region));
    const bounds = L.geoJSON(features).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(.07));
    update();
    const requestedMode = new URLSearchParams(window.location.search).get('mode');
    if (requestedMode && (requestedMode === 'roads' || transportModes[requestedMode])) showMode(requestedMode);
  }).catch(error => { $('map-status').textContent = 'Road geometry unavailable'; $('selection-summary').textContent = error.message; });

})();
