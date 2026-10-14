// Executive Reports — a lightweight brief tool. Every figure on every tab is
// computed live from real DataStore calls (networkStats/msSummary, plus a
// live pass over network.geojson for traffic aggregates) — nothing here is a
// hardcoded or invented number. Each tab has a working CSV export of its own
// stat rows (Blob + object URL + a temporary <a download>, no server round trip).

RENDERERS.reports = async function(container){
  const [net, ms, netGeo] = await Promise.all([
    DataStore.networkStats(), DataStore.msSummary(), DataStore.network(),
  ]);
  container.innerHTML = '';

  container.appendChild(pageHead(
    'Executive Reports',
    'Real, live-computed statistics summarized by topic — export any tab as CSV for offline briefing.',
    ms.meta.regions.length + ' regions · FY2025/26 cycle'
  ));

  // ---- live traffic aggregates from network.geojson (not precomputed in networkStats) ----
  const feats = netGeo.features;
  function numeric(key){ return feats.map(f => f.properties[key]).filter(v => typeof v === 'number'); }
  function avg(key){ const v = numeric(key); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; }
  const criticalRiskLinks = feats.filter(f => f.properties['Road Safety Risk Band'] === 'Critical').length;
  const lowRiskLinks = feats.filter(f => f.properties['Road Safety Risk Band'] === 'Low').length;
  const avgAadt = avg('Aadt 2026 Live');
  const avgHeavyTruckAadt = avg('Aadt Heavy Trucks');
  const avgPeakVelocity = avg('Peak Hour Velocity Kmh');
  const avgCrashRate = avg('Crash Rate (per 100m-veh-km)');

  // ---- investment-plan aggregates (filter out the mixed-in "Total / Avg" row) ----
  const invYears = ms.investment_plan_annual.filter(y => /^FY\d/.test(y.financial_year));
  const totalProgrammeCost = invYears.reduce((s,y) => s + (y.programme_cost_bn_ushs||0), 0);
  const avgAssetAtRisk = invYears.reduce((s,y) => s + (y.asset_value_at_risk_bn_ushs||0), 0) / invYears.length;
  const totalFundingGap = invYears.reduce((s,y) => s + (y.funding_gap_vs_baseline_bn_ushs||0), 0);

  const bridgeCond = ms.bridge_condition_distribution;
  const bridgesNeedingAttention = (bridgeCond.Poor||0) + (bridgeCond.Critical||0);
  const bridgeStructure = ms.structures_summary.find(s => s.structure_type === 'Bridges');
  const culvertStructure = ms.structures_summary.find(s => s.structure_type === 'Major culverts');

  // ---- report topics ----
  const TABS = [
    {
      id: 'national', label: 'National Summary',
      source: net.source,
      stats: () => [
        { label:'Total Classified Network', value: fmtNum(net.totalKm,0), unit:'km', accent:'var(--neon-cyan)', raw: Math.round(net.totalKm) },
        { label:'Paved Network', value: fmtNum(net.pavedKm,0), unit:'km', accent:'var(--neon-blue)', delta:(net.pavedKm/net.totalKm*100).toFixed(1)+'% of total', raw: Math.round(net.pavedKm) },
        { label:'Unpaved Network', value: fmtNum(net.unpavedKm,0), unit:'km', accent:'var(--neon-orange)', delta:(net.unpavedKm/net.totalKm*100).toFixed(1)+'% of total', raw: Math.round(net.unpavedKm) },
        { label:'Bridges', value: fmtNum(ms.kpi_summary.total_bridges), accent:'var(--neon-magenta)', raw: ms.kpi_summary.total_bridges },
        { label:'Major Culverts', value: fmtNum(ms.kpi_summary.total_major_culverts), accent:'var(--neon-purple)', raw: ms.kpi_summary.total_major_culverts },
      ],
      chart: () => chartCard({ title:'Paved vs Unpaved Network', type:'doughnut',
        labels:['Paved','Unpaved'], datasets:[{ data:[Math.round(net.pavedKm), Math.round(net.unpavedKm)], backgroundColor:['#2979ff','#ff7a00'], borderWidth:0 }] }),
    },
    {
      id: 'roads', label: 'Roads & Pavement',
      source: net.source,
      stats: () => [
        { label:'Road Links (network.geojson)', value: fmtNum(net.linkCount), accent:'var(--neon-cyan)', raw: net.linkCount },
        { label:'Class A — International Trunk', value: fmtNum(net.byClass.A||0,0), unit:'km', accent:'var(--neon-blue)', raw: Math.round(net.byClass.A||0) },
        { label:'Class B — National Trunk', value: fmtNum(net.byClass.B||0,0), unit:'km', accent:'var(--neon-purple)', raw: Math.round(net.byClass.B||0) },
        { label:'Class C — Primary / District', value: fmtNum(net.byClass.C||0,0), unit:'km', accent:'var(--neon-green)', raw: Math.round(net.byClass.C||0) },
        { label:'Class M — Expressway', value: fmtNum(net.byClass.M||0,0), unit:'km', accent:'var(--neon-pink)', raw: Math.round(net.byClass.M||0) },
      ],
      chart: () => chartCard({ title:'Network Length by Functional Class', subtitle:'km', type:'bar',
        labels:['A','B','C','M'], datasets:[{ data:[net.byClass.A||0,net.byClass.B||0,net.byClass.C||0,net.byClass.M||0].map(v=>Math.round(v)), backgroundColor:'#00e5ff', borderRadius:6 }] }),
    },
    {
      id: 'structures', label: 'Bridges & Structures',
      source: 'MoWT maintenance-strategy structures register, FY2025/26 cycle. Bridges and major culverts are always reported as separate figures.',
      stats: () => [
        { label:'Total Bridges', value: fmtNum(ms.kpi_summary.total_bridges), accent:'var(--neon-magenta)', raw: ms.kpi_summary.total_bridges },
        { label:'Total Major Culverts', value: fmtNum(ms.kpi_summary.total_major_culverts), accent:'var(--neon-purple)', raw: ms.kpi_summary.total_major_culverts },
        { label:'Bridges Poor or Critical', value: fmtNum(bridgesNeedingAttention), accent:'var(--neon-orange)', delta:'of '+ms.kpi_summary.total_bridges+' bridges', raw: bridgesNeedingAttention },
        { label:'Bridge Asset Value', value: fmtNum(bridgeStructure.asset_value_mn_usd,0), unit:'USD mn', accent:'var(--neon-blue)', raw: bridgeStructure.asset_value_mn_usd },
        { label:'Major Culvert Asset Value', value: fmtNum(culvertStructure.asset_value_mn_usd,0), unit:'USD mn', accent:'var(--neon-green)', raw: culvertStructure.asset_value_mn_usd },
      ],
      chart: () => chartCard({ title:'Asset Value: Bridges vs Major Culverts', subtitle:'USD million', type:'bar',
        labels:['Bridges','Major Culverts'], datasets:[{ data:[Math.round(bridgeStructure.asset_value_mn_usd), Math.round(culvertStructure.asset_value_mn_usd)], backgroundColor:['#2979ff','#00ff85'], borderRadius:6 }] }),
    },
    {
      id: 'traffic', label: 'Traffic',
      source: 'Computed live from network.geojson traffic/safety fields ('+numeric('Aadt 2026 Live').length+' of '+net.linkCount+' links carry an AADT reading).',
      stats: () => [
        { label:'Average AADT (2026)', value: fmtNum(avgAadt,0), unit:'veh/day', accent:'var(--neon-cyan)', raw: Math.round(avgAadt) },
        { label:'Average Heavy-Truck AADT', value: fmtNum(avgHeavyTruckAadt,0), unit:'veh/day', accent:'var(--neon-orange)', raw: Math.round(avgHeavyTruckAadt) },
        { label:'Average Peak-Hour Velocity', value: fmtNum(avgPeakVelocity,1), unit:'km/h', accent:'var(--neon-blue)', raw: Number(avgPeakVelocity.toFixed(1)) },
        { label:'Links — Critical Safety Risk', value: fmtNum(criticalRiskLinks), accent:'var(--neon-pink)', delta:(criticalRiskLinks/net.linkCount*100).toFixed(0)+'% of network', raw: criticalRiskLinks },
        { label:'Average Crash Rate', value: fmtNum(avgCrashRate,1), unit:'per 100m-veh-km', accent:'var(--neon-magenta)', raw: Number(avgCrashRate.toFixed(1)) },
      ],
      chart: () => chartCard({ title:'Road Safety Risk Band, National', subtitle:'Links assigned a Critical or Low band', type:'doughnut',
        labels:['Critical','Low'], datasets:[{ data:[criticalRiskLinks, lowRiskLinks], backgroundColor:['#ff2d78','#00ff85'], borderWidth:0 }] }),
    },
    {
      id: 'investment', label: 'Investment',
      source: ms.meta.source + ' — FY26/27 to FY30/31 investment plan.',
      stats: () => [
        { label:'Total Asset Value', value: fmtNum(ms.kpi_summary.total_asset_value_mn_usd,0), unit:'USD mn', accent:'var(--neon-green)', raw: Math.round(ms.kpi_summary.total_asset_value_mn_usd) },
        { label:'Priority-Planned Links', value: fmtNum(ms.counts.priority_planned_links), accent:'var(--neon-cyan)', raw: ms.counts.priority_planned_links },
        { label:'5-Year Programme Cost', value: fmtNum(totalProgrammeCost,0), unit:'UGX bn', accent:'var(--neon-purple)', raw: Math.round(totalProgrammeCost) },
        { label:'Avg. Asset Value at Risk / yr', value: fmtNum(avgAssetAtRisk,0), unit:'UGX bn', accent:'var(--neon-orange)', raw: Math.round(avgAssetAtRisk) },
        { label:'Total Funding Gap vs. Baseline', value: fmtNum(totalFundingGap,0), unit:'UGX bn', accent:'var(--neon-pink)', raw: Math.round(totalFundingGap) },
      ],
      chart: () => chartCard({ title:'Programme Cost vs Funding Gap by Year', subtitle:'UGX billion', type:'bar',
        labels: invYears.map(y=>y.financial_year), datasets:[
          { label:'Programme Cost', data: invYears.map(y=>Math.round(y.programme_cost_bn_ushs)), backgroundColor:'#9d00ff', borderRadius:4 },
          { label:'Funding Gap vs Baseline', data: invYears.map(y=>Math.round(y.funding_gap_vs_baseline_bn_ushs)), backgroundColor:'#ff2d78', borderRadius:4 },
        ] }),
    },
  ];

  // ---- CSV export: build a real file client-side and trigger a download ----
  function exportCsv(tab, stats){
    const rows = [['Metric','Value','Unit']];
    stats.forEach(s => rows.push([s.label, s.raw!==undefined && s.raw!==null ? s.raw : s.value, s.unit||'']));
    const csv = rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mowt-executive-report-' + tab.id + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return blob;
  }

  let activeId = TABS[0].id;
  const tabRow = el('div',{class:'tab-row'});
  const body = el('div',{});

  function renderTabRow(){
    tabRow.innerHTML = '';
    TABS.forEach(t => {
      const btn = el('button',{
        class: 'tab-btn' + (t.id===activeId ? ' active' : ''),
        onclick: () => { activeId = t.id; renderTabRow(); renderBody(); },
      }, t.label);
      tabRow.appendChild(btn);
    });
  }

  function renderBody(){
    const tab = TABS.find(t => t.id===activeId);
    const stats = tab.stats();
    body.innerHTML = '';

    const head = el('div',{style:'display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px;'},[
      el('h3',{}, tab.label + ' — key figures'),
      el('button',{
        class:'export-csv-btn',
        style:'background:var(--neon-blue);color:#fff;border:none;padding:8px 16px;border-radius:999px;font-size:.82rem;font-weight:700;cursor:pointer;',
        onclick: () => exportCsv(tab, stats),
      }, '⬇ Export CSV'),
    ]);

    body.appendChild(head);
    body.appendChild(kpiGrid(stats));
    if(tab.chart) body.appendChild(el('div',{style:'margin-top:16px;max-width:560px;'}, tab.chart()));
    body.appendChild(el('p',{class:'footnote'}, tab.source));
  }

  renderTabRow();
  container.appendChild(sectionBlock(
    'Executive Report Builder',
    'Pick a topic — every stat tile is computed live from the real network inventory and maintenance-strategy datasets, never hardcoded.',
    el('div',{}, [tabRow, body])
  ));
  renderBody();
};
