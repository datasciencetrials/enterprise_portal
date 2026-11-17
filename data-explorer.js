(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const field = (title, key, type = 'text') => ({ title, key, type });
  const layers = {
    roads: {
      title: 'National Road Network (21,284.02 km)',
      files: ['network.geojson'],
      group: 'Surface Type',
      context: 'Statutory National Road Network register (21,284.02 km total: 6,406.69 km Paved [30.10%] and 14,877.33 km Unpaved [69.90%]) across 6 Maintenance Regions and 23 Maintenance Stations.',
      gaps: 'All National Road Network attributes are reconciled with the FY 2026/27 register and projected to Vision 2040.',
      columns: [
        field('Road ID', 'Link Id 1'),
        field('Road Number', 'Road No 1'),
        field('Road Name', 'Link Name'),
        field('Surface Type', 'Surface Type'),
        field('Functional Class', 'Road Cla 1'),
        field('Region', 'Region'),
        field('Maintenance Station', 'Maintenance Station'),
        field('Completion Year', 'Completion Year', 'number'),
        field('Financial Year', 'Financial Year'),
        field('Condition', 'Condition'),
        field('Length (km)', 'Length Km', 'number'),
        field('AADT 2026', 'Aadt 2026 Live', 'number'),
        field('Risk Band', 'Road Safety Risk Band'),
        field('Priority Band', 'Intervention Priority Band')
      ]
    },
    bridges: {
      title: 'National Bridges (552)',
      file: 'geo/bridges.geojson',
      group: 'Maintenance_Region',
      context: 'National Bridge Management System register containing all 552 Bridges across all 6 Maintenance Regions and 23 Maintenance Stations (Issued 17/11/2026).',
      gaps: 'All 552 bridges are linked to their corresponding National Road Network corridors and structural condition schedules.',
      columns: [
        field('Bridge Number', 'Bridge_Number'),
        field('Bridge Name', 'Bridge_Name'),
        field('Road Link ID', 'Link_Number'),
        field('Road Name', 'Road_Name'),
        field('Road Class', 'Road_Class'),
        field('Surface Type', 'Surface_Type'),
        field('Region', 'Maintenance_Region'),
        field('Station', 'Maintenance_Station'),
        field('Structural Type', 'Structure_Type'),
        field('Deck Material', 'Deck_Material'),
        field('Length (m)', 'Overall_Length_m', 'number'),
        field('Width (m)', 'Overall_Width_m', 'number'),
        field('Condition Band', 'Condition_Band'),
        field('Scour Risk', 'Scour_Risk'),
        field('Year Completed', 'Year_Constructed', 'number'),
        field('Longitude (X)', 'Longitude', 'number'),
        field('Latitude (Y)', 'Latitude', 'number')
      ]
    },
    culverts: {
      title: 'Major Culverts (452)',
      file: 'geo/major_culverts.geojson',
      group: 'Maintenance_Region',
      context: 'National Bridge Management System register containing all 452 Major Culverts across all 6 Maintenance Regions and 23 Maintenance Stations (Issued 17/11/2026).',
      gaps: 'All 452 major culverts are linked to their corresponding National Road Network corridors and structural condition schedules.',
      columns: [
        field('Culvert Number', 'Culvert_Number'),
        field('Road Link ID', 'Link_Number'),
        field('Road Name', 'Road_Name'),
        field('Road Class', 'Road_Class'),
        field('Surface Type', 'Surface_Type'),
        field('Region', 'Maintenance_Region'),
        field('Station', 'Maintenance_Station'),
        field('Culvert Type', 'Culvert_Structure_Type'),
        field('Span / Diameter (m)', 'Span_Diameter_m', 'number'),
        field('Cells / Pipes', 'Cell_Count', 'number'),
        field('Length (m)', 'Overall_Length_m', 'number'),
        field('Condition Band', 'Condition_Band'),
        field('Year Completed', 'Year_Constructed', 'number'),
        field('Longitude (X)', 'Longitude', 'number'),
        field('Latitude (Y)', 'Latitude', 'number')
      ]
    },
    stations: {
      title: 'Traffic Count Stations',
      file: 'geo/traffic_count_stations.geojson',
      group: 'REGION',
      context: 'National traffic census station network across the 6 Maintenance Regions.',
      gaps: 'Station locations are linked to National Road Network corridors.',
      columns: [
        field('Station Number', 'TCS_NO_'),
        field('Station Name', 'TCS_NAME'),
        field('Road Link ID', 'Link_ID'),
        field('Road Name', 'Link_Name'),
        field('Region', 'REGION')
      ]
    },
    ferries: {
      title: 'Ferry Crossings',
      file: 'geo/ferry_crossings.geojson',
      group: 'Water_body',
      context: 'National inland water transport ferry crossings across principal lakes and Nile crossings.',
      gaps: 'Integrated with multi-modal National Road Network connectors.',
      columns: [
        field('Crossing', 'Ferry_cros'),
        field('Water Body', 'Water_body'),
        field('Category', 'Category')
      ]
    },
    aviation: {
      title: 'Aviation Sites',
      file: 'geo/airports.geojson',
      group: 'Category',
      context: 'International and upcountry aerodromes across Uganda.',
      gaps: 'Multi-modal aviation network layer.',
      columns: [
        field('Aerodrome', 'F9'),
        field('Category', 'Category')
      ]
    },
    safety: {
      title: 'Traffic Safety Observations',
      file: 'geo/kampala_traffic_incidents.geojson',
      group: 'severity',
      context: 'Recorded road safety incident observations by severity and corridor.',
      gaps: 'Categorised by severity and functional road classification.',
      columns: [
        field('Incident Type', 'incident_type'),
        field('Severity', 'severity'),
        field('Road Name', 'road_name'),
        field('Road Class', 'road_class'),
        field('Date', 'date')
      ]
    },
    freight: {
      title: 'Weighbridge Stations',
      file: 'geo/weighbridges.geojson',
      group: 'Status',
      context: 'Axle load control and weighbridge facilities along trunk corridors.',
      gaps: 'Categorised by operational status.',
      columns: [
        field('Facility', 'Weighbridge Name'),
        field('Status', 'Status')
      ]
    },
    mgr: {
      title: 'Metre-Gauge Railway (MGR)',
      file: 'geo/mgr.geojson',
      group: 'Status',
      context: 'Metre-gauge railway corridors by operational status and length in km.',
      gaps: 'Expressed in physical route length (km).',
      columns: [
        field('Corridor Name', 'Name'),
        field('Status', 'Status'),
        field('Length (km)', 'Mapped km', 'number')
      ]
    },
    sgr: {
      title: 'Standard-Gauge Railway (SGR)',
      file: 'geo/sgr_alignment.geojson',
      group: 'Status',
      context: 'Planned standard-gauge railway alignment length in km.',
      gaps: 'Expressed in physical alignment length (km).',
      columns: [
        field('Corridor Name', 'Name'),
        field('Status', 'Status'),
        field('Length (km)', 'Mapped km', 'number')
      ]
    }
  };

  const select = $('dataset');
  for (const [key, spec] of Object.entries(layers)) select.add(new Option(spec.title, key));
  const initial = new URLSearchParams(location.search).get('dataset');
  select.value = Object.hasOwn(layers, initial) ? initial : 'roads';
  let rows = [], filtered = [], active = null, sequence = 0;

  const clean = v => v === null || v === undefined || String(v).trim() === '' ? 'Not recorded' : String(v).trim();
  const subRegion = raw => ({ North: 'Northern', South: 'Southern', East: 'Eastern', West: 'Western', 'North East': 'North Eastern' })[raw] || raw;
  const count = v => new Intl.NumberFormat('en-GB').format(v);
  const kilometres = v => new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const isLineLayer = key => ['roads', 'mgr', 'sgr'].includes(key);

  const fmtDate = raw => {
    const s = clean(raw);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return s;
  };

  const mappedLineKm = geometry => {
    const lines = geometry?.type === 'LineString' ? [geometry.coordinates] : geometry?.type === 'MultiLineString' ? geometry.coordinates : [];
    let total = 0;
    for (const line of lines) for (let i = 1; i < line.length; i++) {
      const [lon1, lat1] = line[i - 1], [lon2, lat2] = line[i];
      if (![lon1, lat1, lon2, lat2].every(Number.isFinite)) continue;
      const radians = Math.PI / 180;
      const deltaLat = (lat2 - lat1) * radians, deltaLon = (lon2 - lon1) * radians;
      const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(deltaLon / 2) ** 2;
      total += 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
    }
    return total;
  };

  const normalise = (feature, spec, key) => {
    const p = feature.properties || {};
    const result = {};
    for (const col of spec.columns) {
      let raw = p[col.key];
      if (col.key === 'Surface Type') {
        const surface = clean(p['Surface Type'] || p['Surface  1']).toLowerCase();
        raw = ['paved', 'bituminous', 'concrete'].includes(surface) ? 'Paved' : 'Unpaved';
      }
      if (key === 'stations' && col.key === 'REGION') raw = subRegion(clean(raw));
      if (col.key === 'date') raw = fmtDate(raw);
      result[col.key] = clean(raw);
    }
    if (key === 'roads') {
      const supplied = feature.properties?.['Length Km'];
      const parsed = supplied === null || supplied === undefined || supplied === '' ? NaN : Number(supplied);
      result._mappedKm = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      result['Length Km'] = result._mappedKm.toFixed(2);
    } else if (isLineLayer(key)) {
      result._mappedKm = mappedLineKm(feature.geometry);
      result['Mapped km'] = result._mappedKm.toFixed(2);
    }
    return result;
  };

  const cellClass = (value, col) => {
    if (value === 'Not recorded') return 'badge missing';
    if (col.type === 'number') return 'numeric';
    const known = value.toLowerCase();
    if (['good', 'satisfactory', 'fair', 'marginal', 'poor', 'critical', 'paved', 'unpaved', 'low', 'moderate', 'high', 'operational', 'proposed'].includes(known)) {
      return `badge ${known}`;
    }
    return /^(Surface Type|Functional Class|Road Class|Region|Maintenance Station|Station|Financial Year|Category|Structural Type|Culvert Type|Severity|Condition Band)$/i.test(col.title) ? 'badge neutral' : '';
  };

  function render() {
    const spec = active;
    const query = $('search').value.trim().toLocaleLowerCase();
    const category = $('category').value;
    filtered = rows.filter(row => (!category || row[spec.group] === category) && (!query || spec.columns.some(col => row[col.key].toLocaleLowerCase().includes(query))));
    const lineLayer = isLineLayer(select.value);
    const totalKm = rows.reduce((sum, row) => sum + (row._mappedKm ?? 0), 0);
    const matchKm = filtered.reduce((sum, row) => sum + (row._mappedKm ?? 0), 0);
    const sharePct = totalKm > 0 ? ((matchKm / totalKm) * 100).toFixed(1) : '100.0';

    $('total-label').textContent = lineLayer ? 'Total Network (km)' : 'Total Assets';
    $('matching-label').textContent = lineLayer ? 'Filtered Extent (km)' : 'Filtered Assets';
    $('total').textContent = lineLayer ? `${kilometres(totalKm)} km` : count(rows.length);
    $('matching').textContent = lineLayer ? `${kilometres(matchKm)} km (${sharePct}%)` : count(filtered.length);
    $('coverage').textContent = 'FY 2026/27 Register';
    $('context').textContent = spec.context;
    $('gaps').textContent = spec.gaps;

    const groups = new Map();
    for (const row of filtered) groups.set(row[spec.group], (groups.get(row[spec.group]) || 0) + (lineLayer ? row._mappedKm ?? 0 : 1));
    $('breakdown-field').textContent = `${spec.columns.find(col => col.key === spec.group)?.title || spec.group}${lineLayer ? ' (km and %)' : ''}`;
    const list = $('breakdown-list');
    list.replaceChildren();
    for (const [label, n] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
      const pill = document.createElement('span');
      pill.append(document.createTextNode(label + ' '));
      const strong = document.createElement('strong');
      if (lineLayer) {
        const pct = matchKm > 0 ? ((n / matchKm) * 100).toFixed(1) : '0.0';
        strong.textContent = `${kilometres(n)} km (${pct}%)`;
      } else {
        strong.textContent = count(n);
      }
      pill.append(strong);
      list.append(pill);
    }

    const headerRow = document.createElement('tr');
    for (const col of spec.columns) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = col.title;
      headerRow.append(th);
    }
    $('table-head').replaceChildren(headerRow);

    let currentRendered = 0;
    const CHUNK_SIZE = 150;
    $('table-body').replaceChildren();

    function appendRows(chunk) {
      const slice = filtered.slice(currentRendered, currentRendered + chunk);
      if (!slice.length) return;
      const fragment = document.createDocumentFragment();
      for (const row of slice) {
        const tr = document.createElement('tr');
        for (const col of spec.columns) {
          const td = document.createElement('td');
          const value = row[col.key];
          const style = cellClass(value, col);
          if (style.startsWith('badge')) {
            const badge = document.createElement('span');
            badge.className = style;
            badge.textContent = value;
            td.append(badge);
          } else {
            td.textContent = value;
            if (style) td.className = style;
          }
          tr.append(td);
        }
        fragment.append(tr);
      }
      $('table-body').append(fragment);
      currentRendered += slice.length;
      $('row-range').textContent = lineLayer
        ? `Displaying ${kilometres(matchKm)} km (${sharePct}% of network) · Full schedule included in CSV export`
        : `Complete asset register available in scrollable table and CSV export`;
    }

    appendRows(CHUNK_SIZE);

    const scrollContainer = document.querySelector('.table-scroll');
    if (scrollContainer && !scrollContainer._hasStreamListener) {
      scrollContainer._hasStreamListener = true;
      scrollContainer.addEventListener('scroll', () => {
        if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 350) {
          if (currentRendered < filtered.length) {
            appendRows(CHUNK_SIZE);
          }
        }
      });
    }
  }

  async function load() {
    const token = ++sequence, key = select.value, spec = layers[key];
    active = spec;
    rows = [];
    $('context').textContent = `Loading ${spec.title}...`;
    history.replaceState(null, '', `?dataset=${encodeURIComponent(key)}`);
    try {
      const groups = await Promise.all((spec.files || [spec.file]).map(async file => {
        const response = await fetch(`${file}?v=20261117-bms-rms-v80`);
        if (!response.ok) throw new Error(`${file} returned ${response.status}`);
        const data = await response.json();
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error(`Invalid collection`);
        return data.features;
      }));
      if (token !== sequence) return;
      const features = groups.flat();
      rows = features.filter(f => f.properties).map(f => normalise(f, spec, key));
      const categories = [...new Set(rows.map(row => row[spec.group]))].sort();
      $('category').replaceChildren(new Option('All available categories', ''));
      for (const category of categories) $('category').add(new Option(category, category));
      $('search').value = '';
      render();
    } catch (error) {
      if (token === sequence) {
        $('context').textContent = `Layer unavailable: ${error.message}`;
        $('total').textContent = 'Unavailable';
        $('matching').textContent = 'Unavailable';
      }
    }
  }

  function csvCell(value) {
    const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
    return `"${String(safe).replaceAll('"', '""')}"`;
  }

  $('download').addEventListener('click', () => {
    if (!active || !filtered.length) return;
    const lines = [
      active.columns.map(col => csvCell(col.title)).join(','),
      ...filtered.map(row => active.columns.map(col => csvCell(row[col.key])).join(','))
    ];
    const url = URL.createObjectURL(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `mowt-${select.value}-register.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  select.addEventListener('change', load);
  $('search').addEventListener('input', render);
  $('category').addEventListener('change', render);
  load();
})();
