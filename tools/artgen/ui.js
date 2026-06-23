/* eslint-disable */
// Iron Siege — flag + HUD icons, one file per asset.
//   flag.png · ui-enemy.png · ui-player.png
//
// Run from the repo root:  node tools/artgen/ui.js

const L = require('./lib');

function buildFlag() {
  const g = L.newGrid(64, 60);
  const pole = [120, 90, 46], poleHi = [168, 128, 66], poleLo = [78, 56, 28];
  L.rect(g, 46, 4, 49, 57, pole); L.rect(g, 46, 4, 46, 57, poleHi); L.rect(g, 49, 4, 49, 57, poleLo);
  L.fcircle(g, 47, 4, 2, [240, 200, 80]);
  const c0 = [182, 42, 36], c1 = [224, 72, 60], c2 = [140, 26, 24];
  L.fillPolygon(g, [[46, 8], [10, 14], [10, 20], [46, 16]], c1);
  L.fillPolygon(g, [[46, 16], [10, 20], [10, 32], [46, 28]], c0);
  L.fillPolygon(g, [[46, 28], [10, 32], [10, 38], [46, 36]], c2);
  L.star5(g, 27, 22, 7, 3, [240, 200, 80]);
  return g;
}

function buildUiTank(w, h, hull) {
  const g = L.newGrid(w, h);
  const cx = Math.floor(w / 2);
  const p = L.makePalette(hull);
  const trk = [40, 46, 54];
  L.rect(g, 2, 5, 7, h - 4, trk); L.rect(g, w - 8, 5, w - 3, h - 4, trk);
  L.rect(g, 8, 8, w - 9, h - 5, p.p2); L.rect(g, 8, 8, 9, h - 5, p.p3); L.rect(g, w - 10, 9, w - 9, h - 5, p.p1);
  L.fcircle(g, cx, Math.floor(h * 0.55), 4, p.p3);
  L.rect(g, cx - 1, 2, cx + 1, Math.floor(h * 0.55), [70, 78, 90]);
  return g;
}

L.emit('data/graphics/flag.png', [{ grid: buildFlag(), keys: ['flag'] }]);
L.emit('data/graphics/ui-enemy.png', [{ grid: buildUiTank(32, 32, 'steel'), keys: ['ui.enemy'] }]);
L.emit('data/graphics/ui-player.png', [{ grid: buildUiTank(28, 32, 'gold'), keys: ['ui.player'] }]);

console.log('ui: emitted flag/ui-enemy/ui-player');
