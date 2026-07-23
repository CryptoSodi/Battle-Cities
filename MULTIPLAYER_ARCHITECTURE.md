# BattleCities Multiplayer Architecture Handoff

Current date: 2026-07-24

This document describes the current BattleCities multiplayer architecture, how MagicBlock ER, WebRTC, and the original client engine are arranged, why the local player is ahead of the server, and what should be improved next.

## Executive summary

The current architecture is a hybrid realtime multiplayer model:

- The browser client still runs the original Battle City engine for rendering, input, local tank feel, camera, UI, animation, and cosmetic effects.
- MagicBlock Ephemeral Rollup is the authoritative game server path for shared match state.
- WebRTC is used as a faster peer-to-peer visual lane for mirrored player movement.
- Solana/MagicBlock transactions are not used for every rendered frame. They are used to submit player input/state and receive canonical state.
- Enemies are ER-authoritative.
- Terrain/base/death/score should continue moving toward ER-authoritative canonical events.

The key design principle:

```text
Client = responsive visuals and input prediction
WebRTC = low-latency peer visual preview
MagicBlock ER = canonical game authority
```

## Main files involved

### MagicBlock client integration

- `src/network/magicblock/MagicBlockMatchSync.ts`
  - Main MagicBlock match lifecycle and ER sync class.
  - Creates/joins match.
  - Delegates accounts.
  - Connects to ER.
  - Sends local input batches.
  - Receives account state updates.
  - Applies remote player, enemy, board, and match events.
  - Contains latency/debug UI controls.

- `src/network/magicblock/MagicBlockMovementSync.ts`
  - Wrapper/facade used by gameplay scene code.
  - Bridges `LevelPlayScene` to `MagicBlockMatchSync`.
  - Also still contains local-server routing hooks from earlier experiments.

- `src/network/magicblock/MagicBlockGhostSignalTransport.ts`
  - MagicBlock memo-based signaling transport for WebRTC.
  - Publishes and polls WebRTC offer/answer chunks through MagicBlock/Solana memo transactions.
  - This is signaling only; it is not the realtime tank data path.

- `src/network/magicblock/TankMovementIdl.ts`
  - Anchor IDL/client instruction layout used by the frontend.

### WebRTC mirror path

- `src/network/webrtc/WebRtcGhostSync.ts`
  - Browser-native WebRTC data channel manager.
  - Creates/pastes offer/answer codes.
  - Sends tank snapshots over the WebRTC data channel.
  - Exposes `window.battleCityGhostMirror` debug/manual API.
  - Can use MagicBlock signaling transport once configured.

- `src/level/scripts/LevelWebRtcGhostScript.ts`
  - Level script that captures local player tank snapshots and sends them over WebRTC.
  - Applies remote WebRTC snapshots to the mirrored remote tank for faster visual movement.
  - Temporarily restores the remote tank to the server path before MagicBlock update, then switches back to WebRTC visual path.
  - Converts server-path mirror bullets into ghost bullets so visual bullets do not double-apply damage.

### Gameplay scene and scripts

- `src/scenes/level/LevelPlayScene.ts`
  - Main level update loop.
  - Calls MagicBlock match update.
  - Calls enemy sync.
  - Applies board mutations.
  - Applies local match events.
  - Contains camera-follow logic and death/score event handlers.

- `src/level/scripts/LevelEnemyScript.ts`
  - Owns client-side enemy object creation/removal.
  - In MagicBlock mode, enemies are network-controlled and use standstill behavior locally.
  - Spawns local render objects to match ER active enemy IDs.
  - Removes enemies that disappear from ER state.
  - Current local fix uses `tank.die(...)` so enemy death blast/audio path is preserved.

- `src/gameObjects/Tank.ts`
  - Base tank movement, collision, fire, bullet hit, death, and collider logic.

- `src/gameObjects/EnemyTank.ts`
  - Enemy-specific tank behavior.
  - Network-controlled enemies ignore local damage because ER owns real damage/death.

- `src/gameObjects/Bullet.ts`
  - Bullet movement, local collision, small explosion, nullify/explode behavior.
  - Network-controlled bullets should remain cosmetic unless ER confirms effects.

### MagicBlock program

- `Magic/programs/tank-movement/src/lib.rs`
  - Rust/Anchor MagicBlock program.
  - Owns authoritative match account state.
  - Simulates/validates player movement updates.
  - Runs enemy simulation.
  - Owns authoritative board mutation/projectile/enemy/base logic as this work progresses.

## Network/runtime topology

```text
┌──────────────────────────┐
│ Player 1 browser client  │
│                          │
│ Original game engine     │
│ Local prediction         │
│ WebRTC sender/receiver   │
│ MagicBlock client        │
└────────────┬─────────────┘
             │
             │ WebRTC data channel
             │ fast visual tank snapshots
             ▼
┌──────────────────────────┐
│ Player 2 browser client  │
│                          │
│ Original game engine     │
│ Local prediction         │
│ WebRTC sender/receiver   │
│ MagicBlock client        │
└────────────┬─────────────┘
             │
             │ ER transactions/account updates
             ▼
┌──────────────────────────┐
│ MagicBlock ER            │
│                          │
│ Authoritative match PDA  │
│ Enemy simulation         │
│ Board mutations          │
│ Projectile outcomes      │
│ Match phase              │
└────────────┬─────────────┘
             │
             │ delegated account lifecycle
             ▼
┌──────────────────────────┐
│ Solana base layer        │
│                          │
│ account creation         │
│ delegation               │
│ eventual commits         │
└──────────────────────────┘
```

## Match setup flow

Player 1 host path:

1. Browser creates/loads match PDA.
2. If needed, match account is created on base MagicBlock/Solana RPC.
3. Host waits for player two to join.
4. Terrain/match accounts are delegated to MagicBlock ER.
5. Client asks router for the delegated account ER endpoint.
6. Client connects to that ER endpoint.
7. Host starts match on ER if phase is not already live.
8. Match crank/simulation is scheduled.
9. Client enters ready/live mode.

Player 2 join path:

1. Browser loads match PDA from link.
2. If match is still on base and player two is not joined, it submits `joinMatch`.
3. Joiner waits for host to delegate/start.
4. Joiner connects to ER endpoint.
5. Joiner waits until match phase is live.
6. Client enters ready/live mode.

Recent change:

- Hard timeout waiting for player two was removed.
- Hard timeout waiting for host start was removed.
- The client now waits indefinitely unless the user leaves/reloads.

## MagicBlock routing model

The integration uses a dual-connection model:

- Base layer RPC:
  - Used for match account creation.
  - Used for join.
  - Used for delegation.

- Router RPC:
  - Used to query delegation status and find the correct ER endpoint.

- ER RPC:
  - Used after delegation.
  - Used for live gameplay transactions and account updates.

The current devnet ER target used by the client is Asia-oriented:

```text
devnet-as.magicblock.app
```

The code has latency tools for checking MagicBlock endpoints, including mainnet ER endpoints.

## Current local player movement flow

When the local player presses a movement key:

```text
Keyboard input
  ↓
Original client tank logic moves local tank immediately
  ↓
Input/movement frame is recorded
  ↓
Client submits update transaction to MagicBlock ER
  ↓
ER validates/applies authoritative movement
  ↓
ER account update returns to client
  ↓
Client reconciles local state if needed
```

The important part is this:

```text
The local client moves first.
The server/ER confirms later.
```

This is intentional client-side prediction. Without it, the game would feel delayed by network latency.

## Why the player client is always ahead of the server

The local client is ahead because it renders input immediately.

If MagicBlock/ER round-trip latency is 120-180 ms, then the visual local tank can be roughly 120-180 ms ahead of the authoritative ER state.

Timeline:

```text
t=0ms      player presses right
t=0ms      local tank moves right on screen
t=0-16ms   client queues/sends movement transaction
t=100ms+   ER receives/applies movement
t=120ms+   account update returns to clients
```

So the local player sees:

```text
predicted local state
```

while ER has:

```text
older canonical state
```

That is normal for realtime multiplayer. The architecture should not try to remove this gap completely. It should manage it.

## Current remote player movement flow

Remote player rendering has two paths.

### Path A: MagicBlock authoritative path

MagicBlock stores the canonical player state. This is the reliable authority but has network delay.

Used for:

- validation
- canonical match state
- correction/reconciliation
- gameplay authority

### Path B: WebRTC ghost visual path

WebRTC sends faster peer-to-peer tank snapshots.

Used for:

- visual mirror responsiveness
- smoother remote player tank movement
- lower perceived latency than ER-only updates

WebRTC is not the gameplay authority.

Current intended split:

```text
WebRTC = remote player visual preview
MagicBlock ER = real state authority
```

## WebRTC signaling arrangement

The realtime WebRTC data channel does not use MagicBlock once connected.

But the initial WebRTC offer/answer signaling can use MagicBlock memo transactions:

```text
Player 1 creates WebRTC offer
  ↓
Offer is chunked into MagicBlock memo transactions
  ↓
Player 2 polls/reads offer
  ↓
Player 2 creates answer
  ↓
Answer is chunked into MagicBlock memo transactions
  ↓
Player 1 reads answer
  ↓
WebRTC peer connection opens
  ↓
Tank snapshots flow directly peer-to-peer
```

Files:

- `src/network/magicblock/MagicBlockGhostSignalTransport.ts`
- `src/network/webrtc/WebRtcGhostSync.ts`

## Current enemy architecture

Enemies are ER-authoritative.

The local client does not run real enemy AI in MagicBlock mode. It creates local enemy render objects, but their behavior is network-controlled/standstill.

Flow:

```text
ER simulation/crank updates enemy state
  ↓
Match account publishes active enemies
  ↓
Client reads enemy snapshots
  ↓
Client creates/removes/moves local EnemyTank objects
  ↓
Client interpolates/replays visual movement
```

This is why enemy movement currently syncs better than earlier snapshot-only attempts.

## Current enemy death behavior

Current fixed behavior:

1. ER removes a killed enemy from active enemy state.
2. Client sees that an existing rendered enemy ID no longer exists in ER active IDs.
3. Client calls the normal `tank.die(...)` path.
4. Existing game event flow runs:
   - enemy death event
   - explosion animation
   - explosion audio
   - collider unregister
   - remove from alive list
5. New enemy can spawn without leaving the old rendered tank behind.

Current limitation:

- ER enemy state does not yet publish `killedBy`/`hitterPartyIndex` as a proper canonical death event.
- Client therefore guards score awarding when hitter is missing.
- This prevents crashes/incorrect scoring but means kill attribution is incomplete until ER emits explicit enemy death events.

## Current projectile/bullet architecture

This is the least clean part of the system today.

Current intended direction:

- Local bullets can spawn immediately for responsiveness.
- Mirror bullets can spawn visually for the remote player.
- Bullet visuals should be cosmetic unless confirmed by ER.
- Terrain mutation, enemy death, player death, base death, and scoring should be ER-canonical.

Current mixed behavior:

- Some bullet visuals are local/mirrored.
- Board mutations are expected to come from ER.
- Mirror bullets must not submit local board damage again.
- Enemy death is currently inferred when enemy disappears from ER active enemy list.

The recommended next improvement is to stop inferring important outcomes from snapshots and publish canonical ER events.

## Current board/terrain architecture

The terrain state is uploaded into the MagicBlock program/account area.

The ER simulation is expected to own canonical terrain destruction.

Client behavior:

- Local bullet wall destruction should be cosmetic/predicted only.
- Real board state should be updated from ER board mutations.
- When the user disables mirror bullets for debugging, board mutations should still reflect ER state.

Current debugging mode:

- Hiding mirror bullets is used to observe server/ER snapshot behavior without visual bullet effects confusing the result.

## Current base-wall behavior

Base wall bricks were treated specially because the original map has the base/eagle plus surrounding brick wall sections.

The desired model:

- Eagle/base heart is the base.
- Surrounding wall sections should behave like normal bricks.
- ER terrain should allow destroying those bricks and moving into destroyed cells.

There have been recent fixes around:

- side wall destroyability
- bottom wall sections
- movement into destroyed base-wall cells
- avoiding server-side collision rejection after base-wall destruction

## Current timing/tick situation

Client:

- Runs the original game loop.
- Local rendering is frame-based.
- Local player movement is immediate.

MagicBlock ER:

- Receives transaction updates.
- Runs match simulation/crank logic.
- Publishes account state updates.

WebRTC:

- Sends visual tank snapshots at a configured send interval.
- Bypasses ER latency for visual remote tank movement.

Important constants to inspect:

- `SEND_INTERVAL_MS` in `MagicBlockMatchSync.ts`
- `POLL_INTERVAL_MS` in `MagicBlockMatchSync.ts`
- WebRTC send interval in `LevelWebRtcGhostScript.ts`
- Remote replay/interpolation constants in `MagicBlockMatchSync.ts`

## Current problem class: local ahead, server behind

The main architectural issue:

```text
Local predicted player is ahead.
ER authoritative state is behind by network latency.
Remote visual state may be WebRTC-fast but must still be corrected by ER.
```

This affects:

- bullet spawn location
- bullet hit timing
- enemy collision
- player/enemy overlap
- base hits
- wall destruction
- score/death events

Example:

```text
Player sees own tank at x=500 and fires.
ER may still know player at x=480.
If ER uses x=480 for projectile spawn, the remote/mirror view may look wrong.
If client uses x=500 for real damage, authority is broken.
```

This is the core problem to solve next.

## Recommended target architecture

The target should be a disciplined hybrid:

```text
Local player:
  instant predicted movement
  predicted fire visuals
  smooth correction from ER

Remote player:
  WebRTC visual movement for responsiveness
  ER anchoring/correction for authority

Enemies:
  ER authoritative simulation
  client interpolation/replay

Projectiles:
  local visual prediction
  ER authoritative projectile spawn/hit/death/mutation events

Terrain/base/score/deaths:
  ER-only canonical outcomes
```

## Recommended improvement plan

### Phase 1: Make predicted vs authoritative state explicit

Right now predicted/canonical/visual states exist implicitly.

Create clear concepts:

```text
predictedLocalPlayerState
authoritativeLocalPlayerState
remoteVisualPlayerState
authoritativeRemotePlayerState
```

Goal:

- local tank remains responsive
- reconciliation becomes intentional
- no accidental overwrite between WebRTC visual path and ER server path

### Phase 2: Add tick/sequence metadata everywhere

Every important update should carry:

```text
simulationTick
clientInputSequence
serverEventSequence
sourcePlayerIndex
```

Apply this to:

- player movement
- fire input
- projectile spawn
- projectile hit
- enemy movement
- enemy death
- board mutation
- base death
- match win/loss

Without this, debugging ahead/behind issues remains guesswork.

### Phase 3: Move player replication toward input commands

Preferred model:

```text
client sends:
  direction
  fire
  sequence
  duration/tick count
  local predicted start position for validation/debug
```

ER simulates movement using the same movement rules.

Remote clients can then:

- replay input movement
- anchor to ER state
- use WebRTC only for fast visual preview

### Phase 4: Keep WebRTC as a visual lane only

WebRTC should not decide real outcomes.

Use WebRTC for:

- remote tank visual movement
- remote fire visual hint
- latency tests/debugging

Do not use WebRTC for:

- real damage
- terrain destruction
- enemy death
- player death
- base death
- score
- win/loss

### Phase 5: Add canonical ER event stream

This is the most important next architecture step.

The ER program should publish typed events, not just snapshots:

```ts
type CanonicalEvent =
  | { kind: 'player_moved'; player: number; x: number; y: number; direction: number; sequence: number; tick: number }
  | { kind: 'player_fired'; player: number; projectileId: number; x: number; y: number; direction: number; tick: number }
  | { kind: 'projectile_hit_terrain'; projectileId: number; x: number; y: number; mutations: BoardMutation[]; tick: number }
  | { kind: 'projectile_hit_enemy'; projectileId: number; enemyId: number; hitterPlayer: number; tick: number }
  | { kind: 'enemy_died'; enemyId: number; hitterPlayer: number | null; x: number; y: number; tick: number }
  | { kind: 'enemy_spawned'; enemyId: number; x: number; y: number; type: number; tick: number }
  | { kind: 'base_died'; hitter: number | 'enemy'; tick: number }
  | { kind: 'match_won'; tick: number }
  | { kind: 'match_lost'; tick: number };
```

Benefits:

- enemy death blast becomes exact
- bullet hit effects become exact
- score attribution becomes correct
- board mutations are tied to projectile hits
- debugging becomes much easier

### Phase 6: Reconciliation rules

Local player correction:

- If ER position is close, blend correction.
- If ER position is far, snap or fast-correct.
- Do not correct every frame in a way that creates jitter.

Remote player correction:

- Prefer WebRTC visual movement.
- Periodically compare against ER authoritative state.
- If divergence is small, ignore or blend.
- If divergence is large, snap/fast-correct.

Enemy correction:

- ER is source of truth.
- Client interpolates between ER updates.
- Do not let client collision decide enemy authority.

Projectile correction:

- Show local/mirror projectile immediately.
- When ER event arrives, align, explode, nullify, or convert the visual projectile.
- Board mutation is applied only from ER event.

### Phase 7: Build debug overlays for latency and divergence

Add debug values on screen:

```text
ER latency
WebRTC latency
local predicted position
ER authoritative position
prediction error px
remote WebRTC vs ER error px
last server tick
last input sequence acked
last canonical event sequence
```

This will make multiplayer tuning much faster.

## Immediate next tasks

Recommended order:

1. Add canonical ER enemy death event with `enemyId`, position, `hitterPlayer`, and tick.
2. Use that event on client instead of inferring death only from missing enemy ID.
3. Add canonical projectile hit events.
4. Tie board mutations to projectile hit events.
5. Add player fire event alignment so bullets spawn from the same canonical position on both clients.
6. Add prediction error debug overlay.
7. Tune WebRTC visual correction against ER anchors.
8. Add explicit local predicted vs authoritative state structures.

## Non-goals for now

Do not try to make every client and ER appear on the exact same frame. That is unrealistic with network latency.

Do not make WebRTC authoritative for gameplay outcomes.

Do not reintroduce full screen/game snapshots as the primary sync model.

Do not let local bullet collision permanently mutate shared state.

## Architectural stance

The correct long-term model is not pure server lockstep and not pure client authority.

For this game, the correct model is:

```text
responsive client prediction
+ WebRTC visual acceleration
+ MagicBlock ER canonical outcomes
+ deterministic event replay
+ smooth reconciliation
```

This keeps the game feeling responsive while preserving the main reason to use MagicBlock: replacing the traditional authoritative game server for shared state, simulation, and outcomes.
