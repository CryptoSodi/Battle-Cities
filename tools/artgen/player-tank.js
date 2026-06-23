/* eslint-disable */
// Iron Siege — player tank (all power-up tiers, both players).
// P1 = primary (gold), P2 = secondary (green); star powerup upgrades a -> d:
//   a basic (52x52) · b longer gun (52x64) · c twin cannon (52x60) · d armored (56x60)
// Authored at lib.ART_SCALE x for HD; emitted one file at the correct footprint.
//
// Run from the repo root:  node tools/artgen/player-tank.js

const L = require('./lib');

const VARIANTS = [
  { color: 'primary', hull: 'gold' },
  { color: 'secondary', hull: 'green' },
];
const TIERS = [
  { tier: 'a', w: 52, h: 52, opts: { barrels: 1 } },
  { tier: 'b', w: 52, h: 64, opts: { barrels: 1 } },
  { tier: 'c', w: 52, h: 60, opts: { barrels: 2 } },
  { tier: 'd', w: 56, h: 60, opts: { barrels: 2, armor: true, turretR: 9 } },
];
const DIRS = [
  { name: 'up', rot: 0 },
  { name: 'down', rot: 2 },
  { name: 'left', rot: 3 },
  { name: 'right', rot: 1 },
];

const items = [];
VARIANTS.forEach((v) => {
  const pal = L.makePalette(v.hull);
  TIERS.forEach((t) => {
    DIRS.forEach((d) => {
      for (let f = 0; f < 2; f += 1) {
        const base = L.buildTank(t.w, t.h, pal, Object.assign({ treadPhase: f, emblem: true }, t.opts));
        items.push({
          grid: L.rotateN(base, d.rot),
          keys: [`tank.player.${v.color}.${t.tier}.${d.name}.${f + 1}`],
        });
      }
    });
  });
});

const n = L.emit('data/graphics/player-tank.png', items);
console.log(`player tank: ${n} entries @ ${L.ART_SCALE}x`);
