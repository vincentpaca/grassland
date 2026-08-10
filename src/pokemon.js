import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Material } from '@babylonjs/core/Materials/material';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { height } from './noise.js';
import { fitToHeight } from './fit.js';

// Roster = animated species only (verified to ship animation clips), Gen I + multi-gen legendaries.
const ROSTER = [
  'bulbasaur','charizard','beedrill','pikachu','wigglytuff','zubat','magnemite','grimer','muk',
  'haunter','onix','ditto','eevee','vaporeon','jolteon','flareon','moltres','dragonite',
  'lugia','zekrom','landorus','zygarde','cosmog','cosmoem','eternatus','koraidon','miraidon'
];
// h = canonical Pokedex height in METRES, and the world is modelled 1 unit = 1 m, so every
// species ends up correctly sized relative to the others. The GLB files themselves cannot be
// used for this: their authored heights range from 0.01x to 57x the real height (magnemite
// ships 17.3 units tall, wigglytuff 0.012), so each model is normalized to `h` at runtime.
// fly = how far above the ground the species hovers, in metres (0 = stands on the ground).
const META = {
  bulbasaur:{beh:'wander',flee:6,h:0.7},        charizard:{beh:'wander',flee:9,h:1.7},
  beedrill:{beh:'flee',flee:8,h:1.0,fly:0.7},   pikachu:{beh:'approach',flee:9,h:0.4},
  wigglytuff:{beh:'wander',flee:7,h:1.0},       zubat:{beh:'flee',flee:8,h:0.8,fly:1.1},
  magnemite:{beh:'wander',flee:6,h:0.3,fly:0.7},grimer:{beh:'wander',flee:5,h:0.9},
  muk:{beh:'wander',flee:5,h:1.2},              haunter:{beh:'flee',flee:8,h:1.6,fly:0.6},
  onix:{beh:'wander',flee:7,h:8.8},             ditto:{beh:'wander',flee:5,h:0.3},
  eevee:{beh:'flee',flee:9,h:0.3},              vaporeon:{beh:'wander',flee:6,h:1.0},
  jolteon:{beh:'flee',flee:8,h:0.8},            flareon:{beh:'approach',flee:9,h:0.9},
  moltres:{beh:'flee',flee:10,h:2.0,fly:1.6},   dragonite:{beh:'approach',flee:10,h:2.2},
  lugia:{beh:'flee',flee:12,h:5.2},             zekrom:{beh:'wander',flee:10,h:2.9},
  landorus:{beh:'wander',flee:10,h:1.5,fly:0.8},zygarde:{beh:'flee',flee:11,h:5.0},
  cosmog:{beh:'approach',flee:9,h:0.2,fly:0.5}, cosmoem:{beh:'wander',flee:8,h:0.1,fly:0.4},
  eternatus:{beh:'flee',flee:12,h:20.0},        koraidon:{beh:'approach',flee:11,h:2.5},
  miraidon:{beh:'approach',flee:11,h:3.5},
};
const DEFAULT_META = { beh: 'wander', flee: 8, h: 1.0 };
// per-species facing offset (rad). Auto-calibration isn't possible for idle-only species, so tune by eye.
const TUNE = {};
for (const n of ROSTER) TUNE[n] = { face: 0 };

const LOAD_R = 75, UNLOAD_R = 115, PRELOAD_R = 95, MAX_LIVE = 10;

function wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

function idleClip(groups) {
  return groups.find(g => g.name.includes('defaultwait01_loop'))
    || groups.find(g => g.name.includes('wait'))
    || groups.find(g => g.name.includes('idle'))
    || groups[0] || null;
}

export async function createPokemon(scene, ctx, player) {
  const shadowTex = (() => { const t = new DynamicTexture('pshadow', 64, scene, false); const c = t.getContext(); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); t.update(false); t.hasAlpha = true; return t; })();
  const shadowMat = new StandardMaterial('pshadowM', scene); shadowMat.diffuseTexture = shadowTex; shadowMat.opacityTexture = shadowTex; shadowMat.useAlphaFromDiffuseTexture = true; shadowMat.transparencyMode = Material.MATERIAL_ALPHABLEND; shadowMat.specularColor = new Color3(0, 0, 0); shadowMat.emissiveColor = new Color3(0, 0, 0); shadowMat.disableLighting = true; shadowMat.backFaceCulling = false;

  const containers = new Map();
  async function getContainer(name) {
    if (containers.has(name)) { containers.get(name).refs++; return containers.get(name).container; }
    const c = await SceneLoader.LoadAssetContainerAsync('/pokemon3d/' + name + '.glb', null, scene);
    containers.set(name, { container: c, refs: 1 });
    return c;
  }
  function releaseContainer(name) { const e = containers.get(name); if (!e) return; e.refs--; if (e.refs <= 0) { try { e.container.dispose(); } catch (x) {} containers.delete(name); } }

  const list = [];
  const COUNT = 30;
  for (let i = 0; i < COUNT; i++) {
    const name = ROSTER[i % ROSTER.length]; const meta = META[name] || DEFAULT_META;
    let hx, hz; do { hx = (Math.random() - 0.5) * 280; hz = (Math.random() - 0.5) * 280; } while (Math.hypot(hx, hz) < 16);
    // unit plane; scaled to the measured footprint once the model has been calibrated
    const sh = MeshBuilder.CreatePlane('pks' + i, { width: 1, height: 1 }, scene);
    sh.rotation.x = Math.PI / 2; sh.material = shadowMat; sh.isPickable = false; sh.applyFog = false; sh.setEnabled(false);
    list.push({ name, meta, hx, hz, dir: Math.random() * 6.28, speed: 0.25 + Math.random() * 0.35, stateT: Math.random() * 3, moving: false, size: meta.h, shadow: sh, root: null, anim: null, footOff: 0, width: meta.h, heading: Math.random() * 6.28, loaded: false, loading: false, hasAnim: true, calibrated: false });
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
      // glTF roots carry a rotationQuaternion, and Babylon IGNORES .rotation while one is set,
      // so every heading update was silently dropped: they slid around without ever turning.
      root.rotationQuaternion = null;
      root.rotation.set(0, p.heading, 0);
      // rough fit now (bind pose); recalibrated against the animated pose on the first update
      const bb0 = root.getHierarchyBoundingVectors(true);
      const h0 = Math.max(0.001, bb0.max.y - bb0.min.y);
      root.scaling.set(p.meta.h / h0, p.meta.h / h0, p.meta.h / h0);
      root.position.set(p.hx, height(p.hx, p.hz), p.hz);
      root.getChildMeshes().forEach(m => {
        m.applyFog = true; m.isPickable = false; m.receiveShadows = true;
        // Normalize EVERY imported material, not just unlit ones: glTF exports commonly ship
        // metallic=1, which renders pure black without a strong environment map.
        if (m.material) {
          if (m.material.unlit) m.material.unlit = false;
          if (typeof m.material.metallic === 'number') m.material.metallic = 0;
          if (typeof m.material.roughness === 'number') m.material.roughness = 0.82;
          m.material.specularIntensity = 0.12;
          m.material.environmentIntensity = 0.7;
        }
        if (ctx.shadow) ctx.shadow.addShadowCaster(m, true);
      });
      // IDLE-ONLY: play the idle clip forever; they glide while roaming like the games.
      const ag = idleClip(inst.animationGroups || []);
      if (ag) { ag.start(true, 1.0); p.anim = ag; }
      p.root = root; p.loaded = true; p.calibrated = false; liveCount++; p.shadow.setEnabled(true);
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
  if (ctx.progress) ctx.progress.n = pre.length;
  await Promise.all(pre.map(async p => { await loadInstance(p); if (ctx.progress) ctx.progress.glb(); }));

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
      if (!p.calibrated) {
        // now that a frame has been drawn the skeleton holds the real pose: fit true height + feet
        const fit = fitToHeight(p.root, p.meta.h);
        p.footOff = fit.footOff; p.width = fit.width; p.calibrated = true;
        const w = Math.max(0.25, fit.width);
        p.shadow.scaling.set(w * 0.95, w * 0.65, 1);
      }
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
      // face where you MOVE; only turn to look at the trainer while standing still nearby,
      // otherwise they walk sideways and read as sliding across the grass
      const moveSp = Math.hypot(vx, vz);
      const faceAngle = moveSp > 0.05 ? Math.atan2(vx, vz) + tune.face
                                      : (dist < 18 ? Math.atan2(-dx, -dz) + tune.face : p.heading);
      p.heading += wrapAngle(faceAngle - p.heading) * Math.min(1, dt * 5);
      p.root.rotation.y = p.heading;
      const gy = height(p.root.position.x, p.root.position.z);
      const fly = p.meta.fly || 0;
      const bob = fly ? Math.sin(performance.now() * 0.0015 + p.hx) * 0.08 : 0;
      p.root.position.y = gy - p.footOff + fly + bob;
      // idle-only: anim keeps playing; no walk/run switch
      if (!p.anim) { const t = performance.now() * 0.003; p.root.rotation.z = Math.sin(t + p.hx) * 0.05; }
      else { p.root.rotation.z = 0; }
      p.shadow.position.set(p.root.position.x, gy + 0.04, p.root.position.z);
    }
  }
  return { list, update };
}
