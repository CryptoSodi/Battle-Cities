const assert = require('assert');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const { BattleCitySimulation } = require(
  resolve(__dirname, '..', 'dist-broadcaster', 'shared', 'src', 'simulation.js'),
);

const map = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'data', 'maps', 'original', '01.json'), 'utf8'),
);

function createTestMap(overrides = {}) {
  return {
    version: 2,
    field: { widthTiles: 20, heightTiles: 13 },
    spawn: {
      player: {
        locations: [
          { x: 64, y: 704 },
          { x: 960, y: 704 },
        ],
      },
      enemy: { locations: [], list: [] },
    },
    terrain: { regions: [] },
    ...overrides,
  };
}

function input(seq, direction, moving, fire) {
  return {
    type: 'webrtc-input',
    player: 0,
    seq,
    tick: seq,
    direction,
    moving,
    fire,
    elapsedSeconds: seq / 60,
  };
}

function rectsOverlap(left, right) {
  return left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y;
}

function assertNoTankWallOverlap(simulation) {
  const tanks = [
    ...simulation.players,
    ...Array.from(simulation.enemies.values()),
  ].filter((tank) => tank.alive);
  const walls = [
    ...Array.from(simulation.movementTerrain.values()),
    simulation.getBaseHeartRect(),
  ];
  tanks.forEach((tank) => {
    walls.forEach((wall) => {
      assert.ok(
        !rectsOverlap(tank, wall),
        `tank ${tank.partyIndex} overlaps wall ${wall.key ?? 'base-heart'}`,
      );
    });
  });
}

{
  const simulation = new BattleCitySimulation(
    createTestMap({ spawn: { enemy: { locations: [], list: [] } } }),
    { seed: 1 },
  );
  const frame = simulation.step();
  assert.deepStrictEqual(
    frame.players.map(({ x, y }) => ({ x, y })),
    [
      { x: 480, y: 768 },
      { x: 736, y: 768 },
    ],
    'default player spawns must match the engine base-container offsets',
  );
}

{
  const simulation = new BattleCitySimulation(
    createTestMap({
      spawn: {
        player: {
          locations: [
            { x: 10, y: 100 },
            { x: 960, y: 704 },
          ],
        },
        enemy: { locations: [], list: [] },
      },
    }),
    { seed: 2 },
  );
  simulation.acceptInput(input(1, 90, true, true));
  const frame = simulation.step();
  const player = frame.players[0];
  const bullet = simulation.bullets[0];
  assert.deepStrictEqual(
    {
      x: player.x,
      y: player.y,
      rotation: player.rotation,
      fireX: player.fireX,
      fireY: player.fireY,
      fireRotation: player.fireRotation,
    },
    {
      x: 13,
      y: 96,
      rotation: 90,
      fireX: 10,
      fireY: 100,
      fireRotation: 0,
    },
    'players must fire before turning/moving and snap to the 32px movement grid',
  );
  assert.deepStrictEqual(
    {
      x: bullet.x,
      y: bullet.y,
      width: bullet.width,
      height: bullet.height,
      rotation: bullet.rotation,
    },
    { x: 36, y: 90, width: 12, height: 16, rotation: 0 },
    'bullet geometry and muzzle placement must match Tank.fire',
  );
}

{
  const simulation = new BattleCitySimulation(
    createTestMap({
      spawn: {
        player: {
          locations: [
            { x: 32, y: 96 },
            { x: 960, y: 704 },
          ],
        },
        enemy: { locations: [], list: [] },
      },
      terrain: {
        regions: [
          { type: 'brick', x: 160, y: 96, width: 32, height: 32 },
        ],
      },
    }),
    { seed: 3 },
  );
  simulation.acceptInput(input(1, 90, true, false));
  let frame;
  for (let tick = 0; tick < 24; tick += 1) frame = simulation.step();
  assert.strictEqual(
    frame.players[0].x,
    96,
    'movement must resolve to the wall contact edge instead of rejecting the whole tick',
  );
}

{
  const simulation = new BattleCitySimulation(
    createTestMap({
      spawn: {
        player: {
          locations: [
            { x: 64, y: 192 },
            { x: 960, y: 704 },
          ],
        },
        enemy: { locations: [], list: [] },
      },
      terrain: {
        regions: [
          { type: 'water', x: 64, y: 96, width: 64, height: 32 },
        ],
      },
    }),
    { seed: 4 },
  );
  simulation.acceptInput(input(1, null, false, true));
  for (let tick = 0; tick < 8; tick += 1) simulation.step();
  assert.strictEqual(simulation.bullets.length, 1, 'water must not stop bullets');
  assert.ok(simulation.bullets[0].y < 128, 'bullet must travel through water');
}

{
  const simulation = new BattleCitySimulation(
    createTestMap({
      terrain: {
        regions: [
          { type: 'brick', x: 160, y: 96, width: 32, height: 32 },
        ],
      },
    }),
    { seed: 5 },
  );
  const cells = Array.from(simulation.terrain.values());
  assert.strictEqual(cells.length, 4);
  assert.strictEqual(simulation.movementTerrain.size, 1);
  cells.slice(0, 3).forEach((cell) => simulation.destroyTerrainCell(cell));
  assert.strictEqual(
    simulation.movementTerrain.size,
    1,
    'a partially destroyed brick supertile must keep its movement collider',
  );
  simulation.destroyTerrainCell(cells[3]);
  assert.strictEqual(
    simulation.movementTerrain.size,
    0,
    'the movement collider must disappear after all four brick pieces are destroyed',
  );
}

{
  const simulation = new BattleCitySimulation(
    createTestMap({
      spawn: {
        player: {
          locations: [
            { x: 608, y: 672 },
            { x: 960, y: 704 },
          ],
        },
        enemy: { locations: [], list: [] },
      },
    }),
    { seed: 6 },
  );
  const player = simulation.players[0];
  simulation.applyPowerup(player, 'defence');
  simulation.acceptInput(input(1, 180, true, false));
  const frame = simulation.step();
  assert.strictEqual(
    frame.players[0].y,
    672,
    'base-defence walls must block authoritative tank movement',
  );
  assert.ok(
    Array.from(simulation.movementTerrain.values()).every(
      (wall) => !rectsOverlap(player, wall),
    ),
    'a tank must never remain inside a newly created base wall',
  );

  player.x = 608;
  player.y = 740;
  simulation.resolveTankWallOverlaps(player);
  assert.deepStrictEqual(
    { x: player.x, y: player.y },
    { x: 608, y: 672 },
    'fortification appearing around a tank must resolve it outside',
  );

  simulation.baseDefenceUntilTick = simulation.tick + 1;
  simulation.step();
  const baseWallCells = Array.from(simulation.terrain.values()).filter(
    (cell) => cell.y >= 736 && cell.x >= 576 && cell.x < 704,
  );
  assert.ok(baseWallCells.length > 0);
  assert.ok(
    baseWallCells.every((cell) => cell.type === 'brick'),
    'expired base defence must retain brick walls and their colliders',
  );
}

const left = new BattleCitySimulation(map, { seed: 12345 });
const right = new BattleCitySimulation(map, { seed: 12345 });

for (let tick = 0; tick < 900; tick += 1) {
  const player = tick % 2;
  const packet = {
    type: 'webrtc-input',
    player,
    seq: tick + 1,
    tick,
    direction: [0, 90, 180, 270][Math.floor(tick / 45) % 4],
    moving: true,
    fire: tick % 37 === 0,
    elapsedSeconds: tick / 60,
  };
  left.acceptInput(packet);
  right.acceptInput(packet);
  assert.deepStrictEqual(left.step(), right.step());
  assertNoTankWallOverlap(left);
  assertNoTankWallOverlap(right);
}

assert.deepStrictEqual(left.getScores(), right.getScores());
assert.strictEqual(left.tick, 900);
console.log('headless broadcaster simulation parity and determinism: ok');
