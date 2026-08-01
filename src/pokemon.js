import * as B from '@babylonjs/core';
import { height } from './noise.js';

const ROSTER = [
  'bulbasaur', 'charmander', 'squirtle', 'pikachu', 'eevee', 'jigglypuff',
  'meowth', 'psyduck', 'oddish', 'geodude', 'magikarp', 'pidgey',
  'rattata', 'caterpie', 'zubat', 'diglett', 'clefairy', 'vulpix'
];
const META = {
  bulbasaur: { beh: 'wander', flee: 6, size: 1.5 }, charmander: { beh: 'approach', flee: 9, size: 1.5 },
  squirtle: { beh: 'wander', flee: 6, size: 1.5 }, pikachu: { beh: 'approach', flee: 9, size: 1.4 },
  eevee: { beh: 'flee', flee: 9, size: 1.4 }, jigglypuff: { beh: 'wander', flee: 7, size: 1.3 },
  meowth: { beh: 'flee', flee: 8, size: 1.3 }, psyduck: { beh: 'wander', flee: 6, size: 1.5 },
  oddish: { beh: 'flee', flee: 7, size: 1.0 }, geodude: { beh: 'wander', flee: 5, size: 1.3 },
  magikarp: { beh: 'wander', flee: 5, size: 1.5 }, pidgey: { beh: 'flee', flee: 8, size: 1.1 },
  rattata: { beh: 'flee', flee: 7, size: 1.0 }, caterpie: { beh: 'wander', flee: 5, size: 1.0 },
  zubat: { beh: 'flee', flee: 8, size: 1.0 }, diglett: { beh: 'wander', flee: 5, size: 1.0 },
  clefairy: { beh: 'approach', flee: 9, size: 1.4 }, vulpix: { beh: 'flee', flee: 8, size: 1.4 },
};

export async function createPokemon(scene, ctx) {
  // load each species once as an AssetContainer, then instantiate (cloned skeletons) per spawn
  const containers = {};
  for (const name of ROSTER) {
    try {
      const c = await B.SceneLoader.LoadAssetContainerAsync('/pokemon3d/' + name + '.glb', null, scene);
      containers[name] = c;
    } catch (e) { console.warn('failed to load pokemon', name, e); }
  }

  // blob shadow
  const shadowTex = (() => { const t = new B.DynamicTexture('pshadow', 64, scene, false); const c = t.getContext(); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); t.update(false); t.hasAlpha = true; return t; })();
  const shadowMat = new B.StandardMaterial('pshadowM', scene); shadowMat.diffuseTexture = shadowTex; shadowMat.opacityTexture = shadowTex; shadowMat.useAlphaFromDiffuseTexture = true; shadowMat.transparencyMode = B.Material.MATERIAL_ALPHABLEND; shadowMat.specularColor = new B.Color3(0, 0, 0); shadowMat.emissiveColor = new B.Color3(0, 0, 0); shadowMat.disableLighting = true; shadowMat.backFaceCulling = false;

  const list = [];
  const names = Object.keys(containers);
  const COUNT = Math.min(22, names.length * 2);
  for (let i = 0; i < COUNT; i++) {
    const name = names[i % names.length]; const meta = META[name];
    let hx, hz; do { hx = (Math.random() - 0.5) * 240; hz = (Math.random() - 0.5) * 240; } while (Math.hypot(hx, hz) < 14);
    let root = null, anim = null;
    try {
      const inst = containers[name].instantiateModelsToScene(n => name + '_' + i + '_' + n, { doNotInstantiate: false });
      root = inst.rootNodes[0];
      if (inst.animationGroups && inst.animationGroups.length) { anim = inst.animationGroups[0]; anim.start(true); }
    } catch (e) { console.warn('instantiate failed', name, e); continue; }
    if (!root) continue;

    // normalise scale: fit to meta.size tall, feet at local 0
    const bb = root.getHierarchyBoundingVectors(true);
    const h = Math.max(0.001, bb.max.y - bb.min.y);
    const s = (meta.size * 0.9) / h;
    root.scaling.set(s, s, s);
    const footOff = bb.min.y * s;
    // shadow
    const sh = B.MeshBuilder.CreatePlane('pks' + i, { width: meta.size * 0.9, height: meta.size * 0.5 }, scene);
    sh.rotation.x = Math.PI / 2; sh.material = shadowMat; sh.isPickable = false; sh.applyFog = false;
    // shadow casters + receive fog
    root.getChildMeshes().forEach(m => { if (ctx.shadow) ctx.shadow.addShadowCaster(m, true); m.applyFog = true; m.isPickable = false; });

    list.push({ name, meta, root, anim, shadow: sh, hx, hz, dir: Math.random() * 6.28, speed: 0.6 + Math.random() * 0.5, stateT: Math.random() * 3, moving: false, footOff, s, heading: 0 });
  }

  function update(dt, player) {
    for (const p of list) {
      const dx = p.root.position.x - player.position.x, dz = p.root.position.z - player.position.z;
      const dist = Math.hypot(dx, dz);
      let vx = 0, vz = 0;
      if (p.meta.beh === 'flee' && dist < p.meta.flee) { vx = dx / (dist || 1); vz = dz / (dist || 1); p.moving = true; }
      else if (p.meta.beh === 'approach' && dist > 3 && dist < 14) { vx = -dx / (dist || 1); vz = -dz / (dist || 1); p.moving = true; }
      else {
        p.stateT -= dt;
        if (p.stateT <= 0) { p.dir = Math.random() * 6.28; p.stateT = 2 + Math.random() * 3; p.moving = Math.random() < 0.7; }
        if (p.moving) { vx = Math.cos(p.dir); vz = Math.sin(p.dir); }
      }
      const nhx = p.root.position.x + vx * p.speed * dt - p.hx, nhz = p.root.position.z + vz * p.speed * dt - p.hz;
      if (Math.hypot(nhx, nhz) > 14) { p.dir += Math.PI; p.stateT = 1; }
      else { p.root.position.x += vx * p.speed * dt; p.root.position.z += vz * p.speed * dt; }
      if (Math.hypot(vx, vz) > 0.05) { p.heading += (Math.atan2(vx, vz) - p.heading) * Math.min(1, dt * 6); p.root.rotation.y = p.heading; }
      const gy = height(p.root.position.x, p.root.position.z);
      p.root.position.y = gy - p.footOff;
      // speed up animation a touch when moving
      if (p.anim) { const ts = p.moving ? 1.6 : 1.0; p.anim.speedRatio += (ts - p.anim.speedRatio) * Math.min(1, dt * 4); }
      p.shadow.position.set(p.root.position.x, gy + 0.04, p.root.position.z);
    }
  }
  return { list, update };
}
