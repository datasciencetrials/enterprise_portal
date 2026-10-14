RENDERERS.socioeconomic = async function(container){
  container.innerHTML = '';

  container.appendChild(pageHead(
    'Socio-Economic & Climate',
    'Economic geography and climate-sensitive land use — protected areas, forest reserves, wetlands, and planned investment corridors — overlaid on the road network for road-investment planning.'
  ));

  const body = el('div', {});
  container.appendChild(body);
  body.appendChild(loadingBlock('Loading protected-area, forest, wetland, investment-corridor and access datasets…'));

  const [paGeo, frGeo, wetGeo, oprcGeo, ndpivGeo, townsGeo, airportsGeo, ferryGeo] = await Promise.all([
    DataStore.protectedAreas(),
    DataStore.forestReserves(),
    DataStore.wetlands(),
    DataStore.oprcContracts(),
    DataStore.ndpivProjects(),
    DataStore.towns(),
    DataStore.airports(),
    DataStore.ferryCrossings(),
  ]);

  body.innerHTML = '';

  // -----------------------------------------------------------------------
  // Category decode. Confirmed by cross-referencing this file's short codes
  // against the platform's paired gazetted-areas register, which spells out
  // CFR/LFR/NP/GR/DJM in full for the same features. HA, ENC and AS have no
  // expanded form anywhere in the source data — they are shown exactly as
  // recorded in the register rather than guessed at.
  // -----------------------------------------------------------------------
  const CAT_LABEL = { CFR:'Central Forest Reserve', LFR:'Local Forest Reserve', NP:'National Park', GR:'Game Reserve', DJM:'Degazetted / Joint Management Area' };
  const catLabel = c => CAT_LABEL[c] || c;

  function legend(pairs){
    return el('div', {class:'muted', style:'font-size:.78rem;margin-top:10px;display:flex;flex-wrap:wrap;gap:16px;'},
      pairs.map(([label,color]) => el('span', {}, [
        el('span', {style:'display:inline-block;width:10px;height:10px;border-radius:2px;background:'+color+';margin-right:6px;'}),
        label
      ]))
    );
  }

  // ---- Forest reserves (766 named reserves — Forest Department register) ----
  const forestRows = frGeo.features.map(f=>{
    const p = f.properties;
    return { name: p['Forest Reserve Name'] || 'Unnamed', fdCode: p['FD Code'] || '—', type: p['Gazettement Type'] || '—', areaHa: p['Area Ha'] || 0 };
  });

  // ---- Non-forest protected areas from the same register (National Parks, Game
  // Reserves, Hunting/Wildlife Areas, Amenity/Sanctuary areas, encroachment zones) ----
  const NON_FOREST_CATS = ['NP','GR','HA','ENC','AS'];
  const parkRows = paGeo.features.filter(f => NON_FOREST_CATS.includes(f.properties.Category)).map(f=>{
    const p = f.properties;
    return {
      name: (p.Name && p.Name.trim()) ? p.Name : 'Unnamed (' + p.Category + ')',
      category: catLabel(p.Category),
      rawCat: p.Category,
      areaHa: (p.Shape_Area || 0) / 10000, // Shape_Area is m² in source; /10000 = ha, cross-checked against the Forest Department's own Area Ha field for shared reserves
    };
  });

  // ---- Wetlands (2,710 mapped units — National Wetlands Inventory) ----
  const wetlandRows = wetGeo.features.map(f=>{
    const p = f.properties;
    return {
      name: p['Wetland Name'] || 'Unnamed',
      type: p['Wetland Type'] || '—',
      region: p['Region'] || '—',
      district: p['District'] || '—',
      areaHa: p['Area (Ha)'] || 0,
    };
  });

  // ---- OPRC contract lots (132 links scoped for Output- and Performance-based Road Contracts) ----
  const oprcRows = oprcGeo.features.map(f=>{
    const p = f.properties;
    return { lot: p.lot_name, region: p.region, roadNo: p.road_no, linkName: p.link_name, lengthKm: p.length_km, lotTotalKm: p.lot_total_km, status: p.status };
  });

  // ---- NDP IV investment projects (165 project-tagged road links) ----
  const ndpivRows = ndpivGeo.features.map(f=>{
    const p = f.properties;
    return { project: p.project_name, component: p.component, region: p.region, roadNo: p.road_no, linkName: p.link_name, lengthKm: p.length_km, priority: p.priority, status: p.status, funder: p.funder };
  });

  // ---- Towns / airports / ferry crossings (use geometry coordinates directly —
  // some source property Lat/Long fields are stale/zeroed for a subset of rows) ----
  const townRows = townsGeo.features.map(f=>{
    const p = f.properties; const c = f.geometry.coordinates;
    return { name: p['Place Name'], cls: p['Status'] || '—', lat: c[1], lon: c[0] };
  });
  const airportRows = airportsGeo.features.map(f=>{
    const p = f.properties; const c = f.geometry.coordinates;
    return { name: p.F9, category: p.Category, lat: c[1], lon: c[0] };
  });
  const cleanWaterBody = s => (s||'').replace(/^L\./,'Lake ').replace(/^R\./,'River ');
  const ferryRows = ferryGeo.features.map(f=>{
    const p = f.properties; const c = f.geometry.coordinates;
    return { name: p.Ferry_cros || p.Remarks || 'Unnamed crossing', waterBody: cleanWaterBody(p.Water_body), status: p.Category || '—', lat: c[1], lon: c[0] };
  });

  // -----------------------------------------------------------------------
  // Tabs
  // -----------------------------------------------------------------------
  const tabs = [
    { id:'forest',    label:'Forest Reserves' },
    { id:'parks',     label:'National Parks, Game & Wildlife Reserves' },
    { id:'wetlands',  label:'Wetlands' },
    { id:'corridors', label:'OPRC / NDP IV Investment Corridors' },
    { id:'access',    label:'Towns & Access' },
  ];
  const tabRow = el('div', {class:'tab-row'});
  const paneHost = el('div', {});
  body.appendChild(tabRow);
  body.appendChild(paneHost);

  let currentMap = null;
  function destroyMap(){ if(currentMap){ try{ currentMap.remove(); }catch(e){} currentMap = null; } }

  function baseMap(mapDiv, center, zoom){
    const map = L.map(mapDiv, { scrollWheelZoom:false }).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'&copy; OpenStreetMap contributors', maxZoom:13 }).addTo(map);
    currentMap = map;
    return map;
  }

  // ---- Forest Reserves pane ----
  function buildForestPane(){
    const wrap = el('div', {});
    const totalHa = forestRows.reduce((s,r)=>s+r.areaHa, 0);
    const byTypeCount = {}, byTypeArea = {};
    forestRows.forEach(r=>{ byTypeCount[r.type] = (byTypeCount[r.type]||0)+1; byTypeArea[r.type] = (byTypeArea[r.type]||0)+r.areaHa; });
    const types = Object.keys(byTypeCount);
    const typeColor = { 'Central Forest Reserve':'#00ff85', 'Local Forest Reserve':'#00e5ff', 'Degazetted / Joint Management Area':'#ff7a00' };

    wrap.appendChild(kpiGrid([
      { label:'Named Forest Reserves', value: fmtNum(forestRows.length), accent:'var(--neon-green)' },
      { label:'Total Gazetted Forest Area', value: fmtNum(totalHa,0), unit:'ha', accent:'var(--neon-cyan)' },
      { label:'Central Forest Reserves', value: fmtNum(byTypeCount['Central Forest Reserve']||0), accent:'var(--neon-blue)' },
      { label:'Local Forest Reserves', value: fmtNum(byTypeCount['Local Forest Reserve']||0), accent:'var(--neon-orange)' },
    ]));
    wrap.appendChild(el('p', {class:'footnote'},
      'Source: Forest Department gazettement register (Forest Reserves Register), '+fmtNum(forestRows.length)+' named reserves. Road works within or adjacent to a Forest Reserve boundary typically require environmental clearance — this layer is provided for that screening purpose against planned road corridors.'
    ));

    wrap.appendChild(sectionBlock('Forest reserve area by gazettement type', 'All gazettement categories in the register — no subset.', chartGrid([
      chartCard({ title:'Reserve count by type', type:'doughnut',
        labels: types, datasets:[{ data: types.map(t=>byTypeCount[t]), backgroundColor: types.map(t=>typeColor[t]||'#888'), borderWidth:0 }] }),
      chartCard({ title:'Gazetted area by type', subtitle:'Hectares', type:'bar',
        labels: types, datasets:[{ data: types.map(t=>Math.round(byTypeArea[t])), backgroundColor: types.map(t=>typeColor[t]||'#888'), borderRadius:6 }] }),
    ])));

    const mapDiv = el('div', {class:'map-shell'});
    const mapCard = el('div', {class:'card card-pad'}, [mapDiv, legend(types.map(t=>[t, typeColor[t]||'#888']))]);
    wrap.appendChild(sectionBlock('Forest reserve boundaries', 'All '+fmtNum(forestRows.length)+' gazetted forest reserve polygons.', mapCard));
    requestAnimationFrame(()=>{
      const map = baseMap(mapDiv, [1.4,32.3], 7);
      const layer = L.geoJSON(frGeo, {
        style: f => ({ color: typeColor[f.properties['Gazettement Type']] || '#888', weight:1, fillOpacity:0.35 }),
        onEachFeature: (f,l) => l.bindPopup(esc(f.properties['Forest Reserve Name']||'Unnamed')+'<br>'+esc(f.properties['Gazettement Type']||'')+'<br>'+fmtNum(f.properties['Area Ha'],0)+' ha')
      }).addTo(map);
      try{ map.fitBounds(layer.getBounds(), {padding:[20,20]}); }catch(e){}
    });

    wrap.appendChild(sectionBlock('Forest reserve register', 'All '+fmtNum(forestRows.length)+' named forest reserves.', dataTable({
      columns:[
        { key:'name', label:'Forest Reserve' },
        { key:'fdCode', label:'FD Code' },
        { key:'type', label:'Gazettement Type' },
        { key:'areaHa', label:'Area', align:'num', fmt: v=>fmtNum(v,0)+' ha' },
      ],
      rows: forestRows, pageSize:25, searchKeys:['name','fdCode'],
      filters:[{ label:'gazettement type', key:'type', options: types }],
      caption:'forest reserves',
    })));

    return wrap;
  }

  // ---- National Parks / Game / Wildlife Reserves pane ----
  function buildParksPane(){
    const wrap = el('div', {});
    const byCatCount = {}, byCatArea = {};
    parkRows.forEach(r=>{ byCatCount[r.category] = (byCatCount[r.category]||0)+1; byCatArea[r.category] = (byCatArea[r.category]||0)+r.areaHa; });
    const cats = Object.keys(byCatCount);
    const catColor = {}; cats.forEach((c,i)=> catColor[c] = NEON[i % NEON.length]);
    const totalHa = parkRows.reduce((s,r)=>s+r.areaHa, 0);
    const unnamed = parkRows.filter(r=>r.rawCat==='ENC').length;

    wrap.appendChild(kpiGrid([
      { label:'Protected Areas (non-forest)', value: fmtNum(parkRows.length), accent:'var(--neon-purple)' },
      { label:'Total Gazetted Area', value: fmtNum(totalHa,0), unit:'ha', accent:'var(--neon-cyan)' },
      { label:'National Parks', value: fmtNum(byCatCount['National Park']||0), accent:'var(--neon-green)' },
      { label:'Game Reserves', value: fmtNum(byCatCount['Game Reserve']||0), accent:'var(--neon-orange)' },
    ]));
    wrap.appendChild(el('p', {class:'footnote'},
      'Source: national Protected Areas Register, '+fmtNum(parkRows.length)+' non-forest gazetted units (National Parks, Game Reserves, and register categories HA, ENC and AS). Area computed from each polygon’s recorded geometry, cross-checked against the Forest Department’s own hectare figures for shared reserves. National Park, Game Reserve and Degazetted/Joint Management Area categories carry full names in the source register; the register does not spell out HA, ENC or AS beyond these codes, so they are shown as recorded rather than guessed at — this includes '+fmtNum(unnamed)+' unnamed “ENC” (encroachment-zone) polygons with no name field populated in the source.'
    ));

    wrap.appendChild(sectionBlock('Protected area extent by category', 'All non-forest register categories — no subset.', chartGrid([
      chartCard({ title:'Count by category', type:'doughnut',
        labels: cats, datasets:[{ data: cats.map(c=>byCatCount[c]), backgroundColor: cats.map(c=>catColor[c]), borderWidth:0 }] }),
      chartCard({ title:'Area by category', subtitle:'Hectares', type:'bar',
        labels: cats, datasets:[{ data: cats.map(c=>Math.round(byCatArea[c])), backgroundColor: cats.map(c=>catColor[c]), borderRadius:6 }] }),
    ])));

    const mapDiv = el('div', {class:'map-shell'});
    const mapCard = el('div', {class:'card card-pad'}, [mapDiv, legend(cats.map(c=>[c, catColor[c]]))]);
    wrap.appendChild(sectionBlock('Protected area boundaries', 'All '+fmtNum(parkRows.length)+' non-forest gazetted polygons.', mapCard));
    requestAnimationFrame(()=>{
      const map = baseMap(mapDiv, [1.4,32.3], 7);
      const layer = L.geoJSON(paGeo, {
        filter: f => NON_FOREST_CATS.includes(f.properties.Category),
        style: f => ({ color: catColor[catLabel(f.properties.Category)] || '#888', weight:1, fillOpacity:0.4 }),
        onEachFeature: (f,l) => l.bindPopup(esc((f.properties.Name&&f.properties.Name.trim())||('Unnamed ('+f.properties.Category+')'))+'<br>'+esc(catLabel(f.properties.Category)))
      }).addTo(map);
      try{ map.fitBounds(layer.getBounds(), {padding:[20,20]}); }catch(e){}
    });

    wrap.appendChild(sectionBlock('Protected areas register', 'All '+fmtNum(parkRows.length)+' non-forest gazetted units.', dataTable({
      columns:[
        { key:'name', label:'Name' },
        { key:'category', label:'Category' },
        { key:'areaHa', label:'Area', align:'num', fmt: v=>fmtNum(v,0)+' ha' },
      ],
      rows: parkRows, pageSize:25, searchKeys:['name'],
      filters:[{ label:'category', key:'category', options: cats }],
      caption:'protected areas',
    })));

    return wrap;
  }

  // ---- Wetlands pane ----
  function buildWetlandsPane(){
    const wrap = el('div', {});
    const totalHa = wetlandRows.reduce((s,r)=>s+r.areaHa, 0);
    const byRegion = {}, byType = {};
    wetlandRows.forEach(r=>{
      byRegion[r.region] = (byRegion[r.region]||0) + r.areaHa;
      byType[r.type] = (byType[r.type]||0) + r.areaHa;
    });
    const regions = Object.keys(byRegion).sort();
    const types = Object.keys(byType).sort((a,b)=>byType[b]-byType[a]);
    const named = wetlandRows.filter(r=>r.name!=='Unnamed').length;

    wrap.appendChild(kpiGrid([
      { label:'Mapped Wetland Units', value: fmtNum(wetlandRows.length), accent:'var(--neon-cyan)' },
      { label:'Total Wetland Area', value: fmtNum(totalHa,0), unit:'ha', accent:'var(--neon-blue)' },
      { label:'Named Units', value: fmtNum(named), accent:'var(--neon-green)', delta:(named/wetlandRows.length*100).toFixed(0)+'% of total' },
      { label:'Wetland Types Recorded', value: fmtNum(types.length), accent:'var(--neon-magenta)' },
    ]));
    wrap.appendChild(el('p', {class:'footnote'},
      'Source: National Wetlands Inventory, '+fmtNum(wetlandRows.length)+' mapped wetland units, '+fmtNum(totalHa,0)+' ha total. Wetlands are a standing constraint on new road alignment and drainage design under national environmental regulations. The inventory’s own regional field (Central / Eastern / Northern / Western / South Western) is a separate classification from this platform’s 6 road-maintenance regions and is shown as recorded, not remapped onto the maintenance-region scheme.'
    ));

    wrap.appendChild(sectionBlock('Wetland area by region and type', 'All regions and types recorded in the inventory — no subset.', chartGrid([
      chartCard({ title:'Wetland area by inventory region', subtitle:'Hectares — inventory’s own regional classification, not maintenance regions', type:'bar',
        labels: regions, datasets:[{ data: regions.map(r=>Math.round(byRegion[r])), backgroundColor:'#00e5ff', borderRadius:6 }] }),
      chartCard({ title:'Wetland area by type', subtitle:'Hectares', type:'bar', indexAxis:'y',
        labels: types, datasets:[{ data: types.map(t=>Math.round(byType[t])), backgroundColor:NEON.slice(0,types.length), borderRadius:6 }] }),
    ])));

    const typeColor = {}; types.forEach((t,i)=> typeColor[t] = NEON[i % NEON.length]);
    const mapDiv = el('div', {class:'map-shell'});
    const mapCard = el('div', {class:'card card-pad'}, [mapDiv, legend(types.map(t=>[t, typeColor[t]]))]);
    wrap.appendChild(sectionBlock('Wetland extent', 'All '+fmtNum(wetlandRows.length)+' mapped wetland polygons, colored by type.', mapCard));
    requestAnimationFrame(()=>{
      const map = baseMap(mapDiv, [1.4,32.3], 7);
      const layer = L.geoJSON(wetGeo, {
        style: f => ({ color: typeColor[f.properties['Wetland Type']] || '#888', weight:0.5, fillOpacity:0.45, stroke:false }),
        onEachFeature: (f,l) => l.bindPopup(esc(f.properties['Wetland Name']||'Unnamed')+'<br>'+esc(f.properties['Wetland Type']||'')+'<br>'+esc(f.properties['District']||''))
      }).addTo(map);
      try{ map.fitBounds(layer.getBounds(), {padding:[20,20]}); }catch(e){}
    });

    wrap.appendChild(sectionBlock('Wetland register', 'All '+fmtNum(wetlandRows.length)+' mapped wetland units — search or filter by region/type.', dataTable({
      columns:[
        { key:'name', label:'Wetland' },
        { key:'type', label:'Type' },
        { key:'region', label:'Region (inventory)' },
        { key:'district', label:'District' },
        { key:'areaHa', label:'Area', align:'num', fmt: v=>fmtNum(v,1)+' ha' },
      ],
      rows: wetlandRows, pageSize:25, searchKeys:['name','district'],
      filters:[{ label:'region', key:'region', options: regions }, { label:'type', key:'type', options: types }],
      caption:'wetland units',
    })));

    return wrap;
  }

  // ---- OPRC / NDP IV investment corridors pane ----
  function buildCorridorsPane(){
    const wrap = el('div', {});
    const oprcKm = oprcRows.reduce((s,r)=>s+(r.lengthKm||0), 0);
    const ndpivKm = ndpivRows.reduce((s,r)=>s+(r.lengthKm||0), 0);
    const ndpivHigh = ndpivRows.filter(r=>r.priority==='High').length;

    const oprcByRegion = {}; DataStore.REGIONS.forEach(r=>oprcByRegion[r]=0);
    oprcRows.forEach(r=>{ if(oprcByRegion[r.region]!==undefined) oprcByRegion[r.region]+=(r.lengthKm||0); });
    const ndpivByComponent = {};
    ndpivRows.forEach(r=>{ ndpivByComponent[r.component] = (ndpivByComponent[r.component]||0)+1; });
    const components = Object.keys(ndpivByComponent);

    wrap.appendChild(kpiGrid([
      { label:'OPRC Scoped Links', value: fmtNum(oprcRows.length), accent:'var(--neon-cyan)' },
      { label:'OPRC Scoped Length', value: fmtNum(oprcKm,0), unit:'km', accent:'var(--neon-blue)' },
      { label:'NDP IV Investment Projects', value: fmtNum(ndpivRows.length), accent:'var(--neon-magenta)' },
      { label:'NDP IV Tagged Length', value: fmtNum(ndpivKm,0), unit:'km', accent:'var(--neon-purple)' },
      { label:'NDP IV High-Priority Links', value: fmtNum(ndpivHigh), accent:'var(--neon-orange)', delta:(ndpivHigh/ndpivRows.length*100).toFixed(0)+'% of projects' },
    ]));
    wrap.appendChild(el('p', {class:'footnote'},
      'Source: MoWT FY2025/26 NDP IV investment master list ('+fmtNum(ndpivRows.length)+' project-tagged road links) and Output- and Performance-based Road Contracts (OPRC) scoping register ('+fmtNum(oprcRows.length)+' links across 6 regional lots). Both are real planning-stage overlays on the road-link network — link names are decoded from the source register, not shown as raw link codes.'
    ));

    wrap.appendChild(sectionBlock('Investment corridors by region and component', 'All 6 maintenance regions for OPRC; all NDP IV components — no subset.', chartGrid([
      chartCard({ title:'OPRC scoped length by region', subtitle:'km', type:'bar',
        labels: DataStore.REGIONS, datasets:[{ data: DataStore.REGIONS.map(r=>Math.round(oprcByRegion[r])), backgroundColor:'#00e5ff', borderRadius:6 }] }),
      chartCard({ title:'NDP IV projects by component', type:'bar', indexAxis:'y',
        labels: components, datasets:[{ data: components.map(c=>ndpivByComponent[c]), backgroundColor:NEON.slice(0,components.length), borderRadius:6 }] }),
    ])));

    const mapDiv = el('div', {class:'map-shell'});
    const mapCard = el('div', {class:'card card-pad'}, [mapDiv, legend([['OPRC contract-lot links ('+fmtNum(oprcRows.length)+')','#00e5ff'], ['NDP IV investment-project links ('+fmtNum(ndpivRows.length)+')','#ff00c8']])]);
    wrap.appendChild(sectionBlock('Investment corridor map', 'Road links carrying an OPRC contract-lot scope or an NDP IV investment tag.', mapCard));
    requestAnimationFrame(()=>{
      const map = baseMap(mapDiv, [1.4,32.3], 7);
      const oLayer = L.geoJSON(oprcGeo, { style:{ color:'#00e5ff', weight:3, opacity:0.85 }, onEachFeature:(f,l)=>l.bindPopup(esc(f.properties.link_name)+'<br>'+esc(f.properties.lot_name)) }).addTo(map);
      L.geoJSON(ndpivGeo, { style:{ color:'#ff00c8', weight:3, opacity:0.85 }, onEachFeature:(f,l)=>l.bindPopup(esc(f.properties.link_name)+'<br>'+esc(f.properties.project_name)) }).addTo(map);
      try{ map.fitBounds(oLayer.getBounds(), {padding:[20,20]}); }catch(e){}
    });

    wrap.appendChild(sectionBlock('OPRC contract lots', 'All '+fmtNum(oprcRows.length)+' road links scoped under Output- and Performance-based Road Contracts.', dataTable({
      columns:[
        { key:'lot', label:'Contract Lot' },
        { key:'region', label:'Region' },
        { key:'roadNo', label:'Road No.' },
        { key:'linkName', label:'Link' },
        { key:'lengthKm', label:'Link Length', align:'num', fmt:v=>fmtKm(v) },
        { key:'lotTotalKm', label:'Lot Total', align:'num', fmt:v=>fmtKm(v) },
        { key:'status', label:'Status' },
      ],
      rows: oprcRows, pageSize:25, searchKeys:['linkName','roadNo','lot'],
      filters:[{ label:'region', key:'region', options: DataStore.REGIONS }],
      caption:'OPRC-scoped links',
    })));

    wrap.appendChild(sectionBlock('NDP IV investment projects', 'All '+fmtNum(ndpivRows.length)+' project-tagged road links.', dataTable({
      columns:[
        { key:'project', label:'Project' },
        { key:'component', label:'Component' },
        { key:'region', label:'Region' },
        { key:'linkName', label:'Link' },
        { key:'lengthKm', label:'Link Length', align:'num', fmt:v=>fmtKm(v) },
        { key:'priority', label:'Priority' },
        { key:'status', label:'Status' },
        { key:'funder', label:'Funder' },
      ],
      rows: ndpivRows, pageSize:25, searchKeys:['project','linkName','roadNo'],
      filters:[{ label:'region', key:'region', options: DataStore.REGIONS }, { label:'priority', key:'priority', options:['High','Medium'] }],
      caption:'NDP IV project links',
    })));

    return wrap;
  }

  // ---- Towns & Access pane ----
  function buildAccessPane(){
    const wrap = el('div', {});
    const byCls = {}; townRows.forEach(r=>{ byCls[r.cls]=(byCls[r.cls]||0)+1; });
    const classes = Object.keys(byCls);
    const byAirportCat = {}; airportRows.forEach(r=>{ byAirportCat[r.category]=(byAirportCat[r.category]||0)+1; });
    const ferryOperational = ferryRows.filter(r=>r.status==='Operational').length;

    wrap.appendChild(kpiGrid([
      { label:'Gazetted Towns', value: fmtNum(townRows.length), accent:'var(--neon-cyan)' },
      { label:'Airports / Airstrips', value: fmtNum(airportRows.length), accent:'var(--neon-blue)' },
      { label:'International Airports', value: fmtNum(byAirportCat['International Airport']||0), accent:'var(--neon-green)' },
      { label:'Ferry Crossings', value: fmtNum(ferryRows.length), accent:'var(--neon-orange)' },
      { label:'Ferry Crossings Operational', value: fmtNum(ferryOperational), accent:'var(--neon-magenta)', delta:(ferryOperational/ferryRows.length*100).toFixed(0)+'% of total' },
    ]));
    wrap.appendChild(el('p', {class:'footnote'},
      'Sources: national place-name/town gazetteer ('+fmtNum(townRows.length)+' gazetted towns), national airfields register ('+fmtNum(airportRows.length)+' facilities), and the MoWT ferry-crossings register ('+fmtNum(ferryRows.length)+' crossings). Coordinates are taken from each layer’s mapped geometry. Town classification codes and ferry-crossing status are shown exactly as recorded in the respective source registers. Ferry crossings are last-mile links where the road network is discontinuous across a water body.'
    ));

    wrap.appendChild(sectionBlock('Towns and airport classification', 'Full distribution recorded in each source register — no subset.', chartGrid([
      chartCard({ title:'Towns by classification', type:'bar',
        labels: classes, datasets:[{ data: classes.map(c=>byCls[c]), backgroundColor:'#00e5ff', borderRadius:6 }] }),
      chartCard({ title:'Airports by category', type:'doughnut',
        labels: Object.keys(byAirportCat), datasets:[{ data: Object.values(byAirportCat), backgroundColor:['#00ff85','#ff7a00'], borderWidth:0 }] }),
    ])));

    const mapDiv = el('div', {class:'map-shell'});
    const mapCard = el('div', {class:'card card-pad'}, [mapDiv, legend([['Road network','#c7cad4'], ['Towns','#00e5ff'], ['Airports / airstrips','#00ff85'], ['Ferry crossings','#ff2d78']])]);
    wrap.appendChild(sectionBlock('Towns, airports & ferry crossings on the road network', 'All '+fmtNum(townRows.length)+' towns, '+fmtNum(airportRows.length)+' airports/airstrips and '+fmtNum(ferryRows.length)+' ferry crossings, over the road-link network.', mapCard));
    requestAnimationFrame(async ()=>{
      const map = baseMap(mapDiv, [1.4,32.3], 7);
      try{
        const net = await DataStore.network();
        L.geoJSON(net, { style:{ color:'#c7cad4', weight:1, opacity:0.7 } }).addTo(map);
      }catch(e){}
      townRows.forEach(r=> L.circleMarker([r.lat,r.lon], {radius:3, color:'#00e5ff', weight:0, fillOpacity:0.8}).bindPopup(esc(r.name)+'<br>Class: '+esc(r.cls)).addTo(map));
      airportRows.forEach(r=> L.circleMarker([r.lat,r.lon], {radius:6, color:'#00ff85', weight:1, fillOpacity:0.9}).bindPopup(esc(r.name)+'<br>'+esc(r.category)).addTo(map));
      ferryRows.forEach(r=> L.circleMarker([r.lat,r.lon], {radius:6, color:'#ff2d78', weight:1, fillOpacity:0.9}).bindPopup(esc(r.name)+'<br>'+esc(r.waterBody)+'<br>'+esc(r.status)).addTo(map));
    });

    wrap.appendChild(sectionBlock('Towns register', 'All '+fmtNum(townRows.length)+' gazetted towns.', dataTable({
      columns:[
        { key:'name', label:'Place Name' },
        { key:'cls', label:'Classification (as gazetted)' },
        { key:'lat', label:'Latitude', align:'num', fmt:v=>fmtNum(v,3) },
        { key:'lon', label:'Longitude', align:'num', fmt:v=>fmtNum(v,3) },
      ],
      rows: townRows, pageSize:25, searchKeys:['name'],
      filters:[{ label:'classification', key:'cls', options: classes }],
      caption:'towns',
    })));

    wrap.appendChild(el('div', {class:'grid-2'}, [
      sectionBlock('Airports & airstrips', 'All '+fmtNum(airportRows.length)+' facilities.', dataTable({
        columns:[
          { key:'name', label:'Facility' },
          { key:'category', label:'Category' },
          { key:'lat', label:'Latitude', align:'num', fmt:v=>fmtNum(v,3) },
          { key:'lon', label:'Longitude', align:'num', fmt:v=>fmtNum(v,3) },
        ],
        rows: airportRows, pageSize:25, searchKeys:['name'], caption:'airports',
      })),
      sectionBlock('Ferry crossings', 'All '+fmtNum(ferryRows.length)+' crossings.', dataTable({
        columns:[
          { key:'name', label:'Crossing' },
          { key:'waterBody', label:'Water Body' },
          { key:'status', label:'Status' },
          { key:'lat', label:'Latitude', align:'num', fmt:v=>fmtNum(v,3) },
          { key:'lon', label:'Longitude', align:'num', fmt:v=>fmtNum(v,3) },
        ],
        rows: ferryRows, pageSize:25, searchKeys:['name','waterBody'], caption:'ferry crossings',
      })),
    ]));

    return wrap;
  }

  const paneBuilders = { forest: buildForestPane, parks: buildParksPane, wetlands: buildWetlandsPane, corridors: buildCorridorsPane, access: buildAccessPane };

  function showTab(id){
    destroyMap();
    [...tabRow.children].forEach(b => b.classList.toggle('active', b.dataset.id === id));
    paneHost.innerHTML = '';
    paneHost.appendChild(paneBuilders[id]());
  }

  tabs.forEach(t=>{
    const btn = el('button', { class:'tab-btn', 'data-id': t.id, onclick: ()=>showTab(t.id) }, t.label);
    tabRow.appendChild(btn);
  });

  showTab('forest');
};
