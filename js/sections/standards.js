// Standards & Data Model — consolidates two things that were mis-homed on the
// old site: (1) four genuinely valuable engineering-standards reference cards
// that were buried under an irrelevant chart wall, and (2) the old React-Flow
// system/data-flow diagram, which was oddly promoted to its own peer nav item
// even though it's developer documentation, not a user workflow. It now lives
// here as a secondary sub-tab instead.

RENDERERS.standards = async function(container){
  container.innerHTML = '';
  container.appendChild(pageHead(
    'Standards & Data Model',
    'The real engineering-standards thresholds MoWT maintenance decisions are measured against, and the platform’s underlying data pipeline.',
    '4 verified standards'
  ));

  // ---- reference content (real, cited manuals — see BUILD_BRIEF.md) ----
  const STANDARDS = [
    {
      manual: 'MoWT Pavement Design Manual Vol. 3 (HDM-4 Standard)',
      metric: 'Visual Condition Index (VCI) — 0–100 scale',
      bands: [
        { tier:'good',     label:'VCI > 75 — Good',      desc:'Preventive crack sealing' },
        { tier:'fair',     label:'VCI 50–75 — Fair',     desc:'DBST / thin asphalt overlay (40mm)' },
        { tier:'critical', label:'VCI < 35 — Critical',  desc:'Full-depth reclamation & cement stabilization' },
      ],
      recommendation: 'Prioritize 1,240 km of Fair-to-Poor links for DBST overlay before structural base failure sets in, preserving asset value at roughly one-quarter the cost of full reconstruction.',
      impact: 'Saves an estimated UGX 184.2 Billion in deferred reconstruction CapEx over a 5-year window.',
      impactBnUshs: 184.2,
    },
    {
      manual: 'AASHTO Guide for Design of Pavement Structures (1993 / 2020)',
      metric: 'Structural Number (SN) & ESALs/day',
      bands: [
        { tier:'good',     label:'SN ≥ 4.5',  desc:'Heavy freight corridor — sustains >10M ESALs' },
        { tier:'fair',     label:'SN 3.0–4.5', desc:'Medium collector — 1M–10M ESALs' },
        { tier:'critical', label:'SN < 3.0',  desc:'Deficient base — immediate crushed-stone upgrade needed' },
      ],
      recommendation: 'Corridors carrying more than 7,500 ESALs/day (e.g. Malaba–Kampala, Masaka–Mbarara) require AC binder reinforcement.',
      impact: 'Reduces annual vehicle-operating costs (VOC) by UGX 78.5 Billion across heavy transport operators.',
      impactBnUshs: 78.5,
    },
    {
      manual: 'TRL Overseas Road Note 31 & MoWT Geometric Design Manual',
      metric: 'International Roughness Index (IRI, m/km)',
      bands: [
        { tier:'good',     label:'IRI < 2.5',   desc:'High-speed trunk flow' },
        { tier:'fair',     label:'IRI 2.5–5.0', desc:'Moderate — VOC +15%' },
        { tier:'critical', label:'IRI > 5.0',   desc:'Severe — VOC +35%, speed reduced 25 km/h' },
      ],
      recommendation: 'Cold milling / resheeting on links with IRI > 5.2 to restore 80 km/h design speed.',
      impact: 'Unlocks UGX 52.1 Billion/yr in logistics delay savings along the Northern Corridor.',
      impactBnUshs: 52.1,
    },
    {
      manual: 'National Bridge Management System (NBMS Inspection Manual)',
      metric: 'Scour Vulnerability Index & substructure score',
      bands: [
        { tier:'good',     label:'Score < 30',  desc:'Stable' },
        { tier:'fair',     label:'Score 30–60', desc:'Scour protection needed — gabion mattresses' },
        { tier:'critical', label:'Score > 60',  desc:'High risk of abutment undermining in 100-yr storms' },
      ],
      recommendation: 'Reinforced-concrete aprons, stone pitching and rip-rap at 412 vulnerable bridges before peak rainy seasons in the Elgon and Albertine basins.',
      impact: 'Prevents an estimated UGX 95.0 Billion in emergency restoration costs.',
      impactBnUshs: 95.0,
    },
  ];

  const FLOW = [
    { stage:'Inputs', desc:'Raw field data collected by survey and inspection teams', boxes:[
        { title:'Pavement Surveys (NPMS)', fields:['iri_m_km', 'rut_mm', 'cracking_pct'] },
        { title:'Maintenance Stations', fields:['station_id', 'region'] },
        { title:'Structures (NBMS)', fields:['structure_id', 'type', 'span_length'] },
    ]},
    { stage:'Core layer', desc:'Computation engines and canonical GIS records built from the inputs', boxes:[
        { title:'HDM-4 Deterioration Model', fields:['Computes VCI from Age, Traffic and Roughness'] },
        { title:'Core Road Links', fields:['GIS polylines — link_id, chainage, surface_type'] },
        { title:'Inspections & Defect Scoring', fields:['Deck / Super / Substructure 0–9 ratings → overall condition'] },
    ]},
    { stage:'Derived', desc:'First-order outputs built on the core layer', boxes:[
        { title:'VCI Condition Rating Tree', fields:['VCI > 85 Excellent … VCI < 40 Poor → maintenance intervention'] },
        { title:'Traffic Counts (NTIS)', fields:['total_count', 'survey_year'] },
        { title:'Bridge Priority Index Algorithm', fields:['Condition + traffic → priority ranking'] },
    ]},
    { stage:'Second derived layer', desc:'Forward-looking and risk models built on the derived layer', boxes:[
        { title:'AADT Projection Model', fields:['Time-series traffic growth projected to 2040'] },
        { title:'Overloading Risk Engine', fields:['Weighbridge ESAL factors → pavement risk score'] },
    ]},
    { stage:'Terminal', desc:'Consolidated planning output', boxes:[
        { title:'Projects & Budgeting (Enterprise)', fields:['Aggregated master plan'] },
    ]},
  ];

  function bandBadge(tier, label){
    const cls = { good:'badge-good', fair:'badge-fair', critical:'badge-critical' }[tier] || 'badge-neutral';
    return el('span',{class:'badge '+cls}, label);
  }

  function standardCard(s){
    return el('div',{class:'card card-pad hoverable'},[
      el('div',{class:'tiny-muted', style:'text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px;'}, s.manual),
      el('h3',{style:'margin-bottom:12px;'}, s.metric),
      el('ul',{style:'list-style:none;padding:0;margin:0 0 14px;display:flex;flex-direction:column;gap:9px;'},
        s.bands.map(b => el('li',{style:'display:flex;align-items:center;gap:10px;flex-wrap:wrap;'},[
          bandBadge(b.tier, b.label), el('span',{class:'muted'}, b.desc)
        ]))
      ),
      el('p',{style:'margin-bottom:13px;color:var(--text-primary);'}, s.recommendation),
      el('div',{class:'callout'}, [ el('strong',{}, 'Financial impact: '), s.impact ]),
    ]);
  }

  function buildStandardsGrid(){
    const grid = el('div',{style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:18px;'});
    STANDARDS.forEach(s => grid.appendChild(standardCard(s)));
    return grid;
  }

  function flowBox(b){
    return el('div',{class:'card card-pad', style:'flex:1 1 220px;min-width:220px;'},[
      el('h4',{style:'margin-bottom:8px;font-size:.92rem;'}, b.title),
      el('ul',{style:'margin:0;padding-left:16px;color:var(--text-secondary);font-size:.8rem;line-height:1.6;'},
        b.fields.map(f => el('li',{}, f))),
    ]);
  }

  function connector(){
    return el('div',{style:'display:flex;flex-direction:column;align-items:center;gap:2px;margin:8px 0;color:var(--text-tertiary);'},[
      el('div',{style:'width:2px;height:16px;background:var(--border-strong);'}),
      el('div',{style:'font-size:1.05rem;line-height:1;'}, '▼'),
    ]);
  }

  function buildFlowDiagram(){
    const wrap = el('div',{class:'card card-pad'});
    FLOW.forEach((stage, i) => {
      wrap.appendChild(el('div',{},[
        el('div',{style:'display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;'},[
          el('span',{class:'pill-badge'}, stage.stage),
          el('span',{class:'muted'}, stage.desc),
        ]),
        el('div',{style:'display:flex;gap:14px;flex-wrap:wrap;margin-bottom:4px;'}, stage.boxes.map(flowBox)),
      ]));
      if(i < FLOW.length-1) wrap.appendChild(connector());
    });
    return wrap;
  }

  // ---- sub-tabs ----
  const tabRow = el('div',{class:'tab-row'});
  const btnStd = el('button',{class:'tab-btn active'}, 'Engineering Standards');
  const btnFlow = el('button',{class:'tab-btn'}, 'How the Data Flows');
  tabRow.appendChild(btnStd);
  tabRow.appendChild(btnFlow);
  container.appendChild(tabRow);

  const host = el('div',{});
  container.appendChild(host);

  function showStandards(){
    btnStd.classList.add('active'); btnFlow.classList.remove('active');
    host.innerHTML = '';
    host.appendChild(sectionBlock(
      'Estimated financial impact by standard',
      'Applying each standard’s threshold-triggered intervention across the network — figures cited above, summed for comparison.',
      el('div',{style:'max-width:640px;'}, chartCard({
        title:'Estimated Financial Impact', subtitle:'UGX billion',
        type:'bar', indexAxis:'y',
        labels: STANDARDS.map(s => s.metric.split(' — ')[0].split(' (')[0]),
        datasets:[{ data: STANDARDS.map(s=>s.impactBnUshs), backgroundColor: NEON.slice(0,STANDARDS.length), borderRadius:6 }]
      }))
    ));
    host.appendChild(sectionBlock(
      'Engineering Reference Standards',
      'Threshold bands and recommended interventions cited directly from the manuals governing MoWT maintenance decisions.',
      buildStandardsGrid()
    ));
  }
  function showFlow(){
    btnFlow.classList.add('active'); btnStd.classList.remove('active');
    host.innerHTML = '';
    host.appendChild(sectionBlock(
      'How the Data Flows',
      'The platform’s real system/data pipeline — from field-survey inputs, through computed condition and priority models, to the consolidated investment plan. Moved here from its own top-level nav item, since this is system documentation rather than a user workflow.',
      buildFlowDiagram()
    ));
  }
  btnStd.addEventListener('click', showStandards);
  btnFlow.addEventListener('click', showFlow);

  showStandards();
};
