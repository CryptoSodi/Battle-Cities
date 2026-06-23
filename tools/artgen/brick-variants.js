/* eslint-disable */
// Iron Siege — brick variant sheets (menu / inverse / blue), restyle in place.
// Same running-bond brick as gameplay, recolored; one file per variant,
// emitted at lib.ART_SCALE x with the matching manifest scale.
//
// Run from the repo root:  node tools/artgen/brick-variants.js

const L = require('./lib');

const VARIANTS = [
  { key: 'menu-brick', file: 'menu-brick.png', pal: { mortar: [44, 32, 24], d: [120, 56, 30], m: [170, 84, 44], hi: [214, 128, 72] } },
  { key: 'inverse-brick', file: 'inverse-brick.png', pal: { mortar: [208, 208, 212], d: [150, 150, 158], m: [184, 184, 190], hi: [230, 230, 234] } },
  { key: 'blue-brick', file: 'blue-brick.png', pal: { mortar: [18, 26, 42], d: [34, 66, 116], m: [50, 98, 156], hi: [96, 150, 206] } },
];

VARIANTS.forEach((v) => {
  L.emit(`data/graphics/${v.file}`, [
    { grid: L.brickTile(v.pal, 0), keys: [`terrain.${v.key}.1`] },
    { grid: L.brickTile(v.pal, 1), keys: [`terrain.${v.key}.2`] },
  ]);
  console.log(`wrote ${v.file}`);
});
