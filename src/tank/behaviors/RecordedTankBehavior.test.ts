/// <reference path="../../types/Window.d.ts" />
import test from 'ava';

import { CollisionSystem, GameObject, State } from '../../core';
import { GameState, GameUpdateArgs, Rotation } from '../../game';
import { EnemyMovementFrame } from '../../replay';
import { TankFactory, TankType } from '..';

import { RecordedTankBehavior } from './RecordedTankBehavior';

function makeUpdateArgs(collisionSystem: CollisionSystem): GameUpdateArgs {
  const stubSound = { play: () => undefined, stop: () => undefined };
  return {
    audioLoader: { load: () => stubSound } as any,
    collisionSystem,
    deltaTime: 1 / 60,
    gameState: new State<GameState>(GameState.Playing),
    hitStop: () => undefined,
    particles: { spawn: () => undefined, flash: () => undefined } as any,
    spriteLoader: { load: () => null, loadList: () => [] } as any,
  } as unknown as GameUpdateArgs;
}

// A real EnemyTank, driven by the real RecordedTankBehavior, against a hand-
// authored trace -- proves the ghost tank lands on the exact recorded
// position/rotation every tick, and fires exactly on the recorded ticks.
test('RecordedTankBehavior re-enacts a recorded trace exactly', (t) => {
  const collisionSystem = new CollisionSystem();
  const updateArgs = makeUpdateArgs(collisionSystem);

  const trace: EnemyMovementFrame[] = [
    { x: 100, y: 100, rotation: Rotation.Right, fired: false },
    { x: 116, y: 100, rotation: Rotation.Right, fired: true },
    { x: 132, y: 100, rotation: Rotation.Right, fired: false },
    { x: 132, y: 116, rotation: Rotation.Down, fired: false },
  ];

  const field = new GameObject(400, 400);
  field.updateMatrix(true);

  const behavior = new RecordedTankBehavior(trace);
  const tank = TankFactory.createEnemy(0, TankType.EnemyA(), behavior);
  tank.updateMatrix();
  field.add(tank);

  const observed: { x: number; y: number; rotation: number; bulletCount: number }[] = [];
  for (let i = 0; i < trace.length; i += 1) {
    tank.invokeUpdate(updateArgs);
    observed.push({
      x: tank.position.x,
      y: tank.position.y,
      rotation: tank.rotation,
      bulletCount: tank.bullets.length,
    });
  }

  trace.forEach((frame, index) => {
    t.is(observed[index].x, frame.x, `tick ${index} x`);
    t.is(observed[index].y, frame.y, `tick ${index} y`);
    t.is(observed[index].rotation, frame.rotation, `tick ${index} rotation`);
  });

  // Fired exactly on tick 1 -- one bullet should exist from that point on.
  t.is(observed[0].bulletCount, 0);
  t.is(observed[1].bulletCount, 1);
  t.is(observed[3].bulletCount, 1);

  // Running past the end of the trace is a safe no-op, not a crash.
  t.notThrows(() => tank.invokeUpdate(updateArgs));
});
