RENDERERS.maintenance = async function(container){
  const ms = await DataStore.msSummary();
  const detail = await DataStore.msDetail();
  container.innerHTML = '';

  // ---- local helpers (kept in this file only — no shared-component changes) ----
  function accuracyBadge(band){
    const cls = { High:'badge-good', Moderate:'badge-fair', Low:'badge-poor', Indicative:'badge-neutral' }[band] || 'badge-neutral';
    return el('span',{class:'badge '+cls}, band||'—');
  }
  function priorityBandBadge(band){
    const cls = { 'Priority 1':'badge-critical', 'Priority 2':'badge-poor', 'Priority 3':'badge-fair', 'Priority 4':'badge-good' }[band] || 'badge-neutral';
    return el('span',{class:'badge '+cls}, band||'—');
  }
  function ughsBn(v){ return v===null||v===undefined ? '—' : fmtNum(v,2)+' bn'; }
  // Small, non-paginated reference table (dataTable() is reserved for the browsable
  // 338-row register below, per the brief's "small table" wording for the others).
  function miniTable(cols, rows){
    const table = el('table',{class:'data-table', style:'white-space:normal;'});
    table.appendChild(el('thead',{}, el('tr',{}, cols.map(c=>el('th',{class:c.align==='num'?'num':''}, c.label)))));
    const tbody = el('tbody');
    rows.forEach(r=>{
      const tr = el('tr');
      cols.forEach(c=>{
        const raw = r[c.key];
        const content = c.render ? c.render(raw, r) : (c.fmt ? c.fmt(raw) : (raw===null||raw===undefined?'—':raw));
        const td = el('td',{class:c.align==='num'?'num':''});
        if(content instanceof Node) td.appendChild(content); else td.innerHTML = content;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return el('div',{class:'table-wrap'}, table);
  }

  const kpi = ms.kpi_summary;
  const regional = ms.network_regional_breakdown;               // {region: {paved_km,unpaved_km,total_km}}
  const byClass = ms.network_by_class;                           // [{road_class,bituminous_km,unsealed_km,total_km,pct_total_network,description}]
  const vci = ms.vci_condition_distribution;                     // {category: count}
  // ⚠ investment_plan_annual mixes in a "Total / Avg" row — always filter to real FY rows first.
  const invYears = ms.investment_plan_annual.filter(y => /^FY\d/.test(y.financial_year));
  const interventionMix = ms.intervention_mix_summary;           // [{intervention,links_count,length_km,cost_bn_ushs,...}]
  const rateBenchmarks = ms.intervention_rate_benchmarks;        // [{surface_type,intervention,recommended_rate_bn_ushs_per_km,primary_basis,accuracy_band,...}]
  const priorityLinks = detail.link_investment_priority.slice().sort((a,b)=>a.priority_rank-b.priority_rank); // 338 real links

  const classDescMap = {}; byClass.forEach(c => classDescMap[c.road_class] = c.description);

  container.appendChild(pageHead(
    'Maintenance & Condition',
    'The FY2025/26 MoWT maintenance-strategy plan for the classified road network — condition, 5-year investment programme, intervention mix, and the full priority-ranked link register. Bridges and major culverts are reported separately in Bridges & Culverts.',
    fmtNum(kpi.total_network_km,0)+' km assessed · FY26/27–FY30/31 plan'
  ));

  // ---- KPI strip ----
  container.appendChild(kpiGrid([
    { label:'Total Network Assessed', value: fmtNum(kpi.total_network_km,0), unit:'km', accent:'var(--neon-cyan)' },
    { label:'Paved', value: fmtNum(kpi.paved_km,0), unit:'km', accent:'var(--neon-blue)', delta:(kpi.paved_km/kpi.total_network_km*100).toFixed(1)+'% of network' },
    { label:'Unpaved', value: fmtNum(kpi.unpaved_km,0), unit:'km', accent:'var(--neon-orange)', delta:(kpi.unpaved_km/kpi.total_network_km*100).toFixed(1)+'% of network' },
    { label:'Links in Strategy Register', value: fmtNum(detail.road_links.length), accent:'var(--neon-purple)' },
    { label:'Priority-Planned Links', value: fmtNum(priorityLinks.length), accent:'var(--neon-green)', delta:'FY26/27–FY30/31 programme' },
  ]));
  container.appendChild(el('p',{class:'footnote'}, 'MoWT maintenance-strategy planning workbooks, FY2025/26 cycle. Figures cover the ROAD network only — see Bridges & Culverts for the 521-bridge and 451-culvert registers.'));

  // ---- Derived insight strip (computed from the same real data above — no new source) ----
  const costliestIntervention = interventionMix.slice().sort((a,b)=>b.cost_bn_ushs-a.cost_bn_ushs)[0];
  const totalFundingGap = invYears.reduce((s,y)=>s+y.funding_gap_vs_baseline_bn_ushs,0);
  const insightGrid = el('div',{class:'grid-3'});
  [
    { t:'5-year funding gap', d:`The FY26/27–FY30/31 programme carries a funding gap of ${ughsBn(totalFundingGap)} against baseline across all 5 years combined.`, a:'var(--neon-pink)' },
    { t:'Top-ranked priority link', d:`${esc(priorityLinks[0].link_name)} (${esc(priorityLinks[0].road_no)}) ranks #1 of 338, scheduled ${esc(priorityLinks[0].scheduled_fy)}, priority score ${fmtNum(priorityLinks[0].priority_score,1)}.`, a:'var(--neon-cyan)' },
    { t:'Costliest intervention type', d:`${esc(costliestIntervention.intervention)} carries the largest programme cost at ${ughsBn(costliestIntervention.cost_bn_ushs)} across ${fmtNum(costliestIntervention.links_count)} links.`, a:'var(--neon-orange)' },
  ].forEach(f=>{
    insightGrid.appendChild(el('div',{class:'card card-pad hoverable', style:`border-left:4px solid ${f.a}`},[
      el('h3',{}, f.t), el('p',{class:'muted', style:'margin-top:6px;'}, f.d)
    ]));
  });
  container.appendChild(insightGrid);

  // ---- Network by Region ----
  const regionLabels = DataStore.REGIONS;
  container.appendChild(sectionBlock('Network by Region', 'All 6 maintenance regions — paved and unpaved km, from the maintenance-strategy workbook.', el('div',{class:'grid-2'},[
    miniTable(
      [
        {key:'region', label:'Region'},
        {key:'paved_km', label:'Paved', align:'num', fmt:fmtKm},
        {key:'unpaved_km', label:'Unpaved', align:'num', fmt:fmtKm},
        {key:'total_km', label:'Total', align:'num', fmt:fmtKm},
        {key:'share', label:'% of Network', align:'num', fmt:v=>v.toFixed(1)+'%'},
      ],
      regionLabels.map(r => ({ region:r, ...regional[r], share: regional[r].total_km/kpi.total_network_km*100 }))
    ),
    chartCard({ title:'Paved vs Unpaved by Region', type:'bar', stacked:true,
      labels: regionLabels,
      datasets:[
        { label:'Paved', data: regionLabels.map(r=>Math.round(regional[r].paved_km)), backgroundColor:'#2979ff', borderRadius:4 },
        { label:'Unpaved', data: regionLabels.map(r=>Math.round(regional[r].unpaved_km)), backgroundColor:'#ff7a00', borderRadius:4 },
      ] }),
  ])));

  // ---- Network by Functional Class ----
  container.appendChild(sectionBlock('Network by Functional Class', 'Classes A/B/C/M (Trunk, National Trunk, Primary/District, Expressway) — bituminous vs unsealed km.', el('div',{class:'grid-2'},[
    miniTable(
      [
        {key:'road_class', label:'Class'},
        {key:'description', label:'Description'},
        {key:'bituminous_km', label:'Bituminous', align:'num', fmt:fmtKm},
        {key:'unsealed_km', label:'Unsealed', align:'num', fmt:fmtKm},
        {key:'total_km', label:'Total', align:'num', fmt:fmtKm},
        {key:'pct_total_network', label:'% of Network', align:'num', fmt:v=>(v*100).toFixed(1)+'%'},
      ],
      byClass
    ),
    chartCard({ title:'Network Length by Functional Class', type:'bar', stacked:true,
      labels: byClass.map(c=>c.road_class),
      datasets:[
        { label:'Bituminous', data: byClass.map(c=>Math.round(c.bituminous_km)), backgroundColor:'#2979ff', borderRadius:4 },
        { label:'Unsealed', data: byClass.map(c=>Math.round(c.unsealed_km)), backgroundColor:'#ff7a00', borderRadius:4 },
      ] }),
  ])));

  // ---- VCI Condition Distribution ----
  const vciCats = Object.keys(vci);
  const vciTotal = vciCats.reduce((s,k)=>s+vci[k],0);
  container.appendChild(sectionBlock('VCI Condition Distribution', 'Visual Condition Index rating across all assessed links — every category shown, including "Not assessed".', el('div',{class:'grid-2'},[
    chartCard({ title:'Links by VCI Rating', type:'doughnut',
      labels: vciCats, datasets:[{ data: vciCats.map(k=>vci[k]), backgroundColor:NEON.slice(0,vciCats.length), borderWidth:0 }] }),
    miniTable(
      [
        {key:'cat', label:'VCI Category', render:(v)=>conditionBadge(v)},
        {key:'count', label:'Links', align:'num', fmt:fmtNum},
        {key:'share', label:'% of Assessed', align:'num', fmt:v=>v.toFixed(1)+'%'},
      ],
      vciCats.map(k => ({ cat:k, count:vci[k], share: vci[k]/vciTotal*100 }))
    ),
  ])));

  // ---- 5-Year Investment Plan ----
  const invTotal = invYears.reduce((acc,y)=>({
    links_count: acc.links_count + y.links_count,
    programme_cost_bn_ushs: acc.programme_cost_bn_ushs + y.programme_cost_bn_ushs,
    asset_value_at_risk_bn_ushs: acc.asset_value_at_risk_bn_ushs + y.asset_value_at_risk_bn_ushs,
    funding_gap_vs_baseline_bn_ushs: acc.funding_gap_vs_baseline_bn_ushs + y.funding_gap_vs_baseline_bn_ushs,
  }), { links_count:0, programme_cost_bn_ushs:0, asset_value_at_risk_bn_ushs:0, funding_gap_vs_baseline_bn_ushs:0 });
  const invRows = invYears.map(y => ({ financial_year:y.financial_year, links_count:y.links_count, programme_cost_bn_ushs:y.programme_cost_bn_ushs, asset_value_at_risk_bn_ushs:y.asset_value_at_risk_bn_ushs, funding_gap_vs_baseline_bn_ushs:y.funding_gap_vs_baseline_bn_ushs }))
    .concat([{ financial_year:'Total (5 years)', links_count:invTotal.links_count, programme_cost_bn_ushs:invTotal.programme_cost_bn_ushs, asset_value_at_risk_bn_ushs:invTotal.asset_value_at_risk_bn_ushs, funding_gap_vs_baseline_bn_ushs:invTotal.funding_gap_vs_baseline_bn_ushs, isTotal:true }]);
  container.appendChild(sectionBlock('5-Year Maintenance Investment Plan (FY26/27–FY30/31)', 'Programme cost, asset value at risk, and funding gap vs baseline, by scheduled year — the "Total" row is computed here by summing the 5 real fiscal-year rows, never plotted as a 6th year.', el('div',{class:'grid-2'},[
    miniTable(
      [
        {key:'financial_year', label:'Fiscal Year', render:(v,r)=> r.isTotal ? el('strong',{},v) : v},
        {key:'links_count', label:'Links', align:'num', fmt:fmtNum},
        {key:'programme_cost_bn_ushs', label:'Programme Cost', align:'num', fmt:ughsBn},
        {key:'asset_value_at_risk_bn_ushs', label:'Asset Value at Risk', align:'num', fmt:ughsBn},
        {key:'funding_gap_vs_baseline_bn_ushs', label:'Funding Gap vs Baseline', align:'num', fmt:ughsBn},
      ],
      invRows
    ),
    chartCard({ title:'Programme Cost by Year', subtitle:'UGX billion', type:'bar',
      labels: invYears.map(y=>y.financial_year),
      datasets:[{ data: invYears.map(y=>Math.round(y.programme_cost_bn_ushs*10)/10), backgroundColor:'#9d00ff', borderRadius:6 }] }),
  ])));

  // ---- Intervention Mix ----
  container.appendChild(sectionBlock('Intervention Mix', 'All programmed intervention types across the 338 priority-planned links — full distribution, including zero-count types.', el('div',{class:'grid-2'},[
    miniTable(
      [
        {key:'intervention', label:'Intervention'},
        {key:'links_count', label:'Links', align:'num', fmt:fmtNum},
        {key:'length_km', label:'Length', align:'num', fmt:fmtKm},
        {key:'cost_bn_ushs', label:'Cost', align:'num', fmt:ughsBn},
      ],
      interventionMix
    ),
    chartCard({ title:'Programme Cost by Intervention Type', subtitle:'UGX billion', type:'bar', indexAxis:'y',
      labels: interventionMix.map(i=>i.intervention),
      datasets:[{ data: interventionMix.map(i=>Math.round(i.cost_bn_ushs*10)/10), backgroundColor:NEON[2], borderRadius:4 }] }),
  ])));

  // ---- Recommended Unit Intervention Rates ----
  container.appendChild(sectionBlock('Recommended Unit Intervention Rates', 'Benchmark cost per km by surface type and intervention, with the accuracy band behind each rate.', dataTable({
    columns: [
      { key:'surface_type', label:'Surface' },
      { key:'intervention', label:'Intervention' },
      { key:'recommended_rate_bn_ushs_per_km', label:'Rate (bn UGX/km)', align:'num', fmt:v=>fmtNum(v,4) },
      { key:'primary_basis', label:'Basis', sortable:false },
      { key:'accuracy_band', label:'Confidence', render:(v)=>accuracyBadge(v) },
    ],
    rows: rateBenchmarks,
    pageSize: 10,
    searchKeys: ['surface_type','intervention'],
    caption: 'rate benchmarks',
  })));

  // ---- Link Investment Priority Register ----
  const fyOptions = Array.from(new Set(priorityLinks.map(r=>r.scheduled_fy))).sort();
  container.appendChild(sectionBlock('Link Investment Priority Register', 'All 338 priority-ranked links in the FY26/27–FY30/31 programme — searchable by link or road number, filterable by scheduled fiscal year.', dataTable({
    columns: [
      { key:'link_name', label:'Link' },
      { key:'road_no', label:'Road No.' },
      { key:'road_class', label:'Class', render:(v)=> `<span title="${esc(classDescMap[v]||'')}">${esc(v)}</span>` },
      { key:'priority_rank', label:'Rank', align:'num' },
      { key:'priority_score', label:'Priority Score', align:'num', fmt:v=>fmtNum(v,1) },
      { key:'scheduled_fy', label:'Scheduled FY' },
      { key:'indicative_base_cost_bn_ushs', label:'Programme Cost (bn UGX)', align:'num', fmt:v=>fmtNum(v,2) },
      { key:'asset_value_at_risk_bn_ushs', label:'Asset Value at Risk (bn UGX)', align:'num', fmt:v=>fmtNum(v,2) },
      { key:'priority_band', label:'Priority Band', render:(v)=>priorityBandBadge(v) },
    ],
    rows: priorityLinks,
    pageSize: 25,
    searchKeys: ['link_name','road_no'],
    filters: [ { label:'Scheduled FY', key:'scheduled_fy', options: fyOptions } ],
    caption: 'priority links',
  })));

  container.appendChild(el('p',{class:'footnote'},
    'Source: MoWT maintenance-strategy planning workbooks, FY2025/26 cycle — network condition (VCI), the 5-year investment priority plan, intervention mix, and unit-rate benchmarks above. This page covers routine and periodic road MAINTENANCE funding only; new-construction capital investment (IBP/PIP) is reported separately in the Investment Plan section. Bridges and major culverts are always reported as their own registers — see Bridges & Culverts.'
  ));
};
