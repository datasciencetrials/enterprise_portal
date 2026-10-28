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
  let activeMode = 'roads';
  const modeCache = new Map();
  let charts = {};
  const value = (properties, key) => properties?.[key];
  const condition = properties => ['Good', 'Fair', 'Poor'].includes(value(properties, 'Condition')) ? value(properties, 'Condition') : 'Not supplied';
  const surface = properties => ['Paved', 'Unpaved'].includes(value(properties, 'Surface  1')) ? value(properties, 'Surface  1') : 'Not supplied';
  const length = properties => { const raw = value(properties, 'Length Km'); if (raw === null || raw === undefined || raw === '') return null; const n = Number(raw); return Number.isFinite(n) && n >= 0 ? n : null; };
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
  const title = properties => value(properties, 'Link Name') || value(properties, 'Road No 1') || 'Unnamed road section';
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

  function drawMap(visible) {
    if (roadLayer) map.removeLayer(roadLayer);
    roadLayer = L.geoJSON(visible, {
      style: feature => ({ color: feature.properties?.['Road Type'] === 'DUCAR' ? '#e7bd61' : '#ee884e', weight: 1.8, opacity: .84 }),
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
    if (activeMode === 'roads') drawMap(visible);
    const km = visible.reduce((sum, feature) => sum + (length(feature.properties || {}) || 0), 0);
    const paved = visible.filter(feature => surface(feature.properties || {}) === 'Paved')
      .reduce((sum, feature) => sum + (length(feature.properties || {}) || 0), 0);
    $('metric-links').textContent = format.format(visible.length);
    $('metric-km').textContent = format.format(km);
    $('metric-paved').textContent = format.format(paved);
    $('selection-summary').textContent = `${format.format(visible.length)} of ${format.format(features.length)} mapped road sections shown`;
    $('map-status').textContent = `${format.format(visible.length)} road sections on map`;
    const surfaceData = tally(visible, surface, length);
    chart('surface-chart', ['Paved', 'Unpaved', 'Not supplied'], ['Paved', 'Unpaved', 'Not supplied'].map(k => surfaceData.get(k) || 0), ['#ee884e', '#e7bd61', '#a4b2c0']);
    const conditionData = tally(visible, condition, () => 1);
    chart('condition-chart', ['Good', 'Fair', 'Poor', 'Not supplied'], ['Good', 'Fair', 'Poor', 'Not supplied'].map(k => conditionData.get(k) || 0), ['#75b88a', '#f6c760', '#fb7473', '#a4b2c0']);
    const regionData = tally(visible, p => value(p, 'Region') || 'Not supplied', length);
    const regions = Array.from(new Set(features.map(f => value(f.properties || {}, 'Region') || 'Not supplied'))).sort();
    chart('region-chart', regions, regions.map(k => regionData.get(k) || 0), '#ee884e', true);
    const classes = [...new Set(features.map(feature => category(feature.properties || {}, 'Road Cla 1')))].sort();
    const classLengths = tally(visible, p => category(p, 'Road Cla 1'), length);
    chart('class-chart', classes.map(k => /^[MABC]$/.test(k) ? `Class ${k}` : k), classes.map(k => classLengths.get(k) || 0), '#d79568');
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
    chart('traffic-chart', classes.map(k => /^[MABC]$/.test(k) ? `Class ${k}` : k), classes.map(k => {
      const group = trafficGroups.get(k);
      return group.count ? group.total / group.count : null;
    }), '#d79568');
    const risk = tally(visible, p => category(p, 'Road Safety Risk Band'), () => 1);
    const risks = ['Low', 'Moderate', 'High', 'Critical', 'Not supplied'];
    chart('safety-chart', risks, risks.map(k => risk.get(k) || 0), ['#75b88a', '#c9b7d8', '#f3bd64', '#ed817c', '#8c9da8'], true);
    const priority = tally(visible, p => category(p, 'Intervention Priority Band'), () => 1);
    const priorities = ['Low', 'Moderate', 'High', 'Critical', 'Not supplied'];
    chart('priority-chart', priorities, priorities.map(k => priority.get(k) || 0), ['#75b88a', '#c9b7d8', '#f3bd64', '#ed817c', '#8c9da8'], true);
    const coverageFields = [
      ['Length', p => length(p) !== null], ['Surface', p => surface(p) !== 'Not supplied'],
      ['Condition', p => condition(p) !== 'Not supplied'], ['Sub-region', p => category(p, 'Region') !== 'Not supplied'],
      ['AADT', p => recordedNumber(p, 'Aadt 2026 Live') !== null],
      ['Safety', p => category(p, 'Road Safety Risk Band') !== 'Not supplied'],
      ['Priority', p => category(p, 'Intervention Priority Band') !== 'Not supplied'],
    ];
    chart('coverage-chart', coverageFields.map(([label]) => label), coverageFields.map(([, hasValue]) =>
      visible.filter(feature => hasValue(feature.properties || {})).length), '#d79568', true);
  }

  const transportModes = {
    bridges: {
      title: 'Bridges and major culverts', files: ['bridges.geojson', 'major_culverts.geojson'], colour: '#438ee1', countLabel: 'Structures on map', statusUnit: 'structures on map',
      group: p => category(p, '_transportKind'),
      description: 'Mapped bridge and major culvert points are shown separately. This layer is a subset, not the complete FY 2026/27 structures register.',
      fields: [['Structure', 'Bridge_Name'], ['Bridge number', 'Bridge_Number'], ['Culvert number', 'Culvert_Number'], ['Region', 'Maintenance_Region']],
    },
    traffic: {
      title: 'Traffic count stations', files: ['traffic_count_stations.geojson'], colour: '#e5ce7d', countLabel: 'Stations on map', statusUnit: 'stations on map',
      group: p => category(p, 'REGION'),
      description: 'Mapped station locations by region. Counts of stations are not traffic volumes.',
      fields: [['Station', 'TCS_NAME'], ['Road section', 'Link_Name'], ['Region', 'REGION']],
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
      title: 'Rail alignments', files: ['mgr.geojson', 'sgr_alignment.geojson'], colour: '#a58de6', countLabel: 'Mapped rail sections', statusUnit: 'rail sections on map',
      group: p => category(p, '_transportKind'),
      description: 'Mapped MGR line segments and one SGR alignment. The SGR alignment is not evidence of an operating railway. Segment counts are not route length or a national total.',
      fields: [['Name', 'Name'], ['Status', 'Status']],
    },
    water: {
      title: 'Water transport crossings', files: ['ferry_crossings.geojson'], colour: '#438ee1', countLabel: 'Crossings on map', statusUnit: 'water crossings on map',
      group: p => category(p, 'Water_body'),
      description: 'Mapped ferry crossings grouped by named water body. This is not a complete inland waterway network, route or vessel inventory.',
      fields: [['Crossing', 'Ferry_cros'], ['Water body', 'Water_body'], ['Category', 'Category']],
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

  function drawModePoints(items, spec) {
    if (roadLayer) map.removeLayer(roadLayer);
    if (pointLayer) map.removeLayer(pointLayer);
    pointLayer = L.geoJSON(items, {
      pointToLayer: (_, latlng) => L.circleMarker(latlng, { radius: 6, color: '#081520', weight: 1.4, fillColor: spec.colour, fillOpacity: .92 }),
      style: feature => ({ color: feature.properties?._transportKind === 'SGR alignment' ? '#7657b7' : feature.properties?._transportKind === 'Major Culverts' ? '#77b2f1' : spec.colour, weight: 2.5, opacity: .9 }),
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
    const isRoad = key === 'roads';
    document.querySelector('.control-card').hidden = !isRoad;
    document.querySelector('.legend-card').hidden = !isRoad;
    $('road-analysis').hidden = !isRoad;
    $('mode-detail').hidden = isRoad;
    if (isRoad) {
      if (pointLayer) { map.removeLayer(pointLayer); pointLayer = null; }
      $('metric-label-1').textContent = 'Mapped segments';
      $('metric-label-2').textContent = 'Mapped km';
      $('metric-label-3').textContent = 'Paved km';
      $('metric-note').textContent = 'Mapped National and DUCAR geometry only. Not a complete network total.';
      update();
      if (roadLayer?.getBounds().isValid()) map.fitBounds(roadLayer.getBounds().pad(.07));
      return;
    }
    const spec = transportModes[key];
    $('map-status').textContent = `Loading ${spec.title.toLowerCase()}`;
    $('mode-title').textContent = spec.title;
    $('mode-description').textContent = spec.description;
    $('mode-table-link').href = `./data-explorer.html?dataset=${encodeURIComponent(({ bridges: 'bridges', traffic: 'stations', ferries: 'ferries', aviation: 'aviation', safety: 'safety', freight: 'freight', rail: 'mgr', water: 'ferries' })[key])}`;
    try {
      const items = await loadMode(key);
      if (activeMode !== key) return;
      drawModePoints(items, spec);
      const groups = tally(items, spec.group, () => 1);
      const labels = [...groups.keys()].sort((a, b) => a.localeCompare(b));
      chart('mode-chart', labels, labels.map(label => groups.get(label)), spec.colour, true);
      $('map-status').textContent = key === 'rail'
        ? `${format.format(items.filter(item => item.properties?._transportKind === 'MGR mapped segments').length)} MGR sections + ${format.format(items.filter(item => item.properties?._transportKind === 'SGR alignment').length)} SGR alignment on map`
        : `${format.format(items.length)} ${spec.statusUnit}`;
      $('metric-links').textContent = format.format(items.length);
      $('metric-label-1').textContent = spec.countLabel;
      $('metric-km').textContent = format.format(labels.length);
      $('metric-label-2').textContent = 'Categories';
      $('metric-paved').textContent = key === 'rail' ? format.format(items.filter(item => item.properties?._transportKind === 'SGR alignment').length) : format.format(items.length);
      $('metric-label-3').textContent = key === 'rail' ? 'SGR alignment' : 'Located points';
      $('metric-note').textContent = 'Mapped subset only. Not a national total.';
    } catch (error) {
      if (activeMode !== key) return;
      $('map-status').textContent = 'Layer unavailable';
      $('mode-description').textContent = `${spec.description} This layer could not be loaded.`;
      $('metric-links').textContent = 'Not supplied';
      $('metric-km').textContent = 'Not supplied';
      $('metric-paved').textContent = 'Not supplied';
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
    const bounds = L.geoJSON(features).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(.07));
    update();
    const requestedMode = new URLSearchParams(window.location.search).get('mode');
    if (requestedMode && (requestedMode === 'roads' || transportModes[requestedMode])) showMode(requestedMode);
  }).catch(error => { $('map-status').textContent = 'Road geometry unavailable'; $('selection-summary').textContent = error.message; });

})();
