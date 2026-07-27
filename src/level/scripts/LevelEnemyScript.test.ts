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

test('network spawn completion is handled before the enemy script first updates', (t) => {
  const world = new LevelWorld(new GameObject(), 400, 400);
  const eventBus = new LevelEventBus();
  const session = new Session();
  const mapConfig = new MapConfig();

  const enemyScript = new LevelEnemyScript();
  enemyScript.invokeInit(world, eventBus, session, mapConfig);

  let receivedPartyIndex: number = null;
  enemyScript.tankCreated.addListener((tank) => {
    receivedPartyIndex = tank.partyIndex;
    // The tank must already be in getAliveTanks() at this point too.
    t.true(enemyScript.getAliveTanks().includes(tank));
  });

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

test('network replay creates an enemy without waiting for a spawn animation', (t) => {
  const world = new LevelWorld(new GameObject(), 400, 400);
  const eventBus = new LevelEventBus();
  const enemyScript = new LevelEnemyScript(true);
  enemyScript.invokeInit(world, eventBus, new Session(), new MapConfig());
  (enemyScript as any).list = [
    new TankType(TankParty.Enemy, TankTier.A, false),
  ];

  enemyScript.syncNetworkReplayEnemies([
    {
      partyIndex: 0,
      x: 96,
      y: 64,
      deltaX: 2,
      deltaY: 0,
    },
  ]);

  const tank = enemyScript.getAliveTanks()[0];
  t.is(tank.partyIndex, 0);
  t.is(tank.position.x, 94);
  t.is(tank.position.y, 64);
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
