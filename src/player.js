import * as B from '@babylonjs/core';
import { height } from './noise.js';

// Player = Mixamo "Big Vegas" character + Mixamo Walking animation (retargeted by bone name).
export async function createTrainer(scene, ctx) {
  const charRes = await B.SceneLoader.ImportMeshAsync('', '/player/character.glb', null, scene);
  const root = charRes.meshes[0]; root.name = 'trainerRoot';
  const sk = charRes.skeletons && charRes.skeletons[0];

  // load walk anim and retarget its bones to the character skeleton by name
  const walkRes = await B.SceneLoader.ImportMeshAsync('', '/player/walk.glb', null, scene);
  const walkAG = walkRes.animationGroups && walkRes.animationGroups[0];
  if (sk && walkAG) {
    const map = {}; sk.bones.forEach(b => { map[b.name] = b.transformNode; });
    walkAG.targetedAnimations.forEach(ta => { const tn = map[ta.target.name]; if (tn) ta.target = tn; });
  }
  // hide any stray meshes from the anim file
  walkRes.meshes.forEach(m => m.setEnabled(false));

  // normalise scale to ~1.8m, feet at local 0
  let bb = root.getHierarchyBoundingVectors(true);
  const h = Math.max(0.001, bb.max.y - bb.min.y);
  const s = 1.8 / h;
  root.scaling.set(s, s, s);
  root.getChildMeshes().forEach(m => m.computeWorldMatrix(true));
  bb = root.getHierarchyBoundingVectors(true);
  const footOff = bb.min.y;
  root.position.set(0, height(0, 0) - footOff, 0);
  root.getChildMeshes().forEach(m => { m.applyFog = true; m.isPickable = false; if (ctx.shadow) ctx.shadow.addShadowCaster(m, true); });

  if (walkAG) { walkAG.start(true, 1.0); }
  const player = {
    root, anim: walkAG, footOff, speed: 0, heading: 0,
    get position() { return root.position; },
    setHeading(h) { this.heading = h; root.rotation.y = h; },
    update(dt, vx, vz, wind) {
      const sp = Math.hypot(vx, vz); this.speed = sp;
      if (walkAG) {
        const target = sp > 0.1 ? Math.min(1.6, 0.7 + sp * 0.22) : 0.0001;
        walkAG.speedRatio += (target - walkAG.speedRatio) * Math.min(1, dt * 6);
      }
      root.position.y = height(root.position.x, root.position.z) - footOff;
    }
  };
  return player;
}
