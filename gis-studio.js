(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const format = new Intl.NumberFormat('en-UG', { maximumFractionDigits: 1 });
  const filters = { search: '', region: '', surface: '', condition: '' };
  const map = L.map('gis-map', { zoomControl: false, preferCanvas: true, scrollWheelZoom: false }).setView([1.3, 32.3], 7);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  let features = [];
  let roadLayer = null;
  let charts = {};
  const value = (properties, key) => properties?.[key];
  const condition = properties => ['Good', 'Fair', 'Poor'].includes(value(properties, 'Condition')) ? value(properties, 'Condition') : 'Not recorded';
  const surface = properties => ['Paved', 'Unpaved'].includes(value(properties, 'Surface  1')) ? value(properties, 'Surface  1') : 'Not recorded';
  const length = properties => { const n = Number(value(properties, 'Length Km')); return Number.isFinite(n) && n >= 0 ? n : null; };
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
          update();
        }
      }
    });
  }

  function update() {
    const visible = features.filter(matches);
    drawMap(visible);
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
  }).catch(error => { $('map-status').textContent = 'Road geometry unavailable'; $('selection-summary').textContent = error.message; });

})();
