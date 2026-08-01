import * as B from '@babylonjs/core';
import { height } from './noise.js';

const ROSTER = [
  'bulbasaur', 'charmander', 'squirtle', 'pikachu', 'eevee', 'jigglypuff',
  'meowth', 'psyduck', 'oddish', 'geodude', 'magikarp', 'pidgey',
  'rattata', 'caterpie', 'zubat', 'diglett', 'clefairy', 'vulpix'
];
const META = {
  bulbasaur: { beh: 'wander', flee: 6, size: 1.3 }, charmander: { beh: 'approach', flee: 9, size: 1.3 },
  squirtle: { beh: 'wander', flee: 6, size: 1.3 }, pikachu: { beh: 'approach', flee: 9, size: 1.2 },
  eevee: { beh: 'flee', flee: 9, size: 1.2 }, jigglypuff: { beh: 'wander', flee: 7, size: 1.1 },
  meowth: { beh: 'flee', flee: 8, size: 1.1 }, psyduck: { beh: 'wander', flee: 6, size: 1.3 },
  oddish: { beh: 'flee', flee: 7, size: 0.8 }, geodude: { beh: 'wander', flee: 5, size: 1.1 },
  magikarp: { beh: 'wander', flee: 5, size: 1.3 }, pidgey: { beh: 'flee', flee: 8, size: 0.9 },
  rattata: { beh: 'flee', flee: 7, size: 0.85 }, caterpie: { beh: 'wander', flee: 5, size: 0.8 },
  zubat: { beh: 'flee', flee: 8, size: 0.85 }, diglett: { beh: 'wander', flee: 5, size: 0.8 },
  clefairy: { beh: 'approach', flee: 9, size: 1.2 }, vulpix: { beh: 'flee', flee: 8, size: 1.2 },
};

export function createPokemon(scene, ctx) {
  const texCache = {};
  function texFor(name) {
    if (texCache[name]) return texCache[name];
    const t = new B.Texture('/pokemon/' + name + '.png', scene, false, true, B.Texture.TRILINEAR_SAMPLINGMODE);
    t.hasAlpha = true;
    texCache[name] = t; return t;
  }
  function makeMat(name) {
    const m = new B.PBRMaterial('pok' + name, scene);
    const t = texFor(name);
    m.albedoTexture = t; m.albedoColor = new B.Color3(1, 1, 1);
    m.useAlphaFromAlbedoTexture = true; m.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
    m.roughness = 1; m.metallic = 0; m.backFaceCulling = false; m.emissiveColor = new B.Color3(0.15, 0.15, 0.16);
    return m;
  }

  const list = [];
  const COUNT = 30;
  for (let i = 0; i < COUNT; i++) {
    const name = ROSTER[i % ROSTER.length];
    const meta = META[name];
    const hx = (Math.random() - 0.5) * 240, hz = (Math.random() - 0.5) * 240;
    if (Math.hypot(hx, hz) < 10) { i--; continue; }
    const size = meta.size;
    const plane = B.MeshBuilder.CreatePlane('pk' + i, { width: size, height: size }, scene);
    plane.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    plane.material = makeMat(name);
    plane.position.set(hx, height(hx, hz) + size * 0.5, hz);
    plane.applyFog = true; plane.isPickable = false;
    if (ctx.shadow) { plane.receiveShadows = false; }
    list.push({ name, meta, plane, hx, hz, dir: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 0.5, stateT: Math.random() * 3, moving: false, size });
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
        if (p.stateT <= 0) { p.dir = Math.random() * Math.PI * 2; p.stateT = 2 + Math.random() * 3; p.moving = Math.random() < 0.7; }
        if (p.moving) { vx = Math.cos(p.dir); vz = Math.sin(p.dir); }
      }
      // keep within home radius
      const hx = p.plane.position.x + vx * p.speed * dt - p.hx;
      const hz = p.plane.position.z + vz * p.speed * dt - p.hz;
      const hr = Math.hypot(hx, hz);
      if (hr > 14) { p.dir += Math.PI; p.stateT = 1; }
      else {
        p.plane.position.x += vx * p.speed * dt;
        p.plane.position.z += vz * p.speed * dt;
      }
      p.plane.position.y = height(p.plane.position.x, p.plane.position.z) + p.size * 0.5;
      // gentle bob
      p.plane.position.y += Math.sin(performance.now() * 0.003 + p.hx) * 0.04;
    }
  }
  return { list, update };
}
