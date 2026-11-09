// Procedural pixel-art tiles and structures. Coordinates are logical pixels.
import { TERRAIN } from '../content/world.js';
import { overrideCanvas } from './sprites.js';

export const TILE = 16;

function r(ctx, c, x, y, w = 1, h = 1) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

function noise(x, y, s = 0) {
  let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// With a painted grass backdrop, grass tiles are left transparent and leafy
// ground types are drawn translucent so the grass texture shows through.
const BACKDROP_ALPHA = { g: 0, m: 0.5, h: 0.62, l: 0.78 };

export function drawTile(ctx, code, tx, ty, t, seed = 0, backdrop = false) {
  const T = TERRAIN[code] || TERRAIN.g;
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  const ov = code !== 'u' && overrideCanvas('tile:' + code);
  if (ov) {
    // an edited tile from the Sprite Workshop (translucent over the grass painting like the original)
    const a = backdrop && code in BACKDROP_ALPHA && code !== 'g' ? BACKDROP_ALPHA[code] : 1;
    ctx.globalAlpha = a;
    ctx.drawImage(ov, x0, y0, TILE, TILE);
    ctx.globalAlpha = 1;
    return;
  }
  if (code === 'u') return; // thicket is drawn as undergrowth by the forest view
  if (code === 'r') { drawRiver(ctx, x0, y0, tx, ty, t); return; }
  if (backdrop && code in BACKDROP_ALPHA) {
    if (code === 'g') {
      if (noise(tx, ty, 77 + seed) > 0.9) {
        const nx = Math.floor(noise(tx, ty, 78) * 12) + 2;
        const ny = Math.floor(noise(ty, tx, 79) * 12) + 2;
        r(ctx, ['#f6e27a', '#f09ac0', '#ffffff', '#9ac8ff'][Math.floor(noise(tx, ty, 80) * 4)], x0 + nx, y0 + ny, 1, 1);
      }
      return;
    }
    ctx.globalAlpha = BACKDROP_ALPHA[code];
    r(ctx, T.color, x0, y0, TILE, TILE);
    ctx.globalAlpha = 1;
  } else r(ctx, T.color, x0, y0, TILE, TILE);
  for (let i = 0; i < 7; i++) {
    const nx = Math.floor(noise(tx, ty, i + seed) * 15);
    const ny = Math.floor(noise(ty, tx, i + 9 + seed) * 15);
    r(ctx, T.dark, x0 + nx, y0 + ny, code === 's' ? 2 : 1, 1);
  }
  if (code === 'g' || code === 'm') {
    for (let i = 0; i < 3; i++) {
      const nx = Math.floor(noise(tx, ty, 40 + i) * 14) + 1;
      const ny = Math.floor(noise(ty, tx, 50 + i) * 12) + 3;
      r(ctx, code === 'g' ? '#7cbf5a' : '#6bb075', x0 + nx, y0 + ny - 2, 1, 2);
    }
    if (noise(tx, ty, 77 + seed) > 0.86) {
      const nx = Math.floor(noise(tx, ty, 78) * 12) + 2;
      const ny = Math.floor(noise(ty, tx, 79) * 12) + 2;
      r(ctx, ['#f6e27a', '#f09ac0', '#ffffff', '#9ac8ff'][Math.floor(noise(tx, ty, 80) * 4)], x0 + nx, y0 + ny, 1, 1);
    }
  } else if (code === 'l') {
    for (let i = 0; i < 5; i++) {
      const nx = Math.floor(noise(tx, ty, 60 + i) * 14);
      const ny = Math.floor(noise(ty, tx, 70 + i) * 14);
      r(ctx, ['#c2903a', '#b4652e', '#d9b34a'][i % 3], x0 + nx, y0 + ny, 2, 1);
    }
  } else if (code === 'w') {
    const wave = Math.floor(t * 2 + tx + ty) % 4;
    r(ctx, '#7cb8e0', x0 + 2 + wave * 3, y0 + 4 + (ty % 2) * 6, 4, 1);
    r(ctx, '#3f78a8', x0, y0 + 15, TILE, 1);
  } else if (code === 'x') {
    if (Math.floor(t * 2 + noise(tx, ty) * 10) % 5 === 0) r(ctx, '#d8c8ff', x0 + Math.floor(noise(tx, ty, 3) * 14), y0 + Math.floor(noise(ty, tx, 4) * 14), 1, 1);
  } else if (code === 'p') {
    r(ctx, '#c8b07a', x0 + 3, y0 + 5, 2, 1);
    r(ctx, '#c8b07a', x0 + 10, y0 + 11, 2, 1);
  }
}

function drawRiver(ctx, x0, y0, tx, ty, t) {
  r(ctx, '#2f6a9e', x0, y0, TILE, TILE);
  r(ctx, '#3a78b0', x0 + 1, y0 + 1, TILE - 2, TILE - 2);
  // drifting ripples
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.6 + i / 3 + noise(tx, ty, i) * 0.3) % 1;
    const yy = y0 + 2 + Math.floor(ph * 12);
    const xx = x0 + 2 + Math.floor(noise(tx, ty, i + 7) * 9);
    r(ctx, '#7cb8e0', xx, yy, 4, 1);
  }
  r(ctx, '#bfe2f8', x0 + 3 + Math.floor(noise(ty, tx, 3) * 9), y0 + 3 + Math.floor(((t * 0.4) % 1) * 10), 1, 1);
}

// --- structure art helpers ---
const C = {
  wood: '#8a5a32', woodL: '#b07a44', woodD: '#5a3a1e', soil: '#5a3e28', leaf: '#4f9a3c', leafL: '#7cc25a', leafD: '#2f6a2a',
  stone: '#9a9aa4', stoneL: '#c4c4cc', stoneD: '#686870', berry: '#d23a5a', cream: '#efe2c4', red: '#c8402e', water: '#5a9ad0',
};

const ART = {
  bed(ctx, x, y) {
    r(ctx, C.woodD, x + 1, y + 6, 14, 9); r(ctx, C.soil, x + 2, y + 7, 12, 7);
    for (let i = 0; i < 4; i++) { r(ctx, C.leaf, x + 3 + i * 3, y + 4, 1, 4); r(ctx, C.leafL, x + 2 + i * 3, y + 5, 1, 1); r(ctx, C.berry, x + 4 + i * 3, y + 6, 1, 1); }
    r(ctx, C.woodL, x + 1, y + 6, 14, 1);
  },
  bush(ctx, x, y) {
    r(ctx, C.leafD, x + 1, y + 5, 14, 10); r(ctx, C.leaf, x + 2, y + 3, 12, 10); r(ctx, C.leafL, x + 4, y + 4, 4, 2);
    for (const [a, b] of [[4, 8], [9, 6], [11, 10], [6, 11]]) r(ctx, C.berry, x + a, y + b, 2, 2);
  },
  nook(ctx, x, y, t) {
    r(ctx, '#3f7a4b', x, y + 8, 16, 7); r(ctx, '#5a9a5a', x + 1, y + 7, 14, 2);
    const p = Math.sin(t * 2) > 0 ? 1 : 0;
    r(ctx, '#e8d8f0', x + 5, y + 3 - p, 6, 5); r(ctx, '#c8a8e0', x + 6, y + 2 - p, 4, 1); r(ctx, '#ffffff', x + 6, y + 4 - p, 1, 1);
    r(ctx, '#b88ad8', x + 3, y + 6, 2, 2); r(ctx, '#b88ad8', x + 11, y + 5, 2, 2);
  },
  pen(ctx, x, y) {
    // a little fenced breeding pen on soft grass
    r(ctx, '#6aa640', x + 1, y + 5, 14, 10); r(ctx, '#86c25a', x + 2, y + 6, 12, 2);
    r(ctx, C.woodL, x, y + 5, 16, 1); r(ctx, C.woodL, x, y + 10, 16, 1); r(ctx, C.woodD, x, y + 15, 16, 1);
    for (const px of [0, 5, 10, 15]) { r(ctx, C.woodD, x + px, y + 3, 1, 13); r(ctx, C.woodL, x + px, y + 3, 1, 1); }
    r(ctx, '#f08cb0', x + 7, y + 7, 1, 1); r(ctx, '#f08cb0', x + 9, y + 7, 1, 1); r(ctx, '#f08cb0', x + 7, y + 8, 3, 1); r(ctx, '#f08cb0', x + 8, y + 9, 1, 1);
  },
  stump(ctx, x, y) {
    r(ctx, C.woodD, x + 3, y + 6, 10, 9); r(ctx, C.woodL, x + 3, y + 5, 10, 3); r(ctx, '#d9b07a', x + 5, y + 6, 6, 1);
    r(ctx, '#ffd75e', x + 6, y + 3, 2, 2); r(ctx, '#ffd75e', x + 9, y + 4, 2, 2); r(ctx, '#fff4b0', x + 6, y + 3, 1, 1);
  },
  sporebed(ctx, x, y) {
    r(ctx, C.woodD, x, y + 9, 16, 6); r(ctx, '#3a2a1e', x + 1, y + 10, 14, 4);
    for (const [a, c] of [[2, '#d9c27a'], [6, '#c87a5a'], [10, '#e0d0b0'], [13, '#d9c27a']]) { r(ctx, '#efe2c4', x + a + 1, y + 7, 1, 3); r(ctx, c, x + a, y + 5, 3, 2); }
  },
  bench(ctx, x, y) {
    r(ctx, C.woodL, x + 1, y + 6, 14, 3); r(ctx, C.woodD, x + 2, y + 9, 2, 6); r(ctx, C.woodD, x + 12, y + 9, 2, 6);
    r(ctx, C.stoneD, x + 9, y + 3, 4, 3); r(ctx, C.wood, x + 4, y + 4, 4, 2);
  },
  site(ctx, x, y) {
    r(ctx, C.woodD, x + 2, y + 2, 1, 13); r(ctx, C.woodD, x + 13, y + 2, 1, 13); r(ctx, C.woodL, x + 2, y + 4, 12, 1); r(ctx, C.woodL, x + 2, y + 9, 12, 1);
    r(ctx, C.stone, x + 5, y + 12, 6, 3); r(ctx, C.woodL, x + 4, y + 11, 3, 1);
  },
  reeds(ctx, x, y, t) {
    for (let i = 0; i < 6; i++) { const sw = Math.round(Math.sin(t + i) * 0.6); r(ctx, '#5a8a3a', x + 2 + i * 2 + sw, y + 3 + (i % 3), 1, 12 - (i % 3)); r(ctx, '#8a5a32', x + 2 + i * 2 + sw, y + 2 + (i % 3), 1, 2); }
    r(ctx, '#bfe8ff', x + 5, y + 9, 1, 1); r(ctx, '#bfe8ff', x + 10, y + 7, 1, 1);
  },
  barrel(ctx, x, y) {
    r(ctx, C.wood, x + 3, y + 3, 10, 12); r(ctx, C.woodD, x + 3, y + 6, 10, 1); r(ctx, C.woodD, x + 3, y + 11, 10, 1); r(ctx, C.water, x + 4, y + 3, 8, 2);
  },
  nest(ctx, x, y) {
    r(ctx, '#a8803a', x + 2, y + 9, 12, 5); r(ctx, '#c8a050', x + 3, y + 8, 10, 2); r(ctx, '#f4f0e0', x + 5, y + 7, 3, 3); r(ctx, '#d8e8f8', x + 8, y + 7, 3, 3);
  },
  dig(ctx, x, y) {
    r(ctx, '#3a2818', x + 3, y + 9, 10, 5); r(ctx, '#7a5434', x + 2, y + 8, 12, 1); r(ctx, '#7a5434', x + 13, y + 7, 2, 2);
    r(ctx, C.woodL, x + 11, y + 1, 1, 8); r(ctx, C.stone, x + 10, y + 8, 3, 2);
  },
  lookout(ctx, x, y) {
    r(ctx, C.woodD, x + 5, y + 4, 6, 11); r(ctx, C.woodL, x + 4, y + 3, 8, 2); r(ctx, C.wood, x + 6, y + 6, 1, 7); r(ctx, '#ffe066', x + 7, y + 1, 2, 2);
  },
  shrine(ctx, x, y, t) {
    r(ctx, C.stoneD, x + 2, y + 4, 2, 11); r(ctx, C.stoneD, x + 12, y + 4, 2, 11); r(ctx, C.stone, x + 1, y + 2, 14, 3); r(ctx, C.stoneL, x + 2, y + 2, 12, 1);
    const a = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.fillStyle = `rgba(200,180,255,${0.4 + 0.4 * a})`; ctx.fillRect(x + 6, y + 7, 4, 5);
  },
  grove(ctx, x, y, t) {
    r(ctx, '#d8d8e8', x + 7, y + 6, 2, 9); r(ctx, '#a8b8e8', x + 2, y + 1, 12, 7); r(ctx, '#c8d8ff', x + 4, y + 2, 5, 2);
    if (Math.sin(t * 3) > 0.3) r(ctx, '#ffffff', x + 11, y + 3, 1, 1);
  },
  circle(ctx, x, y) {
    for (const [a, b] of [[1, 6], [12, 6], [1, 12], [12, 12], [6, 3], [6, 14]]) r(ctx, C.wood, x + a, y + b, 3, 2);
    r(ctx, '#ff9a50', x + 7, y + 8, 2, 3); r(ctx, '#ffd75e', x + 7, y + 7, 2, 1);
  },
  table(ctx, x, y) {
    r(ctx, C.woodL, x + 1, y + 7, 14, 2); r(ctx, C.woodD, x + 2, y + 9, 1, 6); r(ctx, C.woodD, x + 13, y + 9, 1, 6);
    r(ctx, '#ff6a8a', x + 4, y + 3, 5, 4); r(ctx, '#fff0a0', x + 6, y + 3, 1, 4); r(ctx, '#9ff0e0', x + 10, y + 4, 3, 3);
  },
  home(ctx, x, y) {
    r(ctx, C.cream, x + 4, y + 8, 8, 7); r(ctx, C.woodD, x + 7, y + 11, 2, 4); r(ctx, '#ffe9a0', x + 5, y + 9, 2, 2);
    r(ctx, C.red, x + 1, y + 4, 14, 5); r(ctx, C.red, x + 3, y + 2, 10, 2); r(ctx, '#ffffff', x + 4, y + 4, 2, 1); r(ctx, '#ffffff', x + 10, y + 3, 2, 1);
  },
  cozyhome(ctx, x, y) {
    r(ctx, C.cream, x + 2, y + 8, 12, 7); r(ctx, C.woodD, x + 7, y + 11, 2, 4); r(ctx, '#ffe9a0', x + 3, y + 9, 2, 2); r(ctx, '#ffe9a0', x + 11, y + 9, 2, 2);
    r(ctx, '#7a5aa8', x, y + 4, 16, 5); r(ctx, '#7a5aa8', x + 2, y + 1, 12, 3); r(ctx, '#f6e27a', x + 4, y + 3, 2, 1); r(ctx, '#f6e27a', x + 10, y + 5, 2, 1);
  },
  flowers(ctx, x, y) {
    for (const [a, b, c] of [[3, 6, '#f08cc0'], [8, 4, '#f6e27a'], [11, 9, '#9ac8ff'], [5, 11, '#ffffff'], [12, 3, '#f08cc0']]) { r(ctx, C.leaf, x + a, y + b + 1, 1, 3); r(ctx, c, x + a - 1, y + b, 3, 1); r(ctx, c, x + a, y + b - 1, 1, 3); }
  },
  fern(ctx, x, y) {
    for (let i = 0; i < 5; i++) { r(ctx, C.leafD, x + 7, y + 3 + i * 2, 1, 2); r(ctx, C.leaf, x + 3 + i, y + 4 + i * 2, 4 - i, 1); r(ctx, C.leaf, x + 8, y + 4 + i * 2, 4 - i, 1); }
  },
  stones(ctx, x, y) {
    for (const [a, b] of [[2, 9], [7, 11], [11, 8], [5, 5], [10, 4]]) { r(ctx, C.stoneD, x + a, y + b, 3, 3); r(ctx, C.stoneL, x + a, y + b, 2, 1); }
  },
  log(ctx, x, y) {
    r(ctx, C.wood, x + 1, y + 8, 14, 6); r(ctx, C.woodL, x + 1, y + 8, 14, 1); r(ctx, '#d9b07a', x + 13, y + 9, 2, 4); r(ctx, C.leaf, x + 4, y + 7, 3, 1);
  },
  pond(ctx, x, y, t) {
    r(ctx, C.stoneD, x + 1, y + 4, 14, 10); r(ctx, C.water, x + 2, y + 5, 12, 8); r(ctx, '#9ad0f0', x + 4 + (Math.floor(t * 2) % 5), y + 7, 3, 1); r(ctx, '#6ab04a', x + 10, y + 10, 3, 2);
  },
  lantern(ctx, x, y, t) {
    r(ctx, C.woodD, x + 7, y + 7, 2, 8); r(ctx, C.woodD, x + 5, y + 2, 6, 1);
    const a = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(255,224,102,${a})`; ctx.fillRect(x + 5, y + 3, 6, 5);
  },
  tree(ctx, x, y, t) {
    // a tall leafy tree for the forest beyond the clearing (drawn upward from its base)
    const sway = Math.round(Math.sin(t * 0.8 + x) * 0.6);
    r(ctx, 'rgba(0,0,0,0.25)', x - 2, y + 13, 20, 3);
    r(ctx, C.woodD, x + 6, y + 2, 4, 13); r(ctx, C.wood, x + 7, y + 2, 1, 12);
    r(ctx, C.leafD, x - 3 + sway, y - 12, 22, 14); r(ctx, C.leafD, x - 1 + sway, y - 17, 18, 6);
    r(ctx, C.leaf, x - 1 + sway, y - 14, 18, 11); r(ctx, C.leaf, x + 2 + sway, y - 18, 12, 5);
    r(ctx, C.leafL, x + 1 + sway, y - 15, 6, 3); r(ctx, C.leafL, x + 9 + sway, y - 9, 4, 2);
  },
  pine(ctx, x, y, t) {
    const sway = Math.round(Math.sin(t * 0.7 + y) * 0.5);
    r(ctx, 'rgba(0,0,0,0.25)', x, y + 13, 16, 3);
    r(ctx, C.woodD, x + 7, y + 9, 2, 6);
    for (let i = 0; i < 4; i++) {
      const w = 4 + i * 4;
      r(ctx, i % 2 ? C.leafD : '#2a5a2e', x + 8 - w / 2 + sway, y - 14 + i * 6, w, 6);
    }
    r(ctx, '#3f7a3c', x + 7 + sway, y - 15, 2, 3);
  },
  weeds(ctx, x, y) {
    for (const [a, h] of [[2, 9], [4, 12], [6, 8], [8, 11], [10, 9], [12, 12], [13, 7]]) { r(ctx, '#5e8f2e', x + a, y + 15 - h, 1, h); r(ctx, '#86b84a', x + a, y + 15 - h, 1, 2); }
    r(ctx, '#d8d070', x + 5, y + 5, 1, 1); r(ctx, '#d8d070', x + 11, y + 4, 1, 1);
  },
  brambles(ctx, x, y) {
    r(ctx, '#24461f', x + 1, y + 6, 14, 9); r(ctx, '#2f5a26', x + 2, y + 4, 12, 9);
    for (const [a, b] of [[2, 7], [6, 5], [10, 8], [13, 6], [4, 11], [9, 12]]) { r(ctx, '#8a6a3a', x + a, y + b, 2, 1); r(ctx, '#c8b090', x + a + 1, y + b - 1, 1, 1); }
    r(ctx, '#3a1c48', x + 5, y + 9, 2, 2); r(ctx, '#3a1c48', x + 11, y + 10, 2, 2);
  },
  rocks(ctx, x, y) {
    for (const [a, b, w] of [[2, 10, 4], [7, 11, 3], [10, 8, 4], [5, 7, 3]]) { r(ctx, C.stoneD, x + a, y + b, w, 3); r(ctx, C.stoneL, x + a, y + b, w - 1, 1); }
  },
  branch(ctx, x, y) {
    r(ctx, C.woodD, x + 1, y + 10, 14, 2); r(ctx, C.wood, x + 2, y + 10, 12, 1); r(ctx, C.woodD, x + 5, y + 7, 1, 3); r(ctx, C.woodD, x + 6, y + 6, 2, 1);
    r(ctx, C.woodD, x + 10, y + 12, 1, 2); r(ctx, C.leaf, x + 7, y + 5, 2, 1); r(ctx, C.leaf, x + 13, y + 9, 2, 1);
  },
  oldstump(ctx, x, y) {
    r(ctx, '#4a301a', x + 3, y + 6, 10, 9); r(ctx, '#7a5434', x + 3, y + 5, 10, 3); r(ctx, '#a8803a', x + 5, y + 6, 6, 1);
    r(ctx, '#4a301a', x + 1, y + 13, 3, 2); r(ctx, '#4a301a', x + 12, y + 13, 3, 2); r(ctx, C.leaf, x + 4, y + 4, 2, 1); r(ctx, '#d9c27a', x + 10, y + 9, 2, 2);
  },
  boulder(ctx, x, y) {
    r(ctx, '#5a5a62', x + 1, y + 4, 14, 11); r(ctx, '#7a7a82', x + 2, y + 3, 11, 10); r(ctx, '#a8a8b0', x + 4, y + 4, 5, 2); r(ctx, '#4f7a3c', x + 9, y + 3, 3, 1); r(ctx, '#4a4a52', x + 3, y + 13, 11, 2);
  },
  bridge(ctx, x, y) {
    r(ctx, 'rgba(0,0,0,0.25)', x, y + 13, 16, 3);
    for (let i = 0; i < 4; i++) { r(ctx, i % 2 ? C.wood : C.woodL, x, y + 1 + i * 4, 16, 3); r(ctx, C.woodD, x, y + 4 + i * 4, 16, 1); }
    r(ctx, C.woodD, x + 1, y, 1, 16); r(ctx, C.woodD, x + 14, y, 1, 16);
  },
  moonstone(ctx, x, y, t) {
    for (const [a, b] of [[2, 8], [12, 8], [7, 4], [7, 12], [4, 5], [10, 11]]) {
      const a2 = 0.5 + 0.5 * Math.sin(t * 2 + a);
      r(ctx, '#c8d0e8', x + a, y + b, 2, 2);
      ctx.fillStyle = `rgba(220,230,255,${a2})`; ctx.fillRect(x + a, y + b, 1, 1);
    }
  },
};

/** Draw edited art anchored to the bottom-centre of its tile (taller sprites rise above it). */
function drawOverride(ctx, ov, x, y) {
  ctx.drawImage(ov, x + Math.round((TILE - ov.width) / 2), y + TILE - ov.height);
}

export function drawStructure(ctx, def, tx, ty, state, t) {
  const x = tx * TILE;
  const y = ty * TILE;
  const ov = overrideCanvas(def.overrideKey || 'structure:' + def.sprite);
  const fn = ov ? (c, xx, yy) => drawOverride(c, ov, xx, yy) : ART[def.sprite] || ART.stones;
  if (state === 'ruin') {
    ctx.globalAlpha = 0.45;
    fn(ctx, x, y, 0);
    ctx.globalAlpha = 1;
    // vines and rubble
    r(ctx, '#3f6a2a', x + 2, y + 3, 1, 10); r(ctx, '#3f6a2a', x + 3, y + 6, 4, 1); r(ctx, '#3f6a2a', x + 11, y + 5, 1, 9);
    r(ctx, '#6a6a70', x + 5, y + 13, 3, 2); r(ctx, '#6a6a70', x + 10, y + 12, 2, 2);
    // restore marker
    const p = Math.sin(t * 3) > 0 ? 0 : 1;
    r(ctx, '#ffd75e', x + 12, y + p, 3, 3); r(ctx, '#5a3a00', x + 13, y + 1 + p, 1, 1);
    return;
  }
  fn(ctx, x, y, t);
}

/** Draw a piece of structure art at logical pixel (x, y) — used for the forest beyond the area. */
export function drawArt(ctx, sprite, x, y, t) {
  const ov = overrideCanvas('structure:' + sprite);
  if (ov) drawOverride(ctx, ov, x, y);
  else (ART[sprite] || ART.bush)(ctx, x, y, t);
}

/** Every built-in piece of art, by name (for the Sprite Workshop). */
export const ART_NAMES = Object.keys(ART);
