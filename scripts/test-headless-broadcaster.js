const assert = require('assert');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const { BattleCitySimulation } = require(
  resolve(__dirname, '..', 'dist-broadcaster', 'shared', 'src', 'simulation.js'),
);

const map = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'data', 'maps', 'original', '01.json'), 'utf8'),
);

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
}

assert.deepStrictEqual(left.getScores(), right.getScores());
assert.strictEqual(left.tick, 900);
console.log('headless broadcaster simulation determinism: ok');
