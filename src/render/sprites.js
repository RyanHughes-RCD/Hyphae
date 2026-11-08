// Procedural pixel-art mushrooms built from modular gene layers (GDD 17).
import { shade, mix, css } from '../core/color.js';
import { makeRng } from '../core/rng.js';
import { RESOURCES } from '../content/world.js';

export const SPRITE_W = 24;
export const SPRITE_H = 28;
const CX = 12;
const CAP_BOTTOM = 14;

const cache = new Map();

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
  const cap = capMask(g.cap);
  const stem = stemMask(g.stem);
  const rng = makeRng(g.pattern + 17);

  const capC = g.color;
  const capLight = shade(capC, 0.35);
  const capDark = shade(capC, -0.3);
  const accent = g.accent;
  const stemC = g.stemColor;
  const stemDark = shade(stemC, -0.22);
  const outline = shade(mix(capC, [20, 10, 30], 0.55), -0.55);

  // stem
  for (const k of stem) {
    const [x, y] = k.split(',').map(Number);
    const right = !has(stem, x + 1, y);
    set(x, y, right || y > 24 ? stemDark : stemC);
  }
  if (g.stem === 'crystal') for (const [x, y] of [[CX - 1, 18], [CX + 1, 20], [CX - 2, 22], [CX, 23]]) set(x, y, [150, 230, 255]);
  if (g.stem === 'ringed') for (let x = CX - 5; x < CX + 5; x++) set(x, 18, shade(stemC, -0.12));
  // face on the stem
  const eyeY = 19;
  set(CX - 2, eyeY, [40, 26, 30]); set(CX + 1, eyeY, [40, 26, 30]);
  set(CX - 2, eyeY - 1, [40, 26, 30]); set(CX + 1, eyeY - 1, [40, 26, 30]);
  set(CX - 3, eyeY + 1, [240, 150, 150]); set(CX + 2, eyeY + 1, [240, 150, 150]);

  // cap with shading
  let top = 99;
  for (const k of cap) top = Math.min(top, Number(k.split(',')[1]));
  for (const k of cap) {
    const [x, y] = k.split(',').map(Number);
    let c = capC;
    const hd = Math.hypot(x - (CX - 4), y - (top + 3));
    if (hd < 3.2) c = capLight;
    else if (!has(cap, x, y + 1) || !has(cap, x + 1, y) || y >= CAP_BOTTOM - 1) c = capDark;
    set(x, y, c);
  }
  // markings
  const capPts = [...cap].map((k) => k.split(',').map(Number)).filter(([x, y]) => has(cap, x, y - 1) && has(cap, x, y + 1) && has(cap, x - 1, y) && has(cap, x + 1, y) && y < CAP_BOTTOM - 1);
  const mark = (x, y, c = accent) => { if (has(cap, x, y) && y < CAP_BOTTOM - 1) set(x, y, c); };
  switch (g.markings) {
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
    let c = gillBase;
    switch (g.gills) {
      case 'fine': c = x % 2 ? gillBase : gillDark; break;
      case 'deep': c = gillDark; set(x, under + 1, x % 2 ? gillDark : null); break;
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
  const bob = rm ? 0 : opts.bob || 0;
  const yy = Math.round(y + bob);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(Math.round(x) + 6, Math.round(y) + SPRITE_H - 2, 12, 2);
  ctx.fillRect(Math.round(x) + 5, Math.round(y) + SPRITE_H - 1, 14, 1);
  // ordinary glow
  let lvl = GLOW_LEVEL[m.genes.glow] || 0;
  if (lvl) {
    if (m.genes.glow === 'pulse' && !rm) lvl *= 0.6 + 0.4 * Math.sin(t * 3);
    const gx = Math.round(x) + 12;
    const gy = yy + 9;
    const grd = ctx.createRadialGradient(gx, gy, 2, gx, gy, 16);
    grd.addColorStop(0, css(shade(spr.capColor, 0.5), lvl));
    grd.addColorStop(1, css(spr.capColor, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(gx - 16, gy - 16, 32, 32);
  }
  const mv = opts.mutationVisual;
  if (mv && (mv.kind === 'outline' || mv.kind === 'prism')) {
    const pulse = rm ? 0.8 : 0.55 + 0.45 * Math.sin(t * 2.5);
    const col = mv.kind === 'prism' ? hueRgb((t * 90) % 360) : mv.color;
    ctx.globalAlpha = pulse;
    ctx.drawImage(tinted(spr.silhouette, col), Math.round(x) - 1, yy - 1);
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(spr.canvas, Math.round(x), yy);
  if (mv) drawParticles(ctx, mv, x, yy, t, rm, m.genes.pattern);
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
      ctx.fillRect(Math.round(px), Math.round(py) - 1, 1, 3);
      ctx.fillRect(Math.round(px) - 1, Math.round(py), 3, 1);
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
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      continue;
    } else {
      const life = rm ? ph : (t * 0.5 + ph) % 1;
      px = x + 3 + ((i * 5 + seed) % 18);
      py = y + 16 - life * 14;
      a = 0.7 * (1 - life);
    }
    ctx.fillStyle = css(mv.color, a);
    ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
  }
}

/** Draw a mushroom into a standalone canvas element at an integer scale (for UI cards). */
export function mushroomCanvas(m, scale = 3, opts = {}) {
  const c = makeCanvas(SPRITE_W + 8, SPRITE_H + 4);
  c.className = 'sprite';
  c.style.width = (SPRITE_W + 8) * scale + 'px';
  c.style.height = (SPRITE_H + 4) * scale + 'px';
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawMushroom(ctx, m, 4, 2, 0.6, opts);
  return c;
}

// ---------- resource icon (small CSS dot) ----------
export function resourceColor(id) {
  if (id === 'glimmer') return '#ffd75e';
  return RESOURCES[id]?.color || '#ccc';
}
