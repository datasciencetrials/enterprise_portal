// Network Universe — the Road Management System staged as a solar system.
// RMS sits at the centre; its 8 subsystems orbit as planets. Every figure
// shown in the side panel is fetched live through DataStore, from the exact
// same real data files the rest of this platform uses — nothing here is
// decorative or invented.

RENDERERS.universe = async function(container){
  container.innerHTML = '';
  container.appendChild(pageHead(
    'Network Universe',
    'The Road Management System staged as a solar system — RMS at the centre, its 8 subsystems orbiting as planets. Click one to inspect it: every figure in the panel is real, pulled live from this platform’s own data.',
    '8 subsystems'
  ));

  const wrap = el('div',{class:'universe-wrap'});
  const stage = el('div',{class:'universe-stage'});
  const hud = el('div',{class:'universe-hud card card-pad'});
  wrap.appendChild(stage);
  wrap.appendChild(hud);
  container.appendChild(wrap);

  if(typeof THREE === 'undefined'){
    stage.appendChild(el('div',{class:'callout warn'}, 'The 3D engine did not load — try refreshing the page.'));
    return;
  }

  // ---- subsystem definitions: every load() fetches this platform's real data files ----
  const SUBSYSTEMS = [
    { id:'pms', label:'PMS — Pavement Management', short:'PMS', icon:'🛣️', accent:'#00e5ff',
      sectionId:'maintenance', sectionLabel:'Maintenance & Condition',
      radius:5.0, speed:0.16, size:0.62,
      load: async()=>{
        const s = await DataStore.networkStats();
        return { kpis:[
          {label:'Total Network', value:fmtNum(s.totalKm,0), unit:'km', accent:'#00e5ff'},
          {label:'Paved', value:fmtNum(s.pavedKm,0), unit:'km', accent:'#00ff85'},
          {label:'Unpaved', value:fmtNum(s.unpavedKm,0), unit:'km', accent:'#ff7a00'},
        ], note:'Computed live from the platform’s GIS road-network inventory.' };
      }
    },
    { id:'tis', label:'TIS — Traffic Information', short:'TIS', icon:'🚦', accent:'#ff00c8',
      sectionId:'map', sectionLabel:'National GIS Map',
      radius:6.2, speed:0.13, size:0.50,
      load: async()=>{
        const [stations, comp] = await Promise.all([DataStore.trafficStations(), DataStore.trafficComposition()]);
        return { kpis:[
          {label:'Traffic Count Stations', value:fmtNum(stations.features.length,0), accent:'#ff00c8'},
          {label:'Motorised Veh/Day', value:fmtNum(comp.meta.total_motorised_veh_per_day,0), accent:'#00e5ff'},
          {label:'Non-Motorised Veh/Day', value:fmtNum(comp.meta.total_nonmotorised_veh_per_day,0), accent:'#fff500'},
        ], note:comp.meta.note };
      }
    },
    { id:'bms', label:'BMS — Bridge Management', short:'BMS', icon:'🌉', accent:'#9d00ff',
      sectionId:'structures', sectionLabel:'Bridges & Culverts',
      radius:7.4, speed:0.10, size:0.58,
      load: async()=>{
        const ms = await DataStore.msSummary();
        const byType = {}; (ms.structures_summary||[]).forEach(r=> byType[r.structure_type]=r);
        const br = byType['Bridges']||{}, cu = byType['Major culverts']||{};
        return { kpis:[
          {label:'Bridges', value:fmtNum(br.count,0), accent:'#9d00ff'},
          {label:'Major Culverts', value:fmtNum(cu.count,0), accent:'#ff2d78'},
          {label:'Bridge Asset Value', value:fmtNum(br.asset_value_mn_usd,0), unit:'USD mn', accent:'#00e5ff'},
          {label:'Culvert Asset Value', value:fmtNum(cu.asset_value_mn_usd,0), unit:'USD mn', accent:'#00ff85'},
        ], note:'Bridges and major culverts are always reported as separate figures on this platform, never merged into one.' };
      }
    },
    { id:'ducar', label:'DUCAR — District Roads', short:'DUCAR', icon:'🏘️', accent:'#00ff85',
      sectionId:'ducar', sectionLabel:'DUCAR Network',
      radius:8.6, speed:0.085, size:0.54,
      load: async()=>{
        const [roads, cond] = await Promise.all([DataStore.ducarRoads(), DataStore.ducarConditionSummary()]);
        return { kpis:[
          {label:'DUCAR Road Segments', value:fmtNum(roads.features.length,0), accent:'#00ff85'},
          {label:'District Condition Summaries', value:fmtNum(cond.features.length,0), accent:'#00e5ff'},
        ] };
      }
    },
    { id:'invest', label:'Investment & Budgets', short:'IBP', icon:'💰', accent:'#fff500',
      sectionId:'investment', sectionLabel:'Investment Plan',
      radius:9.8, speed:0.07, size:0.60,
      load: async()=>{
        const [ibp, ms] = await Promise.all([DataStore.ibpProjects(), DataStore.msSummary()]);
        const years = ibp.years||[]; const latest = years[years.length-1];
        const y = (ibp.summary_by_year||{})[latest] || {};
        return { kpis:[
          {label:latest+' Road Projects', value:fmtNum(y.road_projects,0), accent:'#fff500'},
          {label:latest+' Combined Value', value:fmtNum(y.combined_value_bn_ushs,1), unit:'UGX bn', accent:'#ff7a00'},
          {label:'Total Network Asset Value', value:fmtNum(ms.kpi_summary.total_asset_value_mn_usd,0), unit:'USD mn', accent:'#00e5ff'},
        ], note:'From the Integrated Bank of Projects (Ministry of Finance, Planning and Economic Development) and the platform’s own asset-value model.' };
      }
    },
    { id:'wim', label:'WIM — Weighbridge Compliance', short:'WIM', icon:'⚖️', accent:'#ff7a00',
      sectionId:'map', sectionLabel:'National GIS Map',
      radius:11.0, speed:0.055, size:0.46,
      load: async()=>{
        const [wb, cov] = await Promise.all([DataStore.weighbridges(), DataStore.weighbridgeDistrictCoverage()]);
        const districtSet = new Set();
        (cov.by_weighbridge||[]).forEach(w=> (w.districts||[]).forEach(d=>districtSet.add(d)));
        return { kpis:[
          {label:'Weighbridge Stations', value:fmtNum(wb.features.length,0), accent:'#ff7a00'},
          {label:'Enforcement Weighbridges', value:fmtNum(cov.meta.weighbridge_count,0), accent:'#9d00ff'},
          {label:'Districts in Catchment', value:fmtNum(districtSet.size,0), accent:'#00e5ff'},
        ], note:cov.meta.note };
      }
    },
    { id:'socio', label:'Socio-Economic & Climate', short:'S-E', icon:'🌍', accent:'#2979ff',
      sectionId:'socioeconomic', sectionLabel:'Socio-Economic & Climate',
      radius:12.2, speed:0.045, size:0.56,
      load: async()=>{
        const [ndpiv, forest, wet, prot] = await Promise.all([DataStore.ndpivProjects(), DataStore.forestReserves(), DataStore.wetlands(), DataStore.protectedAreas()]);
        return { kpis:[
          {label:'NDP IV Investment Projects', value:fmtNum(ndpiv.features.length,0), accent:'#2979ff'},
          {label:'Forest Reserves', value:fmtNum(forest.features.length,0), accent:'#00ff85'},
          {label:'Wetlands', value:fmtNum(wet.features.length,0), accent:'#00e5ff'},
          {label:'Protected Areas', value:fmtNum(prot.features.length,0), accent:'#fff500'},
        ] };
      }
    },
    { id:'std', label:'Standards & Data Model', short:'STD', icon:'📐', accent:'#ff2d78',
      sectionId:'standards', sectionLabel:'Standards & Data Model',
      radius:13.4, speed:0.038, size:0.44,
      load: async()=>{
        const [oprc, ms] = await Promise.all([DataStore.oprcContracts(), DataStore.msSummary()]);
        return { kpis:[
          {label:'OPRC Contracts', value:fmtNum(oprc.features.length,0), accent:'#ff2d78'},
          {label:'Priority Planned Links', value:fmtNum(ms.counts.priority_planned_links,0), accent:'#9d00ff'},
        ] };
      }
    },
  ];

  // ---- legend / keyboard-and-touch-friendly picker (mirrors the 3D click) ----
  const legend = el('div',{class:'universe-legend'});
  legend.appendChild((()=>{ const b=el('button',{class:'universe-chip universe-chip-sun', type:'button'},[el('span',{},'☀️'),' RMS']); b.addEventListener('click',()=>selectSubsystem(null)); return b; })());
  SUBSYSTEMS.forEach(def=>{
    const chip = el('button',{class:'universe-chip', type:'button', style:`--accent:${def.accent}`},[el('span',{},def.icon), ' '+def.short]);
    chip.addEventListener('click', ()=> selectSubsystem(def));
    legend.appendChild(chip);
  });
  container.appendChild(legend);

  // ---- three.js scene ----
  let renderer, scene, camera, controls, animId = null, selectedId = 'rms';
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const planetMeshes = [];
  const labelsLayer = el('div',{class:'universe-labels'});
  let sunMesh, sunLabel;

  function initScene(){
    const width = stage.clientWidth || 800, height = 560;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, width/height, 0.1, 300);
    camera.position.set(0, 13, 22);
    renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    stage.appendChild(renderer.domElement);
    stage.appendChild(labelsLayer);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = 55;
    controls.maxPolarAngle = Math.PI * 0.49;

    sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32), new THREE.MeshBasicMaterial({color:0xfff500}));
    scene.add(sunMesh);
    sunLabel = el('div',{class:'universe-label universe-label-sun'},[el('span',{},'☀️'), el('span',{},'RMS')]);
    labelsLayer.appendChild(sunLabel);

    SUBSYSTEMS.forEach(def=>{
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.size, 28, 28), new THREE.MeshBasicMaterial({color:new THREE.Color(def.accent)}));
      scene.add(mesh);

      const pts = [];
      for(let i=0;i<=64;i++){ const a = i/64*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*def.radius, 0, Math.sin(a)*def.radius)); }
      const ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({color:new THREE.Color(def.accent), transparent:true, opacity:0.25})
      );
      scene.add(ring);

      const label = el('div',{class:'universe-label'},[el('span',{},def.icon), el('span',{},def.short)]);
      label.style.setProperty('--accent', def.accent);
      labelsLayer.appendChild(label);

      planetMeshes.push({mesh, def, angle:Math.random()*Math.PI*2, labelEl:label});
    });

    renderer.domElement.addEventListener('click', onCanvasClick);
    window.addEventListener('resize', onResize);
  }

  function onCanvasClick(ev){
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX-rect.left)/rect.width)*2-1;
    mouse.y = -((ev.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([sunMesh, ...planetMeshes.map(p=>p.mesh)]);
    if(!hits.length) return;
    const hit = hits[0].object;
    if(hit===sunMesh) selectSubsystem(null);
    else { const found = planetMeshes.find(p=>p.mesh===hit); if(found) selectSubsystem(found.def); }
  }

  function onResize(){
    if(!document.body.contains(stage)){ window.removeEventListener('resize', onResize); return; }
    const width = stage.clientWidth || 800, height = 560;
    camera.aspect = width/height; camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function selectSubsystem(def){
    selectedId = def ? def.id : 'rms';
    legend.querySelectorAll('.universe-chip').forEach(c=>c.classList.remove('active'));
    const idx = def ? SUBSYSTEMS.findIndex(s=>s.id===def.id)+1 : 0;
    const chipEls = legend.querySelectorAll('.universe-chip');
    if(chipEls[idx]) chipEls[idx].classList.add('active');
    renderHud(def);
  }

  function renderHud(def){
    hud.innerHTML = '';
    if(!def){
      hud.appendChild(el('div',{class:'universe-hud-head'},[el('span',{class:'universe-hud-icon'},'☀️'), el('h3',{},'RMS — Road Management System')]));
      const loading = el('div',{class:'muted'},'Loading live system snapshot…');
      hud.appendChild(loading);
      DataStore.msSummary().then(ms=>{
        loading.remove();
        hud.appendChild(kpiGrid([
          {label:'Total Network', value:fmtNum(ms.kpi_summary.total_network_km,0), unit:'km', accent:'#fff500'},
          {label:'Total Asset Value', value:fmtNum(ms.kpi_summary.total_asset_value_mn_usd,0), unit:'USD mn', accent:'#00e5ff'},
          {label:'Bridges', value:fmtNum(ms.kpi_summary.total_bridges,0), accent:'#9d00ff'},
          {label:'Major Culverts', value:fmtNum(ms.kpi_summary.total_major_culverts,0), accent:'#ff2d78'},
        ]));
        hud.appendChild(el('p',{class:'footnote', style:'margin-top:10px;'}, 'System-wide snapshot, computed live from this platform’s own asset-value model. Click a planet to drill into its subsystem.'));
      }).catch(()=>{ loading.remove(); hud.appendChild(el('div',{class:'callout warn'},'Could not load the live snapshot.')); });
      return;
    }
    hud.appendChild(el('div',{class:'universe-hud-head'},[el('span',{class:'universe-hud-icon'},def.icon), el('h3',{},def.label)]));
    const loading = el('div',{class:'muted'},'Loading live data…');
    hud.appendChild(loading);
    def.load().then(res=>{
      loading.remove();
      hud.appendChild(kpiGrid(res.kpis));
      if(res.note) hud.appendChild(el('p',{class:'footnote', style:'margin-top:10px;'}, res.note));
      if(def.sectionId){
        const btn = el('button',{class:'universe-open-btn', type:'button'}, 'Open '+def.sectionLabel+' →');
        btn.addEventListener('click', ()=> navigate(def.sectionId));
        hud.appendChild(btn);
      }
    }).catch(err=>{
      console.error(err);
      loading.remove();
      hud.appendChild(el('div',{class:'callout warn'},'This subsystem’s live data could not be loaded right now.'));
    });
  }

  function animate(){
    if(!document.body.contains(stage)){ try{ controls.dispose(); renderer.dispose(); }catch(e){} return; }
    animId = requestAnimationFrame(animate);
    planetMeshes.forEach(p=>{
      p.angle += p.def.speed*0.01;
      p.mesh.position.set(Math.cos(p.angle)*p.def.radius, 0, Math.sin(p.angle)*p.def.radius);
      const target = (selectedId===p.def.id) ? 1.35 : 1.0;
      const s = THREE.MathUtils.lerp(p.mesh.scale.x||1, target, 0.15);
      p.mesh.scale.setScalar(s);
    });
    const sunTarget = (selectedId==='rms') ? 1.15 : 1.0;
    sunMesh.scale.setScalar(THREE.MathUtils.lerp(sunMesh.scale.x||1, sunTarget, 0.15));
    sunMesh.rotation.y += 0.002;
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
  }

  function updateLabels(){
    const rect = renderer.domElement.getBoundingClientRect();
    function project(obj, labelEl){
      const v = obj.position.clone().project(camera);
      const inFront = v.z < 1;
      labelEl.style.display = inFront ? 'flex' : 'none';
      if(inFront){
        labelEl.style.left = ((v.x*0.5+0.5)*rect.width)+'px';
        labelEl.style.top = ((-v.y*0.5+0.5)*rect.height)+'px';
      }
    }
    planetMeshes.forEach(p=> project(p.mesh, p.labelEl));
    project(sunMesh, sunLabel);
  }

  try{
    initScene();
    selectSubsystem(null);
    animate();
  }catch(err){
    console.error(err);
    stage.innerHTML = '';
    stage.appendChild(el('div',{class:'callout warn'}, 'The 3D visualization failed to initialize in this browser.'));
  }
};
