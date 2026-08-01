import * as B from '@babylonjs/core';
import * as MAT from '@babylonjs/materials';
import { height } from './noise.js';

// Alolan Vulpix — snow fox (white fur, six curled tails, ear crest).
// Built from primitives + FurMaterial shells for fluff.
export function createPlayer(scene, ctx) {
  const root = new B.TransformNode('vulpixRoot', scene);

  // Fur material (white, blue-tinted in shadow via vertexColor handled by material)
  const fur = new MAT.FurMaterial('vulFur', scene);
  fur.furColor = new B.Color3(0.93, 0.95, 0.99);
  fur.furLength = 0.16;
  fur.furAngle = 0.0;
  fur.furDensity = 22;
  fur.furGravity = new B.Vector2(0, -0.06);
  fur.furSpacing = 0.012;
  fur.furSpeed = 900;
  fur.diffuseTexture = null;
  fur.highLevel = true; // softer fur
  fur.backFaceCulling = false;
  // procedural fur strand texture (noise) so shells look like fur, not stacked shells
  const ftex = new B.DynamicTexture('furT', 128, scene, false);
  { const c = ftex.getContext(); const img = c.createImageData(128,128);
    for (let i=0;i<128*128;i++){ const v=Math.random()*255; const o=i*4; img.data[o]=v;img.data[o+1]=v;img.data[o+2]=v;img.data[o+3]=255; }
    c.putImageData(img,0,0); }
  ftex.update(false); ftex.wrapU=ftex.wrapV=B.Texture.WRAP_ADDRESSING;
  fur.diffuseTexture = ftex; fur.furTexture = ftex;

  // inner skin material (slightly warmer, only peeks through)
  const skin = new B.PBRMaterial('vulSkin', scene);
  skin.albedoColor = new B.Color3(0.9, 0.92, 0.96); skin.roughness = 0.8; skin.metallic = 0;

  // --- body ---
  const body = B.MeshBuilder.CreateSphere('vbody', { diameter: 0.62, segments: 12 }, scene);
  body.scaling = new B.Vector3(1.0, 0.78, 1.55); body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.45, 0); body.parent = root;

  // chest ruff (bigger fluff behind head)
  const ruff = B.MeshBuilder.CreateSphere('ruff', { diameter: 0.7, segments: 10 }, scene);
  ruff.scaling = new B.Vector3(1, 0.85, 0.7); ruff.position.set(0, 0.6, 0.18); ruff.parent = root;

  // --- head ---
  const head = B.MeshBuilder.CreateSphere('vhead', { diameter: 0.45, segments: 12 }, scene);
  head.scaling = new B.Vector3(1, 0.92, 1.05); head.position.set(0, 0.72, 0.46); head.parent = root;
  // snout
  const snout = B.MeshBuilder.CreateSphere('snout', { diameter: 0.22, segments: 8 }, scene);
  snout.scaling = new B.Vector3(0.7, 0.6, 1.2); snout.position.set(0, 0.68, 0.66); snout.parent = root;
  // nose
  const nose = B.MeshBuilder.CreateSphere('nose', { diameter: 0.06, segments: 6 }, scene);
  nose.position.set(0, 0.67, 0.78); const noseM = new B.PBRMaterial('noseM', scene);
  noseM.albedoColor = new B.Color3(0.85, 0.4, 0.45); nose.material = noseM; nose.parent = root;
  // eyes (dark)
  for (const s of [-1, 1]) {
    const e = B.MeshBuilder.CreateSphere('eye', { diameter: 0.05, segments: 6 }, scene);
    e.position.set(s * 0.11, 0.76, 0.66);
    const em = new B.PBRMaterial('eyeM', scene); em.albedoColor = new B.Color3(0.02, 0.03, 0.05); em.roughness = 0.2;
    e.material = em; e.parent = root;
  }
  // ears (triangular) with crest tuft
  for (const s of [-1, 1]) {
    const ear = B.MeshBuilder.CreateCylinder('ear', { diameterTop: 0, diameterBottom: 0.12, height: 0.22, tessellation: 4 }, scene);
    ear.position.set(s * 0.13, 0.95, 0.42); ear.rotation.z = s * -0.18; ear.rotation.x = -0.1; ear.parent = root;
  }
  // forehead crest (spiral curl tuft) — a small curved cone
  const crest = B.MeshBuilder.CreateCylinder('crest', { diameterTop: 0, diameterBottom: 0.12, height: 0.26, tessellation: 6 }, scene);
  crest.position.set(0, 1.0, 0.5); crest.rotation.x = -0.5; crest.parent = root;

  // --- legs (animated) ---
  const legs = [];
  const legPos = [[0.16, 0.16, -0.16], [-0.16, 0.16, -0.16], [0.16, 0.16, 0.16], [-0.16, 0.16, 0.16]];
  for (let i = 0; i < 4; i++) {
    const pivot = new B.TransformNode('legP' + i, scene);
    pivot.parent = root;
    pivot.position.set(legPos[i][0], 0.42, legPos[i][2]);
    const leg = B.MeshBuilder.CreateCapsule('leg', { radius: 0.07, height: 0.4, tessellation: 6 }, scene);
    leg.position.set(0, -0.2, 0); leg.parent = pivot;
    const paw = B.MeshBuilder.CreateSphere('paw', { diameter: 0.12, segments: 6 }, scene);
    paw.position.set(0, -0.4, 0.02); paw.parent = pivot;
    legs.push(pivot);
  }

  // --- six curled tails (ribbon tubes along curl path) ---
  const tails = [];
  const tailCount = 6;
  for (let t = 0; t < tailCount; t++) {
    const path = [];
    const a = (t / tailCount - 0.5) * 0.7;
    const baseY = 0.5, baseZ = -0.6;
    for (let k = 0; k <= 12; k++) {
      const f = k / 12;
      // curl: arc up and back
      const curl = f * Math.PI * 1.1;
      const x = a + Math.sin(curl) * 0.08 * (1 - f);
      const y = baseY + Math.sin(curl) * 0.34 - f * 0.05;
      const z = baseZ - (1 - Math.cos(curl)) * 0.18 - f * 0.05;
      path.push(new B.Vector3(x, y, z));
    }
    const tube = B.MeshBuilder.CreateTube('tail' + t, { path, radius: 0.12 * (1), tessellation: 8, cap: B.Mesh.CAP_ALL, updatable: false }, scene);
    // taper radius via scaling? CreateTube radiusFunction:
    tails.push(tube);
    tube.parent = root;
  }

  // collect fur-bearing meshes and furify
  const furMeshes = [body, ruff, head, snout, crest, ...tails.map(t => t)];
  legs.forEach(pivot => { pivot.getChildMeshes().forEach(m => furMeshes.push(m)); });
  furMeshes.forEach(m => { m.material = fur; });
  // eyes/nose keep their own materials
  MAT.FurMaterial.FurifyMesh(body, 28);
  MAT.FurMaterial.FurifyMesh(head, 24);
  MAT.FurMaterial.FurifyMesh(ruff, 30);
  tails.forEach(t => MAT.FurMaterial.FurifyMesh(t, 18));

  // shadow casters
  if (ctx.shadow) furMeshes.forEach(m => ctx.shadow.addShadowCaster(m, true));

  // --- scarf / cloth (Verlet) whips back during surf ---
  const clothSegs = 8, clothW = 5;
  const scarf = B.MeshBuilder.CreateGround('scarf', { width: 0.6, height: 0.5, subdivisions: clothSegs }, scene);
  scarf.position.set(0, 0.74, 0.2); scarf.parent = root; scarf.rotation.x = 0.2;
  const sm = new B.PBRMaterial('scarfM', scene);
  sm.albedoColor = new B.Color3(0.85, 0.2, 0.25); sm.roughness = 0.7; sm.sheen.isEnabled = true; sm.sheen.intensity = 0.6;
  scarf.material = sm;
  if (ctx.shadow) ctx.shadow.addShadowCaster(scarf, true);
  // verlet points (local to root, anchored at top row)
  const sPos = scarf.getVerticesData(B.VertexBuffer.PositionKind).slice();
  const sOld = sPos.slice();
  const sAnchored = [];
  for (let i = 0; i <= clothSegs; i++) sAnchored.push(i * (clothSegs + 1)); // top row anchored
  function updateScarf(dt, wind) {
    const g = 6; const damp = 0.92;
    for (let i = 0; i < sPos.length / 3; i++) {
      if (sAnchored.includes(i)) { sOld[i * 3] = sPos[i * 3]; sOld[i * 3 + 1] = sPos[i * 3 + 1]; sOld[i * 3 + 2] = sPos[i * 3 + 2]; continue; }
      const vx = (sPos[i * 3] - sOld[i * 3]) * damp;
      const vy = (sPos[i * 3 + 1] - sOld[i * 3 + 1]) * damp;
      const vz = (sPos[i * 3 + 2] - sOld[i * 3 + 2]) * damp;
      sOld[i * 3] = sPos[i * 3]; sOld[i * 3 + 1] = sPos[i * 3 + 1]; sOld[i * 3 + 2] = sPos[i * 3 + 2];
      sPos[i * 3] += vx + wind.x * dt;
      sPos[i * 3 + 1] += vy - g * dt * dt;
      sPos[i * 3 + 2] += vz + wind.z * dt;
    }
    scarf.updateVerticesData(B.VertexBuffer.PositionKind, sPos, false, false);
    const n = scarf.getVerticesData(B.VertexBuffer.NormalKind);
    scarf.updateVerticesData(B.VertexBuffer.NormalKind, B.VertexData.ComputeNormals(scarf.getIndices(), sPos, n), false, false);
  }

  // --- foot spray particle system ---
  const spray = new B.ParticleSystem('spray', 400, scene);
  spray.particleTexture = sprayTexture(scene);
  spray.emitter = new B.Vector3(0, 0, 0);
  spray.minEmitBox = new B.Vector3(-0.1, 0, -0.1); spray.maxEmitBox = new B.Vector3(0.1, 0, 0.1);
  spray.color1 = new B.Color4(0.95, 0.97, 1, 1); spray.color2 = new B.Color4(0.8, 0.85, 0.95, 1);
  spray.colorDead = new B.Color4(0.9, 0.93, 1, 0);
  spray.minSize = 0.04; spray.maxSize = 0.14; spray.minLifeTime = 0.2; spray.maxLifeTime = 0.55;
  spray.emitRate = 0; spray.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
  spray.direction1 = new B.Vector3(-0.6, 1.2, -0.4); spray.direction2 = new B.Vector3(0.6, 2.2, 0.4);
  spray.minEmitPower = 0.6; spray.maxEmitPower = 2.0; spray.updateSpeed = 0.016;
  spray.gravity = new B.Vector3(0, -6, 0);
  spray.start();
  spray.stop(); // emit on demand

  const player = {
    root, legs, fur, scarf, spray, tails, footPhase: 0, speed: 0, heading: 0, moving: false,
    feet: [{}, {}, {}, {}], surfLean: 0, updateScarf,
    get position() { return root.position; },
    setHeading(h) { this.heading = h; root.rotation.y = h; },
    terrainY(x, z) { return height(x, z); },
  };

  function update(dt, moveDir, isSurfing, surfTurn) {
    // locomotion gait
    const sp = Math.hypot(moveDir.x, moveDir.z);
    player.moving = sp > 0.02;
    player.speed = sp;
    player.footPhase += dt * (6 + sp * 6);
    for (let i = 0; i < 4; i++) {
      const ph = player.footPhase + i * Math.PI / 2;
      const swing = Math.sin(ph) * (0.4 + sp * 0.3);
      legs[i].rotation.x = (i < 2 ? swing : -swing) * (player.moving ? 1 : 0.15);
    }
    // body bob
    body.position.y = 0.45 + Math.sin(player.footPhase * 2) * 0.02 * (player.moving ? 1 : 0.05);
    // surf lean
    const targetLean = isSurfing ? (surfTurn * 0.5 - 0.1) : 0;
    player.surfLean += (targetLean - player.surfLean) * Math.min(1, dt * 6);
    root.rotation.z = player.surfLean;
    // feet world positions for deformation/spray
    for (let i = 0; i < 4; i++) {
      const lp = legPos[i];
      const wx = root.position.x + lp[0]; const wz = root.position.z + lp[2];
      player.feet[i] = { x: wx, z: wz, y: height(wx, wz), contact: Math.sin(player.footPhase + i * Math.PI / 2) > 0.7 };
    }
    // scarf wind: opposite of velocity + ambient
    const wind = new B.Vector3(-moveDir.x * 2.2, 0, -moveDir.z * 2.2);
    if (isSurfing) { wind.x -= moveDir.x * 4; wind.z -= moveDir.z * 4; }
    updateScarf(Math.min(dt, 0.033), wind);
    // spray on moving
    if (player.moving && Math.random() < 0.5) {
      spray.emitter = new B.Vector3(root.position.x, height(root.position.x, root.position.z) + 0.05, root.position.z);
      spray.emitRate = isSurfing ? 220 : 60;
      spray.manualEmitCount = -1;
    } else { spray.emitRate = 0; }
  }

  player.update = update;
  return player;
}

function sprayTexture(scene) {
  const t = new B.DynamicTexture('sprayT', 32, scene, false);
  const c = t.getContext();
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  t.update(false); t.hasAlpha = true; return t;
}
