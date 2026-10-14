// Humanoid astronaut crews standing on each planet's surface, suit-trimmed to that subsystem's
// color, low-gravity hop locomotion (g < 0.8, rate ~ sqrt(g) per the platform spec). One shared
// InstancedMesh per body part across every planet — cheap regardless of how many planets/crew exist.

const Astronauts = (() => {
  const CREW_PER_PLANET = 6;
  const BASE_HOP_HEIGHT = 0.22;
  const BASE_HOP_FREQ = 1.6;

  function buildGeometrySet(THREE){
    // CapsuleGeometry isn't available in the vendored three.js build (added upstream well after
    // the revision this platform pins) — a rounded cylinder gives the same suited-torso silhouette
    // for an instanced low-poly figure.
    return {
      body: new THREE.CylinderGeometry(0.1, 0.11, 0.34, 8, 1, false),
      helmet: new THREE.SphereGeometry(0.13, 12, 12),
      visor: new THREE.CircleGeometry(0.09, 12),
      backpack: new THREE.BoxGeometry(0.14, 0.18, 0.08),
    };
  }

  // A deterministic point on a unit sphere, stable across reloads for a given (planetIndex, i).
  function seededSpherePoint(seed){
    const rnd = (n) => { const x = Math.sin(seed * 999 + n * 57.13) * 43758.5453; return x - Math.floor(x); };
    const u = rnd(1), v = rnd(2);
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    return new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi));
  }

  function buildCrews(THREE, planetRefs, planetsConfig){
    const geo = buildGeometrySet(THREE);
    const totalCount = planetsConfig.length * CREW_PER_PLANET;

    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xE8ECF2, roughness: 0.2, metalness: 0.3 });
    const visorMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissiveIntensity: 1, roughness: 0.1 });
    visorMat.emissive = new THREE.Color(0xffffff);
    // Vertex-colored emissive isn't native to MeshStandardMaterial — approximated via instanceColor
    // above instead of a shader override, so onBeforeCompile is left at its default (three.js reads
    // it via .toString() to build the program cache key, so it must never be set to null/undefined).

    const bodyMesh = new THREE.InstancedMesh(geo.body, bodyMat, totalCount);
    const helmetMesh = new THREE.InstancedMesh(geo.helmet, helmetMat, totalCount);
    const visorMesh = new THREE.InstancedMesh(geo.visor, visorMat, totalCount);
    bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(totalCount * 3), 3);
    visorMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(totalCount * 3), 3);

    const crewState = [];
    const dummy = new THREE.Object3D();
    let idx = 0;

    planetsConfig.forEach((p, pi) => {
      const bodyGroup = planetRefs[p.id].bodyGroup;
      const trim = new THREE.Color(p.color);
      for (let i = 0; i < CREW_PER_PLANET; i++) {
        const normal = seededSpherePoint(pi * 100 + i);
        const surfacePos = normal.clone().multiplyScalar(p.size + 0.02);
        crewState.push({
          index: idx, planetId: p.id, bodyGroup, normal, surfacePos,
          gravity: p.gravity, phase: Math.random() * Math.PI * 2,
          wanderPhase: Math.random() * Math.PI * 2,
        });
        bodyMesh.setColorAt(idx, trim);
        visorMesh.setColorAt(idx, trim);
        idx++;
      }
    });

    bodyMesh.instanceMatrix.needsUpdate = true;
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    if (visorMesh.instanceColor) visorMesh.instanceColor.needsUpdate = true;

    return { bodyMesh, helmetMesh, visorMesh, crewState, dummy };
  }

  function update(THREE, crews, dt, elapsed){
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();

    crews.crewState.forEach(c => {
      const hopHeight = BASE_HOP_HEIGHT / Math.sqrt(Math.max(c.gravity, 0.1));
      const hopFreq = BASE_HOP_FREQ * Math.sqrt(Math.max(c.gravity, 0.1));
      const hop = Math.abs(Math.sin(elapsed * hopFreq + c.phase)) * hopHeight;

      // small wander around the seeded home point, tangent to the sphere
      const wanderAmt = 0.06 * Math.sin(elapsed * 0.3 + c.wanderPhase);
      const tangent = new THREE.Vector3(-c.normal.z, 0, c.normal.x).normalize();
      const pos = c.surfacePos.clone().addScaledVector(tangent, wanderAmt).addScaledVector(c.normal, hop);

      q.setFromUnitVectors(up, c.normal);

      crews.dummy.position.copy(pos);
      crews.dummy.quaternion.copy(q);
      crews.dummy.scale.setScalar(1);
      crews.dummy.updateMatrix();
      crews.bodyMesh.setMatrixAt(c.index, crews.dummy.matrix);

      crews.dummy.position.copy(pos).addScaledVector(c.normal, 0.16);
      crews.dummy.updateMatrix();
      crews.helmetMesh.setMatrixAt(c.index, crews.dummy.matrix);

      crews.dummy.position.copy(pos).addScaledVector(c.normal, 0.16).addScaledVector(tangent, 0.001);
      crews.dummy.lookAt(crews.dummy.position.clone().add(c.normal));
      crews.dummy.updateMatrix();
      crews.visorMesh.setMatrixAt(c.index, crews.dummy.matrix);
    });

    crews.bodyMesh.instanceMatrix.needsUpdate = true;
    crews.helmetMesh.instanceMatrix.needsUpdate = true;
    crews.visorMesh.instanceMatrix.needsUpdate = true;
  }

  return { CREW_PER_PLANET, buildCrews, update };
})();
