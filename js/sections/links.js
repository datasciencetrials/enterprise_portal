RENDERERS.links = async function(container){
  container.innerHTML = '';

  container.appendChild(pageHead(
    'Live Links',
    'Live, publicly deployed projects, plus a labelled creative-demo mirror of the priezent Result Engine pages.',
    '4 live links · 6 demo tabs'
  ));

  function linkCardGrid(items){
    const grid = el('div',{style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;'});
    items.forEach(l=>{
      grid.appendChild(el('a',{href:l.url, target:'_blank', rel:'noopener noreferrer', class:'card card-pad hoverable', style:`display:block;border-left:4px solid ${l.a};text-decoration:none;color:inherit;`},[
        el('h3',{}, l.icon+'  '+l.label),
        el('p',{class:'muted', style:'margin-top:6px;'}, l.desc),
        el('p',{class:'footnote', style:'margin-top:10px;word-break:break-all;'}, l.url),
      ]));
    });
    return grid;
  }

  // ---- This portal itself (self-link, kept distinct from the bot-project links below) ----
  const enterpriseLinks = [
    { icon:'🛰️', label:'Uganda GIS Enterprise Portal', desc:'This platform — live national road-network GIS, maintenance analytics and investment dashboards.', url:'https://datasciencetrials.github.io/enterprise_portal/', a:'var(--neon-cyan)' },
  ];
  container.appendChild(sectionBlock('🚀 Live Verification & Enterprise Links', 'Live, publicly deployed MoWT enterprise systems.', linkCardGrid(enterpriseLinks)));

  // ---- Bot / automation projects (separate GitHub account — priscananjehe1996/priezent) ----
  const botResultLinks = [
    { icon:'⚙️', label:'Result Engine Dashboard', desc:'Automated results-tracking dashboard.', url:'https://priscananjehe1996.github.io/priezent/result_engine.html', a:'var(--neon-blue)' },
    { icon:'☀️', label:'3D Solar Agent App', desc:'Interactive 3D solar agent application.', url:'https://priscananjehe1996.github.io/priezent/', a:'var(--neon-orange)' },
    { icon:'📡', label:'Mindscape Telemetry', desc:'Telemetry and monitoring interface.', url:'https://priscananjehe1996.github.io/priezent/prisca_mindscape.html', a:'var(--neon-magenta)' },
  ];
  container.appendChild(sectionBlock('🤖 Bot Results', 'Live, publicly deployed automation projects.', linkCardGrid(botResultLinks)));

  // ==========================================================================
  // CREATIVE / DEMO CONTENT — pulled from the "Result Engine" bot-result pages
  // above (priscananjehe1996/priezent). This is a personal creative project,
  // NOT verified MoWT engineering data. Every value below is illustrative
  // decorative content hardcoded into those pages, not computed from a real
  // trained model, weighbridge log, or bridge inspection register. Kept
  // clearly separated and labelled so it is never mistaken for the real,
  // sourced data used throughout the rest of this platform.
  // ==========================================================================
  container.appendChild(el('div',{class:'callout warn', style:'margin:28px 0 -6px;'},[
    el('strong',{},'🎨 Creative / demo content below. '),
    'This section mirrors the "UNRN Result Engine" bot-result pages from Prisca\'s personal priezent project. The model metrics, weighbridge figures, bridge ratings and "AI workforce" roster are illustrative content written into those pages, not verified MoWT engineering results or figures computed anywhere on this platform. Nothing below should be treated as an official finding of the Uganda GIS Enterprise portal.'
  ]));

  container.appendChild(kpiGrid([
    { label:'Classified Network (demo)', value:'21,000', unit:'km', accent:'var(--neon-cyan)' },
    { label:'PyTorch CNN Defect Conf. (demo)', value:'99.6', unit:'%', accent:'var(--neon-green)' },
    { label:'WIM Weighbridge Compliance (demo)', value:'99.1', unit:'%', accent:'var(--neon-orange)' },
    { label:'"AI Agent Workforce" (demo)', value:'25,000', unit:'crew', accent:'var(--neon-purple)' },
  ]));

  // ---- 6 demo tabs, built as an actual tabbed panel (site-standard tab-row/tab-btn pattern) ----
  function paneCaption(text){ return el('p',{class:'footnote', style:'margin:-4px 0 14px;'}, text); }

  function buildCnnPane(){
    const cnnFacts = el('div',{class:'grid-3'});
    [
      ['Model Checkpoint','pavement_cnn_defect_model.pth'],
      ['Survey Images Scanned','12.79 Million Images'],
      ['Network Drives','W:\\, X:\\, Y:\\, Z:\\'],
      ['Training Final Loss','1.1907 (30 Epochs)'],
    ].forEach(([k,v])=> cnnFacts.appendChild(el('div',{class:'card card-pad'},[el('div',{class:'muted'},k), el('div',{style:'font-weight:700;margin-top:4px;'},v)])));
    const cnnTable = dataTable({
      caption:'defect classes',
      columns:[
        {key:'cls', label:'Defect Class'},
        {key:'precision', label:'Precision', align:'num'},
        {key:'n', label:'Samples', align:'num'},
      ],
      rows:[
        {cls:'1. Intact Pavement', precision:'99.6%', n:125},
        {cls:'2. Surface Crack (LCMS)', precision:'98.4%', n:125},
        {cls:'3. Rutting & Distortion', precision:'97.8%', n:125},
        {cls:'4. Pothole & Edge Break', precision:'99.1%', n:125},
      ],
    });
    return el('div',{},[
      paneCaption('Illustrative content from the priezent Result Engine page — not a real trained model on this platform.'),
      cnnFacts, el('div',{style:'height:14px;'}), cnnTable,
    ]);
  }

  function buildNetworkPane(){
    const netKpis = kpiGrid([
      { label:'Mean PCI (demo)', value:'86.2', accent:'var(--neon-green)' },
      { label:'Mean IRI (demo)', value:'2.71', unit:'m/km', accent:'var(--neon-cyan)' },
      { label:'Replacement Value (demo)', value:'3.09', unit:'USD bn', accent:'var(--neon-orange)' },
      { label:'Asset Value (demo)', value:'11.43', unit:'UGX tn', accent:'var(--neon-purple)' },
    ]);
    const netTable = dataTable({
      caption:'sample link predictions',
      columns:[
        {key:'id', label:'Link ID'}, {key:'road', label:'Road No'}, {key:'name', label:'Corridor'},
        {key:'len', label:'Length'}, {key:'pci', label:'Pred PCI', align:'num'}, {key:'iri', label:'Pred IRI', align:'num'},
        {key:'treat', label:'PMS Treatment'}, {key:'val', label:'Asset Value', align:'num'},
      ],
      rows:[
        {id:'A001_Link01', road:'A001', name:'Kampala - Mukono', len:'17.74 km', pci:86.0, iri:2.71, treat:'Routine Maintenance & Crack Sealing', val:'$5,336,192'},
        {id:'A001_Link02', road:'A001', name:'Mukono - Lugazi', len:'24.14 km', pci:87.0, iri:2.75, treat:'Routine Maintenance & Crack Sealing', val:'$7,350,285'},
        {id:'A002_Link01', road:'A002', name:'Jinja - Iganga', len:'38.50 km', pci:84.5, iri:2.85, treat:'Fog Spray & Patching (PMS Tab 13)', val:'$11,385,437'},
        {id:'A003_Link01', road:'A003', name:'Mbale - Soroti', len:'102.30 km', pci:89.2, iri:2.50, treat:'Routine Maintenance & Crack Sealing', val:'$31,937,910'},
        {id:'B104_Link01', road:'B104', name:'Acholibur - Aswa River', len:'45.00 km', pci:92.0, iri:2.10, treat:'Routine Maintenance & Off-carriageway', val:'$14,490,000'},
      ],
    });
    return el('div',{},[
      paneCaption('5 of 1,022 sample link-level predictions shown on the priezent page — illustrative, not a real prediction run on this platform\'s network.geojson.'),
      netKpis, el('div',{style:'height:14px;'}), netTable,
    ]);
  }

  function buildWimPane(){
    const wimGrid = el('div',{class:'grid-3'});
    [
      ['WB-01 Busia Border Weighbridge','99.4% Compliant'],
      ['WB-02 Malaba Border Station','99.2% Compliant'],
      ['WB-03 Luwero Corridor Station','99.1% Compliant'],
      ['WB-04 Mbarara Western Station','98.9% Compliant'],
    ].forEach(([k,v])=> wimGrid.appendChild(el('div',{class:'card card-pad', style:'display:flex;justify-content:space-between;align-items:center;'},[el('span',{style:'font-weight:600;'},k), el('span',{style:'color:var(--neon-green);font-weight:700;'},v)])));
    return el('div',{},[
      paneCaption('Illustrative station list from the priezent page — not the real weighbridge_district_coverage.json dataset used elsewhere on this platform.'),
      wimGrid,
    ]);
  }

  function buildBridgesPane(){
    const bridgeGrid = el('div',{class:'grid-3'});
    [
      ['New Jinja Nile Cable-Stayed Bridge','Joint Rating 9.2 / 10'],
      ['Karuma Bridge Hydro Dynamics','Joint Rating 8.6 / 10'],
      ['Pakwach Albert Nile Crossing','Joint Rating 8.4 / 10'],
    ].forEach(([k,v])=> bridgeGrid.appendChild(el('div',{class:'card card-pad'},[el('div',{style:'font-weight:700;'},k), el('div',{style:'margin-top:6px;color:var(--neon-green);'},v)])));
    return el('div',{},[
      paneCaption('Illustrative bridge ratings from the priezent page — not the platform\'s real geo/bridges.geojson register (see Bridges & Culverts for that).'),
      bridgeGrid,
      el('p',{class:'footnote', style:'margin-top:12px;'},'Overall "Structural Health Index" shown on the source page: 96.2%.'),
    ]);
  }

  function buildWorldsPane(){
    const worldsTable = dataTable({
      caption:'AI workforce roster',
      columns:[
        {key:'world', label:'World'}, {key:'lead', label:'Master Lead'}, {key:'g', label:'Gravity', align:'num'},
        {key:'focus', label:'Workload Focus'}, {key:'score', label:'Workload Score', align:'num'},
      ],
      rows:[
        {world:'🪐 Mercury', lead:'Alexander (L100)', g:'0.38g', focus:'Weighbridge Data & Axle Load Spectra', score:'780/1000'},
        {world:'♀️ Venus', lead:'Amelia (L98)', g:'0.90g', focus:'MoWT Engineering Manuals & Standards', score:'820/1000'},
        {world:'🌍 Terra (Earth)', lead:'Arthur (L100)', g:'1.00g', focus:'21,000 km Classified Network Master', score:'980/1000'},
        {world:'🌙 Luna (Moon)', lead:'Audrey (L99)', g:'0.165g', focus:'LCMS 3D Laser & Road Condition Scans', score:'940/1000'},
        {world:'♂️ Mars', lead:'Benjamin (L97)', g:'0.38g', focus:'Traffic Volumetrics & ATC Counts', score:'860/1000'},
        {world:'♃ Jupiter (Europa)', lead:'Charlotte (L100)', g:'0.134g', focus:'UGNBMS Nile Bridge Management', score:'920/1000'},
        {world:'♄ Saturn (Titan)', lead:'Daniel (L99)', g:'0.14g', focus:'GIS Shapefiles & Cartography Guild', score:'900/1000'},
        {world:'♅ Uranus (Titania)', lead:'Eleanor (L96)', g:'0.89g', focus:'NTIS Transport Information System', score:'840/1000'},
        {world:'♆ Neptune (Triton)', lead:'Ethan (L98)', g:'1.12g', focus:'Inland Waterway Ferries & Marine Media', score:'810/1000'},
        {world:'♇ Pluto', lead:'Emily (L100)', g:'0.063g', focus:'60m Road Reserve Cadastral Observatory', score:'800/1000'},
      ],
    });
    return el('div',{},[
      paneCaption('Explicitly a fictional/creative concept from the priezent project — no such workforce, agents or planetary operation exists. Shown here purely as a demo of the source page\'s content.'),
      worldsTable,
    ]);
  }

  function buildSatellitePane(){
    const satGrid = el('div',{class:'grid-2'});
    satGrid.appendChild(el('div',{class:'card card-pad'},[
      el('div',{style:'font-weight:700;'},'Drone LiDAR Survey Area: 4,800 km²'),
      el('div',{class:'muted', style:'margin-top:4px;'},'DEM Resolution: 0.05m point cloud elevation'),
      el('p',{class:'footnote', style:'margin-top:8px;'},'3D digital surface models & pavement deflection profiles (demo text).'),
    ]));
    satGrid.appendChild(el('div',{class:'card card-pad'},[
      el('div',{style:'font-weight:700;'},'InSAR Satellite Deformation Radar'),
      el('div',{class:'muted', style:'margin-top:4px;'},'Surface subsidence: 0.12 mm/yr stability'),
      el('p',{class:'footnote', style:'margin-top:8px;'},'Subsurface moisture & embankment settlement radar monitoring (demo text).'),
    ]));
    return el('div',{},[
      paneCaption('Illustrative content from the priezent page — this platform does not currently ingest satellite or LiDAR survey data.'),
      satGrid,
    ]);
  }

  const demoTabs = [
    { id:'cnn',       label:'🧠 Tab 1 — CNN Defect Model',       build: buildCnnPane },
    { id:'network',   label:'🌍 Tab 2 — Network Predictions',    build: buildNetworkPane },
    { id:'wim',       label:'⚖️ Tab 3 — WIM Weighbridges',       build: buildWimPane },
    { id:'bridges',   label:'🌉 Tab 4 — UGNBMS Nile Bridges',    build: buildBridgesPane },
    { id:'worlds',    label:'🪐 Tab 5 — Solar Worlds (fictional)', build: buildWorldsPane },
    { id:'satellite', label:'🛰️ Tab 6 — Satellite & LiDAR',      build: buildSatellitePane },
  ];
  const demoTabRow = el('div',{class:'tab-row'});
  const demoPaneHost = el('div',{});
  function showDemoTab(id){
    [...demoTabRow.children].forEach(b => b.classList.toggle('active', b.dataset.id === id));
    demoPaneHost.innerHTML = '';
    demoPaneHost.appendChild(demoTabs.find(t=>t.id===id).build());
  }
  demoTabs.forEach(t=>{
    const btn = el('button',{class:'tab-btn', 'data-id':t.id, type:'button', onclick:()=>showDemoTab(t.id)}, t.label);
    demoTabRow.appendChild(btn);
  });
  container.appendChild(sectionBlock('🎨 Result Engine Mirror — 6 Demo Tabs', 'Click a tab to switch panels. Every value below is illustrative content copied from the priezent Result Engine page, not verified MoWT engineering data.', el('div',{},[demoTabRow, demoPaneHost])));
  showDemoTab('cnn');
};
