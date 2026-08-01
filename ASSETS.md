# ASSETS.md

All visual assets in SNOWFLOW are generated procedurally at runtime; no third-party
CC0 textures, HDRIs, or PBR scans are vendored or fetched at runtime.

- Terrain, heightfield, normals, snow normal/detail maps, particle sprites, fur
  strand texture — all procedural (Babylon DynamicTexture / JS noise).
- Sky — Babylon `SkyMaterial` (procedural physical sky), no HDRI.
- No meshes loaded from files; the Alolan Vulpix is built from Babylon primitives
  + `FurMaterial` shells.

## Third-party code
- Babylon.js (`@babylonjs/core`, `@babylonjs/materials`) — Apache 2.0.
- Vite — MIT.

## IP note (important)
"Alolan Vulpix" and all Pokémon names/likenesses are © Nintendo / Game Freak / The
Pokémon Company. SNOWFLOW is a non-commercial, fan-made graphics tech demo and is not
affiliated with or endorsed by them. No Pokémon art assets are redistributed; the
creature is approximated procedurally.
