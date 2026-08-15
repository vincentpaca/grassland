# GRASSLAND

Rio and I vibecoded this sandbox because he loves exploration games especially when he discovers / runs into legendary Pokemon.

We used GLM 5.2, Kimi 2.7 and Deepseek V4 Pro for this build.

## Run
```bash
npm install
npm run dev      # open the localhost URL in Chrome
```
Build: `npm run build` (outputs to `dist/`)

## Controls
- **WASD / arrows** — move (camera-relative)
- **Mouse** — orbit (click canvas to lock pointer) · **wheel** — zoom
- **F1 / `** — settings overlay (frame graph, sun/fog sliders)
- **/** — look up a Pokémon by name and spawn it in front of you
- **Touch** (mobile): virtual joystick (bottom-left) to move, one-finger drag to orbit, pinch to zoom

## Engine
Uses **WebGPU** when available (Chrome desktop), falling back to **WebGL2** for browsers without WebGPU (iOS Safari/Chrome). The Babylon.js barrel is dynamically imported so the entry chunk is ~15KB, avoiding iOS Safari's JS parse timeout on large bundles.


## Notes
All environment art is procedural. See ASSETS.md, PERF.md, and DEPLOY.md.
