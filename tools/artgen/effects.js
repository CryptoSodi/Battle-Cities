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

function burst(w, h, bands, spark) {
  const g = L.newGrid(w, h);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const R = bands[bands.length - 1].r;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx);
    const wob = 1 + 0.16 * Math.sin(ang * 6) + 0.09 * Math.sin(ang * 11 + 1.3);
    for (const b of bands) { if (dist <= b.r * wob) { L.set(g, x, y, b.color); break; } }
  }
  if (spark) for (let k = 0; k < 8; k += 1) { const a = k * Math.PI / 4; line(g, cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5, cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02, spark); }
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
  { grid: burst(44, 44, [{ r: 5, color: WHITE }, { r: 9, color: YELLOW }, { r: 14, color: ORANGE }, { r: 20, color: RED }], YELLOW), keys: ['explosion.small.1'] },
  { grid: burst(60, 60, [{ r: 6, color: WHITE }, { r: 13, color: YELLOW }, { r: 21, color: ORANGE }, { r: 28, color: RED }], YELLOW), keys: ['explosion.small.2'] },
  { grid: burst(64, 64, [{ r: 6, color: ORANGE }, { r: 16, color: RED }, { r: 30, color: SMOKE }]), keys: ['explosion.small.3'] },
  { grid: burst(124, 116, [{ r: 12, color: WHITE }, { r: 28, color: YELLOW }, { r: 46, color: ORANGE }, { r: 56, color: RED }], YELLOW), keys: ['explosion.large.1'] },
  { grid: burst(136, 128, [{ r: 20, color: ORANGE }, { r: 46, color: RED }, { r: 63, color: SMOKE }]), keys: ['explosion.large.2'] },
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
