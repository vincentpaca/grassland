import * as B from '@babylonjs/core';
import { createSnowfield } from './terrain.js';
import { createPlayer } from './player.js';
import { createSurf } from './surf.js';
import { createSpells, SPELLS } from './spells.js';
import { createPost } from './post.js';
import { height } from './noise.js';

const canvas = document.createElement('canvas');
document.getElementById('app').appendChild(canvas);

const loaderEl = () => document.getElementById('loader');
const failNoGPU = () => { loaderEl().classList.add('hide'); document.getElementById('nogpu').style.display = 'flex'; };
if (!navigator.gpu) { failNoGPU(); }
else { boot().catch(e => { window.__outerfail = String(e&&e.message||e); console.error(e); failNoGPU(); }); }

async function boot() {
  let engine;
  try {
    // probe adapter first (CreateAsync swallows rejection -> would hang on no-adapter)
    const _ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!_ad) { failNoGPU(); return; }
    engine = await B.WebGPUEngine.CreateAsync(canvas, { antialias: true, adaptToDeviceRatio: true, stencil: true });
    window.__booted = 1;
  } catch (e) { window.__bootfail = String(e && e.message || e); failNoGPU(); return; }

  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(0.62, 0.74, 0.92, 1);
  scene.blockMaterialDirtyMechanism = true;

  // shared radial particle sprite
  const sprayTex = makeRadial(scene, 64);
  const ctx = { scene, engine, sprayTex, settings: settings(), input: { keys: {}, mx: 0, my: 0, wheel: 0, rmb: false, mouseDX: 0 } };

  // --- camera (spring, over-shoulder, manual orbit) ---
  const camera = new B.UniversalCamera('cam', new B.Vector3(0, 4, -8), scene);
  camera.fov = 1.05; camera.minZ = 0.1; camera.maxZ = 6000;
  camera.rotation.y = Math.PI;
  ctx.camera = camera;

  // --- world ---
  const terrain = createSnowfield(scene, ctx);
  ctx.terrain = terrain; ctx.matSnow = terrain.matSnow; ctx.shadow = terrain.shadow;

  const player = createPlayer(scene, ctx);
  ctx.player = player;
  // start on a flat-ish dune
  player.position.set(0, height(0, 0) + 0.0, 0);

  const surf = createSurf(scene, ctx);
  const spells = createSpells(scene, ctx);
  ctx.spells = spells;

  const post = createPost(scene, camera, ctx);
  ctx.post = post;

  scene.blockMaterialDirtyMechanism = false;

  // --- input ---
  setupInput(canvas, ctx);

  // --- settings overlay ---
  const overlay = setupOverlay(ctx, terrain, post);
  ctx.overlay = overlay;

  // --- warm up: render a few frames to compile pipelines before fade-in ---
  camera.setTarget(player.position.clone());
  for (let i = 0; i < 4; i++) {
    terrain.update(player.position);
    scene.render();
    await new Promise(r => setTimeout(r, 0));
  }

  document.getElementById('loader').classList.add('hide');
  setTimeout(() => { const l = document.getElementById('loader'); if (l) l.style.display = 'none'; }, 900);

  // --- state ---
  const camState = { yaw: Math.PI, pitch: 0.32, dist: 6.0, curPos: camera.position.clone(), fov: 1.05 };
  const move = { vx: 0, vz: 0, speed: 0, heading: Math.PI };
  let last = performance.now();
  const ftimes = new Array(120).fill(11.1);
  let fti = 0, fpsAccum = 0, fpsTimer = 0;

  engine.runRenderLoop(() => {
    const now = performance.now();
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;
    const dtMs = dt * 1000;

    // --- camera orbit from mouse ---
    camState.yaw += ctx.input.mouseDX * 0.005; ctx.input.mouseDX *= 0.7;
    camState.pitch = B.Scalar.Clamp(camState.pitch - ctx.input.my * 0.003, 0.05, 1.2); ctx.input.my *= 0.7;
    camState.dist = B.Scalar.Clamp(camState.dist - ctx.input.wheel * 0.6, 3, 16); ctx.input.wheel *= 0.8;
    // surf widens FOV
    const targetFov = (surf.surfT.v > 0.1 ? 1.05 + surf.surfT.v * 0.35 : 1.05);
    camState.fov += (targetFov - camState.fov) * Math.min(1, dt * 5);
    camera.fov = camState.fov;

    // --- movement (WASD relative to camera yaw) ---
    const k = ctx.input.keys;
    let ix = 0, iz = 0;
    if (k['w'] || k['arrowup']) iz += 1;
    if (k['s'] || k['arrowdown']) iz -= 1;
    if (k['a'] || k['arrowleft']) ix -= 1;
    if (k['d'] || k['arrowright']) ix += 1;
    const il = Math.hypot(ix, iz) || 1;
    ix /= il; iz /= il;
    const fwd = new B.Vector3(Math.sin(camState.yaw), 0, Math.cos(camState.yaw));
    const right = new B.Vector3(fwd.z, 0, -fwd.x);
    let desiredVx = fwd.x * iz + right.x * ix;
    let desiredVz = fwd.z * iz + right.z * ix;
    const surfRes = surf.update(dt, player, ctx.input, move.speed, move.heading, ctx.input.mouseDX);
    const maxSpeed = (surfRes.surfing ? 12 : 4.5) * surfRes.speedMul;
    const desiredSpeed = (Math.hypot(ix, iz) > 0 ? maxSpeed : 0);
    // ease velocity
    move.vx += (desiredVx * desiredSpeed - move.vx) * Math.min(1, dt * (surfRes.surfing ? 4 : 8));
    move.vz += (desiredVz * desiredSpeed - move.vz) * Math.min(1, dt * (surfRes.surfing ? 4 : 8));
    move.speed = Math.hypot(move.vx, move.vz);
    player.position.x += move.vx * dt;
    player.position.z += move.vz * dt;
    player.position.y = height(player.position.x, player.position.z);
    if (move.speed > 0.2) { move.heading = Math.atan2(move.vx, move.vz); player.setHeading(move.heading); }

    // body lean during surf/carve
    player.update(dt, new B.Vector2(move.vx, move.vz), surfRes.surfing, surfRes.turn);

    // --- footfalls write deformation ---
    stampFootfalls(ctx, player, dt);

    // --- spells ---
    spells.update(dt, player, move.heading);

    // --- terrain patch follows player ---
    terrain.update(player.position);
    terrain.deform.refill(dt);

    // --- camera spring follow ---
    const head = new B.Vector3(player.position.x, player.position.y + 0.8, player.position.z);
    const cosP = Math.cos(camState.pitch), sinP = Math.sin(camState.pitch);
    const desired = new B.Vector3(
      head.x - Math.sin(camState.yaw) * cosP * camState.dist + Math.cos(camState.yaw) * 0.7,
      head.y + sinP * camState.dist + 1.2,
      head.z - Math.cos(camState.yaw) * cosP * camState.dist - Math.sin(camState.yaw) * 0.7
    );
    camState.curPos = B.Vector3.Lerp(camState.curPos, desired, Math.min(1, dt * 6));
    camera.position.copyFrom(camState.curPos);
    camera.setTarget(head);
    // keep spindrift emitter near camera
    if (post.drift) { post.drift.emitter = new B.Vector3(player.position.x, player.position.y + 0.4, player.position.z); }

    // sun angle from settings
    terrain.sun.direction.set(Math.cos(ctx.settings.sunAngle), -0.42 - Math.sin(ctx.settings.sunAngle) * 0.3, Math.sin(ctx.settings.sunAngle + 0.7));
    terrain.sun.direction.normalize();
    if (terrain.sky) terrain.sky.sunPosition = terrain.sun.direction.scale(-220);
    scene.fogDensity = ctx.settings.fogDensity;

    scene.render();

    // perf
    fti = (fti + 1) % ftimes.length; ftimes[fti] = dtMs;
    fpsAccum += dt; fpsTimer += dt;
    if (fpsTimer > 0.25) { overlay.updateStats(ftimes, fti, scene); fpsTimer = 0; }
  });

  window.addEventListener('resize', () => engine.resize());
}

// ---- footfall deformation stamping ----
function stampFootfalls(ctx, player, dt) {
  player._footAcc = (player._footAcc || 0) + dt;
  for (let i = 0; i < 4; i++) {
    const f = player.feet[i];
    if (!f.x && !f.z) continue;
    // contact phase: when leg swings down
    const contact = Math.sin(player.footPhase + i * Math.PI / 2) > 0.6;
    if (contact && (player._lastFootStamp || -1) !== i) {
      ctx.terrain.deform.stamp(f.x, f.z, 0.22, 0.05, 'depress');
      ctx.terrain.deform.stamp(f.x, f.z, 0.26, 0.03, 'berm');
      player._lastFootStamp = i;
    }
  }
}

// ---- radial particle texture ----
function makeRadial(scene, size) {
  const t = new B.DynamicTexture('rad', size, scene, false);
  const c = t.getContext();
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  t.update(false); t.hasAlpha = true; return t;
}

// ---- settings ----
function settings() {
  return { sunAngle: 0.6, fogDensity: 0.0085, glint: 1.0, deformDepth: 1.0, refillRate: 1.0, bloom: true, dof: true, ssao: true, sharpen: true, quality: 2 };
}

// ---- input ----
function setupInput(canvas, ctx) {
  canvas.addEventListener('click', () => canvas.requestPointerLock && canvas.requestPointerLock());
  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) {
      ctx.input.mouseDX += e.movementX; ctx.input.my += e.movementY;
    }
  });
  document.addEventListener('wheel', e => { ctx.input.wheel += e.deltaY; }, { passive: true });
  document.addEventListener('mousedown', e => { if (e.button === 2) ctx.input.rmb = true; });
  document.addEventListener('mouseup', e => { if (e.button === 2) ctx.input.rmb = false; });
  document.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); ctx.input.keys[k] = true;
    if (['1', '2', '3', '4', '5'].includes(k) && ctx.spells) ctx.spells.cast(parseInt(k) - 1, ctx.player, ctx.player.heading || 0);
    if (k === 'f1' || k === '`') { e.preventDefault(); ctx.overlay && ctx.overlay.toggle(); }
  });
  window.addEventListener('keyup', e => { ctx.input.keys[e.key.toLowerCase()] = false; });
}

// ---- overlay (DOM) ----
function setupOverlay(ctx, terrain, post) {
  let on = false;
  const root = document.createElement('div');
  root.id = 'overlay';
  root.style.cssText = 'position:fixed;left:10px;top:10px;width:280px;z-index:30;display:none;font-size:11px;color:#cfe3ff;background:rgba(6,10,20,.78);border:1px solid #2a3a5a;border-radius:8px;padding:10px;line-height:1.5;backdrop-filter:blur(4px);';
  root.innerHTML = `
    <div style="font-weight:700;letter-spacing:2px;margin-bottom:6px;">SNOWFLOW · SETTINGS</div>
    <div id="ftstats"></div>
    <canvas id="ftgraph" width="260" height="40" style="display:block;margin:6px 0;border:1px solid #234;background:#0a1322;"></canvas>
    <div style="margin-top:4px;">Active: <span id="av"></span></div>
    <hr style="border-color:#234;">
    ${slider('sunAngle', 'Sun angle', 0, 6.28)}
    ${slider('fogDensity', 'Fog density', 0.001, 0.03, 0.0001)}
    ${slider('glint', 'Glint', 0, 2)}
    ${slider('deformDepth', 'Deform depth', 0.2, 2)}
    ${slider('refillRate', 'Refill rate', 0.5, 2)}
    ${toggle('bloom', 'Bloom')} ${toggle('dof', 'DOF')} ${toggle('ssao', 'SSAO')} ${toggle('sharpen', 'Sharpen')}
    <div style="margin-top:6px;">Quality: <select id="q"><option value="0">Low</option><option value="1" selected>Med</option><option value="2">High</option></select></div>`;
  document.body.appendChild(root);
  const ftCanvas = root.querySelector('#ftgraph'); const ftx = ftCanvas.getContext('2d');
  const stats = root.querySelector('#ftstats'); const av = root.querySelector('#av');
  function slider(id, label, min, max, step) {
    return `<div style="margin:3px 0;">${label}: <input type="range" id="s_${id}" min="${min}" max="${max}" step="${step || 0.01}" value="${ctx.settings[id]}" style="width:160px;vertical-align:middle;"> <span id="v_${id}"></span></div>`;
  }
  function toggle(id, label) { return `<label><input type="checkbox" id="t_${id}" ${ctx.settings[id] ? 'checked' : ''}> ${label}</label> `; }

  root.querySelectorAll('input[type=range]').forEach(el => {
    const id = el.id.slice(2); el.oninput = () => { ctx.settings[id] = parseFloat(el.value); const s = root.querySelector('#v_' + id); if (s) s.textContent = (+el.value).toFixed(3); apply(ctx, terrain, post); };
  });
  root.querySelectorAll('input[type=checkbox]').forEach(el => {
    const id = el.id.slice(2); el.onchange = () => { ctx.settings[id] = el.checked; apply(ctx, terrain, post); };
  });
  root.querySelector('#q').onchange = e => { ctx.settings.quality = parseInt(e.target.value); post.setQuality(ctx.settings.quality); };

  return {
    toggle() { on = !on; root.style.display = on ? 'block' : 'none'; },
    updateStats(times, idx, scene) {
      let max = 0, sum = 0; for (const t of times) { sum += t; if (t > max) max = t; }
      const avg = sum / times.length;
      const sorted = times.slice().sort((a, b) => a - b);
      const p1 = sorted[Math.floor(sorted.length * 0.99)];
      stats.innerHTML = `avg ${avg.toFixed(2)}ms · 1% low ${p1.toFixed(2)}ms · max ${max.toFixed(2)}ms · fps ${(1000 / avg).toFixed(0)}`;
      ftx.clearRect(0, 0, 260, 40);
      ftx.fillStyle = '#0a1322'; ftx.fillRect(0, 0, 260, 40);
      ftx.strokeStyle = p1 > 16 ? '#ff6688' : '#6fa8ff';
      ftx.beginPath();
      for (let i = 0; i < times.length; i++) {
        const t = times[(idx + 1 + i) % times.length];
        const x = (i / times.length) * 260; const y = 40 - Math.min(40, t * 1.5);
        if (i === 0) ftx.moveTo(x, y); else ftx.lineTo(x, y);
      }
      ftx.stroke();
      av.textContent = `meshes ${scene.meshes.length} · verts ~${(scene.meshes.reduce((s, m) => s + (m.getTotalVertices ? m.getTotalVertices() : 0), 0) / 1e3).toFixed(0)}k`;
    }
  };
}

function apply(ctx, terrain, post) {
  if (post.pipeline) {
    post.pipeline.bloomEnabled = ctx.settings.bloom;
    post.pipeline.depthOfFieldEnabled = ctx.settings.dof && ctx.settings.quality >= 1;
    post.pipeline.sharpenEnabled = ctx.settings.sharpen;
  }
  if (post.drift) post.drift.emitRate = 220 * ctx.settings.glint;
}
