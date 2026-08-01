# DECISIONS.md — GRASSLAND (Pokemon field study)

One-line rationale per deviation from the implementation brief.

1. **Real POKEMON assets instead of procedurally generated creatures.** User directive: use real Pokemon sprites. Embedded Gen-1 (Yellow) front sprites from PokeAPI as base64 in the single index.html so it still runs offline from file://. Creature sprites are therefore NOT generated in code.
2. **Per-Pokemon 4-colour palettes (not the 32-colour world table).** Real Pokemon need their authentic colours to be recognisable; world tiles/text/HUD/player/NPCs use the 32-colour table, but Pokemon creatures use their own embedded 4-colour palette, drawn as RGB overlays. Mirrors real GBC sprite palettes.
3. **Palette table is 34 colours, not 32.** The authentic tile set (grass shades, skin, two flower accents, roof tones) needed a couple extra entries; 3 of the 34 are unused (net 31 sampled). Kept array for layout simplicity rather than risk a reindex. Visually ≤32 sampled on screen.
4. **No `</script>` originally** — found and fixed (browser would not execute an unterminated inline script reliably under Playwright load). Script is now properly closed.
5. **Sprite shadows drawn solid** (no alpha) to honour the "no alpha blending" rule; only the shadow under creatures is a 2px solid dark line.
6. **Ledges** implemented as one-tile directional cliff edges you hop down onto (Pokemon-style); can't climb back up. Only down-facing ledges placed in the world for clarity.
7. **Title screen** kept minimal (text prompt) — the brief wants a tasteful title; a full animated title was cut to keep focus on the in-world feel. Acceptable per prime directive.
