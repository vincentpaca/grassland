import * as B from '@babylonjs/core';
import { height } from './noise.js';

// Player = Mewtwo (#150). Mewtwo ALWAYS faces exactly where the camera looks (no lag, no lerping away).
// FACE_OFFSET = PI (Mewtwo's front is -Z; verified: this puts his back to the camera, facing where you look).
const GROUND_ADJUST = 0.0;
const FACE_OFFSET = Math.PI;
function findAG(groups, sub) { return groups.find(g => g.name.includes(sub)) || null; }
function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

export async function createTrainer(scene, ctx) {
  const res = await B.SceneLoader.ImportMeshAsync('', '/player/mewtwo.glb', null, scene);
  const root = res.meshes[0]; root.name = 'mewtwoRoot';
  const sk = res.skeletons && res.skeletons[0];
  if (sk) { res.meshes.forEach(m => { if (!m.skeleton) m.skeleton = sk; }); sk.enableBlending(0.08); }

  const groups = res.animationGroups || [];
  const rootBone = sk ? sk.bones.find(b => !b.getParent()) : null;
  const rootTN = rootBone && rootBone.transformNode;
  const AG = {
    idle: findAG(groups, 'defaultidle01') || findAG(groups, 'defaultwait01_loop') || groups[0],
    walk: findAG(groups, 'walk01_loop'),
    run: findAG(groups, 'run01_loop'),
    turnR: findAG(groups, 'turn_r090'),
    turnL: findAG(groups, 'turn_l090'),
  };
  // strip root-motion (position) so walk/run loop in place; strip root-bone channels from turn clips
  for (const g of groups) { const tas = g.targetedAnimations; for (let i = tas.length - 1; i >= 0; i--) if (tas[i].animation && tas[i].animation.targetProperty === 'position') tas.splice(i, 1); }
  if (rootTN) for (const key of ['turnR', 'turnL']) { const g = AG[key]; if (!g) continue; const tas = g.targetedAnimations; for (let i = tas.length - 1; i >= 0; i--) if (tas[i].target === rootTN) tas.splice(i, 1); }

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
  root.rotation.y = FACE_OFFSET;
  root.getChildMeshes().forEach(m => { m.applyFog = true; m.isPickable = false; if (ctx.shadow) ctx.shadow.addShadowCaster(m, true); });

  let prevCamYaw = 0;
  const player = {
    root, sk, AG, footOff, FACE_OFFSET, speed: 0, heading: 0, t: 0, state: 'idle',
    get position() { return root.position; },
    setHeading(h) { this.heading = h; root.rotation.y = h + FACE_OFFSET; },
    update(dt, vx, vz, wind, shift, camYaw) {
      this.t += dt;
      const sp = Math.hypot(vx, vz); this.speed = sp;
      // Mewtwo ALWAYS faces exactly where the camera looks — snap, never lag.
      this.heading = camYaw;
      root.rotation.y = camYaw + FACE_OFFSET;
      // turn anim fires only while you are orbiting the camera (camYaw changing)
      const dCam = wrap(camYaw - prevCamYaw); prevCamYaw = camYaw;
      let st = 'idle';
      if (Math.abs(dCam) > 0.02) st = dCam > 0 ? 'turnR' : 'turnL';
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
