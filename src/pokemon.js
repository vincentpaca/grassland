import * as B from '@babylonjs/core';
import { height } from './noise.js';

// Roster = animated species only (verified to ship animation clips), Gen I + multi-gen legendaries.
const ROSTER = [
  'bulbasaur','charizard','beedrill','pikachu','wigglytuff','zubat','magnemite','grimer','muk',
  'haunter','onix','ditto','eevee','vaporeon','jolteon','flareon','moltres','dragonite',
  'lugia','zekrom','landorus','zygarde','cosmog','cosmoem','eternatus','koraidon','miraidon'
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
  lugia:{beh:'flee',flee:12,size:3.6}, zekrom:{beh:'wander',flee:10,size:3.0},
  landorus:{beh:'wander',flee:10,size:2.6}, zygarde:{beh:'flee',flee:11,size:3.6},
  cosmog:{beh:'approach',flee:9,size:0.6}, cosmoem:{beh:'wander',flee:8,size:0.5},
  eternatus:{beh:'flee',flee:12,size:4.0}, koraidon:{beh:'approach',flee:11,size:2.8},
  miraidon:{beh:'approach',flee:11,size:2.8},
};
// per-species facing offset (rad). Auto-calibration isn't possible for idle-only species, so tune by eye.
const TUNE = {};
for (const n of ROSTER) TUNE[n] = { face: 0 };

const LOAD_R = 75, UNLOAD_R = 115, PRELOAD_R = 95, MAX_LIVE = 10;

function idleClip(groups) {
  return groups.find(g => g.name.includes('defaultwait01_loop'))
    || groups.find(g => g.name.includes('wait'))
    || groups.find(g => g.name.includes('idle'))
    || groups[0] || null;
}

export async function createPokemon(scene, ctx, player) {
  const shadowTex = (() => { const t = new B.DynamicTexture('pshadow', 64, scene, false); const c = t.getContext(); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); t.update(false); t.hasAlpha = true; return t; })();
  const shadowMat = new B.StandardMaterial('pshadowM', scene); shadowMat.diffuseTexture = shadowTex; shadowMat.opacityTexture = shadowTex; shadowMat.useAlphaFromDiffuseTexture = true; shadowMat.transparencyMode = B.Material.MATERIAL_ALPHABLEND; shadowMat.specularColor = new B.Color3(0, 0, 0); shadowMat.emissiveColor = new B.Color3(0, 0, 0); shadowMat.disableLighting = true; shadowMat.backFaceCulling = false;

  const containers = new Map();
  async function getContainer(name) {
    if (containers.has(name)) { containers.get(name).refs++; return containers.get(name).container; }
    const c = await B.SceneLoader.LoadAssetContainerAsync('/pokemon3d/' + name + '.glb', null, scene);
    containers.set(name, { container: c, refs: 1 });
    return c;
  }
  function releaseContainer(name) { const e = containers.get(name); if (!e) return; e.refs--; if (e.refs <= 0) { try { e.container.dispose(); } catch (x) {} containers.delete(name); } }

  const list = [];
  const COUNT = 30;
  for (let i = 0; i < COUNT; i++) {
    const name = ROSTER[i % ROSTER.length]; const meta = META[name];
    let hx, hz; do { hx = (Math.random() - 0.5) * 280; hz = (Math.random() - 0.5) * 280; } while (Math.hypot(hx, hz) < 16);
    const sh = B.MeshBuilder.CreatePlane('pks' + i, { width: meta.size * 0.9, height: meta.size * 0.5 }, scene);
    sh.rotation.x = Math.PI / 2; sh.material = shadowMat; sh.isPickable = false; sh.applyFog = false; sh.setEnabled(false);
    list.push({ name, meta, hx, hz, dir: Math.random() * 6.28, speed: 0.6 + Math.random() * 0.5, stateT: Math.random() * 3, moving: false, size: meta.size, shadow: sh, root: null, anim: null, footOff: 0, heading: Math.random() * 6.28, loaded: false, loading: false, hasAnim: true });
  }

  let liveCount = 0;
  async function loadInstance(p) {
    if (p.loaded || p.loading || liveCount >= MAX_LIVE) return;
    p.loading = true;
    try {
      const c = await getContainer(p.name);
      // animation-only filter: skip species with no clips (fall back handled by procedural bob if needed)
      const groups = c.animationGroups || [];
      p.hasAnim = groups.length > 0;
      const inst = c.instantiateModelsToScene(n => p.name + '_' + p.hx + '_' + n, false);
      const root = inst.rootNodes[0];
      root.getChildMeshes().forEach(m => m.computeWorldMatrix(true));
      let bb = root.getHierarchyBoundingVectors(true);
      const h = Math.max(0.001, bb.max.y - bb.min.y);
      const s = (p.meta.size * 0.9) / h;
      root.scaling.set(s, s, s);
      root.getChildMeshes().forEach(m => m.computeWorldMatrix(true));
      bb = root.getHierarchyBoundingVectors(true);
      p.footOff = bb.min.y;
      root.position.set(p.hx, height(p.hx, p.hz) - p.footOff, p.hz);
      root.rotation.y = p.heading;
      root.getChildMeshes().forEach(m => { m.applyFog = true; m.isPickable = false; if (ctx.shadow) ctx.shadow.addShadowCaster(m, true); });
      // IDLE-ONLY: play the idle clip forever; they glide while roaming like the games.
      const ag = idleClip(inst.animationGroups || []);
      if (ag) { ag.start(true, 1.0); p.anim = ag; }
      p.root = root; p.loaded = true; liveCount++; p.shadow.setEnabled(true);
    } catch (e) { console.warn('load pokemon', p.name, e); }
    p.loading = false;
  }
  function unloadInstance(p) {
    if (!p.loaded || !p.root) return;
    p.root.getChildMeshes().forEach(m => { try { if (ctx.shadow) ctx.shadow.removeShadowCaster(m); } catch (x) {} try { m.dispose(); } catch (x) {} });
    try { p.root.dispose(); } catch (x) {}
    if (p.anim) { try { p.anim.stop(); } catch (x) {} }
    releaseContainer(p.name);
    p.root = null; p.anim = null; p.loaded = false; liveCount--; p.shadow.setEnabled(false);
  }

  const pre = list.filter(p => Math.hypot(p.hx - player.position.x, p.hz - player.position.z) < PRELOAD_R);
  await Promise.all(pre.map(p => loadInstance(p)));

  let loadsThisFrame = 0;
  function update(dt, player) {
    loadsThisFrame = 0;
    const px = player.position.x, pz = player.position.z;
    for (const p of list) {
      const cx = p.loaded ? p.root.position.x : p.hx;
      const cz = p.loaded ? p.root.position.z : p.hz;
      const d = Math.hypot(cx - px, cz - pz);
      if (!p.loaded && !p.loading && d < LOAD_R && loadsThisFrame < 1) { loadInstance(p); loadsThisFrame++; }
      else if (p.loaded && d > UNLOAD_R) { unloadInstance(p); }
      if (!p.loaded) continue;
      const dx = player.position.x - p.root.position.x, dz = player.position.z - p.root.position.z;
      const dist = Math.hypot(dx, dz);
      let vx = 0, vz = 0;
      if (p.meta.beh === 'flee' && dist < p.meta.flee) { vx = -dx / (dist || 1); vz = -dz / (dist || 1); p.moving = true; }
      else if (p.meta.beh === 'approach' && dist > 3 && dist < 14) { vx = dx / (dist || 1); vz = dz / (dist || 1); p.moving = true; }
      else {
        p.stateT -= dt;
        if (p.stateT <= 0) { p.dir = Math.random() * 6.28; p.stateT = 2 + Math.random() * 3; p.moving = Math.random() < 0.7; }
        if (p.moving) { vx = Math.cos(p.dir); vz = Math.sin(p.dir); }
      }
      const nhx = p.root.position.x + vx * p.speed * dt - p.hx, nhz = p.root.position.z + vz * p.speed * dt - p.hz;
      if (Math.hypot(nhx, nhz) > 14) { p.dir += Math.PI; p.stateT = 1; }
      else { p.root.position.x += vx * p.speed * dt; p.root.position.z += vz * p.speed * dt; }
      const tune = TUNE[p.name] || { face: 0 };
      let faceAngle = dist < 34 ? Math.atan2(-dx, -dz) + tune.face : ((Math.hypot(vx, vz) > 0.05) ? Math.atan2(vx, vz) + tune.face : p.heading);
      p.heading += (faceAngle - p.heading) * Math.min(1, dt * 5);
      p.root.rotation.y = p.heading;
      const gy = height(p.root.position.x, p.root.position.z);
      p.root.position.y = gy - p.footOff;
      // idle-only: anim keeps playing; no walk/run switch
      if (!p.anim) { const t = performance.now() * 0.003; p.root.rotation.z = Math.sin(t + p.hx) * 0.05; }
      else { p.root.rotation.z = 0; }
      p.shadow.position.set(p.root.position.x, gy + 0.04, p.root.position.z);
    }
  }
  return { list, update };
}
