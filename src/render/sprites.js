// Procedural pixel-art mushrooms built from modular gene layers (GDD 17).
import { shade, mix, css } from '../core/color.js';
import { makeRng } from '../core/rng.js';
import { RESOURCES } from '../content/world.js';

export const SPRITE_W = 24;
export const SPRITE_H = 28;
// mushrooms are shown at 65% of their sprite size, in the forest and on screens
export const MUSHROOM_SCALE = 0.65;
const CX = 12;
const CAP_BOTTOM = 14;

const cache = new Map();

// ---------- sprite overrides (from assets/sprites.json, made in the Sprite Workshop) ----------
let OVERRIDES = {};

/** Install edited sprites. Mushroom parts are colour-role masks; see ROLE_COLOURS below. */
export function setSpriteOverrides(sprites) {
  OVERRIDES = sprites || {};
  cache.clear();
  ovCanvasCache.clear();
}

export function spriteOverride(key) {
  return OVERRIDES[key] || null;
}

/** Palette index alphabet for full-colour sprites ('.' = transparent). */
export const PALETTE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ovCanvasCache = new Map();

/** A full-colour override (structure, scenery, tile) rendered to a canvas, or null. */
export function overrideCanvas(key) {
  const ov = OVERRIDES[key];
  if (!ov || ov.kind !== 'color') return null;
  if (ovCanvasCache.has(key)) return ovCanvasCache.get(key);
  const c = makeCanvas(ov.w, ov.h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(ov.w, ov.h);
  const pal = (ov.palette || []).map((hx) => {
    const v = hx.replace('#', '');
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), v.length >= 8 ? parseInt(v.slice(6, 8), 16) : 255];
  });
  for (let y = 0; y < ov.h; y++) for (let x = 0; x < ov.w; x++) {
    const ch = ov.rows[y]?.[x];
    const i = ch === undefined || ch === '.' ? -1 : PALETTE_ALPHABET.indexOf(ch);
    if (i < 0 || !pal[i]) continue;
    const k = (y * ov.w + x) * 4;
    img.data[k] = pal[i][0]; img.data[k + 1] = pal[i][1]; img.data[k + 2] = pal[i][2]; img.data[k + 3] = pal[i][3];
  }
  ctx.putImageData(img, 0, 0);
  ovCanvasCache.set(key, c);
  return c;
}

/** Each character of a mushroom-part mask names a colour role ('.' = empty). */
export const PART_ROLES = {
  cap: { b: 'cap colour', l: 'highlight', d: 'shade' },
  stem: { s: 'stem colour', k: 'stem shade', r: 'ring', c: 'crystal' },
  face: { e: 'eye', p: 'blush' },
  marking: { a: 'accent', m: 'soft accent', w: 'pale glint', y: 'star' },
  gills: { g: 'gill colour', k: 'gill shade', L: 'gill highlight', v: 'velvet' },
};
const roleAt = (ov, x, y) => (ov.rows[y] && ov.rows[y][x] !== undefined && ov.rows[y][x] !== '.' ? ov.rows[y][x] : null);

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---------- masks ----------
function capMask(type) {
  const m = new Set();
  const add = (x, y) => { if (x >= 0 && x < SPRITE_W && y >= 0 && y < SPRITE_H) m.add(x + ',' + y); };
  const ell = (cx, cy, rx, ry, yMax = 99, yMin = -99) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      if (y > yMax || y < yMin) continue;
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) add(x, y);
      }
    }
  };
  switch (type) {
    case 'flatcap':
      ell(CX, 11.5, 11.5, 4); ell(CX, 9, 4, 2);
      break;
    case 'bellcap':
      for (let y = 3; y <= CAP_BOTTOM; y++) {
        const t = (y - 3) / (CAP_BOTTOM - 3);
        const hw = 3.2 + 7 * Math.pow(t, 0.8) + (y >= CAP_BOTTOM - 1 ? 1 : 0);
        for (let x = Math.round(CX - hw); x < Math.round(CX + hw); x++) add(x, y);
      }
      ell(CX, 4.5, 3.5, 2.5);
      break;
    case 'wavycap':
      ell(CX, 13, 11, 8, 12);
      for (let x = 1; x < 23; x++) { const d = Math.round(Math.sin(x * 0.9) * 1.2 + 1.2); for (let y = 12; y <= 12 + d; y++) add(x, y); }
      break;
    case 'conecap':
      for (let y = 2; y <= CAP_BOTTOM; y++) {
        const hw = 0.8 + (y - 2) * 0.82;
        for (let x = Math.round(CX - hw); x < Math.round(CX + hw); x++) add(x, y);
      }
      break;
    case 'clustercap':
      ell(6.5, 12, 5.5, 4.5, 14); ell(17.5, 12, 5.5, 4.5, 14); ell(CX, 8, 6.5, 6, 13);
      break;
    case 'shelfcap':
      ell(13, 12, 10.5, 4, 14); ell(10, 7.5, 7, 3.2);
      break;
    case 'frillcap':
      ell(CX, 13, 10, 9, 12);
      for (let x = 1; x < 23; x++) { if (x % 2 === 0) { add(x, 13); add(x, 14); } else add(x, 13); }
      break;
    case 'lanterncap':
      for (let y = 3; y <= CAP_BOTTOM; y++) {
        const corner = y === 3 || y === CAP_BOTTOM ? 2 : y === 4 || y === CAP_BOTTOM - 1 ? 1 : 0;
        for (let x = CX - 7 + corner; x < CX + 7 - corner; x++) add(x, y);
      }
      add(CX - 1, 2); add(CX, 2); add(CX - 1, 1); add(CX, 1);
      break;
    case 'spirecap':
      for (let y = 0; y <= CAP_BOTTOM; y++) {
        const t = y / CAP_BOTTOM;
        const hw = 0.6 + 7.5 * Math.pow(t, 2.1);
        for (let x = Math.round(CX - hw); x < Math.round(CX + hw); x++) add(x, y);
      }
      break;
    case 'roundcap':
    default:
      ell(CX, 13.5, 10.5, 10, 13);
      for (let x = 2; x < 22; x++) add(x, 14);
  }
  return m;
}

function stemMask(type) {
  const m = new Set();
  const add = (x, y) => m.add(x + ',' + y);
  const bottom = 26;
  for (let y = CAP_BOTTOM - 1; y <= bottom; y++) {
    let hw = 3;
    let off = 0;
    switch (type) {
      case 'sturdy': hw = 4; break;
      case 'slender': hw = 2; break;
      case 'bulbous': hw = y > 20 ? 3 + Math.min(2, (y - 20) * 0.7) - (y === bottom ? 1 : 0) : 3; break;
      case 'rooted': hw = 3; break;
      case 'ringed': hw = y === 17 || y === 18 ? 5 : 3; break;
      case 'twisted': hw = 2.5; off = Math.round(Math.sin(y * 0.6) * 1.2); break;
      case 'crystal': hw = 3; break;
      default: hw = 3;
    }
    for (let x = Math.round(CX - hw + off); x < Math.round(CX + hw + off); x++) add(x, y);
  }
  if (type === 'rooted') { add(CX - 4, 26); add(CX - 5, 27); add(CX + 3, 26); add(CX + 4, 27); add(CX - 1, 27); }
  return m;
}

const has = (m, x, y) => m.has(x + ',' + y);

// ---------- composition ----------
export function mushroomSprite(m) {
  const g = m.genes;
  const key = JSON.stringify([g.cap, g.stem, g.markings, g.gills, g.glow, g.color, g.accent, g.stemColor, g.pattern]);
  if (cache.has(key)) return cache.get(key);

  const W = SPRITE_W;
  const H = SPRITE_H;
  const px = new Array(W * H).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c; };
  const capOv = spriteOverride('cap:' + g.cap);
  const stemOv = spriteOverride('stem:' + g.stem);
  const faceOv = spriteOverride('face:default');
  const markOv = spriteOverride('marking:' + g.markings);
  const gillOv = spriteOverride('gills:' + g.gills);
  const maskOf = (ov) => {
    const m = new Set();
    for (let y = 0; y < Math.min(H, ov.rows.length); y++) for (let x = 0; x < W; x++) if (roleAt(ov, x, y)) m.add(x + ',' + y);
    return m;
  };
  const cap = capOv ? maskOf(capOv) : capMask(g.cap);
  const stem = stemOv ? maskOf(stemOv) : stemMask(g.stem);
  const rng = makeRng(g.pattern + 17);

  const capC = g.color;
  const capLight = shade(capC, 0.35);
  const capDark = shade(capC, -0.3);
  const accent = g.accent;
  const stemC = g.stemColor;
  const stemDark = shade(stemC, -0.22);
  const outline = shade(mix(capC, [20, 10, 30], 0.55), -0.55);

  // stem
  if (stemOv) {
    const col = { s: stemC, k: stemDark, r: shade(stemC, -0.12), c: [150, 230, 255] };
    for (const k of stem) { const [x, y] = k.split(',').map(Number); set(x, y, col[roleAt(stemOv, x, y)] || stemC); }
  } else {
    for (const k of stem) {
      const [x, y] = k.split(',').map(Number);
      const right = !has(stem, x + 1, y);
      set(x, y, right || y > 24 ? stemDark : stemC);
    }
    if (g.stem === 'crystal') for (const [x, y] of [[CX - 1, 18], [CX + 1, 20], [CX - 2, 22], [CX, 23]]) set(x, y, [150, 230, 255]);
    if (g.stem === 'ringed') for (let x = CX - 5; x < CX + 5; x++) set(x, 18, shade(stemC, -0.12));
  }
  // face on the stem
  if (faceOv) {
    const col = { e: [40, 26, 30], p: [240, 150, 150] };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = roleAt(faceOv, x, y); if (r && col[r]) set(x, y, col[r]); }
  } else {
    const eyeY = 19;
    set(CX - 2, eyeY, [40, 26, 30]); set(CX + 1, eyeY, [40, 26, 30]);
    set(CX - 2, eyeY - 1, [40, 26, 30]); set(CX + 1, eyeY - 1, [40, 26, 30]);
    set(CX - 3, eyeY + 1, [240, 150, 150]); set(CX + 2, eyeY + 1, [240, 150, 150]);
  }

  // cap with shading
  let top = 99;
  for (const k of cap) top = Math.min(top, Number(k.split(',')[1]));
  for (const k of cap) {
    const [x, y] = k.split(',').map(Number);
    let c = capC;
    if (capOv) c = { b: capC, l: capLight, d: capDark }[roleAt(capOv, x, y)] || capC;
    else {
      const hd = Math.hypot(x - (CX - 4), y - (top + 3));
      if (hd < 3.2) c = capLight;
      else if (!has(cap, x, y + 1) || !has(cap, x + 1, y) || y >= CAP_BOTTOM - 1) c = capDark;
    }
    set(x, y, c);
  }
  // markings
  const capPts = [...cap].map((k) => k.split(',').map(Number)).filter(([x, y]) => has(cap, x, y - 1) && has(cap, x, y + 1) && has(cap, x - 1, y) && has(cap, x + 1, y) && y < CAP_BOTTOM - 1);
  const mark = (x, y, c = accent) => { if (has(cap, x, y) && y < CAP_BOTTOM - 1) set(x, y, c); };
  if (markOv) {
    // an edited marking is a stamp, clipped to the inside of the cap
    const col = { a: accent, m: mix(accent, capC, 0.3), w: mix(capC, [255, 255, 255], 0.35), y: [255, 250, 210] };
    const inside = new Set(capPts.map(([x, y]) => x + ',' + y));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = roleAt(markOv, x, y); if (r && col[r] && inside.has(x + ',' + y)) set(x, y, col[r]); }
  } else switch (g.markings) {
    case 'spots':
      for (let i = 0; i < 5; i++) {
        const [x, y] = rng.pick(capPts) || [CX, 8];
        mark(x, y); mark(x + 1, y); mark(x, y + 1); mark(x + 1, y + 1);
      }
      break;
    case 'stripes':
      for (const [x, y] of capPts) if ((x + Math.floor(y / 3)) % 4 === 0) mark(x, y, mix(accent, capC, 0.25));
      break;
    case 'speckles':
      for (const [x, y] of capPts) if (rng.chance(0.13)) mark(x, y);
      break;
    case 'rings':
      for (const [x, y] of capPts) { const d = Math.round(Math.hypot(x - CX, (y - CAP_BOTTOM) * 1.3)); if (d % 4 === 0) mark(x, y, mix(accent, capC, 0.3)); }
      break;
    case 'patches':
      for (let i = 0; i < 3; i++) {
        const [cx, cy] = rng.pick(capPts) || [CX, 8];
        for (const [x, y] of capPts) if (Math.hypot(x - cx, y - cy) < 2.4) mark(x, y, mix(accent, capC, 0.35));
      }
      break;
    case 'constellation': {
      const stars = Array.from({ length: 4 }, () => rng.pick(capPts) || [CX, 8]);
      for (let i = 0; i < stars.length - 1; i++) {
        const [x0, y0] = stars[i];
        const [x1, y1] = stars[i + 1];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let s = 1; s < n; s++) mark(Math.round(x0 + ((x1 - x0) * s) / n), Math.round(y0 + ((y1 - y0) * s) / n), mix(capC, [255, 255, 255], 0.35));
      }
      for (const [x, y] of stars) mark(x, y, [255, 250, 210]);
      break;
    }
    default:
      break;
  }
  // gills / underside band
  const gillBase = shade(mix(stemC, capC, 0.25), -0.15);
  const gillDark = shade(gillBase, -0.3);
  for (let x = 0; x < W; x++) {
    let y = -1;
    for (let yy = CAP_BOTTOM + 1; yy >= 0; yy--) if (has(cap, x, yy)) { y = yy; break; }
    if (y < 0 || Math.abs(x - CX) > 9) continue;
    const under = y + 1;
    if (has(cap, x, under)) continue;
    if (gillOv) {
      const col = { g: gillBase, k: gillDark, L: shade(gillBase, 0.2), v: mix(gillBase, [255, 220, 230], 0.3) };
      const r0 = roleAt(gillOv, x, 0);
      const r1 = roleAt(gillOv, x, 1);
      if (r0 && col[r0] && !(r0 === 'v' && has(stem, x, under))) set(x, under, col[r0]);
      if (r1 && col[r1] && !has(stem, x, under + 1)) set(x, under + 1, col[r1]);
      continue;
    }
    let c = gillBase;
    switch (g.gills) {
      case 'fine': c = x % 2 ? gillBase : gillDark; break;
      case 'deep': c = gillDark; if (x % 2 && !has(stem, x, under + 1)) set(x, under + 1, gillDark); break;
      case 'pored': c = x % 3 === 0 ? gillDark : gillBase; break;
      case 'ridged': c = x % 2 === 0 ? shade(gillBase, 0.2) : gillDark; break;
      case 'toothed': c = gillBase; if (x % 3 === 1 && !has(stem, x, under + 1)) set(x, under + 1, gillDark); break;
      case 'velvet': c = mix(gillBase, [255, 220, 230], 0.3); break;
      default: break;
    }
    if (!has(stem, x, under) || g.gills !== 'velvet') set(x, under, c);
  }
  // outline
  const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && px[y * W + x] !== null;
  const out = px.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (filled(x, y)) continue;
    if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) out[y * W + x] = outline;
  }
  // rasterize
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const col = out[i];
    if (!col) continue;
    img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // silhouette for glow/outline effects
  const sil = makeCanvas(W + 2, H + 2);
  const sctx = sil.getContext('2d');
  const simg = sctx.createImageData(W + 2, H + 2);
  for (let y = 0; y < H + 2; y++) for (let x = 0; x < W + 2; x++) {
    const sx = x - 1;
    const sy = y - 1;
    const on = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H && out[yy * W + xx];
    if (!on(sx, sy) && (on(sx - 1, sy) || on(sx + 1, sy) || on(sx, sy - 1) || on(sx, sy + 1))) {
      const i = (y * (W + 2) + x) * 4;
      simg.data[i] = 255; simg.data[i + 1] = 255; simg.data[i + 2] = 255; simg.data[i + 3] = 255;
    }
  }
  sctx.putImageData(simg, 0, 0);
  const res = { canvas: c, silhouette: sil, capColor: capC, top };
  cache.set(key, res);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return res;
}

// ---------- defaults for the Sprite Workshop (role masks from the procedural rules) ----------

function gridRows(w, h, fn) {
  const rows = [];
  for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += fn(x, y) || '.'; rows.push(r); }
  return rows;
}

export function defaultCapRoles(type) {
  const cap = capMask(type);
  let top = 99;
  for (const k of cap) top = Math.min(top, Number(k.split(',')[1]));
  return gridRows(SPRITE_W, SPRITE_H, (x, y) => {
    if (!has(cap, x, y)) return null;
    if (Math.hypot(x - (CX - 4), y - (top + 3)) < 3.2) return 'l';
    if (!has(cap, x, y + 1) || !has(cap, x + 1, y) || y >= CAP_BOTTOM - 1) return 'd';
    return 'b';
  });
}

export function defaultStemRoles(type) {
  const stem = stemMask(type);
  const crystal = new Set([[CX - 1, 18], [CX + 1, 20], [CX - 2, 22], [CX, 23]].map((p) => p.join(',')));
  return gridRows(SPRITE_W, SPRITE_H, (x, y) => {
    const ringRow = type === 'ringed' && y === 18 && x >= CX - 5 && x < CX + 5;
    if (type === 'crystal' && crystal.has(x + ',' + y)) return 'c';
    if (ringRow) return 'r';
    if (!has(stem, x, y)) return null;
    return !has(stem, x + 1, y) || y > 24 ? 'k' : 's';
  });
}

export function defaultFaceRoles() {
  const e = new Set([[CX - 2, 19], [CX + 1, 19], [CX - 2, 18], [CX + 1, 18]].map((p) => p.join(',')));
  const p = new Set([[CX - 3, 20], [CX + 2, 20]].map((q) => q.join(',')));
  return gridRows(SPRITE_W, SPRITE_H, (x, y) => (e.has(x + ',' + y) ? 'e' : p.has(x + ',' + y) ? 'p' : null));
}

/** A marking stamp: the procedural pattern laid over every cap pixel (one fixed layout). */
export function defaultMarkingRoles(type) {
  const area = [];
  for (let y = 1; y < CAP_BOTTOM - 1; y++) for (let x = 2; x < SPRITE_W - 2; x++) area.push([x, y]);
  const rng = makeRng(4242);
  const out = new Map();
  const mark = (x, y, r = 'a') => out.set(x + ',' + y, r);
  switch (type) {
    case 'spots': for (let i = 0; i < 6; i++) { const [x, y] = rng.pick(area); mark(x, y); mark(x + 1, y); mark(x, y + 1); mark(x + 1, y + 1); } break;
    case 'stripes': for (const [x, y] of area) if ((x + Math.floor(y / 3)) % 4 === 0) mark(x, y, 'm'); break;
    case 'speckles': for (const [x, y] of area) if (rng.chance(0.13)) mark(x, y); break;
    case 'rings': for (const [x, y] of area) { const d = Math.round(Math.hypot(x - CX, (y - CAP_BOTTOM) * 1.3)); if (d % 4 === 0) mark(x, y, 'm'); } break;
    case 'patches': for (let i = 0; i < 3; i++) { const [cx, cy] = rng.pick(area); for (const [x, y] of area) if (Math.hypot(x - cx, y - cy) < 2.4) mark(x, y, 'm'); } break;
    case 'constellation': {
      const stars = [[7, 5], [11, 3], [15, 7], [17, 10]];
      for (let i = 0; i < stars.length - 1; i++) {
        const [x0, y0] = stars[i];
        const [x1, y1] = stars[i + 1];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let k = 1; k < n; k++) mark(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 'w');
      }
      for (const [x, y] of stars) mark(x, y, 'y');
      break;
    }
    default: break;
  }
  return gridRows(SPRITE_W, SPRITE_H, (x, y) => out.get(x + ',' + y));
}

/** Gills: two rows under the cap — the underside, and anything hanging below it. */
export function defaultGillRoles(type) {
  const row0 = (x) => ({ fine: x % 2 ? 'g' : 'k', deep: 'k', pored: x % 3 === 0 ? 'k' : 'g', ridged: x % 2 === 0 ? 'L' : 'k', toothed: 'g', velvet: 'v' }[type] || 'g');
  const row1 = (x) => (type === 'deep' ? (x % 2 ? 'k' : null) : type === 'toothed' ? (x % 3 === 1 ? 'k' : null) : null);
  return [gridRows(SPRITE_W, 1, (x) => row0(x))[0], gridRows(SPRITE_W, 1, (x) => row1(x))[0]];
}

const tintCache = new Map();
function tinted(sil, rgb) {
  const key = sil.__id || (sil.__id = Math.random().toString(36).slice(2));
  const k = key + rgb.join(',');
  if (tintCache.has(k)) return tintCache.get(k);
  const c = makeCanvas(sil.width, sil.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(sil, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = css(rgb);
  ctx.fillRect(0, 0, c.width, c.height);
  tintCache.set(k, c);
  if (tintCache.size > 300) tintCache.delete(tintCache.keys().next().value);
  return c;
}

const GLOW_LEVEL = { none: 0, faint: 0.18, soft: 0.3, pulse: 0.3, radiant: 0.5 };

/**
 * Draw a mushroom with effects at (x, y) = top-left in the context's logical
 * pixel space. t = time in seconds. opts: { mutationVisual, bob, reducedMotion }
 */
export function drawMushroom(ctx, m, x, y, t = 0, opts = {}) {
  const spr = mushroomSprite(m);
  const rm = opts.reducedMotion;
  // smooth: sub-pixel positions (forest camera); otherwise snap to whole pixels (UI cards)
  const snap = opts.smooth ? (v) => v : Math.round;
  const bob = rm ? 0 : opts.bob || 0;
  const size = opts.size ?? 1;
  const sx = opts.squish?.sx ?? 1;
  const sy = opts.squish?.sy ?? 1;
  // everything is drawn in a frame anchored at the mushroom's feet, scaled by `size`
  ctx.save();
  ctx.translate(snap(x) + SPRITE_W / 2, snap(y + bob) + SPRITE_H);
  ctx.scale(size, size);
  // shadow stays on the ground and widens as the mushroom squashes
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(-6 * sx, -2 - bob, 12 * sx, 2);
  ctx.fillRect(-7 * sx, -1 - bob, 14 * sx, 1);
  // ordinary glow
  let lvl = GLOW_LEVEL[m.genes.glow] || 0;
  if (lvl) {
    if (m.genes.glow === 'pulse' && !rm) lvl *= 0.6 + 0.4 * Math.sin(t * 3);
    const gy = -(SPRITE_H - 9) * sy;
    const grd = ctx.createRadialGradient(0, gy, 2, 0, gy, 16);
    grd.addColorStop(0, css(shade(spr.capColor, 0.5), lvl));
    grd.addColorStop(1, css(spr.capColor, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(-16, gy - 16, 32, 32);
  }
  const mv = opts.mutationVisual;
  ctx.save();
  ctx.scale(opts.flip ? -sx : sx, sy);
  if (mv && (mv.kind === 'outline' || mv.kind === 'prism')) {
    const pulse = rm ? 0.8 : 0.55 + 0.45 * Math.sin(t * 2.5);
    const col = mv.kind === 'prism' ? hueRgb((t * 90) % 360) : mv.color;
    ctx.globalAlpha = pulse;
    ctx.drawImage(tinted(spr.silhouette, col), -SPRITE_W / 2 - 1, -SPRITE_H - 1);
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(spr.canvas, -SPRITE_W / 2, -SPRITE_H);
  ctx.restore();
  if (mv) drawParticles(ctx, mv, -SPRITE_W / 2, -SPRITE_H * sy, t, rm, m.genes.pattern);
  ctx.restore();
}

function hueRgb(h) {
  const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (0.75 - 0.35 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}

function drawParticles(ctx, mv, x, y, t, rm, seed) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const ph = i / n + (seed % 97) / 97;
    let px;
    let py;
    let a = 1;
    if (mv.kind === 'stars') {
      const ang = (rm ? 0 : t * 0.9) + ph * Math.PI * 2;
      px = x + 12 + Math.cos(ang) * 13;
      py = y + 10 + Math.sin(ang) * 6;
      a = rm ? 1 : 0.5 + 0.5 * Math.sin(t * 5 + i);
      ctx.fillStyle = css(mv.color, a);
      ctx.fillRect((px), (py) - 1, 1, 3);
      ctx.fillRect((px) - 1, (py), 3, 1);
      continue;
    } else if (mv.kind === 'spores') {
      const life = rm ? ph : (t * 0.35 + ph) % 1;
      px = x + 4 + ((i * 7 + seed) % 16) + Math.sin(t * 2 + i) * 1.5;
      py = y + 14 - life * 18;
      a = 1 - life;
    } else if (mv.kind === 'prism') {
      const ang = (rm ? 0 : t * 1.4) + ph * Math.PI * 2;
      px = x + 12 + Math.cos(ang) * 12;
      py = y + 8 + Math.sin(ang * 2) * 4;
      ctx.fillStyle = css(hueRgb((ang * 57) % 360), 0.85);
      ctx.fillRect((px), (py), 1, 1);
      continue;
    } else {
      const life = rm ? ph : (t * 0.5 + ph) % 1;
      px = x + 3 + ((i * 5 + seed) % 18);
      py = y + 16 - life * 14;
      a = 0.7 * (1 - life);
    }
    ctx.fillStyle = css(mv.color, a);
    ctx.fillRect((px), (py), 1, 1);
  }
}

/**
 * A mushroom in its own canvas for the UI, shown at `scale` × 65% of its sprite
 * size and rendered at device resolution so the pixels stay crisp.
 */
export function mushroomCanvas(m, scale = 3, opts = {}) {
  const { canvas, ctx } = spriteCanvas(SPRITE_W + 8, SPRITE_H + 4, scale);
  ctx.imageSmoothingEnabled = false;
  drawMushroom(ctx, m, 4, 2, 0.6, opts);
  return canvas;
}

/** A canvas for drawing a mushroom of logical size w × h at `scale` × 65% (backed at device resolution). */
export function spriteCanvas(w, h, scale, className = 'sprite') {
  const k = scale * MUSHROOM_SCALE;
  const dpr = Math.max(1, Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  const c = makeCanvas(Math.round(w * k * dpr), Math.round(h * k * dpr));
  c.className = className;
  c.style.width = `${w * k}px`;
  c.style.height = `${h * k}px`;
  const ctx = c.getContext('2d');
  ctx.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx, k: k * dpr };
}

// ---------- resource icon (small CSS dot) ----------
export function resourceColor(id) {
  if (id === 'glimmer') return '#ffd75e';
  return RESOURCES[id]?.color || '#ccc';
}
