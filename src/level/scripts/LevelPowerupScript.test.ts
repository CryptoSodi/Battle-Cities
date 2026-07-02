/// <reference path="../../types/Window.d.ts" />
import test from 'ava';

import { GameObject, Prng } from '../../core';
import { GameUpdateArgs, Session } from '../../game';
import { MapConfig } from '../../map';
import { PowerupSpawnFrame } from '../../replay';
import { TankParty } from '../../tank/TankParty';
import { TankTier } from '../../tank/TankTier';
import { TankType } from '../../tank/TankType';

import { LevelEventBus } from '../LevelEventBus';
import { LevelWorld } from '../LevelWorld';

import { LevelPowerupScript } from './LevelPowerupScript';

function makeUpdateArgs(rng: Prng): GameUpdateArgs {
  return { deltaTime: 1 / 60, rng } as unknown as GameUpdateArgs;
}

function setupScript(rng: Prng): { script: LevelPowerupScript; eventBus: LevelEventBus } {
  const world = new LevelWorld(new GameObject(), 640, 640);
  const eventBus = new LevelEventBus();
  const session = new Session();
  const mapConfig = new MapConfig();

  const script = new LevelPowerupScript();
  script.invokeInit(world, eventBus, session, mapConfig);
  script.invokeUpdate(makeUpdateArgs(rng)); // triggers its lazy setup()

  return { script, eventBus };
}

const DROP_TANK_TYPE = new TankType(TankParty.Enemy, TankTier.A, true);

test('recording captures the chosen powerup type/position, and replaying reproduces it under a different seed', (t) => {
  // Original "recording" run.
  const original = setupScript(new Prng(111));
  original.script.startRecordingPowerups();

  original.eventBus.enemyHit.notify({ type: DROP_TANK_TYPE });
  original.eventBus.enemyHit.notify({ type: DROP_TANK_TYPE });

  const recorded: PowerupSpawnFrame[] = original.script.getRecordedPowerupSpawns();
  t.is(recorded.length, 2, 'expected two recorded powerup spawns');

  // Replay run, fed the recorded frames, but under a COMPLETELY DIFFERENT
  // seed -- proving the replayed spawns come from the recording, not rng.
  const replay = setupScript(new Prng(999999));
  replay.script.setReplayPowerupSpawns(recorded);

  const replayedPicked: { type: string; position: { x: number; y: number } | null }[] = [];
  replay.eventBus.powerupSpawned.addListener((event) => {
    replayedPicked.push({ type: event.type, position: event.position ? { x: event.position.x, y: event.position.y } : null });
  });
  replay.eventBus.powerupPicked.addListener((event) => {
    // Direct-to-player case never fires powerupSpawned; capture it here too.
    replayedPicked.push({ type: event.type, position: null });
  });

  replay.eventBus.enemyHit.notify({ type: DROP_TANK_TYPE });
  replay.eventBus.enemyHit.notify({ type: DROP_TANK_TYPE });

  t.is(replayedPicked.length, recorded.length);
  recorded.forEach((frame, index) => {
    t.is(replayedPicked[index].type, frame.type, `spawn ${index} type should match the recording`);
    if (frame.position !== null) {
      t.deepEqual(replayedPicked[index].position, frame.position, `spawn ${index} position should match the recording`);
    }
  });
});
