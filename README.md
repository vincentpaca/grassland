# GRASSLAND — a Pokémon study

A real-time WebGPU tech demo (Babylon.js + Vite): walk a rolling grassland meadow
with trees as a Pokémon trainer, with **Pokémon roaming the field around you**
(real Gen‑1 sprites, billboarded).

## Run
```bash
npm install
npm run dev      # open the localhost URL in Chrome (WebGPU)
```
Build: `npm run build && npm run preview`

## Controls
- **WASD / arrows** — move (camera-relative)
- **Mouse** — orbit (click canvas to lock pointer) · **wheel** — zoom
- **F1 / `** — settings overlay (frame graph, sun/fog sliders)

## Requirements
Chrome with WebGPU. If no adapter is available the demo shows a single line and stops
(no WebGL fallback, per spec). Pokémon sprites are the Gen‑1 (Yellow) front sprites
from PokeAPI, vendored in `public/pokemon/`.

## Notes
All environment art is procedural. Send a 1440p screenshot and I'll tune the look.
See DECISIONS.md and ASSETS.md.
