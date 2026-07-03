/* eslint-disable */
// Iron Siege — combat VFX, one file per asset type.
//   bullets.png · explosion.png (small+large frames) · shield.png · spawn.png
//
// Run from the repo root:  node tools/artgen/effects.js

const L = require('./lib');

const line = (g, x0, y0, x1, y1, c) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i += 1) L.set(g, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
};
const diamond = (g, cx, cy, r, c) => {
  for (let y = cy - r; y <= cy + r; y += 1) for (let x = cx - r; x <= cx + r; x += 1) if (Math.abs(x - cx) + Math.abs(y - cy) <= r) L.set(g, x, y, c);
};
const ringBand = (g, cx, cy, rO, rI, c) => {
  for (let y = cy - rO; y <= cy + rO; y += 1) for (let x = cx - rO; x <= cx + rO; x += 1) { const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy); if (d <= rO && d >= rI) L.set(g, x, y, c); }
};

const WHITE = [255, 250, 232], YELLOW = [255, 212, 96], ORANGE = [242, 140, 42], RED = [198, 58, 30], SMOKE = [74, 68, 62];
const OUTLINE = [22, 15, 12], CHAR = [42, 35, 31], SPARK_HOT = [255, 236, 150], SPARK_WARM = [232, 96, 32], SPARK_EDGE = [120, 30, 14];

// Small deterministic PRNG so re-running the generator reproduces pixel-
// identical output (no external randomness needed at build time).
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function darken(c, f) {
  return [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f)];
}

// 1D value noise around the circle (random height at N control points,
// smoothstep-interpolated between them) -> an irregular, non-repeating radius
// multiplier per angle. A sum-of-sines wobble inherently superposes into
// evenly-spaced lobes (reads as a star/flower); random control points don't
// have that periodicity, so bumps vary in width and spacing like a real torn
// blast edge. A second, higher-frequency pass adds fine jitter on top so the
// edge isn't perfectly smooth between control points either. Each band gets
// its own instance so ring boundaries don't nest into identical shapes.
function jaggedRadiusFn(rng, jag) {
  const n = 9 + Math.floor(rng() * 5);
  const heights = new Array(n);
  for (let i = 0; i < n; i += 1) heights[i] = 1 + (rng() * 2 - 1) * 0.26 * jag;

  const fineN = 23 + Math.floor(rng() * 7);
  const fine = new Array(fineN);
  for (let i = 0; i < fineN; i += 1) fine[i] = (rng() * 2 - 1) * 0.05 * jag;

  const sampleRing = (arr, count, ang) => {
    const a = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const t = (a / (Math.PI * 2)) * count;
    const i0 = Math.floor(t) % count;
    const i1 = (i0 + 1) % count;
    const f = t - Math.floor(t);
    const s = f * f * (3 - 2 * f);
    return arr[i0] * (1 - s) + arr[i1] * s;
  };

  return (ang) => sampleRing(heights, n, ang) + sampleRing(fine, fineN, ang);
}

// 1px near-black rim on every silhouette boundary pixel, per the material
// bible's outline convention -- without it the shape reads as a flat sticker
// rather than a lit, readable blast.
function outlineEdges(g, color) {
  const edges = [];
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      if (!g.data[y * g.w + x]) continue;
      const isEdge =
        x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1 ||
        !g.data[y * g.w + (x - 1)] || !g.data[y * g.w + (x + 1)] ||
        !g.data[(y - 1) * g.w + x] || !g.data[(y + 1) * g.w + x];
      if (isEdge) edges.push(x + y * g.w);
    }
  }
  edges.forEach((i) => { g.data[i] = color; });
}

// Discrete spark/ember debris flung outward at random angles: a dark-edged,
// saturated orange-red streak burning to a bright hot tip, 2px thick near the
// base so it reads as a solid ember rather than a hairline, plus the
// occasional free-floating fleck past the rim. Reads as thrown debris, not a
// mandala of spokes.
function addSparks(g, rng, cx, cy, R, count) {
  for (let k = 0; k < count; k += 1) {
    const a = rng() * Math.PI * 2;
    const perp = a + Math.PI / 2;
    const r0 = R * (0.45 + rng() * 0.2);
    const r1 = R * (1.05 + rng() * 0.35);
    const len = Math.max(3, Math.round(r1 - r0));
    for (let i = 0; i <= len; i += 1) {
      const t = i / len;
      const r = r0 + (r1 - r0) * t;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const color = t > 0.7 ? SPARK_HOT : t > 0.3 ? SPARK_WARM : SPARK_EDGE;
      L.set(g, Math.round(x), Math.round(y), color);
      // Thicken the base third of the streak so it reads as a solid ember,
      // tapering to a single pixel by the hot tip.
      if (t < 0.4) {
        L.set(g, Math.round(x + Math.cos(perp) * 0.6), Math.round(y + Math.sin(perp) * 0.6), color);
      }
    }
    if (rng() < 0.6) {
      const fr = r1 * (1.05 + rng() * 0.15);
      L.set(g, Math.round(cx + Math.cos(a) * fr), Math.round(cy + Math.sin(a) * fr), SPARK_HOT);
    }
  }
}

// One layered fireball frame: concentric color bands, each independently
// jagged (irregular, non-repeating silhouette rather than a smooth flower),
// with soot speckling, a near-black outline, and optional spark debris.
// `charCore` draws a small ragged dark patch at the center for spent/fading
// frames (a charred crater under the smoke).
function fireball(w, h, bands, opts = {}) {
  const rng = mulberry32(opts.seed || 1);
  const g = L.newGrid(w, h);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const jagFns = bands.map(() => jaggedRadiusFn(rng, opts.jag ?? 1));

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ang = Math.atan2(dy, dx);
      for (let i = 0; i < bands.length; i += 1) {
        if (dist <= bands[i].r * jagFns[i](ang)) {
          let color = bands[i].color;
          if (rng() < 0.05) color = darken(color, 0.62);
          L.set(g, x, y, color);
          break;
        }
      }
    }
  }

  if (opts.charCore) {
    const charFn = jaggedRadiusFn(rng, 1.4);
    const cr = bands[0].r * 0.4;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= cr * charFn(Math.atan2(dy, dx))) {
          L.set(g, x, y, rng() < 0.15 ? darken(CHAR, 1.3) : CHAR);
        }
      }
    }
  }

  outlineEdges(g, OUTLINE);

  if (opts.sparks) addSparks(g, rng, cx, cy, bands[bands.length - 1].r, opts.sparks);

  return g;
}

function buildShield(frame) {
  const g = L.newGrid(64, 64); const cx = 32, cy = 32;
  const c0 = [60, 140, 210], c1 = [120, 200, 245], c2 = [200, 238, 255];
  ringBand(g, cx, cy, 30, 27, c1); ringBand(g, cx, cy, 21, 19, c0);
  const rot = frame ? Math.PI / 6 : 0;
  for (let k = 0; k < 6; k += 1) { const a = rot + k * Math.PI / 3; line(g, cx + Math.cos(a) * 19, cy + Math.sin(a) * 19, cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, c0); }
  for (let k = 0; k < 6; k += 1) { const a = rot + Math.PI / 6 + k * Math.PI / 3; L.set(g, Math.round(cx + Math.cos(a) * 29), Math.round(cy + Math.sin(a) * 29), c2); }
  return g;
}

function buildSpawn(size, frame) {
  const g = L.newGrid(size, size); const cx = (size - 1) / 2, cy = (size - 1) / 2, R = size / 2 - 1;
  const c = [150, 220, 255], hi = [235, 250, 255];
  const rot = (frame % 2) ? Math.PI / 4 : 0;
  for (let k = 0; k < 4; k += 1) { const a = rot + k * Math.PI / 2; line(g, cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R, c); }
  for (let k = 0; k < 4; k += 1) { const a = rot + Math.PI / 4 + k * Math.PI / 2; line(g, cx, cy, cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5, c); }
  diamond(g, Math.round(cx), Math.round(cy), Math.max(2, Math.floor(size / 8)), hi);
  return g;
}

function buildBullet() {
  const g = L.newGrid(12, 16);
  const body = [168, 178, 190], hi = [224, 230, 238], lo = [100, 108, 120], hot = [255, 176, 64], tip = [255, 242, 190], glow = [255, 120, 40];
  L.rect(g, 3, 5, 3, 12, glow); L.rect(g, 8, 5, 8, 12, glow);
  L.rect(g, 4, 3, 7, 13, body); L.rect(g, 4, 3, 4, 13, hi); L.rect(g, 7, 3, 7, 13, lo);
  L.set(g, 5, 0, tip); L.set(g, 6, 0, tip); L.rect(g, 5, 1, 6, 2, tip); L.rect(g, 4, 3, 7, 4, hot);
  L.rect(g, 5, 5, 6, 12, hi); L.rect(g, 4, 13, 7, 14, hot); L.set(g, 5, 15, glow); L.set(g, 6, 15, glow);
  return g;
}

const up = buildBullet();
L.emit('data/graphics/bullets.png', [
  { grid: up, keys: ['bullet.up'] },
  { grid: L.rotateN(up, 2), keys: ['bullet.down'] },
  { grid: L.rotateN(up, 3), keys: ['bullet.left'] },
  { grid: L.rotateN(up, 1), keys: ['bullet.right'] },
]);

L.emit('data/graphics/explosion.png', [
  {
    grid: fireball(44, 44, [{ r: 5, color: WHITE }, { r: 9, color: YELLOW }, { r: 14, color: ORANGE }, { r: 19, color: RED }], { seed: 101, jag: 0.85, sparks: 5 }),
    keys: ['explosion.small.1'],
  },
  {
    grid: fireball(60, 60, [{ r: 6, color: WHITE }, { r: 13, color: YELLOW }, { r: 21, color: ORANGE }, { r: 27, color: RED }], { seed: 102, jag: 1.05, sparks: 6 }),
    keys: ['explosion.small.2'],
  },
  {
    grid: fireball(64, 64, [{ r: 6, color: ORANGE }, { r: 15, color: RED }, { r: 29, color: SMOKE }], { seed: 103, jag: 1.3, charCore: true }),
    keys: ['explosion.small.3'],
  },
  {
    grid: fireball(124, 116, [{ r: 12, color: WHITE }, { r: 27, color: YELLOW }, { r: 44, color: ORANGE }, { r: 55, color: RED }], { seed: 201, jag: 0.95, sparks: 10 }),
    keys: ['explosion.large.1'],
  },
  {
    grid: fireball(136, 128, [{ r: 19, color: ORANGE }, { r: 44, color: RED }, { r: 62, color: SMOKE }], { seed: 202, jag: 1.35, charCore: true }),
    keys: ['explosion.large.2'],
  },
]);

L.emit('data/graphics/shield.png', [
  { grid: buildShield(0), keys: ['shield.1'] },
  { grid: buildShield(1), keys: ['shield.2'] },
]);

L.emit('data/graphics/spawn.png', [
  { grid: buildSpawn(36, 0), keys: ['spawn.1'] },
  { grid: buildSpawn(44, 1), keys: ['spawn.2'] },
  { grid: buildSpawn(52, 0), keys: ['spawn.3'] },
  { grid: buildSpawn(60, 1), keys: ['spawn.4'] },
]);

console.log('effects: emitted bullets/explosion/shield/spawn');
