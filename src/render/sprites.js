// Procedural pixel-art mushrooms built from modular gene layers (GDD 17).
//
// A mushroom is assembled from parts: the stem (which also sets how high the
// cap sits), the cap (shaded per lobe with a top-left light), markings in the
// mushroom's second colour, the underside, and a face. Cap and marking masks
// are made in a reference frame with the cap's bottom on row REF_CB and moved
// to wherever the stem puts the cap.
import { shade, mix, css } from '../core/color.js';
import { makeRng, hash } from '../core/rng.js';
import { RESOURCES } from '../content/world.js';

export const SPRITE_W = 30;
export const SPRITE_H = 36;
// mushrooms are shown at 65% of their sprite size, in the forest and on screens
export const MUSHROOM_SCALE = 0.65;
const CX = 15;
/** Lowest row of a stem (the mushroom's feet). */
export const GROUND = 33;
/** Where a cap's bottom row sits in the reference frame used by part masks. */
export const REF_CB = 22;
/** How tall each stem is (rows from under the cap to the ground). */
export const STEM_LENGTH = { sturdy: 11, slender: 13, bulbous: 11, rooted: 11, ringed: 12, twisted: 12, crystal: 12, lanky: 15, stubby: 5, warty: 10 };
const REF_EYE = REF_CB + 4;

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

/** Each character of a mushroom-part mask names a colour role ('.' = empty). */
export const PART_ROLES = {
  cap: { h: 'highlight', l: 'light', b: 'cap colour', d: 'shade', D: 'deep shade' },
  stem: { s: 'stem colour', h: 'stem light', k: 'stem shade', r: 'ring', c: 'crystal', w: 'wart (second colour)', W: 'wart glint' },
  face: { e: 'eye', p: 'blush' },
  marking: { a: 'second colour', m: 'soft second colour', w: 'pale glint', y: 'star' },
  gills: { g: 'gill colour', k: 'gill shade', L: 'gill highlight', v: 'velvet', i: 'ink' },
};
const roleAt = (ov, x, y) => (ov.rows[y] && ov.rows[y][x] !== undefined && ov.rows[y][x] !== '.' ? ov.rows[y][x] : null);

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const has = (m, x, y) => m.has(x + ',' + y);
const pts = (m) => [...m].map((k) => k.split(',').map(Number));

// ---------- cap masks (reference frame: bottom row = REF_CB) ----------

function capMask(type) {
  const m = new Set();
  const CB = REF_CB;
  const add = (x, y) => { if (x >= 0 && x < SPRITE_W && y >= 0 && y < SPRITE_H) m.add(x + ',' + y); };
  const ell = (cx, cy, rx, ry, yMax = 99, yMin = -99) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      if (y > yMax || y < yMin) continue;
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) add(x, y);
      }
    }
  };
  const bell = (cx, bottom, hw, h, p = 0.7) => {
    const y0 = Math.round(bottom - h);
    for (let y = y0; y <= Math.round(bottom); y++) {
      const t = (y - y0) / (Math.round(bottom) - y0);
      const half = 1.2 + hw * Math.pow(t, p);
      for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) add(x, y);
    }
  };
  switch (type) {
    case 'flatcap':
      ell(CX, CB - 2.5, 11.5, 4); ell(CX, CB - 5, 4, 2);
      break;
    case 'bellcap':
      for (let y = CB - 11; y <= CB; y++) {
        const t = (y - (CB - 11)) / 11;
        const hw = 3.2 + 7 * Math.pow(t, 0.8) + (y >= CB - 1 ? 1 : 0);
        for (let x = Math.round(CX - hw); x < Math.round(CX + hw); x++) add(x, y);
      }
      ell(CX, CB - 9.5, 3.5, 2.5);
      break;
    case 'wavycap':
      ell(CX, CB - 1, 11, 8, CB - 2);
      for (let x = 3; x < 26; x++) { const d = Math.round(Math.sin((x - 2) * 0.9) * 1.2 + 1.2); for (let y = CB - 2; y <= CB - 2 + d; y++) add(x, y); }
      break;
    case 'conecap':
      for (let y = CB - 12; y <= CB; y++) {
        const hw = 0.8 + (y - (CB - 12)) * 0.82;
        for (let x = Math.round(CX - hw); x < Math.round(CX + hw); x++) add(x, y);
      }
      break;
    case 'clustercap':
      ell(CX - 5.5, CB - 2, 5.5, 4.5, CB); ell(CX + 5.5, CB - 2, 5.5, 4.5, CB); ell(CX, CB - 6, 6.5, 6, CB - 1);
      break;
    case 'shelfcap':
      ell(CX + 1, CB - 2, 10.5, 4, CB); ell(CX - 2, CB - 6.5, 7, 3.2);
      break;
    case 'frillcap':
      ell(CX, CB - 1, 10, 9, CB - 2);
      for (let x = 3; x < 25; x++) { add(x, CB - 1); if (x % 2 === 0) add(x, CB); }
      break;
    case 'lanterncap':
      for (let y = CB - 11; y <= CB; y++) {
        const corner = y === CB - 11 || y === CB ? 2 : y === CB - 10 || y === CB - 1 ? 1 : 0;
        for (let x = CX - 7 + corner; x < CX + 7 - corner; x++) add(x, y);
      }
      add(CX - 1, CB - 12); add(CX, CB - 12); add(CX - 1, CB - 13); add(CX, CB - 13);
      break;
    case 'spirecap':
      for (let y = CB - 14; y <= CB; y++) {
        const t = (y - (CB - 14)) / 14;
        const hw = 0.6 + 7.5 * Math.pow(t, 2.1);
        for (let x = Math.round(CX - hw); x < Math.round(CX + hw); x++) add(x, y);
      }
      break;
    case 'tuftcap':
      // a tuft of glassy bells: a tall one in the middle, two on their own stalks
      bell(CX, CB, 4.6, 7);
      bell(CX - 9, CB + 5, 3.2, 5);
      bell(CX + 8.5, CB + 2, 3.4, 5.5);
      break;
    case 'lumpcap':
      // a low, lumpy crust
      ell(CX, CB - 3.5, 9, 6.5, CB + 1); ell(CX - 6.5, CB - 1, 5.5, 4.5, CB + 1); ell(CX + 7, CB - 0.5, 5, 4.5, CB + 1);
      ell(CX - 2.5, CB - 8.5, 4.5, 3.5); ell(CX + 4, CB - 7.5, 4, 3.5); ell(CX + 9.5, CB - 3.5, 2.5, 2.5);
      break;
    case 'tiltcap': {
      // a wide dome worn at an angle, showing its underside on one side
      const a = -0.33;
      const cx = CX + 0.5;
      const cy = CB - 1.5;
      for (let y = CB - 14; y <= CB + 4; y++) {
        for (let x = 0; x < SPRITE_W; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const u = dx * Math.cos(a) + dy * Math.sin(a);
          const v = -dx * Math.sin(a) + dy * Math.cos(a);
          if ((u / 11.5) ** 2 + (v / 9) ** 2 <= 1 && v <= 1.2) add(x, y);
        }
      }
      break;
    }
    case 'inkcap':
      // a tall shaggy bullet with a ragged hem
      for (let y = CB - 17; y <= CB; y++) {
        const t = (y - (CB - 17)) / 17;
        const hw = 1.6 + 6.2 * Math.pow(t, 0.45);
        for (let x = Math.round(CX - hw); x < Math.round(CX + hw); x++) add(x, y);
      }
      for (let x = CX - 7; x < CX + 7; x++) if ((x * 5) % 3 === 0) add(x, CB + 1);
      break;
    case 'roundcap':
    default:
      ell(CX, CB - 0.5, 10.5, 10, CB - 1);
      for (let x = 4; x < 26; x++) add(x, CB);
  }
  return m;
}

// stalks under the tuft's side bells (reference frame), drawn down to the ground
const TUFT_STALKS = [{ x: CX - 10, top: REF_CB + 6 }, { x: CX + 8, top: REF_CB + 3 }];

/** Where the cap sits for a stem (its bottom row in the sprite). */
function capBottomFor(capType, stemType, stemOv) {
  if (capType === 'lumpcap') return GROUND - 2;
  let cb;
  if (stemOv) {
    let top = GROUND;
    for (let y = 0; y < SPRITE_H; y++) if (stemOv.rows[y] && /[^.]/.test(stemOv.rows[y])) { top = y; break; }
    cb = top + 1;
  } else cb = GROUND - (STEM_LENGTH[stemType] ?? 12);
  // a tuft's side bells need room for their stalks
  if (capType === 'tuftcap') cb = Math.min(cb, REF_CB);
  return cb;
}

// ---------- stem masks (sprite frame) ----------

function stemShape(type, cb) {
  const m = new Set();
  const add = (x, y) => m.add(x + ',' + y);
  const top = cb - 1;
  const len = GROUND - top;
  const ringRow = top + Math.round(len * 0.4);
  for (let y = top; y <= GROUND; y++) {
    const t = (y - top) / len;
    let hw = 3;
    let off = 0;
    switch (type) {
      case 'sturdy': hw = 4; break;
      case 'slender': hw = 2; break;
      case 'bulbous': hw = y > GROUND - 6 ? 3 + Math.min(2, (y - (GROUND - 6)) * 0.7) - (y === GROUND ? 1 : 0) : 3; break;
      case 'ringed': hw = y === ringRow || y === ringRow + 1 ? 5 : 3; break;
      case 'twisted': hw = 2.5; off = Math.round(Math.sin(y * 0.6) * 1.2); break;
      case 'lanky': hw = y >= GROUND - 1 ? 2.5 : 1.5; break;
      case 'stubby': hw = 4 + (y === GROUND ? 0.5 : 0); break;
      case 'warty': hw = 3.2 + 1.6 * Math.sin(Math.PI * Math.min(1, t * 1.1)); break;
      default: hw = 3;
    }
    for (let x = Math.round(CX - hw + off); x < Math.round(CX + hw + off); x++) add(x, y);
  }
  if (type === 'rooted') { add(CX - 4, GROUND); add(CX - 5, GROUND + 1); add(CX + 3, GROUND); add(CX + 4, GROUND + 1); add(CX - 1, GROUND + 1); }
  return { m, top, ringRow };
}

// warts on a warty stem: [dx, rows below the stem top]
const WARTS = [[-6, 3], [4, 4.5], [-6, 7.5], [4, 8.5], [-2, 10.5], [1, 1.5]];

/** Colour roles for a stem whose cap sits on row cb. */
function stemRoleMap(type, cb) {
  const { m, top, ringRow } = stemShape(type, cb);
  const roles = new Map();
  for (const [x, y] of pts(m)) {
    let r = 's';
    if (!has(m, x + 1, y) || y >= GROUND - 1 || y <= top + 1) r = 'k';
    else if (!has(m, x - 1, y)) r = 'h';
    roles.set(x + ',' + y, r);
  }
  if (type === 'ringed') for (let x = CX - 5; x < CX + 5; x++) roles.set(x + ',' + (ringRow + 1), 'r');
  if (type === 'crystal') for (const [dx, dy] of [[-1, 5], [1, 7], [-2, 9], [0, 10]]) roles.set((CX + dx) + ',' + (top + dy), 'c');
  if (type === 'warty') {
    for (const [dx, dy] of WARTS) {
      const y = top + Math.round(dy * (GROUND - top) / 11);
      if (y >= GROUND - 1) continue;
      const x = CX + dx;
      // keep the face clear
      if (y >= cb + 1 && y <= cb + 7 && x + 1 >= CX - 3 && x <= CX + 2) continue;
      roles.set(x + ',' + (y - 1), 'W'); roles.set((x + 1) + ',' + (y - 1), 'w');
      roles.set(x + ',' + y, 'w'); roles.set((x + 1) + ',' + y, 'w');
    }
  }
  return roles;
}

// ---------- cap shading ----------

/** Split a mask into its connected lobes. */
function components(mask) {
  const seen = new Set();
  const out = [];
  for (const k of mask) {
    if (seen.has(k)) continue;
    const comp = [];
    const stack = [k];
    seen.add(k);
    while (stack.length) {
      const c = stack.pop();
      comp.push(c);
      const [x, y] = c.split(',').map(Number);
      for (const n of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const nk = n.join(',');
        if (mask.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
      }
    }
    out.push(comp.map((c) => c.split(',').map(Number)));
  }
  return out;
}

/** Colour roles for a cap: light from the top left, a dark hem, a soft shaded right side. */
function capRoleMap(mask) {
  const roles = new Map();
  for (const comp of components(mask)) {
    let minX = 99; let maxX = -1; let top = 99; let bot = -1;
    for (const [x, y] of comp) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); top = Math.min(top, y); bot = Math.max(bot, y); }
    const w = maxX - minX + 1;
    const h = bot - top + 1;
    const hx = minX + w * 0.32;
    const hy = top + h * 0.28;
    const r = Math.max(1.2, Math.min(w, h) * 0.17);
    const tall = h > w * 0.9;
    for (const [x, y] of comp) {
      const nx = (x - minX + 0.5) / w;
      const ny = (y - top + 0.5) / h;
      const d = Math.hypot(x + 0.5 - hx, (y + 0.5 - hy) * 1.25);
      const check = (x + y) % 2 === 0;
      let role = 'b';
      if (!mask.has(x + ',' + (y + 1))) role = 'D';
      else if (d < r) role = 'h';
      else if (d < r * 1.7 || (d < r * 2.3 && check)) role = 'l';
      else if (!mask.has((x + 1) + ',' + y) || nx > 0.8 || (tall && ny > 0.7)) role = 'd';
      else if ((nx > 0.62 && ny > 0.45 && check) || (tall && ny > 0.5 && check)) role = 'd';
      roles.set(x + ',' + y, role);
    }
  }
  return roles;
}

const capColours = (c) => ({
  h: mix(shade(c, 0.45), [255, 248, 220], 0.15),
  l: shade(c, 0.2),
  b: c,
  d: mix(shade(c, -0.28), [70, 30, 110], 0.12),
  D: mix(shade(c, -0.5), [50, 20, 90], 0.18),
});

const stemColours = (s, accent) => ({
  s, h: shade(s, 0.18), k: mix(shade(s, -0.25), [60, 40, 70], 0.1), r: shade(s, -0.12), c: [150, 230, 255],
  w: accent, W: mix(accent, [255, 255, 255], 0.55),
});

/** Colours for every part role, for a cap colour, second colour and stem colour (used by the Sprite Workshop too). */
export function partColours(capC, accent, stemC) {
  const g = shade(mix(stemC, capC, 0.25), -0.15);
  return {
    cap: capColours(capC),
    stem: stemColours(stemC, accent),
    face: { e: [40, 26, 30], p: [240, 150, 150] },
    marking: { a: accent, m: mix(accent, capC, 0.3), w: mix(accent, [255, 255, 255], 0.55), y: [255, 250, 210] },
    gills: { g, k: shade(g, -0.3), L: shade(g, 0.2), v: mix(g, [255, 220, 230], 0.3), i: mix(shade(capC, -0.6), [24, 18, 40], 0.6) },
  };
}

// ---------- composition ----------

export function mushroomSprite(m) {
  const g = m.genes;
  const key = JSON.stringify([g.cap, g.stem, g.markings, g.gills, g.glow, g.color, g.accent, g.stemColor, g.pattern]);
  if (cache.has(key)) return cache.get(key);

  const W = SPRITE_W;
  const H = SPRITE_H;
  const px = new Array(W * H).fill(null);
  const part = new Array(W * H).fill(null);
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x, y, c, p) => { if (inside(x, y)) { px[y * W + x] = c; part[y * W + x] = p; } };
  const capOv = spriteOverride('cap:' + g.cap);
  const stemOv = spriteOverride('stem:' + g.stem);
  const faceOv = spriteOverride('face:default');
  const markOv = spriteOverride('marking:' + g.markings);
  const gillOv = spriteOverride('gills:' + g.gills);
  const rng = makeRng(g.pattern + 17);

  const capC = g.color;
  const accent = g.accent;
  const stemC = g.stemColor;
  const CC = capColours(capC);
  const SC = stemColours(stemC, accent);

  // where everything sits
  const cb = capBottomFor(g.cap, g.stem, stemOv);
  const dy = cb - REF_CB;
  const shift = (mask) => { const o = new Set(); for (const [x, y] of pts(mask)) if (inside(x, y + dy)) o.add(x + ',' + (y + dy)); return o; };

  // cap mask and roles (reference frame), moved into place
  let capRoles;
  if (capOv) {
    capRoles = new Map();
    for (let y = 0; y < Math.min(H, capOv.rows.length); y++) for (let x = 0; x < W; x++) { const r = roleAt(capOv, x, y); if (r) capRoles.set(x + ',' + y, r); }
  } else capRoles = capRoleMap(capMask(g.cap));
  const cap = new Set();
  const capRole = new Map();
  for (const [k, r] of capRoles) { const [x, y] = k.split(',').map(Number); if (inside(x, y + dy)) { cap.add(x + ',' + (y + dy)); capRole.set(x + ',' + (y + dy), r); } }

  // stem: drawn at its own length, then trimmed to the cap's underside or stretched up to it
  let stemRoles;
  if (stemOv) {
    stemRoles = new Map();
    for (let y = 0; y < Math.min(H, stemOv.rows.length); y++) for (let x = 0; x < W; x++) { const r = roleAt(stemOv, x, y); if (r) stemRoles.set(x + ',' + y, r); }
  } else stemRoles = stemRoleMap(g.stem, GROUND - (STEM_LENGTH[g.stem] ?? 12));
  {
    let sTop = H;
    for (const k of stemRoles.keys()) sTop = Math.min(sTop, Number(k.split(',')[1]));
    const topRow = [...stemRoles].filter(([k]) => Number(k.split(',')[1]) === sTop).map(([k, r]) => [Number(k.split(',')[0]), r]);
    for (const k of [...stemRoles.keys()]) if (Number(k.split(',')[1]) < cb - 1) stemRoles.delete(k);
    for (let y = cb - 1; y < sTop; y++) for (const [x, r] of topRow) stemRoles.set(x + ',' + y, r);
  }
  const stem = new Set(stemRoles.keys());
  for (const [k, r] of stemRoles) { const [x, y] = k.split(',').map(Number); set(x, y, SC[r] || stemC, 'stem'); }
  // the tuft's side bells stand on stalks of their own
  if (g.cap === 'tuftcap') {
    for (const s of TUFT_STALKS) {
      for (let y = s.top + dy; y <= GROUND; y++) {
        set(s.x, y, y <= s.top + dy || y >= GROUND - 1 ? SC.k : SC.h, 'stem'); set(s.x + 1, y, SC.k, 'stem');
        stem.add(s.x + ',' + y); stem.add((s.x + 1) + ',' + y);
      }
    }
  }

  // cap
  let top = 99;
  let minX = 99;
  let maxX = -1;
  for (const [x, y] of pts(cap)) { top = Math.min(top, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  for (const [k, r] of capRole) { const [x, y] = k.split(',').map(Number); set(x, y, CC[r] || capC, 'cap'); }

  // markings, in the second colour
  const capPts = pts(cap).filter(([x, y]) => has(cap, x, y - 1) && has(cap, x, y + 1) && has(cap, x - 1, y) && has(cap, x + 1, y));
  const hem = (x, y) => !has(cap, x, y + 1);
  const mark = (x, y, c = accent) => { if (has(cap, x, y) && !hem(x, y)) set(x, y, c, 'cap'); };
  const soft = mix(accent, capC, 0.3);
  const glint = mix(accent, [255, 255, 255], 0.55);
  if (markOv) {
    // an edited marking is a stamp, moved with the cap and clipped to its inside
    const col = { a: accent, m: soft, w: glint, y: [255, 250, 210] };
    const ins = new Set(capPts.map(([x, y]) => x + ',' + y));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = roleAt(markOv, x, y); if (r && col[r] && ins.has(x + ',' + (y + dy))) set(x, y + dy, col[r], 'cap'); }
  } else {
    const nSpots = Math.max(3, Math.round(capPts.length / 45));
    switch (g.markings) {
      case 'spots':
        for (let i = 0; i < nSpots; i++) {
          const [x, y] = rng.pick(capPts) || [CX, cb - 6];
          mark(x, y); mark(x + 1, y); mark(x, y + 1); mark(x + 1, y + 1);
        }
        break;
      case 'stripes':
        for (const [x, y] of capPts) if ((x + Math.floor(y / 3)) % 4 === 0) mark(x, y, mix(accent, capC, 0.2));
        break;
      case 'speckles':
        for (const [x, y] of capPts) if (rng.chance(0.13)) mark(x, y);
        break;
      case 'rings':
        for (const [x, y] of capPts) { const d = Math.round(Math.hypot(x - CX, (y - cb) * 1.3)); if (d % 4 === 0) mark(x, y, mix(accent, capC, 0.2)); }
        break;
      case 'patches':
        for (let i = 0; i < 3; i++) {
          const [cx, cy] = rng.pick(capPts) || [CX, cb - 6];
          for (const [x, y] of capPts) if (Math.hypot(x - cx, y - cy) < 2.4) mark(x, y, soft);
        }
        break;
      case 'constellation': {
        const stars = Array.from({ length: 4 }, () => rng.pick(capPts) || [CX, cb - 6]);
        for (let i = 0; i < stars.length - 1; i++) {
          const [x0, y0] = stars[i];
          const [x1, y1] = stars[i + 1];
          const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let s = 1; s < n; s++) mark(Math.round(x0 + ((x1 - x0) * s) / n), Math.round(y0 + ((y1 - y0) * s) / n), soft);
        }
        for (const [x, y] of stars) mark(x, y, glint);
        break;
      }
      case 'beads': {
        // glossy droplets that bulge past the cap's edge
        const all = pts(cap).filter(([x, y]) => !hem(x, y));
        const n = Math.max(6, Math.round(all.length / 16));
        const dark = shade(accent, -0.42);
        const SMALL = [[0, 0, glint], [1, 0, accent], [0, 1, accent], [1, 1, dark]];
        const BIG = [[0, -1, accent], [1, -1, accent], [-1, 0, accent], [0, 0, glint], [1, 0, accent], [2, 0, accent], [-1, 1, accent], [0, 1, accent], [1, 1, accent], [2, 1, dark], [0, 2, dark], [1, 2, dark]];
        for (let i = 0; i < n; i++) {
          const [x, y] = rng.pick(all) || [CX, cb - 6];
          const bead = rng.chance(0.45) ? BIG : SMALL;
          for (const [ox, oy, c] of bead) {
            const bx = x + ox;
            const by = y + oy;
            const near = has(cap, bx, by) || has(cap, bx, by + 1) || has(cap, bx - 1, by) || has(cap, bx + 1, by);
            if (near && !hem(bx, by) && (has(cap, bx, by) || !has(stem, bx, by))) set(bx, by, c, 'cap');
          }
        }
        break;
      }
      case 'shaggy':
        // rows of ragged upturned scales
        for (let y = top + 2; y < cb - 1; y += 3) {
          const off = ((y - top) / 3) % 2 ? 2 : 0;
          for (let x = minX + 1 + off; x <= maxX - 1; x += 4) {
            if (!has(cap, x, y) || !has(cap, x - 1, y - 1) || !has(cap, x + 1, y - 1)) continue;
            mark(x, y, accent); mark(x - 1, y - 1, soft); mark(x + 1, y - 1, soft);
          }
        }
        break;
      case 'gloss':
        // a wet shine along each lobe's upper-left edge, tinted by the second colour
        for (const [x, y] of pts(cap)) {
          if (hem(x, y)) continue;
          const edge = !has(cap, x - 1, y - 1) && (!has(cap, x - 1, y) || !has(cap, x, y - 1));
          if (edge && capRole.get(x + ',' + y) !== 'd' && capRole.get(x + ',' + y) !== 'D') {
            set(x, y, glint, 'cap');
            if (has(cap, x + 1, y + 1) && !hem(x + 1, y + 1)) set(x + 1, y + 1, mix(accent, capC, 0.45), 'cap');
          }
        }
        for (const comp of components(cap)) {
          let cx0 = 99; let cy0 = 99; let cx1 = -1;
          for (const [x, y] of comp) { cx0 = Math.min(cx0, x); cy0 = Math.min(cy0, y); cx1 = Math.max(cx1, x); }
          const sx = Math.round(cx0 + (cx1 - cx0) * 0.62);
          const sy = cy0 + 2;
          if (has(cap, sx, sy) && !hem(sx, sy)) set(sx, sy, [255, 255, 255], 'cap');
        }
        break;
      default:
        break;
    }
  }

  // underside: gills (and drips) under each column of cap
  const gillBase = shade(mix(stemC, capC, 0.25), -0.15);
  const GC = { g: gillBase, k: shade(gillBase, -0.3), L: shade(gillBase, 0.2), v: mix(gillBase, [255, 220, 230], 0.3), i: mix(shade(capC, -0.6), [24, 18, 40], 0.6) };
  for (let x = minX + 1; x < maxX; x++) {
    let y = -1;
    for (let yy = H - 1; yy >= 0; yy--) if (has(cap, x, yy)) { y = yy; break; }
    if (y < 0) continue;
    const under = y + 1;
    if (has(cap, x, under) || under > GROUND) continue;
    const put = (yy, r) => {
      if (!r || !GC[r] || yy > GROUND || has(cap, x, yy)) return;
      if (has(stem, x, yy) && (yy > under || r === 'v' || r === 'i')) return;
      set(x, yy, GC[r], 'cap');
    };
    if (gillOv) { for (let k = 0; k < 4; k++) put(under + k, roleAt(gillOv, x, k)); continue; }
    const rows = gillColumn(g.gills, x);
    rows.forEach((r, k) => put(under + k, r));
  }

  // face: on the stem, or on the cap when the stem hides beneath it
  let vt = cb;
  while (vt <= GROUND && part[vt * W + CX] !== 'stem') vt++;
  const onCap = g.cap === 'lumpcap' || GROUND - vt < 4;
  const eyeY = onCap ? cb - 4 : vt + Math.min(5, Math.max(1, Math.round((GROUND - vt) * 0.3)));
  const body = (x, y) => (onCap ? has(cap, x, y) : has(stem, x, y));
  const faceCol = { e: [40, 26, 30], p: [240, 150, 150] };
  if (faceOv) {
    const fdy = eyeY - REF_EYE;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = roleAt(faceOv, x, y); if (r && faceCol[r] && body(x, y + fdy)) set(x, y + fdy, faceCol[r], onCap ? 'cap' : 'stem'); }
  } else {
    let wl = 0;
    while (body(CX - wl - 1, eyeY)) wl++;
    let wr = 0;
    while (body(CX + wr + 1, eyeY)) wr++;
    const narrow = wl + wr < 5;
    const ex = narrow ? [CX - 1, CX + 1] : [CX - 2, CX + 1];
    for (const x of ex) { if (body(x, eyeY)) set(x, eyeY, faceCol.e, 'face'); if (body(x, eyeY - 1)) set(x, eyeY - 1, faceCol.e, 'face'); }
    if (!narrow) for (const x of [ex[0] - 1, ex[1] + 1]) if (body(x, eyeY + 1)) set(x, eyeY + 1, faceCol.p, 'face');
  }

  // outline: dark cap edge around the cap, dark stem edge around the stem
  const capLine = mix(shade(capC, -0.72), [20, 10, 34], 0.45);
  const stemLine = mix(shade(stemC, -0.7), [24, 16, 30], 0.4);
  const filled = (x, y) => inside(x, y) && px[y * W + x] !== null;
  const out = px.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (filled(x, y)) continue;
    const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => filled(a, b));
    if (!nb.length) continue;
    out[y * W + x] = nb.some(([a, b]) => part[b * W + a] === 'cap') ? capLine : stemLine;
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
  const res = { canvas: c, silhouette: sil, capColor: capC, top, capMid: Math.round((top + cb) / 2), dy, faceDy: eyeY - REF_EYE };
  cache.set(key, res);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return res;
}

/** Underside roles for one column: [right under the cap, then up to three rows hanging below]. */
function gillColumn(type, x) {
  switch (type) {
    case 'fine': return [x % 2 ? 'g' : 'k'];
    case 'deep': return ['k', x % 2 ? 'k' : null];
    case 'pored': return [x % 3 === 0 ? 'k' : 'g'];
    case 'ridged': return [x % 2 === 0 ? 'L' : 'k'];
    case 'toothed': return ['g', x % 3 === 1 ? 'k' : null];
    case 'velvet': return ['v'];
    case 'inky': {
      // ink gathers along the hem and drips
      const h = hash('ink', x) % 7;
      const len = h < 3 ? 0 : h < 5 ? 1 : h < 6 ? 2 : 3;
      return ['i', ...Array.from({ length: len }, () => 'i')];
    }
    default: return ['g'];
  }
}

// ---------- defaults for the Sprite Workshop (role masks from the procedural rules) ----------

function gridRows(w, h, fn) {
  const rows = [];
  for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += fn(x, y) || '.'; rows.push(r); }
  return rows;
}

/** A cap in the reference frame (its bottom on row REF_CB); the stem decides where it ends up. */
export function defaultCapRoles(type) {
  const roles = capRoleMap(capMask(type));
  return gridRows(SPRITE_W, SPRITE_H, (x, y) => roles.get(x + ',' + y));
}

/** A stem, drawn where it stands; its top row decides how high the cap sits. */
export function defaultStemRoles(type) {
  const roles = stemRoleMap(type, GROUND - (STEM_LENGTH[type] ?? 12));
  return gridRows(SPRITE_W, SPRITE_H, (x, y) => roles.get(x + ',' + y));
}

/** The face, for a cap in the reference frame; it moves with the stem. */
export function defaultFaceRoles() {
  const e = new Set([[CX - 2, REF_EYE], [CX + 1, REF_EYE], [CX - 2, REF_EYE - 1], [CX + 1, REF_EYE - 1]].map((p) => p.join(',')));
  const p = new Set([[CX - 3, REF_EYE + 1], [CX + 2, REF_EYE + 1]].map((q) => q.join(',')));
  return gridRows(SPRITE_W, SPRITE_H, (x, y) => (e.has(x + ',' + y) ? 'e' : p.has(x + ',' + y) ? 'p' : null));
}

/** A marking stamp in the reference frame: the procedural pattern laid over the cap area (one fixed layout). */
export function defaultMarkingRoles(type) {
  const area = [];
  for (let y = 2; y < REF_CB - 1; y++) for (let x = 3; x < SPRITE_W - 3; x++) area.push([x, y]);
  const rng = makeRng(4242);
  const out = new Map();
  const mark = (x, y, r = 'a') => out.set(x + ',' + y, r);
  switch (type) {
    case 'spots': for (let i = 0; i < 7; i++) { const [x, y] = rng.pick(area); mark(x, y); mark(x + 1, y); mark(x, y + 1); mark(x + 1, y + 1); } break;
    case 'stripes': for (const [x, y] of area) if ((x + Math.floor(y / 3)) % 4 === 0) mark(x, y, 'm'); break;
    case 'speckles': for (const [x, y] of area) if (rng.chance(0.13)) mark(x, y); break;
    case 'rings': for (const [x, y] of area) { const d = Math.round(Math.hypot(x - CX, (y - REF_CB) * 1.3)); if (d % 4 === 0) mark(x, y, 'm'); } break;
    case 'patches': for (let i = 0; i < 3; i++) { const [cx, cy] = rng.pick(area); for (const [x, y] of area) if (Math.hypot(x - cx, y - cy) < 2.4) mark(x, y, 'm'); } break;
    case 'beads': for (let i = 0; i < 9; i++) { const [x, y] = rng.pick(area); mark(x, y, 'w'); mark(x + 1, y); mark(x, y + 1); mark(x + 1, y + 1, 'm'); } break;
    case 'shaggy':
      for (let y = 4; y < REF_CB - 1; y += 3) for (let x = 4 + (((y - 4) / 3) % 2 ? 2 : 0); x < SPRITE_W - 4; x += 4) { mark(x, y); mark(x - 1, y - 1, 'm'); mark(x + 1, y - 1, 'm'); }
      break;
    case 'gloss': for (const [x, y] of [[8, 12], [9, 11], [10, 10], [11, 9], [12, 9], [13, 8], [9, 12], [10, 11]]) mark(x, y, 'w'); mark(18, 10, 'y'); break;
    case 'constellation': {
      const stars = [[10, 13], [14, 11], [18, 15], [20, 18]];
      for (let i = 0; i < stars.length - 1; i++) {
        const [x0, y0] = stars[i];
        const [x1, y1] = stars[i + 1];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let k = 1; k < n; k++) mark(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 'm');
      }
      for (const [x, y] of stars) mark(x, y, 'w');
      break;
    }
    default: break;
  }
  return gridRows(SPRITE_W, SPRITE_H, (x, y) => out.get(x + ',' + y));
}

/** Underside: four rows under the cap — the underside itself, and anything hanging below it. */
export function defaultGillRoles(type) {
  const cols = Array.from({ length: SPRITE_W }, (_, x) => gillColumn(type, x));
  return Array.from({ length: 4 }, (_, k) => cols.map((c) => c[k] || '.').join(''));
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
    const gy = -(SPRITE_H - spr.capMid) * sy;
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
