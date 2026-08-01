import * as B from '@babylonjs/core';
import { height } from './noise.js';

// Trainer with a Verlet cape (cloth physics) that flows with movement + wind.
export function createTrainer(scene, ctx) {
  const root = new B.TransformNode('trainer', scene);
  const skin = new B.PBRMaterial('skin', scene); skin.albedoColor = new B.Color3(0.95, 0.8, 0.66); skin.roughness = 0.7;
  const cloth = new B.PBRMaterial('cloth', scene); cloth.albedoColor = new B.Color3(0.25, 0.45, 0.85); cloth.roughness = 0.85; cloth.sheen.isEnabled = true; cloth.sheen.intensity = 0.4;
  const cloth2 = new B.PBRMaterial('cloth2', scene); cloth2.albedoColor = new B.Color3(0.85, 0.2, 0.22); cloth2.roughness = 0.85;
  const capM = new B.PBRMaterial('cap', scene); capM.albedoColor = new B.Color3(0.2, 0.3, 0.6); capM.roughness = 0.6;
  const dark = new B.PBRMaterial('dark', scene); dark.albedoColor = new B.Color3(0.1, 0.1, 0.12); dark.roughness = 0.8;

  const body = B.MeshBuilder.CreateCapsule('body', { radius: 0.28, height: 1.0 }, scene); body.position.y = 1.0; body.parent = root; body.material = cloth;
  const pack = B.MeshBuilder.CreateSphere('pack', { diameter: 0.5, segments: 8 }, scene); pack.scaling.set(0.7, 0.9, 0.5); pack.position.set(0, 1.05, -0.28); pack.parent = root; pack.material = cloth2;
  const head = B.MeshBuilder.CreateSphere('head', { diameter: 0.42, segments: 12 }, scene); head.position.y = 1.65; head.parent = root; head.material = skin;
  const cap = B.MeshBuilder.CreateSphere('capM', { diameter: 0.46, segments: 12 }, scene); cap.scaling.y = 0.55; cap.position.y = 1.72; cap.parent = root; cap.material = capM;
  const brim = B.MeshBuilder.CreateCylinder('brim', { diameterTop: 0.5, diameterBottom: 0.5, height: 0.04, tessellation: 8 }, scene); brim.scaling.z = 1.4; brim.position.set(0, 1.66, 0.2); brim.parent = root; brim.material = capM;
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const lp = new B.TransformNode('legP', scene); lp.parent = root; lp.position.set(s * 0.13, 0.55, 0);
    const leg = B.MeshBuilder.CreateCapsule('leg', { radius: 0.1, height: 0.6 }, scene); leg.position.y = -0.3; leg.parent = lp; leg.material = dark;
    const shoe = B.MeshBuilder.CreateBox('shoe', { width: 0.16, height: 0.1, depth: 0.26 }, scene); shoe.position.set(0, -0.58, 0.04); shoe.parent = lp; shoe.material = dark; legs.push(lp);
    const ap = new B.TransformNode('armP', scene); ap.parent = root; ap.position.set(s * 0.33, 1.35, 0);
    const arm = B.MeshBuilder.CreateCapsule('arm', { radius: 0.08, height: 0.6 }, scene); arm.position.y = -0.28; arm.parent = ap; arm.material = cloth; arms.push(ap);
  }
  [body, head, cap, brim, pack].forEach(m => ctx.shadow.addShadowCaster(m, true));
  legs.forEach(p => p.getChildMeshes().forEach(m => ctx.shadow.addShadowCaster(m, true)));
  arms.forEach(p => p.getChildMeshes().forEach(m => ctx.shadow.addShadowCaster(m, true)));

  // --- Verlet cape (cloth) hanging from the shoulders ---
  const CG = 6; const cape = B.MeshBuilder.CreateGround('cape', { width: 0.7, height: 1.1, subdivisions: CG }, scene);
  cape.position.set(0, 1.3, -0.26); cape.parent = root; cape.rotation.x = 0.15;
  const cm = new B.PBRMaterial('capeM', scene); cm.albedoColor = new B.Color3(0.8, 0.18, 0.2); cm.roughness = 0.7; cm.sheen.isEnabled = true; cm.sheen.intensity = 0.5; cm.backFaceCulling = false;
  cape.material = cm; ctx.shadow.addShadowCaster(cape, true);
  const cPos = cape.getVerticesData(B.VertexBuffer.PositionKind).slice();
  const cOld = cPos.slice();
  const anchored = []; for (let i = 0; i <= CG; i++) anchored.push(i * (CG + 1)); // top row pinned to shoulders
  function updateCape(dt, wind, vx, vz) {
    const g = 8, damp = 0.90;
    for (let i = 0; i < cPos.length / 3; i++) {
      if (anchored.includes(i)) { cOld[i * 3] = cPos[i * 3]; cOld[i * 3 + 1] = cPos[i * 3 + 1]; cOld[i * 3 + 2] = cPos[i * 3 + 2]; continue; }
      const ox = cPos[i * 3], oy = cPos[i * 3 + 1], oz = cPos[i * 3 + 2];
      const vvx = (ox - cOld[i * 3]) * damp, vvy = (oy - cOld[i * 3 + 1]) * damp, vvz = (oz - cOld[i * 3 + 2]) * damp;
      cOld[i * 3] = ox; cOld[i * 3 + 1] = oy; cOld[i * 3 + 2] = oz;
      cPos[i * 3] = ox + vvx - vx * 0.10 + wind.x * dt;
      cPos[i * 3 + 1] = oy + vvy - g * dt * dt;
      cPos[i * 3 + 2] = oz + vvz - vz * 0.10 + wind.z * dt - 0.02 * dt; // rest backward
    }
    cape.updateVerticesData(B.VertexBuffer.PositionKind, cPos, false, false);
  }

  const player = {
    root, legs, arms, cape, footPhase: 0, speed: 0, heading: 0,
    get position() { return root.position; },
    setHeading(h) { this.heading = h; root.rotation.y = h; },
    update(dt, vx, vz, wind) {
      const sp = Math.hypot(vx, vz); this.speed = sp; this.footPhase += dt * (5 + sp * 4);
      const moving = sp > 0.05;
      for (let i = 0; i < 2; i++) { const ph = this.footPhase + i * Math.PI; legs[i].rotation.x = Math.sin(ph) * (moving ? 0.5 : 0.06); arms[i].rotation.x = -Math.sin(ph) * (moving ? 0.4 : 0.05); }
      body.position.y = 1.0 + Math.sin(this.footPhase * 2) * 0.02 * (moving ? 1 : 0.05);
      updateCape(Math.min(dt, 0.033), wind, vx, vz);
    }
  };
  return player;
}
