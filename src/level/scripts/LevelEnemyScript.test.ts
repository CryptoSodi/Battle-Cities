/// <reference path="../../types/Window.d.ts" />
import test from 'ava';

import { GameObject, Vector } from '../../core';
import { Session } from '../../game';
import { MapConfig } from '../../map';
import { TankParty } from '../../tank/TankParty';
import { TankTier } from '../../tank/TankTier';
import { TankType } from '../../tank/TankType';

import { LevelWorld } from '../LevelWorld';
import { LevelEventBus } from '../LevelEventBus';

import { LevelEnemyScript } from './LevelEnemyScript';

// Reproduces the exact bug: LevelEnemyScript.setup() (where its own
// enemySpawnCompleted listener registers) only runs lazily, on this script's
// FIRST invokeUpdate() call -- so an external listener registered eagerly
// (before that first update, e.g. during LevelPlayScene.setup()) could end up
// FIRST in the eventBus Subject's listener queue, running before the tank
// even exists. tankCreated sidesteps this: it's a plain Subject field that
// exists from construction, notified synchronously inside handleSpawnCompleted
// itself, so subscribing to it is safe regardless of when this happens
// relative to the script's own lazy setup().
test('tankCreated fires with the constructed tank even if subscribed before this script\'s first update', (t) => {
  const world = new LevelWorld(new GameObject(), 400, 400);
  const eventBus = new LevelEventBus();
  const session = new Session();
  const mapConfig = new MapConfig();

  const enemyScript = new LevelEnemyScript();
  // invokeInit() only calls init() (a no-op here), NOT setup() -- mirrors
  // LevelPlayScene calling allScripts.forEach(script => script.invokeInit(...)).
  enemyScript.invokeInit(world, eventBus, session, mapConfig);

  // Subscribe BEFORE the script's own first invokeUpdate() -- i.e. before its
  // lazy setup() has registered its own eventBus.enemySpawnCompleted listener.
  // This is exactly LevelPlayScene's timing for its enemy-fire recording hook.
  let receivedPartyIndex: number = null;
  enemyScript.tankCreated.addListener((tank) => {
    receivedPartyIndex = tank.partyIndex;
    // The tank must already be in getAliveTanks() at this point too.
    t.true(enemyScript.getAliveTanks().includes(tank));
  });

  // Now trigger the script's first update (its own setup() registers here).
  const stubUpdateArgs = {
    deltaTime: 1 / 60,
    audioLoader: { load: () => ({ play: () => undefined, stop: () => undefined }) },
    spriteLoader: { load: () => null, loadList: () => [] },
    collisionSystem: { register: () => undefined },
  } as any;
  enemyScript.invokeUpdate(stubUpdateArgs);

  // Fire the spawn-completed event the normal spawn pipeline would eventually
  // produce (that pipeline's own correctness is already verified separately;
  // this test isolates the listener-ordering question).
  eventBus.enemySpawnCompleted.notify({
    type: new TankType(TankParty.Enemy, TankTier.A, false),
    centerPosition: new Vector(100, 100),
    partyIndex: 3,
  });

  t.is(receivedPartyIndex, 3, 'tankCreated should have fired with the newly constructed tank');
});
