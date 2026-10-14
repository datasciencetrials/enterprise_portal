// RMS Gravitational Sun Core + 8 orbiting subsystem planets.
// Bi-directional particle streams: LRS data flows into the Sun, treatment allocations radiate back out.
// Geometry/orbits are illustrative; every number shown in the HUD (js/solar-system/hud.js) comes from
// DataStore, never from this file — this module only owns the 3D staging.

const SolarSystem = (() => {
  // feeds/receives: the bi-directional interlink narrative each subsystem exchanges with the RMS
  // Sun Core, as reported by DNR-MOWT engineering staff. Kept separate from the live-computed
  // metrics rendered in js/sections/universe.js — those come straight from DataStore; these are
  // stated subsystem context, not this platform's own live KPIs.
  const PLANETS = [
    { id:'pms',    name:'PMS',      full:'Pavement Management System',        body:'Mercury', color:0xFFB300, orbit:9.0,  size:0.62, speed:0.62, gravity:0.34, moon:null,
      feeds: 'PyTorch CNN defect model (99.85% accuracy across 15.12M survey images), PCI 86.2, IRI 2.71 m/km',
      receives: 'Master link-node LRS chainages & WGS84 coordinates' },
    { id:'tis',    name:'TIS',      full:'Traffic Information System',        body:'Venus',   color:0x00E5FF, orbit:12.5, size:0.95, speed:0.46, gravity:0.44, moon:null,
      feeds: 'Automated Traffic Counter (ATC) counts, axle load spectra, 8 WIM weighbridges (99.1% compliance)',
      receives: 'Heavy vehicle corridor load limits' },
    { id:'bms',    name:'BMS',      full:'Bridge Management System',          body:'Terra',   color:0x00E676, orbit:16.0, size:1.00, speed:0.40, gravity:0.55, moon:{ name:'Moon',    size:0.27, dist:1.7, color:0xCFD8DC },
      feeds: '450 inspected bridges & major culverts, 96.2% structural safety index (New Jinja 9.2/10)',
      receives: 'River crossing LRS chainage positions' },
    { id:'socio',  name:'NDP IV',   full:'Socio-Economic & NDP IV',           body:'Mars',    color:0xFF6D00, orbit:19.5, size:0.72, speed:0.33, gravity:0.30, moon:null,
      feeds: '135-district feeder network (15,000 km), 18.4% EIRR, agricultural trade corridor access',
      receives: 'National network connectivity topology' },
    { id:'budget', name:'Budgets',  full:'Budgets & LCCA',                    body:'Jupiter', color:0xFFD700, orbit:25.0, size:1.90, speed:0.22, gravity:0.72, moon:{ name:'Europa',  size:0.32, dist:2.6, color:0xE8D9B5 },
      feeds: 'Condition-adjusted replacement asset valuation, MYFP 5-tier maintenance triggers',
      receives: 'Long-term pavement condition decay trajectories' },
    { id:'lidar',  name:'LiDAR',    full:'Geospatial LiDAR & Remote Sensing', body:'Saturn',  color:0xD500F9, orbit:31.0, size:1.70, speed:0.17, gravity:0.65, moon:{ name:'Titan',   size:0.38, dist:2.8, color:0xE0A85C }, ring:true,
      feeds: '4,800 km² drone LiDAR (0.05 m DEM point clouds), InSAR radar surface subsidence (0.12 mm/yr)',
      receives: '60 m road reserve cadastral boundaries' },
    { id:'piarc',  name:'PIARC',    full:'Global Benchmarks & PIARC',         body:'Uranus',  color:0x1DE9B6, orbit:36.0, size:1.40, speed:0.13, gravity:0.48, moon:{ name:'Titania', size:0.24, dist:2.3, color:0xB9C6D6 },
      feeds: 'PIARC World Road Association standards, World Bank RMI metrics, AASHTO guidelines, climate-resilient specs (NZ, UK, South Africa, Japan)',
      receives: 'DNR-MOWT national performance data for global cross-benchmarking' },
    { id:'pims',   name:'PIMS',     full:'PIMS Projects & Public Investment', body:'Neptune', color:0x2979FF, orbit:41.0, size:1.35, speed:0.10, gravity:0.60, moon:{ name:'Triton',  size:0.26, dist:2.2, color:0x9FD8E0 },
      feeds: 'NDP IV capital project pipeline, PIMS gatekeeper clearance, donor-funded corridors (World Bank, AfDB, JICA)',
      receives: 'Priority MYFP capital interventions & condition-adjusted asset replacement values' },
  ];

  const SUN_COLOR = 0xFFFFFF;
  const STREAM_COUNT_PER_PLANET = 22;

  function makeLabelSprite(THREE, text, color){
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10,12,20,0.72)';
    ctx.beginPath(); ctx.roundRect(0, 8, 256, 48, 12); ctx.fill();
    ctx.font = '700 26px Inter, sans-serif';
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(3.2, 0.8, 1);
    return sprite;
  }

  function orbitRing(THREE, radius, color){
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
    const points = curve.getPoints(128).map(p => new THREE.Vector3(p.x, 0, p.y));
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.22 });
    return new THREE.LineLoop(geo, mat);
  }

  // Bidirectional stream: half the particles run planet->sun (ingested LRS data), half sun->planet
  // (treatment allocations radiating out). Each particle is a phase [0,1] along the straight line
  // between the two bodies, colored by direction.
  function buildStream(THREE, color){
    const count = STREAM_COUNT_PER_PLANET;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const dir = new Float32Array(count); // +1 outbound (sun->planet), -1 inbound (planet->sun)
    for (let i = 0; i < count; i++) {
      phase[i] = Math.random();
      dir[i] = i % 2 === 0 ? 1 : -1;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: color, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    points.userData = { phase, dir, count };
    return points;
  }

  function build(THREE, scene){
    const root = new THREE.Group();
    scene.add(root);

    // Sun core = RMS: the Central Linear Referencing System. Wireframe icosahedron over a glowing
    // core reads as "network topology", not a literal star.
    const sunGroup = new THREE.Group();
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(2.3, 32, 32),
      new THREE.MeshStandardMaterial({ color: SUN_COLOR, emissive: SUN_COLOR, emissiveIntensity: 2.2, roughness: 0.3 })
    );
    const sunTopology = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.75, 2),
      new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: true, transparent: true, opacity: 0.35 })
    );
    sunGroup.add(sunCore, sunTopology);
    sunGroup.add(makeLabelSprite(THREE, 'RMS', 0x00E5FF).translateY(3.6));
    root.add(sunGroup);
    const sunLight = new THREE.PointLight(0xffffff, 2.2, 200);
    root.add(sunLight);

    const planetRefs = {};

    PLANETS.forEach(p => {
      root.add(orbitRing(THREE, p.orbit, p.color));

      const pivot = new THREE.Group(); // orbits the sun
      pivot.rotation.y = Math.random() * Math.PI * 2;
      root.add(pivot);

      const bodyGroup = new THREE.Group();
      bodyGroup.position.x = p.orbit;
      pivot.add(bodyGroup);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.size, 24, 24),
        new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.15 })
      );
      bodyGroup.add(mesh);

      if (p.ring) {
        const ringGeo = new THREE.RingGeometry(p.size * 1.4, p.size * 2.1, 48);
        const ringMat = new THREE.MeshBasicMaterial({ color: p.color, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2.4;
        bodyGroup.add(ringMesh);
      }

      let moonMesh = null;
      if (p.moon) {
        moonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(p.moon.size, 16, 16),
          new THREE.MeshStandardMaterial({ color: p.moon.color, roughness: 0.8 })
        );
        moonMesh.position.x = p.size + p.moon.dist;
        bodyGroup.add(moonMesh);
      }

      const label = makeLabelSprite(THREE, p.name, p.color);
      label.position.y = p.size + 1.1;
      bodyGroup.add(label);

      const stream = buildStream(THREE, p.color);
      root.add(stream);

      planetRefs[p.id] = { config: p, pivot, bodyGroup, mesh, moonMesh, stream, orbitAngle: pivot.rotation.y };
    });

    return { root, sunGroup, sunTopology, planetRefs };
  }

  function update(THREE, refs, dt, elapsed){
    if (refs.sunTopology) {
      refs.sunTopology.rotation.y += dt * 0.15;
      refs.sunTopology.rotation.x += dt * 0.07;
    }
    if (refs.sunGroup) {
      const pulse = 1 + Math.sin(elapsed * 1.6) * 0.04;
      refs.sunGroup.scale.setScalar(pulse);
    }

    Object.values(refs.planetRefs).forEach(r => {
      const p = r.config;
      r.pivot.rotation.y += dt * p.speed * 0.15;
      r.mesh.rotation.y += dt * 0.4;
      if (r.moonMesh) r.moonMesh.parent.rotation.y += dt * 0.6; // reuses bodyGroup spin for a cheap moon orbit look

      // stream animation: sun is at world origin, planet body position is world-space of bodyGroup
      const worldPos = new THREE.Vector3();
      r.bodyGroup.getWorldPosition(worldPos);
      const posAttr = r.stream.geometry.getAttribute('position');
      const phase = r.stream.userData.phase, dir = r.stream.userData.dir, count = r.stream.userData.count;
      for (let i = 0; i < count; i++) {
        phase[i] += dt * 0.35;
        if (phase[i] > 1) phase[i] -= 1;
        // dir=+1: travels sun(0)->planet(1); dir=-1: travels planet(1)->sun(0), i.e. reverse t
        const t = dir[i] > 0 ? phase[i] : 1 - phase[i];
        const x = worldPos.x * t;
        const y = Math.sin(t * Math.PI) * 0.6; // gentle arc so the two directions are visually distinct
        const z = worldPos.z * t;
        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    });
  }

  return { PLANETS, build, update };
})();
