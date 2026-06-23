/* eslint-disable */
// Iron Siege — terrain, one file per tile type.
//   brick.png · steel.png · water.png (2 frames) · ice.png · jungle.png
// (menu/inverse/blue brick variants live in brick-variants.js.)
//
// Run from the repo root:  node tools/artgen/terrain.js

const L = require('./lib');

const BRICK_RED = { mortar: [40, 30, 24], d: [104, 46, 26], m: [150, 72, 40], hi: [206, 120, 70] };
// Darker palette for the base course at the bottom of a wall.
const BRICK_BASE = { mortar: [24, 18, 14], d: [62, 28, 16], m: [92, 46, 26], hi: [128, 76, 46] };

// Base brick: a darker brick with a grass skirt + a few blades poking up, so
// the bottom of a tall wall reads as planted in the ground (matches reference).
function buildBrickBase(variant) {
  const g = L.brickTile(BRICK_BASE, variant);
  const tuft = [36, 70, 30], lt = [86, 138, 62], tuftHi = [104, 156, 74];
  let s = ((variant + 7) * 1013904223) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let x = 0; x < 16; x += 1) {
    L.set(g, x, 15, tuft);
    if (rnd() < 0.6) L.set(g, x, 14, rnd() < 0.5 ? lt : tuftHi);
  }
  for (let i = 0; i < 5; i += 1) {
    const x = Math.floor(rnd() * 16);
    L.set(g, x, 13, lt); L.set(g, x, 12, tuftHi);
  }
  return g;
}

function buildSteel() {
  const g = L.newGrid(32, 32);
  const s0 = [23, 28, 33], s1 = [42, 50, 58], s2 = [63, 73, 84], s3 = [88, 100, 112], s4 = [126, 140, 154];
  L.rect(g, 0, 0, 31, 31, s2);
  L.rect(g, 0, 0, 31, 0, s4); L.rect(g, 0, 0, 0, 31, s4);
  L.rect(g, 0, 31, 31, 31, s0); L.rect(g, 31, 0, 31, 31, s0);
  L.rect(g, 1, 1, 30, 1, s3); L.rect(g, 1, 1, 1, 30, s3);
  L.rect(g, 1, 30, 30, 30, s1); L.rect(g, 30, 1, 30, 30, s1);
  L.rect(g, 15, 2, 15, 29, s1); L.rect(g, 16, 2, 16, 29, s4);
  L.rect(g, 2, 15, 29, 15, s1); L.rect(g, 2, 16, 29, 16, s4);
  const rivet = (cx, cy) => { L.rect(g, cx - 1, cy - 1, cx, cy, s4); L.set(g, cx + 1, cy + 1, s0); L.set(g, cx - 1, cy + 1, s1); L.set(g, cx + 1, cy - 1, s3); };
  rivet(5, 5); rivet(26, 5); rivet(5, 26); rivet(26, 26);
  [[8, 20], [9, 19], [10, 18], [22, 9], [23, 10]].forEach((p) => L.set(g, p[0], p[1], s4));
  return g;
}

const WATER_FRAMES = 8;

// One full ripple period scrolls across WATER_FRAMES, so the loop is seamless.
function buildWater(frame) {
  const g = L.newGrid(32, 32);
  const deep = [13, 42, 74], mid = [26, 74, 120], light = [47, 111, 174], foam = [127, 180, 224];
  L.rect(g, 0, 0, 31, 31, mid);
  for (let y = 0; y < 32; y += 1) {
    const band = (y + frame) % 8;
    if (band < 2) L.rect(g, 0, y, 31, y, deep);
    else if (band === 4) L.rect(g, 0, y, 31, y, light);
  }
  const sx = frame * 4;
  [[5, 4], [20, 8], [12, 17], [26, 22], [8, 27]].forEach((p) => L.set(g, (p[0] + sx) % 32, p[1], foam));
  return g;
}

function buildIce() {
  const g = L.newGrid(32, 32);
  const base = [183, 214, 230], hi = [226, 241, 250], lo = [150, 186, 208], crack = [120, 160, 188];
  L.rect(g, 0, 0, 31, 31, base);
  for (let i = 0; i < 9; i += 1) L.set(g, 6 + i, 11 + i, hi);
  for (let i = 0; i < 6; i += 1) L.set(g, 19 + i, 4 + i, hi);
  [[3, 20], [4, 21], [24, 25], [25, 26], [14, 14]].forEach((p) => L.set(g, p[0], p[1], lo));
  [[20, 6], [21, 7], [10, 24], [11, 25]].forEach((p) => L.set(g, p[0], p[1], crack));
  return g;
}

function buildJungle() {
  const g = L.newGrid(32, 32);
  const dk = [20, 46, 22], md = [34, 78, 36], lt = [64, 120, 52], hi = [110, 166, 74], shadow = [14, 32, 16];
  L.rect(g, 0, 0, 31, 31, md);
  const blob = (cx, cy, r) => {
    for (let y = cy - r; y <= cy + r; y += 1) {
      for (let x = cx - r; x <= cx + r; x += 1) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) { const li = dx + dy; L.set(g, (x + 32) % 32, (y + 32) % 32, li < -1 ? hi : li < 2 ? lt : dk); }
      }
    }
  };
  blob(8, 8, 5); blob(24, 10, 5); blob(14, 23, 6); blob(28, 27, 4); blob(3, 27, 4);
  [[16, 3], [2, 14], [31, 18], [18, 16]].forEach((p) => L.set(g, p[0], p[1], shadow));
  return g;
}

// ---- grass ground (32x32, seamless, subtle variation) ----------------------
const GRASS_VARIANTS = 4;
function buildGrass(variant) {
  const g = L.newGrid(32, 32);
  const base = [64, 112, 48], dk = [48, 88, 38], lt = [86, 138, 62], tuft = [36, 70, 30], tuftHi = [104, 156, 74];
  L.rect(g, 0, 0, 31, 31, base);
  let s = ((variant + 1) * 1013904223) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 44; i += 1) L.set(g, Math.floor(rnd() * 32), Math.floor(rnd() * 32), dk);
  for (let i = 0; i < 24; i += 1) L.set(g, Math.floor(rnd() * 32), Math.floor(rnd() * 32), lt);
  for (let i = 0; i < 6; i += 1) { const x = Math.floor(rnd() * 32), y = Math.floor(rnd() * 30); L.set(g, x, y, tuftHi); L.set(g, x, y + 1, tuft); }
  return g;
}

// Moss base: same darker brick, but with damp moss clumps instead of grass —
// used where a wall meets water.
function buildBrickBaseMoss(variant) {
  const g = L.brickTile(BRICK_BASE, variant);
  const mossDk = [30, 58, 38], moss = [52, 96, 56], mossHi = [92, 140, 84];
  let s = ((variant + 11) * 1013904223) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  // damp moss creeping up from the bottom, denser than the grass skirt
  for (let x = 0; x < 16; x += 1) {
    L.set(g, x, 15, moss);
    L.set(g, x, 14, rnd() < 0.7 ? moss : mossDk);
    if (rnd() < 0.5) L.set(g, x, 13, rnd() < 0.5 ? mossHi : moss);
  }
  for (let i = 0; i < 6; i += 1) {
    const x = Math.floor(rnd() * 16), y = 9 + Math.floor(rnd() * 3);
    L.set(g, x, y, mossDk); L.set(g, x, y + 1, moss);
  }
  return g;
}

const grassFrames = [];
for (let v = 0; v < GRASS_VARIANTS; v += 1) {
  grassFrames.push({ grid: buildGrass(v), keys: [`terrain.grass.${v + 1}`] });
}
L.emit('data/graphics/grass.png', grassFrames);

L.emit('data/graphics/brick.png', [
  { grid: L.brickTile(BRICK_RED, 0), keys: ['terrain.brick.1'] },
  { grid: L.brickTile(BRICK_RED, 1), keys: ['terrain.brick.2'] },
  { grid: buildBrickBase(0), keys: ['terrain.brick.base.1'] },
  { grid: buildBrickBase(1), keys: ['terrain.brick.base.2'] },
  { grid: buildBrickBaseMoss(0), keys: ['terrain.brick.moss.1'] },
  { grid: buildBrickBaseMoss(1), keys: ['terrain.brick.moss.2'] },
]);
L.emit('data/graphics/steel.png', [{ grid: buildSteel(), keys: ['terrain.steel'] }]);
const waterFrames = [];
for (let f = 0; f < WATER_FRAMES; f += 1) {
  waterFrames.push({ grid: buildWater(f), keys: [`terrain.water.${f + 1}`] });
}
L.emit('data/graphics/water.png', waterFrames);
L.emit('data/graphics/ice.png', [{ grid: buildIce(), keys: ['terrain.ice'] }]);
L.emit('data/graphics/jungle.png', [{ grid: buildJungle(), keys: ['terrain.jungle'] }]);

console.log('terrain: emitted brick/steel/water/ice/jungle');
