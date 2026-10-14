RENDERERS.analytics = async function(container){
  const [net, ms, detail, rawNet, density, trafficComp, wbCoverage] = await Promise.all([
    DataStore.networkStats(), DataStore.msSummary(), DataStore.msDetail(), DataStore.network(), DataStore.roadDensity(), DataStore.trafficComposition(), DataStore.weighbridgeDistrictCoverage()
  ]);
  container.innerHTML = '';

  const REGIONS = DataStore.REGIONS;
  const CLASS_ORDER = ['A','B','C','M'];
  const feats = rawNet.features.map(f=>f.properties);

  container.appendChild(pageHead(
    'Analytics & Insights',
    'The single canonical chart library for this platform — real distributions computed from the GIS road-network inventory and MoWT maintenance-strategy and planning workbooks. Top-line KPIs live on Overview; this page goes deeper.',
    '22 charts · 4 categories · 17 findings'
  ));

  /* ============================================================
     Live aggregation helpers (region × condition, region × safety
     band, priority-score histogram, etc. — none of this duplicates
     Overview's 4 charts, which cover condition-by-count, class,
     paved/unpaved-by-region and the investment-plan cost line only)
     ============================================================ */

  // Condition (Poor/Fair/Good) by region, in km
  const CONDITIONS = ['Good','Fair','Poor'];
  const condByRegion = {}; REGIONS.forEach(r=> condByRegion[r] = {Good:0,Fair:0,Poor:0});
  feats.forEach(p=>{
    const r = p['Region'], c = p['Condition'];
    if(condByRegion[r] && CONDITIONS.includes(c)) condByRegion[r][c] += (p['Length Km']||0);
  });

  // Road safety risk band (Critical/Low) by region, in km
  const BANDS = ['Critical','Low'];
  const bandByRegion = {}; REGIONS.forEach(r=> bandByRegion[r] = {Critical:0, Low:0});
  feats.forEach(p=>{
    const r = p['Region'], b = p['Road Safety Risk Band'];
    if(bandByRegion[r] && BANDS.includes(b)) bandByRegion[r][b] += (p['Length Km']||0);
  });

  // Average peak-hour speed by class
  const velSum = {A:0,B:0,C:0,M:0}, velCnt = {A:0,B:0,C:0,M:0};
  feats.forEach(p=>{
    const c = p['Road Cla 1'], v = p['Peak Hour Velocity Kmh'];
    if(velSum[c]!==undefined && v!==null && v!==undefined){ velSum[c]+=v; velCnt[c]++; }
  });
  const velAvg = CLASS_ORDER.map(c=> velCnt[c] ? +(velSum[c]/velCnt[c]).toFixed(1) : 0);

  // Average crash rate by region
  const crSum = {}, crCnt = {}; REGIONS.forEach(r=>{ crSum[r]=0; crCnt[r]=0; });
  feats.forEach(p=>{
    const r = p['Region'], v = p['Crash Rate (per 100m-veh-km)'];
    if(crSum[r]!==undefined && v!==null && v!==undefined){ crSum[r]+=v; crCnt[r]++; }
  });
  const crAvg = REGIONS.map(r=> crCnt[r] ? +(crSum[r]/crCnt[r]).toFixed(1) : 0);

  // AADT histogram
  function histogram(values, edges, labels){
    const counts = new Array(labels.length).fill(0);
    values.forEach(v=>{
      for(let i=0;i<edges.length-1;i++){ if(v>=edges[i] && v<edges[i+1]){ counts[i]++; break; } }
    });
    return counts;
  }
  const aadtVals = feats.map(p=>p['Aadt 2026 Live']).filter(v=>v!==null && v!==undefined);
  const aadtEdges = [0,250,500,1000,1500,2000,Infinity];
  const aadtLabels = ['0–250','250–500','500–1,000','1,000–1,500','1,500–2,000','2,000+'];
  const aadtCounts = histogram(aadtVals, aadtEdges, aadtLabels);

  // Maintenance stations, all of them (23), by network km
  const stationKm = {};
  feats.forEach(p=>{ const s = p['Maintena 2']||'Unassigned'; stationKm[s] = (stationKm[s]||0) + (p['Length Km']||0); });
  const stationEntries = Object.entries(stationKm).sort((a,b)=> a[0].localeCompare(b[0]));

  // Surface material breakdown, km (real field, not yet surfaced anywhere else on the platform)
  const surfaceEntries = Object.entries(net.bySurface).sort((a,b)=> b[1]-a[1]);

  // Paved road density by subregion — a real, separate MoWT workbook (land area, not link-level),
  // sorted densest-first. Subregions are a finer breakdown than the platform's 6 maintenance regions.
  const densityRows = (density.by_subregion||[]).slice().sort((a,b)=> b.road_density_now_km_per_1000km2 - a.road_density_now_km_per_1000km2);

  // Heavy-truck share of AADT by region — real per-link fields (Aadt Heavy Trucks / Aadt 2026 Live)
  const heavySum = {}, heavyTotal = {}; REGIONS.forEach(r=>{ heavySum[r]=0; heavyTotal[r]=0; });
  feats.forEach(p=>{
    const r = p['Region'], aadt = p['Aadt 2026 Live'], heavy = p['Aadt Heavy Trucks'];
    if(heavySum[r]!==undefined && aadt && heavy!==null && heavy!==undefined){ heavySum[r]+=heavy; heavyTotal[r]+=aadt; }
  });
  const heavySharePct = REGIONS.map(r=> heavyTotal[r] ? +(heavySum[r]/heavyTotal[r]*100).toFixed(1) : 0);

  // Priority-score histogram + age vs priority scatter (link_investment_priority — 338 real rows)
  const lip = detail.link_investment_priority || [];
  const scoreVals = lip.map(r=>r.priority_score).filter(v=>v!==null && v!==undefined);
  const scoreEdges = [40,60,80,100,120,140,160];
  const scoreLabels = ['40–60','60–80','80–100','100–120','120–140','140–160'];
  const scoreCounts = histogram(scoreVals, scoreEdges, scoreLabels);
  const scatterPts = lip.filter(r=> r.age_years!==null && r.age_years!==undefined && r.priority_score!==null && r.priority_score!==undefined)
    .map(r=> ({x:r.age_years, y:r.priority_score}));

  // National traffic composition by vehicle class, 2025 — a real, separate MoWT traffic-model
  // workbook (per-link vehicle counts), distinct from the AADT/heavy-truck fields already on
  // network.geojson. Sorted heaviest-first.
  const compEntries = Object.entries(trafficComp.national_composition_veh_per_day||{}).sort((a,b)=>b[1]-a[1]);

  // Network-wide Intervention Priority Band (this site's own composite: 40% condition +
  // 35% traffic percentile + 25% safety risk, on network.geojson's own 1,015 links) —
  // distinct scope from the 338-link paved 5-year backlog "Priority Score" charts above.
  const PRIORITY_BANDS = ['Low','Moderate','High','Critical'];
  const priorityBandCounts = {Low:0, Moderate:0, High:0, Critical:0};
  let priorityScored = 0, priorityUnscored = 0;
  feats.forEach(p=>{
    const b = p['Intervention Priority Band'];
    if(b && priorityBandCounts[b]!==undefined){ priorityBandCounts[b]++; priorityScored++; }
    else priorityUnscored++;
  });

  // Weighbridge district-coverage register — separate real MoWT dataset (see data.js note)
  const wbRows = (wbCoverage.by_weighbridge||[]).slice();

  // Sealed vs unsealed by class (ms workbook)
  const nbc = CLASS_ORDER.map(c => (ms.network_by_class||[]).find(x=>x.road_class===c) || {bituminous_km:0, unsealed_km:0});

  // Structures by region (bridges vs culverts)
  const srsByRegion = {}; (ms.structures_regional_split||[]).forEach(r=> srsByRegion[r.maintenance_region]=r);
  const bridgesByRegion = REGIONS.map(r=> srsByRegion[r] ? srsByRegion[r].bridges_count : 0);
  const culvertsByRegion = REGIONS.map(r=> srsByRegion[r] ? srsByRegion[r].major_culverts_count : 0);

  // Investment plan (valid FY rows only — the summary array mixes in a "Total / Avg" row)
  const fyRows = (ms.investment_plan_annual||[]).filter(y=>/^FY\d/.test(y.financial_year));

  // Asset value trend, paved vs unpaved over time
  const avtFY = [...new Set((ms.asset_value_trend||[]).map(x=>x.financial_year))].sort();
  const avtPaved = avtFY.map(fy => { const r=(ms.asset_value_trend||[]).find(x=>x.financial_year===fy && x.surface_type==='Paved'); return r? Math.round(r.asset_value_mn_usd) : null; });
  const avtUnpaved = avtFY.map(fy => { const r=(ms.asset_value_trend||[]).find(x=>x.financial_year===fy && x.surface_type==='Unpaved'); return r? Math.round(r.asset_value_mn_usd) : null; });

  /* ============================================================
     Category pills + chart grid
     ============================================================ */
  function tagged(node, cat){ node.dataset.cat = cat; return node; }

  const charts = [
    // ---- Network & Pavement ----
    tagged(chartCard({ title:'Road Condition by Region',
      type:'bar', stacked:true, labels:REGIONS, datasets:[
        {label:'Good', data:REGIONS.map(r=>Math.round(condByRegion[r].Good)), backgroundColor:'#00ff85', borderRadius:3},
        {label:'Fair', data:REGIONS.map(r=>Math.round(condByRegion[r].Fair)), backgroundColor:'#fff500', borderRadius:3},
        {label:'Poor', data:REGIONS.map(r=>Math.round(condByRegion[r].Poor)), backgroundColor:'#ff2d78', borderRadius:3},
      ] }), 'network'),
    tagged(chartCard({ title:'Sealed vs Unsealed Length by Road Class',
      type:'bar', stacked:true, labels: CLASS_ORDER.map(c=>DataStore.CLASS_LABELS[c]||c), datasets:[
        {label:'Bituminous (sealed)', data: nbc.map(x=>Math.round(x.bituminous_km)), backgroundColor:'#2979ff', borderRadius:3},
        {label:'Unsealed', data: nbc.map(x=>Math.round(x.unsealed_km)), backgroundColor:'#ff7a00', borderRadius:3},
      ] }), 'network'),
    tagged(chartCard({ title:'VCI Rating Distribution', subtitle:'Maintenance-strategy scale — distinct from the field-survey Condition above',
      type:'doughnut', labels:Object.keys(ms.vci_condition_distribution), datasets:[{ data:Object.values(ms.vci_condition_distribution), backgroundColor:NEON, borderWidth:0 }] }), 'network'),
    tagged(chartCard({ title:'Network Length by Maintenance Station', tall:true,
      type:'bar', indexAxis:'y', labels: stationEntries.map(e=>e[0]), datasets:[{ data: stationEntries.map(e=>Math.round(e[1])), backgroundColor:'#00e5ff', borderRadius:3 }] }), 'network'),
    tagged(chartCard({ title:'Network Length by Surface Material',
      type:'bar', indexAxis:'y', labels: surfaceEntries.map(e=>e[0]), datasets:[{ data: surfaceEntries.map(e=>Math.round(e[1])), backgroundColor:'#00ff85', borderRadius:3 }] }), 'network'),
    tagged(chartCard({ title:'Paved Road Density by Subregion', subtitle:'km of bituminous road per 1,000 km² land area — MoWT road density workbook, 13 subregions', tall:true,
      type:'bar', indexAxis:'y', labels: densityRows.map(r=>r.subregion), datasets:[
        {label:'Now', data: densityRows.map(r=>r.road_density_now_km_per_1000km2), backgroundColor:'#00e5ff', borderRadius:3},
        {label:'At NDP3 completion', data: densityRows.map(r=>r.road_density_ndp3_end_km_per_1000km2), backgroundColor:'#9d00ff', borderRadius:3},
      ] }), 'network'),

    // ---- Traffic & Safety ----
    tagged(chartCard({ title:'AADT Distribution', subtitle:fmtNum(aadtVals.length)+' of '+fmtNum(feats.length)+' links carry a live 2026 AADT figure',
      type:'bar', labels:aadtLabels, datasets:[{ data:aadtCounts, backgroundColor:'#9d00ff', borderRadius:6 }] }), 'traffic'),
    tagged(chartCard({ title:'Average Peak-Hour Speed by Road Class', subtitle:'km/h',
      type:'bar', labels: CLASS_ORDER.map(c=>DataStore.CLASS_LABELS[c]||c), datasets:[{ data:velAvg, backgroundColor:'#ff00c8', borderRadius:6 }] }), 'traffic'),
    tagged(chartCard({ title:'Road Safety Risk Band by Region',
      type:'bar', stacked:true, labels:REGIONS, datasets:[
        {label:'Critical', data:REGIONS.map(r=>Math.round(bandByRegion[r].Critical)), backgroundColor:'#ff2d78', borderRadius:3},
        {label:'Low', data:REGIONS.map(r=>Math.round(bandByRegion[r].Low)), backgroundColor:'#00ff85', borderRadius:3},
      ] }), 'traffic'),
    tagged(chartCard({ title:'Average Crash Rate by Region', subtitle:'Crashes per 100m-veh-km',
      type:'bar', labels:REGIONS, datasets:[{ data:crAvg, backgroundColor:'#ff7a00', borderRadius:6 }] }), 'traffic'),
    tagged(chartCard({ title:'Heavy-Truck Share of Traffic by Region', subtitle:'% of AADT (Aadt Heavy Trucks ÷ Aadt 2026 Live)',
      type:'bar', labels:REGIONS, datasets:[{ data:heavySharePct, backgroundColor:'#ff00c8', borderRadius:6 }] }), 'traffic'),
    tagged(chartCard({ title:'National Traffic Composition by Vehicle Class, 2025', subtitle:trafficComp.meta.linked_count+' of '+trafficComp.meta.total_links+' links carry a modelled figure — vehicles/day, summed', tall:true,
      type:'bar', indexAxis:'y', labels: compEntries.map(e=>e[0]), datasets:[{ data: compEntries.map(e=>Math.round(e[1])), backgroundColor:'#fff500', borderRadius:3 }] }), 'traffic'),

    // ---- Structures ----
    tagged(chartCard({ title:'Bridge Condition Distribution',
      type:'doughnut', labels:Object.keys(ms.bridge_condition_distribution), datasets:[{ data:Object.values(ms.bridge_condition_distribution), backgroundColor:NEON, borderWidth:0 }] }), 'structures'),
    tagged(chartCard({ title:'Major Culvert Condition Distribution',
      type:'doughnut', labels:Object.keys(ms.culvert_condition_distribution), datasets:[{ data:Object.values(ms.culvert_condition_distribution), backgroundColor:NEON.slice().reverse(), borderWidth:0 }] }), 'structures'),
    tagged(chartCard({ title:'Structures by Region: Bridges vs Major Culverts',
      type:'bar', stacked:true, labels:REGIONS, datasets:[
        {label:'Bridges', data:bridgesByRegion, backgroundColor:'#2979ff', borderRadius:3},
        {label:'Major Culverts', data:culvertsByRegion, backgroundColor:'#00e5ff', borderRadius:3},
      ] }), 'structures'),

    // ---- Investment & Priority ----
    tagged(chartCard({ title:'Recommended Intervention Mix', subtitle:'Network length, km',
      type:'bar', indexAxis:'y', labels:(ms.intervention_mix_summary||[]).map(x=>x.intervention), datasets:[{ data:(ms.intervention_mix_summary||[]).map(x=>Math.round(x.length_km)), backgroundColor:'#00ff85', borderRadius:4 }] }), 'investment'),
    tagged(chartCard({ title:'Paved vs Unpaved Asset Value Trend', subtitle:'USD million', type:'line',
      labels: avtFY, datasets:[
        {label:'Paved', data:avtPaved, borderColor:'#2979ff', backgroundColor:'#2979ff', tension:0.25, spanGaps:true},
        {label:'Unpaved', data:avtUnpaved, borderColor:'#ff7a00', backgroundColor:'#ff7a00', tension:0.25, spanGaps:true},
      ] }), 'investment'),
    tagged(chartCard({ title:'Priority Score Distribution',
      type:'bar', labels:scoreLabels, datasets:[{ data:scoreCounts, backgroundColor:'#fff500', borderRadius:6 }] }), 'investment'),
    tagged(chartCard({ title:'Funding Gap vs Baseline by Year', subtitle:'UGX billion',
      type:'bar', labels: fyRows.map(y=>y.financial_year), datasets:[{ data: fyRows.map(y=>Math.round(y.funding_gap_vs_baseline_bn_ushs||0)), backgroundColor:'#ff2d78', borderRadius:6 }] }), 'investment'),
    tagged(chartCard({ title:'Link Age vs Priority Score', type:'scatter',
      labels: null, datasets:[{ label:'Links', data:scatterPts, backgroundColor:'#9d00ff' }] }), 'investment'),
    tagged(chartCard({ title:'Network-Wide Intervention Priority', subtitle:priorityScored+' of '+feats.length+' links scored — this site’s own composite (40% condition, 35% traffic, 25% safety risk), distinct from the 338-link paved backlog score above',
      type:'doughnut', labels:PRIORITY_BANDS, datasets:[{ data:PRIORITY_BANDS.map(b=>priorityBandCounts[b]), backgroundColor:['#00c853','#fff500','#ff7a00','#ff2d78'], borderWidth:0 }] }), 'investment'),
    tagged(chartCard({ title:'Weighbridge District Coverage', subtitle:'Districts assigned per enforcement station — separate MoWT register, see Network Explorer footnote',
      type:'bar', indexAxis:'y', labels: wbRows.map(r=>r.weighbridge), datasets:[{ data: wbRows.map(r=>r.district_count), backgroundColor:'#00e5ff', borderRadius:4 }] }), 'traffic'),
  ];

  const CATS = [
    {id:'all', label:'All Charts'},
    {id:'network', label:'Network & Pavement'},
    {id:'traffic', label:'Traffic & Safety'},
    {id:'structures', label:'Structures'},
    {id:'investment', label:'Investment & Priority'},
  ];
  const tabRow = el('div',{class:'tab-row'});
  const grid = chartGrid(charts);
  function applyFilter(catId){
    charts.forEach(c => { c.style.display = (catId==='all' || c.dataset.cat===catId) ? '' : 'none'; });
  }
  CATS.forEach(c=>{
    const btn = el('button',{class:'tab-btn'+(c.id==='all'?' active':'')}, c.label);
    btn.addEventListener('click', ()=>{
      tabRow.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(c.id);
    });
    tabRow.appendChild(btn);
  });

  container.appendChild(sectionBlock('Chart library', 'Filter by category — every chart is computed live from real fetched data.', el('div',{},[tabRow, grid])));

  /* ============================================================
     Priority Ranking Explorer — real, paginated, full 338-row set.
     priority_score is a genuine per-link output of the MoWT
     prioritisation model (verified non-tied: sample scores 77.7,
     100.9, 106.1, 104.5, 85.6, 82.4, 86.3, 81.3, 81.7 across the
     first 10 rows) — not a fabricated "live calculator".
     ============================================================ */
  const priorityRows = lip.slice().sort((a,b)=> (b.priority_score||0) - (a.priority_score||0));
  container.appendChild(sectionBlock('Priority Ranking Explorer', 'All 338 links in the FY26/27–FY30/31 investment-priority register, ranked by the maintenance-strategy model’s real priority_score — search, filter and sort freely.',
    dataTable({
      caption: 'priority-ranked links',
      pageSize: 25,
      rows: priorityRows,
      searchKeys: ['link_name','road_no'],
      filters: [{ label:'priority band', key:'priority_band', options: [...new Set(lip.map(r=>r.priority_band).filter(Boolean))].sort() }],
      columns: [
        { key:'priority_rank', label:'Model Rank', align:'num' },
        { key:'link_name', label:'Link' },
        { key:'road_class', label:'Class', render:(v)=> (DataStore.CLASS_LABELS[v]||v) },
        { key:'priority_score', label:'Priority Score', align:'num', fmt:v=>fmtNum(v,1) },
        { key:'priority_band', label:'Band', render:(v)=> v || '—' },
        { key:'age_years', label:'Age (yrs)', align:'num' },
        { key:'scheduled_fy', label:'Scheduled FY', render:(v)=> v || 'Unscheduled' },
        { key:'indicative_base_cost_bn_ushs', label:'Cost (UGX bn)', align:'num', fmt:v=>fmtNum(v,1) },
        { key:'asset_value_at_risk_bn_ushs', label:'Asset Value at Risk (UGX bn)', align:'num', fmt:v=>fmtNum(v,1) },
      ]
    })
  ));

  /* ============================================================
     Curated findings — 15 real, computed findings distinct from
     Overview's 8 (unsealed share, Class C share, Central vs North
     Eastern length, 338-link programme, total asset value, VCI
     poor+very-poor count, regional paving gap, average link length
     are ALL on Overview and NOT repeated here).
     ============================================================ */
  const totalKm = net.totalKm;
  const since2020Km = feats.reduce((s,p)=> s + ((p['Completion Year']&&p['Completion Year']>=2020) ? (p['Length Km']||0) : 0), 0);

  const roadLinks = detail.road_links || [];
  const notRoutine = roadLinks.filter(r=> r.recommended_intervention && !/Routine/i.test(r.recommended_intervention)).length;

  const criticalKm = REGIONS.reduce((s,r)=> s + bandByRegion[r].Critical, 0);

  const bridgeCond = ms.bridge_condition_distribution;
  const bridgeTotal = Object.values(bridgeCond).reduce((a,b)=>a+b,0);
  const bridgePoorCrit = (bridgeCond.Poor||0) + (bridgeCond.Critical||0);

  const aadtByRegionSum = {}, aadtByRegionCnt = {};
  REGIONS.forEach(r=>{ aadtByRegionSum[r]=0; aadtByRegionCnt[r]=0; });
  feats.forEach(p=>{ const r=p['Region'], a=p['Aadt 2026 Live']; if(aadtByRegionSum[r]!==undefined && a!==null && a!==undefined){ aadtByRegionSum[r]+=a; aadtByRegionCnt[r]++; } });
  const aadtByRegionAvg = {}; REGIONS.forEach(r=> aadtByRegionAvg[r] = aadtByRegionCnt[r] ? aadtByRegionSum[r]/aadtByRegionCnt[r] : 0);
  const highestAadtRegion = REGIONS.reduce((a,b)=> aadtByRegionAvg[b]>aadtByRegionAvg[a]?b:a);
  const lowestAadtRegion = REGIONS.reduce((a,b)=> aadtByRegionAvg[b]<aadtByRegionAvg[a]?b:a);

  const slowestClassIdx = velAvg.reduce((iMin,v,i,arr)=> (v>0 && (arr[iMin]===0 || v<arr[iMin])) ? i : iMin, 0);
  const fastestClassIdx = velAvg.reduce((iMax,v,i,arr)=> v>arr[iMax] ? i : iMax, 0);

  const avtPavedFirst = avtPaved.find(v=>v!==null), avtPavedLast = [...avtPaved].reverse().find(v=>v!==null);
  const pavedGrowthPct = avtPavedFirst ? ((avtPavedLast-avtPavedFirst)/avtPavedFirst*100) : null;

  const fundingGapSum = fyRows.reduce((s,y)=> s + (y.funding_gap_vs_baseline_bn_ushs||0), 0);

  const highestCrashRegion = REGIONS.reduce((a,b)=> crAvg[REGIONS.indexOf(b)]>crAvg[REGIONS.indexOf(a)]?b:a);

  const p1Count = lip.filter(r=>r.priority_band==='Priority 1').length;

  const topSurface = surfaceEntries[0];
  const heaviestTruckRegionIdx = heavySharePct.reduce((iMax,v,i,arr)=> v>arr[iMax]?i:iMax, 0);

  const confVals = feats.map(p=>p['Condition Confidence Pct']).filter(v=>v!==null && v!==undefined);
  const avgConfidence = confVals.reduce((s,v)=>s+v,0) / confVals.length;
  const lowConfCount = confVals.filter(v=>v<70).length;

  const findings = [
    { t:'Very little of the network is newly built', d:`Only ${(since2020Km/totalKm*100).toFixed(1)}% of classified network length (${fmtNum(since2020Km,0)} km) carries a completion year of 2020 or later — most of the network predates the current maintenance-strategy cycle.`, a:'var(--neon-cyan)' },
    { t:`${highestAadtRegion} region carries the heaviest average traffic loading`, d:`${highestAadtRegion} links average ${fmtNum(aadtByRegionAvg[highestAadtRegion],0)} vehicles/day (2026 modelled AADT), against ${fmtNum(aadtByRegionAvg[lowestAadtRegion],0)} in ${lowestAadtRegion}, the lightest-loaded region.`, a:'var(--neon-purple)' },
    { t:`${(notRoutine/roadLinks.length*100).toFixed(0)}% of assessed links need more than routine maintenance`, d:`Of ${fmtNum(roadLinks.length)} VCI-assessed links, ${fmtNum(notRoutine)} carry a recommended intervention beyond routine maintenance — periodic maintenance, rehabilitation or reconstruction.`, a:'var(--neon-orange)' },
    { t:`${(criticalKm/totalKm*100).toFixed(0)}% of the network sits in the Critical safety-risk band`, d:`${fmtNum(criticalKm,0)} km of classified network is flagged Critical on the road safety risk band; the remainder is rated Low or unassigned.`, a:'var(--neon-pink)' },
    { t:`${(bridgePoorCrit/bridgeTotal*100).toFixed(0)}% of bridges are rated Poor or Critical`, d:`${fmtNum(bridgePoorCrit)} of ${fmtNum(bridgeTotal)} registered bridges are rated Poor or Critical condition — a distinct register from the road-link condition figures above.`, a:'var(--neon-magenta)' },
    { t:`Peak-hour speeds fall to ${velAvg[slowestClassIdx]} km/h on Class ${CLASS_ORDER[slowestClassIdx]} roads`, d:`Average peak-hour speed ranges from ${velAvg[slowestClassIdx]} km/h on Class ${CLASS_ORDER[slowestClassIdx]} links up to ${velAvg[fastestClassIdx]} km/h on Class ${CLASS_ORDER[fastestClassIdx]} — a proxy for congestion by road hierarchy.`, a:'var(--neon-blue)' },
    { t:'Paved network asset value has more than doubled since FY17/18', d: pavedGrowthPct!==null ? `Paved network asset value rose from USD ${fmtNum(avtPavedFirst,0)} million in FY17/18 to USD ${fmtNum(avtPavedLast,0)} million in FY25/26, a ${pavedGrowthPct.toFixed(0)}% increase, per the asset-value trend workbook.` : 'Insufficient trend data.', a:'var(--neon-green)' },
    { t:`The 5-year investment plan carries a UGX ${fmtNum(fundingGapSum,0)} billion funding gap`, d:`Summed across the FY26/27–FY30/31 programme years, the funding gap against baseline financing totals UGX ${fmtNum(fundingGapSum,0)} billion.`, a:'var(--neon-yellow)' },
    { t:`${highestCrashRegion} region has the highest average crash rate`, d:`${highestCrashRegion} averages ${fmtNum(crAvg[REGIONS.indexOf(highestCrashRegion)],1)} crashes per 100m-veh-km, the highest of all 6 maintenance regions.`, a:'var(--neon-orange)' },
    { t:`${fmtNum(p1Count)} links are rated Priority 1, the most urgent tier`, d:`${(p1Count/lip.length*100).toFixed(0)}% of the 338 priority-ranked links (${fmtNum(p1Count)} links) fall in the Priority 1 band of the investment-priority model.`, a:'var(--neon-purple)' },
    { t:`${topSurface[0]} is the dominant surface material`, d:`${fmtNum(topSurface[1],0)} km (${(topSurface[1]/totalKm*100).toFixed(0)}% of the classified network) is recorded as ${topSurface[0]} surface — the single largest of ${surfaceEntries.length} recorded materials.`, a:'var(--neon-cyan)' },
    { t:`${REGIONS[heaviestTruckRegionIdx]} carries the heaviest freight-truck share`, d:`Heavy trucks make up ${heavySharePct[heaviestTruckRegionIdx]}% of AADT on ${REGIONS[heaviestTruckRegionIdx]} region's links, the highest heavy-vehicle share of any region — a proxy for freight-corridor loading and pavement-fatigue risk.`, a:'var(--neon-green)' },
    { t:`Mean condition-rating confidence is ${avgConfidence.toFixed(0)}%`, d:`Across ${fmtNum(confVals.length)} field-surveyed links, ${fmtNum(lowConfCount)} (${(lowConfCount/confVals.length*100).toFixed(0)}%) carry a recorded condition confidence below 70% — flagged here rather than treated as equally certain as the rest.`, a:'var(--neon-pink)' },
    { t:`${densityRows[0].subregion} has the densest paved network, ${densityRows[densityRows.length-1].subregion} the sparsest`, d:`${densityRows[0].subregion} carries ${densityRows[0].road_density_now_km_per_1000km2} km of paved road per 1,000 km² of land area, against ${densityRows[densityRows.length-1].road_density_now_km_per_1000km2} km in ${densityRows[densityRows.length-1].subregion} — a ${(densityRows[0].road_density_now_km_per_1000km2/densityRows[densityRows.length-1].road_density_now_km_per_1000km2).toFixed(1)}× gap, from the MoWT road density workbook.`, a:'var(--neon-yellow)' },
    { t:`Motorcycles are the single largest vehicle class on the network`, d:`Motorcycles & scooters account for ${(compEntries[0][1]/trafficComp.meta.total_motorised_veh_per_day*100).toFixed(0)}% of modelled 2025 motorised traffic (${fmtNum(compEntries[0][1],0)} of ${fmtNum(trafficComp.meta.total_motorised_veh_per_day,0)} vehicles/day) — more than double the next-largest class, from the MoWT national traffic model.`, a:'var(--neon-blue)' },
    { t:`${fmtNum(priorityBandCounts.Critical)} links fall in the network-wide Critical priority band`, d:`Scoring all ${fmtNum(priorityScored)} of ${fmtNum(feats.length)} classified links on condition, traffic loading and safety risk together, ${fmtNum(priorityBandCounts.Critical)} land in the top (Critical) quartile for intervention priority — see Network Explorer for the full per-link register.`, a:'var(--neon-pink)' },
    { t:`${wbRows[0].weighbridge} weighbridge has the widest district catchment`, d:`${wbRows[0].weighbridge} station is assigned ${fmtNum(wbRows[0].district_count)} districts in the MoWT weighbridge coverage register, the widest catchment of the ${fmtNum(wbRows.length)} stations with a defined coverage area.`, a:'var(--neon-cyan)' },
  ];
  const findGrid = el('div',{class:'grid-3'});
  findings.forEach(f=>{
    findGrid.appendChild(el('div',{class:'card card-pad hoverable', style:`border-left:4px solid ${f.a}`},[
      el('h3',{}, f.t), el('p',{class:'muted', style:'margin-top:6px;'}, f.d)
    ]));
  });
  container.appendChild(sectionBlock('What the deeper data shows', 'Seventeen additional findings, computed live from this page’s data — distinct from the Overview summary.', findGrid));

  container.appendChild(el('p',{class:'footnote'},
    net.source + ' Maintenance-strategy figures are drawn from the MoWT FY2025/26 maintenance-strategy workbooks. Where the two source systems describe similar-sounding totals differently, each figure keeps its own source rather than being merged into one number — see the Overview footnote for detail.'
  ));
};
