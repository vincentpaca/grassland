import * as B from '@babylonjs/core';

// Ice-type moves. Shared grammar: ease in from the snow, carry momentum, settle back, write the deformation field.
// Keys 1..5 -> Powder Snow, Ice Beam, Blizzard, Aurora Beam, Sheer Cold.
export const SPELLS = [
  { key: '1', name: 'POWDER SNOW', dur: 1.1, color: [0.8, 0.9, 1.0], light: [0.6, 0.8, 1.0] },
  { key: '2', name: 'ICE BEAM', dur: 1.4, color: [0.7, 0.85, 1.0], light: [0.5, 0.75, 1.0] },
  { key: '3', name: 'BLIZZARD', dur: 1.8, color: [0.85, 0.92, 1.0], light: [0.55, 0.78, 1.0] },
  { key: '4', name: 'AURORA BEAM', dur: 1.6, color: [0.4, 1.0, 0.7], light: [0.3, 1.0, 0.6] },
  { key: '5', name: 'SHEER COLD', dur: 2.0, color: [0.9, 0.95, 1.0], light: [0.7, 0.85, 1.0] },
];

export function createSpells(scene, ctx) {
  const active = []; // {cfg, t, light, ps, ribbon}

  function makePS(cap, tex, color) {
    const ps = new B.ParticleSystem('spell', cap, scene);
    ps.particleTexture = tex;
    ps.color1 = new B.Color4(color[0], color[1], color[2], 1);
    ps.color2 = new B.Color4(color[0] * 1.1, color[1] * 1.1, color[2], 1);
    ps.colorDead = new B.Color4(color[0], color[1], color[2], 0);
    ps.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    ps.minSize = 0.08; ps.maxSize = 0.4; ps.minLifeTime = 0.3; ps.maxLifeTime = 1.0;
    ps.gravity = new B.Vector3(0, -2, 0); ps.updateSpeed = 0.016;
    ps.emitRate = 0; ps.start();
    return ps;
  }

  function cast(idx, player, heading) {
    const cfg = SPELLS[idx];
    const tex = ctx.sprayTex;
    const light = new B.PointLight('spellL', player.position.clone(), scene);
    light.diffuse = new B.Color3(cfg.light[0], cfg.light[1], cfg.light[2]);
    light.intensity = 0; light.range = 12;
    const ps = makePS(600, tex, cfg.color);
    ps.emitter = player.position.clone();
    // ribbon for beam/aurora
    let ribbon = null, ribbonPath = [];
    if (idx === 1 || idx === 3) {
      for (let i = 0; i < 16; i++) ribbonPath.push(new B.Vector3(0, 0, 0));
      ribbon = B.MeshBuilder.CreateTube('beam', { path: ribbonPath, radius: 0.08, updatable: true, tessellation: 8, cap: B.Mesh.CAP_ALL }, scene);
      const rm = new B.PBRMaterial('beamM', scene);
      rm.albedoColor = new B.Color3(cfg.color[0], cfg.color[1], cfg.color[2]);
      rm.alpha = 0.6; rm.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
      rm.roughness = 0.1; rm.metallic = 0; rm.emissiveColor = new B.Color3(cfg.color[0] * 0.6, cfg.color[1] * 0.6, cfg.color[2] * 0.6);
      ribbon.material = rm; ribbon.applyFog = true; ribbon.isPickable = false;
    }
    active.push({ cfg, idx, t: 0, light, ps, ribbon, ribbonPath, heading });
    return cfg.name;
  }

  function update(dt, player, heading) {
    for (let k = active.length - 1; k >= 0; k--) {
      const s = active[k]; s.t += dt;
      const f = s.t / s.cfg.dur;
      const ease = f < 0.2 ? (f / 0.2) : (f > 0.8 ? Math.max(0, 1 - (f - 0.8) / 0.2) : 1);
      s.light.intensity = ease * 4;
      const p = player.position;
      s.ps.emitter = p.clone();
      s.ps.emitRate = 600 * ease;
      const cfg = s.cfg;

      if (s.idx === 0) { // POWDER SNOW — forward fan of powder, shallow depressions+wet
        const fwd = 1 + ease * 4;
        s.ps.direction1 = new B.Vector3(-0.8, 0.8, 1 * fwd); s.ps.direction2 = new B.Vector3(0.8, 2, 1.4 * fwd);
        s.ps.minEmitPower = 1; s.ps.maxEmitPower = 3;
        for (let i = 0; i < 3; i++) {
          const a = heading + (i - 1) * 0.6;
          ctx.terrain.deform.stamp(p.x + Math.cos(a) * 1.2, p.z + Math.sin(a) * 1.2, 0.6, 0.06 * ease, 'depress');
          ctx.terrain.deform.stamp(p.x + Math.cos(a) * 1.2, p.z + Math.sin(a) * 1.2, 0.7, 0.3 * ease, 'wet');
        }
      } else if (s.idx === 1) { // ICE BEAM — held beam forward, thin groove + ice
        const len = 5 + ease * 2;
        s.ps.direction1 = new B.Vector3(-0.2, -0.2, 1); s.ps.direction2 = new B.Vector3(0.2, 0.2, 1);
        s.ps.minEmitPower = 4; s.ps.maxEmitPower = 9;
        for (let i = 0; i < ribbonPath.length; i++) {
          const ff = i / (ribbonPath.length - 1) * len;
          ribbonPath[i].set(p.x + Math.cos(heading) * ff, p.y + 0.5, p.z + Math.sin(heading) * ff);
        }
        B.MeshBuilder.CreateTube('beam', { path: ribbonPath, radius: 0.08 * ease, instance: s.ribbon, updatable: true, tessellation: 8, cap: B.Mesh.CAP_ALL }, scene);
        s.light.position = new B.Vector3(p.x + Math.cos(heading) * len * 0.7, p.y + 0.5, p.z + Math.sin(heading) * len * 0.7);
        ctx.terrain.deform.stamp(p.x + Math.cos(heading) * len * 0.5, p.z + Math.sin(heading) * len * 0.5, 0.25, 0.12 * ease, 'depress');
        ctx.terrain.deform.stamp(p.x + Math.cos(heading) * len * 0.5, p.z + Math.sin(heading) * len * 0.5, 0.35, 0.6 * ease, 'ice');
      } else if (s.idx === 2) { // BLIZZARD — swirling storm around player, thins surface
        s.ps.direction1 = new B.Vector3(-3, 1, -3); s.ps.direction2 = new B.Vector3(3, 4, 3);
        s.ps.minEmitPower = 2; s.ps.maxEmitPower = 6;
        const r = 2 + ease * 1.5;
        for (let a = 0; a < 6; a++) {
          const ang = a / 6 * Math.PI * 2 + s.t * 4;
          ctx.terrain.deform.stamp(p.x + Math.cos(ang) * r, p.z + Math.sin(ang) * r, 0.7, 0.04 * ease, 'depress');
          ctx.terrain.deform.stamp(p.x + Math.cos(ang) * r, p.z + Math.sin(ang) * r, 0.8, 0.4 * ease, 'wet');
        }
        ctx.terrain.deform.stamp(p.x, p.z, 2.0, 0.05 * ease, 'depress');
      } else if (s.idx === 3) { // AURORA BEAM — sweeping aurora ribbon, ice
        const sweep = Math.sin(s.t * 3) * 2;
        for (let i = 0; i < ribbonPath.length; i++) {
          const ff = i / (ribbonPath.length - 1) * 4;
          const wob = Math.sin(ff * 3 + s.t * 6) * 0.6;
          ribbonPath[i].set(p.x + Math.cos(heading) * ff, p.y + 0.6 + wob + sweep, p.z + Math.sin(heading) * ff);
        }
        B.MeshBuilder.CreateTube('beam', { path: ribbonPath, radius: 0.1 * ease, instance: s.ribbon, updatable: true, tessellation: 8, cap: B.Mesh.CAP_ALL }, scene);
        s.light.diffuse = new B.Color3(0.3 + Math.sin(s.t * 4) * 0.3, 1, 0.6 + Math.cos(s.t * 3) * 0.3);
        ctx.terrain.deform.stamp(p.x + Math.cos(heading) * 2 + sweep, p.z + Math.sin(heading) * 2, 0.5, 0.7 * ease, 'ice');
      } else if (s.idx === 4) { // SHEER COLD — eruption column, crater with rim, glittering fallout
        s.ps.direction1 = new B.Vector3(-0.4, 4, -0.4); s.ps.direction2 = new B.Vector3(0.4, 8, 0.4);
        s.ps.minEmitPower = 3; s.ps.maxEmitPower = 10; s.ps.gravity = new B.Vector3(0, -4, 0);
        ctx.terrain.deform.stamp(p.x, p.z, 1.4, 0.5 * ease, 'crater');
      }

      if (f >= 1) {
        s.light.dispose(); s.ps.dispose();
        if (s.ribbon) s.ribbon.dispose();
        active.splice(k, 1);
      }
    }
  }

  return { cast, update, active };
}
