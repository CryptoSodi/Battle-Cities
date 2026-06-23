# Iron Siege — A Modern Reimagination of Battle City

*Design brief. Working title: **Iron Siege**.*

## What it is

Iron Siege is a **deterministic, top-down tank-action roguelike** descended directly from Namco's Battle City (1985). You still pilot a single tank, chew through destructible brick, and defend an objective. But the movement now has **weight and momentum**, every shell lands with **hit-stop, recoil, and sparks**, the camera **breathes and shakes**, and a session is a **seeded 8–15 stage run** where you draft tradeoff-based upgrade cards between fights.

The 1985 soul — 1–2 hit lethality, brick/steel destruction, base defense — is the **spine**, preserved literally as a "Classic" mode. Everything modern layers *on top of* the existing engine (`GameObject` tree, `LevelScript` + event-bus, `Subject` plumbing) rather than replacing it.

Crucially, the simulation is rebuilt to run on a **fixed timestep with a seeded PRNG**, so runs are byte-reproducible. That single property is what makes the game *feel* tight today **and** what makes the deferred Solana economy (entry-fee fuel, skill-based payouts, replay-based anti-cheat) possible later — without ever putting gameplay on-chain or letting a wallet buy power.

## Design pillars

1. **Weight over teleport.** Instant grid-step movement is the #1 tell of a 1985 game. Tanks accelerate, coast, and dig their treads in; shells recoil the barrel and kick the body; hits freeze time for 40–90 ms with a white flash.
2. **Lethal & readable, never spongy.** Most tanks die in 1–2 hits. Depth is positioning, directional armor, cooldown abilities, and distinct weapons — not HP bars. Everything must be legible at a glance.
3. **Every run is different.** A seeded roguelike run replaces the fixed 35-level march; the 35 original maps become a tagged room pool. Replayability the original never had, at near-zero new-art cost.
4. **Deterministic spine.** Fixed-timestep sim + seeded PRNG + per-tick input log as the canonical match artifact. Consistent feel across machines, free ghost replays, and the only credible anti-cheat for real-money play.
5. **Cinematic surface, honest sim.** HD-painted metallic art authored at 3× and downsampled, layered explosions, reactive camera, particles on an overlay layer that never touches the sim. Visuals are strictly cosmetic and device-scalable.
6. **Skill-first economy compatibility.** Coin/fuel buys only entry, retries, and cosmetics. Attributes and drops are identical for all ranked entrants. The economy consumes one signed scalar result per match; the sim never sees the wallet.

## Grounding: what the repo already gives us

Inspection of `src/` confirms the engine is a *better* starting point than it looks:

- **Event seam exists.** `LevelExplosionScript` / `LevelAudioScript` already subscribe to an `eventBus` (`enemyDied`, `playerDied`, `mapTileDestroyed` wired at `LevelPlayScene.ts:109`) and per-tank `Subject`s (`fired`/`hit`/`died`/`slided`, `Tank.ts:72–78`). A parallel **`LevelJuiceScript`** is idiomatic and touches no gameplay logic.
- **Surface-modulated movement exists.** The `isOnIce` + `slideTimer` path (`Tank.ts:81,186`) proves per-surface movement modulation — momentum is an *extension*, not new architecture.
- **Pluggable AI exists.** `behaviors/` already has `StandFireTankBehavior`, `PatrolFireTankBehavior` injected via `TankFactory`; archetypes drop in cleanly.
- **Run engine in disguise.** `Session` (start/activateNextLevel/isLastLevel, multiplayer, two `SessionPlayer`s) + a swappable `MapListReader` mean a seeded `RunMapListReader` is the single highest-leverage structural change.
- **Mutable attribute table.** `TankAttributesFactory.create()` returns an `Object.assign` clone and literally carries a `TODO: move configuration to json` — the exact seam for stackable upgrade cards and classes.

### What must change (named blockers)

- **`src/core/GameLoop.ts:95`** feeds raw rAF `deltaTime` to everyone → variable, non-reproducible. Convert to a fixed-step accumulator with a global `timeScale`.
- **`src/core/utils/RandomUtils.ts:10`** uses bare `Math.random()` → seed it (xorshift/PCG), thread via `GameUpdateArgs`.
- **`src/core/GameRenderer.ts`** is a **dirty-rectangle** compositor (`dirtyPassCount:2`, `findIntersectionBoxes`). Hundreds of fading/additive particles would smear it. Needs an **overlay always-cleared canvas** escape hatch — the prerequisite for nearly all juice.
- **`src/core/render/contexts/CanvasRenderContext.ts`** has **no** `save/restore/scale/translate/globalCompositeOperation` (confirmed by grep). Camera scale, shake offset, and additive glow all require adding them.
- **`LevelPlayScene.ts:235 updateCamera()`** instant-snaps `field.position` and defeats the dirty-rect optimization with `root.setNeedsPaint()` (`:291`) — renderer and camera already fight. Formalize a `Camera` with a view transform.
- **`Tank.move()` (`:315`)** is instant `translateY(moveSpeed*dt)`. The grid-snap in `rotate()` (`:337`) and the Minkowski resolver assume on-grid positions — momentum must **re-snap on full stop** to avoid jitter/stuck corners.

## The vertical slice — "One Tank, One Map, Modern Feel"

**Goal:** prove the entire feel transformation end-to-end with a single player tank on one existing map. No classes, no upgrade cards, no run structure, **no economy**. If it feels like a 2024 game in 30 seconds of driving and shooting, the reimagination is proven.

**Includes:** fixed-timestep + seeded PRNG + input-log record/replay (proven byte-identical); momentum + tread-friction movement; muzzle flash + barrel/body recoil + tracer + camera punch on `fire()`; hit-stop + white flash on `hit`/`explode()`; follow-lerp + aim-look-ahead + trauma-shake camera; an **overlay `ParticleLayer`** (brick chunks, dust, sparks, tread decals); a `LevelJuiceScript`; a layered explosion (fireball + sparks + smoke + flash); a Web Audio mixer (polyphony + pitch jitter); one HD tank via `Sprite` `destinationRect`; and a master intensity scalar.

**Excludes:** classes/armor/abilities/weapon variety; smart AI/pathfinding; run structure & upgrade draft; survival/co-op/daily/bosses; the full WebGL2 renderer; spatial-hash collision; the headless verifier; **and all economy**.

## Roadmap

| Phase | Outcome | Economy/MP slot-in |
|---|---|---|
| **0 — Determinism + Feel Slice** | One tank feels modern; sim is fixed-step, seeded, locally replay-reproducible | — |
| **1 — Mechanics Depth** | Classes, directional armor, cooldown abilities, weapon variety, smart AI; needs a `queryArea/queryRay` on `CollisionSystem` first | — |
| **2 — Run Structure & Modes** | Seeded roguelike run, upgrade-card draft, Last Stand survival, local co-op, daily seeds, cosmetic-only meta-progression | Pay-to-win firewall enforced architecturally |
| **3 — Renderer & Scale** | Batched WebGL2 + additive/lighting/bloom; swarm particle pools; spatial-hash collision; toolchain (Vite/TS5) | — |
| **4 — Async Competition** | Shared-seed Gauntlet Trials + ghost time-trials, validated by **server re-sim of input logs** | **Solana economy opens here**: Phantom per-purchase fuel as pre-match entry sink (zero in-run effect), cosmetic shop, staking, payouts referencing only a signed attestation hash. No gameplay on-chain, no per-match tx. |
| **5 — Realtime MP (last/optional)** | Realtime PvP/co-op arena via lockstep/rollback on the already-fixed-step sim | — |

**Why this order:** async seeded competition gives "PvP feeling" with zero netcode and is the structurally correct first coin sink; realtime PvP is multi-week netcode and must not jump the queue. The match artifact `{version, mapId, seed, inputFrames[]}` *is* the replay, the spectator feed, and the anti-cheat evidence — one artifact, three uses. The economy only ever consumes a single signed `{matchId, walletId, mapId, seed, inputLogHash, score, outcome}` attestation (grown from `api/health.ts`).

## Highest-leverage open decisions

1. **Determinism now vs. later** → **now** (Phase 0). Smallest surface area today; load-bearing for the whole coin roadmap.
2. **Canvas2D vs. WebGL2** → **phase it**: overlay-canvas Canvas2D through Phase 2, commit to WebGL2 in Phase 3 only when bloom/lighting/density demand it.
3. **Roguelike vs. linear campaign** → **roguelike primary, Classic preserved**. Natural session boundary fits fuel economics; linear is save-scummable.
4. **Async vs. realtime competition first** → **async first, realtime last**.
5. **Firewall: convention vs. architecture** → **architecture**. Ranked loadouts profile-independent so stat config is physically unreachable from the wallet path.

## First engineering tasks (start today)

1. Fixed-timestep accumulator + global `timeScale` in `GameLoop.ts`.
2. Seeded PRNG in `RandomUtils.ts`, threaded via `GameUpdateArgs`; reroute all existing draws.
3. Per-tick input recorder/replay in `PlayerTankBehavior.ts`; prove byte-identical re-run.
4. Overlay particle canvas + pooled typed-array store in `GameRenderer.ts`.
5. Add `save/restore/scale/translate/globalCompositeOperation` + sprite flash field to `CanvasRenderContext.ts`.
6. Momentum velocity in `Tank.move()` + accel/friction/coast fields; re-snap on stop.
7. Shooting feel pass in `Tank.fire()` (muzzle flash, recoil, tracer, camera punch).
8. Hit-stop + flash on `Tank.hit` / `Bullet.explode()`.
9. Camera rewrite in `updateCamera()` (follow-lerp + look-ahead + trauma-shake; drop the `setNeedsPaint()` hack).
10. New `LevelJuiceScript` for destruction/dust/spark/tread FX.
11. Layered explosion `GameObject` replacing `SmallExplosion`/`Explosion`.
12. Web Audio mixer under the existing `AudioManager` API + master intensity scalar.