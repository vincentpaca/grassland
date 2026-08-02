import * as B from '@babylonjs/core';
import { height, normal as heightNormal, valueNoise } from './noise.js';

function normalTexture(scene, size, draw) {
  const tex = new B.DynamicTexture('n', { width: size, height: size }, scene, false);
  tex.wrapU = tex.wrapV = B.Texture.WRAP_ADDRESSING;
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

function grassMaterial(scene, n1) {
  const m = new B.PBRMaterial('grass', scene);
  m.albedoColor = new B.Color3(0.32, 0.52, 0.17);
  m.roughness = 0.93; m.metallic = 0.0;
  if (n1) { m.bumpTexture = n1; m.bumpTexture.level = 0.9; m.invertNormalMapX = true; m.invertNormalMapY = true; }
  m.useVertexColors = true; m.environmentIntensity = 0.9;
  return m;
}

export function createGrassland(scene, ctx) {
  const sunDir = new B.Vector3(0.62, -0.5, 0.6).normalize();
  const sun = new B.DirectionalLight('sun', sunDir.scale(-1), scene);
  sun.position = sunDir.scale(-160);
  sun.intensity = 2.7; sun.diffuse = new B.Color3(1.0, 0.92, 0.74); sun.specular = new B.Color3(1, 0.95, 0.8);
  const hemi = new B.HemisphericLight('hemi', new B.Vector3(0, 1, 0.2), scene);
  hemi.intensity = 0.75; hemi.diffuse = new B.Color3(0.55, 0.72, 1.0); hemi.groundColor = new B.Color3(0.2, 0.28, 0.12);
  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogColor = new B.Color3(0.78, 0.86, 0.96);
  scene.fogDensity = 0.0040;
  scene.ambientColor = new B.Color3(0.25, 0.3, 0.2);
  scene.clearColor = new B.Color4(0.68, 0.81, 0.95, 1);

  let sky = null;
  try {
    sky = new B.SkyMaterial('sky', scene);
    sky.backFaceCulling = false; sky.luminance = 1.0; sky.turbidity = 4; sky.rayleigh = 1.1;
    sky.mieCoefficient = 0.004; sky.mieDirectionalG = 0.78; sky.sunPosition = sun.position.clone();
    const skyBox = B.MeshBuilder.CreateBox('skyBox', { size: 6000 }, scene);
    skyBox.infiniteDistance = true; skyBox.material = sky; skyBox.isPickable = false; skyBox.applyFog = false;
    try {
      const probe = new B.ReflectionProbe('envProbe', 256, scene);
      probe.renderList.push(skyBox);
      probe.cubeTexture.refreshRate = B.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      scene.environmentTexture = probe.cubeTexture;
      scene.environmentIntensity = 0.6;
    } catch (e) {}
  } catch (e) {}

  const shadow = new B.CascadedShadowGenerator(1024, sun);
  shadow.autoCalcDepthBounds = true; shadow.depthClamp = true; shadow.bias = 0.002; shadow.normalBias = 0.03;
  shadow.blurPenumbra = false; shadow.useExponentialShadowMap = true; shadow.darkness = 0.6;
  ctx.shadow = shadow;

  const gN = grassNormalTexture(scene);
  const matGrass = grassMaterial(scene, gN);

  // --- ground ---
  const SIZE = 420, SUB = 220;
  const ground = B.MeshBuilder.CreateGround('ground', { width: SIZE, height: SIZE, subdivisions: SUB }, scene);
  const pos = ground.getVerticesData(B.VertexBuffer.PositionKind);
  const nor = ground.getVerticesData(B.VertexBuffer.NormalKind);
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
  ground.setVerticesData(B.VertexBuffer.PositionKind, pos);
  ground.setVerticesData(B.VertexBuffer.NormalKind, nor);
  ground.setVerticesData(B.VertexBuffer.ColorKind, cols);
  ground.material = matGrass; ground.receiveShadows = true; ground.applyFog = true; ground.freezeWorldMatrix();
  shadow.addShadowCaster(ground);

  // --- trees with bark + swaying foliage (organic lumpy foliage + branches) ---
  const trunkMat = new B.PBRMaterial('trunkM', scene);
  trunkMat.albedoColor = new B.Color3(0.30, 0.19, 0.11); trunkMat.roughness = 0.95;
  trunkMat.bumpTexture = barkNormalTexture(scene); trunkMat.bumpTexture.level = 0.8; trunkMat.invertNormalMapX = true; trunkMat.invertNormalMapY = true;
  const foliage = []; // {mesh, baseY, phase, ax, sway, parent}
  function makeBlob(radius, mat, seed) {
    const m = B.MeshBuilder.CreateIcoSphere('blob', { radius, radiusX: radius, radiusY: radius * 0.95, radiusZ: radius, subdivisions: 3 }, scene);
    const pos = m.getVerticesData(B.VertexBuffer.PositionKind);
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const n = (valueNoise(x * 3 + seed, z * 3, seed) - 0.5) * 1.2 + (valueNoise(y * 5 + seed, x * 5, 7) - 0.5) * 0.8;
      const l = Math.hypot(x, y, z) || 1;
      const k = 1 + n * 0.22;
      pos[i * 3] = x / l * radius * k; pos[i * 3 + 1] = y / l * radius * k; pos[i * 3 + 2] = z / l * radius * k;
    }
    m.setVerticesData(B.VertexBuffer.PositionKind, pos);
    const nor = B.VertexData.ComputeNormals(m.getIndices(), pos, new Float32Array(pos.length));
    m.setVerticesData(B.VertexBuffer.NormalKind, nor);
    m.material = mat; return m;
  }
  function makeTree(px, pz, s, conifer) {
    const root = new B.TransformNode('tree', scene); root.position.set(px, height(px, pz), pz);
    const trunk = B.MeshBuilder.CreateCylinder('trunk', { diameterTop: 0.16 * s, diameterBottom: 0.36 * s, height: 2.8 * s, tessellation: 8 }, scene);
    trunk.position.y = 1.4 * s; trunk.parent = root; trunk.material = trunkMat; trunk.receiveShadows = true; trunk.applyFog = true;
    shadow.addShadowCaster(trunk, true);
    const tint = 0.8 + Math.random() * 0.4;
    const fMat = new B.PBRMaterial('folM', scene);
    fMat.albedoColor = new B.Color3(0.2 * tint, 0.46 * tint, 0.18 * tint); fMat.roughness = 0.93;
    if (conifer) {
      for (let k = 0; k < 4; k++) {
        const cone = B.MeshBuilder.CreateCylinder('fol', { diameterTop: 0, diameterBottom: (2.8 - k * 0.55) * s, height: 1.8 * s, tessellation: 8 }, scene);
        // displace cone rim a touch for irregularity
        const cp = cone.getVerticesData(B.VertexBuffer.PositionKind);
        for (let i = 0; i < cp.length / 3; i++) { cp[i * 3] += (valueNoise(i, k, 3) - 0.5) * 0.12 * s; cp[i * 3 + 2] += (valueNoise(i + 9, k, 5) - 0.5) * 0.12 * s; }
        cone.setVerticesData(B.VertexBuffer.PositionKind, cp);
        cone.position.set((Math.random() - 0.5) * 0.2 * s, (2.6 + k * 1.0) * s, (Math.random() - 0.5) * 0.2 * s); cone.parent = root; cone.material = fMat; cone.receiveShadows = true; cone.applyFog = true;
        if (k === 0) shadow.addShadowCaster(cone, true); foliage.push({ mesh: cone, baseY: cone.position.y, phase: Math.random() * 6.28, ax: 0.03 + Math.random() * 0.02, sway: 0.4 + Math.random() * 0.5, parent: root });
      }
    } else {
      // a couple of branches
      for (let b = 0; b < 2; b++) {
        const br = B.MeshBuilder.CreateCylinder('br', { diameterTop: 0.05 * s, diameterBottom: 0.14 * s, height: 1.4 * s, tessellation: 6 }, scene);
        br.position.set((b ? 0.5 : -0.5) * s, 2.0 * s, 0); br.rotation.z = (b ? 0.6 : -0.6); br.parent = root; br.material = trunkMat; shadow.addShadowCaster(br, true);
      }
      // 5-7 lumpy foliage clusters at irregular positions/scales
      const ncl = 5 + Math.floor(Math.random() * 3);
      for (let k = 0; k < ncl; k++) {
        const r = (0.9 + Math.random() * 0.7) * s;
        const blob = makeBlob(r, fMat, Math.random() * 100);
        const ang = (k / ncl) * 6.28 + Math.random();
        blob.position.set(Math.cos(ang) * (0.6 + Math.random() * 0.8) * s, (2.6 + Math.random() * 1.2) * s, Math.sin(ang) * (0.6 + Math.random() * 0.8) * s);
        blob.scaling.y = 0.8 + Math.random() * 0.2;
        blob.parent = root; blob.receiveShadows = true; blob.applyFog = true;
        if (k === 0) shadow.addShadowCaster(blob, true);
        foliage.push({ mesh: blob, baseY: blob.position.y, phase: Math.random() * 6.28, ax: 0.05 + Math.random() * 0.04, sway: 0.6 + Math.random() * 0.7, parent: root });
      }
    }
  }
  // place trees: forest clumps + scattered singles
  for (let c = 0; c < 16; c++) {
    const cx = (Math.random() - 0.5) * 330, cz = (Math.random() - 0.5) * 330;
    if (Math.hypot(cx, cz) < 18) continue;
    const n = 3 + Math.floor(Math.random() * 5);
    const conifer = Math.random() < 0.35;
    for (let k = 0; k < n; k++) makeTree(cx + (Math.random() - 0.5) * 16, cz + (Math.random() - 0.5) * 16, 0.8 + Math.random() * 0.7, conifer);
  }
  for (let k = 0; k < 22; k++) { const ang = Math.random() * 6.28, d = 32 + Math.random() * 170; makeTree(Math.cos(ang) * d, Math.sin(ang) * d, 0.8 + Math.random() * 0.6, Math.random() < 0.35); }
  // --- distant hills ---
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * 6.28 + 0.2, dist = 1100;
    const m = B.MeshBuilder.CreateGround('hill' + k, { width: 320, height: 320, subdivisions: 18 }, scene);
    const mp = m.getVerticesData(B.VertexBuffer.PositionKind);
    for (let i = 0; i < mp.length / 3; i++) { const x = mp[i * 3], z = mp[i * 3 + 2]; const r = Math.hypot(x, z) / 160; mp[i * 3 + 1] = (height(x * 0.05, z * 0.05) * 4 + 26) * (1 - r * r * 0.5); }
    m.setVerticesData(B.VertexBuffer.PositionKind, mp); m.position.set(Math.cos(ang) * dist, -3, Math.sin(ang) * dist);
    const mm = grassMaterial(scene, gN); mm.albedoColor = new B.Color3(0.4, 0.56, 0.3); m.material = mm; m.applyFog = true; m.isPickable = false; m.freezeWorldMatrix();
  }

  // --- pollen / dust drifting in the wind ---
  const pollen = new B.ParticleSystem('pollen', 500, scene);
  pollen.particleTexture = ctx.sprayTex || (ctx.sprayTex = makeDot(scene));
  pollen.emitter = new B.Vector3(0, 1.2, 0);
  pollen.minEmitBox = new B.Vector3(-20, 0.3, -20); pollen.maxEmitBox = new B.Vector3(20, 3, 20);
  pollen.color1 = new B.Color4(1, 0.98, 0.7, 0.5); pollen.color2 = new B.Color4(1, 0.95, 0.6, 0.35);
  pollen.colorDead = new B.Color4(1, 1, 0.8, 0);
  pollen.minSize = 0.03; pollen.maxSize = 0.09; pollen.minLifeTime = 4; pollen.maxLifeTime = 9;
  pollen.emitRate = 90; pollen.blendMode = B.ParticleSystem.BLENDMODE_ADD;
  pollen.direction1 = new B.Vector3(1.5, 0.2, 0.3); pollen.direction2 = new B.Vector3(3, 0.6, 1.0);
  pollen.minEmitPower = 0.2; pollen.maxEmitPower = 0.6; pollen.gravity = new B.Vector3(0, 0.02, 0);
  pollen.updateSpeed = 0.016; pollen.start();

  function update(wind, playerPos) {
    for (let i = 0; i < foliage.length; i++) {
      const f = foliage[i];
      const s = Math.sin(wind.time * wind.speed + f.phase) * wind.amp * f.sway;
      f.mesh.rotation.z = s * f.ax;
      f.mesh.rotation.x = Math.cos(wind.time * wind.speed * 0.8 + f.phase) * wind.amp * f.sway * f.ax * 0.7;
      f.mesh.position.y = f.baseY + Math.sin(wind.time * wind.speed + f.phase) * 0.04;
    }
    pollen.emitter.x = playerPos.x; pollen.emitter.z = playerPos.z;
  }

  return { ground, sun, sky, shadow, matGrass, height, foliage, pollen, update };
}
function makeDot(scene) {
  const t = new B.DynamicTexture('dot', 32, scene, false);
  const c = t.getContext(); const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  t.update(false); t.hasAlpha = true; return t;
}
