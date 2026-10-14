// Bridges & Culverts — FY2025/26 MoWT maintenance-strategy structures register.
// Standing rule: bridges and major culverts are ALWAYS reported as separate figures/tables —
// this file never merges their rows into one shared table, even though both live on one page.

const STRUCT_COND_ORDER = ['Good', 'Satisfactory', 'Fair', 'Marginal', 'Poor', 'Critical', 'Very Poor'];
const STRUCT_COND_COLOR = {
  'Good': '#00c853',
  'Satisfactory': '#2979ff',
  'Fair': '#2979ff',
  'Marginal': '#fff500',
  'Poor': '#ff7a00',
  'Critical': '#ff2d78',
  'Very Poor': '#ff2d78'
};
function structConditionColor(cond){ return STRUCT_COND_COLOR[cond] || '#8b90a0'; }
function structSortConditions(keys){
  return keys.slice().sort((a, b) => {
    const ia = STRUCT_COND_ORDER.indexOf(a), ib = STRUCT_COND_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
function structCountBy(rows, key){
  const m = {};
  rows.forEach(r => { const v = r[key] || 'Not recorded'; m[v] = (m[v] || 0) + 1; });
  return m;
}
function structFmtDate(v){
  if (!v) return '—';
  return String(v).slice(0, 10);
}
// Uganda's real extent (with generous margin) — a handful of source records carry corrupted
// or lat/lon-swapped coordinates (e.g. a bridge recorded near Spain instead of Uganda). Rather
// than plot those and let them blow out the map's auto-fit bounds, they're excluded from the
// map (same treatment as missing coordinates) and disclosed separately; the table still shows
// their recorded values as-is.
function inUgandaBounds(lat, lon){
  return lat >= -2.5 && lat <= 5.5 && lon >= 28 && lon <= 36.5;
}

// Build one full sub-view (KPI strip + map + table) for either bridges or major culverts.
// Returns { node, mountMap } — mountMap() lazily creates the Leaflet map the first time
// its tab becomes visible (a map initialised inside a display:none container sizes to 0).
function buildStructureView(cfg){
  const { rows, idLabel, idKey, nameKey, extraCols, caption, mapDivId, kind } = cfg;

  const node = el('div', {});

  // ---- 1. condition-distribution KPI strip (real counts) ----
  const condCounts = structCountBy(rows, 'condition');
  const condKeys = structSortConditions(Object.keys(condCounts));
  const missingCoords = rows.filter(r => r.coordinate_e == null || r.coordinate_s == null).length;
  const badCoords = rows.filter(r =>
    r.coordinate_e != null && r.coordinate_s != null &&
    !Number.isNaN(r.coordinate_s) && !Number.isNaN(r.coordinate_e) &&
    !inUgandaBounds(r.coordinate_s, r.coordinate_e)
  ).length;
  const plottedCount = rows.length - missingCoords - badCoords;

  node.appendChild(kpiGrid([
    { label: 'Total ' + caption, value: fmtNum(rows.length), accent: 'var(--neon-cyan)' },
    ...condKeys.map(k => ({ label: k, value: fmtNum(condCounts[k]), accent: structConditionColor(k) }))
  ]));
  node.appendChild(el('p', { class: 'footnote' },
    fmtNum(rows.length) + ' ' + caption + ' from the FY2025/26 MoWT maintenance-strategy structures register. ' +
    (missingCoords > 0 ? fmtNum(missingCoords) + ' record' + (missingCoords === 1 ? '' : 's') + ' without recorded coordinates' + (badCoords > 0 ? ', and ' : ' are') : '') +
    (badCoords > 0 ? fmtNum(badCoords) + ' record' + (badCoords === 1 ? '' : 's') + ' with coordinates recorded well outside Uganda (likely transposed or corrupted in the source register) are' : '') +
    (missingCoords > 0 || badCoords > 0 ? ' omitted from the map below (shown in the table with their recorded values).' : ' All records carry mapped coordinates.')
  ));

  // ---- 2. condition-distribution chart ----
  node.appendChild(el('div', { style: 'max-width:480px;margin-bottom:18px;' }, chartCard({
    title: caption.replace(/^\w/, c => c.toUpperCase()) + ' by Condition',
    type: 'doughnut',
    labels: condKeys,
    datasets: [{ data: condKeys.map(k => condCounts[k]), backgroundColor: condKeys.map(structConditionColor), borderWidth: 0 }]
  })));

  // ---- 3. map ----
  const mapCard = el('div', { class: 'card card-pad' }, [
    el('h3', {}, 'Locations by condition'),
    el('span', { class: 'tiny-muted' }, fmtNum(plottedCount) + ' of ' + fmtNum(rows.length) + ' ' + caption + ' plotted at their recorded coordinates, coloured by condition.'),
    el('div', { class: 'map-legend', style: 'display:flex;flex-wrap:wrap;gap:14px;margin:10px 0 12px;' },
      condKeys.map(k => el('span', { style: 'display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);' }, [
        el('span', { style: `width:10px;height:10px;border-radius:50%;background:${structConditionColor(k)};display:inline-block;` }),
        k
      ]))
    ),
    el('div', { class: 'map-shell', id: mapDivId })
  ]);
  node.appendChild(mapCard);

  let mapInstance = null;
  function mountMap(){
    if (mapInstance) { mapInstance.invalidateSize(); return mapInstance; }
    const div = document.getElementById(mapDivId);
    if (!div) return null;
    mapInstance = L.map(mapDivId, { scrollWheelZoom: false });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS',
      maxZoom: 16
    }).addTo(mapInstance);

    const bounds = [];
    rows.forEach(r => {
      if (r.coordinate_e == null || r.coordinate_s == null) return;
      const lat = r.coordinate_s, lon = r.coordinate_e;
      if (Number.isNaN(lat) || Number.isNaN(lon)) return;
      if (!inUgandaBounds(lat, lon)) return;
      const marker = L.circleMarker([lat, lon], {
        radius: 5, weight: 1, color: '#1a1c24', fillColor: structConditionColor(r.condition), fillOpacity: 0.85
      }).addTo(mapInstance);
      const primaryLabel = kind === 'bridge' ? (r.bridge_name || r.bridge_number) : r.culvert_number;
      marker.bindPopup(
        '<strong>' + esc(primaryLabel) + '</strong><br>' +
        'Link / road: ' + esc(r._link_name || '—') + '<br>' +
        'Condition: ' + esc(r.condition || 'Not recorded') + '<br>' +
        'Last modified: ' + esc(structFmtDate(r.date_modified))
      );
      bounds.push([lat, lon]);
    });
    if (bounds.length) mapInstance.fitBounds(bounds, { padding: [20, 20] });
    else mapInstance.setView([1.3733, 32.2903], 7); // Uganda fallback centre — no coordinates to fit
    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 60);
    return mapInstance;
  }

  // ---- 4. full register table ----
  const columns = [
    { key: idKey, label: idLabel },
    ...(nameKey ? [{ key: nameKey, label: 'Name' }] : []),
    ...(extraCols || []),
    { key: '_link_name', label: 'Road / Link (decoded)' },
    { key: 'condition', label: 'Condition', render: (v) => conditionBadge(v) },
    { key: 'date_modified', label: 'Last Modified', fmt: structFmtDate },
    { key: 'coordinate_s', label: 'Lat', align: 'num', fmt: (v) => v == null ? '—' : Number(v).toFixed(4) },
    { key: 'coordinate_e', label: 'Lon', align: 'num', fmt: (v) => v == null ? '—' : Number(v).toFixed(4) }
  ];

  const searchKeys = [idKey, '_link_name'];
  if (nameKey) searchKeys.push(nameKey);
  if (extraCols) extraCols.forEach(c => searchKeys.push(c.key));

  node.appendChild(sectionBlock(
    'Full ' + caption + ' register',
    'Paginated, sortable, searchable — every ' + caption.replace(/^\w/, c => c.toUpperCase()) + ' record in the FY2025/26 register, link/road decoded from its raw link code.',
    dataTable({
      columns,
      rows,
      pageSize: 25,
      searchKeys,
      filters: [{ label: 'condition', key: 'condition', options: condKeys }],
      caption
    })
  ));

  return { node, mountMap };
}

RENDERERS.structures = async function(container){
  container.innerHTML = '';

  const [detail, linkMap] = await Promise.all([DataStore.msDetail(), DataStore.linkNameMap()]);
  const bridges = detail.bridges || [];
  const culverts = detail.major_culverts || [];

  // Critical fix vs the old site: decode every raw link_id to its real road/link name
  // before it is ever shown — the old site rendered raw codes like "A002_Link11" directly.
  bridges.forEach(b => { b._link_name = DataStore.decodeLinkId(b.link_id, linkMap); });
  culverts.forEach(c => { c._link_name = DataStore.decodeLinkId(c.link_id, linkMap); });

  container.appendChild(pageHead(
    'Bridges & Culverts',
    'Real bridge and major-culvert condition registers from the FY2025/26 MoWT maintenance-strategy workbooks. Bridges and major culverts are structurally different assets and are always reported as separate figures and tables, never merged.',
    fmtNum(bridges.length) + ' bridges · ' + fmtNum(culverts.length) + ' major culverts'
  ));

  const bridgesView = buildStructureView({
    rows: bridges, idKey: 'bridge_number', idLabel: 'Bridge No.', nameKey: 'bridge_name',
    caption: 'bridges', mapDivId: 'structures-map-bridges', kind: 'bridge'
  });
  const culvertsView = buildStructureView({
    rows: culverts, idKey: 'culvert_number', idLabel: 'Culvert No.', nameKey: null,
    extraCols: [{ key: 'road_no', label: 'Road' }, { key: 'river', label: 'River' }],
    caption: 'major culverts', mapDivId: 'structures-map-culverts', kind: 'culvert'
  });
  culvertsView.node.style.display = 'none';

  const tabRow = el('div', { class: 'tab-row' });
  const bridgesBtn = el('button', { class: 'tab-btn active', type: 'button' }, 'Bridges (' + fmtNum(bridges.length) + ')');
  const culvertsBtn = el('button', { class: 'tab-btn', type: 'button' }, 'Major Culverts (' + fmtNum(culverts.length) + ')');
  bridgesBtn.addEventListener('click', () => {
    bridgesBtn.classList.add('active'); culvertsBtn.classList.remove('active');
    bridgesView.node.style.display = ''; culvertsView.node.style.display = 'none';
    bridgesView.mountMap();
  });
  culvertsBtn.addEventListener('click', () => {
    culvertsBtn.classList.add('active'); bridgesBtn.classList.remove('active');
    culvertsView.node.style.display = ''; bridgesView.node.style.display = 'none';
    culvertsView.mountMap();
  });
  tabRow.appendChild(bridgesBtn);
  tabRow.appendChild(culvertsBtn);
  container.appendChild(tabRow);

  container.appendChild(bridgesView.node);
  container.appendChild(culvertsView.node);

  // Bridges tab is shown first — mount its map now; the culverts map mounts lazily on first view.
  requestAnimationFrame(() => bridgesView.mountMap());

  container.appendChild(el('p', { class: 'footnote' },
    'Source: MoWT maintenance-strategy structures register, FY2025/26 cycle. Link/road names are decoded from each record’s raw link code against the same road-link register used across this platform; a small number of records reference link codes outside the current network register and are shown with their original code where no decoded name exists.'
  ));
};
