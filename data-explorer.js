(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const field = (title, key, type = 'text') => ({ title, key, type });
  const layers = {
    roads: { title: 'National and DUCAR roads', files: ['network.geojson','geo/ducar_all_roads_2025.geojson'], group: 'Surface Type', context: 'Published mapped National Road Network and DUCAR roads. Overlapping national geometry in the DUCAR file is excluded. This is not the complete 248,616.14 km governed network.', gaps: 'Road Type is identified as DUCAR only for the DUCAR segment subset. Financial Year, full national geometry, and annual and monthly trends are not verified. DUCAR condition and traffic values are not supplied.', columns: [field('Section ID','Link Id 1'),field('Road number','Road No 1'),field('Road name','Link Name'),field('Road Type','Road Type'),field('Surface Type','Surface Type'),field('Functional Class','Road Cla 1'),field('Sub-Region','Region'),field('Financial Year','Financial Year'),field('Condition','Condition'),field('Length km','Length Km','number'),field('AADT 2026 (method unverified)','Aadt 2026 Live','number'),field('Risk band','Road Safety Risk Band'),field('Priority band','Intervention Priority Band')] },
    bridges: { title: 'Bridges', file: 'geo/bridges.geojson', group: 'Maintenance_Region', context: '423 mapped bridge points in this published layer. The authoritative FY 2026/27 bridge count is 552. The difference is a coverage gap, not a revised national total.', gaps: 'Financial Year, structure register coverage, annual and monthly condition trends are not verified in this layer.', columns: [field('Bridge number','Bridge_Number'),field('Bridge name','Bridge_Name'),field('Road number','Link_Number'),field('Region','Maintenance_Region'),field('Structure type','Structure_Type'),field('Condition score','Bridge_Condition_Score','number'),field('Scour index','Scour_Vulnerability_Index','number'),field('Year constructed','Year_Constructed','number')] },
    culverts: { title: 'Major culverts', file: 'geo/major_culverts.geojson', group: 'Maintenance_Region', context: 'Mapped major culvert points only. Culverts are separate from Bridges.', gaps: 'Financial Year and completeness of the structures register are not verified in this layer.', columns: [field('Culvert number','Culvert_Number'),field('Road number','Link_Number'),field('Region','Maintenance_Region'),field('Structure type','Culvert_Structure_Type'),field('Span or diameter m','Span_Diameter_m','number'),field('Cell count','Cell_Count','number'),field('Scour risk','Scour_Risk_Rating')] },
    stations: { title: 'Traffic count stations', file: 'geo/traffic_count_stations.geojson', group: 'REGION', context: 'Station inventory, not traffic volumes. The layer cannot support annual or monthly traffic trends.', gaps: 'Traffic counts, Financial Year, annual trends and monthly trends are not present in this published station inventory.', columns: [field('Station number','TCS_NO_'),field('Station name','TCS_NAME'),field('Road ID','Link_ID'),field('Road name','Link_Name'),field('Region','REGION')] },
    ferries: { title: 'Ferry crossings', file: 'geo/ferry_crossings.geojson', group: 'Water_body', context: 'Mapped ferry crossing points, not vessel schedules or a complete inland waterway network.', gaps: 'Operational schedules, route lengths and Financial Year are not verified in this layer.', columns: [field('Crossing','Ferry_cros'),field('Water body','Water_body'),field('Category','Category')] },
    aviation: { title: 'Aviation sites', file: 'geo/airports.geojson', group: 'Category', context: 'Mapped airports and airfields. Completeness and operational status are not established by this layer.', gaps: 'Operational status and Financial Year are not verified in this layer.', columns: [field('Site','F9'),field('Category','Category')] },
    safety: { title: 'Traffic incidents', file: 'geo/kampala_traffic_incidents.geojson', group: 'severity', context: 'Mapped incidents concentrated around Kampala, not a national incident population.', gaps: 'Coverage outside Kampala, complete annual and monthly trends, and Financial Year classification are not verified.', columns: [field('Incident type','incident_type'),field('Severity','severity'),field('Road','road_name'),field('Road class','road_class'),field('Date','date')] },
    freight: { title: 'Weighbridges', file: 'geo/weighbridges.geojson', group: 'Status', context: 'Mapped weighbridge facilities. Proposed facilities are not operational facilities.', gaps: 'Freight volumes and Financial Year are not verified in this layer.', columns: [field('Facility','Weighbridge Name'),field('Status','Status')] },
    mgr: { title: 'MGR mapped segments', file: 'geo/mgr.geojson', group: 'Status', context: 'Mapped metre-gauge railway segments. Segment count is not route length or proof of operational status.', gaps: 'Verified rail operations, route length and Financial Year are not present in this layer.', columns: [field('Name','Name'),field('Status','Status')] },
    sgr: { title: 'SGR alignment', file: 'geo/sgr_alignment.geojson', group: 'Status', context: 'One mapped standard-gauge alignment. An alignment is not evidence of an operating railway.', gaps: 'Construction, operational status, route length and Financial Year require verification.', columns: [field('Name','Name'),field('Status','Status')] }
  };
  const select = $('dataset');
  for (const [key, spec] of Object.entries(layers)) select.add(new Option(spec.title, key));
  const initial = new URLSearchParams(location.search).get('dataset');
  select.value = Object.hasOwn(layers, initial) ? initial : 'roads';
  let rows = [], filtered = [], page = 0, active = null, sequence = 0;
  const pageSize = 50;
  const clean = v => v === null || v === undefined || String(v).trim() === '' ? 'Not supplied' : String(v).trim();
  const count = v => new Intl.NumberFormat('en-UG').format(v);
  const normalise = (feature, spec) => {
    const p = feature.properties || {};
    const result = {};
    for (const col of spec.columns) {
      let raw = p[col.key];
      if (col.key === 'Surface Type') {
        const surface = clean(p['Surface  1']).toLowerCase();
        raw = ['paved','bituminous','concrete'].includes(surface) ? 'Paved' : ['unpaved','gravel','earth'].includes(surface) ? 'Unpaved' : 'Not supplied';
      }
      result[col.key] = clean(raw);
    }
    return result;
  };
  const cellClass = (value, type) => {
    if (value === 'Not supplied') return 'badge missing';
    if (type === 'number') return 'numeric';
    const known = value.toLowerCase();
    return ['good','fair','poor','paved','moderate','high','critical','operational','proposed'].includes(known) ? `badge ${known}` : '';
  };
  function render() {
    const spec = active;
    const query = $('search').value.trim().toLocaleLowerCase();
    const category = $('category').value;
    filtered = rows.filter(row => (!category || row[spec.group] === category) && (!query || spec.columns.some(col => row[col.key].toLocaleLowerCase().includes(query))));
    const maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
    page = Math.min(page, maxPage);
    $('total').textContent = count(rows.length);
    $('matching').textContent = count(filtered.length);
    $('coverage').textContent = 'Mapped subset';
    $('context').textContent = spec.context;
    $('gaps').textContent = `Coverage limits: ${spec.gaps}`;
    const groups = new Map();
    for (const row of filtered) groups.set(row[spec.group], (groups.get(row[spec.group]) || 0) + 1);
    $('breakdown-field').textContent = spec.columns.find(col => col.key === spec.group)?.title || spec.group;
    const list = $('breakdown-list'); list.replaceChildren();
    for (const [label, n] of [...groups].sort((a,b) => a[0].localeCompare(b[0]))) {
      const pill = document.createElement('span'); pill.append(document.createTextNode(label));
      const strong = document.createElement('strong'); strong.textContent = count(n); pill.append(strong); list.append(pill);
    }
    const headerRow = document.createElement('tr');
    for (const col of spec.columns) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = col.title; headerRow.append(th); }
    $('table-head').replaceChildren(headerRow);
    const numericBounds = new Map(spec.columns.filter(col => col.type === 'number').map(col => {
      const values = filtered.map(row => Number(row[col.key])).filter((n, index) => filtered[index]?.[col.key] !== 'Not supplied' && Number.isFinite(n));
      return [col.key, [Math.min(...values), Math.max(...values)]];
    }));
    const body = document.createDocumentFragment();
    for (const row of filtered.slice(page * pageSize, (page + 1) * pageSize)) {
      const tr = document.createElement('tr');
      for (const col of spec.columns) {
        const td = document.createElement('td'); const value = row[col.key];
        const style = cellClass(value, col.type);
        if (style.startsWith('badge')) { const badge = document.createElement('span'); badge.className = style; badge.textContent = value; td.append(badge); }
        else {
          td.textContent = value;
          if (style) td.className = style;
          if (style === 'numeric') {
            const n = Number(value), [minimum, maximum] = numericBounds.get(col.key);
            if (Number.isFinite(n) && Number.isFinite(minimum) && Number.isFinite(maximum)) {
              const ratio = maximum === minimum ? 0.5 : Math.max(0, Math.min(1, (n - minimum) / (maximum - minimum)));
              const waterOrDrainage = ['bridges', 'culverts', 'ferries'].includes(select.value);
              td.style.backgroundColor = waterOrDrainage ? `rgba(54, 132, 218, ${(.04 + ratio * .19).toFixed(3)})` : `rgba(220, 130, 70, ${(.04 + ratio * .19).toFixed(3)})`;
              td.title = 'Relative magnitude within the current filtered mapped features, not an engineering threshold';
            }
          }
        }
        tr.append(td);
      }
      body.append(tr);
    }
    $('table-body').replaceChildren(body);
    const start = filtered.length ? page * pageSize + 1 : 0;
    const end = Math.min((page + 1) * pageSize, filtered.length);
    $('row-range').textContent = `${count(start)} to ${count(end)} of ${count(filtered.length)} matching features`;
    $('page-label').textContent = `Page ${page + 1} of ${maxPage + 1}`;
    $('previous').disabled = page === 0; $('next').disabled = page >= maxPage;
  }
  function schema(name, spec) {
    const identifier = str => str.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    const columns = spec.columns.map(col => `  ${identifier(col.title)} ${col.type === 'number' ? 'NUMERIC' : 'TEXT'}`).join(',\n');
    return `-- Proposed read schema only; not a deployed SQL table.\nCREATE TABLE mapped_${identifier(name)} (\n  feature_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n${columns},\n  geometry GEOMETRY\n);\n\n-- Published GeoJSON is the current page data source.\n-- Missing values remain NULL on import; no total is inferred.`;
  }
  async function load() {
    const token = ++sequence, key = select.value, spec = layers[key];
    active = spec; rows = []; page = 0;
    $('context').textContent = `Loading ${spec.title.toLowerCase()}...`;
    $('schema-sql').textContent = schema(key, spec);
    history.replaceState(null, '', `?dataset=${encodeURIComponent(key)}`);
    try {
      const groups = await Promise.all((spec.files || [spec.file]).map(async file => {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`${file} returned ${response.status}`);
        const data = await response.json();
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error(`Invalid feature collection: ${file}`);
        return data.features;
      }));
      if (token !== sequence) return;
      const features = key === 'roads' ? [
        ...groups[0].map(f => ({ ...f, properties: { ...f.properties, 'Road Type': 'National Road Network' } })),
        ...groups[1].filter(f => f.properties?.governance_department === 'DDUCAR MoWT').map(f => ({ ...f, properties: {
          'Link Id 1': f.properties.link_id, 'Link Name': f.properties.road_name, 'Road Type': 'DUCAR',
          'Road Cla 1': f.properties.functional_class, 'Surface  1': f.properties.pavement_class,
          'Length Km': f.properties.length_km,
        } })),
      ] : groups.flat();
      rows = features.filter(f => f.properties && f.geometry).map(f => normalise(f, spec));
      const categories = [...new Set(rows.map(row => row[spec.group]))].sort();
      $('category').replaceChildren(new Option('All available categories', ''));
      for (const category of categories) $('category').add(new Option(category, category));
      $('search').value = ''; render();
    } catch (error) { if (token === sequence) { $('context').textContent = `Layer unavailable: ${error.message}`; $('total').textContent = 'Unavailable'; $('matching').textContent = 'Unavailable'; } }
  }
  function csvCell(value) { const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value; return `"${safe.replaceAll('"','""')}"`; }
  $('download').addEventListener('click', () => {
    if (!active || !filtered.length) return;
    const lines = [active.columns.map(col => csvCell(col.title)).join(','), ...filtered.map(row => active.columns.map(col => csvCell(row[col.key])).join(','))];
    const url = URL.createObjectURL(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `mapped-${select.value}-filtered.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  select.addEventListener('change', load);
  $('search').addEventListener('input', () => { page = 0; render(); });
  $('category').addEventListener('change', () => { page = 0; render(); });
  $('previous').addEventListener('click', () => { page--; render(); });
  $('next').addEventListener('click', () => { page++; render(); });
  load();
})();
