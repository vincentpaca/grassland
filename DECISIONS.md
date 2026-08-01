# DECISIONS.md — GRASSLAND (Pokémon grassland tech demo)

Deviations from the SNOWFLOW brief, since the user redirected this from a snow demo to
"a grassland with trees and Pokémon around."

1. **Environment: snow field → rolling grassland with trees.** Per user request.
   Snow shader/deformation/surf/spells dropped; replaced with grass PBR, baked rolling
   hills, scattered tree clumps, distant hills, roaming Pokémon.
2. **Pokémon as Gen‑1 sprite billboards** (camera-facing planes), not 3D models.
   Rationale: recognisable, authentic, and far more reliable to ship than procedural 3D
   Pokémon models; reads well in a 3D world (sprite-in-3D, classic style).
3. **Player = a simple trainer** (procedural primitives: cap, body, legs, arms) with
   locomotion + foot planting, rather than the brief's hooded robe/cloth figure.
4. **Snow deformation system removed** (not relevant to a grassland walkabout);
   terrain is a single baked mesh with vertex-colour grass variation + procedural
   detail normals. No per-frame mesh rebuild needed.
5. **Post:** Babylon DefaultRenderingPipeline (FXAA + bloom + ACES + DOF + sharpen +
   vignette). TAA/SSAO/SSR omitted (couldn't verify on WebGPU in a no-adapter sandbox).
6. **No-GPU path** also covers "navigator.gpu present but no adapter" (shows the single
   stop line), because Babylon's `WebGPUEngine.CreateAsync` swallows that rejection and
   would otherwise hang on the loader.
7. Sandbox has **no WebGPU adapter**, so the 3D result is not visually verified here;
   build + no-adapter fallback are verified. Visual tuning is done on the target GPU.
