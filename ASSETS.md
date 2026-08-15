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

## 3D Pokémon models
The roaming roster is generated in `src/roster.js` (253 forms: 47 vendored locally
in `public/pokemon3d/`, the rest loaded at runtime from the Pokemon-3D-api CDN).
Regenerate with `node tools/gen-roster.mjs`, which fetches the catalog, checks each
form for animation clips, and emits the roster with heights/behavior. Sources below
were spot-checked for current status and activity.

### Active / usable

| Source | Status | What it has | Format | Notes |
|--------|--------|-------------|--------|-------|
| [Pokemon-3D-api/assets](https://github.com/Pokemon-3D-api/assets) | **Active** | 1,300+ optimized 3D Pokémon models by generation/form | `.glb` (Draco + WebP) | Built for web/Three.js. Downloads directly via GitHub raw URLs, e.g. `https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/regular/1.glb`. License is just a copyright notice; models are still Nintendo-derived. These match the format currently used in `public/pokemon3d/`. |
| [Pokemon-3D-api/api-server](https://github.com/Pokemon-3D-api/api-server) | **Active** | REST JSON pointing to the GLB files | JSON metadata + GLB URLs | Live endpoint `https://pokemon-3d-api.onrender.com/v1/pokemon`. Useful to enumerate available models without hard-coding IDs. |
| [Pokemon-3D-api/Showcase](https://github.com/Pokemon-3D-api/Showcase) | **Active** | Demo React app using the assets | React + `<model-viewer>` | Reference implementation for loading/animating the GLBs. |
| [Sketchfab Pokémon search](https://sketchfab.com/search?q=pokemon&type=models) | **Active** | Community 3D models | `.glb`/`.gltf`/`.obj`/etc. | Licenses vary (CC-BY, etc.). Use the *Downloadable* filter and confirm attribution per model. The Pokemon-3D-api pipeline actually pulls from Sketchfab. |
| [Poly Pizza Pokemon search](https://poly.pizza/search/pokemon) | **Active** | Stylized low-poly Pokémon models | `.glb`/`.gltf`/`.obj` | CC-BY licensed individual models. Much smaller scope than Pokemon-3D-api (~20 species), but clean attribution. Good for a deliberately low-poly art style. |

### Archived / stale / tool-only

| Source | Status | What it has | Format | Notes |
|--------|--------|-------------|--------|-------|
| [Sudhanshu-Ambastha/Pokemon-3D-api](https://github.com/Sudhanshu-Ambastha/Pokemon-3D-api) | **Archived** Jun 2026 | Superseded by the `Pokemon-3D-api` org above | `.glb` | Read-only; do not rely on. Use the org repos instead. |
| [PoGo-Devs/PoGo-3D-Assets](https://github.com/PoGo-Devs/PoGo-3D-Assets) | **Stale** (last updated 2016) | Gen 1 3D assets for PoGo-UWP | `.dae`, `.fbx` | Mostly incomplete; many models unrigged/untextured. Not recommended for expansion. |
| [dragonation/pokemon-3ds-model-loader](https://github.com/dragonation/pokemon-3ds-model-loader) and [demo](https://github.com/dragonation/pokemon-3ds-model-loader-demo) | **Stale** (2–4 commits, 2018) | Nintendo 3DS Pokémon model loaders | JS loader + raw assets | Could be used to extract Gen 6/7 models if you have a 3DS ROM, but the loader itself is unmaintained. |
| [maierfelix/POGO-asset-downloader](https://github.com/maierfelix/POGO-asset-downloader) | **Stale** (last updated 2016) | Tool to download Pokémon GO assets | raw protobuf / binary | Just a downloader; assets are still TPC/Nintendo copyrighted and the tool likely does not work against current servers. |
| [PokeAPI/sprites](https://github.com/PokeAPI/sprites) | **Active** | Sprites only (Gen 1–9) | PNG / GIF / SVG | Used for billboards in an earlier iteration; no 3D meshes. |
| [OpenGameArt Pokémon search](https://opengameart.org/art-search?keys=pokemon) | **Active** | Mostly 2D tilesets / sprites | PNG | Not useful for 3D expansion. |

> Caution: Pokémon 3D meshes are almost always derived from Nintendo / The Pokémon
> Company games. Even when a repo is public, redistribution may not be legally
> clean. Prefer sources with explicit CC / MIT / Apache licensing and keep this
> demo strictly non-commercial.

## Third-party code
- Babylon.js (`@babylonjs/core`, `@babylonjs/materials`) — Apache 2.0
- Vite — MIT
