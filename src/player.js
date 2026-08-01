import * as B from '@babylonjs/core';
import { height } from './noise.js';

// Player = Mewtwo (Pokemon-3D-api/assets #150), Draco+WebP. Hovers/flies (no walk).
const HOVER = 1.5; // metres above ground
export async function createTrainer(scene, ctx) {
  const res = await B.SceneLoader.ImportMeshAsync('', '/player/mewtwo.glb', null, scene);
  const root = res.meshes[0]; root.name = 'mewtwoRoot';
  const sk = res.skeletons && res.skeletons[0];
  if (sk) res.meshes.forEach(m => { if (!m.skeleton) m.skeleton = sk; });

  // pick the hover idle loop
  const groups = res.animationGroups || [];
  let idle = groups.find(a => a.name.includes('defaultwait01_loop')) || groups.find(a => a.name.includes('wait')) || groups[0];
  let run = groups.find(a => a.name.includes('run01_loop')) || groups.find(a => a.name.includes('run'));
  if (idle) idle.start(true, 1.0);

  // normalise scale to ~2.4m tall
  let bb = root.getHierarchyBoundingVectors(true);
  const h = Math.max(0.001, bb.max.y - bb.min.y);
  const s = 2.4 / h;
  root.scaling.set(s, s, s);
  root.getChildMeshes().forEach(m => m.computeWorldMatrix(true));
  bb = root.getHierarchyBoundingVectors(true);
  const center = (bb.max.y + bb.min.y) * 0.5;
  root.scaling.set(s, s, s);
  root.position.set(0, height(0, 0) + HOVER, 0);
  root.getChildMeshes().forEach(m => { m.applyFog = true; m.isPickable = false; if (ctx.shadow) ctx.shadow.addShadowCaster(m, true); });

  const player = {
    root, idle, run, s, speed: 0, heading: 0, t: 0,
    get position() { return root.position; },
    setHeading(h) { this.heading = h; root.rotation.y = h; },
    update(dt, vx, vz, wind) {
      this.t += dt;
      const sp = Math.hypot(vx, vz); this.speed = sp;
      if (this.idle) { const target = sp > 0.1 ? 1.3 : 1.0; this.idle.speedRatio += (target - this.idle.speedRatio) * Math.min(1, dt * 4); }
      // float: hover above terrain with a gentle bob; lean into movement
      const bob = Math.sin(this.t * 1.6) * 0.18 + Math.sin(this.t * 0.7) * 0.12;
      root.position.y = height(root.position.x, root.position.z) + HOVER + bob;
      root.rotation.z = Math.sin(this.t * 1.6) * 0.04 + (-vz * 0.0 + 0);
      root.rotation.x = -Math.min(0.25, sp * 0.05); // pitch forward slightly when moving
    }
  };
  return player;
}
