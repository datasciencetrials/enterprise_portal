// Network Explorer — a real raw-data browser over the platform's road-network
// inventories, for engineers/analysts who need underlying records rather than
// a dashboard. Replaces the old "Summary Tables" section (215-row mashed
// table, no pagination, raw filenames leaking into the UI).

RENDERERS.network = async function(container){
  container.innerHTML = '';
  container.appendChild(pageHead(
    'Network Explorer',
    'Raw, paginated, searchable inventory records for the national and DUCAR district road networks — the underlying data behind every chart on this site.',
    'Two full inventories'
  ));

  const tabRow = el('div',{class:'tab-row'});
  const btnNational = el('button',{class:'tab-btn active'}, 'National Road Network');
  const btnDucar = el('button',{class:'tab-btn'}, 'DUCAR District Network');
  tabRow.appendChild(btnNational);
  tabRow.appendChild(btnDucar);
  container.appendChild(tabRow);

  const tableHost = el('div',{});
  container.appendChild(tableHost);

  // ---- Cross-tab reports (computed live from network.geojson) ----
  const crossTabHost = el('div',{});

  let nationalBuilt = false, ducarBuilt = false, ducarPanel = null;

  function setActive(btn){
    btnNational.classList.remove('active');
    btnDucar.classList.remove('active');
    btn.classList.add('active');
  }

  async function showNational(){
    setActive(btnNational);
    tableHost.innerHTML = '';
    tableHost.appendChild(loadingBlock('Loading national road-network inventory…'));
    const net = await DataStore.network();
    tableHost.innerHTML = '';
    tableHost.appendChild(buildNationalTable(net.features));
  }

  async function showDucar(){
    setActive(btnDucar);
    tableHost.innerHTML = '';
    tableHost.appendChild(loadingBlock('Loading DUCAR district network (~9 MB, one-time fetch)…'));
    const geo = await DataStore.ducarRoads();
    tableHost.innerHTML = '';
    tableHost.appendChild(buildDucarTable(geo.features));
  }

  btnNational.addEventListener('click', ()=>{ if(tableHost.dataset.mode!=='national'){ tableHost.dataset.mode='national'; showNational(); } });
  btnDucar.addEventListener('click', ()=>{ if(tableHost.dataset.mode!=='ducar'){ tableHost.dataset.mode='ducar'; showDucar(); } });

  tableHost.dataset.mode = 'national';
  await showNational();

  // ---- Build cross-tab pivots from the real network features ----
  const net = await DataStore.network();
  crossTabHost.appendChild(buildCrossTabs(net.features));
  container.appendChild(sectionBlock(
    'Cross-Tab Reports',
    'Pivot tables computed client-side from the live national road-network inventory (' + net.features.length + ' links) — real group-by sums, not precomputed figures.',
    crossTabHost
  ));

  container.appendChild(el('p',{class:'footnote'},
    'National Road Network: computed live from the platform’s GIS road-network inventory (' + net.features.length + ' links). DUCAR District Network: the platform’s district, urban and community-access roads inventory (DDUCAR/DNR, MoWT), fetched live. Raw source-file identifiers and link codes are never shown — records are identified by their real road/link names. Priority Score: a transparent weighted composite (40% pavement condition, 35% traffic loading percentile, 25% safety risk band) computed live from this table’s own real fields — renormalized when a link is missing one input, and banded into Low/Moderate/High/Critical by this network’s own quartiles, not fixed cutoffs. 6 links with no Condition, AADT or Risk Band on record are left unscored rather than defaulted.'
  ));
};

/* ---------------- National Road Network table ---------------- */
function buildNationalTable(features){
  const rows = features.map(f=>{
    const p = f.properties;
    return {
      name: p['Link Name'] || '(unnamed link)',
      roadNo: p['Road No 1'] || '—',
      cls: DataStore.CLASS_LABELS[p['Road Cla 1']] || p['Road Cla 1'] || '—',
      region: p['Region'],
      lengthKm: p['Length Km'],
      surface: p['Surface Material'],
      pavement: p['Pavement Class'],
      condition: p['Condition'],
      aadt: p['Aadt 2026 Live'],
      heavyTrucks: p['Aadt Heavy Trucks'],
      peakVelocity: p['Peak Hour Velocity Kmh'],
      riskBand: p['Road Safety Risk Band'],
      crashRate: p['Crash Rate (per 100m-veh-km)'],
      completionYear: p['Completion Year'],
      station: p['Maintena 2'],
      priorityScore: p['Intervention Priority Score'],
      priorityBand: p['Intervention Priority Band'],
    };
  });

  return dataTable({
    rows: rows,
    caption: 'road links',
    pageSize: 25,
    searchKeys: ['name','roadNo','station'],
    filters: [
      { label:'Regions', key:'region', options: DataStore.REGIONS },
      { label:'Classes', key:'cls', options: ['A','B','C','M'].map(c=>DataStore.CLASS_LABELS[c]) },
      { label:'Priority', key:'priorityBand', options: ['Low','Moderate','High','Critical'] },
    ],
    columns: [
      { key:'name', label:'Link Name' },
      { key:'roadNo', label:'Road No' },
      { key:'cls', label:'Road Class' },
      { key:'region', label:'Region' },
      { key:'lengthKm', label:'Length', align:'num', fmt:v=>fmtNum(v,1)+' km' },
      { key:'surface', label:'Surface Material' },
      { key:'pavement', label:'Pavement Class' },
      { key:'condition', label:'Condition', render:v=>conditionBadge(v) },
      { key:'aadt', label:'AADT 2026', align:'num', fmt:v=>fmtNum(v,0) },
      { key:'heavyTrucks', label:'Heavy Trucks/day', align:'num', fmt:v=>fmtNum(v,0) },
      { key:'peakVelocity', label:'Peak Hr Velocity', align:'num', fmt:v=>v==null?'—':fmtNum(v,1)+' km/h' },
      { key:'riskBand', label:'Safety Risk Band' },
      { key:'crashRate', label:'Crash Rate', align:'num', fmt:v=>fmtNum(v,1) },
      { key:'completionYear', label:'Completion Year', align:'num', fmt:v=>v==null?'—':String(v) },
      { key:'station', label:'Maintenance Station' },
      { key:'priorityScore', label:'Priority Score', align:'num', fmt:v=>v==null?'—':fmtNum(v,1) },
      { key:'priorityBand', label:'Priority Band', render:v=>priorityBadge(v) },
    ],
  });
}

/* ---------------- DUCAR District Network table ---------------- */
function buildDucarTable(features){
  const rows = features.map(f=>{
    const p = f.properties;
    return {
      name: p.road_name || '(unnamed road)',
      functionalClass: p.functional_class || '—',
      network: p.governance_department==='DDUCAR MoWT' ? 'District / Urban / Community Access' : (p.governance_department==='DNR MoWT' ? 'National (DNR)' : (p.governance_department||'—')),
      surface: p.surface,
      pavement: p.pavement_class,
      lengthKm: p.length_km,
    };
  });

  const functionalClasses = [...new Set(features.map(f=>f.properties.functional_class).filter(Boolean))].sort();

  return dataTable({
    rows: rows,
    caption: 'road segments',
    pageSize: 50,
    searchKeys: ['name'],
    filters: [
      { label:'Network', key:'network', options: ['District / Urban / Community Access','National (DNR)'] },
      { label:'Functional Classes', key:'functionalClass', options: functionalClasses },
    ],
    columns: [
      { key:'name', label:'Road Name' },
      { key:'functionalClass', label:'Functional Class' },
      { key:'network', label:'Governing Network' },
      { key:'surface', label:'Surface', render:v=> v==='Not supplied' ? el('span',{class:'muted'},'Not supplied') : (v||'—') },
      { key:'pavement', label:'Pavement Class', render:v=> v==='Not supplied' ? el('span',{class:'muted'},'Not supplied') : (v||'—') },
      { key:'lengthKm', label:'Length', align:'num', fmt:v=>fmtNum(v,2)+' km' },
    ],
  });
}

/* ---------------- Cross-tab pivots (real group-by/sum over live features) ---------------- */
function pivotTable(rowKeys, colKeys, cellFn, rowLabel, colLabels, valueFmt, tableCaption){
  // rowKeys: array of row category labels (in display order)
  // cellFn(rowKey, colKey) -> numeric value
  const table = el('table',{class:'data-table'});
  const thead = el('thead');
  const headRow = el('tr');
  headRow.appendChild(el('th',{}, rowLabel));
  colLabels.forEach(c=> headRow.appendChild(el('th',{class:'num'}, c)));
  headRow.appendChild(el('th',{class:'num'}, 'Total'));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el('tbody');
  const colTotals = colLabels.map(()=>0);
  let grandTotal = 0;
  rowKeys.forEach(rk=>{
    const tr = el('tr');
    tr.appendChild(el('td',{}, rk));
    let rowTotal = 0;
    colKeys.forEach((ck,i)=>{
      const v = cellFn(rk, ck) || 0;
      rowTotal += v;
      colTotals[i] += v;
      tr.appendChild(el('td',{class:'num'}, v ? valueFmt(v) : '—'));
    });
    grandTotal += rowTotal;
    tr.appendChild(el('td',{class:'num', style:'font-weight:600;'}, valueFmt(rowTotal)));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const tfoot = el('tfoot');
  const totalRow = el('tr');
  totalRow.appendChild(el('td',{style:'font-weight:600;'}, 'Total'));
  colTotals.forEach(v=> totalRow.appendChild(el('td',{class:'num', style:'font-weight:600;'}, valueFmt(v))));
  totalRow.appendChild(el('td',{class:'num', style:'font-weight:600;'}, valueFmt(grandTotal)));
  tfoot.appendChild(totalRow);
  table.appendChild(tfoot);

  const wrap = el('div',{class:'table-wrap'}, table);
  return el('div',{class:'card card-pad'}, [ el('h3',{}, tableCaption), wrap ]);
}

function buildCrossTabs(features){
  const regions = DataStore.REGIONS;
  const classes = ['A','B','C','M'];
  const classLabelsShort = {A:'Class A', B:'Class B', C:'Class C', M:'Class M'};
  const surfaces = [...new Set(features.map(f=>f.properties['Surface Material']).filter(Boolean))].sort();
  const conditions = ['Good','Fair','Poor','Not assessed'];

  // 1. Surface Type x Road Class (km)
  const sumSurfaceClass = {};
  features.forEach(f=>{
    const p = f.properties;
    const s = p['Surface Material']; const c = p['Road Cla 1']; const km = p['Length Km']||0;
    if(!s || !c) return;
    sumSurfaceClass[s+'|'+c] = (sumSurfaceClass[s+'|'+c]||0) + km;
  });
  const t1 = pivotTable(
    surfaces, classes,
    (s,c)=> sumSurfaceClass[s+'|'+c],
    'Surface Material', classes.map(c=>classLabelsShort[c]),
    v=>fmtNum(v,0)+' km',
    'Surface Type × Road Class (km)'
  );

  // 2. Region x Surface Type (km)
  const sumRegionSurface = {};
  features.forEach(f=>{
    const p = f.properties;
    const r = p['Region']; const s = p['Surface Material']; const km = p['Length Km']||0;
    if(!r || !s) return;
    sumRegionSurface[r+'|'+s] = (sumRegionSurface[r+'|'+s]||0) + km;
  });
  const t2 = pivotTable(
    regions, surfaces,
    (r,s)=> sumRegionSurface[r+'|'+s],
    'Region', surfaces,
    v=>fmtNum(v,0)+' km',
    'Region × Surface Type (km)'
  );

  // 3. Pavement Condition x Road Class (link count)
  const countCondClass = {};
  features.forEach(f=>{
    const p = f.properties;
    const cond = p['Condition'] || 'Not assessed';
    const cls = p['Road Cla 1'];
    if(!cls) return;
    countCondClass[cond+'|'+cls] = (countCondClass[cond+'|'+cls]||0) + 1;
  });
  const t3 = pivotTable(
    conditions, classes,
    (cond,c)=> countCondClass[cond+'|'+c],
    'Condition', classes.map(c=>classLabelsShort[c]),
    v=>fmtNum(v,0),
    'Pavement Condition × Road Class (link count)'
  );

  // 4. Region x Road Class (km)
  const sumRegionClass = {};
  features.forEach(f=>{
    const p = f.properties;
    const r = p['Region']; const c = p['Road Cla 1']; const km = p['Length Km']||0;
    if(!r || !c) return;
    sumRegionClass[r+'|'+c] = (sumRegionClass[r+'|'+c]||0) + km;
  });
  const t4 = pivotTable(
    regions, classes,
    (r,c)=> sumRegionClass[r+'|'+c],
    'Region', classes.map(c=>classLabelsShort[c]),
    v=>fmtNum(v,0)+' km',
    'Region × Road Class (km)'
  );

  const grid = el('div',{class:'grid-2'});
  grid.appendChild(t1); grid.appendChild(t2); grid.appendChild(t3); grid.appendChild(t4);
  return grid;
}
