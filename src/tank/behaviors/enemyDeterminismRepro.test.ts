/// <reference path="../../types/Window.d.ts" />
import test from 'ava';

import { CollisionSystem, GameObject, Prng, State, Vector } from '../../core';
import { GameUpdateArgs, GameState, Rotation, Tag } from '../../game';
import { TerrainFactory, TerrainType } from '../../terrain';
import { TankFactory, TankType } from '..';

function makeUpdateArgs(
  collisionSystem: CollisionSystem,
  rng: Prng,
): GameUpdateArgs {
  const stubSound = { play: () => undefined, stop: () => undefined };
  return {
    audioLoader: { load: () => stubSound } as any,
    collisionSystem,
    deltaTime: 1 / 60,
    gameState: new State<GameState>(GameState.Playing),
    hitStop: () => undefined,
    particles: { spawn: () => undefined, flash: () => undefined } as any,
    rng,
    spriteLoader: { load: () => null, loadList: () => [] } as any,
  } as unknown as GameUpdateArgs;
}

function step(field: GameObject, collisionSystem: CollisionSystem, updateArgs: GameUpdateArgs): void {
  field.traverseDescedants((node) => {
    node.invokeUpdate(updateArgs);
  });
  field.updateWorldMatrix(false, true);
  collisionSystem.update();
  collisionSystem.collide();
}

interface TankSnapshot {
  x: number;
  y: number;
  rotation: number;
}

// Runs two real AiTankBehavior-driven EnemyTanks (the exact production class,
// not a stand-in) inside a bounded steel arena for a fixed number of ticks,
// and returns a per-tick position/rotation trace for both. Used to check
// whether enemy AI, given a fixed seed and no player interference, is
// reproducible run-to-run -- isolating the AI/collision layer from anything
// replay- or input-specific.
function runScenario(seed, ticks) {
  const collisionSystem = new CollisionSystem();
  const rng = new Prng(seed);
  const updateArgs = makeUpdateArgs(collisionSystem, rng);

  const field = new GameObject(400, 400);
  field.updateMatrix(true);

  // Bounded steel arena so tanks actually collide/get "stuck" and exercise
  // AiTankBehavior's Thinking/rotation logic, not just free movement.
  const walls = TerrainFactory.createMapFromRegionConfigs(
    [
      { type: TerrainType.Steel, x: 0, y: 0, width: 320, height: 32 },
      { type: TerrainType.Steel, x: 0, y: 288, width: 320, height: 32 },
      { type: TerrainType.Steel, x: 0, y: 0, width: 32, height: 320 },
      { type: TerrainType.Steel, x: 288, y: 0, width: 32, height: 320 },
    ],
    400,
    400,
  );
  field.add(...walls);

  const tankA = TankFactory.createEnemy(0, TankType.EnemyA());
  tankA.tags.push(Tag.Tank, Tag.Enemy);
  tankA.updateMatrix();
  tankA.setCenter(new Vector(96, 96));
  tankA.rotate(Rotation.Right);
  tankA.updateMatrix();
  field.add(tankA);

  const tankB = TankFactory.createEnemy(1, TankType.EnemyA());
  tankB.tags.push(Tag.Tank, Tag.Enemy);
  tankB.updateMatrix();
  tankB.setCenter(new Vector(224, 224));
  tankB.rotate(Rotation.Left);
  tankB.updateMatrix();
  field.add(tankB);

  const traceA: TankSnapshot[] = [];
  const traceB: TankSnapshot[] = [];

  for (let i = 0; i < ticks; i += 1) {
    step(field, collisionSystem, updateArgs);
    traceA.push({ x: tankA.position.x, y: tankA.position.y, rotation: tankA.rotation });
    traceB.push({ x: tankB.position.x, y: tankB.position.y, rotation: tankB.rotation });
  }

  return { traceA, traceB };
}

test('two real AiTankBehavior enemies produce an identical trace across two runs with the same seed', (t) => {
  const seed = 424242;
  const ticks = 600; // 10 sim-seconds at 60 ticks/sec

  const run1 = runScenario(seed, ticks);
  const run2 = runScenario(seed, ticks);

  t.deepEqual(run2.traceA, run1.traceA, 'tank A diverged between two runs with the same seed');
  t.deepEqual(run2.traceB, run1.traceB, 'tank B diverged between two runs with the same seed');

  // Sanity: the scenario actually exercised movement and turning, so the
  // deepEqual above is proving something (not just "two empty arrays match").
  const rotationsSeenA = new Set(run1.traceA.map((s) => s.rotation));
  t.true(rotationsSeenA.size > 1, 'tank A never changed rotation -- scenario too inert to prove anything');
});
