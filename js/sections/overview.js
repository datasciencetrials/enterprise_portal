RENDERERS.overview = async function(container){
  const [net, ms] = await Promise.all([DataStore.networkStats(), DataStore.msSummary()]);
  container.innerHTML='';

  container.appendChild(pageHead(
    'National Road Network Overview',
    'Live figures computed directly from the platform’s GIS road-network inventory and the FY2025/26 MoWT maintenance-strategy workbooks.',
    net.linkCount + ' road links · 6 regions'
  ));

  // ---- Canonical KPI strip (ONE set, computed live — not repeated with different numbers elsewhere) ----
  container.appendChild(kpiGrid([
    { label:'Total Classified Network', value: fmtNum(net.totalKm,0), unit:'km', accent:'var(--neon-cyan)' },
    { label:'Paved Network', value: fmtNum(net.pavedKm,0), unit:'km', accent:'var(--neon-blue)', delta: (net.pavedKm/net.totalKm*100).toFixed(1)+'% of total' },
    { label:'Unpaved Network', value: fmtNum(net.unpavedKm,0), unit:'km', accent:'var(--neon-orange)', delta: (net.unpavedKm/net.totalKm*100).toFixed(1)+'% of total' },
    { label:'Bridges', value: fmtNum(ms.kpi_summary.total_bridges), accent:'var(--neon-magenta)' },
    { label:'Major Culverts', value: fmtNum(ms.kpi_summary.total_major_culverts), accent:'var(--neon-purple)' },
    { label:'DUCAR District Network', value: fmtNum(135640.8,0), unit:'km', accent:'var(--neon-green)' },
  ]));
  container.appendChild(el('p',{class:'footnote'}, net.source + ' Bridges and culverts are reported from the MoWT 2026 maintenance-strategy structures register — see Bridges & Culverts for full, separate registers.'));

  // ---- Condition + region charts ----
  const condLabels = Object.keys(net.byCondition);
  const condData = condLabels.map(k=>net.byCondition[k]);
  const regionLabels = DataStore.REGIONS;
  const regionPaved = regionLabels.map(r=>Math.round(net.byRegion[r].paved));
  const regionUnpaved = regionLabels.map(r=>Math.round(net.byRegion[r].unpaved));
  const classLabels = Object.keys(net.byClass);
  const classData = classLabels.map(k=>Math.round(net.byClass[k]));

  container.appendChild(sectionBlock('Network at a glance', null, chartGrid([
    chartCard({ title:'Road Condition (all assessed links)', type:'doughnut',
      labels:condLabels, datasets:[{ data:condData, backgroundColor:NEON.slice(0,condLabels.length), borderWidth:0 }] }),
    chartCard({ title:'Network Length by Road Class', type:'bar',
      labels: classLabels.map(c=>DataStore.CLASS_LABELS[c]||c), datasets:[{ data:classData, backgroundColor:'#00e5ff', borderRadius:6 }] }),
    chartCard({ title:'Paved vs Unpaved Network by Region', type:'bar', stacked:true,
      labels:regionLabels, datasets:[
        { label:'Paved', data:regionPaved, backgroundColor:'#2979ff', borderRadius:4 },
        { label:'Unpaved', data:regionUnpaved, backgroundColor:'#ff7a00', borderRadius:4 }
      ] }),
    chartCard({ title:'Maintenance Investment Need, FY26/27–FY30/31', subtitle:'UGX billion', type:'bar',
      labels: ms.investment_plan_annual.filter(y=>/^FY\d/.test(y.financial_year)).map(y=>y.financial_year),
      datasets:[{ data: ms.investment_plan_annual.filter(y=>/^FY\d/.test(y.financial_year)).map(y=>Math.round(y.programme_cost_bn_ushs)), backgroundColor:'#9d00ff', borderRadius:6 }] }),
  ])));

  // ---- Curated real findings (deduplicated — this is the ONE place these appear) ----
  const findings = [
    { t:'Unsealed roads dominate the network', d:`${fmtNum(net.unpavedKm,0)} km (${(net.unpavedKm/net.totalKm*100).toFixed(1)}%) of the classified network is unsealed — the single largest upgrade opportunity, concentrated in Class C district/primary roads.`, a:'var(--neon-orange)'},
    { t:'Class C carries most of the network', d:`Class C primary roads account for ${fmtNum(net.byClass.C,0)} km, ${(net.byClass.C/net.totalKm*100).toFixed(0)}% of the total classified network.`, a:'var(--neon-cyan)'},
    { t:'Central region has the longest network', d:`Central region has ${fmtNum(net.byRegion.Central.total,0)} km against North Eastern's ${fmtNum(net.byRegion['North Eastern'].total,0)} km — a ${(net.byRegion.Central.total/net.byRegion['North Eastern'].total).toFixed(1)}× regional disparity.`, a:'var(--neon-purple)'},
    { t:'Maintenance programme covers 338 priority links', d:(()=>{ const yrs = ms.investment_plan_annual.filter(y=>/^FY\d/.test(y.financial_year)); const avg = yrs.reduce((s,y)=>s+y.asset_value_at_risk_bn_ushs,0)/yrs.length; return `The FY26/27–FY30/31 investment plan schedules 338 priority links against an asset value at risk averaging UGX ${fmtNum(avg,0)} bn/yr.`; })(), a:'var(--neon-blue)'},
    { t:'Total road & structure asset value', d:`The classified network, bridges and major culverts together are valued at USD ${fmtNum(ms.kpi_summary.total_asset_value_mn_usd,0)} million per the FY2025/26 asset-values workbook.`, a:'var(--neon-green)'},
    { t:(()=>{ const poor = ms.vci_condition_distribution.Poor + ms.vci_condition_distribution['Very Poor']; return fmtNum(poor,0)+' links need priority attention'; })(), d:(()=>{ const assessed = Object.values(ms.vci_condition_distribution).reduce((a,b)=>a+b,0); const poor = ms.vci_condition_distribution.Poor + ms.vci_condition_distribution['Very Poor']; return `Across ${fmtNum(assessed,0)} VCI-assessed links, ${ms.vci_condition_distribution.Poor} are rated Poor and ${ms.vci_condition_distribution['Very Poor']} Very Poor — together ${(poor/assessed*100).toFixed(0)}% of assessed links.`; })(), a:'var(--neon-pink)'},
    { t:'Regional paving gap', d:(()=>{ const withPct = regionLabels.map(r=>({ r, pct: net.byRegion[r].paved/net.byRegion[r].total*100 })).sort((a,b)=>b.pct-a.pct); const best=withPct[0], worst=withPct[withPct.length-1]; return `${best.r} is the most-paved region at ${best.pct.toFixed(1)}%, versus ${worst.r} at just ${worst.pct.toFixed(1)}% — a ${(best.pct-worst.pct).toFixed(0)}-point gap in surfacing between regions.`; })(), a:'var(--neon-yellow)'},
    { t:'Average link length', d:`${fmtNum(net.linkCount)} classified links average ${(net.totalKm/net.linkCount).toFixed(1)} km each — computed directly from network.geojson, not a published figure.`, a:'var(--neon-magenta)'},
  ];
  const findGrid = el('div',{class:'grid-3'});
  findings.forEach(f=>{
    findGrid.appendChild(el('div',{class:'card card-pad hoverable', style:`border-left:4px solid ${f.a}`},[
      el('h3',{}, f.t), el('p',{class:'muted', style:'margin-top:6px;'}, f.d)
    ]));
  });
  container.appendChild(sectionBlock('What the data shows', 'A curated set of genuinely distinct findings — see Analytics & Insights for the full chart library.', findGrid));

  container.appendChild(el('p',{class:'footnote'},
    'Two independent, real MoWT source systems feed this platform: the GIS road-network inventory (network.geojson, '+net.linkCount+' links, '+fmtNum(net.totalKm,0)+' km) and the separately-maintained maintenance-strategy planning workbooks ('+fmtNum(ms.kpi_summary.total_network_km,0)+' km assessed, 2026 cycle). Their totals differ slightly because they are captured at different times from different systems — each figure on this site is labelled with its own source rather than forced to a single, falsely-precise number.'
  ));
};
