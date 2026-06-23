---
name: run-level
description: >-
  Launch this BattleCity / "Iron Siege" game in a browser and capture a
  screenshot of a running level to verify a change. Use this WHENEVER the user
  wants to see, play, run, test, or verify the game; check that a feature or fix
  works on screen; screenshot or record the gameplay; or do a visual / regression
  smoke-test after engine, physics, camera, or art changes. It covers starting
  the dev server, getting into a level, capturing frames, and reading the console
  for errors.
---

# Run a level (verify on screen)

The game is a client-only static site with a custom canvas engine. Use this to
turn "does it actually run / feel right" into a repeatable check — especially
after changes to the game loop, movement, camera, particles, or sprites.

## Start the dev server

```bash
npm start
```

This runs `webpack-dev-server` (config: `webpack/dev.config.js`, serves `dist/`),
defaults to **http://localhost:8080**, and opens a browser. Webpack 4's first
compile is slowish — wait for "compiled successfully" before navigating. For
automation, start it in the background and drive a browser via the Claude Preview
MCP (`mcp__Claude_Preview__preview_start` / `preview_navigate` /
`preview_screenshot` / `preview_console_logs`) or the Chrome MCP.

## Get into a level

- The game draws to a single `<canvas>` appended to `document.body`
  (`GameRenderer.getDomElement()`); display size is driven by CSS vars
  `--game-width` / `--game-height`.
- All input is keyboard/gamepad. **Read the current keybindings** in
  `src/input/bindings/` rather than assuming — defaults are arrows/WASD to move,
  a fire key, and Enter/Space to confirm menus.
- Flow: main menu → choose single-player play → first level. In dev
  (`config.IS_DEV`) debug menus are attached (`DebugGameLoopMenu`,
  `DebugLevelPlayerMenu`, etc.) and the custom-map / editor path can load a
  specific map quickly for a targeted scenario.

## Capture & report

- Screenshot once in a level to confirm it boots and renders.
- For motion (momentum, camera shake, particles), capture a short sequence of
  frames (repeat `preview_screenshot`, or use the Chrome MCP `gif_creator`).
- Check `preview_console_logs` for runtime errors.
- Report concretely: did it boot, render, move, and is the console clean — and
  for feel work, does the effect read on screen.

## Determinism aid

The sim is seeded; `updateArgs.rng.getSeed()` is the run seed. To reproduce a
specific scenario, fix the seed (temporarily hardcode it where `rng` is created
in `src/main.ts`) so enemy/powerup behavior repeats between captures.

## Cleanup

Stop the dev server when done (kill the background process).
