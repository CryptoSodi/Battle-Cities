/// <reference path="../types/Window.d.ts" />
import test from 'ava';

import { CollisionSystem, GameObject, Vector } from '../core';
import { GameUpdateArgs, Rotation, Tag } from '../game';
import { TankBulletWallDamage } from '../tank';
import { TerrainFactory, TerrainType } from '../terrain';

import { Bullet } from './Bullet';
import { BrickTerrainTile } from './terrain/BrickTerrainTile';

function makeUpdateArgs(collisionSystem: CollisionSystem): GameUpdateArgs {
  const stubSound = { play: () => undefined, stop: () => undefined };
  return {
    audioLoader: { load: () => stubSound } as any,
    collisionSystem,
    deltaTime: 1 / 60,
    hitStop: () => undefined,
    particles: { spawn: () => undefined, flash: () => undefined } as any,
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

// Fires a real Bullet at a real brick pillar and returns the field-local
// origin (min.x, min.y) of every sub-brick actually destroyed, in the order
// destruction happened. Destroyed tiles are spliced out of the scene tree
// entirely, so this hooks each tile's own `destroyed` signal up front rather
// than polling `isRemoved` afterward (which would never see them).
function fireAndCollectDestroyed(
  regions: { x: number; y: number; width: number; height: number }[],
  bulletCenter: Vector,
  rotation: Rotation,
  prepare: (field: GameObject) => void = () => undefined,
): string[] {
  const collisionSystem = new CollisionSystem();
  const updateArgs = makeUpdateArgs(collisionSystem);

  const field = new GameObject(400, 400);
  field.updateMatrix(true);

  const tiles = TerrainFactory.createMapFromRegionConfigs(
    regions.map((region) => ({ type: TerrainType.Brick, ...region })),
    400,
    400,
  );
  field.add(...tiles);

  // BrickSuperTerrainTile only adds its sub-bricks as children on its own
  // first invokeUpdate() (lazy setup()) -- prime that once, with no bullet
  // present yet, before hooking the destroyed signal on the sub-tiles.
  step(field, collisionSystem, updateArgs);

  // Lets a test pre-damage the wall (e.g. carve a crater from an earlier hit)
  // after the sub-bricks exist but before the destroyed listeners are hooked,
  // so the preparation damage doesn't pollute the collected results.
  prepare(field);

  const destroyed: string[] = [];
  field.traverse((node) => {
    if (node instanceof BrickTerrainTile) {
      const box = node.getWorldBoundingBox();
      const label = `${box.min.x.toFixed(0)},${box.min.y.toFixed(0)}`;
      node.destroyed.addListener(() => destroyed.push(label));
    }
  });

  const bullet = new Bullet(0, 200, 1, TankBulletWallDamage.Low);
  bullet.tags.push(Tag.Player);
  bullet.rotation = rotation;
  bullet.updateMatrix();
  bullet.setCenter(bulletCenter);
  bullet.updateMatrix();
  field.add(bullet);

  let hitFrame = -1;
  for (let i = 0; i < 200; i += 1) {
    step(field, collisionSystem, updateArgs);
    if (bullet.isSpent() && hitFrame === -1) {
      hitFrame = i;
    }
    if (hitFrame !== -1 && i >= hitFrame + 5) {
      break;
    }
  }

  return destroyed;
}

// Reproduces the screenshot: two SEPARATE, narrow pillars (like base-flanking
// walls) with a gap between them. A bullet aimed squarely at the left pillar,
// right at its edge closest to the gap -- the worst case -- must only ever
// destroy bricks belonging to the left pillar. The destroyer's perpendicular-
// axis footprint (TILE_SIZE_LARGE, matching tank width) is wider than the
// gap, so without a contiguity check it can reach into the unrelated right
// pillar just because both pillars' front faces happen to be equally close.
test('a shot on one of two nearby separate pillars does not clip bricks in the other pillar', (t) => {
  const destroyed = fireAndCollectDestroyed(
    [
      { x: 96, y: 0, width: 32, height: 96 }, // left pillar: x 96-128
      { x: 144, y: 0, width: 32, height: 96 }, // right pillar: x 144-176 (16px gap)
    ],
    new Vector(127, -20),
    Rotation.Down,
  );

  t.true(destroyed.length > 0, 'nothing was destroyed at all');
  destroyed.forEach((label) => {
    const x = Number(label.split(',')[0]);
    t.true(x < 128, `destroyed brick at (${label}) belongs to the separate right pillar, not the one hit`);
  });
});

// Reproduces the "brick behind the front wall also gets destroyed" report:
// one 64px-wide wall, two brick rows deep (y 0-32). The front row of the LEFT
// half (x 96-128) was already destroyed by an earlier hit, leaving a crater.
// A bullet fired down into the crater hits the left half's SECOND row -- so
// the destroyer's tank-width band sits at that depth, where it also overlaps
// the right half's second-row bricks... which are still COVERED by the right
// half's intact front row. Those covered bricks must survive: the blast can't
// reach through an intact wall surface.
test('a shot into a crater does not destroy bricks covered by an intact front row', (t) => {
  const destroyed = fireAndCollectDestroyed(
    [{ x: 96, y: 0, width: 64, height: 32 }], // wall: x 96-160, rows y 0-16, 16-32
    new Vector(104, -20), // inside the crater column (x 96-112)
    Rotation.Down,
    (field) => {
      // Carve the crater: remove the front-row sub-bricks of the left half.
      // Collect first -- destroy() splices nodes out of the tree, and mutating
      // children mid-traversal makes traverse() skip siblings.
      const craterBricks: BrickTerrainTile[] = [];
      field.traverse((node) => {
        if (node instanceof BrickTerrainTile) {
          const box = node.getWorldBoundingBox();
          if (box.min.y === 0 && box.min.x >= 96 && box.min.x < 128) {
            craterBricks.push(node);
          }
        }
      });
      craterBricks.forEach((brick) => brick.destroy());
    },
  );

  t.true(destroyed.length > 0, 'nothing was destroyed at all');
  t.true(
    destroyed.includes('96,16'),
    'the recessed brick actually hit was not destroyed',
  );
  destroyed.forEach((label) => {
    const x = Number(label.split(',')[0]);
    t.true(
      x < 128,
      `destroyed brick at (${label}) was covered by the intact front row of the right half`,
    );
  });
});

// A single contiguous, thick-enough wall should still lose its full front-
// facing width in one hit (the tank-width-clearing mechanic this project
// deliberately kept) -- the contiguity fix must not shrink that back down.
test('a single contiguous wall still loses its full front-facing width in one hit', (t) => {
  const destroyed = fireAndCollectDestroyed(
    [{ x: 96, y: 0, width: 64, height: 96 }], // one wide, unbroken wall
    new Vector(127, -20),
    Rotation.Down,
  );

  t.is(destroyed.length, 4, 'expected all four sub-bricks across the front row to be destroyed');
});
