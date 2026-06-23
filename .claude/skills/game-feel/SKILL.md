---
name: game-feel
description: >-
  Add game-feel / "juice" (particles, screen shake, hit-stop, muzzle flash,
  recoil, tread marks, layered explosions, flashes) and new LevelScripts to this
  BattleCity / "Iron Siege" engine. Use this WHENEVER the user wants the game to
  feel better, juicier, punchier, or more modern; to add, change, or tune any
  visual or audio effect; to react to a gameplay event; or to add a new
  level-level subsystem — even when phrased as "make explosions cooler", "add
  screen shake", or "the shooting feels weak". It covers the LevelScript
  lifecycle, the event bus + per-tank Subjects, script registration, the
  cosmetic overlay particle layer, and the load-bearing determinism rule.
---

# Game feel & LevelScripts

Effects in this engine are **decoupled**: gameplay emits events, effects
subscribe and react. This keeps juice toggleable, perf-scalable, and (critically)
out of the deterministic simulation. Mirror the existing
`LevelAudioScript` / `LevelExplosionScript` — adding a parallel effects script is
the idiomatic move, not scattering effect code into gameplay objects.

## The two event channels

1. **`LevelEventBus`** (`src/level/LevelEventBus.ts`) — the level-wide bus.
   Useful Subjects (with payload events under `src/level/events/`):
   `enemyDied`, `enemyExploded`, `enemyHit`, `enemySpawnCompleted`,
   `mapTileDestroyed`, `baseDied`, `playerDied`, `playerFired`, `playerSlided`,
   `powerupSpawned`, `powerupPicked`, `powerupRevoked`, `levelPaused`,
   `levelUnpaused`. `mapTileDestroyed` carries `{ type, position, size }`.
2. **Per-tank `Subject`s** (`src/gameObjects/Tank.ts`) — `fired`, `hit`, `died`,
   `slided`. Use these for per-entity feedback (recoil, hit-flash, tread dust).

## Adding a LevelScript

Extend `src/level/LevelScript.ts`. You get `this.world`, `this.eventBus`,
`this.session`, `this.mapConfig`. Lifecycle:
- `init()` — one-time, before updates.
- `setup(updateArgs)` — first update tick; subscribe to events here (and grab
  `updateArgs.rng` only if you need *sim* randomness — effects do NOT, see below).
- `update(updateArgs)` — per fixed sim step; advance timers with
  `updateArgs.deltaTime`.

Register it in `src/scenes/level/LevelPlayScene.ts`:
- Instantiate in the script block (~line 120, e.g. `this.juiceScript = new LevelJuiceScript();`).
- Add it to `this.allScripts` (~line 135).
- Push it into `this.playingUpdateScripts` (runs only during play) or
  `this.alwaysUpdateScripts` (always, like audio/intro).

See `references/level-hooks.md` for the full event catalog and the exact
registration snippet.

## The cosmetic overlay layer

Particles, decals, flashes, and shake render on a **separate always-cleared
overlay canvas** composited over the main canvas — NOT through the dirty-rect
compositor in `src/core/GameRenderer.ts` (it would smear). Particles live in a
pooled typed-array store drawn in one batch. If that overlay layer isn't present
yet, build it first (it's Phase 0 task 4). Hit-stop is driven by
`GameLoop.setTimeScale()`; screen shake/camera punch go through the level camera.

## The load-bearing determinism rule

This game is built for skill-based, replay-verified tournaments, so the sim must
stay byte-reproducible:

- **Effects use `Math.random` / `RandomUtils` — NEVER `updateArgs.rng`.** The
  `rng` is the seeded *simulation* stream; drawing cosmetic randomness from it
  desyncs replays. Cosmetic randomness must come from the unseeded source.
- **Effects must never mutate gameplay state** the sim reads (positions, health,
  collision, sim timers). They only read events and write to the overlay/audio.
- Respect the **master intensity scalar** (reduced-motion / low-end): scale
  particle counts, shake magnitude, and hit-stop duration — but never hit
  detection or movement outcomes.

## Procedure

1. Pick the triggering event (bus Subject or tank Subject).
2. Add a handler in the effects script (or a new `Level*Script`).
3. Spawn pooled particles/decals, set a sprite flash, request camera
   shake/punch, or trigger hit-stop via `timeScale`.
4. Gate magnitude by the intensity scalar; draw additively for glow.
5. `npx tsc --noEmit`, then verify on screen with the `run-level` skill.
