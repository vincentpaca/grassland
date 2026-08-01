import * as B from '@babylonjs/core';
import { height, normal as heightNormal } from './noise.js';

// Build a procedural snow normal map (tangent-space) on a DynamicTexture.
function makeSnowNormalTexture(scene, size = 256, freq = 0.06, amp = 1.0) {
  const tex = new B.DynamicTexture('snowN', { width: size, height: size }, scene, false);
  tex.wrapU = tex.wrapV = B.Texture.WRAP_ADDRESSING;
  const ctx = tex.getContext();
  // height grid
  const g = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let h = 0, fx = x * freq, fy = y * freq;
    h += Math.sin(fx * 1.0 + 0.3) * Math.cos(fy * 1.0) * 0.5;
    h += Math.sin(fx * 2.3 + 1.7) * Math.cos(fy * 1.9 + 0.5) * 0.25;
    h += Math.sin(fx * 5.1 + 2.2) * Math.cos(fy * 4.7 + 1.1) * 0.12;
    g[y * size + x] = h;
  }
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const hl = g[y * size + ((x - 1 + size) % size)];
    const hr = g[y * size + ((x + 1) % size)];
    const hd = g[((y - 1 + size) % size) * size + x];
    const hu = g[((y + 1) % size) * size + x];
    let nx = (hl - hr) * amp, nz = (hd - hu) * amp, ny = 1.0;
    const l = Math.hypot(nx, ny, nz) || 1;
    const o = i * 4;
    img.data[o] = ((nx / l) * 0.5 + 0.5) * 255;
    img.data[o + 1] = ((ny / l) * 0.5 + 0.5) * 255;
    img.data[o + 2] = ((nz / l) * 0.5 + 0.5) * 255;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tex.update(false);
  return tex;
}

function snowMaterial(scene, normalTex) {
  const m = new B.PBRMaterial('snow', scene);
  m.albedoColor = new B.Color3(0.86, 0.90, 0.97);
  m.roughness = 0.62;
  m.metallic = 0.0;
  if (normalTex) { m.bumpTexture = normalTex; m.bumpTexture.level = 0.7; m.invertNormalMapX = true; m.invertNormalMapY = true; }
  m.useVertexColors = true;
  m.useVertexAlpha = false;
  // subsurface-ish back-scatter glow (snow translucency)
  try {
    m.subSurface.translucencyIntensity = 0.55;
    m.subSurface.translucencyColor = new B.Color3(0.7, 0.82, 1.0);
    m.subSurface.translucencyDiffusionDistance = new B.Vector3(0.55, 0.6, 0.85);
    m.subSurface.useAlbedoToColorTranslucentColor = true;
  } catch (e) {}
  m.sheen.isEnabled = true;
  m.sheen.color = new B.Color3(0.8, 0.88, 1.0);
  m.sheen.intensity = 0.5;
  m.environmentIntensity = 0.7;
  return m;
}

export function createSnowfield(scene, ctx) {
  const sunDir = new B.Vector3(0.55, -0.34, 0.76).normalize();

  // --- Sun + ambient + sky + fog ---
  const sun = new B.DirectionalLight('sun', sunDir.scale(-1), scene);
  sun.position = sunDir.scale(-120);
  sun.intensity = 3.2;
  sun.diffuse = new B.Color3(1.0, 0.84, 0.6);
  sun.specular = new B.Color3(1.0, 0.9, 0.75);

  const hemi = new B.HemisphericLight('hemi', new B.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.55;
  hemi.diffuse = new B.Color3(0.6, 0.74, 1.0);
  hemi.groundColor = new B.Color3(0.12, 0.16, 0.24);

  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogColor = new B.Color3(0.62, 0.74, 0.92);
  scene.fogDensity = 0.0085;
  scene.ambientColor = new B.Color3(0.2, 0.26, 0.34);

  // Sky
  let sky = null;
  try {
    sky = new B.SkyMaterial('sky', scene);
    sky.backFaceCulling = false;
    sky.luminance = 0.9; sky.turbidity = 6; sky.rayleigh = 1.6;
    sky.mieCoefficient = 0.006; sky.mieDirectionalG = 0.86;
    sky.sunPosition = sun.position.clone();
    const skyBox = B.MeshBuilder.CreateBox('skyBox', { size: 4000 }, scene);
    skyBox.infiniteDistance = true;
    skyBox.material = sky;
    skyBox.isPickable = false;
    skyBox.applyFog = false;
  } catch (e) {}

  // CSM shadows
  const shadow = new B.CascadedShadowGenerator(2048, sun);
  shadow.autoCalcDepthBounds = true;
  shadow.depthClamp = true;
  shadow.bias = 0.0015;
  shadow.normalBias = 0.02;
  shadow.blurPenumbra = true;
  shadow.penumbraRatio = 0.45;
  shadow.darkness = 0.55;
  ctx.shadow = shadow;

  // --- Normal texture + materials ---
  const snowN = makeSnowNormalTexture(scene, 256, 0.07, 1.1);
  const snowN2 = makeSnowNormalTexture(scene, 256, 0.22, 0.7);
  const matSnow = snowMaterial(scene, snowN);
  const matSnowFar = snowMaterial(scene, snowN);
  matSnowFar.bumpTexture = snowN2;

  // --- Large baked terrain (dunes, drifts) ---
  const SIZE = 260, SUB = 240;
  const large = B.MeshBuilder.CreateGround('terrain', { width: SIZE, height: SIZE, subdivisions: SUB, updatable: false }, scene);
  const pos = large.getVerticesData(B.VertexBuffer.PositionKind);
  const nor = large.getVerticesData(B.VertexBuffer.NormalKind);
  const cols = large.getVerticesData(B.VertexBuffer.ColorKind) || new Float32Array((SUB + 1) * (SUB + 1) * 4);
  const nverts = (SUB + 1) * (SUB + 1);
  for (let i = 0; i < nverts; i++) {
    const x = pos[i * 3], z = pos[i * 3 + 2];
    const h = height(x, z);
    pos[i * 3 + 1] = h;
    const n = heightNormal(x, z, 0.5);
    nor[i * 3] = n[0]; nor[i * 3 + 1] = n[1]; nor[i * 3 + 2] = n[2];
    // subtle slope darkening + blue shadow tint in albedo via vertex color
    const slope = 1 - Math.max(0, n[1]);
    cols[i * 4] = 1 - slope * 0.25; cols[i * 4 + 1] = 1 - slope * 0.18; cols[i * 4 + 2] = 1.0; cols[i * 4 + 3] = 1;
  }
  large.setVerticesData(B.VertexBuffer.PositionKind, pos);
  large.setVerticesData(B.VertexBuffer.NormalKind, nor);
  large.setVerticesData(B.VertexBuffer.ColorKind, cols);
  large.material = matSnowFar;
  large.receiveShadows = true;
  large.applyFog = true;
  large.freezeWorldMatrix();
  shadow.addShadowCaster(large);

  // --- Distant mountains (silhouette + aerial perspective via fog) ---
  const mountains = [];
  for (let k = 0; k < 9; k++) {
    const ang = (k / 9) * Math.PI * 2 + 0.3;
    const dist = 900 + Math.random() * 400;
    const cx = Math.cos(ang) * dist, cz = Math.sin(ang) * dist;
    const m = B.MeshBuilder.CreateGround('mt' + k, { width: 260, height: 260, subdivisions: 24 }, scene);
    const mp = m.getVerticesData(B.VertexBuffer.PositionKind);
    for (let i = 0; i < mp.length / 3; i++) {
      const x = mp[i * 3], z = mp[i * 3 + 2];
      const r = Math.sqrt(x * x + z * z) / 130;
      mp[i * 3 + 1] = (height(x * 0.04 + cx, z * 0.04 + cz) * 6 + 70) * (1 - r * r * 0.6);
    }
    m.setVerticesData(B.VertexBuffer.PositionKind, mp);
    m.position.x = cx; m.position.z = cz; m.position.y = -2;
    const mm = snowMaterial(scene, snowN2); mm.albedoColor = new B.Color3(0.78, 0.84, 0.93); mm.roughness = 0.8;
    m.material = mm; m.applyFog = true; m.isPickable = false; m.receiveShadows = false;
    m.freezeWorldMatrix();
    mountains.push(m);
  }

  // --- A few rock outcrops (silhouette + snow cap) ---
  const rocks = [];
  for (let k = 0; k < 6; k++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 60;
    const cx = Math.cos(ang) * dist, cz = Math.sin(ang) * dist;
    const rock = B.MeshBuilder.CreateIcoSphere('rock' + k, { radius: 1.6 + Math.random() * 1.2, subdivisions: 2 }, scene);
    rock.position.set(cx, height(cx, cz) + 0.4, cz);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.scaling.y = 0.7;
    const rm = new B.PBRMaterial('rockM' + k, scene);
    rm.albedoColor = new B.Color3(0.18, 0.2, 0.24); rm.roughness = 0.95; rm.metallic = 0;
    rock.material = rm; rock.receiveShadows = true; rock.applyFog = true;
    shadow.addShadowCaster(rock);
    // snow cap on top faces
    const cap = rock.clone('cap' + k); cap.scaling.y = 0.72; cap.position.y += 0.15;
    const cm = new B.PBRMaterial('capM' + k, scene);
    cm.albedoColor = new B.Color3(0.9, 0.93, 0.98); cm.roughness = 0.6; cm.alpha = 0.9;
    cap.material = cm;
    rocks.push(rock, cap);
  }

  // --- Detail patch (follows player, real deformation displacement) ---
  const P = 30, N = 256, STEP = P / N; // ~0.117m spacing -> sub-10cm
  const patch = new B.Mesh('patch', scene);
  const vd = new B.VertexData();
  const pPos = new Float32Array((N + 1) * (N + 1) * 3);
  const pNor = new Float32Array((N + 1) * (N + 1) * 3);
  const pCol = new Float32Array((N + 1) * (N + 1) * 4);
  const idx = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = y * (N + 1) + x, b = a + 1, c = a + (N + 1), d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  vd.indices = idx;
  // deform field: net Y offset (berm positive / depression negative) + state packed in color
  const deform = new Float32Array((N + 1) * (N + 1));       // net offset (m)
  const comp = new Float32Array((N + 1) * (N + 1));          // compression 0..1
  const ice = new Float32Array((N + 1) * (N + 1));           // ice 0..1
  const wet = new Float32Array((N + 1) * (N + 1));           // wet 0..1
  const staticH = new Float32Array((N + 1) * (N + 1));      // baked height cache
  let originX = 0, originZ = 0, originSet = false;

  function worldToGrid(wx, wz) {
    const gx = Math.round((wx - (originX - P / 2)) / STEP);
    const gz = Math.round((wz - (originZ - P / 2)) / STEP);
    return [gx, gz];
  }
  function stamp(wx, wz, radiusM, amount, kind) {
    const [gx, gz] = worldToGrid(wx, wz);
    const r = Math.ceil(radiusM / STEP);
    for (let y = gz - r; y <= gz + r; y++) for (let x = gx - r; x <= gx + r; x++) {
      if (x < 0 || y < 0 || x > N || y > N) continue;
      const dx = (x - gx) * STEP, dy = (y - gz) * STEP;
      const d = Math.hypot(dx, dy);
      if (d > radiusM) continue;
      const t = d / radiusM;
      const falloff = (1 - t) * (1 - t);
      const i = y * (N + 1) + x;
      if (kind === 'depress') {
        deform[i] -= amount * falloff;
        comp[i] = Math.min(1, comp[i] + amount * 0.5 * falloff);
      } else if (kind === 'berm') {
        // ring around depression
        const ring = Math.exp(-((t - 0.7) * (t - 0.7)) * 14);
        deform[i] += amount * 0.9 * ring;
      } else if (kind === 'ice') {
        ice[i] = Math.min(1, ice[i] + amount * falloff);
        wet[i] = Math.max(0, wet[i] - amount * falloff);
      } else if (kind === 'wet') {
        wet[i] = Math.min(1, wet[i] + amount * falloff); ice[i] = Math.max(0, ice[i] - amount * falloff * 0.5);
      } else if (kind === 'crater') {
        deform[i] -= amount * falloff * (1 - t * 0.3);
        comp[i] = Math.min(1, comp[i] + amount * 0.6 * falloff);
        const ring = Math.exp(-((t - 0.6) * (t - 0.6)) * 10);
        deform[i] += amount * 1.1 * ring;
      }
    }
  }
  function refill(dt) {
    // slow decay + light diffusion (approximate). Cheaper than full blur.
    const decay = 0.9996;
    for (let i = 0; i < deform.length; i++) {
      deform[i] *= decay;
      comp[i] *= 0.99985;
      wet[i] *= 0.9997;
      // ice is largely persistent (refrozen), very slow fade
      ice[i] *= 0.99995;
    }
  }

  function setOrigin(ox, oz) {
    originX = ox; originZ = oz;
    for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) {
      const wx = ox - P / 2 + x * STEP, wz = oz - P / 2 + y * STEP;
      staticH[y * (N + 1) + x] = height(wx, wz);
    }
    originSet = true;
  }

  let updCount = 0;
  function update(playerPos) {
    const px = Math.round(playerPos.x / STEP) * STEP;
    const pz = Math.round(playerPos.z / STEP) * STEP;
    if (!originSet || Math.abs(px - originX) > 0.5 * STEP || Math.abs(pz - originZ) > 0.5 * STEP) {
      setOrigin(px, pz);
    }
    for (let y = 0; y <= N; y++) {
      for (let x = 0; x <= N; x++) {
        const i = y * (N + 1) + x;
        const off = deform[i];
        pPos[i * 3] = originX - P / 2 + x * STEP;
        pPos[i * 3 + 1] = staticH[i] + off;
        pPos[i * 3 + 2] = originZ - P / 2 + y * STEP;
        // vertex color: compression darkens, ice bluish+bright, wet darker
        const c = comp[i], ic = ice[i], w = wet[i];
        pCol[i * 4] = 1 - c * 0.35 - w * 0.18 + ic * 0.05;
        pCol[i * 4 + 1] = 1 - c * 0.28 - w * 0.12 + ic * 0.08;
        pCol[i * 4 + 2] = 1 - c * 0.2 + ic * 0.14;
        pCol[i * 4 + 3] = 1;
      }
    }
    // recompute normals from deformed heights (finite diff) -> real self-shadow
    for (let y = 0; y <= N; y++) {
      for (let x = 0; x <= N; x++) {
        const i = y * (N + 1) + x;
        const xl = x > 0 ? pPos[(i - 1) * 3 + 1] : pPos[i * 3 + 1];
        const xr = x < N ? pPos[(i + 1) * 3 + 1] : pPos[i * 3 + 1];
        const yd = y > 0 ? pPos[(i - (N + 1)) * 3 + 1] : pPos[i * 3 + 1];
        const yu = y < N ? pPos[(i + (N + 1)) * 3 + 1] : pPos[i * 3 + 1];
        let nx = (xl - xr), nz = (yd - yu), ny = 2 * STEP;
        const l = Math.hypot(nx, ny, nz) || 1;
        pNor[i * 3] = nx / l; pNor[i * 3 + 1] = ny / l; pNor[i * 3 + 2] = nz / l;
      }
    }
    if (!patch._inited) { vd.positions = pPos; vd.normals = pNor; vd.colors = pCol; vd.applyToMesh(patch, true); patch._inited = true; }
    else {
      patch.updateVerticesData(B.VertexBuffer.PositionKind, pPos, false, false);
      patch.updateVerticesData(B.VertexBuffer.NormalKind, pNor, false, false);
      patch.updateVerticesData(B.VertexBuffer.ColorKind, pCol, false, false);
    }
    updCount++;
  }

  patch.material = matSnow;
  patch.receiveShadows = true; patch.applyFog = true; patch.isPickable = false;
  shadow.addShadowCaster(patch);

  return { large, patch, mountains, rocks, sun, sky, shadow, matSnow, snowN, snowN2,
    deform: { stamp, refill, worldToGrid, N, STEP, P, origin: () => [originX, originZ] }, update,
    snowN, snowN2 };
}
