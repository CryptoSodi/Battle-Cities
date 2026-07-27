/// <reference path="../../types/Window.d.ts" />
import test from 'ava';

import { GameObject, Vector } from '../../core';
import { Session } from '../../game';
import { PlayerTank } from '../../gameObjects';
import { MapConfig } from '../../map';
import { TankDeathReason } from '../../tank/TankDeathReason';
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

test('network enemy removal emits the normal death effect event once', (t) => {
  const world = new LevelWorld(new GameObject(), 400, 400);
  const eventBus = new LevelEventBus();
  const session = new Session();
  const mapConfig = new MapConfig();
  const enemyScript = new LevelEnemyScript(true);
  enemyScript.invokeInit(world, eventBus, session, mapConfig);

  const stubUpdateArgs = {
    deltaTime: 1 / 60,
    audioLoader: { load: () => ({ play: () => undefined, stop: () => undefined }) },
    spriteLoader: { load: () => null, loadList: () => [] },
    collisionSystem: { register: () => undefined },
    magicBlockMovement: {
      setPlayerMirrorBulletsSuppressed: () => undefined,
    },
  } as any;
  enemyScript.invokeUpdate(stubUpdateArgs);

  eventBus.enemySpawnCompleted.notify({
    type: new TankType(TankParty.Enemy, TankTier.A, false),
    centerPosition: new Vector(100, 100),
    partyIndex: 3,
  });

  const deaths = [];
  eventBus.enemyDied.addListener((event) => deaths.push(event));
  enemyScript.syncNetworkEnemyDeaths([
    {
      partyIndex: 3,
      x: 110,
      y: 120,
      reason: TankDeathReason.Bullet,
      hitterPartyIndex: 1,
    },
  ]);

  t.is(deaths.length, 1);
  t.true(deaths[0].networkMirror);
  t.is(deaths[0].hitterPartyIndex, 1);
  t.deepEqual(deaths[0].centerPosition, new Vector(110, 120));
  t.is(enemyScript.getAliveTanks().length, 0);
});

test('authoritative enemy spawn waits while a player occupies its spawn point', (t) => {
  const world = new LevelWorld(new GameObject(), 400, 400);
  const eventBus = new LevelEventBus();
  const enemyScript = new LevelEnemyScript(false);
  enemyScript.invokeInit(world, eventBus, new Session(), new MapConfig());

  const spawnPosition = new Vector(32, 32);
  const player = new GameObject(64, 64) as PlayerTank;
  player.position.copyFrom(spawnPosition);
  player.updateMatrix();
  world.addPlayerTank(0, player);

  const script = enemyScript as any;
  script.list = [new TankType(TankParty.Enemy, TankTier.A, false)];
  script.positions = [spawnPosition];

  let spawnRequests = 0;
  eventBus.enemySpawnRequested.addListener(() => {
    spawnRequests += 1;
  });

  t.false(script.requestSpawn());
  t.is(spawnRequests, 0);
  t.is(script.listIndex, 0);
  t.is(script.positionIndex, 0);

  player.position.set(128, 128);
  player.updateMatrix();

  t.true(script.requestSpawn());
  t.is(spawnRequests, 1);
  t.is(script.listIndex, 1);
});

test('authoritative enemy spawn waits while another enemy occupies its spawn point', (t) => {
  const world = new LevelWorld(new GameObject(), 400, 400);
  const eventBus = new LevelEventBus();
  const enemyScript = new LevelEnemyScript(false);
  enemyScript.invokeInit(world, eventBus, new Session(), new MapConfig());

  const spawnPosition = new Vector(32, 32);
  const occupyingEnemy = new GameObject(64, 64);
  occupyingEnemy.position.copyFrom(spawnPosition);
  occupyingEnemy.updateMatrix();

  const script = enemyScript as any;
  script.aliveTanks = [occupyingEnemy];
  script.list = [new TankType(TankParty.Enemy, TankTier.A, false)];
  script.positions = [spawnPosition];

  t.false(script.requestSpawn());
  t.is(script.listIndex, 0);
  t.is(script.positionIndex, 0);
});
