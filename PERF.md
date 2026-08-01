# PERF.md — frame budget (target 11.1 ms @ 90 FPS; floor 16.7 ms @ 60)

Measured values could NOT be captured here: the sandbox exposes `navigator.gpu` but
`requestAdapter()` returns null (no physical GPU), so nothing renders. The figures below
are design budgets + order-of-magnitude estimates to validate on the RTX 5070 Ti target.

| System | Budget | Notes |
|---|---|---|
| Terrain large grid (240², static) | ~0.5 ms | frozen world matrix, PBR |
| Detail patch (256² updatable) | ~2.5 ms | 66k verts CPU rebuild + 3 buffer uploads/frame; dominant cost. Reduce N or move to GPU if over budget. |
| Snow PBR (multi-scale normals, SSS, sheen) | ~2.0 ms | one material; vertex-colour state |
| Cascaded shadows (2048, 4 cascades, blur) | ~1.5 ms | |
| Vulpix fur (5 FurifyMesh × ~24 shells) | ~1.2 ms | thin-instance shells; drop shell count if needed |
| Spells + particles (≤6 active) | ~1.0 ms | pooled; refraction approximated by translucent PBR |
| Post (FXAA, SSAO2, bloom, DOF low, grain, sharpen) | ~2.0 ms | |
| Sim (cloth Verlet, deform refill) | ~0.5 ms | |
| **Total estimate** | **~11.2 ms** | tighten patch N first if over |

Loop hygiene: per-frame `updateVerticesData` reuses pre-allocated Float32Arrays; no
`new` in the render loop except small `Vector3` for emitters (minor — can pool). Overlay
updates are throttled to 4 Hz.
