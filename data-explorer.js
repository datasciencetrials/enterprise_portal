(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const field = (title, key, type = 'text') => ({ title, key, type });
  const layers = {
    roads: {
      title: 'Mapped National Roads (21,284.02 km)',
      shortTitle: 'Mapped Roads (21,284.02 km)',
      files: ['network.geojson'],
      group: 'Surface Type',
      context: 'The current mapped National Roads layer totals 21,284.02 km: 6,406.69 km Paved and 14,877.33 km Unpaved. The annual National Roads length series reports 21,302 km for FY 2025-26 and 21,284 km for FY 2026-27.',
      gaps: 'This is an approved published snapshot from a Unified SQL Database. The financial-year series remains distinct from exact mapped-layer calculations, and modelled traffic fields are not presented as live observations. Database and schema access are not available to the browser.',
      columns: [
        field('Link ID', 'Link Id 1'),
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
      shortTitle: 'Bridges (552)',
      file: 'geo/bridges.geojson',
      group: 'Condition_Band',
      context: 'National Bridge Management System (BMS) register containing all 552 Bridges across 6 Maintenance Regions and 23 Maintenance Stations (247 Good, 71 Satisfactory, 162 Marginal, 52 Poor, 13 Critical, 7 Under Construction; Issued 18/11/2026).',
      gaps: 'This approved published snapshot is checked weekly against a Unified SQL Database. Some road Link IDs and positions require review. Database and schema access are not available to the browser.',
      columns: [
        field('Bridge Number', 'Bridge_Number'),
        field('Bridge Name', 'Bridge_Name'),
        field('Road Link ID', 'Link_Number'),
        field('Road Name', 'Road_Name'),
        field('River Crossing', 'River_Crossing'),
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
      shortTitle: 'Major Culverts (452)',
      file: 'geo/major_culverts.geojson',
      group: 'Condition_Band',
      context: 'National Bridge Management System (BMS) register containing all 452 Major Culverts across 6 Maintenance Regions and 23 Maintenance Stations (403 Good, 39 Satisfactory, 4 Marginal, 1 Poor, 4 Critical, 1 Under Construction; Issued 18/11/2026).',
      gaps: 'This approved published snapshot is checked weekly against a Unified SQL Database. Some road Link IDs and positions require review. Database and schema access are not available to the browser.',
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
      title: 'Traffic Count Stations (298)',
      shortTitle: 'Traffic (298)',
      file: 'geo/traffic_count_stations.geojson',
      group: 'REGION',
      context: 'National Traffic Census station network of 298 monitoring stations across the 6 Maintenance Regions.',
      gaps: 'This approved station snapshot does not establish current traffic volumes, speed or a continuous feed. Database and schema access are not available to the browser.',
      columns: [
        field('Station Number', 'TCS_NO_'),
        field('Station Code', 'TCS_NAME'),
        field('Road Link ID', 'Link_ID'),
        field('Road Name', 'Link_Name'),
        field('Station Type', 'STATIONS'),
        field('Maintenance Station', 'STATION'),
        field('Region', 'REGION'),
        field('Baseline Year', 'Survey_Year', 'number')
      ]
    },
    ferries: {
      title: 'Ferry Crossings (20)',
      shortTitle: 'Ferries (20)',
      file: 'geo/ferry_crossings.geojson',
      group: 'Water_body',
      context: 'National Inland Water Transport ferry crossings (20) across Lake Victoria, Lake Kyoga, Lake Albert, Lake Bisina, River Nile, and River Semliki.',
      gaps: 'This approved mapped crossing snapshot does not establish current schedules or operations. Database and schema access are not available to the browser.',
      columns: [
        field('Crossing', 'Ferry_cros'),
        field('Water Body', 'Water_body'),
        field('Operational Status', 'Category'),
        field('Modernisation Year', 'Commission_Year', 'number')
      ]
    },
    aviation: {
      title: 'Aviation Aerodromes (13)',
      shortTitle: 'Aviation (13)',
      file: 'geo/airports.geojson',
      group: 'Category',
      context: 'International airports and upcountry aerodromes (13) across Uganda supporting passenger and air cargo corridors.',
      gaps: 'This approved mapped aviation snapshot does not establish current operations. Database and schema access are not available to the browser.',
      columns: [
        field('Aerodrome', 'F9'),
        field('Category', 'Category'),
        field('Region', 'Region'),
        field('Upgrade Year', 'Upgrade_Year', 'number')
      ]
    },
    safety: {
      title: 'Road Safety Observations',
      shortTitle: 'Safety',
      file: 'geo/kampala_traffic_incidents.geojson',
      group: 'severity',
      context: 'Road safety observation schedule by severity, collision typology, and corridor.',
      gaps: 'Categorised by severity and functional road classification with UK date formatting (dd/mm/yyyy).',
      columns: [
        field('Incident Type', 'incident_type'),
        field('Severity', 'severity'),
        field('Road Name', 'road_name'),
        field('Road Class', 'road_class'),
        field('Date (dd/mm/yyyy)', 'date')
      ]
    },
    freight: {
      title: 'Weighbridge Stations (21)',
      shortTitle: 'Weighbridges (21)',
      file: 'geo/weighbridges.geojson',
      group: 'Status',
      context: 'Axle load control and weighbridge facilities (21) along trunk freight corridors.',
      gaps: 'Mapped facility status is from the approved published snapshot; live operational status is not inferred. Database and schema access are not available to the browser.',
      columns: [
        field('Facility', 'Weighbridge Name'),
        field('Operational Status', 'Status'),
        field('Region', 'Region'),
        field('Commission Year', 'Commission_Year', 'number')
      ]
    },
    mgr: {
      title: 'Metre-Gauge Railway (1,266.00 km)',
      shortTitle: 'MGR Rail (1,266.00 km)',
      file: 'geo/mgr.geojson',
      group: 'Status',
      context: 'Metre-Gauge Railway (MGR) network of 1,266.00 km (269.00 km Operational and 997.00 km Scheduled Rehabilitation).',
      gaps: 'Mapped geometry in kilometres is not verified operational route length. Database and schema access are not available to the browser.',
      columns: [
        field('Corridor Name', 'Name'),
        field('Operational Status', 'Status'),
        field('Length (km)', 'Mapped km', 'number')
      ]
    },
    sgr: {
      title: 'Standard-Gauge Railway (272.00 km)',
      shortTitle: 'SGR Rail (272.00 km)',
      file: 'geo/sgr_alignment.geojson',
      group: 'Status',
      context: 'Planned Standard-Gauge Railway (SGR) Eastern Route corridor (272.00 km from Malaba to Kampala).',
      gaps: 'Mapped geometry in kilometres is not verified operational route length. Database and schema access are not available to the browser.',
      columns: [
        field('Corridor Name', 'Name'),
        field('Operational Status', 'Status'),
        field('Length (km)', 'Mapped km', 'number')
      ]
    }
  };

  const select = $('dataset');
  const pillContainer = $('dataset-pills');
  for (const [key, spec] of Object.entries(layers)) {
    select.add(new Option(spec.title, key));
    if (pillContainer) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dataset-pill';
      btn.dataset.layerKey = key;
      btn.textContent = spec.shortTitle;
      btn.addEventListener('click', () => {
        select.value = key;
        load();
      });
      pillContainer.append(btn);
    }
  }
  const initial = new URLSearchParams(location.search).get('dataset');
  select.value = Object.hasOwn(layers, initial) ? initial : 'roads';
  let rows = [], filtered = [], active = null, sequence = 0;

  const clean = v => v === null || v === undefined || String(v).trim() === '' ? 'Standard' : String(v).trim();
  const linkIdKeys = new Set(['Link Id 1', 'Link_Number', 'Link_ID']);
  const displayValue = (key, raw) => {
    const value = clean(raw);
    if (linkIdKeys.has(key)) return value.includes('_') ? value : 'Link ID not verified';
    return value.replaceAll('_', ' ');
  };
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

  const normalise = (item, spec, key) => {
    const p = item.properties || {};
    const result = {};
    for (const col of spec.columns) {
      let raw = p[col.key];
      if (col.key === 'Surface Type') {
        const surface = clean(p['Surface Type'] || p['Surface  1']).toLowerCase();
        raw = ['paved', 'bituminous', 'concrete'].includes(surface) ? 'Paved' : 'Unpaved';
      }
      if (key === 'stations' && col.key === 'REGION') raw = subRegion(clean(raw));
      if (col.key === 'date') raw = fmtDate(raw);
      result[col.key] = displayValue(col.key, raw);
    }
    if (key === 'roads') {
      const supplied = item.properties?.['Length Km'];
      const parsed = supplied === null || supplied === undefined || supplied === '' ? NaN : Number(supplied);
      result._mappedKm = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      result['Length Km'] = result._mappedKm.toFixed(2);
    } else if (isLineLayer(key)) {
      const supplied = Number(item.properties?.['Length Km'] || item.properties?.['Mapped km'] || 0);
      result._mappedKm = Number.isFinite(supplied) && supplied > 0 ? supplied : 0;
      result['Mapped km'] = result._mappedKm.toFixed(2);
    }
    return result;
  };

  const cellClass = (value, col) => {
    if (col.type === 'number') return 'numeric';
    const known = value.toLowerCase();
    if (['good', 'satisfactory', 'fair', 'marginal', 'poor', 'critical', 'paved', 'unpaved', 'low', 'moderate', 'high', 'operational'].includes(known)) {
      return `badge ${known}`;
    }
    return /^(Surface Type|Functional Class|Road Class|Region|Maintenance Station|Station|Financial Year|Category|Structural Type|Culvert Type|Severity|Condition Band|Operational Status)$/i.test(col.title) ? 'badge neutral' : '';
  };

  function render() {
    const spec = active;
    const query = $('search').value.trim().toLocaleLowerCase();
    const category = $('category').value;
    filtered = rows.filter(row => (!category || row[spec.group] === category) && (!query || spec.columns.some(col => row[col.key].toLocaleLowerCase().includes(query))));
    const lineLayer = isLineLayer(select.value);
    const totalKm = rows.reduce((sum, row) => sum + (row._mappedKm ?? 0), 0);
    const matchKm = filtered.reduce((sum, row) => sum + (row._mappedKm ?? 0), 0);
    const sharePct = totalKm > 0 ? ((matchKm / totalKm) * 100).toFixed(2) : '100.00';

    $('total-label').textContent = lineLayer ? 'Total Network (km)' : 'Total Assets';
    $('matching-label').textContent = lineLayer ? 'Filtered Extent (km)' : 'Filtered Assets';
    $('total').textContent = lineLayer ? `${kilometres(totalKm)} km` : count(rows.length);
    $('matching').textContent = lineLayer ? `${kilometres(matchKm)} km (${sharePct}%)` : count(filtered.length);
    $('coverage').textContent = 'Approved published snapshot';
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
        const pct = matchKm > 0 ? ((n / matchKm) * 100).toFixed(2) : '0.00';
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
    if (pillContainer) {
      for (const btn of pillContainer.querySelectorAll('.dataset-pill')) {
        btn.classList.toggle('is-active', btn.dataset.layerKey === key);
        btn.setAttribute('aria-selected', String(btn.dataset.layerKey === key));
      }
    }
    $('context').textContent = `Loading ${spec.title}...`;
    history.replaceState(null, '', `?dataset=${encodeURIComponent(key)}`);
    try {
      const groups = await Promise.all((spec.files || [spec.file]).map(async file => {
        const response = await fetch(`${file}?v=20261118-v200`);
        if (!response.ok) throw new Error(`${file} returned ${response.status}`);
        const data = await response.json();
        return data.features || [];
      }));
      if (token !== sequence) return;
      const items = groups.flat();
      rows = items.filter(f => f.properties).map(f => normalise(f, spec, key));
      const categories = [...new Set(rows.map(row => row[spec.group]))].sort();
      $('category').replaceChildren(new Option('All available categories', ''));
      for (const category of categories) $('category').add(new Option(category, category));
      $('search').value = '';
      render();
    } catch (error) {
      if (token === sequence) {
        $('context').textContent = `Layer unavailable: ${error.message}`;
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
    link.download = `data-science-trials-${select.value}-register.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  select.addEventListener('change', load);
  $('search').addEventListener('input', render);
  $('category').addEventListener('change', render);
  load();
})();
