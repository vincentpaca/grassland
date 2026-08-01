import * as B from '@babylonjs/core';
import { createGrassland } from './terrain.js';
import { createTrainer } from './player.js';
import { createPokemon } from './pokemon.js';
import { createGrass } from './grass.js';
import { height } from './noise.js';
import '@babylonjs/loaders/glTF';
import { DracoCompression } from '@babylonjs/core/Meshes/Compression/dracoCompression';
DracoCompression.Configuration = { decoder: { wasmUrl: '/draco/draco_wasm_wrapper_gltf.js', wasmBinaryUrl: '/draco/draco_decoder_gltf.wasm', fallbackUrl: '/draco/draco_decoder_gltf.js' } };

const canvas = document.createElement('canvas');
document.getElementById('app').appendChild(canvas);
const loaderEl = () => document.getElementById('loader');
const failNoGPU = () => { loaderEl().classList.add('hide'); document.getElementById('nogpu').style.display = 'flex'; };
if (!navigator.gpu) { failNoGPU(); }
else { boot().catch(e => { console.error(e); failNoGPU(); }); }

async function boot() {
  let engine;
  try {
    const ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!ad) { failNoGPU(); return; }
    engine = await B.WebGPUEngine.CreateAsync(canvas, { antialias: true, adaptToDeviceRatio: true });
  } catch (e) { failNoGPU(); return; }

  const scene = new B.Scene(engine);
  const wind = { time: 0, speed: 1.7, amp: 0.20, x: 0.8, z: 0.35 };
  const ctx = { scene, engine, wind, settings: { sunAngle: 0.6, fog: 0.0040, wind: 0.2, quality: 1 }, input: { keys: {}, mouseDX: 0, my: 0, wheel: 0 } };

  const camera = new B.UniversalCamera('cam', new B.Vector3(0, 5, -9), scene);
  camera.fov = 1.0; camera.minZ = 0.1; camera.maxZ = 6000;

  // shared dot texture (pollen/particles)
  const dotT = new B.DynamicTexture('dot', 32, scene, false);
  { const c = dotT.getContext(); const g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); dotT.update(false); dotT.hasAlpha = true; }
  ctx.sprayTex = dotT;

  const world = createGrassland(scene, ctx);
  ctx.terrain = world; ctx.shadow = world.shadow;
  const player = await createTrainer(scene, ctx);
  player.position.set(0, height(0, 0), 0);
  const pokemon = await createPokemon(scene, ctx, player);
  const grass = createGrass(scene, ctx);

  // post
  const pp = new B.DefaultRenderingPipeline('pp', true, scene, [camera]);
  pp.fxaaEnabled = true; pp.samples = 4;
  pp.bloomEnabled = true; pp.bloomThreshold = 0.82; pp.bloomWeight = 0.32; pp.bloomKernel = 64; pp.bloomScale = 0.5;
  pp.imageProcessingEnabled = true; pp.imageProcessing.toneMappingEnabled = true;
  pp.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  pp.imageProcessing.exposure = 1.12; pp.imageProcessing.contrast = 1.1;
  pp.imageProcessing.vignetteEnabled = true; pp.imageProcessing.vignetteWeight = 1.0; pp.imageProcessing.vignetteColor = new B.Color4(0.05, 0.07, 0.1, 1);
  pp.sharpenEnabled = true; pp.sharpen.edgeAmount = 0.22;
  pp.depthOfFieldEnabled = false;

  setupInput(canvas, ctx);
  const overlay = setupOverlay(ctx, world); ctx.overlay = overlay;

  camera.setTarget(player.position.clone());
  for (let i = 0; i < 3; i++) { grass.update(player.position, wind); scene.render(); await new Promise(r => setTimeout(r, 0)); }
  loaderEl().classList.add('hide');
  setTimeout(() => { const l = loaderEl(); if (l) l.style.display = 'none'; }, 800);

  const cam = { yaw: Math.PI, pitch: 0.20, dist: 9, cur: camera.position.clone() };
  const move = { vx: 0, vz: 0, heading: Math.PI };
  let orbitOffset = 0;
  let last = performance.now();
  const ft = new Array(120).fill(11); let fti = 0, tAcc = 0;

  engine.runRenderLoop(() => {
    const now = performance.now(); let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
    wind.time += dt; wind.amp = 0.08 + ctx.settings.wind * 1.2;

    orbitOffset += ctx.input.mouseDX * 0.005; ctx.input.mouseDX *= 0.7;
    orbitOffset *= (1 - Math.min(1, dt * 1.2)); // free-look eases back behind the character
    cam.pitch = B.Scalar.Clamp(cam.pitch - ctx.input.my * 0.003, 0.05, 1.1); ctx.input.my *= 0.7;
    cam.dist = B.Scalar.Clamp(cam.dist - ctx.input.wheel * 0.5, 4, 18); ctx.input.wheel *= 0.8;

    const k = ctx.input.keys;
    const turn = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    const fwdIn = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
    const shift = !!(k['shift']);
    // A/D turn character + camera together (classic 3rd-person); W/S forward/back along facing
    move.heading += turn * 2.4 * dt;
    cam.yaw = move.heading + orbitOffset;
    const sinH = Math.sin(move.heading), cosH = Math.cos(move.heading);
    const maxSp = shift ? 11.0 : 5.0;
    const want = fwdIn > 0 ? maxSp : (fwdIn < 0 ? -maxSp * 0.45 : 0);
    move.vx += (sinH * want - move.vx) * Math.min(1, dt * 9);
    move.vz += (cosH * want - move.vz) * Math.min(1, dt * 9);
    player.position.x += move.vx * dt; player.position.z += move.vz * dt;
    player.position.y = height(player.position.x, player.position.z);
    player.setHeading(move.heading);
    player.update(dt, move.vx, move.vz, wind, shift, turn);

    pokemon.update(dt, player);
    grass.update(player.position, wind);
    world.update(wind, player.position);

    const head = new B.Vector3(player.position.x, player.position.y + 1.2, player.position.z);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const des = new B.Vector3(head.x - Math.sin(cam.yaw) * cp * cam.dist + Math.cos(cam.yaw) * 0.8, head.y + sp * cam.dist + 1.0, head.z - Math.cos(cam.yaw) * cp * cam.dist - Math.sin(cam.yaw) * 0.8);
    cam.cur = B.Vector3.Lerp(cam.cur, des, Math.min(1, dt * 7));
    camera.position.copyFrom(cam.cur); camera.setTarget(head);

    world.sun.direction.set(Math.cos(ctx.settings.sunAngle), -0.5, Math.sin(ctx.settings.sunAngle + 0.3)); world.sun.direction.normalize();
    if (world.sky) world.sky.sunPosition = world.sun.direction.scale(-220);
    scene.fogDensity = ctx.settings.fog;

    scene.render();
    fti = (fti + 1) % ft.length; ft[fti] = dt * 1000; tAcc += dt;
    if (tAcc > 0.25) { overlay.updateStats(ft, fti, scene); tAcc = 0; }
  });

  window.addEventListener('resize', () => engine.resize());
}

function setupInput(canvas, ctx) {
  canvas.addEventListener('click', () => canvas.requestPointerLock && canvas.requestPointerLock());
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { ctx.input.mouseDX += e.movementX; ctx.input.my += e.movementY; } });
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
    <div>Sun angle: <input type="range" id="s_sun" min="0" max="6.28" step="0.01" value="${ctx.settings.sunAngle}" style="width:150px;vertical-align:middle;"></div>
    <div>Fog: <input type="range" id="s_fog" min="0.001" max="0.02" step="0.0005" value="${ctx.settings.fog}" style="width:150px;vertical-align:middle;"></div>
    <div>Wind: <input type="range" id="s_wind" min="0" max="1" step="0.01" value="${ctx.settings.wind}" style="width:150px;vertical-align:middle;"></div>`;
  document.body.appendChild(root);
  root.querySelector('#s_sun').oninput = e => ctx.settings.sunAngle = parseFloat(e.target.value);
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
      av.textContent = `${scene.meshes.length} meshes · ${world.foliage.length} foliage · ${world.pollen.emitRate} pollen`;
    }
  };
}
