---
name: sprite-pipeline
description: >-
  Author HD pixel-art sprites for this BattleCity / "Iron Siege" game (tanks,
  terrain tiles, explosions, powerups, HUD/UI, VFX frames) and wire them into
  the engine. Use this WHENEVER the user wants to create, generate, draw,
  redraw, restyle, modernize, or add ANY game art — a sprite, tile, animation
  frame, effect frame, or sheet — or mentions the sprite sheet,
  sprite.manifest.json, or the game's look, even if they don't say the word
  "sprite". It covers the canonical art style, the correct logical sizes,
  packing into the atlas, writing manifest entries, and previewing the result.
---

# Sprite pipeline

This game has a custom canvas/WebGL engine. Sprites live in a texture atlas plus
a JSON manifest; there is **no diffusion/image model available**, so art is
**authored programmatically as real PNGs** (palette + per-pixel grid in a small
script). The goal is the HD pixel-art look in `references/material-bible.md`.

## The one rule that must never be broken

The **logical** sizes are gameplay constants and must not change:
`src/config.ts` → `TILE_SIZE_SMALL = 16`, `TILE_SIZE_MEDIUM = 32`,
`TILE_SIZE_LARGE = 64`; tanks render at roughly a 48–52px logical footprint.
Collision, AI, and map parsing all assume these.

To get "HD", **author art at 2–3× the logical size and let the renderer draw it
down**. `src/core/painters/SpritePainter.ts` + `src/core/graphics/Sprite.ts`
keep `sourceRect` (where the art lives in the sheet) independent from
`destinationRect` (the logical size drawn on screen). So a tank authored at
150px registers a destination of ~50px — the extra detail simply *appears* when
the camera zooms in. Raising the logical grid to "get HD" silently breaks the
sim — never do it.

## How art is stored

- Atlas: `data/graphics/sprite.png` (currently 1628×1048). Smaller sheets exist
  too (`menu-brick.png`, `blue-brick.png`, etc.).
- Manifest: `data/sprite.manifest.json`, mapping a name to a sheet rect:
  ```json
  "tank.player.primary.a.up.1": { "file": "data/graphics/sprite.png", "rect": [4, 8, 52, 52] }
  ```
  `rect` is `[x, y, width, height]` in source pixels. New HD art can extend the
  atlas, or — preferably for high-res work — live on a **new higher-res sheet**
  referenced per entry via its own `file`. (The single atlas will not hold full
  HD tanks + terrain + VFX; plan a second sheet early.)

## Naming — match the existing scheme so loaders/animations find frames

- Tanks: `tank.{party}.{skin}.{tier}.{dir}.{frame}` e.g.
  `tank.player.primary.a.up.1`, `tank.enemy.default.b.left.2` (dir =
  up/down/left/right, frame = 1/2 for the tread animation).
- Terrain: `terrain.brick.1`, `terrain.steel`, `terrain.water.1`, `terrain.ice`…
- Effects/UI: `explosion.large.1`, `powerup.star`, `ui.player`, `points.100`…

Keep the same names when restyling so no code changes are needed — only pixels.

## Procedure

1. **Scope**: confirm the subject and the exact manifest name(s)/frames to add
   or replace. Restyling an existing entry = pixels only. New asset = new name(s).
2. **Palette**: pick ramps from `references/material-bible.md` so the asset is
   coherent with the rest of the set.
3. **Author**: write/extend a generator script (Node, dependency-free PNG via
   `zlib`, or an offscreen canvas) that builds the sprite from a palette +
   per-pixel grid at the chosen source resolution. Reuse a generator if one
   already exists rather than reinventing it — bundle shared helpers under a
   `tools/artgen/` dir.
4. **Export**: write the PNG into a sheet region (or a new sheet under
   `data/graphics/`).
5. **Manifest**: add/repoint entries with correct `rect`s and `file`s.
6. **Preview**: render it for the user with `mcp__visualize` `show_widget` — an
   HTML `<canvas>` at an integer scale with `image-rendering: pixelated` — or
   drop into the running game via the `run-level` skill.
7. **Verify**: `npx tsc --noEmit` and, if a sheet/manifest changed,
   `npm run build:dev` to confirm assets still load.

Art is always cosmetic — it never feeds the simulation, so it can't affect
fairness or determinism.
