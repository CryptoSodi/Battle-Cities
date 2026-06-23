/* eslint-disable */
// Iron Siege — enemy tanks, one file per asset type.
//
//   enemy-basic.png   default.a  (steel grey)
//   enemy-fast.png    default.b  (teal)
//   enemy-power.png   default.c  (crimson)
//   enemy-armor.png   default.d (silver) + primary.d (gold) + secondary.d (teal)
//                     — the tier-D armor tank and its damage-flash color states
//   enemy-danger.png  one shared warning-red set, mapped to danger.{a,b,c,d}
//
// Run from the repo root:  node tools/artgen/enemy-tanks.js

const L = require('./lib');

const W = 52;
const H = 60;
const DIRS = [
  { name: 'up', rot: 0 },
  { name: 'down', rot: 2 },
  { name: 'left', rot: 3 },
  { name: 'right', rot: 1 },
];

// Build the 8 frames (4 dirs x 2 tread frames) for one hull, mapping each to
// manifest keys via keyFn(dir, frame).
function frames(hull, keyFn) {
  const items = [];
  DIRS.forEach((d) => {
    for (let f = 0; f < 2; f += 1) {
      const base = L.buildTank(W, H, L.makePalette(hull), { treadPhase: f, emblem: false });
      items.push({ grid: L.rotateN(base, d.rot), keys: keyFn(d.name, f + 1) });
    }
  });
  return items;
}

L.emit('data/graphics/enemy-basic.png', frames('steel', (d, f) => [`tank.enemy.default.a.${d}.${f}`]));
L.emit('data/graphics/enemy-fast.png', frames('teal', (d, f) => [`tank.enemy.default.b.${d}.${f}`]));
L.emit('data/graphics/enemy-power.png', frames('crimson', (d, f) => [`tank.enemy.default.c.${d}.${f}`]));

L.emit('data/graphics/enemy-armor.png', [
  ...frames('silver', (d, f) => [`tank.enemy.default.d.${d}.${f}`]),
  ...frames('gold', (d, f) => [`tank.enemy.primary.d.${d}.${f}`]),
  ...frames('teal', (d, f) => [`tank.enemy.secondary.d.${d}.${f}`]),
]);

L.emit('data/graphics/enemy-danger.png', frames('danger', (d, f) => ['a', 'b', 'c', 'd'].map((t) => `tank.enemy.danger.${t}.${d}.${f}`)));

console.log('enemy tanks: emitted basic/fast/power/armor/danger');
