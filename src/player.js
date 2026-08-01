import * as B from '@babylonjs/core';
import { height } from './noise.js';

// A simple Pokemon trainer (seen from behind): cap, head, body, legs, arms. Locomotion + foot planting.
export function createTrainer(scene, ctx) {
  const root = new B.TransformNode('trainer', scene);
  const skin = new B.PBRMaterial('skin', scene); skin.albedoColor = new B.Color3(0.95, 0.8, 0.66); skin.roughness = 0.7;
  const cloth = new B.PBRMaterial('cloth', scene); cloth.albedoColor = new B.Color3(0.25, 0.45, 0.85); cloth.roughness = 0.85; cloth.sheen.isEnabled = true; cloth.sheen.intensity = 0.4;
  const cloth2 = new B.PBRMaterial('cloth2', scene); cloth2.albedoColor = new B.Color3(0.85, 0.2, 0.22); cloth2.roughness = 0.85;
  const cap = new B.PBRMaterial('cap', scene); cap.albedoColor = new B.Color3(0.2, 0.3, 0.6); cap.roughness = 0.6;
  const dark = new B.PBRMaterial('dark', scene); dark.albedoColor = new B.Color3(0.1, 0.1, 0.12); dark.roughness = 0.8;

  const body = B.MeshBuilder.CreateCapsule('body', { radius: 0.28, height: 1.0 }, scene);
  body.position.y = 1.0; body.parent = root; body.material = cloth;
  // backpack (visible from behind)
  const pack = B.MeshBuilder.CreateSphere('pack', { diameter: 0.5, segments: 8 }, scene);
  pack.scaling.set(0.7, 0.9, 0.5); pack.position.set(0, 1.05, -0.28); pack.parent = root; pack.material = cloth2;
  const head = B.MeshBuilder.CreateSphere('head', { diameter: 0.42, segments: 12 }, scene);
  head.position.y = 1.65; head.parent = root; head.material = skin;
  const capMesh = B.MeshBuilder.CreateSphere('capM', { diameter: 0.46, segments: 12 }, scene);
  capMesh.scaling.y = 0.55; capMesh.position.y = 1.72; capMesh.parent = root; capMesh.material = cap;
  const brim = B.MeshBuilder.CreateCylinder('brim', { diameterTop: 0.5, diameterBottom: 0.5, height: 0.04, tessellation: 8 }, scene);
  brim.scaling.z = 1.4; brim.position.set(0, 1.66, 0.2); brim.parent = root; brim.material = cap;
  // legs (animated)
  const legs = [];
  for (const s of [-1, 1]) {
    const piv = new B.TransformNode('legP', scene); piv.parent = root; piv.position.set(s * 0.13, 0.55, 0);
    const leg = B.MeshBuilder.CreateCapsule('leg', { radius: 0.1, height: 0.6 }, scene);
    leg.position.y = -0.3; leg.parent = piv; leg.material = dark;
    const shoe = B.MeshBuilder.CreateBox('shoe', { width: 0.16, height: 0.1, depth: 0.26 }, scene);
    shoe.position.set(0, -0.58, 0.04); shoe.parent = piv; shoe.material = dark;
    legs.push(piv);
  }
  // arms (swing)
  const arms = [];
  for (const s of [-1, 1]) {
    const piv = new B.TransformNode('armP', scene); piv.parent = root; piv.position.set(s * 0.33, 1.35, 0);
    const arm = B.MeshBuilder.CreateCapsule('arm', { radius: 0.08, height: 0.6 }, scene);
    arm.position.y = -0.28; arm.parent = piv; arm.material = cloth;
    arms.push(piv);
  }
  [body, head, capMesh, brim, pack, ...legs, ...arms].forEach(p => p.getChildMeshes ? p.getChildMeshes().forEach(m => { if (ctx.shadow) ctx.shadow.addShadowCaster(m, true); }) : (ctx.shadow && ctx.shadow.addShadowCaster(p, true)));
  legs.forEach(piv => piv.getChildMeshes().forEach(m => ctx.shadow.addShadowCaster(m, true)));
  arms.forEach(piv => piv.getChildMeshes().forEach(m => ctx.shadow.addShadowCaster(m, true)));
  ctx.shadow.addShadowCaster(body, true); ctx.shadow.addShadowCaster(head, true); ctx.shadow.addShadowCaster(pack, true); ctx.shadow.addShadowCaster(capMesh, true); ctx.shadow.addShadowCaster(brim, true);

  const player = {
    root, legs, arms, footPhase: 0, speed: 0, heading: 0,
    get position() { return root.position; },
    setHeading(h) { this.heading = h; root.rotation.y = h; },
    terrainY(x, z) { return height(x, z); },
    update(dt, vx, vz) {
      const sp = Math.hypot(vx, vz); this.speed = sp; this.footPhase += dt * (5 + sp * 4);
      const moving = sp > 0.05;
      for (let i = 0; i < 2; i++) { const ph = this.footPhase + i * Math.PI; legs[i].rotation.x = Math.sin(ph) * (moving ? 0.5 : 0.06); arms[i].rotation.x = -Math.sin(ph) * (moving ? 0.4 : 0.05); }
      body.position.y = 1.0 + Math.sin(this.footPhase * 2) * 0.02 * (moving ? 1 : 0.05);
    }
  };
  return player;
}
