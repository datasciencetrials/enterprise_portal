// Investment Plan — consolidates the old site's IBP/PIP cross-reference and its
// capital-project appraisal ("PIM") tool into one section. This page is about
// CAPITAL / new-construction investment; routine & periodic maintenance funding
// lives on the Maintenance & Condition page and is intentionally not repeated here.
RENDERERS.investment = async function(container){
  container.innerHTML = '';
  const ibp = await DataStore.ibpProjects();

  const years = (ibp.years || []).slice();      // real published PIP cycles, in source order (gaps are real)
  const summary = ibp.summary_by_year || {};
  const byYear = ibp.by_year || {};

  // One malformed row exists in the source (FY2015/16, code 1320): its agency/location
  // fields were parsed as the PDF's own column headers ("Responsible Officer:" /
  // "Total Expenditure (UGX bn):") instead of real values. Excluded from every table —
  // this is a source-extraction artifact, not a real project attribute.
  function isCleanRow(r){ return r.agency !== 'Responsible Officer:'; }
  function cleanRoads(fy){ return (byYear[fy]?.roads || []).filter(isCleanRow); }
  function cleanBridges(fy){ return (byYear[fy]?.bridges || []).filter(isCleanRow); }

  container.appendChild(pageHead(
    'Investment Plan',
    'Capital and new-construction road investment: the government Integrated Bank of Projects / Public Investment Plan register, plus an illustrative life-cycle cost planning tool. For routine and periodic maintenance funding, see Maintenance & Condition.',
    years.length + ' Public Investment Plan cycles on record'
  ));

  // ================= top-level tabs =================
  const tabRow = el('div',{class:'tab-row'});
  const body = el('div',{});
  const TABS = [
    { key:'ibp', label:'IBP / Public Investment Plan' },
    { key:'pim', label:'Project Appraisal (PIM)' }
  ];
  let activeTab = 'ibp';
  let calcChart = null; // holds the live-updating Chart.js instance from the PIM tab

  function destroyCalcChart(){
    if(calcChart){
      const idx = __chartInstances.indexOf(calcChart);
      if(idx>-1) __chartInstances.splice(idx,1);
      calcChart.destroy();
      calcChart = null;
    }
  }

  function paintTabs(){
    tabRow.innerHTML = '';
    TABS.forEach(t=>{
      tabRow.appendChild(el('button',{
        class:'tab-btn'+(t.key===activeTab?' active':''),
        onclick:()=>{ activeTab = t.key; paintTabs(); renderBody(); }
      }, t.label));
    });
  }
  function renderBody(){
    destroyCalcChart();
    body.innerHTML = '';
    body.appendChild(activeTab==='ibp' ? buildIbpTab() : buildPimTab());
  }

  paintTabs();
  container.appendChild(tabRow);
  container.appendChild(body);

  // ================= Tab 1: IBP / Public Investment Plan =================
  let selectedYear = years[years.length-1];

  function buildIbpTab(){
    const wrap = el('div',{});

    // ---- institutional / publishing-cycle context, computed from real data ----
    const first = years[0], latest = years[years.length-1];
    const firstS = summary[first], latestS = summary[latest];
    wrap.appendChild(el('p',{class:'footnote', style:'margin-bottom:18px;'},
      `The Public Investment Plan is not republished with full project detail every fiscal year — the ${years.length} cycles shown here (${years.join(', ')}) are the ones with project-level data available on record; the gaps reflect real PIP publishing cycles, not missing data. Implementing agency also shifts over time: in ${first}, ${fmtNum(firstS.unra_projects)} of that year's ${fmtNum(firstS.road_projects+firstS.bridge_major_culvert_projects)} listed projects were attributed to UNRA; by ${latest}, ${fmtNum(latestS.unra_projects)} were attributed to UNRA and ${fmtNum(latestS.mowt_projects)} to MoWT. This reflects UNRA's real dissolution (Dec 2024) and the absorption of its road-development mandate into MoWT's new National Roads Department, not a data error — the same category of capital project is credited to whichever agency was in force when that year's Plan was published.`
    ));

    // ---- trend charts across all real years ----
    const trendYears = years;
    wrap.appendChild(sectionBlock('Public Investment Plan cycles over time', 'All published cycles with project-level data — not a continuous annual series.', chartGrid([
      chartCard({
        title:'Combined Project Value by PIP Cycle', subtitle:'UGX billion', type:'bar',
        labels: trendYears,
        datasets:[{ data: trendYears.map(y=>Math.round(summary[y].combined_value_bn_ushs)), backgroundColor:'#00e5ff', borderRadius:6 }]
      }),
      chartCard({
        title:'Implementing Agency by PIP Cycle', subtitle:'Reflects the 2024 UNRA→MoWT mandate transfer described above', type:'bar', stacked:true,
        labels: trendYears,
        datasets:[
          { label:'UNRA', data: trendYears.map(y=>summary[y].unra_projects), backgroundColor:'#2979ff', borderRadius:4 },
          { label:'MoWT', data: trendYears.map(y=>summary[y].mowt_projects), backgroundColor:'#ff7a00', borderRadius:4 }
        ]
      })
    ])));

    // ---- fiscal-year pill selector ----
    const yearHead = el('div',{class:'section-block-head'},[
      el('h2',{}, 'Select a Public Investment Plan cycle'),
      el('span',{class:'muted'}, 'Only fiscal years actually present in the IBP register are selectable.')
    ]);
    wrap.appendChild(yearHead);
    const yearRow = el('div',{class:'tab-row'});
    years.forEach(y=>{
      yearRow.appendChild(el('button',{
        class:'tab-btn'+(y===selectedYear?' active':''),
        onclick:()=>{ selectedYear = y; [...yearRow.children].forEach((b,i)=>b.classList.toggle('active', years[i]===selectedYear)); refreshYearPanel(); }
      }, y));
    });
    wrap.appendChild(yearRow);

    const yearPanel = el('div',{});
    wrap.appendChild(yearPanel);
    function refreshYearPanel(){ yearPanel.innerHTML=''; yearPanel.appendChild(buildYearPanel(selectedYear)); }
    refreshYearPanel();

    return wrap;
  }

  function buildYearPanel(fy){
    const panel = el('div',{});
    const s = summary[fy];
    const roads = cleanRoads(fy);
    const bridges = cleanBridges(fy);

    panel.appendChild(kpiGrid([
      { label:'Road Projects', value: fmtNum(s.road_projects), accent:'var(--neon-cyan)' },
      { label:'Bridge & Major Culvert Projects', value: fmtNum(s.bridge_major_culvert_projects), accent:'var(--neon-magenta)' },
      { label:'Combined Project Value', value: fmtNum(s.combined_value_bn_ushs,0), unit:'UGX bn', accent:'var(--neon-purple)' },
      { label:'UNRA-Implemented', value: fmtNum(s.unra_projects), accent:'var(--neon-blue)' },
      { label:'MoWT-Implemented', value: fmtNum(s.mowt_projects), accent:'var(--neon-orange)' },
    ]));

    const agencyOptions = uniq([...roads, ...bridges].map(r=>r.agency));
    const valueFmt = v => (v===null||v===undefined) ? 'Not yet costed' : fmtNum(v,1)+' bn';
    const timelineRender = (v,row) => esc((row.start_date||'—') + ' – ' + (row.end_date||'—'));

    panel.appendChild(sectionBlock(`Road Projects — ${fy}`, roads.length+' road projects as published in this cycle’s Public Investment Plan.',
      dataTable({
        caption:'road projects',
        rows: roads,
        searchKeys:['name','agency','location','code'],
        filters:[{ label:'agency', key:'agency', options: agencyOptions }],
        columns:[
          { key:'code', label:'Code', align:'num' },
          { key:'name', label:'Project' },
          { key:'agency', label:'Implementing Agency' },
          { key:'location', label:'Location' },
          { key:'value_bn_ushs', label:'Value (UGX bn)', align:'num', fmt:valueFmt },
          { key:'start_date', label:'Timeline', render:timelineRender, sortable:false },
        ]
      })
    ));

    panel.appendChild(sectionBlock(`Bridge & Major Culvert Projects — ${fy}`, bridges.length+' bridge/major-culvert projects as published in this cycle’s Public Investment Plan — reported separately from road projects, never merged.',
      dataTable({
        caption:'bridge & major culvert projects',
        rows: bridges,
        searchKeys:['name','agency','location','code'],
        filters:[{ label:'agency', key:'agency', options: uniq(bridges.map(r=>r.agency)) }],
        columns:[
          { key:'code', label:'Code', align:'num' },
          { key:'name', label:'Project' },
          { key:'agency', label:'Implementing Agency' },
          { key:'location', label:'Location' },
          { key:'value_bn_ushs', label:'Value (UGX bn)', align:'num', fmt:valueFmt },
          { key:'start_date', label:'Timeline', render:timelineRender, sortable:false },
        ]
      })
    ));

    panel.appendChild(el('p',{class:'footnote'},
      'Figures are total lifecycle project values as published in each fiscal year’s Public Investment Plan, not annual budget allocations — the same project can appear across multiple years with updated figures as it progresses through appraisal, approval and implementation. Source: '+esc(ibp.meta && ibp.meta.source || 'Ministry of Finance, Planning and Economic Development (Uganda) — Integrated Bank of Projects (IBP), Public Investment Plan (PIP) series')+'. One malformed source row (a PDF column-header parsed as a project value) has been excluded from these tables.'
    ));

    return panel;
  }

  function uniq(arr){ return [...new Set(arr.filter(Boolean))]; }

  // ================= Tab 2: Project Appraisal (PIM) =================
  // No per-project EIRR/BCR/NPV appraisal data was found in any data file available to
  // this build (network.geojson, maintenance_strategy_summary.json,
  // maintenance_strategy_detail.json, or the IBP register itself) — none carry
  // cost-benefit or economic-appraisal fields. Rather than fabricate project names or
  // EIRR/BCR/NPV numbers (which the old site's "Deep Analytics" page appears to have
  // done), this tab is a transparent, clearly-labelled illustrative calculator: a
  // simplified HDM-4-style life-cycle condition/cost comparison between a Do-Minimum
  // (no action until failure) and a Preventive-Preservation strategy.
  function buildPimTab(){
    const wrap = el('div',{});

    wrap.appendChild(el('p',{class:'footnote'},
      'Illustrative planning tool, not project-level appraisal data. No real per-project EIRR/BCR/NPV appraisal dataset exists in the data available to this platform. This calculator instead demonstrates the standard HDM-4-style logic used in pavement investment planning — a documented, simplified deterioration model you can drive with your own assumptions below. It does not represent any specific road, project or approved budget.'
    ));

    // ---- controls ----
    const state = { vci: 75, growth: 4, horizon: 20 };
    const controls = el('div',{class:'card card-pad', style:'margin:18px 0;'});
    const controlGrid = el('div',{class:'grid-3'});
    controls.appendChild(el('h3',{style:'margin-bottom:14px;'}, 'Model inputs'));
    controls.appendChild(controlGrid);

    function sliderRow(label, key, min, max, step, suffix){
      const readout = el('span',{style:'font-weight:700;'}, state[key]+suffix);
      const input = document.createElement('input');
      input.type='range'; input.min=min; input.max=max; input.step=step; input.value=state[key];
      input.style.width='100%';
      input.addEventListener('input', ()=>{
        state[key] = Number(input.value);
        readout.textContent = state[key]+suffix;
        recompute();
      });
      return el('div',{},[
        el('div',{style:'display:flex;justify-content:space-between;margin-bottom:6px;font-size:.82rem;color:var(--text-secondary);'},[label, readout]),
        input
      ]);
    }
    controlGrid.appendChild(sliderRow('Initial VCI (condition index, 0–100)', 'vci', 20, 100, 1, ''));
    controlGrid.appendChild(sliderRow('Annual ESAL / traffic-loading growth', 'growth', 0, 10, 0.5, '%'));
    controlGrid.appendChild(sliderRow('Planning horizon', 'horizon', 5, 30, 1, ' yrs'));
    wrap.appendChild(controls);

    // ---- chart card (built directly with Chart.js so we can update it live) ----
    const chartCardEl = el('div',{class:'card chart-card'});
    chartCardEl.appendChild(el('h3',{},'Condition Over Time — Do-Minimum vs Preventive-Preservation'));
    chartCardEl.appendChild(el('span',{class:'tiny-muted'},'Simulated Visual Condition Index (VCI), 100 = as-new. Recomputes live from the inputs above.'));
    const chartBox = el('div',{class:'chart-box tall'});
    const canvas = document.createElement('canvas');
    chartBox.appendChild(canvas);
    chartCardEl.appendChild(chartBox);
    wrap.appendChild(chartCardEl);

    // ---- result stat tiles ----
    const statsHost = el('div',{style:'margin-top:18px;'});
    wrap.appendChild(statsHost);

    wrap.appendChild(el('p',{class:'footnote'},
      'Illustrative model, not a validated HDM-4 run and not tied to any specific link. Each year, a loading multiplier is applied as (1 + growth rate)^year to represent accelerating pavement wear from traffic growth. Do-Minimum: VCI declines at a base rate of 3.2 pts/yr × the loading multiplier, with no action until VCI ≤ 40, at which point a full reconstruction is triggered (relative cost index 100, VCI resets to 100). Preventive-Preservation: VCI declines at a slower base rate of 2.4 pts/yr × the same loading multiplier (a maintained surface sheds load better), with a preventive treatment triggered whenever VCI ≤ 70 (relative cost index 15 per treatment, VCI restored by +30, capped at 100). Base rates, triggers and relative costs are simplified, documented assumptions for planning-level illustration — not derived from a per-project appraisal.'
    ));

    function simulate(vci0, growthPct, horizon){
      const g = growthPct/100;
      const baseRateDM = 3.2, baseRatePP = 2.4;
      const reconstructTrigger = 40, reconstructCost = 100;
      const preventiveTrigger = 70, preventiveCost = 15, preventiveGain = 30;
      let vciDM = vci0, vciPP = vci0, costDM = 0, costPP = 0, nDM = 0, nPP = 0;
      const labels=[0], dmSeries=[Math.round(vciDM*10)/10], ppSeries=[Math.round(vciPP*10)/10];
      for(let t=1; t<=horizon; t++){
        const loadIndex = Math.pow(1+g, t);
        vciDM = Math.max(0, vciDM - baseRateDM*loadIndex);
        vciPP = Math.max(0, vciPP - baseRatePP*loadIndex);
        if(vciDM <= reconstructTrigger){ vciDM = 100; costDM += reconstructCost; nDM++; }
        if(vciPP <= preventiveTrigger){ vciPP = Math.min(100, vciPP+preventiveGain); costPP += preventiveCost; nPP++; }
        labels.push(t);
        dmSeries.push(Math.round(vciDM*10)/10);
        ppSeries.push(Math.round(vciPP*10)/10);
      }
      return { labels, dmSeries, ppSeries, costDM, costPP, nDM, nPP };
    }

    function recompute(){
      const r = simulate(state.vci, state.growth, state.horizon);
      if(!calcChart){
        calcChart = new Chart(canvas.getContext('2d'), {
          type:'line',
          data:{ labels:r.labels, datasets:[
            { label:'Do-Minimum', data:r.dmSeries, borderColor:'#ff7a00', backgroundColor:'#ff7a00', tension:0.15, pointRadius:0, borderWidth:2.5 },
            { label:'Preventive-Preservation', data:r.ppSeries, borderColor:'#00e5ff', backgroundColor:'#00e5ff', tension:0.15, pointRadius:0, borderWidth:2.5 },
          ]},
          options:{
            responsive:true, maintainAspectRatio:false,
            plugins:{
              legend:{ display:true, labels:{ color:'#565b6b', font:{size:11}, usePointStyle:true } },
              tooltip:{ backgroundColor:'#14151c', titleColor:'#fff', bodyColor:'#e5e7eb', padding:10, cornerRadius:8 }
            },
            scales:{
              x:{ title:{ display:true, text:'Year', color:'#8b90a0' }, grid:{ color:'#eef0f6' }, ticks:{ color:'#8b90a0', font:{size:10} } },
              y:{ min:0, max:100, title:{ display:true, text:'VCI', color:'#8b90a0' }, grid:{ color:'#eef0f6' }, ticks:{ color:'#8b90a0', font:{size:10} } }
            }
          }
        });
        __chartInstances.push(calcChart);
      } else {
        calcChart.data.labels = r.labels;
        calcChart.data.datasets[0].data = r.dmSeries;
        calcChart.data.datasets[1].data = r.ppSeries;
        calcChart.update();
      }

      const ratio = r.costPP>0 ? (r.costDM/r.costPP) : (r.costDM>0 ? Infinity : 1);
      statsHost.innerHTML='';
      statsHost.appendChild(kpiGrid([
        { label:'Do-Minimum: Final VCI', value: fmtNum(r.dmSeries[r.dmSeries.length-1],0), accent:'var(--neon-orange)' },
        { label:'Do-Minimum: Reconstructions Triggered', value: fmtNum(r.nDM), accent:'var(--neon-orange)' },
        { label:'Do-Minimum: Relative Cost Index', value: fmtNum(r.costDM), accent:'var(--neon-orange)' },
        { label:'Preventive: Final VCI', value: fmtNum(r.ppSeries[r.ppSeries.length-1],0), accent:'var(--neon-cyan)' },
        { label:'Preventive: Treatments Applied', value: fmtNum(r.nPP), accent:'var(--neon-cyan)' },
        { label:'Preventive: Relative Cost Index', value: fmtNum(r.costPP), accent:'var(--neon-cyan)' },
      ]));
      statsHost.appendChild(el('p',{class:'footnote'},
        Number.isFinite(ratio)
          ? `In this illustrative run, the Do-Minimum relative cost index (${fmtNum(r.costDM)}) is ${ratio.toFixed(1)}× the Preventive-Preservation relative cost index (${fmtNum(r.costPP)}) over the ${state.horizon}-year horizon — the standard pavement-engineering rationale for preservation-first programming.`
          : `In this illustrative run, Do-Minimum required ${fmtNum(r.nDM)} full reconstruction(s) while Preventive-Preservation required none, over the ${state.horizon}-year horizon.`
      ));
    }

    recompute();
    return wrap;
  }

  renderBody();
};
