# ASSETS.md

## Pokémon sprites
18 Gen‑1 (Yellow) front sprites, vendored as PNGs in `public/pokemon/`.
Source: https://github.com/PokeAPI/sprites (PokeAPI sprites repo, generation‑i/yellow).
Used as camera-facing billboards roaming the grassland. Alolan/etc. n/a here.

> "Pokémon" and all creature names/likenesses are © Nintendo / Game Freak / The
> Pokémon Company. This is a non-commercial fan tech demo; not affiliated or endorsed.

## Procedural assets
Grassland heightfield, grass detail normals, tree meshes, trainer mesh, sky
(Babylon SkyMaterial), fog/lighting — all generated at runtime, no third-party
textures/HDRI/PBR scans.

## Third-party code
- Babylon.js (`@babylonjs/core`, `@babylonjs/materials`) — Apache 2.0
- Vite — MIT
