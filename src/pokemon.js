import * as B from '@babylonjs/core';
import { height } from './noise.js';

const ROSTER = [
  'bulbasaur','charizard','beedrill','pikachu','wigglytuff','zubat','magnemite','grimer','muk',
  'haunter','onix','ditto','eevee','vaporeon','jolteon','flareon','moltres','dragonite'
];
const META = {
  bulbasaur:{beh:'wander',flee:6,size:1.6}, charizard:{beh:'wander',flee:9,size:3.0},
  beedrill:{beh:'flee',flee:8,size:1.4}, pikachu:{beh:'approach',flee:9,size:1.3},
  wigglytuff:{beh:'wander',flee:7,size:1.3}, zubat:{beh:'flee',flee:8,size:1.0},
  magnemite:{beh:'wander',flee:6,size:1.0}, grimer:{beh:'wander',flee:5,size:1.2},
  muk:{beh:'wander',flee:5,size:1.6}, haunter:{beh:'flee',flee:8,size:1.4},
  onix:{beh:'wander',flee:7,size:4.0}, ditto:{beh:'wander',flee:5,size:0.8},
  eevee:{beh:'flee',flee:9,size:1.3}, vaporeon:{beh:'wander',flee:6,size:1.3},
  jolteon:{beh:'flee',flee:8,size:1.3}, flareon:{beh:'approach',flee:9,size:1.3},
  moltres:{beh:'flee',flee:10,size:3.0}, dragonite:{beh:'approach',flee:10,size:2.6},
};

// per-species tuning (fill from screenshots): face offset rad, ground offset m
const TUNE = {
  bulbasaur:{face:0}, charizard:{face:0}, beedrill:{face:0}, pikachu:{face:0}, wigglytuff:{face:0},
  zubat:{face:0}, magnemite:{face:0}, grimer:{face:0}, muk:{face:0}, haunter:{face:0},
  onix:{face:0}, ditto:{face:0}, eevee:{face:0}, vaporeon:{face:0}, jolteon:{face:0},
  flareon:{face:0}, moltres:{face:0}, dragonite:{face:0},
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
      if (inst.animationGroups && inst.animationGroups.length) { inst.animationGroups.forEach(a => a.start(true)); anim = inst.animationGroups[0]; }
    } catch (e) { console.warn('instantiate failed', name, e); continue; }
    if (!root) continue;

    // normalise scale: fit to meta.size tall, feet at local 0
    let bb = root.getHierarchyBoundingVectors(true);
    const h = Math.max(0.001, bb.max.y - bb.min.y);
    const s = (meta.size * 0.9) / h;
    root.scaling.set(s, s, s);
    root.getChildMeshes().forEach(m => m.computeWorldMatrix(true));
    bb = root.getHierarchyBoundingVectors(true);
    const footOff = bb.min.y;
    // shadow
    const sh = B.MeshBuilder.CreatePlane('pks' + i, { width: meta.size * 0.9, height: meta.size * 0.5 }, scene);
    sh.rotation.x = Math.PI / 2; sh.material = shadowMat; sh.isPickable = false; sh.applyFog = false;
    // shadow casters + receive fog
    root.getChildMeshes().forEach(m => { if (ctx.shadow) ctx.shadow.addShadowCaster(m, true); m.applyFog = true; m.isPickable = false; });

    // place at home + random facing (otherwise everything spawns at origin facing 0)
    const startHeading = Math.random() * 6.28;
    root.position.set(hx, height(hx, hz) - footOff, hz);
    root.rotation.y = startHeading + Math.PI;
    list.push({ name, meta, root, anim, shadow: sh, hx, hz, dir: Math.random() * 6.28, speed: 0.6 + Math.random() * 0.5, stateT: Math.random() * 3, moving: false, footOff, s, heading: startHeading });
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
      const tune = TUNE[p.name] || {face:0};
      let faceAngle;
      if (dist < 34) { faceAngle = Math.atan2(-dx, -dz) + tune.face; } else { faceAngle = (Math.hypot(vx, vz) > 0.05) ? Math.atan2(vx, vz) + tune.face : p.heading; }
      p.heading += (faceAngle - p.heading) * Math.min(1, dt * 5);
      p.root.rotation.y = p.heading;
      const gy = height(p.root.position.x, p.root.position.z);
      p.root.position.y = gy - p.footOff;
      // speed up animation a touch when moving
      if (p.anim) { const ts = p.moving ? 1.8 : 0.6; p.anim.speedRatio += (ts - p.anim.speedRatio) * Math.min(1, dt * 4); }
      else { const t = performance.now() * 0.003; p.root.rotation.z = Math.sin(t + p.hx) * 0.05; p.root.position.y = gy - p.footOff + Math.abs(Math.sin(t * 1.3 + p.hx)) * 0.05; }
      p.shadow.position.set(p.root.position.x, gy + 0.04, p.root.position.z);
    }
  }
  return { list, update };
}
