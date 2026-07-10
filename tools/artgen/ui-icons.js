/* eslint-disable */
// Iron Siege — small UI icons for the economy/meta screens (treasury, ranking
// badges, events, staking, trading, wiki, airdrop). One shared sheet under the
// dedicated UI asset folder:  data/graphics/ui/icons.png
//
// Run from the repo root:  node tools/artgen/ui-icons.js

const L = require('./lib');

// Shared ramps (material-bible tones).
const OUT = [22, 15, 12];
const GOLD_D = [150, 108, 24];
const GOLD = [212, 164, 44];
const GOLD_H = [244, 208, 96];
const STEEL_D = [58, 64, 74];
const STEEL = [96, 104, 118];
const STEEL_H = [152, 162, 176];
const GREEN_D = [26, 122, 62];
const GREEN = [61, 220, 132];
const PAPER = [214, 196, 150];
const PAPER_D = [164, 142, 96];
const RED = [196, 60, 44];

// 1px outline around every opaque pixel, drawn into empty neighbours.
function outline(g) {
  const src = g.data.slice();
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      if (!src[y * g.w + x]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
          if (!src[ny * g.w + nx] && !g.data[ny * g.w + nx]) {
            g.data[ny * g.w + nx] = OUT;
          }
        }
      }
    }
  }
  return g;
}

// Trophy cup — ranking / hall of fame.
function buildTrophy() {
  const g = L.newGrid(22, 22);
  L.rect(g, 5, 3, 16, 10, GOLD);
  L.rect(g, 5, 3, 6, 10, GOLD_H);
  L.rect(g, 15, 3, 16, 10, GOLD_D);
  L.rect(g, 4, 2, 17, 3, GOLD_H);
  // Handles.
  L.ring(g, 4, 6, 3, GOLD_D);
  L.ring(g, 17, 6, 3, GOLD_D);
  // Stem + base.
  L.rect(g, 9, 11, 12, 14, GOLD_D);
  L.rect(g, 7, 15, 14, 16, GOLD);
  L.rect(g, 5, 17, 16, 19, GOLD_D);
  L.star5(g, 10, 6, 3, 1, [255, 244, 180]);
  return outline(g);
}

// Medal with ribbon — event currency.
function buildMedal() {
  const g = L.newGrid(22, 22);
  L.fillPolygon(g, [[7, 1], [10, 1], [12, 9], [8, 9]], RED);
  L.fillPolygon(g, [[12, 1], [15, 1], [14, 9], [10, 9]], [150, 40, 30]);
  L.fcircle(g, 11, 13, 6, GOLD);
  L.fcircle(g, 9, 11, 2, GOLD_H);
  L.ring(g, 11, 13, 6, GOLD_D);
  L.star5(g, 11, 13, 4, 2, GOLD_H);
  return outline(g);
}

// Padlock — staking (badge + page icon). Thick U-shackle so it reads at 20px.
function buildLock() {
  const g = L.newGrid(22, 22);
  // Shackle: two posts + top bar, 2px thick steel.
  L.rect(g, 5, 2, 16, 4, STEEL_H);
  L.rect(g, 5, 4, 7, 10, STEEL_H);
  L.rect(g, 14, 4, 16, 10, STEEL);
  // Body.
  L.rect(g, 3, 10, 18, 20, GOLD);
  L.rect(g, 3, 10, 4, 20, GOLD_H);
  L.rect(g, 17, 10, 18, 20, GOLD_D);
  L.rect(g, 3, 19, 18, 20, GOLD_D);
  // Keyhole.
  L.fcircle(g, 11, 14, 2, OUT);
  L.rect(g, 10, 15, 12, 18, OUT);
  return outline(g);
}

// Double up-chevron — boost badge. Two floating arrow bands, no stem, so it
// can't read as a tree.
function buildBoost() {
  const g = L.newGrid(22, 22);
  // Upper chevron band.
  L.fillPolygon(g, [[11, 1], [20, 9], [20, 12], [11, 4], [2, 12], [2, 9]], GREEN);
  // Lower chevron band.
  L.fillPolygon(g, [[11, 10], [20, 18], [20, 21], [11, 13], [2, 21], [2, 18]], GREEN_D);
  return outline(g);
}

// Vault/safe — treasury.
function buildVault() {
  const g = L.newGrid(22, 22);
  L.rect(g, 2, 3, 19, 18, STEEL);
  L.rect(g, 2, 3, 3, 18, STEEL_H);
  L.rect(g, 18, 3, 19, 18, STEEL_D);
  L.rect(g, 4, 5, 17, 16, STEEL_D);
  L.ring(g, 11, 10, 4, STEEL_H);
  L.rect(g, 10, 9, 12, 11, GOLD);
  L.rect(g, 3, 19, 6, 20, STEEL_D);
  L.rect(g, 15, 19, 18, 20, STEEL_D);
  return outline(g);
}

// Field manual book — wiki.
function buildBook() {
  const g = L.newGrid(22, 22);
  L.fillPolygon(g, [[3, 4], [11, 6], [11, 19], [3, 17]], PAPER);
  L.fillPolygon(g, [[19, 4], [11, 6], [11, 19], [19, 17]], PAPER_D);
  L.rect(g, 10, 6, 12, 19, [120, 96, 60]);
  L.line(g, 5, 8, 9, 9, PAPER_D);
  L.line(g, 5, 11, 9, 12, PAPER_D);
  L.line(g, 13, 9, 17, 8, PAPER);
  L.line(g, 13, 12, 17, 11, PAPER);
  L.star5(g, 6, 15, 2, 1, GOLD);
  return outline(g);
}

// Supply crate under a parachute — airdrop. Dome canopy (half-disc with
// scalloped bottom) over a wide slatted crate.
function buildChute() {
  const g = L.newGrid(22, 22);
  // Canopy: filled disc, lower half cleared to make a dome.
  L.fcircle(g, 11, 8, 8, GOLD);
  L.fcircle(g, 8, 6, 3, GOLD_H);
  for (let y = 9; y < 22; y += 1) {
    for (let x = 0; x < 22; x += 1) {
      g.data[y * g.w + x] = null;
    }
  }
  // Scalloped canopy hem.
  L.fcircle(g, 5, 8, 2, GOLD_D);
  L.fcircle(g, 11, 9, 2, GOLD_D);
  L.fcircle(g, 17, 8, 2, GOLD_D);
  // Shroud lines.
  L.line(g, 4, 10, 8, 14, STEEL_H);
  L.line(g, 18, 10, 14, 14, STEEL_H);
  // Crate with slats.
  L.rect(g, 5, 14, 17, 21, [140, 96, 44]);
  L.rect(g, 5, 14, 6, 21, [178, 128, 62]);
  L.rect(g, 16, 14, 17, 21, [92, 62, 28]);
  L.rect(g, 5, 17, 17, 18, [92, 62, 28]);
  return outline(g);
}

// Two counter-arrows — trading/swap.
function buildSwap() {
  const g = L.newGrid(22, 22);
  L.rect(g, 3, 6, 14, 8, STEEL_H);
  L.fillPolygon(g, [[14, 3], [19, 7], [14, 11]], STEEL_H);
  L.rect(g, 8, 14, 19, 16, GOLD);
  L.fillPolygon(g, [[8, 11], [3, 15], [8, 19]], GOLD);
  return outline(g);
}

L.emit('data/graphics/ui/icons.png', [
  { grid: buildTrophy(), keys: ['ui.icon.trophy'] },
  { grid: buildMedal(), keys: ['ui.icon.medal'] },
  { grid: buildLock(), keys: ['ui.icon.lock', 'ui.icon.badge.stake'] },
  { grid: buildBoost(), keys: ['ui.icon.badge.boost'] },
  { grid: buildVault(), keys: ['ui.icon.vault'] },
  { grid: buildBook(), keys: ['ui.icon.book'] },
  { grid: buildChute(), keys: ['ui.icon.chute'] },
  { grid: buildSwap(), keys: ['ui.icon.swap'] },
]);

console.log('ui-icons: emitted data/graphics/ui/icons.png (8 icons)');
