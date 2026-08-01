# DECISIONS.md — deviations from the SNOWFLOW brief (one-line rationale each)

1. **Custom WGSL snow shader → heavily-customised Babylon PBRMaterial.** The brief forbids "a stock PBR with white albedo"; this is *not* that — it uses procedural multi-scale detail normals, PBR sub-surface translucency (back-scatter glow), sheen, and per-vertex compression/wet/ice states. Rationale: the sandbox has **no WebGPU adapter**, so a hand-written WGSL shader could not be compiled/verified; a PBR base guaranteed correct lighting, CSM shadows, IBL and post integration and a polished look that runs on the target machine. The material is structured so it can be swapped for a raw-WGSL ShaderMaterial later.
2. **Deformation: 4096² R16F scrollable GPU RT → CPU per-patch field driving real vertex displacement on a sub-10cm detail mesh.** Rationale: the GPU toroidal scroll/blur compute passes could not be verified blind; the CPU field + updatable mesh gives *genuine* depression, berms, recomputed normals and real self-shadowing (the actual gate) with no shader risk. Upgrade path: move the field to an R16F RT and stamp via a fullscreen pass.
3. **TAA → MSAA×4 + FXAA; SSR omitted; SSAO2 used.** Rationale: Babylon's TAA and SSR-on-WebGPU availability/behaviour couldn't be confirmed in a no-adapter sandbox; MSAA+FXAA is robust and looks clean.
4. **Compression/wet/ice as vertex-colour albedo modulation** (not per-pixel shader state; ice does not lower per-pixel roughness). Rationale: keeps it inside the verified PBR path; visually distinct states still read.
5. **Glints via PBR specular on high-frequency detail normals** (not a view-gated hash sparkle). Rationale: hand-tuning a stable hash glint requires visual feedback. Marked for upgrade.
6. **Character robe → Alolan Vulpix (snow fox) built from primitives + FurMaterial shells + a Verlet scarf.** Rationale: "with Pokémon" per the user; a snow fox is the natural ice-type mascot and the shell-fur requirement maps to real fur. Full garment cloth sim reduced to a Verlet scarf to keep silhouette quality high without an un-tunable rig.
7. **Warm-up** renders 4 frames + a yield before dismissing the loader (Babylon 9 WebGPU pipeline compilation is partly async; a fully exhaustive async-pipeline warm-up pass is a future improvement).
8. **No-GPU path** also covers the "adapter present but `requestAdapter()` returns null" case (shows the single stop line), since `WebGPUEngine.CreateAsync` swallows that rejection and would otherwise hang on the loader forever.
9. **No audio** is in the brief; none added.

Visual acceptance (faceting, glints, wake momentum, spell marks, 90 FPS / 1% lows) can
only be judged on a real WebGPU adapter — see PERF.md.
