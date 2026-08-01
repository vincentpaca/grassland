import * as B from '@babylonjs/core';
import { height } from './noise.js';

// Player = Mewtwo (#150). Camera-relative movement; Mewtwo smoothly turns to FACE its movement
// direction (so turning can never appear "reversed" — it always faces where it's going).
// FACE_OFFSET: 0 if Mewtwo's front is +Z; flip to Math.PI if it walks backward (faces away from movement).
const FACE_OFFSET = 0;
const GROUND_ADJUST = 0.0;
function findAG(groups, sub) { return groups.find(g => g.name.includes(sub)) || null; }
function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

export async function createTrainer(scene, ctx) {
  const res = await B.SceneLoader.ImportMeshAsync('', '/player/mewtwo.glb', null, scene);
  const root = res.meshes[0]; root.name = 'mewtwoRoot';
  const sk = res.skeletons && res.skeletons[0];
  if (sk) { res.meshes.forEach(m => { if (!m.skeleton) m.skeleton = sk; }); sk.enableBlending(0.08); }

  const groups = res.animationGroups || [];
  for (const g of groups) { const tas = g.targetedAnimations; for (let i = tas.length - 1; i >= 0; i--) if (tas[i].animation && tas[i].animation.targetProperty === 'position') tas.splice(i, 1); }
  const AG = {
    idle: findAG(groups, 'defaultidle01') || findAG(groups, 'defaultwait01_loop') || groups[0],
    walk: findAG(groups, 'walk01_loop'),
    run: findAG(groups, 'run01_loop'),
    turnR: findAG(groups, 'turn_r090'),
    turnL: findAG(groups, 'turn_l090'),
  };
  if (sk) { const rb = sk.bones.find(b => !b.getParent()); const rtn = rb && rb.transformNode;
    if (rtn) for (const key of ['turnR','turnL']) { const g = AG[key]; if (!g) continue; const tas = g.targetedAnimations; for (let i = tas.length - 1; i >= 0; i--) if (tas[i].target === rtn) tas.splice(i, 1); } }
  let current = null;
  function play(name) { const g = AG[name]; if (!g || g === current) return; for (const kk in AG) { if (AG[kk] && AG[kk] !== g) AG[kk].stop(); } g.start(true, 1.0); current = g; }
  play('idle');

  let bb = root.getHierarchyBoundingVectors(true);
  const h = Math.max(0.001, bb.max.y - bb.min.y);
  const s = 2.4 / h;
  root.scaling.set(s, s, s);
  root.getChildMeshes().forEach(m => m.computeWorldMatrix(true));
  bb = root.getHierarchyBoundingVectors(true);
  const footOff = bb.min.y + GROUND_ADJUST;
  root.position.set(0, height(0, 0) - footOff, 0);
  root.getChildMeshes().forEach(m => { m.applyFog = true; m.isPickable = false; if (ctx.shadow) ctx.shadow.addShadowCaster(m, true); });

  const player = {
    root, sk, AG, footOff, speed: 0, heading: 0, t: 0, state: 'idle',
    get position() { return root.position; },
    setHeading(h) { this.heading = h; root.rotation.y = h + FACE_OFFSET; },
    update(dt, vx, vz, wind, shift) {
      this.t += dt;
      const sp = Math.hypot(vx, vz); this.speed = sp;
      // face the movement direction (smoothly). This guarantees Mewtwo faces where it walks.
      const targetH = sp > 0.1 ? Math.atan2(vx, vz) : this.heading;
      const dH = wrap(targetH - this.heading);
      this.heading += dH * Math.min(1, dt * 8);
      root.rotation.y = this.heading + FACE_OFFSET;
      let st = 'idle';
      if (sp > 0.3 && Math.abs(dH) > 0.15) st = dH > 0 ? 'turnR' : 'turnL';   // turning to face a new direction
      else if (sp > 0.3 && shift) st = 'run';
      else if (sp > 0.3) st = 'walk';
      if (st !== this.state) { play(st); this.state = st; }
      if (current) { const target = st === 'run' ? 1.3 : st === 'walk' ? 1.1 : st === 'idle' ? 1.0 : 1.2; current.speedRatio += (target - current.speedRatio) * Math.min(1, dt * 5); }
      root.position.y = height(root.position.x, root.position.z) - footOff;
      root.rotation.x = -Math.min(0.25, sp * 0.05);
      root.rotation.z = 0;
    }
  };
  return player;
}
