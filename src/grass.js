import * as B from '@babylonjs/core';
import { height } from './noise.js';

// World-anchored swaying grass (thin instances), PBR + shadow-receiving, with cached terrain height.
function bladeTexture(scene) {
  const w = 32, h = 80;
  const t = new B.DynamicTexture('blade', { width: w, height: h }, scene, false);
  t.hasAlpha = true;
  const c = t.getContext();
  c.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    const f = y / (h - 1);
    const half = (1 - f) * (w * 0.5) * 0.85 + 0.8;
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - w / 2) / half;
      if (d > 1) continue;
      const a = (1 - d) * (0.4 + 0.6 * (1 - f * 0.25));
      const r = 70 + (1 - f) * 40 + Math.random() * 10;
      const g = 150 + (1 - f) * 60 + Math.random() * 18;
      const b = 50 + (1 - f) * 20;
      c.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
      c.fillRect(x, h - 1 - y, 1, 1);
    }
  }
  t.update(false); return t;
}

export function createGrass(scene, ctx) {
  const blade = B.MeshBuilder.CreatePlane('blade', { width: 0.14, height: 0.7, sideOrientation: B.Mesh.DOUBLESIDE }, scene);
  const p = blade.getVerticesData(B.VertexBuffer.PositionKind);
  for (let i = 0; i < p.length / 3; i++) p[i * 3 + 1] += 0.35;
  blade.setVerticesData(B.VertexBuffer.PositionKind, p);
  const mat = new B.PBRMaterial('bladeM', scene);
  const tex = bladeTexture(scene);
  mat.albedoTexture = tex; mat.albedoColor = new B.Color3(1, 1, 1);
  tex.hasAlpha = true; mat.useAlphaFromAlbedoTexture = true;
  mat.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
  mat.roughness = 1; mat.metallic = 0; mat.backFaceCulling = false;
  mat.emissiveColor = new B.Color3(0.02, 0.03, 0.01);
  blade.material = mat; blade.applyFog = true; blade.isPickable = false;
  blade.receiveShadows = true; blade.castShadows = false;   // receive light, don't cast (perf)

  const COUNT = 3500, RADIUS = 20;
  const mats = new Float32Array(COUNT * 16);
  const fx = new Float32Array(COUNT), fz = new Float32Array(COUNT), gy = new Float32Array(COUNT);
  const yaw = new Float32Array(COUNT), scl = new Float32Array(COUNT), phase = new Float32Array(COUNT), stiff = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * RADIUS;
    fx[i] = Math.cos(a) * r; fz[i] = Math.sin(a) * r; gy[i] = height(fx[i], fz[i]);
    yaw[i] = Math.random() * 6.283; scl[i] = 0.7 + Math.random() * 1.0;
    phase[i] = Math.random() * 6.283; stiff[i] = 0.5 + Math.random() * 0.8;
  }
  const _s = new B.Vector3(), _q = new B.Quaternion(), _t = new B.Vector3(), _m = new B.Matrix();
  let lastPX = 0, lastPZ = 0;

  function update(playerPos, wind) {
    const px = playerPos.x, pz = playerPos.z;
    const moveAX = px - lastPX, moveAZ = pz - lastPZ; lastPX = px; lastPZ = pz;
    const t = wind.time;
    const R2 = RADIUS * RADIUS, inner = RADIUS * 0.62;
    for (let i = 0; i < COUNT; i++) {
      let bx = fx[i], bz = fz[i];
      const ddx = bx - px, ddz = bz - pz;
      if (ddx * ddx + ddz * ddz > R2) {
        const ang = Math.atan2(moveAZ, moveAX) + (Math.random() - 0.5) * 1.6;
        const rr = inner + Math.random() * (RADIUS - inner);
        bx = px + Math.cos(ang) * rr; bz = pz + Math.sin(ang) * rr;
        fx[i] = bx; fz[i] = bz; gy[i] = height(bx, bz);   // only recompute height on recycle
      }
      const sway = Math.sin(t * wind.speed + phase[i] + bx * 0.12) * wind.amp * stiff[i];
      _s.set(scl[i], scl[i] * (0.9 + Math.sin(phase[i]) * 0.15), scl[i]);
      B.Quaternion.RotationYawPitchRollToRef(yaw[i] + sway * 0.6, sway * 0.35, 0, _q);
      _t.set(bx, gy[i], bz);
      B.Matrix.ComposeToRef(_s, _q, _t, _m);
      _m.copyToArray(mats, i * 16);
    }
    blade.thinInstanceSetBuffer("matrix", mats, 16, true);
  }
  return { blade, update, COUNT };
}
