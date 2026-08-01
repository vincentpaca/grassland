import * as B from '@babylonjs/core';
import { height, valueNoise } from './noise.js';

// Dense swaying grass via thin-instanted blades with CPU wind. Follows the player and glues to terrain.
function bladeTexture(scene) {
  const w = 32, h = 64;
  const t = new B.DynamicTexture('blade', { width: w, height: h }, scene, false);
  t.hasAlpha = true;
  const c = t.getContext();
  c.clearRect(0, 0, w, h);
  // a soft green blade: widest at base, tapering to a point at top, alpha falloff on sides
  for (let y = 0; y < h; y++) {
    const f = y / (h - 1);                 // 0 base -> 1 tip
    const half = (1 - f) * (w * 0.5) * 0.9 + 1.0;
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - w / 2) / half;
      if (d > 1) continue;
      const a = (1 - d) * (0.35 + 0.65 * (1 - f * 0.3));
      const g = 0.45 + (1 - f) * 0.3 + Math.random() * 0.06;
      c.fillStyle = `rgba(${Math.round(60 + (1 - f) * 30)},${Math.round(160 * g)},${Math.round(55 + (1 - f) * 20)},${a})`;
      c.fillRect(x, h - 1 - y, 1, 1);
    }
  }
  t.update(false);
  return t;
}

export function createGrass(scene, ctx) {
  const blade = B.MeshBuilder.CreatePlane('blade', { width: 0.12, height: 0.55, sideOrientation: B.Mesh.DOUBLESIDE }, scene);
  // shift so base at y=0 (pivot at ground)
  const p = blade.getVerticesData(B.VertexBuffer.PositionKind);
  for (let i = 0; i < p.length / 3; i++) p[i * 3 + 1] += 0.275;
  blade.setVerticesData(B.VertexBuffer.PositionKind, p);
  const mat = new B.StandardMaterial('bladeM', scene);
  const tex = bladeTexture(scene);
  mat.diffuseTexture = tex; mat.diffuseTexture.hasAlpha = true;
  mat.useAlphaFromDiffuseTexture = true;
  mat.opacityTexture = tex;
  mat.transparencyMode = B.Material.MATERIAL_ALPHATEST;
  mat.backFaceCulling = false;
  mat.specularColor = new B.Color3(0.05, 0.08, 0.05);
  mat.emissiveColor = new B.Color3(0.03, 0.05, 0.02);
  mat.disableLighting = false;
  blade.material = mat; blade.applyFog = true; blade.isPickable = false; blade.receiveShadows = false;
  if (ctx.shadow) ctx.shadow.addShadowCaster(blade, true);

  const COUNT = 4200;
  const RADIUS = 26;
  const mats = new Float32Array(COUNT * 16);
  // per-blade persistent data
  const data = [];
  for (let i = 0; i < COUNT; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * RADIUS;
    data.push({
      lx: Math.cos(ang) * r, lz: Math.sin(ang) * r,
      yaw: Math.random() * Math.PI * 2, scale: 0.7 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2, stiff: 0.5 + Math.random() * 0.8,
    });
  }
  const _s = new B.Vector3(1, 1, 1);
  const _q = new B.Quaternion();
  const _t = new B.Vector3();
  const _m = new B.Matrix();

  function update(playerPos, wind) {
    const cx = playerPos.x, cz = playerPos.z;
    const t = wind.time;
    for (let i = 0; i < COUNT; i++) {
      const d = data[i];
      const wx = cx + d.lx, wz = cz + d.lz;
      const gy = height(wx, wz);
      // wind sway: yaw wobble + lean (encoded as yaw around ground normal-ish via pitch)
      const sway = Math.sin(t * wind.speed + d.phase + wx * 0.12) * wind.amp * d.stiff;
      const yaw = d.yaw + sway * 0.6;
      _s.set(d.scale, d.scale * (0.9 + Math.sin(d.phase) * 0.15), d.scale);
      B.Quaternion.RotationYawPitchRollToRef(yaw, sway * 0.35, 0, _q);
      _t.set(wx, gy, wz);
      B.Matrix.ComposeToRef(_s, _q, _t, _m);
      _m.copyToArray(mats, i * 16);
    }
    blade.thinInstanceSetBuffer("matrix", mats, 16, true);
  }
  return { blade, update, COUNT };
}
