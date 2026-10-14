RENDERERS.ducar = async function(container){
  const [condSummary, ducarRoadsGeo, network, trafficGeo] = await Promise.all([
    DataStore.ducarConditionSummary(),
    DataStore.ducarRoads(),
    DataStore.network(),
    DataStore.trafficStations(),
  ]);
  container.innerHTML = '';

  // ---------------------------------------------------------------------
  // Real aggregates — computed live from the district-level DUCAR condition
  // survey (geo/ducar_district_condition_summary.geojson), 135 districts.
  // DUCAR = District, Urban and Community Access Roads (excludes national
  // roads, which are reported separately under Overview / Network Explorer).
  // ---------------------------------------------------------------------
  const districts = condSummary.features.map(f => f.properties);
  const sum = key => districts.reduce((s, d) => s + (Number(d[key]) || 0), 0);

  const distKm = sum('DIST_KM');
  const urbKm  = sum('URB_KM');
  const commKm = sum('COMM_KM');
  const ducarTotalKm = distKm + urbKm + commKm; // excludes NATL_KM by design
  const pavedKm = sum('PAVED_KM');
  const unpavedKm = sum('UNPVD_KM');
  const goodKm = sum('GOOD_KM');
  const fairKm = sum('FAIR_KM');
  const poorKm = sum('POOR_KM');
  const conditionAssessedKm = goodKm + fairKm + poorKm;

  // Supplementary: the digitized road-link geometry file (used elsewhere for
  // interactive mapping in Network Explorer). DDUCAR-governed features only —
  // this file also carries ~1,011 national-road features mixed in, excluded here.
  const ducarLinks = ducarRoadsGeo.features.filter(f => f.properties.governance_department === 'DDUCAR MoWT');
  const ducarLinksKm = ducarLinks.reduce((s, f) => s + (Number(f.properties.length_km) || 0), 0);
  const byFunctionalClass = {};
  ducarLinks.forEach(f => {
    const k = f.properties.functional_class || 'Not classified';
    byFunctionalClass[k] = (byFunctionalClass[k] || 0) + 1;
  });

  container.appendChild(pageHead(
    'DUCAR Network — Condition & Traffic Modelling',
    'Analysis and estimation tools for District, Urban and Community Access Roads — condition modelling and illustrative traffic context. For the full raw road-link inventory, see Network Explorer.',
    fmtNum(districts.length) + ' districts · ' + fmtNum(ducarTotalKm, 0) + ' km'
  ));

  // ---- KPI strip ----
  container.appendChild(kpiGrid([
    { label: 'DUCAR Network Total', value: fmtNum(ducarTotalKm, 0), unit: 'km', accent: 'var(--neon-green)' },
    { label: 'Paved (DUCAR)', value: fmtNum(pavedKm, 0), unit: 'km', accent: 'var(--neon-blue)', delta: (pavedKm/ducarTotalKm*100).toFixed(1)+'% of total' },
    { label: 'Unpaved (DUCAR)', value: fmtNum(unpavedKm, 0), unit: 'km', accent: 'var(--neon-orange)', delta: (unpavedKm/ducarTotalKm*100).toFixed(1)+'% of total' },
    { label: 'Districts Covered', value: fmtNum(districts.length), accent: 'var(--neon-cyan)' },
    { label: 'Good Condition', value: fmtNum(goodKm, 0), unit: 'km', accent: 'var(--neon-magenta)', delta: (goodKm/conditionAssessedKm*100).toFixed(1)+'% of assessed' },
    { label: 'Poor Condition', value: fmtNum(poorKm, 0), unit: 'km', accent: 'var(--neon-pink)', delta: (poorKm/conditionAssessedKm*100).toFixed(1)+'% of assessed' },
  ]));
  container.appendChild(el('p', { class: 'footnote' },
    'DUCAR (District, Urban, Community Access Roads) totals computed live from the MoWT DUCAR district-level condition survey, all '+fmtNum(districts.length)+' districts ('+fmtNum(distKm,0)+' km district + '+fmtNum(urbKm,0)+' km urban + '+fmtNum(commKm,0)+' km community access roads). This is a separately-maintained source from the national road-network inventory shown on Overview — the two are not combined. The digitized DUCAR road-link map layer used in Network Explorer contains '+fmtNum(ducarLinks.length)+' mapped link features totalling '+fmtNum(ducarLinksKm,0)+' km — a partial, digitized subset used for mapping, not a substitute for the district condition-survey total above; the two figures are reported separately, not reconciled to a single number.'
  ));

  // ---- Charts: condition distribution + network composition ----
  container.appendChild(sectionBlock('DUCAR network composition', 'Computed from the MoWT district-level condition survey, all 135 districts.', chartGrid([
    chartCard({
      title: 'Condition Distribution',
      type: 'doughnut', labels: ['Good', 'Fair', 'Poor'],
      datasets: [{ data: [Math.round(goodKm), Math.round(fairKm), Math.round(poorKm)], backgroundColor: ['#00ff85', '#fff500', '#ff7a00'], borderWidth: 0 }],
    }),
    chartCard({
      title: 'Network Length by Road Category',
      type: 'bar', labels: ['District Roads', 'Urban Roads', 'Community Access Roads'],
      datasets: [{ data: [Math.round(distKm), Math.round(urbKm), Math.round(commKm)], backgroundColor: '#00e5ff', borderRadius: 6 }],
    }),
    chartCard({
      title: 'Paved vs Unpaved',
      type: 'bar', labels: ['Paved', 'Unpaved'],
      datasets: [{ data: [Math.round(pavedKm), Math.round(unpavedKm)], backgroundColor: ['#2979ff', '#ff7a00'], borderRadius: 6 }],
    }),
  ])));

  // -----------------------------------------------------------------------
  // Pavement Condition Estimator — a transparent, documented formula.
  // Replaces the old site's "GPU Live Pavement Deterioration Inference
  // Simulator" (fake NVIDIA RTX 5060 / CUDA / "1.4ms GPU compute" branding
  // over what was always just an arithmetic formula). No hardware theater.
  // -----------------------------------------------------------------------
  const WEIGHTS = {
    'Bituminous / Asphalt (paved)': { base: 85, traffic: 1.2, rainfall: 1.0, age: 1.8 },
    'Gravel':                       { base: 70, traffic: 2.5, rainfall: 3.0, age: 2.6 },
    'Earth':                        { base: 55, traffic: 3.5, rainfall: 4.5, age: 3.2 },
  };

  const estimatorCard = el('div', { class: 'card card-pad' });
  estimatorCard.appendChild(el('h3', {}, 'Pavement Condition Estimator'));
  estimatorCard.appendChild(el('p', { class: 'muted', style: 'margin-top:4px;' },
    'A transparent, formula-based estimate of Visual Condition Index (VCI) from surface type, traffic loading, rainfall exposure and maintenance age. Illustrative planning tool, not a calibrated deterioration model.'));

  const formRow = el('div', { style: 'display:flex; flex-wrap:wrap; gap:16px; margin-top:16px;' });
  function field(labelText, inputEl){
    const wrap = el('div', { style: 'display:flex; flex-direction:column; gap:6px; min-width:180px; flex:1;' });
    wrap.appendChild(el('label', { style: 'font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-tertiary);' }, labelText));
    wrap.appendChild(inputEl);
    return wrap;
  }
  const inputStyle = 'padding:9px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); font:inherit; font-size:.9rem; background:var(--bg-elevated); color:var(--text-primary);';

  const surfaceSelect = document.createElement('select');
  surfaceSelect.style.cssText = inputStyle;
  Object.keys(WEIGHTS).forEach(k => surfaceSelect.appendChild(el('option', { value: k }, k)));

  const aadtInput = document.createElement('input');
  aadtInput.type = 'number'; aadtInput.min = '0'; aadtInput.value = '1500'; aadtInput.style.cssText = inputStyle;

  const rainfallInput = document.createElement('input');
  rainfallInput.type = 'number'; rainfallInput.min = '0'; rainfallInput.value = '1200'; rainfallInput.style.cssText = inputStyle;

  const ageInput = document.createElement('input');
  ageInput.type = 'number'; ageInput.min = '0'; ageInput.value = '4'; ageInput.style.cssText = inputStyle;

  formRow.appendChild(field('Surface Material', surfaceSelect));
  formRow.appendChild(field('AADT (vehicles/day)', aadtInput));
  formRow.appendChild(field('Annual Rainfall (mm)', rainfallInput));
  formRow.appendChild(field('Years Since Last Maintenance', ageInput));
  estimatorCard.appendChild(formRow);

  const resultRow = el('div', { style: 'display:flex; align-items:center; gap:20px; margin-top:20px; padding:16px; background:var(--bg-subtle); border-radius:var(--radius-md); flex-wrap:wrap;' });
  const vciValueEl = el('div', { style: 'font-size:2.2rem; font-weight:800; color:var(--text-primary);' }, '—');
  const vciBadgeSlot = el('div', {});
  const vciBreakdown = el('div', { class: 'muted', style: 'font-size:.8rem; line-height:1.6; flex:1; min-width:220px;' });
  resultRow.appendChild(el('div', {}, [el('div', { class: 'kpi-label', style: 'margin-bottom:6px;' }, 'Estimated VCI'), vciValueEl, vciBadgeSlot]));
  resultRow.appendChild(vciBreakdown);
  estimatorCard.appendChild(resultRow);

  function recompute(){
    const w = WEIGHTS[surfaceSelect.value];
    const aadt = Math.max(0, Number(aadtInput.value) || 0);
    const rain = Math.max(0, Number(rainfallInput.value) || 0);
    const age = Math.max(0, Number(ageInput.value) || 0);
    const trafficPenalty = (aadt / 1000) * w.traffic;
    const rainfallPenalty = (rain / 1000) * w.rainfall;
    const agePenalty = age * w.age;
    let vci = w.base - trafficPenalty - rainfallPenalty - agePenalty;
    vci = Math.max(0, Math.min(100, vci));
    vciValueEl.textContent = vci.toFixed(1);
    let cond = 'Critical';
    if(vci >= 80) cond = 'Good';
    else if(vci >= 60) cond = 'Fair';
    else if(vci >= 40) cond = 'Poor';
    vciBadgeSlot.innerHTML = '';
    vciBadgeSlot.appendChild(conditionBadge(cond));
    vciBreakdown.innerHTML =
      'Base (' + esc(surfaceSelect.value) + '): ' + w.base.toFixed(1) + ' pts<br>' +
      '&minus; Traffic loading: ' + trafficPenalty.toFixed(1) + ' pts<br>' +
      '&minus; Rainfall exposure: ' + rainfallPenalty.toFixed(1) + ' pts<br>' +
      '&minus; Maintenance age: ' + agePenalty.toFixed(1) + ' pts';
  }
  [surfaceSelect, aadtInput, rainfallInput, ageInput].forEach(i => i.addEventListener('input', recompute));
  recompute();

  estimatorCard.appendChild(el('p', { class: 'footnote' },
    'Formula: VCI = base condition for the selected surface (Bituminous/Asphalt 85, Gravel 70, Earth 55) &minus; traffic penalty (AADT/1,000 &times; surface weight) &minus; rainfall penalty (annual rainfall mm/1,000 &times; surface weight) &minus; maintenance-age penalty (years since last maintenance &times; surface weight), clamped to 0&ndash;100. Surface weights (traffic / rainfall / age per unit): Bituminous 1.2 / 1.0 / 1.8, Gravel 2.5 / 3.0 / 2.6, Earth 3.5 / 4.5 / 3.2 &mdash; unsealed surfaces are weighted to deteriorate faster under traffic and rainfall, consistent with standard pavement-engineering practice. This is a documented illustrative estimator for indicative planning use, not a calibrated statistical model and not a substitute for field VCI assessment.'
  ));
  container.appendChild(sectionBlock('Pavement condition estimator', null, estimatorCard));

  // -----------------------------------------------------------------------
  // Honest traffic-data disclosure. No named DUCAR traffic-count-station
  // history exists in the platform's data — MoWT's traffic-count
  // programme (geo/traffic_count_stations.geojson) covers only the
  // classified national road network. We say so plainly and show that real
  // national-network station data for illustration, rather than fabricating
  // a DUCAR growth trend or a regression statistic we have not computed.
  // -----------------------------------------------------------------------
  const netById = {};
  network.features.forEach(f => { netById[f.properties['Link Id 1']] = f.properties; });
  const REGION_MAP = { 'Central':'Central', 'East':'Eastern', 'North East':'North Eastern', 'North':'Northern', 'South':'Southern', 'West':'Western' };
  const stationRows = trafficGeo.features.map(f => {
    const p = f.properties;
    const np = netById[p.Link_ID] || {};
    return {
      station: p.STATION || p.TCS_NAME || '—',
      code: p.TCS_NAME,
      link_name: p.Link_Name || (np['Link Name']) || '—',
      region: REGION_MAP[p.REGION] || p.REGION || '—',
      aadt: np['Aadt 2026 Live'] ?? null,
      heavy_aadt: np['Aadt Heavy Trucks'] ?? null,
    };
  }).filter(r => r.aadt !== null);

  const avgAadt = stationRows.reduce((s, r) => s + r.aadt, 0) / stationRows.length;

  const trafficBlock = el('div', {});
  trafficBlock.appendChild(el('p', { class: 'muted', style: 'margin:0 0 12px;' },
    fmtNum(stationRows.length) + ' stations with a matched current AADT figure · mean ' + fmtNum(avgAadt, 0) + ' vehicles/day across these stations. These are national-network counts (MoWT\'s traffic-count programme covers only the classified national network, not DUCAR roads) shown for illustration — not projected, extrapolated or averaged onto the DUCAR totals above.'));
  trafficBlock.appendChild(dataTable({
    caption: 'traffic count stations',
    pageSize: 25,
    searchKeys: ['station', 'code', 'link_name', 'region'],
    filters: [{ label: 'region', key: 'region', options: DataStore.REGIONS }],
    columns: [
      { key: 'station', label: 'Station', align: undefined },
      { key: 'link_name', label: 'Road Link', align: undefined },
      { key: 'region', label: 'Region', align: undefined },
      { key: 'aadt', label: 'AADT 2026 (veh/day)', align: 'num', fmt: v => fmtNum(v, 0) },
      { key: 'heavy_aadt', label: 'Heavy Trucks (veh/day)', align: 'num', fmt: v => fmtNum(v, 0) },
    ],
    rows: stationRows,
  }));
  container.appendChild(sectionBlock('Traffic count station data', 'National-network stations, shown for context — not a DUCAR traffic model.', trafficBlock));
};
