# Level hooks reference

## LevelEventBus Subjects (`src/level/LevelEventBus.ts`)

Payload event shapes are in `src/level/events/`.

| Subject | Payload | Fires when |
|---|---|---|
| `baseDied` | — | the player base (eagle) is destroyed |
| `enemyAllDied` | — | all enemies for the level are gone (win trigger) |
| `enemyDied` | `LevelEnemyDiedEvent` | an enemy tank dies |
| `enemyExploded` | `LevelEnemyExplodedEvent` | an enemy's explosion resolves |
| `enemyHit` | `LevelEnemyHitEvent` | an enemy is hit (carries tank type → drops) |
| `enemySpawnCompleted` | `LevelEnemySpawnCompletedEvent` | enemy finished spawning |
| `enemySpawnRequested` | `LevelEnemySpawnRequestedEvent` | spawn requested |
| `mapTileDestroyed` | `LevelMapTileDestroyedEvent` `{ type, position, size }` | a terrain tile is destroyed — the destruction-juice hook |
| `playerDied` | `LevelPlayerDiedEvent` | a player tank dies |
| `playerFired` | — | player fired a shot |
| `playerSlided` | — | player slid on ice |
| `playerSpawnCompleted` / `playerSpawnRequested` | events | player spawn lifecycle |
| `powerupSpawned` / `powerupPicked` / `powerupRevoked` | events | powerup lifecycle |
| `levelPaused` / `levelUnpaused` | — | pause toggling |
| `levelGameOverCompleted` / `levelWinCompleted` | — | end-of-level transitions |

## Per-tank Subjects (`src/gameObjects/Tank.ts`)

`fired`, `hit`, `died`, `slided` — subscribe for per-entity feedback (recoil on
fire, white flash + hit-stop on hit, layered explosion on death, dust on slide).

## Registration snippet (`src/scenes/level/LevelPlayScene.ts`)

```ts
// 1) instantiate alongside the others (~line 120)
this.juiceScript = new LevelJuiceScript();

// 2) include in allScripts (~line 135) so init/setup run
this.allScripts = [
  // …existing scripts…
  this.juiceScript,
];

// 3) run it during play (or alwaysUpdateScripts for always-on effects)
this.playingUpdateScripts.push(this.juiceScript);
```

`allScripts` gets `invokeInit(world, eventBus, session, mapConfig)`;
`playingUpdateScripts` runs only while the level is actively playing,
`alwaysUpdateScripts` (e.g. audio, intro) runs regardless of pause/win/over.
