/* eslint-disable */
// Iron Siege — shared pixel-art generator library.
//
// Infrastructure shared by every per-element generator: a dependency-free PNG
// encoder, the material/hull palettes, a W×H pixel grid with rotation, a sheet
// compositor, and a targeted manifest patcher. Each element (player tank, enemy
// tanks, terrain, …) has its own generator script that builds grids with these
// helpers and writes its own sheet under data/graphics/. A later combine step
// can pack the per-element sheets into one final atlas.

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'data', 'sprite.manifest.json');

// ---- palettes (RGB) --------------------------------------------------------
// Shared materials: treads (t), turret metal (m), barrel steel (b), warm
// accent + glow (a/g). See .claude/skills/sprite-pipeline/references/material-bible.md.
const SHARED = {
  t0: [10, 13, 16], t1: [26, 33, 40], t2: [44, 52, 61], t3: [69, 79, 89],
  m0: [31, 39, 41], m1: [57, 68, 74], m2: [85, 98, 106], m3: [118, 131, 138], m4: [159, 176, 179],
  b0: [16, 19, 22], b1: [39, 45, 51], b2: [65, 73, 80], bh: [107, 117, 125],
  a1: [200, 147, 47], a2: [242, 194, 76], g1: [255, 217, 107],
};

// Hull ramps [outline, dark, mid, light, highlight] -> keys p0..p4.
const HULLS = {
  gold: [[36, 26, 12], [94, 71, 26], [138, 106, 38], [179, 143, 52], [227, 194, 94]],
  green: [[16, 34, 16], [33, 73, 33], [51, 107, 45], [77, 140, 58], [120, 180, 80]],
  steel: [[22, 26, 30], [54, 62, 70], [82, 92, 102], [120, 132, 144], [170, 182, 194]],
  teal: [[12, 30, 32], [26, 70, 74], [38, 104, 108], [58, 150, 150], [110, 200, 196]],
  crimson: [[40, 12, 12], [100, 28, 28], [150, 44, 40], [196, 72, 60], [230, 120, 96]],
  silver: [[40, 44, 52], [86, 94, 104], [128, 138, 150], [170, 180, 192], [214, 222, 230]],
  // Bright warning red used for the "danger" flash on powerup-drop tanks.
  danger: [[60, 10, 8], [150, 30, 22], [205, 52, 38], [238, 98, 70], [255, 156, 116]],
};

function makePalette(hullName) {
  const ramp = HULLS[hullName];
  if (!ramp) throw new Error(`unknown hull "${hullName}"`);
  return Object.assign({}, SHARED, { p0: ramp[0], p1: ramp[1], p2: ramp[2], p3: ramp[3], p4: ramp[4] });
}

// ---- pixel grid (stores RGB triples or null) -------------------------------
function newGrid(w, h) {
  return { w, h, data: new Array(w * h).fill(null) };
}
function set(g, x, y, rgb) {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  g.data[y * g.w + x] = rgb;
}
function rect(g, x0, y0, x1, y1, rgb) {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) set(g, x, y, rgb);
}
function star(g, cx, cy, rgb, rgbEdge) {
  set(g, cx, cy - 2, rgb);
  set(g, cx - 1, cy - 1, rgbEdge); set(g, cx, cy - 1, rgb); set(g, cx + 1, cy - 1, rgbEdge);
  rect(g, cx - 2, cy, cx + 2, cy, rgbEdge); set(g, cx - 1, cy, rgb); set(g, cx, cy, rgb); set(g, cx + 1, cy, rgb);
  set(g, cx - 1, cy + 1, rgbEdge); set(g, cx, cy + 1, rgb); set(g, cx + 1, cy + 1, rgbEdge);
  set(g, cx, cy + 2, rgb);
}

function line(g, x0, y0, x1, y1, rgb) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i += 1) set(g, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), rgb);
}
function fcircle(g, cx, cy, r, rgb) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) { const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r * r) set(g, x, y, rgb); }
  }
}
function ring(g, cx, cy, rO, rI, rgb) {
  for (let y = Math.floor(cy - rO); y <= Math.ceil(cy + rO); y += 1) {
    for (let x = Math.floor(cx - rO); x <= Math.ceil(cx + rO); x += 1) { const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy); if (d <= rO && d >= rI) set(g, x, y, rgb); }
  }
}
function fillPolygon(g, pts, rgb) {
  let minY = Infinity, maxY = -Infinity;
  pts.forEach((p) => { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y += 1) {
    const xs = [];
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x <= Math.round(xs[k + 1]); x += 1) set(g, x, y, rgb);
  }
}
function star5(g, cx, cy, rO, rI, rgb) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) { const r = i % 2 ? rI : rO; const a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  fillPolygon(g, pts, rgb);
}

function rotateCW(g) {
  const out = newGrid(g.h, g.w);
  for (let y = 0; y < g.h; y += 1) for (let x = 0; x < g.w; x += 1) out.data[x * g.h + (g.h - 1 - y)] = g.data[y * g.w + x];
  return out;
}
function rotateN(g, n) {
  let out = g;
  for (let i = 0; i < ((n % 4) + 4) % 4; i += 1) out = rotateCW(out);
  return out;
}

// ---- the tank, parametric over frame size + hull ---------------------------
// Draws a top-down tank facing UP, sized to fit a w×h frame. Rotate for the
// other facings. `pal` is a merged palette (makePalette + shared); opts can set
// treadPhase (0|1 tread animation) and an optional emblem.
function buildTank(w, h, pal, opts = {}) {
  const g = newGrid(w, h);
  const treadPhase = opts.treadPhase || 0;
  const cx = Math.floor(w / 2);
  const lx0 = 4, lx1 = 14, rx0 = w - 15, rx1 = w - 5;
  const ty0 = 6, ty1 = h - 6;
  const hx0 = 15, hx1 = w - 16, hy0 = 9, hy1 = h - 7;
  const seamY = Math.round((hy0 + hy1) / 2);
  const turY = Math.round(h * 0.56);
  const r = opts.turretR || 8;

  function track(x0, x1, lightLeft) {
    rect(g, x0, ty0, x1, ty1, pal.t2);
    for (let y = ty0 + 1; y < ty1; y += 1) {
      const m = (y + treadPhase) % 3;
      rect(g, x0 + 1, y, x1 - 1, y, m === 0 ? pal.t1 : m === 1 ? pal.t3 : pal.t2);
    }
    rect(g, x0, ty0, x0, ty1, pal.t0); rect(g, x1, ty0, x1, ty1, pal.t0);
    rect(g, x0, ty0, x1, ty0, pal.t0); rect(g, x0, ty1, x1, ty1, pal.t0);
    rect(g, x0 + 1, ty0 + 1, x0 + 1, ty1 - 1, lightLeft ? pal.t3 : pal.t1);
    rect(g, x1 - 1, ty0 + 1, x1 - 1, ty1 - 1, pal.t1);
    set(g, x0, ty0, null); set(g, x1, ty0, null); set(g, x0, ty1, null); set(g, x1, ty1, null);
  }
  track(lx0, lx1, true);
  track(rx0, rx1, false);

  rect(g, hx0, hy0, hx1, hy1, pal.p2);
  [[hx0, hy0], [hx0, hy0 + 1], [hx1, hy0], [hx1, hy0 + 1], [hx0, hy1], [hx0, hy1 - 1], [hx1, hy1], [hx1, hy1 - 1]].forEach((p) => set(g, p[0], p[1], null));
  rect(g, hx0, hy0, hx0, hy1, pal.p0); rect(g, hx1, hy0, hx1, hy1, pal.p0);
  rect(g, hx0, hy0, hx1, hy0, pal.p0); rect(g, hx0, hy1, hx1, hy1, pal.p0);
  rect(g, hx0 + 1, hy0 + 1, hx1 - 1, hy0 + 2, pal.p4); rect(g, hx0 + 1, hy0 + 1, hx0 + 2, hy1 - 1, pal.p3);
  rect(g, hx0 + 1, hy1 - 1, hx1 - 1, hy1 - 1, pal.p1); rect(g, hx1 - 1, hy0 + 2, hx1 - 1, hy1 - 1, pal.p1);
  rect(g, hx0 + 1, seamY, hx1 - 1, seamY, pal.p1); rect(g, hx0 + 1, seamY - 1, hx1 - 1, seamY - 1, pal.p3);
  [[hx0 + 4, hy0 + 5], [hx1 - 4, hy0 + 5], [hx0 + 4, hy1 - 5], [hx1 - 4, hy1 - 5]].forEach((p) => { set(g, p[0], p[1], pal.p4); set(g, p[0], p[1] + 1, pal.p0); });
  if (opts.armor) {
    [[hx0 + 4, seamY - 3], [hx1 - 4, seamY - 3], [hx0 + 4, seamY + 4], [hx1 - 4, seamY + 4]].forEach((p) => { set(g, p[0], p[1], pal.p4); set(g, p[0], p[1] + 1, pal.p0); });
  }
  [[hx0 + 7, hy0 + 10], [hx1 - 7, seamY + 4], [hx0 + 5, hy1 - 8], [hx1 - 5, hy0 + 9]].forEach((p) => set(g, p[0], p[1], pal.p1));
  if (opts.emblem) star(g, cx, hy0 + 6, pal.a2, pal.a1);
  set(g, cx - 6, hy1 - 2, pal.g1); set(g, cx - 5, hy1 - 2, pal.a2); set(g, cx + 5, hy1 - 2, pal.a2); set(g, cx + 6, hy1 - 2, pal.g1);

  for (let y = turY - r; y <= turY + r; y += 1) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      const dx = x - cx, dy = y - turY, d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) {
        const li = dx + dy;
        let s = pal.m2;
        if (d > r - 1) s = pal.m0;
        else if (li < -5) s = pal.m4;
        else if (li < -1) s = pal.m3;
        else if (li > 5) s = pal.m0;
        else if (li > 1) s = pal.m1;
        set(g, x, y, s);
      }
    }
  }
  rect(g, cx - 1, turY - 1, cx, turY, pal.m4); set(g, cx + 1, turY + 1, pal.m0); set(g, cx + 1, turY, pal.m1); set(g, cx, turY + 1, pal.m1);
  [[cx, turY - 6], [cx, turY + 6], [cx - 6, turY], [cx + 6, turY]].forEach((p) => set(g, p[0], p[1], pal.m4));

  const drawBarrel = (bx) => {
    rect(g, bx - 2, 3, bx + 2, turY, pal.b1); rect(g, bx - 2, 3, bx - 2, turY, pal.b0); rect(g, bx + 2, 3, bx + 2, turY, pal.b0);
    rect(g, bx - 1, 3, bx - 1, turY, pal.bh); rect(g, bx, 3, bx + 1, turY, pal.b2);
    rect(g, bx - 2, 3, bx + 2, 4, pal.b2); set(g, bx - 1, 3, pal.a2); set(g, bx, 3, pal.a2); set(g, bx + 1, 3, pal.a2);
  };
  if (opts.barrels === 2) { drawBarrel(cx - 4); drawBarrel(cx + 4); } else { drawBarrel(cx); }

  return g;
}

// ---- brick (16x16, seamless running bond) ----------------------------------
// Courses are 4px tall (3px brick + 1px mortar) so the pattern tiles vertically
// (mortar at y15 meets the next tile's brick at y0). Vertical joints stagger
// every course and the half-bricks at the left/right edges of odd courses meet
// their neighbours, so walls read as continuous running-bond masonry and any
// arrangement of surviving 16px bricks (a "semi-destroyed" wall) still lines up.
// pal = { mortar, d, m, hi } RGB. variant 1 adds light weathering.
function brickTile(pal, variant) {
  const g = newGrid(16, 16);
  rect(g, 0, 0, 15, 15, pal.mortar);
  const brick = (x0, y0, w) => {
    const x1 = x0 + w - 1;
    rect(g, x0, y0, x1, y0 + 2, pal.m);
    rect(g, x0, y0, x1, y0, pal.hi);
    rect(g, x0, y0, x0, y0 + 2, pal.hi);
    rect(g, x0, y0 + 2, x1, y0 + 2, pal.d);
  };
  for (let c = 0; c < 4; c += 1) {
    const y = c * 4;
    if (c % 2 === 0) { brick(0, y, 7); brick(8, y, 7); }
    else { brick(0, y, 3); brick(4, y, 7); brick(12, y, 4); }
  }
  if (variant) [[5, 1], [10, 9], [2, 13]].forEach((p) => set(g, p[0], p[1], pal.d));
  return g;
}

// ---- sheet compositor ------------------------------------------------------
function newSheet(w, h) {
  return { w, h, rgba: Buffer.alloc(w * h * 4) };
}
function blit(sheet, g, ox, oy) {
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const c = g.data[y * g.w + x];
      if (!c) continue;
      const i = ((oy + y) * sheet.w + (ox + x)) * 4;
      sheet.rgba[i] = c[0]; sheet.rgba[i + 1] = c[1]; sheet.rgba[i + 2] = c[2]; sheet.rgba[i + 3] = 255;
    }
  }
}

// ---- PNG encoder (RGBA, dependency-free) -----------------------------------
const CRC_TABLE = (() => {
  const t = new Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function writeSheet(filePath, sheet) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(sheet.w, 0); ihdr.writeUInt32BE(sheet.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = sheet.w * 4;
  const raw = Buffer.alloc((stride + 1) * sheet.h);
  for (let y = 0; y < sheet.h; y += 1) { raw[y * (stride + 1)] = 0; sheet.rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]));
}

// ---- targeted manifest patcher (preserves formatting) ----------------------
function patchManifest(patches, sheetRel, scale = 1) {
  // Parse + rewrite as real JSON so entries can be added (new animation frames)
  // as well as updated. rect arrays are collapsed back to one line for
  // readability. New keys append at the end; lookup is by id so order is moot.
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  for (const [key, r] of Object.entries(patches)) {
    const entry = { file: sheetRel, rect: r };
    if (scale && scale !== 1) entry.scale = scale;
    manifest[key] = entry;
  }
  const json = JSON.stringify(manifest, null, 2).replace(
    /\[\n\s*([\s\S]*?)\n\s*\]/g,
    (_, inner) => `[${inner.replace(/\s+/g, ' ').trim()}]`,
  );
  fs.writeFileSync(MANIFEST_PATH, `${json}\n`);
  return Object.keys(patches).length;
}

// HD authoring factor. Art is generated at this multiple of its logical
// (gameplay) size and tagged with `scale` in the manifest, so the engine draws
// it back down to the original footprint. Replacement art (your own HD images)
// should match the per-asset sizes this produces. Set to 1 to author 1:1.
const ART_SCALE = 4;

// Nearest-neighbour upscale of a grid by an integer factor.
function upscaleGrid(g, factor) {
  if (factor === 1) return g;
  const out = newGrid(g.w * factor, g.h * factor);
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const c = g.data[y * g.w + x];
      if (!c) continue;
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          out.data[(y * factor + dy) * out.w + (x * factor + dx)] = c;
        }
      }
    }
  }
  return out;
}

// Write one asset's frames to their own PNG file and repoint every manifest
// entry to it. items = [{ grid, keys: [...] }]; a frame can back several keys
// (e.g. one shared "danger" frame used by every tier). Frames are upscaled by
// `scale`, packed into a uniform grid (<=8 columns) so textures stay bounded,
// centered in their cell, and tagged with `scale` so the draw size is logical.
function emit(fileRel, items, scale = ART_SCALE) {
  const ups = items.map((it) => ({ grid: upscaleGrid(it.grid, scale), keys: it.keys }));
  let cellW = 0;
  let cellH = 0;
  ups.forEach((it) => { if (it.grid.w > cellW) cellW = it.grid.w; if (it.grid.h > cellH) cellH = it.grid.h; });
  const cols = Math.min(ups.length, 8);
  const rows = Math.ceil(ups.length / cols);
  const sheet = newSheet(cols * cellW, rows * cellH);
  const patches = {};
  ups.forEach((it, i) => {
    const ox = (i % cols) * cellW + Math.floor((cellW - it.grid.w) / 2);
    const oy = Math.floor(i / cols) * cellH + Math.floor((cellH - it.grid.h) / 2);
    blit(sheet, it.grid, ox, oy);
    it.keys.forEach((k) => { patches[k] = [ox, oy, it.grid.w, it.grid.h]; });
  });
  writeSheet(path.join(ROOT, fileRel), sheet);
  patchManifest(patches, fileRel, scale);
  return Object.keys(patches).length;
}

module.exports = {
  ROOT, makePalette, newGrid, set, rect, star, buildTank, rotateCW, rotateN,
  newSheet, blit, writeSheet, patchManifest, emit, ART_SCALE,
  line, fcircle, ring, fillPolygon, star5, brickTile,
};
