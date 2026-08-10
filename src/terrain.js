import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexBuffer } from '@babylonjs/core/Meshes/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { SkyMaterial } from '@babylonjs/materials/sky/skyMaterial';
import { height, normal as heightNormal, valueNoise } from './noise.js';

function normalTexture(scene, size, draw) {
  const tex = new DynamicTexture('n', { width: size, height: size }, scene, false);
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSING;
  draw(tex.getContext(), size);
  tex.update(false); return tex;
}
function grassNormalTexture(scene) {
  return normalTexture(scene, 256, (ctx, S) => {
    const g = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let h = 0, fx = x * 0.1, fy = y * 0.1;
      h += Math.sin(fx * 1.0 + 0.3) * Math.cos(fy * 1.1) * 0.5;
      h += Math.sin(fx * 2.7 + 1.4) * Math.cos(fy * 2.3 + 0.7) * 0.28;
      h += Math.sin(fx * 6.0 + 2.1) * Math.cos(fy * 5.5 + 1.2) * 0.14;
      g[y * S + x] = h;
    }
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const hl = g[y * S + ((x - 1 + S) % S)], hr = g[y * S + ((x + 1) % S)];
      const hd = g[((y - 1 + S) % S) * S + x], hu = g[((y + 1 + S) % S) * S + x];
      let nx = (hl - hr) * 1.2, nz = (hd - hu) * 1.2, ny = 1.0;
      const l = Math.hypot(nx, ny, nz) || 1, o = i * 4;
      img.data[o] = ((nx / l) * 0.5 + 0.5) * 255; img.data[o + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[o + 2] = ((nz / l) * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}
function barkNormalTexture(scene) {
  return normalTexture(scene, 128, (ctx, S) => {
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // vertical bark streaks
      const streak = Math.sin(x * 0.6 + Math.sin(y * 0.05) * 3) * 0.5 + Math.sin(x * 1.7) * 0.2;
      const grain = Math.sin(y * 0.4) * 0.15;
      let nx = streak * 0.4 + grain, ny = 1.0, nz = 0.05;
      const l = Math.hypot(nx, ny, nz) || 1, o = (y * S + x) * 4;
      img.data[o] = ((nx / l) * 0.5 + 0.5) * 255; img.data[o + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[o + 2] = ((nz / l) * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}

function grassAlbedoTexture(scene) {
  const S = 256;
  const tex = new DynamicTexture('grassA', { width: S, height: S }, scene, false);
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSING;
  const c = tex.getContext();
  const img = c.createImageData(S, S);
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // clumpy noise field
    let n = 0; let amp = 0.5, f = 1, fx = x, fz = y;
    for (let o = 0; o < 4; o++) { const ix = Math.floor(fx * f), iz = Math.floor(fz * f); n += (hash(ix, iz) ) * amp; amp *= 0.5; f *= 2; }
    n /= 0.9375;
    // faint blade streaks
    const streak = Math.sin((x + hash(Math.floor(y / 6), 0) * 30) * 0.9) * 0.5 + 0.5;
    const g = 0.42 + n * 0.34 + streak * 0.08;
    const r = 0.30 + n * 0.14;
    const b = 0.14 + n * 0.08;
    const o = (y * S + x) * 4;
    img.data[o] = Math.min(255, r * 255); img.data[o + 1] = Math.min(255, g * 255); img.data[o + 2] = Math.min(255, b * 255); img.data[o + 3] = 255;
  }
  c.putImageData(img, 0, 0); tex.update(false); return tex;
}
const OFF = new Set((new URLSearchParams(location.search).get('no') || '').split(','));
function off(k) { return OFF.has(k); }
// PBR's tangent-space bump adds ~vTBN varyings; devices advertising only 16 fragment inputs
// (maxVaryingVectors) reject the resulting shader ("17 inputs > 16") and the whole frame goes black.
// Keep the normal map on capable GPUs, drop it where the limit is too low to compile.
function capBump(scene) { return !off('bump') && scene.getEngine().getCaps().maxVaryingVectors >= 32; }

function grassMaterial(scene, n1, albedo) {
  const m = new PBRMaterial('grass', scene);
  m.albedoColor = new Color3(1, 1, 1);
  if (albedo) { m.albedoTexture = albedo; m.albedoTexture.uScale = m.albedoTexture.vScale = 70; }
  m.roughness = 0.95; m.metallic = 0.0;
  if (n1 && capBump(scene)) { m.bumpTexture = n1; m.bumpTexture.level = 1.0; m.invertNormalMapX = true; m.invertNormalMapY = true; }
  m.useVertexColors = true; m.environmentIntensity = 0.9;
  return m;
}

export function createGrassland(scene, ctx) {
  const sunDir = new Vector3(0.62, -0.5, 0.6).normalize();
  const sun = new DirectionalLight('sun', sunDir.scale(-1), scene);
  sun.position = sunDir.scale(-160);
  sun.intensity = 2.7; sun.diffuse = new Color3(1.0, 0.92, 0.74); sun.specular = new Color3(1, 0.95, 0.8);
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0.2), scene);
  hemi.intensity = 0.75; hemi.diffuse = new Color3(0.55, 0.72, 1.0); hemi.groundColor = new Color3(0.2, 0.28, 0.12);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.78, 0.86, 0.96);
  scene.fogDensity = 0.0040;
  scene.ambientColor = new Color3(0.25, 0.3, 0.2);
  scene.clearColor = new Color4(0.68, 0.81, 0.95, 1);

  // --- time of day: drive sun position + air color through the hours ---
  const tmpCol = new Color3(), tmpSky = new Vector3();
  const cDay = [0.62, 0.80, 0.93], cDusk = [0.95, 0.55, 0.30], cNight = [0.04, 0.06, 0.12];
  const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function setDay(h) {
    h = ((h % 24) + 24) % 24;
    const el = Math.sin(((h - 6) / 24) * Math.PI * 2);       // +1 at noon, -1 at midnight
    const az = ((h + 18) / 24) * Math.PI * 2;
    const elR = Math.asin(Math.max(-0.999, Math.min(0.999, el)));
    const cx = Math.cos(elR), sy = Math.sin(elR);
    const dayF = Math.max(0, Math.min(1, el * 1.15 + 0.32));  // light level (dusk keeps a golden floor)
    const duskF = Math.max(0, Math.min(1, (0.22 - Math.abs(el)) * 3.2));  // warm near the horizon
    const dir = tmpSky.set(-cx * Math.cos(az), -sy, -cx * Math.sin(az)); dir.normalize();
    sun.direction.copyFrom(dir);
    sun.position.set(dir.x * -160, dir.y * -160, dir.z * -160);
    sun.intensity = 0.04 + dayF * 1.45;
    tmpCol.set(1, 0.95, 0.78); if (duskF > 0) tmpCol.set(...lerpC([1, 0.95, 0.78], [1, 0.66, 0.32], duskF));
    sun.diffuse.copyFrom(tmpCol);
    hemi.intensity = 0.13 + dayF * 0.36;   // night keeps a little moonlight so the meadow stays readable
    tmpCol.set(...lerpC([0.16, 0.24, 0.46], [0.55, 0.72, 1.0], dayF));
    hemi.diffuse.copyFrom(tmpCol);
    tmpCol.set(...lerpC([0.05, 0.07, 0.13], [0.2, 0.28, 0.12], dayF));
    hemi.groundColor.copyFrom(tmpCol);
    scene.ambientColor.set(0.02 + 0.05 * dayF, 0.03 + 0.06 * dayF, 0.04 + 0.04 * dayF);
    const air = lerpC(lerpC(cNight, cDusk, duskF), cDay, dayF);
    scene.fogColor.set(air[0], air[1], air[2]);
    scene.clearColor.set(air[0], air[1], air[2], 1);
    // SkyMaterial tonemaps with log2(2 / luminance^4): it must stay inside (0, 1.19) or the
    // multiplier goes negative and the sky renders black with a blown-out sun blob.
    // Lower luminance = brighter sky, so day maps LOW and night maps just under the ceiling.
    // sky brightness follows the SUN ELEVATION, not the light curve, so sunset keeps its colour
    const nightF = Math.max(0, Math.min(1, (-el - 0.05) * 3));
    if (sky) { sky.luminance = 0.92 + 0.2 * nightF; sky.sunPosition.copyFrom(sun.position); }
  }

  let sky = null;
  try {
    if (!off('sky')) {
      sky = new SkyMaterial('sky', scene);
      sky.backFaceCulling = false; sky.luminance = 1.0; sky.turbidity = 4; sky.rayleigh = 1.1;
      sky.mieCoefficient = 0.004; sky.mieDirectionalG = 0.78;
      sky.useSunPosition = true;                 // otherwise it ignores sunPosition and uses its own inclination
      sky.sunPosition = sun.position.clone();
      const skyBox = MeshBuilder.CreateBox('skyBox', { size: 6000 }, scene);
      skyBox.infiniteDistance = true; skyBox.material = sky; skyBox.isPickable = false; skyBox.applyFog = false;
      if (!off('probe')) {
        try {
          const probe = new ReflectionProbe('envProbe', 256, scene);
          probe.renderList.push(skyBox);
          probe.cubeTexture.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
          scene.environmentTexture = probe.cubeTexture;
          scene.environmentIntensity = 0.35;
        } catch (e) {}
      }
    }
  } catch (e) {}

  let shadow = null;
  if (!off('shadow')) {
    shadow = new CascadedShadowGenerator(1024, sun);
    shadow.autoCalcDepthBounds = true; shadow.depthClamp = true; shadow.bias = 0.002; shadow.normalBias = 0.03;
    shadow.blurPenumbra = false; shadow.usePercentageCloserFiltering = true; shadow.darkness = 0.6;
  }
  ctx.shadow = shadow;

  const gN = grassNormalTexture(scene);
  const gA = grassAlbedoTexture(scene);
  const matGrass = grassMaterial(scene, gN, gA);

  // --- ground ---
  const SIZE = 420, SUB = 220;
  const ground = MeshBuilder.CreateGround('ground', { width: SIZE, height: SIZE, subdivisions: SUB }, scene);
  const pos = ground.getVerticesData(VertexBuffer.PositionKind);
  const nor = ground.getVerticesData(VertexBuffer.NormalKind);
  const cols = new Float32Array((SUB + 1) * (SUB + 1) * 4);
  const nv = (SUB + 1) * (SUB + 1);
  for (let i = 0; i < nv; i++) {
    const x = pos[i * 3], z = pos[i * 3 + 2];
    const h = height(x, z); pos[i * 3 + 1] = h;
    const n = heightNormal(x, z, 0.8);
    nor[i * 3] = n[0]; nor[i * 3 + 1] = n[1]; nor[i * 3 + 2] = n[2];
    const patch = valueNoise(x * 0.05, z * 0.05, 7);
    const patch2 = valueNoise(x * 0.12 + 5, z * 0.12, 13);
    const damp = 1 - Math.max(0, 0.42 - n[1]) * 1.6;            // swales darker/lusher
    const dry = 1 + Math.max(0, n[1] - 0.92) * 0.8;             // crests a touch dry/yellow
    cols[i * 4] = (0.30 + patch * 0.14) * damp * dry;
    cols[i * 4 + 1] = (0.46 + patch * 0.4 + patch2 * 0.08) * damp;
    cols[i * 4 + 2] = (0.15 + patch * 0.07) * damp * dry;
    cols[i * 4 + 3] = 1;
  }
  ground.setVerticesData(VertexBuffer.PositionKind, pos);
  ground.setVerticesData(VertexBuffer.NormalKind, nor);
  ground.setVerticesData(VertexBuffer.ColorKind, cols);
  ground.material = matGrass; ground.receiveShadows = true; ground.applyFog = true; ground.freezeWorldMatrix();
  if (shadow) shadow.addShadowCaster(ground);

// --- trees: one unit geometry per shape, shared materials, thin-instancing (6 draw calls) ---
  const trunkMat = new PBRMaterial('trunkM', scene);
  trunkMat.albedoColor = new Color3(0.30, 0.19, 0.11); trunkMat.roughness = 0.95;
  if (capBump(scene)) { trunkMat.bumpTexture = barkNormalTexture(scene); trunkMat.bumpTexture.level = 0.8; trunkMat.invertNormalMapX = true; trunkMat.invertNormalMapY = true; }
  const folMat = new PBRMaterial('folM', scene);
  folMat.albedoColor = new Color3(0.2, 0.46, 0.18); folMat.roughness = 0.93;

  const trunkGeo = MeshBuilder.CreateCylinder('trunkV', { diameterBottom: 0.36, diameterTop: 0.16, height: 2.8, tessellation: 8 }, scene);
  const branchGeo = MeshBuilder.CreateCylinder('branchV', { diameterBottom: 0.14, diameterTop: 0.05, height: 1.4, tessellation: 6 }, scene);
  const coneGeo = [];
  for (let k = 0; k < 4; k++) {
    const c = MeshBuilder.CreateCylinder('coneV' + k, { diameterBottom: 2.8 - k * 0.55, diameterTop: 0, height: 1.8, tessellation: 8 }, scene);
    const cp = c.getVerticesData(VertexBuffer.PositionKind);
    for (let i = 0; i < cp.length / 3; i++) { cp[i * 3] += (valueNoise(i, k, 3) - 0.5) * 0.12; cp[i * 3 + 2] += (valueNoise(i + 9, k, 5) - 0.5) * 0.12; }
    c.setVerticesData(VertexBuffer.PositionKind, cp);
    coneGeo.push(c);
  }
  const bushGeo = blobMesh(1, 7);
  function blobMesh(radius, seed) {
    const m = MeshBuilder.CreateIcoSphere('blobV', { radius, radiusX: radius, radiusY: radius * 0.95, radiusZ: radius, subdivisions: 3 }, scene);
    const pos = m.getVerticesData(VertexBuffer.PositionKind);
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const n = (valueNoise(x * 3 + seed, z * 3, seed) - 0.5) * 1.2 + (valueNoise(y * 5 + seed, x * 5, 7) - 0.5) * 0.8;
      const l = Math.hypot(x, y, z) || 1;
      const kk = 1 + n * 0.22;
      pos[i * 3] = x / l * radius * kk; pos[i * 3 + 1] = y / l * radius * kk; pos[i * 3 + 2] = z / l * radius * kk;
    }
    m.setVerticesData(VertexBuffer.PositionKind, pos);
    const nor = VertexData.ComputeNormals(m.getIndices(), pos, new Float32Array(pos.length));
    m.setVerticesData(VertexBuffer.NormalKind, nor);
    return m;
  }
  function instant(mesh, mat) {
    mesh.material = mat; mesh.receiveShadows = true; mesh.applyFog = true; mesh.isPickable = false;
    mesh.doNotSyncBoundingInfo = true;
    if (shadow) shadow.addShadowCaster(mesh, true);
  }
  instant(trunkGeo, trunkMat); instant(branchGeo, trunkMat);
  coneGeo.forEach(c => instant(c, folMat));
  instant(bushGeo, folMat);

  const _q = new Quaternion(); const _s = new Vector3(); const _t = new Vector3(); const _m = new Matrix();
  function fill(group) {
    const items = group.items; const mats = new Float32Array(items.length * 16);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const o = it.o;
      if (it.rz) { _q.set(0, 0, Math.sin(it.rz / 2), Math.cos(it.rz / 2)); } else { _q.set(0, 0, 0, 1); }
      _s.set(o[0], o[1], o[2]); _t.set(it.x, it.y, it.z);
      Matrix.ComposeToRef(_s, _q, _t, _m);
      _m.copyToArray(mats, i * 16);
    }
    group.mats = mats;
    group.mesh.thinInstanceSetBuffer('matrix', mats, 16, !group.updatable);
    group.mesh.thinInstanceRefreshBoundingInfo(true);
  }
  function tintBuffer(mesh, items) {
    const c = new Float32Array(items.length * 4);
    for (let i = 0; i < items.length; i++) { const t = items[i].tint || 1; c[i * 4] = c[i * 4 + 1] = c[i * 4 + 2] = t; c[i * 4 + 3] = 1; }
    mesh.thinInstanceSetBuffer('color', c, 4, true);
  }

  const trunkI = [], branchI = [], coneI = [[], [], [], []], bushI = [];
  function plant(px, pz, s, conifer) {
    const gy = height(px, pz);
    const tint = 0.8 + Math.random() * 0.4;
    trunkI.push({ x: px, y: gy + 1.4 * s, z: pz, o: [s, s, s] });
    if (conifer) {
      for (let k = 0; k < 4; k++) {
        coneI[k].push({ x: px + (Math.random() - 0.5) * 0.2 * s, y: gy + (2.6 + k) * s, z: pz + (Math.random() - 0.5) * 0.2 * s, o: [s, s, s], tint, phase: Math.random() * 6.28, ax: 0.03 + Math.random() * 0.02, sway: 0.4 + Math.random() * 0.5 });
      }
    } else {
      for (let b = 0; b < 2; b++) branchI.push({ x: px + (b ? 0.5 : -0.5) * s, y: gy + 2.0 * s, z: pz, o: [s, s, s], rz: b ? 0.6 : -0.6 });
      const ncl = 5 + Math.floor(Math.random() * 3);
      for (let k = 0; k < ncl; k++) {
        const r = (0.9 + Math.random() * 0.7) * s;
        const ang = (k / ncl) * 6.28 + Math.random();
        bushI.push({ x: px + Math.cos(ang) * (0.6 + Math.random() * 0.8) * s, y: gy + (2.6 + Math.random() * 1.2) * s, z: pz + Math.sin(ang) * (0.6 + Math.random() * 0.8) * s, o: [r, r * (0.8 + Math.random() * 0.2), r], tint, phase: Math.random() * 6.28, ax: 0.05 + Math.random() * 0.04, sway: 0.6 + Math.random() * 0.7 });
      }
    }
  }
  // place trees: forest clumps + scattered singles
  for (let c = 0; c < 16; c++) {
    const cx = (Math.random() - 0.5) * 330, cz = (Math.random() - 0.5) * 330;
    if (Math.hypot(cx, cz) < 18) continue;
    const n = 3 + Math.floor(Math.random() * 5);
    const conifer = Math.random() < 0.35;
    for (let k = 0; k < n; k++) plant(cx + (Math.random() - 0.5) * 16, cz + (Math.random() - 0.5) * 16, 0.8 + Math.random() * 0.7, conifer);
  }
  for (let k = 0; k < 22; k++) { const ang = Math.random() * 6.28, d = 32 + Math.random() * 170; plant(Math.cos(ang) * d, Math.sin(ang) * d, 0.8 + Math.random() * 0.6, Math.random() < 0.35); }

  const trunkGrp = { mesh: trunkGeo, items: trunkI }, branchGrp = { mesh: branchGeo, items: branchI };
  const bushGrp = { mesh: bushGeo, items: bushI, updatable: true };
  const coneGrp = coneGeo.map((m, k) => ({ mesh: m, items: coneI[k], updatable: true }));
  const swayGroups = [bushGrp, ...coneGrp];
  fill(trunkGrp); fill(branchGrp);
  fill(bushGrp); coneGrp.forEach(g => fill(g));
  swayGroups.forEach(g => tintBuffer(g.mesh, g.items));
  const bushCount = bushI.length, coneCount = coneI.reduce((a, v) => a + v.length, 0);
  // --- distant hills ---
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * 6.28 + 0.2, dist = 1100;
    const m = MeshBuilder.CreateGround('hill' + k, { width: 320, height: 320, subdivisions: 18 }, scene);
    const mp = m.getVerticesData(VertexBuffer.PositionKind);
    for (let i = 0; i < mp.length / 3; i++) { const x = mp[i * 3], z = mp[i * 3 + 2]; const r = Math.hypot(x, z) / 160; mp[i * 3 + 1] = (height(x * 0.05, z * 0.05) * 4 + 26) * (1 - r * r * 0.5); }
    m.setVerticesData(VertexBuffer.PositionKind, mp); m.position.set(Math.cos(ang) * dist, -3, Math.sin(ang) * dist);
    const mm = grassMaterial(scene, gN, gA); mm.albedoColor = new Color3(0.55, 0.6, 0.45); m.material = mm; m.applyFog = true; m.isPickable = false; m.freezeWorldMatrix();
  }

  // --- pollen / dust drifting in the wind ---
  let pollen = null;
  if (!off('pollen')) {
    pollen = new ParticleSystem('pollen', 500, scene);
    pollen.particleTexture = ctx.sprayTex || (ctx.sprayTex = makeDot(scene));
    pollen.emitter = new Vector3(0, 1.2, 0);
    pollen.minEmitBox = new Vector3(-20, 0.3, -20); pollen.maxEmitBox = new Vector3(20, 3, 20);
    pollen.color1 = new Color4(1, 0.98, 0.7, 0.5); pollen.color2 = new Color4(1, 0.95, 0.6, 0.35);
    pollen.colorDead = new Color4(1, 1, 0.8, 0);
    pollen.minSize = 0.03; pollen.maxSize = 0.09; pollen.minLifeTime = 4; pollen.maxLifeTime = 9;
    pollen.emitRate = 90; pollen.blendMode = ParticleSystem.BLENDMODE_ADD;
    pollen.direction1 = new Vector3(1.5, 0.2, 0.3); pollen.direction2 = new Vector3(3, 0.6, 1.0);
    pollen.minEmitPower = 0.2; pollen.maxEmitPower = 0.6; pollen.gravity = new Vector3(0, 0.02, 0);
    pollen.updateSpeed = 0.016; pollen.start();
  }

  function update(wind, playerPos) {
    const t = wind.time * wind.speed;
    const amp = wind.amp;
    for (let g = 0; g < swayGroups.length; g++) {
      const grp = swayGroups[g], its = grp.items, mats = grp.mats;
      for (let i = 0; i < its.length; i++) {
        const it = its[i];
        const si = Math.sin(t + it.phase);
        const ci = Math.sin(t * 0.8 + it.phase);
        const a = amp * it.sway;
        const hz = Math.sin((si * a * it.ax) / 2), cz = Math.cos((si * a * it.ax) / 2);
        const hx = Math.sin((ci * a * it.ax * 0.7) / 2), cx = Math.cos((ci * a * it.ax * 0.7) / 2);
        _q.set(hx * cz, 0, cx * hz, cx * cz);
        const o = it.o;
        _s.set(o[0], o[1], o[2]);
        _t.set(it.x, it.y + si * 0.04, it.z);
        Matrix.ComposeToRef(_s, _q, _t, _m);
        _m.copyToArray(mats, i * 16);
      }
      grp.mesh.thinInstanceBufferUpdated('matrix');
    }
    if (pollen) { pollen.emitter.x = playerPos.x; pollen.emitter.z = playerPos.z; }
  }

  return { ground, sun, sky, shadow, matGrass, height, foliage: bushCount + coneCount, pollen, update, setDay };
}
function makeDot(scene) {
  const t = new DynamicTexture('dot', 32, scene, false);
  const c = t.getContext(); const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  t.update(false); t.hasAlpha = true; return t;
}
