const assert = require('assert');
const { performance } = require('perf_hooks');

const { EngineBattleCitySimulation } = require(
  '../dist-broadcaster/scripts/engine-battle-city-simulation.js',
);

function createMap(overrides = {}) {
  return {
    version: 2,
    field: { widthTiles: 13, heightTiles: 13 },
    base: { x: 352, y: 736 },
    spawn: {
      player: {
        locations: [
          { x: 64, y: 256 },
          { x: 704, y: 704 },
        ],
      },
      enemy: {
        locations: [
          { x: 64, y: 64 },
          { x: 384, y: 0 },
          { x: 704, y: 0 },
        ],
        list: [{ tier: 'a' }],
      },
    },
    terrain: { regions: [] },
    ...overrides,
  };
}

function input(
  player,
  seq,
  direction,
  moving,
  fire = false,
  powerSlot = null,
) {
  return {
    type: 'webrtc-input',
    player,
    seq,
    tick: seq,
    direction,
    moving,
    fire,
    powerSlot,
    elapsedSeconds: seq / 60,
  };
}

function overlaps(left, right) {
  return left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y;
}

{
  const simulation = new EngineBattleCitySimulation(createMap(), {
    seed: 11,
    disableEnemyShooting: true,
  });
  let frame;
  for (let tick = 0; tick < 300; tick += 1) {
    frame = simulation.step();
    if (frame.players.length === 2 && frame.enemies.length === 1) break;
  }
  assert.strictEqual(frame.players.length, 2, 'players must complete browser spawn animation');
  assert.strictEqual(frame.enemies.length, 1, 'enemy must complete browser spawn animation');
  simulation.acceptInput(input(0, 1, 0, false, true));

  for (let tick = 0; tick < 120; tick += 1) {
    frame = simulation.step();
    if (frame.playerScores[0] === 100) break;
  }
  assert.deepStrictEqual(
    frame.activeEnemyIds,
    [],
    'a player bullet must naturally destroy and remove an enemy',
  );
  assert.strictEqual(
    frame.enemyDeaths.length,
    1,
    'an enemy kill must emit an explicit client removal event',
  );
  assert.strictEqual(
    frame.enemyDeaths[0].partyIndex,
    0,
    'the removal event must identify the killed enemy',
  );
  assert.strictEqual(
    simulation.step().enemyDeaths.length,
    0,
    'an enemy removal event must only be emitted once',
  );
  assert.strictEqual(
    frame.playerScores[0],
    100,
    'the authoritative runtime must award the firing player',
  );
  assert.strictEqual(
    simulation.isComplete(),
    false,
    'victory must wait for the browser post-win lifecycle',
  );
  for (let tick = 0; tick < 160; tick += 1) {
    simulation.step();
    assert.strictEqual(
      simulation.isComplete(),
      false,
      'victory must not complete before the browser win timer',
    );
  }
  assert.strictEqual(
    simulation.getEnemyExplosionCount(),
    1,
    'enemy death must complete the shared kill-explosion animation',
  );
  for (let tick = 0; tick < 40 && !simulation.isComplete(); tick += 1) {
    simulation.step();
  }
  assert.strictEqual(
    simulation.isComplete(),
    true,
    'victory must complete after the shared browser win timer',
  );
}

{
  const simulation = new EngineBattleCitySimulation(
    createMap({
      spawn: {
        player: {
          locations: [
            { x: 64, y: 704 },
            { x: 704, y: 704 },
          ],
        },
        enemy: {
          locations: [{ x: 704, y: 0 }],
          list: [{ tier: 'a' }],
        },
      },
    }),
    { seed: 20, disableEnemyShooting: true },
  );
  let frame;
  for (let tick = 0; tick < 300; tick += 1) {
    frame = simulation.step();
    if (frame.players.length === 2) break;
  }
  simulation.acceptInput(input(0, 1, null, false, true));
  frame = simulation.step();
  assert.strictEqual(
    frame.players.find((player) => player.partyIndex === 0).fireSeq,
    1,
    'the first player tank must replicate fire',
  );

  const firstTank = simulation.world.getPlayerTanks()[0];
  firstTank.die();
  let respawnedTank = null;
  for (let tick = 0; tick < 360; tick += 1) {
    frame = simulation.step();
    respawnedTank = simulation.world.getPlayerTanks()[0];
    if (respawnedTank !== null && respawnedTank !== firstTank) break;
  }
  assert.ok(respawnedTank, 'player one must respawn for fire replication test');
  assert.strictEqual(
    frame.players.find((player) => player.partyIndex === 0).initialSync,
    true,
    'a respawn must emit a new player-generation sync frame',
  );
  simulation.acceptInput(input(0, 2, null, false, true));
  frame = simulation.step();
  assert.strictEqual(
    frame.players.find((player) => player.partyIndex === 0).fireSeq,
    2,
    'a respawned player tank must attach a fresh fire listener',
  );
}

{
  const simulation = new EngineBattleCitySimulation(createMap(), {
    seed: 21,
    disableEnemyShooting: true,
    playerRunConsumables: [
      { powerups: ['shield'], powerupCounts: [1] },
      { powerups: [], powerupCounts: [] },
    ],
  });
  let frame;
  for (let tick = 0; tick < 300; tick += 1) {
    frame = simulation.step();
    if (frame.players.length === 2) break;
  }
  assert.strictEqual(
    simulation.acceptInput(input(0, 1, null, false, false, 0)),
    true,
    'a valid hotbar command must be accepted',
  );
  frame = simulation.step();
  assert.strictEqual(frame.powerupPickup.partyIndex, 0);
  assert.strictEqual(frame.powerupPickup.type, 'shield');
  assert.strictEqual(frame.powerupPickup.hotbarSlot, 0);
  const pickupSeq = frame.powerupPickup.seq;
  simulation.acceptInput(input(0, 2, null, false, false, 0));
  frame = simulation.step();
  assert.strictEqual(
    frame.powerupPickup.seq,
    pickupSeq,
    'a consumed hotbar slot must not activate twice',
  );
  assert.strictEqual(
    simulation.acceptInput(input(0, 3, null, false, false, 4)),
    false,
    'an invalid hotbar slot must be rejected by the server',
  );
}

{
  const steel = { x: 64, y: 160, width: 64, height: 32 };
  const simulation = new EngineBattleCitySimulation(
    createMap({
      terrain: { regions: [{ type: 'steel', ...steel }] },
    }),
    { seed: 12, disableEnemyShooting: true },
  );

  let observedEnemy = false;
  for (let tick = 0; tick < 360; tick += 1) {
    const frame = simulation.step();
    frame.enemies.forEach((enemy) => {
      observedEnemy = true;
      assert.ok(
        !overlaps({ ...enemy, width: 64, height: 64 }, steel),
        'enemy tanks must never pass through steel',
      );
    });
  }
  assert.ok(observedEnemy, 'steel collision test must observe a spawned enemy');
}

{
  const simulation = new EngineBattleCitySimulation(
    createMap({
      spawn: {
        player: {
          locations: [
            { x: 384, y: 640 },
            { x: 704, y: 704 },
          ],
        },
        enemy: {
          locations: [{ x: 64, y: 64 }],
          list: [{ tier: 'a' }],
        },
      },
    }),
    { seed: 13, disableEnemyShooting: true },
  );
  simulation.acceptInput(input(0, 1, 180, true));
  let frame;
  for (let tick = 0; tick < 300; tick += 1) frame = simulation.step();
  assert.ok(
    frame.players[0].y <= 672,
    'base fortification and heart must block player movement',
  );
}

{
  const simulation = new EngineBattleCitySimulation(createMap(), {
    seed: 16,
    disableEnemyShooting: true,
    extraLives: 2,
    initialPlayerTiers: ['d', 'c'],
  });
  assert.deepStrictEqual(
    simulation.getLives(),
    [5, 5],
    'run extra lives must be applied through the shared session lifecycle',
  );
  let frame;
  for (let tick = 0; tick < 300; tick += 1) {
    frame = simulation.step();
    if (frame.players.length === 2) break;
  }
  assert.deepStrictEqual(
    frame.players.map((player) => player.tier),
    ['d', 'c'],
    'carried player tiers must be simulated and replicated',
  );
}

{
  const simulation = new EngineBattleCitySimulation(
    createMap({
      spawn: {
        player: {
          locations: [
            { x: 64, y: 256 },
            { x: 704, y: 704 },
          ],
        },
        enemy: {
          locations: [{ x: 64, y: 64 }],
          list: [{ tier: 'd', drop: true }],
        },
      },
      terrain: {
        regions: [
          { type: 'steel', x: 256, y: 256, width: 64, height: 64 },
          { type: 'water', x: 448, y: 448, width: 64, height: 64 },
        ],
      },
    }),
    { seed: 17, disableEnemyShooting: true },
  );
  let frame;
  for (let tick = 0; tick < 300; tick += 1) {
    frame = simulation.step();
    if (frame.players.length === 2 && frame.enemies.length === 1) break;
  }
  simulation.acceptInput(input(0, 1, 0, false, true));
  for (let tick = 0; tick < 120; tick += 1) {
    frame = simulation.step();
    if (frame.powerup !== null) break;
  }
  assert.notStrictEqual(
    frame.powerup,
    null,
    'a marked armored enemy must drop its powerup on the first hit',
  );
  [
    { x: 256, y: 256, width: 64, height: 64 },
    { x: 448, y: 448, width: 64, height: 64 },
    { x: 352, y: 736, width: 64, height: 64 },
    { x: 64, y: 256, width: 64, height: 64 },
    { x: 704, y: 704, width: 64, height: 64 },
    { x: 64, y: 64, width: 64, height: 64 },
  ].forEach((blocked) => {
    assert.ok(
      !overlaps({ ...frame.powerup, width: 64, height: 64 }, blocked),
      'powerup grid must reject terrain, base, and tank spawn regions',
    );
  });
  assert.strictEqual(
    frame.enemies.length,
    1,
    'tier-D enemy must survive the first hit that triggers its powerup',
  );
  const powerupId = frame.powerup.id;
  for (let tick = 0; tick < 1900; tick += 1) {
    frame = simulation.step();
    if (frame.powerup === null) break;
  }
  assert.strictEqual(
    frame.powerup,
    null,
    `powerup ${powerupId} must expire through the shared 30-second timer`,
  );
}

{
  const simulation = new EngineBattleCitySimulation(
    createMap({
      spawn: {
        player: {
          locations: [
            { x: 64, y: 256 },
            { x: 704, y: 704 },
          ],
        },
        enemy: {
          locations: [
            { x: 64, y: 64 },
            { x: 704, y: 64 },
          ],
          list: [
            { tier: 'd', drop: true },
            { tier: 'd', drop: true },
          ],
        },
      },
    }),
    { seed: 18, disableEnemyShooting: true },
  );
  let frame;
  for (let tick = 0; tick < 300; tick += 1) {
    frame = simulation.step();
    if (frame.players.length === 2 && frame.enemies.length === 1) break;
  }
  simulation.acceptInput(input(0, 1, 0, false, true));
  for (let tick = 0; tick < 120; tick += 1) {
    frame = simulation.step();
    if (frame.powerup !== null) break;
  }
  assert.notStrictEqual(
    frame.powerup,
    null,
    'first marked enemy must create a powerup before replacement is tested',
  );
  for (let tick = 0; tick < 300; tick += 1) {
    frame = simulation.step();
    if (frame.enemies.some((enemy) => enemy.partyIndex === 1)) break;
  }
  assert.ok(
    frame.enemies.some((enemy) => enemy.partyIndex === 1),
    'second marked enemy must complete its browser spawn animation',
  );
  assert.strictEqual(
    frame.powerup,
    null,
    'a newly spawned marked enemy must revoke the previous powerup',
  );
}

{
  const simulation = new EngineBattleCitySimulation(
    createMap({
      spawn: {
        player: {
          locations: [
            { x: 64, y: 256 },
            { x: 704, y: 256 },
          ],
        },
        enemy: {
          locations: [
            { x: 64, y: 64 },
            { x: 704, y: 64 },
          ],
          list: [{ tier: 'a' }, { tier: 'a' }],
        },
      },
    }),
    { seed: 19, disableEnemyShooting: true },
  );
  let frame;
  for (let tick = 0; tick < 300; tick += 1) {
    frame = simulation.step();
    if (frame.players.length === 2 && frame.enemies.length === 1) break;
  }
  simulation.acceptInput(input(0, 1, 0, false, true));
  for (let tick = 0; tick < 120; tick += 1) {
    frame = simulation.step();
    if (frame.playerScores[0] === 100) break;
  }
  for (let tick = 0; tick < 360; tick += 1) {
    frame = simulation.step();
    if (frame.enemies.some((enemy) => enemy.partyIndex === 1)) break;
  }
  simulation.acceptInput(input(1, 1, 0, false, true));
  for (let tick = 0; tick < 120; tick += 1) {
    frame = simulation.step();
    if (frame.playerScores[1] === 100) break;
  }
  assert.deepStrictEqual(
    frame.playerScores,
    [100, 100],
    'kills must be scored independently for both authoritative players',
  );
}

{
  const left = new EngineBattleCitySimulation(createMap(), {
    seed: 14,
    disableEnemyShooting: false,
  });
  const right = new EngineBattleCitySimulation(createMap(), {
    seed: 14,
    disableEnemyShooting: false,
  });
  for (let tick = 0; tick < 600; tick += 1) {
    const packet = input(0, tick + 1, [0, 90, 180, 270][Math.floor(tick / 60) % 4], true, tick % 47 === 0);
    left.acceptInput(packet);
    right.acceptInput(packet);
    assert.deepStrictEqual(left.step(), right.step());
  }
}

{
  const simulation = new EngineBattleCitySimulation(
    createMap({
      spawn: {
        player: { locations: [{ x: 64, y: 704 }, { x: 704, y: 704 }] },
        enemy: {
          locations: [{ x: 64, y: 0 }, { x: 384, y: 0 }, { x: 704, y: 0 }],
          list: Array.from({ length: 20 }, (_, index) => ({
            tier: index % 4 === 3 ? 'd' : 'a',
          })),
        },
      },
      terrain: {
        regions: [
          { type: 'brick', x: 128, y: 128, width: 576, height: 64 },
          { type: 'steel', x: 256, y: 320, width: 320, height: 64 },
          { type: 'water', x: 128, y: 512, width: 576, height: 64 },
        ],
      },
    }),
    { seed: 15, disableEnemyShooting: false },
  );
  const started = performance.now();
  for (let tick = 0; tick < 1200; tick += 1) simulation.step();
  const averageMs = (performance.now() - started) / 1200;
  assert.ok(
    averageMs < 8,
    `average simulation tick must stay below 8ms (measured ${averageMs.toFixed(2)}ms)`,
  );
  console.log(`engine-backed headless simulation: ok (${averageMs.toFixed(2)}ms average tick)`);
}
