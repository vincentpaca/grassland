import * as B from '@babylonjs/core';
import { height } from './noise.js';

const ROSTER = [
  'bulbasaur', 'charmander', 'squirtle', 'pikachu', 'eevee', 'jigglypuff',
  'meowth', 'psyduck', 'oddish', 'geodude', 'magikarp', 'pidgey',
  'rattata', 'caterpie', 'zubat', 'diglett', 'clefairy', 'vulpix'
];
const META = {
  bulbasaur: { beh: 'wander', flee: 6, size: 1.5 }, charmander: { beh: 'approach', flee: 9, size: 1.5 },
  squirtle: { beh: 'wander', flee: 6, size: 1.5 }, pikachu: { beh: 'approach', flee: 9, size: 1.4 },
  eevee: { beh: 'flee', flee: 9, size: 1.4 }, jigglypuff: { beh: 'wander', flee: 7, size: 1.3 },
  meowth: { beh: 'flee', flee: 8, size: 1.3 }, psyduck: { beh: 'wander', flee: 6, size: 1.5 },
  oddish: { beh: 'flee', flee: 7, size: 1.0 }, geodude: { beh: 'wander', flee: 5, size: 1.3 },
  magikarp: { beh: 'wander', flee: 5, size: 1.5 }, pidgey: { beh: 'flee', flee: 8, size: 1.1 },
  rattata: { beh: 'flee', flee: 7, size: 1.0 }, caterpie: { beh: 'wander', flee: 5, size: 1.0 },
  zubat: { beh: 'flee', flee: 8, size: 1.0 }, diglett: { beh: 'wander', flee: 5, size: 1.0 },
  clefairy: { beh: 'approach', flee: 9, size: 1.4 }, vulpix: { beh: 'flee', flee: 8, size: 1.4 },
};

// Load a sprite PNG, crop transparent margins (so the creature fills the card), return a DynamicTexture.
function croppedTexture(scene, name) {
  const tex = new B.DynamicTexture('pok_' + name, { width: 4, height: 4 }, scene, false);
  tex.hasAlpha = true;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
    let data; try { data = cx.getImageData(0, 0, img.width, img.height).data; } catch (e) { return; }
    let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3] > 16) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (maxX < minX) return;
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    out.getContext('2d').drawImage(img, minX, minY, w, h, 0, 0, w, h);
    // resize texture to crop size
    tex.resize(w, h, false);
    const tctx = tex.getContext(); tctx.clearRect(0, 0, w, h); tctx.drawImage(out, 0, 0);
    tex.update(false);
  };
  img.src = '/pokemon/' + name + '.png';
  return tex;
}

export function createPokemon(scene, ctx) {
  const texCache = {};
  function texFor(name) { if (texCache[name]) return texCache[name]; const t = croppedTexture(scene, name); t.hasAlpha = true; texCache[name] = t; return t; }
  function makeMat(name) {
    const m = new B.PBRMaterial('pok' + name, scene); const t = texFor(name);
    m.albedoTexture = t; m.albedoColor = new B.Color3(1, 1, 1);
    m.useAlphaFromAlbedoTexture = true; m.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
    m.roughness = 1; m.metallic = 0; m.backFaceCulling = false; m.emissiveColor = new B.Color3(0.14, 0.14, 0.15);
    return m;
  }
  // shared blob shadow
  const shadowTex = (() => { const t = new B.DynamicTexture('pshadow', 64, scene, false); const c = t.getContext(); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); t.update(false); t.hasAlpha = true; return t; })();
  const shadowMat = new B.StandardMaterial('pshadowM', scene); shadowMat.diffuseTexture = shadowTex; shadowMat.opacityTexture = shadowTex; shadowMat.useAlphaFromDiffuseTexture = true; shadowMat.transparencyMode = B.Material.MATERIAL_ALPHABLEND; shadowMat.specularColor = new B.Color3(0, 0, 0); shadowMat.emissiveColor = new B.Color3(0, 0, 0); shadowMat.disableLighting = true; shadowMat.backFaceCulling = false;

  const list = [];
  const COUNT = 34;
  for (let i = 0; i < COUNT; i++) {
    const name = ROSTER[i % ROSTER.length]; const meta = META[name];
    let hx, hz;
    do { hx = (Math.random() - 0.5) * 250; hz = (Math.random() - 0.5) * 250; } while (Math.hypot(hx, hz) < 12);
    const size = meta.size;
    const plane = B.MeshBuilder.CreatePlane('pk' + i, { width: size, height: size }, scene);
    plane.billboardMode = B.Mesh.BILLBOARDMODE_Y; // upright, yaws to face camera — reads as placed, not screen-stuck
    plane.material = makeMat(name);
    plane.position.set(hx, height(hx, hz) + size * 0.5, hz); plane.applyFog = true; plane.isPickable = false;
    const sh = B.MeshBuilder.CreatePlane('pks' + i, { width: size * 0.9, height: size * 0.5 }, scene);
    sh.rotation.x = Math.PI / 2; sh.material = shadowMat; sh.isPickable = false; sh.applyFog = false;
    list.push({ name, meta, plane, shadow: sh, hx, hz, dir: Math.random() * 6.28, speed: 0.6 + Math.random() * 0.5, stateT: Math.random() * 3, moving: false, size, baseSize: size });
  }

  function update(dt, player) {
    for (const p of list) {
      const dx = p.plane.position.x - player.position.x, dz = p.plane.position.z - player.position.z;
      const dist = Math.hypot(dx, dz);
      let vx = 0, vz = 0;
      if (p.meta.beh === 'flee' && dist < p.meta.flee) { vx = dx / (dist || 1); vz = dz / (dist || 1); p.moving = true; }
      else if (p.meta.beh === 'approach' && dist > 3 && dist < 14) { vx = -dx / (dist || 1); vz = -dz / (dist || 1); p.moving = true; }
      else {
        p.stateT -= dt;
        if (p.stateT <= 0) { p.dir = Math.random() * 6.28; p.stateT = 2 + Math.random() * 3; p.moving = Math.random() < 0.7; }
        if (p.moving) { vx = Math.cos(p.dir); vz = Math.sin(p.dir); }
      }
      const nhx = p.plane.position.x + vx * p.speed * dt - p.hx, nhz = p.plane.position.z + vz * p.speed * dt - p.hz;
      if (Math.hypot(nhx, nhz) > 14) { p.dir += Math.PI; p.stateT = 1; }
      else { p.plane.position.x += vx * p.speed * dt; p.plane.position.z += vz * p.speed * dt; }
      const gy = height(p.plane.position.x, p.plane.position.z);
      // breathing scale + gentle bob
      const breathe = 1 + Math.sin(performance.now() * 0.003 + p.hx) * 0.03;
      p.plane.scaling.x = breathe; p.plane.scaling.y = breathe;
      p.plane.position.y = gy + p.baseSize * 0.5 * breathe + Math.sin(performance.now() * 0.003 + p.hx) * 0.03;
      p.shadow.position.set(p.plane.position.x, gy + 0.04, p.plane.position.z);
      p.shadow.scaling.set(1 / breathe, 0.6, 1);
    }
  }
  return { list, update };
}
