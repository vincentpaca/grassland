import * as B from '@babylonjs/core';
import { height } from './noise.js';

// Snow-surf ("Surf") — RMB hold. Eased in/out, accelerated carving, deep groove + berms, spray wake.
export function createSurf(scene, ctx) {
  const surfT = { v: 0 };            // 0 walking, 1 surfing (eased)
  const groove = { lastX: 0, lastZ: 0, set: false };

  // wake spray plume
  const wake = new B.ParticleSystem('wake', 800, scene);
  wake.particleTexture = ctx.sprayTex;
  wake.emitter = new B.Vector3(0, 0, 0);
  wake.minEmitBox = new B.Vector3(-0.3, 0, -0.3); wake.maxEmitBox = new B.Vector3(0.3, 0.6, 0.3);
  wake.color1 = new B.Color4(1, 1, 1, 1); wake.color2 = new B.Color4(0.85, 0.9, 1, 1);
  wake.colorDead = new B.Color4(0.9, 0.93, 1, 0);
  wake.minSize = 0.08; wake.maxSize = 0.28; wake.minLifeTime = 0.3; wake.maxLifeTime = 0.8;
  wake.emitRate = 0; wake.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
  wake.direction1 = new B.Vector3(-1, 1.5, -1); wake.direction2 = new B.Vector3(1, 2.5, 1);
  wake.minEmitPower = 1.5; wake.maxEmitPower = 5.0; wake.updateSpeed = 0.016;
  wake.gravity = new B.Vector3(0, -7, 0);
  wake.start();

  // wake crest ribbon (curled displaced snow behind, raised to outside of turn)
  const crestPath = [];
  for (let i = 0; i < 24; i++) crestPath.push(new B.Vector3(0, 0, 0));
  const crest = B.MeshBuilder.CreateTube('crest', { path: crestPath, radius: 0.12, updatable: true, tessellation: 8, cap: B.Mesh.CAP_ALL }, scene);
  crest.material = ctx.matSnow;
  if (ctx.shadow) ctx.shadow.addShadowCaster(crest, true);
  crest.applyFog = true;
  const crestPoints = crestPath;

  return {
    surfT,
    update(dt, player, input, speed, heading, mouseDX) {
      // ease in/out
      const target = input.rmb ? 1 : 0;
      surfT.v += (target - surfT.v) * Math.min(1, dt * 4);
      const s = surfT.v;
      if (s < 0.02) { wake.emitRate = 0; return { speedMul: 1, turn: 0, surfing: false }; }

      // carve: mouse X steers; turning at speed throws wake to the outside
      const turn = mouseDX * 0.02 * s;
      // spray plume behind, stronger with speed and |turn|
      const ppos = player.position;
      wake.emitter = new B.Vector3(ppos.x, ppos.y + 0.2, ppos.z - Math.cos(heading) * 0.6);
      wake.emitRate = 200 + speed * 60 * (1 + Math.abs(turn) * 4);
      wake.direction1.z = -Math.cos(heading) * 2 - 1; wake.direction2.z = -Math.cos(heading) * 2 + 1;

      // carve a deep groove + berms into the deformation field
      const p = player.position;
      if (!groove.set) { groove.lastX = p.x; groove.lastZ = p.z; groove.set = true; }
      const dx = p.x - groove.lastX, dz = p.z - groove.lastZ;
      const moved = Math.hypot(dx, dz);
      if (moved > 0.02) {
        // direction perpendicular (outside of turn)
        const nx = -dz / moved, nz = dx / moved;
        const grooveDepth = 0.22 * s * Math.min(1, speed * 1.5);
        const berm = 0.20 * s * Math.min(1, speed * 1.5);
        ctx.terrain.deform.stamp(p.x, p.z, 0.34, grooveDepth, 'depress');
        // berms on both sides, heavier on outside of turn
        const sideBias = Math.sign(turn) || 1;
        ctx.terrain.deform.stamp(p.x + nx * 0.25, p.z + nz * 0.25, 0.5, berm * (1 + Math.abs(turn) * 3) * (sideBias > 0 ? 1.2 : 0.7), 'berm');
        ctx.terrain.deform.stamp(p.x - nx * 0.25, p.z - nz * 0.25, 0.5, berm * (1 + Math.abs(turn) * 3) * (sideBias > 0 ? 0.7 : 1.2), 'berm');
        ctx.terrain.deform.stamp(p.x, p.z, 0.4, 0.4 * s, 'wet');
        groove.lastX = p.x; groove.lastZ = p.z;
      }

      // wake crest ribbon: a curling arc behind, raised to the outside
      const back = -1; const perp = Math.sign(turn) || 1;
      const upAmt = 0.3 + Math.abs(turn) * 1.2;
      for (let i = 0; i < crestPoints.length; i++) {
        const f = i / (crestPoints.length - 1);
        const dist = f * 3.0 * s;
        const curl = Math.sin(f * Math.PI * 0.7) * (1 + Math.abs(turn) * 6);
        const cx = p.x - Math.cos(heading) * dist + (-Math.sin(heading)) * curl * perp;
        const cz = p.z - Math.sin(heading) * dist + (Math.cos(heading)) * curl * perp;
        crestPoints[i].set(cx, height(p.x, p.z) + upAmt * Math.sin(f * Math.PI), cz);
      }
      // update crest tube radius (taper)
      B.MeshBuilder.CreateTube('crest', { path: crestPoints, radius: 0.12 * s, instance: crest, updatable: true, tessellation: 8, cap: B.Mesh.CAP_ALL }, scene);

      return { speedMul: 1 + s * 1.6, turn, surfing: s > 0.5 };
    }
  };
}
