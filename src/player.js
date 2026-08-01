import * as B from '@babylonjs/core';
import { height } from './noise.js';

// Player = CesiumMan (rigged walking human, Khronos glTF sample). Loads a GLB, plays walk anim.
export async function createTrainer(scene, ctx) {
  const result = await B.SceneLoader.ImportMeshAsync('', '/player/trainer.glb', null, scene);
  const root = result.meshes[0];
  root.name = 'trainerRoot';
  // normalise scale to ~1.7m, feet at local 0
  let bb = root.getHierarchyBoundingVectors(true);
  const h = Math.max(0.001, bb.max.y - bb.min.y);
  const s = 1.7 / h;
  root.scaling.set(s, s, s);
  root.getChildMeshes().forEach(m => m.computeWorldMatrix(true));
  bb = root.getHierarchyBoundingVectors(true);
  const footOff = bb.min.y; // world y of feet when root at origin
  root.position.set(0, height(0, 0) - footOff, 0);
  root.getChildMeshes().forEach(m => { m.applyFog = true; m.isPickable = false; if (ctx.shadow) ctx.shadow.addShadowCaster(m, true); });

  const anim = result.animationGroups && result.animationGroups[0];
  if (anim) { anim.start(true); anim.speedRatio = 0; }

  const player = {
    root, anim, footOff, speed: 0, heading: 0,
    get position() { return root.position; },
    setHeading(h) { this.heading = h; root.rotation.y = h; },
    update(dt, vx, vz, wind) {
      const sp = Math.hypot(vx, vz); this.speed = sp;
      if (anim) {
        const target = sp > 0.1 ? Math.min(1.4, 0.5 + sp * 0.18) : 0;
        anim.speedRatio += (target - anim.speedRatio) * Math.min(1, dt * 6);
        if (anim.speedRatio < 0.01 && !anim.paused) anim.pause();
        else if (anim.speedRatio >= 0.01 && anim.paused) anim.restart();
      }
      // glue feet to terrain (account for model foot offset)
      root.position.y = height(root.position.x, root.position.z) - footOff;
    }
  };
  return player;
}
