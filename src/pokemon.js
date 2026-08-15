import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Material } from '@babylonjs/core/Materials/material';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { height } from './noise.js';
import { fitToHeight, posedBounds } from './fit.js';

// Roster + per-species metadata (height, behavior, model URL) are generated in src/roster.js.
// h = canonical Pokedex height in METRES (world is 1 unit = 1 m); each model is normalized to `h`
// at runtime because authored GLB heights range from 0.01x to 57x real height.
// fly = hover height above ground in metres (0 = stands on the ground).
import { ROSTER, META } from './roster.js';
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
    const url = (META[name] && META[name].url) || '/pokemon3d/' + name + '.glb';
    const c = await SceneLoader.LoadAssetContainerAsync(url, null, scene);
    containers.set(name, { container: c, refs: 1 });
    return c;
  }
  function releaseContainer(name) { const e = containers.get(name); if (!e) return; e.refs--; if (e.refs <= 0) { try { e.container.dispose(); } catch (x) {} containers.delete(name); } }

  const list = [];
  const COUNT = 30;
  for (let i = 0; i < COUNT; i++) {
    const name = ROSTER[Math.floor(Math.random() * ROSTER.length)]; const meta = META[name] || DEFAULT_META;
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
    liveCount++;   // reserve the slot up front so parallel loads can't overshoot MAX_LIVE
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
      // initial scale from bind-pose height so we can position the model before animation starts
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
      p.root = root; p.loaded = true; p.calibrated = false; p.shadow.setEnabled(true);
    } catch (e) { console.warn('load pokemon', p.name, e); liveCount--; }
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
        // first frame: model has been drawn once with its idle animation, so measure the real
        // posed height + footprint and store a stable foot offset.
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
  // Spawn a specific species on demand (lookup feature). Creates a new instance at (x, z),
  // evicts the farthest loaded instance if at MAX_LIVE, and loads it immediately.
  function spawn(name, x, z) {
    if (!META[name]) return null;
    const meta = META[name];
    const sh = MeshBuilder.CreatePlane('pks' + list.length, { width: 1, height: 1 }, scene);
    sh.rotation.x = Math.PI / 2; sh.material = shadowMat; sh.isPickable = false; sh.applyFog = false; sh.setEnabled(false);
    const p = { name, meta, hx: x, hz: z, dir: Math.random() * 6.28, speed: 0.25 + Math.random() * 0.35, stateT: 0, moving: false, size: meta.h, shadow: sh, root: null, anim: null, footOff: 0, width: meta.h, heading: Math.random() * 6.28, loaded: false, loading: false, hasAnim: true, calibrated: false };
    list.push(p);
    if (liveCount >= MAX_LIVE) {
      const loaded = list.filter(q => q.loaded && q !== p);
      if (loaded.length) {
        loaded.sort((a, b) => Math.hypot(b.root.position.x - x, b.root.position.z - z) - Math.hypot(a.root.position.x - x, a.root.position.z - z));
        unloadInstance(loaded[0]);
      }
    }
    loadInstance(p);
    return p;
  }
  return { list, update, spawn, roster: ROSTER };
}
