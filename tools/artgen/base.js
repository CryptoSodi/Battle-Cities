/* eslint-disable */
// Iron Siege — base / eagle emblem (restyle in place, 64x64).
//
// base.heart.alive — intact gold heraldic eagle on a dark plate.
// base.heart.dead  — same silhouette shattered: greyed, cracked, scorched.
//
// Run from the repo root:  node tools/artgen/base.js

const path = require('path');
const L = require('./lib');

const N = 64;

const ell = (g, cx, cy, rx, ry, c) => {
  for (let y = cy - ry; y <= cy + ry; y += 1) for (let x = cx - rx; x <= cx + rx; x += 1) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1) L.set(g, x, y, c);
  }
};
const sgn = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
const tri = (g, ax, ay, bx, by, cx, cy, c) => {
  const minx = Math.min(ax, bx, cx), maxx = Math.max(ax, bx, cx), miny = Math.min(ay, by, cy), maxy = Math.max(ay, by, cy);
  for (let y = miny; y <= maxy; y += 1) for (let x = minx; x <= maxx; x += 1) {
    const d1 = sgn(x, y, ax, ay, bx, by), d2 = sgn(x, y, bx, by, cx, cy), d3 = sgn(x, y, cx, cy, ax, ay);
    if (!(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0)))) L.set(g, x, y, c);
  }
};
const line = (g, x0, y0, x1, y1, c) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i += 1) L.set(g, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
};
const sym = (fn) => { fn(false); fn(true); }; // draw, then mirror across x

function plate(g, broken) {
  const d0 = [14, 16, 20], d1 = [28, 32, 39], d2 = [44, 50, 60];
  const rim = broken ? [120, 60, 50] : [201, 160, 62];
  const rimHi = broken ? [170, 90, 76] : [238, 204, 112];
  L.rect(g, 2, 2, N - 3, N - 3, d1);
  L.rect(g, 2, 2, N - 3, 2, d2); L.rect(g, 2, 2, 2, N - 3, d2);
  L.rect(g, 2, N - 3, N - 3, N - 3, d0); L.rect(g, N - 3, 2, N - 3, N - 3, d0);
  L.rect(g, 5, 5, N - 6, 5, rim); L.rect(g, 5, N - 6, N - 6, N - 6, rim);
  L.rect(g, 5, 5, 5, N - 6, rim); L.rect(g, N - 6, 5, N - 6, N - 6, rim);
  L.set(g, 5, 5, rimHi);
  L.rect(g, 8, 8, N - 9, N - 9, d0);
}

function buildEagle(broken) {
  const g = L.newGrid(N, N);
  plate(g, broken);
  const r = broken
    ? { d: [60, 64, 72], m: [98, 104, 114], l: [142, 150, 160] }
    : { d: [150, 108, 30], m: [206, 160, 58], l: [244, 208, 112] };

  // wings (mirrored): shoulder -> upper tip -> lower trailing edge
  sym((m) => { const f = (x) => (m ? N - 1 - x : x); tri(g, f(30), 24, f(9), 16, f(18), 42, r.m); });
  sym((m) => { const f = (x) => (m ? N - 1 - x : x); tri(g, f(30), 30, f(13), 30, f(22), 46, r.d); }); // wing underside shade
  // body
  ell(g, 32, 36, 6, 13, r.m);
  ell(g, 30, 32, 4, 9, r.l); // body highlight (upper-left)
  // head + beak
  ell(g, 32, 16, 5, 5, r.l);
  tri(g, 29, 13, 35, 13, 32, 6, r.d);
  // tail fan
  tri(g, 26, 45, 38, 45, 32, 57, r.m);
  // wing top edge highlight
  sym((m) => { const f = (x) => (m ? N - 1 - x : x); line(g, f(29), 25, f(11), 17, r.l); });
  // eyes
  L.set(g, 30, 15, [20, 16, 10]); L.set(g, 34, 15, [20, 16, 10]);

  if (broken) {
    const crack = [180, 50, 40], scorch = [24, 16, 14];
    line(g, 22, 18, 40, 40, crack); line(g, 38, 20, 26, 44, crack); line(g, 30, 30, 30, 56, crack);
    [[44, 24], [45, 25], [18, 38], [19, 39], [40, 46], [24, 22]].forEach((p) => L.set(g, p[0], p[1], scorch));
    // blown-out chunk (upper-right wing) -> show plate through
    for (let y = 16; y < 28; y += 1) for (let x = 42; x < 54; x += 1) if ((x - 48) * (x - 48) + (y - 20) * (y - 20) < 36) L.set(g, x, y, null);
  }
  return g;
}

const n = L.emit('data/graphics/base.png', [
  { grid: buildEagle(false), keys: ['base.heart.alive'] },
  { grid: buildEagle(true), keys: ['base.heart.dead'] },
]);
console.log(`base: ${n} entries @ ${L.ART_SCALE}x`);
