/* eslint-disable */
// Iron Siege — powerup pickup icons, one file per powerup.
//   powerup-helmet/clock/shovel/star/grenade/tank/gun.png
// Each is a metallic gold-rimmed badge with a distinct high-contrast symbol.
//
// Run from the repo root:  node tools/artgen/powerups.js

const L = require('./lib');

const W = 64;
const H = 60;
const CX = 32;
const CY = 30;

const disc = (g, cx, cy, r, c) => {
  for (let y = cy - r; y <= cy + r; y += 1) for (let x = cx - r; x <= cx + r; x += 1) { const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r * r) L.set(g, x, y, c); }
};
const ring = (g, cx, cy, r, c) => {
  for (let y = cy - r; y <= cy + r; y += 1) for (let x = cx - r; x <= cx + r; x += 1) { const dx = x - cx, dy = y - cy, d = dx * dx + dy * dy; if (d <= r * r && d >= (r - 2) * (r - 2)) L.set(g, x, y, c); }
};
const diamond = (g, cx, cy, r, c) => {
  for (let y = cy - r; y <= cy + r; y += 1) for (let x = cx - r; x <= cx + r; x += 1) if (Math.abs(x - cx) + Math.abs(y - cy) <= r) L.set(g, x, y, c);
};
const line = (g, x0, y0, x1, y1, c) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i += 1) L.set(g, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
};

function badge(g) {
  const d0 = [16, 19, 24], d1 = [30, 35, 42], d2 = [46, 53, 62];
  const rim = [201, 160, 62], rimHi = [238, 204, 112], rimLo = [138, 102, 36];
  L.rect(g, 3, 1, W - 4, H - 2, d1);
  L.rect(g, 3, 1, W - 4, 1, d2); L.rect(g, 3, 1, 3, H - 2, d2);
  L.rect(g, 3, H - 2, W - 4, H - 2, d0); L.rect(g, W - 4, 1, W - 4, H - 2, d0);
  L.rect(g, 6, 4, W - 7, 4, rim); L.rect(g, 6, H - 5, W - 7, H - 5, rim);
  L.rect(g, 6, 4, 6, H - 5, rim); L.rect(g, W - 7, 4, W - 7, H - 5, rim);
  L.set(g, 6, 4, rimHi); L.set(g, W - 7, H - 5, rimLo);
  L.rect(g, 9, 8, W - 10, H - 9, d0);
}

const ICONS = {
  helmet(g) {
    const c = [96, 156, 190], hi = [156, 208, 236], lo = [56, 104, 140], crest = [212, 74, 60];
    disc(g, CX, CY + 4, 13, c);
    L.rect(g, CX - 14, CY + 4, CX + 13, CY + 12, c);
    L.rect(g, CX - 14, CY + 12, CX + 13, CY + 13, lo);
    for (let i = 0; i < 12; i += 1) L.set(g, CX - 9 + i, CY - 8 + i, hi);
    L.rect(g, CX - 1, CY - 14, CX + 1, CY - 4, crest);
    L.rect(g, CX - 14, CY + 4, CX + 13, CY + 4, hi);
  },
  clock(g) {
    const c = [120, 200, 220], hi = [200, 240, 250], hand = [20, 40, 60];
    disc(g, CX, CY, 15, [40, 60, 72]); ring(g, CX, CY, 15, c);
    for (let a = 0; a < 12; a += 1) { const t = (a / 12) * Math.PI * 2; L.set(g, Math.round(CX + Math.sin(t) * 12), Math.round(CY - Math.cos(t) * 12), hi); }
    line(g, CX, CY, CX, CY - 9, hand); line(g, CX, CY, CX + 7, CY + 2, hand); disc(g, CX, CY, 2, hi);
  },
  shovel(g) {
    const steel = [150, 162, 174], hi = [200, 210, 220], lo = [96, 106, 118], wood = [150, 104, 54];
    L.rect(g, CX - 1, CY - 16, CX + 1, CY + 4, wood); L.rect(g, CX - 5, CY - 18, CX + 5, CY - 16, wood);
    for (let y = CY + 4; y <= CY + 16; y += 1) { const w = 9 - Math.floor((y - (CY + 4)) / 2); L.rect(g, CX - w, y, CX + w, y, steel); }
    L.rect(g, CX - 9, CY + 4, CX - 9, CY + 6, hi); L.rect(g, CX + 4, CY + 12, CX + 6, CY + 14, lo);
  },
  star(g) {
    const gold = [240, 196, 70], hi = [255, 232, 150], lo = [180, 130, 36];
    line(g, CX, CY - 18, CX, CY + 18, gold); line(g, CX - 18, CY, CX + 18, CY, gold);
    line(g, CX - 11, CY - 11, CX + 11, CY + 11, gold); line(g, CX + 11, CY - 11, CX - 11, CY + 11, gold);
    diamond(g, CX, CY, 9, gold); diamond(g, CX, CY, 5, hi);
    L.set(g, CX + 6, CY + 6, lo); L.set(g, CX - 6, CY + 6, lo);
  },
  grenade(g) {
    const body = [70, 110, 56], hi = [120, 168, 90], lo = [40, 68, 34], steel = [150, 162, 174];
    disc(g, CX, CY + 4, 13, body);
    for (let i = 0; i < 8; i += 1) L.set(g, CX - 7 + i, CY - 3 + i, hi);
    L.rect(g, CX - 4, CY - 12, CX + 4, CY - 8, steel); L.rect(g, CX - 6, CY - 9, CX - 4, CY - 8, steel);
    L.rect(g, CX + 4, CY - 14, CX + 9, CY - 12, [200, 180, 80]); L.set(g, CX + 8, CY + 9, lo);
  },
  tank(g) {
    const gold = [196, 158, 56], hi = [236, 204, 110], trk = [40, 46, 54], steel = [150, 162, 174];
    L.rect(g, CX - 15, CY - 8, CX - 9, CY + 12, trk); L.rect(g, CX + 9, CY - 8, CX + 15, CY + 12, trk);
    L.rect(g, CX - 8, CY - 6, CX + 8, CY + 12, gold); L.rect(g, CX - 8, CY - 6, CX + 8, CY - 5, hi);
    disc(g, CX, CY + 2, 5, steel); L.rect(g, CX - 1, CY - 16, CX + 1, CY + 2, steel);
  },
  gun(g) {
    const steel = [158, 170, 182], hi = [210, 220, 230], lo = [96, 106, 118], grip = [70, 60, 50];
    L.rect(g, CX - 16, CY - 4, CX + 12, CY + 2, steel); L.rect(g, CX - 16, CY - 4, CX + 12, CY - 4, hi);
    L.rect(g, CX + 8, CY - 8, CX + 16, CY + 4, steel); L.rect(g, CX + 2, CY + 2, CX + 8, CY + 14, grip);
    L.set(g, CX - 16, CY, hi); L.rect(g, CX + 8, CY + 4, CX + 16, CY + 4, lo);
  },
};

['helmet', 'clock', 'shovel', 'star', 'grenade', 'tank', 'gun'].forEach((name) => {
  const g = L.newGrid(W, H);
  badge(g);
  ICONS[name](g);
  L.emit(`data/graphics/powerup-${name}.png`, [{ grid: g, keys: [`powerup.${name}`] }]);
});

console.log('powerups: emitted one file per powerup');
