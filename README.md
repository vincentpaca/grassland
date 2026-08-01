# SNOWFLOW — a Pokémon snow study

A real-time WebGPU snow tech demo (Babylon.js + Vite). Walk a snow field as **Alolan
Vulpix**, carve with **Surf** (hold right mouse), cast five Ice-type moves (keys 1–5).

## Run
```bash
npm install
npm run dev        # http://localhost:5173  (open in Chrome with WebGPU)
```
Production build:
```bash
npm run build && npm run preview
```

## Controls
- **WASD / arrows** — move (camera-relative)
- **Mouse** — orbit (click canvas to lock pointer) · **wheel** — zoom
- **Right mouse (hold)** — Surf (carve; steer with mouse)
- **1–5** — Powder Snow / Ice Beam / Blizzard / Aurora Beam / Sheer Cold
- **F1 or `** — settings overlay (frame graph, toggles, sliders)

## Requirements
Chrome stable with WebGPU (target: RTX-class GPU, 1440p, 90 FPS). If no adapter is
available the demo shows a single line and stops (no WebGL fallback, per spec).

## Notes
All art is procedural. See DECISIONS.md for deviations and ASSETS.md for licensing/IP.
Visual tuning is best judged on real hardware — send a 1440p screenshot and I'll iterate.
