// NOTE: the full barrel import is REQUIRED. Deep per-module imports tree-shake away a
// side effect that PBR lighting depends on: materials still compile (identical defines)
// but every lit PBR surface renders black. Do not "optimize" this back into deep imports
// without verifying actual rendered pixels (tools/shots.mjs).
import '@babylonjs/core';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import '@babylonjs/core/Engines/WebGPU/Extensions';
import { createGrassland } from './terrain.js';
import { createTrainer } from './player.js';
import { createPokemon } from './pokemon.js';
import { height } from './noise.js';
import '@babylonjs/loaders/glTF';
import { DracoCompression } from '@babylonjs/core/Meshes/Compression/dracoCompression';
DracoCompression.Configuration = { decoder: { wasmUrl: '/draco/draco_wasm_wrapper_gltf.js', wasmBinaryUrl: '/draco/draco_decoder_gltf.wasm', fallbackUrl: '/draco/draco_decoder_gltf.js' } };

const canvas = document.createElement('canvas');
document.getElementById('app').appendChild(canvas);
const loaderEl = () => document.getElementById('loader');
const fillEl = () => document.getElementById('fill');
const lsubEl = () => document.getElementById('lsub');
const progress = { t: 0 };
const setProgress = (t, sub) => {
  progress.t = Math.max(progress.t, t);
  const f = fillEl(); if (f) f.style.width = Math.min(100, progress.t * 100).toFixed(1) + '%';
  if (sub) { const s = lsubEl(); if (s) s.textContent = sub; }
};
const failNoGPU = (detail) => {
  loaderEl().classList.add('hide');
  document.getElementById('nogpu').style.display = 'flex';
  const d = document.getElementById('nogpu-detail');
  if (d && detail) d.textContent = String(detail);
};
const errMsg = (e) => (e && e.message ? e.message : String(e));
if (!navigator.gpu) { failNoGPU('navigator.gpu is undefined — need a WebGPU-capable browser.'); }
else { boot().catch(e => { console.error('boot failed:', e); failNoGPU(errMsg(e)); }); }

async function boot() {
  let engine;
  try {
    const ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!ad) { failNoGPU('No WebGPU adapter available on this device.'); return; }
    engine = await WebGPUEngine.CreateAsync(canvas, { antialias: true, adaptToDeviceRatio: true });
  } catch (e) {
    console.error('WebGPU init failed:', e);
    failNoGPU(errMsg(e));
    return;
  }
  setProgress(0.06, 'INITIALIZING GPU…');

  const scene = new Scene(engine);
  const wind = { time: 0, speed: 1.7, amp: 0.20, x: 0.8, z: 0.35 };
  const ctx = { scene, engine, wind, settings: { time: 12, fog: 0.0040, wind: 0.2, autoDay: true, quality: 1 }, input: { keys: {}, mouseDX: 0, my: 0, wheel: 0, lastMouse: 0 } };
  {
    const q = new URLSearchParams(location.search);
    if (q.has('t')) { ctx.settings.time = parseFloat(q.get('t')) || 0; ctx.settings.autoDay = false; }
  }

  const camera = new UniversalCamera('cam', new Vector3(0, 5, -9), scene);
  camera.fov = 1.0; camera.minZ = 0.1; camera.maxZ = 6000;

  // shared dot texture (pollen/particles)
  const dotT = new DynamicTexture('dot', 32, scene, false);
  { const c = dotT.getContext(); const g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); dotT.update(false); dotT.hasAlpha = true; }
  ctx.sprayTex = dotT;

  setProgress(0.18, 'GROWING THE MEADOW…');
  const world = createGrassland(scene, ctx);
  ctx.terrain = world; ctx.shadow = world.shadow;
  setProgress(0.3, 'LOADING TRAINER…');
  ctx.progress = { base: 0.42, span: 0.46, n: 0, done: 0, glb() { if (!this.n) return; this.done++; setProgress(this.base + this.span * Math.min(1, this.done / this.n), 'MEADOW LIFE…'); } };
  const player = await createTrainer(scene, ctx);
  player.position.set(0, height(0, 0), 0);
  setProgress(0.42, 'SPAWNING MEADOW LIFE…');
  const pokemon = await createPokemon(scene, ctx, player);
  setProgress(0.9, 'TUNING LIGHT…');

  // post
  const NOPP = (new URLSearchParams(location.search).get('no') || '').split(',').includes('pp');
  const pp = NOPP ? null : new DefaultRenderingPipeline('pp', true, scene, [camera]);
  if (pp) {
  pp.fxaaEnabled = true; pp.samples = 4;
  pp.bloomEnabled = true; pp.bloomThreshold = 0.82; pp.bloomWeight = 0.32; pp.bloomKernel = 16; pp.bloomScale = 0.5;
  pp.imageProcessingEnabled = true; pp.imageProcessing.toneMappingEnabled = true;
  pp.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  pp.imageProcessing.exposure = 1.12; pp.imageProcessing.contrast = 1.1;
  pp.imageProcessing.vignetteEnabled = true; pp.imageProcessing.vignetteWeight = 1.0; pp.imageProcessing.vignetteColor = new Color4(0.05, 0.07, 0.1, 1);
  pp.sharpenEnabled = true; pp.sharpen.edgeAmount = 0.22;
  pp.depthOfFieldEnabled = false;
  }

  setupInput(canvas, ctx);
  const overlay = setupOverlay(ctx, world); ctx.overlay = overlay;

  camera.setTarget(player.position.clone());
  for (let i = 0; i < 3; i++) { scene.render(); await new Promise(r => setTimeout(r, 0)); }
  setProgress(0.97, 'DONE');
  loaderEl().classList.add('hide');
  setTimeout(() => { const l = loaderEl(); if (l) l.style.display = 'none'; }, 800);

  const cam = { yaw: Math.PI, pitch: 0.25, dist: 9, cur: camera.position.clone() };
  const move = { vx: 0, vz: 0 };
  const vHead = new Vector3(), vDes = new Vector3();
  let last = performance.now();
  const ft = new Array(120).fill(11); let fti = 0, tAcc = 0;

  engine.runRenderLoop(() => {
    const now = performance.now(); let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
    wind.time += dt; wind.amp = 0.08 + ctx.settings.wind * 1.2;

    // Mouse orbits the camera freely (persists). WASD moves camera-relative; Mewtwo turns to face its movement.
    cam.yaw += ctx.input.mouseDX * 0.005; ctx.input.mouseDX *= 0.7;
    cam.pitch = Scalar.Clamp(cam.pitch - ctx.input.my * 0.003, 0.08, 1.1); ctx.input.my *= 0.7;
    cam.dist = Scalar.Clamp(cam.dist - ctx.input.wheel * 0.5, 4, 18); ctx.input.wheel *= 0.8;

    const k = ctx.input.keys;
    let ix = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    let iz = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
    const il = Math.hypot(ix, iz) || 1; ix /= il; iz /= il;
    const fwdx = Math.sin(cam.yaw), fwdz = Math.cos(cam.yaw);   // camera forward (Babylon left-handed)
    const rtx = fwdz, rtz = -fwdx;                              // camera right
    const shift = !!(k['shift']);
    const want = Math.hypot(ix, iz) > 0 ? (shift ? 11.0 : 5.0) : 0;
    const dvx = (fwdx * iz + rtx * ix) * want, dvz = (fwdz * iz + rtz * ix) * want;
    move.vx += (dvx - move.vx) * Math.min(1, dt * 9);
    move.vz += (dvz - move.vz) * Math.min(1, dt * 9);
    player.position.x += move.vx * dt; player.position.z += move.vz * dt;
    player.position.y = height(player.position.x, player.position.z);
    player.update(dt, move.vx, move.vz, wind, shift);

    pokemon.update(dt, player);
    world.update(wind, player.position);
    if (ctx.settings.autoDay) ctx.settings.time = (ctx.settings.time + dt * 0.02) % 24;   // 1 in-game hour ≈ 50 s
    world.setDay(ctx.settings.time);
    scene.fogDensity = ctx.settings.fog;

    vHead.set(player.position.x, player.position.y + 1.2, player.position.z);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    vDes.set(vHead.x - Math.sin(cam.yaw) * cp * cam.dist + Math.cos(cam.yaw) * 0.8, vHead.y + sp * cam.dist + 1.0, vHead.z - Math.cos(cam.yaw) * cp * cam.dist - Math.sin(cam.yaw) * 0.8);
    Vector3.LerpToRef(cam.cur, vDes, Math.min(1, dt * 7), cam.cur);
    camera.position.copyFrom(cam.cur); camera.setTarget(vHead);

    scene.render();
    fti = (fti + 1) % ft.length; ft[fti] = dt * 1000; tAcc += dt;
    if (tAcc > 0.25) { overlay.updateStats(ft, fti, scene); tAcc = 0; }
  });

  let resizePending = false;
  window.addEventListener('resize', () => { if (resizePending) return; resizePending = true; requestAnimationFrame(() => { resizePending = false; engine.resize(); }); });
  window.__grassland = { scene, engine, ctx };
}

function setupInput(canvas, ctx) {
  canvas.addEventListener('click', () => canvas.requestPointerLock && canvas.requestPointerLock());
  document.addEventListener('mousemove', e => { ctx.input.lastMouse = performance.now(); if (document.pointerLockElement === canvas) { ctx.input.mouseDX += e.movementX; ctx.input.my += e.movementY; } });
  document.addEventListener('wheel', e => { ctx.input.wheel += e.deltaY; }, { passive: true });
  window.addEventListener('keydown', e => { const k = e.key.toLowerCase(); ctx.input.keys[k] = true; if (k === 'f1' || k === '`') { e.preventDefault(); ctx.overlay && ctx.overlay.toggle(); } });
  window.addEventListener('keyup', e => { ctx.input.keys[e.key.toLowerCase()] = false; });
}

function setupOverlay(ctx, world) {
  let on = false;
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;left:10px;top:10px;width:270px;z-index:30;display:none;font-size:11px;color:#dfe9ff;background:rgba(8,12,22,.8);border:1px solid #2a3a5a;border-radius:8px;padding:10px;line-height:1.6;';
  root.innerHTML = `<div style="font-weight:700;letter-spacing:2px;margin-bottom:6px;">GRASSLAND · SETTINGS</div>
    <div id="ftstats"></div><canvas id="ftg" width="250" height="40" style="display:block;margin:6px 0;border:1px solid #234;background:#0a1322;"></canvas>
    <div id="av"></div><hr style="border-color:#234;">
    <div>Time: <input type="range" id="s_time" min="0" max="23.5" step="0.05" value="${ctx.settings.time}" style="width:150px;vertical-align:middle;"> <label><input type="checkbox" id="s_auto" ${ctx.settings.autoDay ? "checked" : ""}> auto</label></div>
    <div>Fog: <input type="range" id="s_fog" min="0.001" max="0.02" step="0.0005" value="${ctx.settings.fog}" style="width:150px;vertical-align:middle;"></div>
    <div>Wind: <input type="range" id="s_wind" min="0" max="1" step="0.01" value="${ctx.settings.wind}" style="width:150px;vertical-align:middle;"></div>`;
  document.body.appendChild(root);
  root.querySelector('#s_time').oninput = e => { ctx.settings.time = parseFloat(e.target.value); ctx.settings.autoDay = false; root.querySelector('#s_auto').checked = false; };
  root.querySelector('#s_auto').onchange = e => ctx.settings.autoDay = e.target.checked;
  root.querySelector('#s_fog').oninput = e => ctx.settings.fog = parseFloat(e.target.value);
  root.querySelector('#s_wind').oninput = e => ctx.settings.wind = parseFloat(e.target.value);
  const g = root.querySelector('#ftg'); const gx = g.getContext('2d');
  const st = root.querySelector('#ftstats'); const av = root.querySelector('#av');
  return {
    toggle() { on = !on; root.style.display = on ? 'block' : 'none'; },
    updateStats(times, idx, scene) {
      let max = 0, sum = 0; for (const t of times) { sum += t; if (t > max) max = t; }
      const avg = sum / times.length, s = times.slice().sort((a, b) => a - b), p1 = s[Math.floor(s.length * 0.99)];
      st.textContent = `avg ${avg.toFixed(2)}ms · 1% low ${p1.toFixed(2)}ms · fps ${(1000 / avg).toFixed(0)}`;
      gx.clearRect(0, 0, 250, 40); gx.fillStyle = '#0a1322'; gx.fillRect(0, 0, 250, 40);
      gx.strokeStyle = p1 > 16 ? '#ff6688' : '#7fb6ff'; gx.beginPath();
      for (let i = 0; i < times.length; i++) { const t = times[(idx + 1 + i) % times.length]; const x = i / times.length * 250; const y = 40 - Math.min(40, t * 1.5); if (i) gx.lineTo(x, y); else gx.moveTo(x, y); }
      gx.stroke();
      av.textContent = `${scene.meshes.length} meshes · ${world.foliage} foliage · ${world.pollen ? world.pollen.emitRate : 0} pollen`;
    }
  };
}
