// Forest scene: tiles, structures, walking/working mushrooms, day/night, rain.
// Visual only — it reads the simulation and never decides outcomes (GDD 5.5).
import { AREA_W, AREA_H, STRUCTURES, JOB_BY_ID } from '../content/world.js';
import { MUTATION_BY_ID } from '../content/genetics.js';
import { getConfig } from '../config.js';
import { drawTile, drawStructure, TILE } from './world.js';
import { drawMushroom, SPRITE_W, SPRITE_H, resourceColor } from './sprites.js';
import { conditionsAt } from '../core/time.js';
import { makeRng } from '../core/rng.js';

const LW = AREA_W * TILE;
const LH = AREA_H * TILE;
const SPEED = 14;

const ANIM_FX = {
  water: '#8fd8ff', carry: '#c8955a', spores: '#d9c27a', hammer: '#ffe9a0', tend: '#f08cc0', dig: '#7a5434', glow: '#ffe066',
};

export class ForestView {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.app = app;
    this.areaId = 'clearing';
    this.agents = new Map();
    this.popups = [];
    this.fx = [];
    this.scale = 2;
    this.hover = null;
    this.terrainCache = { key: null, canvas: document.createElement('canvas') };
    this.terrainCache.canvas.width = LW;
    this.terrainCache.canvas.height = LH;
    this.rng = makeRng(Date.now() & 0xffff);
    canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    canvas.addEventListener('pointermove', (e) => { this.hover = this.toTile(e); });
    canvas.addEventListener('pointerleave', () => { this.hover = null; });
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth : LW * 2;
    this.scale = Math.max(1, Math.min(5, Math.floor(w / LW)));
    this.canvas.width = LW * this.scale;
    this.canvas.height = LH * this.scale;
    this.canvas.style.width = LW * this.scale + 'px';
    this.canvas.style.height = LH * this.scale + 'px';
  }

  setArea(id) {
    if (this.areaId !== id) {
      this.areaId = id;
      this.agents.clear();
      this.popups = [];
    }
  }

  toLogical(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * LW, y: ((e.clientY - rect.top) / rect.height) * LH };
  }

  toTile(e) {
    const p = this.toLogical(e);
    return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
  }

  onPointer(e) {
    const p = this.toLogical(e);
    const tile = { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
    if (this.app.buildTool) {
      this.app.onTapTile(this.areaId, tile.x, tile.y);
      return;
    }
    // mushrooms first (front-most = largest y)
    const hits = [...this.agents.values()].filter((a) => p.x >= a.x - SPRITE_W / 2 && p.x <= a.x + SPRITE_W / 2 && p.y >= a.y - SPRITE_H && p.y <= a.y + 1);
    if (hits.length) {
      hits.sort((a, b) => b.y - a.y);
      this.app.onTapMushroom(hits[0].uid);
      return;
    }
    const area = this.app.state.world.areas[this.areaId];
    const obj = area?.objects.find((o) => o.x === tile.x && o.y === tile.y);
    if (obj) this.app.onTapObject(obj.id);
  }

  // which mushrooms are shown here, and where they work
  population() {
    const s = this.app.state;
    const out = [];
    const area = s.world.areas[this.areaId];
    if (!area) return out;
    const objIds = new Set(area.objects.map((o) => o.id));
    for (const m of s.mushrooms) {
      if (m.status !== 'resident') continue;
      if (m.work && objIds.has(m.work.structureId)) out.push({ m, kind: 'worker' });
      else if (!m.work && this.areaId === 'clearing') out.push({ m, kind: 'idle' });
    }
    if (this.areaId === 'clearing') {
      for (const g of s.guests) out.push({ m: g, kind: 'guest' });
      for (const v of s.wildVisitors) out.push({ m: v.mushroom, kind: 'wild' });
    }
    return out.slice(0, getConfig().world.visibleMushroomCap + 4);
  }

  workSpot(m) {
    const area = this.app.state.world.areas[this.areaId];
    const obj = area.objects.find((o) => o.id === m.work.structureId);
    const siblings = this.app.state.mushrooms.filter((x) => x.work?.structureId === obj.id);
    const k = siblings.indexOf(m);
    const offsets = [[-6, 18], [22, 18], [8, 22]];
    const [ox, oy] = offsets[k % offsets.length];
    return { x: Math.max(8, Math.min(LW - 8, obj.x * TILE + ox)), y: Math.min(LH - 1, obj.y * TILE + oy) };
  }

  randomSpot() {
    return { x: 10 + this.rng.next() * (LW - 20), y: 30 + this.rng.next() * (LH - 34) };
  }

  syncAgents(t) {
    const pop = this.population();
    const seen = new Set();
    for (const { m, kind } of pop) {
      seen.add(m.uid);
      let a = this.agents.get(m.uid);
      if (!a) {
        const spot = kind === 'worker' ? this.workSpot(m) : this.randomSpot();
        a = { uid: m.uid, x: spot.x, y: spot.y, target: null, mode: 'idle', wait: this.rng.next() * 2, lastCycles: m.work?.cycles ?? 0, carry: null, kind, flip: false };
        this.agents.set(m.uid, a);
      }
      a.m = m;
      a.kind = kind;
      if (kind === 'worker') {
        const job = JOB_BY_ID[m.work.jobId];
        const spot = this.workSpot(m);
        if (m.work.cycles > a.lastCycles) {
          // a cycle completed: pop-up and a short carrying walk
          const main = Object.keys(job.outputs)[0];
          this.popups.push({ x: a.x, y: a.y - SPRITE_H - 2, color: resourceColor(main || 'glimmer'), life: 1.6, text: '+' });
          a.lastCycles = m.work.cycles;
          if (job.anim === 'carry' || job.anim === 'dig') {
            a.carry = resourceColor(main);
            const off = this.randomSpot();
            a.target = { x: (spot.x * 2 + off.x) / 3, y: (spot.y * 2 + off.y) / 3 };
            a.mode = 'walk';
            a.returnTo = spot;
          }
        }
        if (a.mode !== 'walk') {
          const dx = spot.x - a.x;
          const dy = spot.y - a.y;
          if (Math.hypot(dx, dy) > 2) { a.target = spot; a.mode = 'walk'; } else {
            const cond = this.app.conditions;
            a.mode = job.phases && !job.phases.includes(cond.phase) ? 'sleep' : 'work';
            a.anim = job.anim;
          }
        }
      } else if (a.mode === 'idle' || a.mode === 'work' || a.mode === 'sleep') {
        a.wait -= 1 / 30;
        if (a.wait <= 0) { a.target = this.randomSpot(); a.mode = 'walk'; }
        else a.mode = 'idle';
      }
    }
    for (const uid of [...this.agents.keys()]) if (!seen.has(uid)) this.agents.delete(uid);
    void t;
  }

  step(dt) {
    for (const a of this.agents.values()) {
      if (a.mode === 'walk' && a.target) {
        const dx = a.target.x - a.x;
        const dy = a.target.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 1) {
          a.x = a.target.x; a.y = a.target.y;
          if (a.returnTo) { a.target = a.returnTo; a.returnTo = null; a.carry = null; } else {
            a.target = null;
            a.mode = 'idle';
            a.wait = 1 + this.rng.next() * 4;
          }
        } else {
          a.x += (dx / d) * SPEED * dt;
          a.y += (dy / d) * SPEED * dt;
          a.flip = dx < 0;
        }
      }
    }
    this.popups = this.popups.filter((p) => (p.life -= dt) > 0);
    this.fx = this.fx.filter((p) => (p.life -= dt) > 0);
  }

  draw(t) {
    const s = this.app.state;
    const ctx = this.ctx;
    const area = s.world.areas[this.areaId];
    if (!area) return;
    const rm = s.settings.reducedMotion;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // terrain (cached; water animates at 2 fps)
    const tkey = this.areaId + area.tiles.join('') + (rm ? 0 : Math.floor(t * 2));
    if (this.terrainCache.key !== tkey) {
      const tctx = this.terrainCache.canvas.getContext('2d');
      for (let y = 0; y < AREA_H; y++) for (let x = 0; x < AREA_W; x++) drawTile(tctx, area.tiles[y][x], x, y, rm ? 0 : t);
      this.terrainCache.key = tkey;
    }
    ctx.drawImage(this.terrainCache.canvas, 0, 0);

    // depth-sorted drawables
    const items = [];
    for (const o of area.objects) items.push({ y: o.y * TILE + TILE, draw: () => drawStructure(ctx, STRUCTURES[o.def], o.x, o.y, o.state, rm ? 0 : t) });
    for (const a of this.agents.values()) items.push({ y: a.y, draw: () => this.drawAgent(ctx, a, t, rm) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();

    // build overlay
    if (this.app.buildTool) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1 / this.scale;
      for (let x = 0; x <= AREA_W; x++) { ctx.beginPath(); ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, LH); ctx.stroke(); }
      for (let y = 0; y <= AREA_H; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE); ctx.lineTo(LW, y * TILE); ctx.stroke(); }
      if (this.hover) {
        ctx.strokeStyle = '#ffd75e';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.hover.x * TILE + 0.5, this.hover.y * TILE + 0.5, TILE - 1, TILE - 1);
      }
      if (this.app.buildTool.kind === 'move') {
        const o = area.objects.find((x) => x.id === this.app.buildTool.objectId);
        if (o) { ctx.strokeStyle = '#8fd8ff'; ctx.strokeRect(o.x * TILE + 0.5, o.y * TILE + 0.5, TILE - 1, TILE - 1); }
      }
    }

    // pop-ups
    for (const p of this.popups) {
      const yy = p.y - (1.6 - p.life) * 8;
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(Math.round(p.x) - 4, Math.round(yy) - 1, 9, 6);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x) + 1, Math.round(yy), 3, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(Math.round(p.x) - 3, Math.round(yy) + 1, 3, 1);
      ctx.fillRect(Math.round(p.x) - 2, Math.round(yy), 1, 3);
      ctx.globalAlpha = 1;
    }

    // time of day and weather
    const cond = this.app.conditions;
    const tint = { dawn: 'rgba(255,170,90,0.13)', day: null, dusk: 'rgba(120,60,140,0.2)', night: 'rgba(16,20,60,0.42)' }[cond.phase];
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, LW, LH); }
    if (cond.phase === 'night' || cond.phase === 'dusk') {
      for (let i = 0; i < 9; i++) {
        const fx = (i * 37 + (rm ? 0 : Math.sin(t * 0.5 + i) * 10)) % LW;
        const fy = 20 + ((i * 53) % (LH - 30)) + (rm ? 0 : Math.cos(t * 0.7 + i * 2) * 6);
        const on = rm || Math.sin(t * 2 + i * 1.7) > 0.2;
        if (on) { ctx.fillStyle = 'rgba(230,255,140,0.9)'; ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1); }
      }
    }
    if (cond.raining) {
      ctx.fillStyle = 'rgba(30,40,70,0.15)';
      ctx.fillRect(0, 0, LW, LH);
      ctx.fillStyle = 'rgba(190,210,255,0.55)';
      for (let i = 0; i < 60; i++) {
        const rx = (i * 29 + (rm ? 0 : t * 30)) % (LW + 20) - 10;
        const ry = (i * 47 + (rm ? 0 : t * 120)) % LH;
        ctx.fillRect(Math.round(rx), Math.round(ry), 1, 3);
      }
    }
  }

  drawAgent(ctx, a, t, rm) {
    const m = a.m;
    let bob = 0;
    if (a.mode === 'walk') bob = Math.abs(Math.sin(t * 9 + a.x)) * -1.5;
    if (a.mode === 'work') bob = Math.sin(t * 6 + a.x) > 0.6 ? -1 : 0;
    const mv = this.app.state.unlocks.mutations && m.mutation ? MUTATION_BY_ID[m.mutation.mutationId]?.visual : null;
    const x = a.x - SPRITE_W / 2;
    const y = a.y - SPRITE_H;
    if (a.flip) {
      ctx.save();
      ctx.translate(Math.round(a.x) * 2, 0);
      ctx.scale(-1, 1);
      drawMushroom(ctx, m, x, y, t, { bob, mutationVisual: mv, reducedMotion: rm });
      ctx.restore();
    } else drawMushroom(ctx, m, x, y, t, { bob, mutationVisual: mv, reducedMotion: rm });
    // carried item
    if (a.carry) { ctx.fillStyle = '#2a1a10'; ctx.fillRect(Math.round(a.x) - 2, Math.round(y) - 4, 5, 5); ctx.fillStyle = a.carry; ctx.fillRect(Math.round(a.x) - 1, Math.round(y) - 3, 3, 3); }
    // work effects
    if (a.mode === 'work' && !rm) {
      const c = ANIM_FX[a.anim] || '#fff';
      const ph = (t * 1.5 + a.x * 0.1) % 1;
      ctx.fillStyle = c;
      if (a.anim === 'water') { ctx.fillRect(Math.round(a.x) + 9, Math.round(a.y - 14 + ph * 10), 1, 2); }
      else if (a.anim === 'spores') { ctx.globalAlpha = 1 - ph; ctx.fillRect(Math.round(a.x - 6 + ph * 12), Math.round(a.y - 20 - ph * 8), 1, 1); ctx.fillRect(Math.round(a.x + 4 - ph * 8), Math.round(a.y - 16 - ph * 6), 1, 1); ctx.globalAlpha = 1; }
      else if (a.anim === 'hammer') { if (ph < 0.2) { ctx.fillRect(Math.round(a.x) + 10, Math.round(a.y) - 12, 2, 1); ctx.fillRect(Math.round(a.x) + 12, Math.round(a.y) - 14, 1, 1); } }
      else if (a.anim === 'dig') { ctx.fillRect(Math.round(a.x + 8 + ph * 4), Math.round(a.y - 4 - Math.sin(ph * 3) * 6), 1, 1); }
      else if (a.anim === 'glow') { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); ctx.fillRect(Math.round(a.x) - 9, Math.round(a.y) - 22, 1, 1); ctx.fillRect(Math.round(a.x) + 9, Math.round(a.y) - 18, 1, 1); ctx.globalAlpha = 1; }
      else if (a.anim === 'tend') { if (ph < 0.5) ctx.fillRect(Math.round(a.x) + 8, Math.round(a.y) - 26 + Math.round(ph * 4), 2, 2); }
    }
    if (a.mode === 'sleep') {
      ctx.fillStyle = '#e0e8ff';
      const z = rm ? 0 : (t % 2);
      ctx.fillRect(Math.round(a.x) + 8, Math.round(a.y - 30 - z * 2), 3, 1);
      ctx.fillRect(Math.round(a.x) + 10, Math.round(a.y - 29 - z * 2), 1, 1);
      ctx.fillRect(Math.round(a.x) + 8, Math.round(a.y - 28 - z * 2), 3, 1);
    }
    // guest / visitor markers
    if (a.kind === 'guest' || a.kind === 'wild') {
      ctx.fillStyle = a.kind === 'guest' ? '#8fd8ff' : '#9ae07a';
      ctx.fillRect(Math.round(a.x) - 1, Math.round(y) - 6 + (rm ? 0 : Math.round(Math.sin(t * 3))), 3, 3);
    }
  }
}

export { conditionsAt };
