// National GIS Map — interactive Leaflet map of Uganda's road network with a
// toggleable "Reference Layers" panel. Every layer is real GeoJSON already
// hosted on this platform; nothing here is simulated or placeholder data.
// Layers are fetched (via DataStore, which caches) the first time they are
// switched on, and the built Leaflet layer is cached too, so re-toggling
// never re-fetches or rebuilds.

RENDERERS.map = async function(container){
  container.innerHTML = '';

  container.appendChild(pageHead(
    'National GIS Map',
    'Uganda’s classified road network on a live basemap, with 22 toggleable reference layers fetched directly from the platform’s GIS file store.',
    '22 reference layers'
  ));

  // ---------------------------------------------------------------- layout
  const wrap = el('div',{style:'display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap-reverse;'});
  const mapCol = el('div',{style:'flex:3 1 620px;min-width:340px;'});
  const mapDiv = el('div',{class:'map-shell', id:'gis-national-map'});
  mapCol.appendChild(mapDiv);
  mapCol.appendChild(el('p',{class:'footnote'},
    'Basemap tiles courtesy of Esri and OpenStreetMap contributors. Overlay data: MoWT GIS road-network inventory and the platform’s reference GeoJSON layers (bridges, culverts, districts, protected areas and related registers).'
  ));

  const panel = el('div',{class:'card card-pad', style:'flex:1 1 300px;max-width:340px;max-height:640px;overflow-y:auto;'});
  wrap.appendChild(mapCol);
  wrap.appendChild(panel);
  container.appendChild(wrap);

  // ---------------------------------------------------------------- map init
  const map = L.map(mapDiv, { center:[1.37, 32.29], zoom:7, minZoom:5, maxZoom:18, scrollWheelZoom:true });
  L.control.scale({ imperial:false }).addTo(map);

  const BASEMAPS = {
    light:   { label:'Light',   url:'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution:'&copy; Esri, HERE, Garmin, FAO, NOAA, USGS', maxZoom:16 },
    streets: { label:'Streets', url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', subdomains:'abc', attribution:'&copy; OpenStreetMap contributors', maxZoom:19 },
    world:   { label:'World Street', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution:'&copy; Esri, HERE, Garmin, FAO, NOAA, USGS', maxZoom:19 },
  };
  let currentTiles = null;
  const basemapRow = el('div',{class:'tab-row', style:'margin:2px 0 16px;'});
  function setBasemap(key){
    if(currentTiles) map.removeLayer(currentTiles);
    const b = BASEMAPS[key];
    const tileOpts = { attribution:b.attribution, maxZoom:b.maxZoom };
    if(b.subdomains) tileOpts.subdomains = b.subdomains; // omit entirely when absent — passing subdomains:undefined overrides Leaflet's own default and crashes _getSubdomain
    currentTiles = L.tileLayer(b.url, tileOpts);
    currentTiles.addTo(map);
    [...basemapRow.children].forEach(btn => btn.classList.toggle('active', btn.dataset.key===key));
  }
  Object.entries(BASEMAPS).forEach(([key,b])=>{
    const btn = el('button',{class:'tab-btn', 'data-key':key}, b.label);
    btn.addEventListener('click', ()=> setBasemap(key));
    basemapRow.appendChild(btn);
  });

  panel.appendChild(el('h3',{style:'margin-bottom:0;'}, 'Basemap'));
  panel.appendChild(basemapRow);
  panel.appendChild(el('h3',{style:'margin-bottom:2px;'}, 'Reference Layers'));
  panel.appendChild(el('p',{class:'tiny-muted', style:'margin-bottom:6px;'}, 'Check a layer to fetch and draw its real features. Large layers are flagged and load on demand.'));

  // CARTO's anonymous basemap tiles now require an account API key (their tiles
  // return a watermarked "API key required" image without one) — OpenStreetMap and
  // Esri's public tile services have no such requirement, so those are used instead.
  setBasemap('light');

  // ---------------------------------------------------------------- helpers

  function prettyKey(k){
    return String(k)
      .replace(/[_\.]+/g,' ')
      .replace(/([a-z0-9])([A-Z])/g,'$1 $2')
      .replace(/\s+/g,' ')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  const SKIP_KEY_RE = /^(source|data_source|shape_leng|shape_length|shape_area|shape_len|objectid|fid|id|stroke_color|stroke_weight)$/i;
  const LINK_KEY_RE = /link.*id|link.*number/i;

  function decodedValue(k, v, linkMap){
    if(k==='Road Cla 1') return DataStore.CLASS_LABELS[v] || v;
    if(LINK_KEY_RE.test(k) && typeof v==='string') return DataStore.decodeLinkId(v, linkMap) || v;
    return v;
  }

  function fmtVal(v){
    if(typeof v === 'number'){
      return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US',{maximumFractionDigits:2});
    }
    return String(v);
  }

  // Generic popup: every real, decoded, non-source property as a small table.
  function genericPopupHtml(title, props, linkMap){
    const rows = [];
    Object.entries(props||{}).forEach(([k,v])=>{
      if(v===null || v===undefined || v==='') return;
      if(SKIP_KEY_RE.test(k)) return;
      if(typeof v === 'string' && /\.(shp|xlsx|csv)\b/i.test(v)) return; // never surface a raw source filename
      const val = decodedValue(k, v, linkMap);
      rows.push(`<tr><td style="color:var(--text-tertiary);padding:2px 10px 2px 0;font-size:.7rem;white-space:nowrap;vertical-align:top;">${esc(prettyKey(k))}</td><td style="padding:2px 0;font-size:.76rem;font-weight:600;">${esc(fmtVal(val))}</td></tr>`);
    });
    return `<div style="min-width:200px;max-width:280px;"><div style="font-weight:800;margin-bottom:6px;font-size:.85rem;">${esc(title)}</div><table style="border-collapse:collapse;width:100%;">${rows.join('')}</table></div>`;
  }

  // Curated popup for a "major layer" — explicit real fields in a sensible order.
  function curatedPopupHtml(title, props, fields, linkMap){
    const rows = fields.map(([key,label,fmt])=>{
      let v = props[key];
      if(v===null || v===undefined || v==='') return null;
      if(LINK_KEY_RE.test(key)) v = DataStore.decodeLinkId(v, linkMap) || v;
      const shown = fmt ? fmt(v) : fmtVal(v);
      return `<tr><td style="color:var(--text-tertiary);padding:2px 10px 2px 0;font-size:.7rem;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:2px 0;font-size:.76rem;font-weight:600;">${esc(String(shown))}</td></tr>`;
    }).filter(Boolean);
    return `<div style="min-width:210px;max-width:290px;"><div style="font-weight:800;margin-bottom:6px;font-size:.85rem;">${esc(title)}</div><table style="border-collapse:collapse;width:100%;">${rows.join('')}</table></div>`;
  }

  const NAME_FIELD_CANDIDATES = [
    'Link Name','Bridge_Name','Culvert_Number','Weighbridge Name','station_name','link_name',
    'Place Name','District','DISTRICT','Region Nam','Forest Reserve Name','Name','name',
    'F9','Ferry_cros','TCS_NAME','incident_type','lot_name','project_name','parish',
    'Wetland Name','Wetland Type'
  ];
  function pickTitle(props, fallback){
    for(const k of NAME_FIELD_CANDIDATES){ if(props && props[k]) return String(props[k]); }
    return fallback;
  }

  const NETWORK_FIELDS = [
    ['Link Name','Link Name'],
    ['Road No 1','Road Number'],
    ['Road Cla 1','Road Class', v => DataStore.CLASS_LABELS[v] || v],
    ['Region','Region'],
    ['Length Km','Length', v=>fmtNum(v,1)+' km'],
    ['Surface Material','Surface'],
    ['Pavement Class','Pavement'],
    ['Condition','Condition'],
    ['Aadt 2026 Live','AADT (2026)', v=>fmtNum(v,0)+' veh/day'],
    ['Aadt Heavy Trucks','Heavy-Truck AADT', v=>fmtNum(v,0)],
    ['Peak Hour Velocity Kmh','Peak-Hour Speed', v=>fmtNum(v,1)+' km/h'],
    ['Road Safety Risk Band','Safety Risk Band'],
    ['Maintena 2','Maintenance Station'],
  ];
  const BRIDGE_FIELDS = [
    ['Bridge_Name','Bridge Name'],
    ['Bridge_Number','Bridge Number'],
    ['Link_Number','Road Link'],
    ['River_Crossing','River / Crossing'],
    ['Maintenance_Station','Maintenance Station'],
    ['Maintenance_Region','Region'],
    ['Structure_Type','Structure Type'],
    ['Deck_Condition_Rating','Deck Condition'],
    ['Bridge_Condition_Score','Condition Score', v=>fmtNum(v,1)],
    ['Year_Constructed','Year Constructed', v=>String(v)],
  ];
  const CULVERT_FIELDS = [
    ['Culvert_Number','Culvert Number'],
    ['Link_Number','Road Link'],
    ['Culvert_Structure_Type','Structure Type'],
    ['Span_Diameter_m','Span / Diameter', v=>fmtNum(v,2)+' m'],
    ['Cell_Count','Cell Count'],
    ['Maintenance_Station','Maintenance Station'],
    ['Maintenance_Region','Region'],
    ['Scour_Risk_Rating','Scour Risk Rating'],
    ['Hydraulic_Capacity_Ratio','Hydraulic Capacity Ratio', v=>fmtNum(v,2)],
  ];

  // ---------------------------------------------------------------- catalog
  // color: a NEON accent for this layer's line/marker style (cycled — 21
  // real layers share an 8-color accent palette by design).
  const LAYERS = [
    { id:'network', label:'National Road Network', unit:'links', loader: DataStore.network, type:'line', defaultOn:true, popup:'network' },
    { id:'bridges', label:'Bridges', unit:'bridges', loader: DataStore.bridgesGeo, color:NEON[1], type:'point', radius:5, popup:'bridge' },
    { id:'culverts', label:'Major Culverts', unit:'culverts', loader: DataStore.culvertsGeo, color:NEON[2], type:'point', radius:4, popup:'culvert' },
    { id:'weighbridges', label:'Weighbridges', unit:'weighbridges', loader: DataStore.weighbridges, color:NEON[3], type:'point', radius:6, popup:'generic' },
    { id:'mowt_stations', label:'MoWT National Roads Stations', unit:'stations', loader: ()=>DataStore.getJSON('geo/mowt_stations.geojson'), color:NEON[4], type:'point', radius:4, popup:'generic' },
    { id:'ducar', label:'DUCAR Road Network', unit:'road segments', loader: DataStore.ducarRoads, color:NEON[0], type:'line', lazy:true, warn:'~9 MB', popup:'generic' },
    { id:'oprc', label:'OPRC Contract Lots', unit:'lot segments', loader: DataStore.oprcContracts, color:NEON[5], type:'line', weight:4, popup:'generic' },
    { id:'ndpiv', label:'NDP IV Investment Projects', unit:'project segments', loader: DataStore.ndpivProjects, color:NEON[6], type:'line', weight:4, popup:'generic' },
    { id:'districts', label:'UBOS Districts', unit:'districts', loader: DataStore.districts, color:NEON[7], type:'polygon', popup:'generic' },
    { id:'maint_regions', label:'Maintenance Regions', unit:'regions', loader: DataStore.maintRegions, color:NEON[0], type:'polygon', fillOpacity:0.06, weight:2, popup:'generic' },
    { id:'parishes', label:'Parishes', unit:'parishes', loader: ()=>DataStore.getJSON('geo/parishes.geojson'), color:NEON[1], type:'polygon', lazy:true, warn:'~6.8 MB', fillOpacity:0.06, popup:'generic' },
    { id:'towns', label:'Towns & Trading Centres', unit:'places', loader: DataStore.towns, color:NEON[2], type:'point', radius:3, popup:'generic' },
    { id:'protected_areas', label:'Protected Areas', unit:'areas', loader: DataStore.protectedAreas, color:NEON[3], type:'polygon', popup:'generic' },
    { id:'forest_reserves', label:'Forest Reserves', unit:'reserves', loader: DataStore.forestReserves, color:NEON[4], type:'polygon', popup:'generic' },
    { id:'wetlands', label:'Wetlands', unit:'wetlands', loader: DataStore.wetlands, color:NEON[5], type:'polygon', fillOpacity:0.10, popup:'generic' },
    { id:'gazetted', label:'Gazetted Areas', unit:'areas', loader: DataStore.gazettedAreas, color:NEON[6], type:'polygon', popup:'generic' },
    { id:'airports', label:'Airports & Airstrips', unit:'airfields', loader: DataStore.airports, color:NEON[7], type:'point', radius:6, popup:'generic' },
    { id:'ferry', label:'Ferry Crossings', unit:'crossings', loader: DataStore.ferryCrossings, color:NEON[0], type:'point', radius:6, popup:'generic' },
    { id:'traffic_stations', label:'Traffic Count Stations', unit:'stations', loader: DataStore.trafficStations, color:NEON[1], type:'point', radius:4, popup:'generic' },
    { id:'kampala_incidents', label:'Kampala Traffic Incidents', unit:'incidents', loader: DataStore.kampalaIncidents, color:NEON[2], type:'point', radius:3, popup:'generic' },
    { id:'ducar_condition', label:'DUCAR District Condition Summary', unit:'districts', loader: DataStore.ducarConditionSummary, color:NEON[3], type:'polygon', popup:'generic' },
    { id:'field_verification', label:'Field Verification Points', unit:'site visits', loader: DataStore.fieldVerification, color:NEON[4], type:'point', radius:6, popup:'generic' },
  ];

  const GROUPS = [
    { title:'Network & Structures', ids:['network','bridges','culverts','weighbridges','mowt_stations','ducar'] },
    { title:'Investment & Contracts', ids:['oprc','ndpiv'] },
    { title:'Boundaries & Places', ids:['districts','maint_regions','parishes','towns'] },
    { title:'Land & Environment', ids:['protected_areas','forest_reserves','wetlands','gazetted'] },
    { title:'Monitoring & Facilities', ids:['airports','ferry','traffic_stations','kampala_incidents','ducar_condition','field_verification'] },
  ];

  // link_id -> real link name (used by network/bridge/culvert popups and any
  // generic layer whose properties happen to carry a raw link id/number).
  const linkMap = await DataStore.linkNameMap();

  function popupHtmlFor(def, feature){
    const props = feature.properties || {};
    const title = def.id==='network' ? (props['Link Name']||'Road Link')
      : def.id==='bridges' ? (props['Bridge_Name']||'Bridge')
      : def.id==='culverts' ? ('Culvert '+(props['Culvert_Number']||''))
      : pickTitle(props, def.label);
    if(def.popup==='network') return curatedPopupHtml(title, props, NETWORK_FIELDS, linkMap);
    if(def.popup==='bridge') return curatedPopupHtml(title, props, BRIDGE_FIELDS, linkMap);
    if(def.popup==='culvert') return curatedPopupHtml(title, props, CULVERT_FIELDS, linkMap);
    return genericPopupHtml(title, props, linkMap);
  }

  function buildLeafletLayer(def, data){
    const opts = { onEachFeature:(feature, lyr) => lyr.bindPopup(popupHtmlFor(def, feature)) };
    if(def.type==='point'){
      opts.pointToLayer = (feature, latlng) => L.circleMarker(latlng, {
        radius: def.radius||5, weight:1.2, color:'#ffffff', fillColor: def.color, fillOpacity:0.9
      });
    } else if(def.type==='line'){
      if(def.id==='network'){
        // Default-on national network: colored by Pavement Class (paved vs unpaved) —
        // a simple, correct, real-data-driven style rather than a fancy scheme.
        opts.style = feature => ({
          color: feature.properties['Pavement Class']==='Paved' ? '#2979ff' : '#ff7a00',
          weight: 2.4, opacity: 0.85
        });
      } else {
        opts.style = { color: def.color, weight: def.weight||2, opacity:0.8 };
      }
    } else { // polygon
      opts.style = { color: def.color, weight:1, fillColor: def.color, fillOpacity: def.fillOpacity!==undefined?def.fillOpacity:0.14 };
    }
    return L.geoJSON(data, opts);
  }

  // ---------------------------------------------------------------- toggling
  const layerCache = {}; // id -> Leaflet layer (built once, reused)
  const rowRefs = {};    // id -> {statusEl, checkbox}

  async function setLayerOn(def){
    const ref = rowRefs[def.id];
    ref.statusEl.textContent = 'Loading…';
    ref.statusEl.style.color = 'var(--text-tertiary)';
    try{
      let layer = layerCache[def.id];
      if(!layer){
        const data = await def.loader();
        layer = buildLeafletLayer(def, data);
        layer.__count = (data.features||[]).length;
        layerCache[def.id] = layer;
      }
      layer.addTo(map);
      ref.statusEl.textContent = fmtNum(layer.__count) + ' ' + def.unit;
    }catch(err){
      console.error('Layer failed to load:', def.id, err);
      ref.statusEl.textContent = 'Failed to load';
      ref.statusEl.style.color = 'var(--status-poor, #c0392b)';
      ref.checkbox.checked = false;
    }
  }
  function setLayerOff(def){
    const layer = layerCache[def.id];
    if(layer && map.hasLayer(layer)) map.removeLayer(layer);
    const ref = rowRefs[def.id];
    ref.statusEl.textContent = def.lazy ? ('Not loaded · '+def.warn) : '';
  }

  function layerRow(def){
    const row = el('div',{style:'display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--bg-subtle);'});
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!def.defaultOn;
    cb.style.marginTop = '3px';
    if(def.id!=='network') cb.style.accentColor = def.color;
    const dot = el('span',{class:'dot', style:`background:${def.id==='network'?'#2979ff':def.color};margin-top:6px;flex-shrink:0;`});
    const statusEl = el('div',{class:'tiny-muted'}, def.lazy ? ('Not loaded · '+def.warn) : (def.defaultOn ? 'Loading…' : ''));
    const labelWrap = el('div',{style:'flex:1;min-width:0;'},[
      el('div',{style:'font-size:.8rem;font-weight:600;'}, def.label),
      statusEl
    ]);
    row.appendChild(cb); row.appendChild(dot); row.appendChild(labelWrap);
    rowRefs[def.id] = { statusEl, checkbox: cb };
    cb.addEventListener('change', ()=>{
      if(cb.checked) setLayerOn(def); else setLayerOff(def);
    });
    labelWrap.style.cursor = 'pointer';
    labelWrap.addEventListener('click', ()=>{ cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); });
    return row;
  }

  GROUPS.forEach(g=>{
    panel.appendChild(el('div',{style:'font-size:.66rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-tertiary);margin:14px 0 2px;'}, g.title));
    g.ids.forEach(id=>{
      const def = LAYERS.find(l=>l.id===id);
      if(def) panel.appendChild(layerRow(def));
    });
  });

  // Load the default-on National Road Network layer immediately.
  const networkDef = LAYERS.find(l=>l.id==='network');
  await setLayerOn(networkDef);

  // Leaflet sizes itself against its container at construction time; the
  // section may still be settling its flex layout, so re-measure shortly after.
  setTimeout(()=> map.invalidateSize(), 150);
  setTimeout(()=> map.invalidateSize(), 600);
};
