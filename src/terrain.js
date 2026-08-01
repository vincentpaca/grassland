import * as B from '@babylonjs/core';
import { height, normal as heightNormal, valueNoise } from './noise.js';

// grass colour detail normal (procedural)
function grassNormalTexture(scene, size = 256, freq = 0.10) {
  const tex = new B.DynamicTexture('grassN', { width: size, height: size }, scene, false);
  tex.wrapU = tex.wrapV = B.Texture.WRAP_ADDRESSING;
  const ctx = tex.getContext();
  const g = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let h = 0, fx = x * freq, fy = y * freq;
    h += Math.sin(fx * 1.0 + 0.3) * Math.cos(fy * 1.1) * 0.5;
    h += Math.sin(fx * 2.7 + 1.4) * Math.cos(fy * 2.3 + 0.7) * 0.28;
    h += Math.sin(fx * 6.0 + 2.1) * Math.cos(fy * 5.5 + 1.2) * 0.14;
    g[y * size + x] = h;
  }
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const hl = g[y * size + ((x - 1 + size) % size)], hr = g[y * size + ((x + 1) % size)];
    const hd = g[((y - 1 + size) % size) * size + x], hu = g[((y + 1) % size) * size + x];
    let nx = (hl - hr) * 1.2, nz = (hd - hu) * 1.2, ny = 1.0;
    const l = Math.hypot(nx, ny, nz) || 1, o = i * 4;
    img.data[o] = ((nx / l) * 0.5 + 0.5) * 255;
    img.data[o + 1] = ((ny / l) * 0.5 + 0.5) * 255;
    img.data[o + 2] = ((nz / l) * 0.5 + 0.5) * 255;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); tex.update(false); return tex;
}

function grassMaterial(scene, normalTex) {
  const m = new B.PBRMaterial('grass', scene);
  m.albedoColor = new B.Color3(0.34, 0.55, 0.18);
  m.roughness = 0.92; m.metallic = 0.0;
  if (normalTex) { m.bumpTexture = normalTex; m.bumpTexture.level = 0.8; m.invertNormalMapX = true; m.invertNormalMapY = true; }
  m.useVertexColors = true;
  m.sheen.isEnabled = false;
  m.environmentIntensity = 0.9;
  return m;
}

export function createGrassland(scene, ctx) {
  const sunDir = new B.Vector3(0.62, -0.5, 0.6).normalize();

  // sun (warm late afternoon), ambient (sky blue), fog (soft, clear day)
  const sun = new B.DirectionalLight('sun', sunDir.scale(-1), scene);
  sun.position = sunDir.scale(-160);
  sun.intensity = 2.6; sun.diffuse = new B.Color3(1.0, 0.92, 0.74); sun.specular = new B.Color3(1, 0.95, 0.8);
  const hemi = new B.HemisphericLight('hemi', new B.Vector3(0, 1, 0.2), scene);
  hemi.intensity = 0.7; hemi.diffuse = new B.Color3(0.55, 0.72, 1.0); hemi.groundColor = new B.Color3(0.2, 0.28, 0.12);
  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogColor = new B.Color3(0.74, 0.84, 0.96);
  scene.fogDensity = 0.0042;
  scene.ambientColor = new B.Color3(0.25, 0.3, 0.2);
  scene.clearColor = new B.Color4(0.66, 0.8, 0.95, 1);

  let sky = null;
  try {
    sky = new B.SkyMaterial('sky', scene);
    sky.backFaceCulling = false;
    sky.luminance = 1.0; sky.turbidity = 4; sky.rayleigh = 1.1;
    sky.mieCoefficient = 0.004; sky.mieDirectionalG = 0.78;
    sky.sunPosition = sun.position.clone();
    const skyBox = B.MeshBuilder.CreateBox('skyBox', { size: 6000 }, scene);
    skyBox.infiniteDistance = true; skyBox.material = sky; skyBox.isPickable = false; skyBox.applyFog = false;
  } catch (e) {}

  const shadow = new B.CascadedShadowGenerator(2048, sun);
  shadow.autoCalcDepthBounds = true; shadow.depthClamp = true;
  shadow.bias = 0.002; shadow.normalBias = 0.03; shadow.blurPenumbra = true; shadow.penumbraRatio = 0.4; shadow.darkness = 0.6;
  ctx.shadow = shadow;

  const gN = grassNormalTexture(scene, 256, 0.1);
  const matGrass = grassMaterial(scene, gN);

  // --- main grassland mesh (baked rolling hills) ---
  const SIZE = 420, SUB = 300;
  const ground = B.MeshBuilder.CreateGround('ground', { width: SIZE, height: SIZE, subdivisions: SUB }, scene);
  const pos = ground.getVerticesData(B.VertexBuffer.PositionKind);
  const nor = ground.getVerticesData(B.VertexBuffer.NormalKind);
  const cols = new Float32Array((SUB + 1) * (SUB + 1) * 4);
  const nverts = (SUB + 1) * (SUB + 1);
  for (let i = 0; i < nverts; i++) {
    const x = pos[i * 3], z = pos[i * 3 + 2];
    const h = height(x, z); pos[i * 3 + 1] = h;
    const n = heightNormal(x, z, 0.8);
    nor[i * 3] = n[0]; nor[i * 3 + 1] = n[1]; nor[i * 3 + 2] = n[2];
    // colour variation: patches of brighter/darker grass via noise + slope darkening in swales
    const patch = valueNoise(x * 0.05, z * 0.05, 7);
    const damp = 1 - Math.max(0, 0.4 - n[1]) * 1.5; // swales (low normal y) get wetter/darker
    const g = (0.45 + patch * 0.5) * damp;
    cols[i * 4] = (0.30 + patch * 0.12) * damp;
    cols[i * 4 + 1] = g * 0.95;
    cols[i * 4 + 2] = (0.16 + patch * 0.08) * damp;
    cols[i * 4 + 3] = 1;
  }
  ground.setVerticesData(B.VertexBuffer.PositionKind, pos);
  ground.setVerticesData(B.VertexBuffer.NormalKind, nor);
  ground.setVerticesData(B.VertexBuffer.ColorKind, cols);
  ground.material = matGrass; ground.receiveShadows = true; ground.applyFog = true; ground.freezeWorldMatrix();
  shadow.addShadowCaster(ground);

  // --- trees (trunk + foliage clusters), scattered in clumps,避开起点 ---
  const trees = [];
  const trunkMat = new B.PBRMaterial('trunkM', scene); trunkMat.albedoColor = new B.Color3(0.28, 0.18, 0.10); trunkMat.roughness = 0.95;
  function makeTree(px, pz, s) {
    const root = new B.TransformNode('tree', scene); root.position.set(px, height(px, pz), pz);
    const trunk = B.MeshBuilder.CreateCylinder('trunk', { diameterTop: 0.18 * s, diameterBottom: 0.32 * s, height: 2.4 * s, tessellation: 7 }, scene);
    trunk.position.y = 1.2 * s; trunk.parent = root; trunk.material = trunkMat; trunk.receiveShadows = true; trunk.applyFog = true;
    const fMat = new B.PBRMaterial('folM', scene);
    const tint = 0.85 + Math.random() * 0.3;
    fMat.albedoColor = new B.Color3(0.22 * tint, 0.5 * tint, 0.2 * tint); fMat.roughness = 0.9;
    for (let k = 0; k < 3; k++) {
      const f = B.MeshBuilder.CreateSphere('fol', { diameter: (2.4 - k * 0.5) * s, segments: 8 }, scene);
      f.position.set((k - 1) * 0.5 * s, (2.6 + k * 0.4) * s, (Math.random() - 0.5) * 0.6 * s);
      f.scaling.y = 0.85; f.parent = root; f.material = fMat; f.receiveShadows = true; f.applyFog = true;
      shadow.addShadowCaster(f, true);
    }
    shadow.addShadowCaster(trunk, true);
    trees.push(root);
  }
  // forest clumps + scattered singles
  let placed = 0;
  for (let c = 0; c < 14; c++) {
    const cx = (Math.random() - 0.5) * 320, cz = (Math.random() - 0.5) * 320;
    if (Math.hypot(cx, cz) < 16) continue;
    const n = 3 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const px = cx + (Math.random() - 0.5) * 16, pz = cz + (Math.random() - 0.5) * 16;
      makeTree(px, pz, 0.8 + Math.random() * 0.7); placed++;
    }
  }
  for (let k = 0; k < 20; k++) {
    const ang = Math.random() * Math.PI * 2, d = 30 + Math.random() * 160;
    makeTree(Math.cos(ang) * d, Math.sin(ang) * d, 0.8 + Math.random() * 0.6); placed++;
  }

  // --- distant rolling hills ring (silhouette + aerial perspective) ---
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * Math.PI * 2 + 0.2, dist = 1100;
    const m = B.MeshBuilder.CreateGround('hill' + k, { width: 320, height: 320, subdivisions: 18 }, scene);
    const mp = m.getVerticesData(B.VertexBuffer.PositionKind);
    for (let i = 0; i < mp.length / 3; i++) { const x = mp[i * 3], z = mp[i * 3 + 2]; const r = Math.hypot(x, z) / 160; mp[i * 3 + 1] = (height(x * 0.05, z * 0.05) * 4 + 26) * (1 - r * r * 0.5); }
    m.setVerticesData(B.VertexBuffer.PositionKind, mp);
    m.position.set(Math.cos(ang) * dist, -3, Math.sin(ang) * dist);
    const mm = grassMaterial(scene, gN); mm.albedoColor = new B.Color3(0.4, 0.58, 0.3); mm.roughness = 0.95;
    m.material = mm; m.applyFog = true; m.isPickable = false; m.freezeWorldMatrix();
  }

  return { ground, trees, sun, sky, shadow, matGrass, height };
}
