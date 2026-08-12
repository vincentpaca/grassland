import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { height } from './noise.js';
import { fitToHeight } from './fit.js';

// Standard 3rd-person controller (Genshin/Zelda style):
//  - WASD moves the character relative to the CAMERA (W = where the camera looks).
//  - The character SMOOTHLY TURNS TO FACE its movement direction (faces where it walks).
//  - When idle, it keeps its last facing. The camera is independent (mouse orbits).
//  - Turn anims only on a sharp pivot (>~115°), so normal steering doesn't twitch.
const GROUND_ADJUST = 0.0;
const MEWTWO_H = 2.0;          // Pokedex height in metres; world is 1 unit = 1 m
// Measured from the skeleton (ankle->toe and tail->eyes bones): this model's front is +Z,
// so rotation.y = camYaw already points him where the camera looks. It was PI, which spun him
// around to face the camera and made him walk backwards.
const FACE_OFFSET = 0;
const TURN_PIVOT = 2.0;        // rad of remaining reorient that triggers a turn-clip
function findAG(groups, sub) { return groups.find(g => g.name.includes(sub)) || null; }
function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

export async function createTrainer(scene, ctx) {
  const res = await SceneLoader.ImportMeshAsync('', '/player/mewtwo.glb', null, scene);
  const root = res.meshes[0]; root.name = 'mewtwoRoot';
  const sk = res.skeletons && res.skeletons[0];
  if (sk) { res.meshes.forEach(m => { if (!m.skeleton) m.skeleton = sk; }); sk.enableBlending(0.1); }

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
  for (const g of groups) { const tas = g.targetedAnimations; for (let i = tas.length - 1; i >= 0; i--) if (tas[i].animation && tas[i].animation.targetProperty === 'position') tas.splice(i, 1); }
  if (rootTN) for (const key of ['turnR', 'turnL']) { const g = AG[key]; if (!g) continue; const tas = g.targetedAnimations; for (let i = tas.length - 1; i >= 0; i--) if (tas[i].target === rootTN) tas.splice(i, 1); }

  let current = null;
  function play(name) { const g = AG[name]; if (!g || g === current) return; for (const kk in AG) { if (AG[kk] && AG[kk] !== g) AG[kk].stop(); } g.start(true, 1.0); current = g; }
  play('idle');

  // glTF gives the root a rotationQuaternion, and Babylon IGNORES .rotation while one exists,
  // so every heading write was a no-op: Mewtwo never turned, whatever the camera or input did.
  root.rotationQuaternion = null;
  root.rotation.set(0, FACE_OFFSET, 0);
  // rough fit from the bind pose; recalibrated against the ANIMATED pose on the first update
  const bb = root.getHierarchyBoundingVectors(true);
  const h = Math.max(0.001, bb.max.y - bb.min.y);
  const s = MEWTWO_H / h;
  root.scaling.set(s, s, s);
  root.position.set(0, height(0, 0), 0);
  root.getChildMeshes().forEach(m => {
    m.applyFog = true; m.isPickable = false; m.receiveShadows = true;
    // glTF exports often ship metallic=1, which renders black without a strong environment map
    if (m.material) {
      if (m.material.unlit) m.material.unlit = false;
      if (typeof m.material.metallic === 'number') m.material.metallic = 0;
      if (typeof m.material.roughness === 'number') m.material.roughness = 0.82;
      m.material.specularIntensity = 0.12;
      m.material.environmentIntensity = 0.7;
    }
    if (ctx.shadow) ctx.shadow.addShadowCaster(m, true);
  });

  const player = {
    root, sk, AG, footOff: 0, calibrated: false, FACE_OFFSET, speed: 0, heading: 0, t: 0, state: 'idle',
    get position() { return root.position; },
    setHeading(h) { this.heading = h; root.rotation.y = h + FACE_OFFSET; },
    update(dt, vx, vz, wind, shift, camYaw) {
      if (!this.calibrated) {
        // fit to the current animated pose on the first update, after the skeleton has been drawn once
        const fit = fitToHeight(root, MEWTWO_H);
        this.footOff = fit.footOff + GROUND_ADJUST;
        this.calibrated = true;
      }
      this.t += dt;
      const sp = Math.hypot(vx, vz); this.speed = sp;
      // Standard 3rd-person: the character's yaw IS the camera yaw. He always keeps his back to
      // the camera and faces exactly where you are looking, whether moving or standing still.
      // No lag, no "turn to movement" - orbit the camera and he turns with it.
      if (typeof camYaw === 'number') this.heading = camYaw;
      else if (sp > 0.1) this.heading = Math.atan2(vx, vz);      // fallback if no camera supplied
      root.rotation.y = this.heading + FACE_OFFSET;
      // Facing snaps to the camera, so the 90-degree pivot clips no longer apply: they would
      // play *after* the rotation already happened and fight it. Idle / walk / run only.
      let st = 'idle';
      if (sp > 0.3 && shift) st = 'run';
      else if (sp > 0.3) st = 'walk';
      if (st !== this.state) { play(st); this.state = st; }
      if (current) { const target = st === 'run' ? 1.3 : st === 'walk' ? 1.1 : st === 'idle' ? 1.0 : 1.2; current.speedRatio += (target - current.speedRatio) * Math.min(1, dt * 5); }
      root.position.y = height(root.position.x, root.position.z) - this.footOff;
      root.rotation.x = -Math.min(0.25, sp * 0.05);
      root.rotation.z = 0;
    }
  };
  return player;
}
