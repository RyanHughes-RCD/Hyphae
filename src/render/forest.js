// Forest scene: a full-screen, pannable and zoomable camera over the current
// area. Tiles, structures, gliding mushrooms with squash-and-stretch, day/night
// and rain. Visual only — it reads the simulation and never decides outcomes.
import { AREA_W, AREA_H, STRUCTURES, JOB_BY_ID } from '../content/world.js';
import { MUTATION_BY_ID } from '../content/genetics.js';
import { getConfig } from '../config.js';
import { drawTile, drawStructure, TILE } from './world.js';
import { drawMushroom, mushroomSprite, SPRITE_W as FULL_W, SPRITE_H as FULL_H, MUSHROOM_SCALE, resourceColor } from './sprites.js';

// mushrooms are drawn at 65% of their sprite size in the forest
const SPRITE_W = FULL_W * MUSHROOM_SCALE;
const SPRITE_H = FULL_H * MUSHROOM_SCALE;
import { conditionsAt } from '../core/time.js';
import { makeRng, hash } from '../core/rng.js';

const LW = AREA_W * TILE;
const LH = AREA_H * TILE;

// movement (logical px, seconds)
const MAX_SPEED = 16;
const ACCEL = 4; // how quickly velocity follows the desired velocity
const SLOW_RADIUS = 10; // start easing in this far from the target
const EDGE = 12; // keep wandering mushrooms inside the area

// camera
const PAN_MARGIN = 60; // how far beyond the area's edge the view's centre may go
const ZOOM_RANGE = 4; // max zoom = fit zoom × this
const TAP_SLOP = 7; // CSS px a pointer may move and still count as a tap
const GRASS_TILE = 160; // logical px covered by one copy of the grass painting
const CANOPY_TILE = 600; // logical px covered by one copy of the canopy shadow (large, soft light gaps)
const WATER_ANIM_SCALE = 2.5; // device px per logical px below which water stops rippling
const BORDER_BAKE_SCALE = 3; // cached hedge pictures hold 3 px per logical px (crisp until you zoom right in)
const CANOPY_DOWNSCALE = 4; // the canopy layers are drawn at a quarter of the screen's resolution
const CANOPY_REFRESH = 1 / 15; // seconds between canopy redraws (it drifts slowly)
const RIM = 20; // thickness of the hedge wall at the map's edge (logical px)
const FOLIAGE_ROW = 26; // height of one row of bushes in the undergrowth beyond the map

// dappled canopy light and sun rays by time of day: shade/light opacity, light tint, ray strength
const CANOPY = {
  day: { shade: 0.24, light: 0.34, tint: [255, 244, 200], rays: 1 },
  dawn: { shade: 0.22, light: 0.32, tint: [255, 196, 120], rays: 1 },
  dusk: { shade: 0.24, light: 0.26, tint: [255, 168, 96], rays: 0.8 },
  night: { shade: 0.15, light: 0.12, tint: [170, 196, 255], rays: 0.4 },
};

const ANIM_FX = {
  water: '#8fd8ff', carry: '#c8955a', spores: '#d9c27a', hammer: '#ffe9a0', tend: '#f08cc0', dig: '#7a5434', glow: '#ffe066',
};

export class ForestView {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.app = app;
    this.agents = new Map();
    this.popups = [];
    this.hover = null;
    this.vw = 320;
    this.vh = 480;
    this.dpr = 1;
    this.cam = { x: LW / 2, y: LH / 2, zoom: 2, target: null, vx: 0, vy: 0 };
    this.fitted = false;
    this.pointers = new Map();
    this.gesture = null;
    this.terrainCaches = new Map();
    this.rng = makeRng(Date.now() & 0xffff);
    this.decor = new Map();

    // the painted grass, mirror-tiled so it repeats without hard seams
    this.grass = new Image();
    this.grass.onload = () => { this.grassTile = mirrorTile(this.grass); };
    this.grass.src = 'assets/art/grass.webp';

    // shadow of the treetops above (white = shade, black = gaps in the leaves)
    this.canopyImg = new Image();
    this.canopyImg.onload = () => { this.canopy = makeCanopy(this.canopyImg); };
    this.canopyImg.src = 'assets/art/canopy-shadow.webp';
    this.rayCache = new Map();

    // the map's physical edge: hedge walls facing inward, dense undergrowth beyond
    this.hedges = {};
    for (const [k, file] of Object.entries({ south: 'hedge-strip', north: 'hedge-strip-b', west: 'hedge-strip-r', east: 'hedge-strip-v' })) {
      const img = new Image();
      img.onload = () => { if (k === 'south') this.foliage = makeFoliage(img); };
      img.src = `assets/art/${file}.webp`;
      this.hedges[k] = img;
    }

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e, true));
    canvas.addEventListener('pointerleave', () => { this.hover = null; });
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }

  // ------------------------------------------------------------- world geometry
  areas() {
    return Object.entries(this.app.state.world.areas).map(([id, area]) => ({ id, area, ox: area.cx * LW, oy: area.cy * LH }));
  }

  areaOrigin(areaId) {
    const a = this.app.state.world.areas[areaId];
    return a ? { x: a.cx * LW, y: a.cy * LH } : { x: 0, y: 0 };
  }

  /** Bounding box of every clearing, in logical pixels. */
  bounds() {
    const as = this.areas();
    if (!as.length) return { x0: 0, y0: 0, x1: LW, y1: LH };
    return {
      x0: Math.min(...as.map((a) => a.ox)), y0: Math.min(...as.map((a) => a.oy)),
      x1: Math.max(...as.map((a) => a.ox + LW)), y1: Math.max(...as.map((a) => a.oy + LH)),
    };
  }

  /** The clearing nearest the centre of the view. */
  centreArea() {
    let best = null;
    let bd = Infinity;
    for (const a of this.areas()) {
      const d = Math.hypot(a.ox + LW / 2 - this.cam.x, a.oy + LH / 2 - this.cam.y);
      if (d < bd) { bd = d; best = a.id; }
    }
    return best || 'clearing';
  }

  // ------------------------------------------------------------- sizing & camera
  resize() {
    const box = this.canvas.parentElement?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return;
    this.vw = box.width;
    this.vh = box.height;
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = this.vw + 'px';
    this.canvas.style.height = this.vh + 'px';
    const prevFit = this.fitZoom;
    this.computeFit();
    if (!this.fitted) this.focusArea('clearing', false);
    else {
      if (prevFit) this.cam.zoom *= this.fitZoom / prevFit;
      this.clampCamera();
    }
  }

  /** Screen insets kept clear for the hedges and overlay controls. */
  insets() {
    const cs = getComputedStyle(this.canvas.parentElement);
    const hedge = parseFloat(cs.getPropertyValue('--hedge')) || 24;
    return { side: hedge * 0.75, top: hedge * 0.6 + 48, bottom: hedge * 0.6 + 64 };
  }

  /** fitZoom frames one clearing; the minimum zoom shows the whole forest. */
  computeFit() {
    const ins = this.insets();
    const fitTo = (w, h) => Math.min((this.vw - 2 * ins.side) / w, (this.vh - ins.top - ins.bottom) / h);
    // leave room to see the hedge wall around the edge of the map
    const pad = RIM * 1.3;
    this.fitZoom = Math.max(0.5, fitTo(LW + pad, LH + pad));
    const b = this.bounds();
    this.forestZoom = Math.max(0.25, Math.min(this.fitZoom, fitTo(b.x1 - b.x0 + pad, b.y1 - b.y0 + pad)));
    this.minZoom = this.forestZoom;
    this.maxZoom = this.fitZoom * ZOOM_RANGE;
  }

  frame(cx, cy, z, animate) {
    const ins = this.insets();
    const target = { x: cx, y: cy - (ins.top - ins.bottom) / (2 * z), zoom: z };
    if (animate) this.cam.target = target;
    else Object.assign(this.cam, target, { target: null, vx: 0, vy: 0 });
    this.fitted = true;
  }

  /** Frame one clearing. */
  focusArea(areaId, animate = true) {
    const o = this.areaOrigin(areaId);
    this.frame(o.x + LW / 2, o.y + LH / 2, this.fitZoom, animate);
  }

  /** Frame the whole forest. */
  fit(animate = true) {
    this.computeFit();
    const b = this.bounds();
    this.frame((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, this.forestZoom, animate);
  }

  /** Glide so the clearing in view sits in the space above a panel `px` CSS pixels tall. */
  focusAbove(px) {
    const o = this.areaOrigin(this.centreArea());
    const ins = this.insets();
    const freeBottom = Math.max(ins.bottom, px + 20);
    let z = this.cam.target ? this.cam.target.zoom : this.cam.zoom;
    const fitZ = Math.min((this.vw - 2 * ins.side) / LW, (this.vh - ins.top - freeBottom) / LH);
    if (fitZ < z) z = Math.max(this.minZoom * 0.75, fitZ);
    this.minZoom = Math.min(this.minZoom, z);
    this.cam.target = { x: o.x + LW / 2, y: o.y + LH / 2 - (ins.top - freeBottom) / (2 * z), zoom: z };
  }

  zoomBy(f) {
    const t = this.cam.target;
    const z = clamp((t ? t.zoom : this.cam.zoom) * f, this.minZoom, this.maxZoom);
    this.cam.target = { x: t ? t.x : this.cam.x, y: t ? t.y : this.cam.y, zoom: z };
  }

  /** Zoom to z keeping the world point under screen point (sx, sy) fixed. */
  zoomAt(sx, sy, z) {
    z = clamp(z, this.minZoom, this.maxZoom);
    const w = this.toWorld(sx, sy);
    this.cam.zoom = z;
    this.cam.x = w.x - (sx - this.vw / 2) / z;
    this.cam.y = w.y - (sy - this.vh / 2) / z;
    this.clampCamera();
  }

  clampCamera() {
    const c = this.cam;
    c.zoom = clamp(c.zoom, this.minZoom, this.maxZoom);
    // the centre of the view may wander a little beyond the forest, never far into the woods
    const b = this.bounds();
    c.x = clamp(c.x, b.x0 - PAN_MARGIN, b.x1 + PAN_MARGIN);
    c.y = clamp(c.y, b.y0 - PAN_MARGIN, b.y1 + PAN_MARGIN);
  }

  toWorld(sx, sy) {
    return { x: this.cam.x + (sx - this.vw / 2) / this.cam.zoom, y: this.cam.y + (sy - this.vh / 2) / this.cam.zoom };
  }

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Which clearing and local tile a world point falls in. */
  tileAt(wx, wy) {
    const cx = Math.floor(wx / LW);
    const cy = Math.floor(wy / LH);
    const hit = Object.entries(this.app.state.world.areas).find(([, a]) => a.cx === cx && a.cy === cy);
    if (!hit) return null;
    return { areaId: hit[0], x: Math.floor((wx - cx * LW) / TILE), y: Math.floor((wy - cy * LH) / TILE) };
  }

  // ------------------------------------------------------------- input
  onDown(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    this.cam.target = null;
    this.cam.vx = 0;
    this.cam.vy = 0;
    if (this.pointers.size === 1) {
      this.gesture = { kind: 'pan', start: p, last: p, lastT: performance.now(), moved: false };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.gesture = { kind: 'pinch', dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom: this.cam.zoom, world: this.toWorld(mid.x, mid.y), moved: true };
    }
  }

  onMove(e) {
    const p = this.local(e);
    if (e.pointerType === 'mouse' && !this.pointers.size) {
      const w = this.toWorld(p.x, p.y);
      this.hover = { wx: w.x, wy: w.y };
    }
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, p);
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'pan' && this.pointers.size === 1) {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) > TAP_SLOP) g.moved = true;
      if (g.moved) {
        const now = performance.now();
        const dt = Math.max(1, now - g.lastT) / 1000;
        const dx = (p.x - g.last.x) / this.cam.zoom;
        const dy = (p.y - g.last.y) / this.cam.zoom;
        this.cam.x -= dx;
        this.cam.y -= dy;
        // smoothed release velocity for a gentle glide after letting go
        this.cam.vx = this.cam.vx * 0.6 + (-dx / dt) * 0.4;
        this.cam.vy = this.cam.vy * 0.6 + (-dy / dt) * 0.4;
        g.lastT = now;
        this.clampCamera();
      }
      g.last = p;
    } else if (g.kind === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = clamp(g.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist), this.minZoom, this.maxZoom);
      this.cam.zoom = z;
      this.cam.x = g.world.x - (mid.x - this.vw / 2) / z;
      this.cam.y = g.world.y - (mid.y - this.vh / 2) / z;
      this.clampCamera();
    }
  }

  onUp(e, cancelled = false) {
    const g = this.gesture;
    const p = this.pointers.get(e.pointerId) || this.local(e);
    this.pointers.delete(e.pointerId);
    if (g?.kind === 'pan' && !g.moved && !cancelled) this.tap(p);
    if (g?.kind === 'pan' && g.moved && performance.now() - g.lastT > 80) { this.cam.vx = 0; this.cam.vy = 0; }
    if (this.pointers.size === 1) {
      // pinch → continue panning with the remaining finger
      const [q] = this.pointers.values();
      this.gesture = { kind: 'pan', start: q, last: q, lastT: performance.now(), moved: true };
      this.cam.vx = 0;
      this.cam.vy = 0;
    } else if (!this.pointers.size) this.gesture = null;
  }

  onWheel(e) {
    e.preventDefault();
    const p = this.local(e);
    this.cam.target = null;
    this.zoomAt(p.x, p.y, this.cam.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }

  tap(p) {
    const w = this.toWorld(p.x, p.y);
    const t = this.tileAt(w.x, w.y);
    const inArea = t && t.x >= 0 && t.y >= 0 && t.x < AREA_W && t.y < AREA_H;
    if (this.app.buildTool) {
      if (inArea) this.app.onTapTile(t.areaId, t.x, t.y);
      return;
    }
    const hits = [...this.agents.values()].filter((a) => w.x >= a.x - SPRITE_W / 2 && w.x <= a.x + SPRITE_W / 2 && w.y >= a.y - SPRITE_H && w.y <= a.y + 2);
    if (hits.length) {
      hits.sort((a, b) => b.y - a.y);
      this.app.onTapMushroom(hits[0].uid);
      return;
    }
    if (!inArea) return;
    const area = this.app.state.world.areas[t.areaId];
    const obj = this.app.game.objectAt(area, t.x, t.y);
    if (obj) this.app.onTapObject(obj.id);
    else if (area.tiles[t.y][t.x] === 'u') this.app.onTapThicket(t.areaId, t.x, t.y);
  }

  // ------------------------------------------------------------- mushrooms
  population() {
    const s = this.app.state;
    const out = [];
    const objIds = new Set();
    for (const a of Object.values(s.world.areas)) for (const o of a.objects) objIds.add(o.id);
    for (const m of s.mushrooms) {
      if (m.status !== 'resident') continue;
      if (this.app.game.onCleanup(s, m.uid)) out.push({ m, kind: 'crew' });
      else if (m.work && objIds.has(m.work.structureId)) out.push({ m, kind: 'worker' });
      else if (!m.work) out.push({ m, kind: 'idle' });
    }
    for (const g of s.guests) out.push({ m: g, kind: 'guest' });
    for (const v of s.wildVisitors) out.push({ m: v.mushroom, kind: 'wild' });
    return out.slice(0, getConfig().world.visibleMushroomCap * 3);
  }

  workSpot(m) {
    const found = this.app.game.objectById(this.app.state, m.work.structureId);
    const obj = found.obj;
    const o = this.areaOrigin(found.areaId);
    const siblings = this.app.state.mushrooms.filter((x) => x.work?.structureId === obj.id);
    const k = siblings.indexOf(m);
    // around the front of the structure (big ones are centred on their tile)
    const half = ((STRUCTURES[obj.def].size || 1) - 1) / 2 * TILE;
    const offsets = [[-3 - half, 17 + half], [19 + half, 17 + half], [8, 20 + half]];
    const [ox, oy] = offsets[k % offsets.length];
    return { x: o.x + clamp(obj.x * TILE + ox, EDGE, LW - EDGE), y: o.y + clamp(obj.y * TILE + oy, SPRITE_H, LH - 4) };
  }

  /** Somewhere in a clearing (the starting clearing by default) — for free-time wandering. */
  randomSpot(areaId = 'clearing') {
    const o = this.areaOrigin(areaId);
    return { x: o.x + EDGE + this.rng.next() * (LW - 2 * EDGE), y: o.y + SPRITE_H + this.rng.next() * (LH - SPRITE_H - 6) };
  }

  nearSpot(p, r = 24) {
    return { x: p.x + (this.rng.next() - 0.5) * 2 * r, y: p.y + (this.rng.next() - 0.5) * r };
  }

  syncAgents() {
    const cl = this.app.state.cleanup;
    if (cl) {
      this.cleanupSeen = this.cleanupSeen || new Set();
      for (const j of cl.jobs) {
        const k = cl.startedAt + ':' + j.kind + j.areaId + j.x + ',' + j.y;
        if (!j.done || this.cleanupSeen.has(k)) continue;
        this.cleanupSeen.add(k);
        const o = this.areaOrigin(j.areaId);
        if (o) this.popups.push({ x: o.x + j.x * TILE + 8, y: o.y + j.y * TILE + 2, color: j.kind === 'thicket' ? '#7cc25a' : '#c9a46a', life: 1.6 });
      }
    }
    const pop = this.population();
    const seen = new Set();
    for (const { m, kind } of pop) {
      seen.add(m.uid);
      let a = this.agents.get(m.uid);
      if (!a) {
        const spot = kind === 'worker' ? this.workSpot(m) : this.randomSpot();
        a = {
          uid: m.uid, x: spot.x, y: spot.y, vx: 0, vy: 0, target: null, mode: 'idle', wait: this.rng.next() * 2,
          lastCycles: m.work?.cycles ?? 0, carry: null, kind, flip: false,
          phase: this.rng.next() * 6, squash: 0, squashV: 0, seed: (hash(m.uid) % 1000) / 159,
        };
        this.agents.set(m.uid, a);
      }
      a.m = m;
      a.kind = kind;
      if (kind === 'crew') {
        // out with the clean-up crew: walk to the next spot and dig in
        const task = this.app.game.cleanupTask(this.app.state, m.uid, this.app.now());
        const o = task ? this.areaOrigin(task.areaId) : null;
        const spot = task ? { x: o.x + task.x * TILE + 8 + (hash(m.uid) % 5) - 2, y: o.y + task.y * TILE + 14 } : null;
        if (spot && a.mode !== 'walk') {
          if (Math.hypot(spot.x - a.x, spot.y - a.y) > 2) this.walkTo(a, spot);
          else { a.mode = 'work'; a.anim = 'dig'; }
        } else if (!spot && a.mode === 'work') a.mode = 'idle';
        continue;
      }
      if (kind === 'worker') {
        const job = JOB_BY_ID[m.work.jobId];
        const spot = this.workSpot(m);
        if (m.work.cycles > a.lastCycles) {
          const main = Object.keys(job.outputs)[0];
          this.popups.push({ x: a.x, y: a.y - SPRITE_H - 2, color: resourceColor(main || 'glimmer'), life: 1.6 });
          a.lastCycles = m.work.cycles;
          a.squashV += 2.2; // a happy little hop of effort
          if (job.anim === 'carry' || job.anim === 'dig') {
            a.carry = resourceColor(main);
            this.walkTo(a, this.nearSpot(spot));
            a.returnTo = spot;
          }
        }
        if (a.mode !== 'walk') {
          if (Math.hypot(spot.x - a.x, spot.y - a.y) > 2) this.walkTo(a, spot);
          else {
            const cond = this.app.conditions;
            a.mode = job.phases && !job.phases.includes(cond.phase) ? 'sleep' : 'work';
            a.anim = job.anim;
          }
        }
      } else if (a.mode !== 'walk') {
        a.mode = 'idle';
      }
    }
    for (const uid of [...this.agents.keys()]) if (!seen.has(uid)) this.agents.delete(uid);
  }

  walkTo(a, target) {
    if (a.mode !== 'walk') a.squashV -= 1.4; // crouch before setting off
    a.target = target;
    a.mode = 'walk';
  }

  step(dt) {
    // camera: eased zoom/pan targets and post-drag glide
    const c = this.cam;
    if (c.target) {
      const k = 1 - Math.exp(-dt * 10);
      c.x += (c.target.x - c.x) * k;
      c.y += (c.target.y - c.y) * k;
      c.zoom += (c.target.zoom - c.zoom) * k;
      if (Math.abs(c.target.zoom - c.zoom) < 0.002 && Math.hypot(c.target.x - c.x, c.target.y - c.y) < 0.05) {
        Object.assign(c, { x: c.target.x, y: c.target.y, zoom: c.target.zoom });
        c.target = null;
      }
      this.clampCamera();
    } else if (!this.pointers.size && (Math.abs(c.vx) > 0.5 || Math.abs(c.vy) > 0.5)) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      const decay = Math.exp(-dt * 5);
      c.vx *= decay;
      c.vy *= decay;
      this.clampCamera();
    }

    for (const a of this.agents.values()) {
      // idle mushrooms occasionally wander
      if (a.mode === 'idle' && (a.kind !== 'worker')) {
        a.wait -= dt;
        if (a.wait <= 0) this.walkTo(a, this.randomSpot());
      }
      // steering: accelerate toward the target, ease in on arrival
      let desiredX = 0;
      let desiredY = 0;
      if (a.mode === 'walk' && a.target) {
        const dx = a.target.x - a.x;
        const dy = a.target.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.4 && Math.hypot(a.vx, a.vy) < 2) {
          a.x = a.target.x;
          a.y = a.target.y;
          a.vx = 0;
          a.vy = 0;
          a.squashV -= 1.8; // settle with a squish
          if (a.returnTo) { this.walkTo(a, a.returnTo); a.returnTo = null; a.carry = null; } else {
            a.target = null;
            a.mode = 'idle';
            a.wait = 1.5 + this.rng.next() * 4;
          }
        } else {
          const sp = MAX_SPEED * (d > 90 ? 2.2 : 1) * Math.min(1, d / SLOW_RADIUS); // hurry on long trips between clearings
          desiredX = (dx / d) * sp;
          desiredY = (dy / d) * sp;
        }
      }
      const k = 1 - Math.exp(-dt * ACCEL);
      a.vx += (desiredX - a.vx) * k;
      a.vy += (desiredY - a.vy) * k;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      const speed = Math.hypot(a.vx, a.vy);
      if (Math.abs(a.vx) > 1.5) a.flip = a.vx < 0;
      // squash-and-stretch: a damped spring plus a gliding wobble while moving
      a.squashV += (-90 * a.squash - 9 * a.squashV) * dt;
      a.squash += a.squashV * dt;
      a.phase += dt * (2 + speed * 0.55);
      a.speed = speed;
    }
    this.popups = this.popups.filter((p) => (p.life -= dt) > 0);
  }

  /** Vertical scale for a mushroom right now (horizontal is its inverse). */
  squishOf(a, t, rm) {
    if (rm) return 1;
    let s = 1 + a.squash * 0.09;
    const move = Math.min(1, (a.speed || 0) / MAX_SPEED);
    s += Math.sin(a.phase * 2.2) * 0.075 * move; // rhythmic squish as it glides
    if (a.mode === 'work') s -= Math.max(0, Math.sin(t * 5.5 + a.seed)) * 0.07;
    else if (a.mode === 'sleep') s += Math.sin(t * 1.2 + a.seed) * 0.035;
    else if (move < 0.05) s += Math.sin(t * 2 + a.seed) * 0.018; // breathing
    return clamp(s, 0.8, 1.2);
  }

  // ------------------------------------------------------------- drawing
  /**
   * One clearing's ground, blended: each pixel picks its terrain from the four
   * nearest tile centres (weighted by distance, roughened with a little noise)
   * through an ordered dither, so different ground types meet in rounded,
   * stippled edges that fade into each other. Neighbouring clearings are read
   * across the seam so blends continue from one clearing to the next.
   */
  terrainFor(id, area, t, rm) {
    let c = this.terrainCaches.get(id);
    if (!c) {
      c = { key: null, canvas: document.createElement('canvas'), layers: new Map() };
      c.canvas.width = LW;
      c.canvas.height = LH;
      this.terrainCaches.set(id, c);
    }
    const s = this.app.state;
    const G = this.app.game;
    const blendOf = (code) => (code === 'u' ? 'g' : code);
    // the tile at (x, y) in this clearing's coordinates; outside it, the neighbour clearing's tile (or our own edge)
    const cell = (x, y) => {
      if (x >= 0 && y >= 0 && x < AREA_W && y < AREA_H) return blendOf(area.tiles[y][x]);
      const g = G.globalTile(s, area.cx * AREA_W + x, area.cy * AREA_H + y);
      if (g !== null && g !== undefined) return blendOf(g);
      return blendOf(area.tiles[Math.min(AREA_H - 1, Math.max(0, y))][Math.min(AREA_W - 1, Math.max(0, x))]);
    };
    const flat = area.tiles.join('');
    let ring = '';
    for (let x = -1; x <= AREA_W; x++) ring += cell(x, -1) + cell(x, AREA_H);
    for (let y = 0; y < AREA_H; y++) ring += cell(-1, y) + cell(AREA_W, y);
    // rippling water is only animated close up: zoomed out it is too small to see,
    // and re-blending every clearing's ground each half-second is costly
    const animated = /[wrx]/.test(flat + ring) && this.cam.zoom * this.dpr >= WATER_ANIM_SCALE;
    const shape = flat + '|' + ring;
    const key = shape + '|' + (animated && !rm ? Math.floor(t * 2) : 0);
    if (c.key === key) return c.canvas;
    // rippling water only needs a fresh frame now and then: rebuild one clearing per frame at most
    if (c.shape === shape && this.terrainBudget <= 0) return c.canvas;
    this.terrainBudget--;
    c.key = key;
    c.shape = shape;

    // 1. paint each ground type's texture wherever it might show (its tiles and their neighbours)
    const used = new Set();
    for (const [, l] of c.layers) l.ctx.clearRect(0, 0, LW, LH);
    const layer = (code) => {
      let l = c.layers.get(code);
      if (!l) {
        const cv = document.createElement('canvas');
        cv.width = LW; cv.height = LH;
        l = { cv, ctx: cv.getContext('2d', { willReadFrequently: true }) };
        c.layers.set(code, l);
      }
      return l;
    };
    const tt = rm ? 0 : t;
    for (let y = 0; y < AREA_H; y++) for (let x = 0; x < AREA_W; x++) {
      const near = new Set();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.add(cell(x + dx, y + dy));
      for (const code of near) { drawTile(layer(code).ctx, code, x, y, tt, 0, true); used.add(code); }
    }
    const data = new Map([...used].map((code) => [code, c.layers.get(code).ctx.getImageData(0, 0, LW, LH).data]));

    // 2. pick a ground type for every pixel
    const tctx = c.canvas.getContext('2d');
    const out = tctx.createImageData(LW, LH);
    const od = out.data;
    const order = [...used].sort((p, q) => LAYER_RANK(p) - LAYER_RANK(q));
    const w = new Map();
    for (let py = 0; py < LH; py++) {
      const ty = Math.floor(py / TILE);
      for (let px = 0; px < LW; px++) {
        const tx = Math.floor(px / TILE);
        if (area.tiles[ty][tx] === 'u') continue; // thicket: the undergrowth is drawn over it
        // a little smooth noise so edges wander instead of running dead straight
        const jx = (smoothNoise(px / 5, py / 5, 11) - 0.5) * 0.5;
        const jy = (smoothNoise(px / 5, py / 5, 23) - 0.5) * 0.5;
        const gx = (px + 0.5) / TILE - 0.5 + jx;
        const gy = (py + 0.5) / TILE - 0.5 + jy;
        const i0 = Math.floor(gx);
        const j0 = Math.floor(gy);
        const fx = gx - i0;
        const fy = gy - j0;
        // shorelines stay crisp: water only blends with water, land only with land
        const own = blendOf(area.tiles[ty][tx]);
        const ownWet = WET.has(own);
        const side = (k) => (WET.has(k) === ownWet ? k : own);
        const c00 = side(cell(i0, j0));
        const c10 = side(cell(i0 + 1, j0));
        const c01 = side(cell(i0, j0 + 1));
        const c11 = side(cell(i0 + 1, j0 + 1));
        const i = (py * LW + px) * 4;
        if (c00 === c10 && c00 === c01 && c00 === c11) {
          const src = data.get(c00);
          od[i] = src[i]; od[i + 1] = src[i + 1]; od[i + 2] = src[i + 2]; od[i + 3] = src[i + 3];
          continue;
        }
        // sharpened distance weights: a solid, rounded body with a short fade at the edge
        w.clear();
        const add = (k, v) => w.set(k, (w.get(k) || 0) + v * v * v * v);
        add(c00, (1 - fx) * (1 - fy)); add(c10, fx * (1 - fy)); add(c01, (1 - fx) * fy); add(c11, fx * fy);
        let total = 0;
        for (const v of w.values()) total += v;
        // blend the textures (premultiplied), stepped to a few levels so it stays pixel-art
        let r = 0; let g = 0; let bl = 0; let al = 0;
        const dz = BAYER4[(py & 3) * 4 + (px & 3)] - 0.5;
        for (const [k, v] of w) {
          const src = data.get(k);
          const f = Math.min(1, Math.max(0, Math.round((v / total) * STEPS + dz * 0.9) / STEPS));
          if (!f) continue;
          const sa = src[i + 3] / 255;
          r += src[i] * sa * f; g += src[i + 1] * sa * f; bl += src[i + 2] * sa * f; al += sa * f;
        }
        if (al > 0) { od[i] = r / al; od[i + 1] = g / al; od[i + 2] = bl / al; od[i + 3] = Math.min(255, al * 255); }
      }
    }
    tctx.putImageData(out, 0, 0);
    return c.canvas;
  }

  draw(t) {
    const s = this.app.state;
    const ctx = this.ctx;
    if (!this.vw) return;
    const rm = s.settings.reducedMotion;
    const c = this.cam;
    const k = c.zoom * this.dpr;
    const ox = (this.vw / 2 - c.x * c.zoom) * this.dpr;
    const oy = (this.vh / 2 - c.y * c.zoom) * this.dpr;
    const view = { x0: c.x - this.vw / (2 * c.zoom), y0: c.y - this.vh / (2 * c.zoom), w: this.vw / c.zoom, h: this.vh / c.zoom };
    const inView = (x, y, pad = TILE * 2) => x > view.x0 - pad && x < view.x0 + view.w + pad && y > view.y0 - pad && y < view.y0 + view.h + pad;

    this.terrainBudget = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16231a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, ox, oy);

    // 1. grass everywhere in view (smooth when shrinking the painting, crisp when enlarging it)
    if (this.grassTile) {
      const gt = this.grassTile;
      const tw = GRASS_TILE * 2;
      const th = tw * (gt.height / gt.width);
      ctx.imageSmoothingEnabled = k * (GRASS_TILE / this.grass.naturalWidth) < 1.2;
      ctx.imageSmoothingQuality = 'high';
      // one pattern fill over the view, however far out the camera is
      if (!gt._pattern) gt._pattern = ctx.createPattern(gt, 'repeat');
      if (gt._pattern) {
        gt._pattern.setTransform(new DOMMatrix().scaleSelf(tw / gt.width, th / gt.height));
        ctx.fillStyle = gt._pattern;
        ctx.fillRect(view.x0, view.y0, view.w, view.h);
      }
    }
    ctx.imageSmoothingEnabled = false;

    // 2. terrain of every clearing in view
    const areas = this.areas();
    for (const a of areas) {
      if (a.ox > view.x0 + view.w || a.ox + LW < view.x0 || a.oy > view.y0 + view.h || a.oy + LH < view.y0) continue;
      ctx.drawImage(this.terrainFor(a.id, a.area, t, rm), a.ox, a.oy);
    }

    // 3. depth-sorted: structures and mushrooms
    const items = [];
    const arrows = [];
    // spore clusters growing in pens (one per pen, in pen order)
    const growing = this.app.game.activeBreedings(s);
    const penIds = this.app.game.pens(s).map((o) => o.id);
    const clusterOn = new Map(growing.map((r, i) => [penIds[i], r]).filter(([id]) => id));
    for (const a of areas) {
      for (const o of a.area.objects) {
        if (!inView(a.ox + o.x * TILE, a.oy + o.y * TILE)) continue;
        const rec = clusterOn.get(o.id);
        const half = ((STRUCTURES[o.def].size || 1) - 1) / 2;
        const ready = o.state === 'ruin' && this.app.game.readyToRestore(s, o);
        if (ready) arrows.push({ x: a.ox + o.x * TILE + 8, y: a.oy + (o.y - half) * TILE });
        items.push({ y: a.oy + (o.y + half) * TILE + TILE, draw: () => {
          if (ready) drawReadyGlow(ctx, a.ox + o.x * TILE + 8, a.oy + o.y * TILE + 12, t, rm);
          ctx.save(); ctx.translate(a.ox, a.oy); drawStructure(ctx, STRUCTURES[o.def], o.x, o.y, o.state, rm ? 0 : t); ctx.restore();
          if (rec) drawCluster(ctx, a.ox + o.x * TILE + 8, a.oy + o.y * TILE + 9, rec.completesAt <= this.app.now(), t, rm);
        } });
      }
    }
    for (const ag of this.agents.values()) if (inView(ag.x, ag.y)) items.push({ y: ag.y, draw: () => this.drawAgent(ctx, ag, t, rm) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();
    // ruins ready to restore: a bouncing yellow arrow, always on top
    for (const ar of arrows) drawReadyArrow(ctx, ar.x, ar.y, t, rm);

    // 4. the edge of the map: dense undergrowth beyond, hedge walls along every open side
    this.drawBorders(ctx, view, areas);

    // 5. light through the treetops: drifting canopy shade with sunlit gaps
    const lightOn = s.settings.canopyLight !== false;
    if (lightOn && this.canopy) this.drawCanopy(ctx, view, t, rm);

    // 6. build overlay: tile grid on every clearing
    if (this.app.buildTool) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1 / c.zoom;
      for (const a of areas) {
        for (let x = 0; x <= AREA_W; x++) { ctx.beginPath(); ctx.moveTo(a.ox + x * TILE, a.oy); ctx.lineTo(a.ox + x * TILE, a.oy + LH); ctx.stroke(); }
        for (let y = 0; y <= AREA_H; y++) { ctx.beginPath(); ctx.moveTo(a.ox, a.oy + y * TILE); ctx.lineTo(a.ox + LW, a.oy + y * TILE); ctx.stroke(); }
      }
      ctx.lineWidth = 2 / c.zoom;
      if (this.hover) {
        const ht = this.tileAt(this.hover.wx, this.hover.wy);
        if (ht) {
          const o = this.areaOrigin(ht.areaId);
          ctx.strokeStyle = '#ffd75e';
          // show the whole footprint of what is being placed or moved
          const tool = this.app.buildTool;
          const def = tool.kind === 'place' ? tool.def : tool.kind === 'move' && tool.objectId ? this.app.game.objectById(s, tool.objectId)?.obj.def : null;
          const n = (def && STRUCTURES[def]?.size) || 1;
          const hh = (n - 1) / 2;
          ctx.strokeRect(o.x + (ht.x - hh) * TILE, o.y + (ht.y - hh) * TILE, TILE * n, TILE * n);
        }
      }
      if (this.app.buildTool.kind === 'move' && this.app.buildTool.objectId) {
        const f = this.app.game.objectById(s, this.app.buildTool.objectId);
        if (f) {
          const o = this.areaOrigin(f.areaId);
          const n = STRUCTURES[f.obj.def].size || 1;
          const hh = (n - 1) / 2;
          ctx.strokeStyle = '#8fd8ff'; ctx.strokeRect(o.x + (f.obj.x - hh) * TILE, o.y + (f.obj.y - hh) * TILE, TILE * n, TILE * n);
        }
      }
    }

    // 7. pop-ups
    for (const p of this.popups) {
      const yy = p.y - (1.6 - p.life) * 8;
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(p.x - 4, yy - 1, 9, 6);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x + 1, yy, 3, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(p.x - 3, yy + 1, 3, 1);
      ctx.fillRect(p.x - 2, yy, 1, 3);
      ctx.globalAlpha = 1;
    }

    // 8. time of day and weather, across the whole screen
    const cond = this.app.conditions;
    if (cond.phase === 'night' || cond.phase === 'dusk') {
      ctx.fillStyle = 'rgba(230,255,140,0.9)';
      for (let i = 0; i < 40; i++) {
        const fx = view.x0 + ((i * 97.3) % view.w) + (rm ? 0 : Math.sin(t * 0.5 + i) * 10);
        const fy = view.y0 + ((i * 53.7) % view.h) + (rm ? 0 : Math.cos(t * 0.7 + i * 2) * 6);
        if (rm || Math.sin(t * 2 + i * 1.7) > 0.2) ctx.fillRect(fx, fy, 1, 1);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const tint = { dawn: 'rgba(255,170,90,0.13)', day: null, dusk: 'rgba(120,60,140,0.2)', night: 'rgba(16,20,60,0.42)' }[cond.phase];
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
    if (lightOn) this.drawRays(ctx, t, rm);
    if (cond.raining) {
      ctx.fillStyle = 'rgba(30,40,70,0.15)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(190,210,255,0.5)';
      const d = this.dpr;
      for (let i = 0; i < 120; i++) {
        const rx = ((i * 97 + (rm ? 0 : t * 60)) % (this.vw + 40)) - 20;
        const ry = ((i * 151 + (rm ? 0 : t * 260)) % (this.vh + 20)) - 10;
        ctx.fillRect(rx * d, ry * d, 1.5 * d, 7 * d);
      }
    }
  }

  /** Undergrowth fills thicket tiles and everything outside the map; hedge walls line its ragged edge. */
  drawBorders(ctx, view, areas) {
    const occ = new Map(areas.map((a) => [a.area.cx + ',' + a.area.cy, a.area]));
    const blocked = (gx, gy) => {
      const a = occ.get(Math.floor(gx / AREA_W) + ',' + Math.floor(gy / AREA_H));
      if (!a) return true;
      return a.tiles[gy - a.cy * AREA_H][gx - a.cx * AREA_W] === 'u';
    };
    ctx.imageSmoothingEnabled = true;
    if (this.foliage && !this.foliage._pattern) {
      const pt = ctx.createPattern(this.foliage, 'repeat');
      if (pt) { pt.setTransform(new DOMMatrix().scaleSelf(this.foliage.world, this.foliage.world)); this.foliage._pattern = pt; }
    }
    ctx.fillStyle = this.foliage?._pattern || '#1d3322';
    // empty cells beyond the map
    const cx0 = Math.floor(view.x0 / LW);
    const cx1 = Math.floor((view.x0 + view.w) / LW);
    const cy0 = Math.floor(view.y0 / LH);
    const cy1 = Math.floor((view.y0 + view.h) / LH);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (!occ.has(cx + ',' + cy)) ctx.fillRect(cx * LW - 0.5, cy * LH - 0.5, LW + 1, LH + 1);
    }
    const visible = areas.filter(({ ox, oy }) => !(ox > view.x0 + view.w + RIM || ox + LW < view.x0 - RIM || oy > view.y0 + view.h + RIM || oy + LH < view.y0 - RIM));
    // zoomed out: each clearing's thicket and hedge walls come from a cached picture;
    // zoomed in (only a clearing or two in view): drawn live at full detail
    const k = this.cam.zoom * this.dpr;
    const ready = this.hedgesReady();
    for (const v of visible) {
      if (k <= BORDER_BAKE_SCALE && ready) {
        const img = this.bakedBorders(v, blocked);
        ctx.drawImage(img, v.ox - RIM, v.oy - RIM, LW + 2 * RIM, LH + 2 * RIM);
      } else this.drawAreaBorders(ctx, v, blocked);
    }
    ctx.imageSmoothingEnabled = false;
  }

  hedgesReady() {
    return !!(this.foliage?._pattern && ['north', 'south', 'west', 'east'].every((d) => this.hedges[d]?.naturalWidth));
  }

  /** One clearing's thicket and hedge walls, cached until its tiles (or its neighbours' edges) change. */
  bakedBorders({ id, area, ox, oy }, blocked) {
    this.borderCaches = this.borderCaches || new Map();
    let ring = '';
    for (let x = -1; x <= AREA_W; x++) ring += (blocked(area.cx * AREA_W + x, area.cy * AREA_H - 1) ? 1 : 0) + '' + (blocked(area.cx * AREA_W + x, area.cy * AREA_H + AREA_H) ? 1 : 0);
    for (let y = 0; y < AREA_H; y++) ring += (blocked(area.cx * AREA_W - 1, area.cy * AREA_H + y) ? 1 : 0) + '' + (blocked(area.cx * AREA_W + AREA_W, area.cy * AREA_H + y) ? 1 : 0);
    const key = area.tiles.join('') + '|' + ring + '|' + ox + ',' + oy;
    let c = this.borderCaches.get(id);
    if (c && c.key === key) return c.canvas;
    if (!c) {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil((LW + 2 * RIM) * BORDER_BAKE_SCALE);
      cv.height = Math.ceil((LH + 2 * RIM) * BORDER_BAKE_SCALE);
      c = { canvas: cv, key: null };
      this.borderCaches.set(id, c);
    }
    const bctx = c.canvas.getContext('2d');
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
    // the same world coordinates as the live drawing, so patterns line up across clearings
    bctx.setTransform(BORDER_BAKE_SCALE, 0, 0, BORDER_BAKE_SCALE, -(ox - RIM) * BORDER_BAKE_SCALE, -(oy - RIM) * BORDER_BAKE_SCALE);
    bctx.imageSmoothingEnabled = true;
    bctx.imageSmoothingQuality = 'high';
    this.drawAreaBorders(bctx, { area, ox, oy }, blocked);
    c.key = key;
    return c.canvas;
  }

  /** Thicket tiles and the hedge walls along every edge between open ground and undergrowth. */
  drawAreaBorders(ctx, { area, ox, oy }, blocked) {
    ctx.fillStyle = this.foliage?._pattern || '#1d3322';
    for (let y = 0; y < AREA_H; y++) for (let x = 0; x < AREA_W; x++) if (area.tiles[y][x] === 'u') ctx.fillRect(ox + x * TILE - 0.5, oy + y * TILE - 0.5, TILE + 1, TILE + 1);
    // hedge walls (patterns anchored to the world, so segments join up)
    const strip = (img, x, y, w, h, vertical) => {
      if (!img?.naturalWidth) return;
      if (!img._pattern) img._pattern = ctx.createPattern(img, vertical ? 'repeat-y' : 'repeat-x');
      if (!img._pattern) return; // not decoded yet
      const sc = vertical ? RIM / img.naturalWidth : RIM / img.naturalHeight;
      img._pattern.setTransform(new DOMMatrix().translateSelf(vertical ? x : 0, vertical ? 0 : y).scaleSelf(sc, sc));
      ctx.fillStyle = img._pattern;
      ctx.fillRect(x, y, w, h);
    };
    const inner = RIM * 0.4; // how far the wall reaches over the open ground
    for (let y = 0; y < AREA_H; y++) for (let x = 0; x < AREA_W; x++) {
      if (area.tiles[y][x] === 'u') continue;
      const gx = area.cx * AREA_W + x;
      const gy = area.cy * AREA_H + y;
      const px = ox + x * TILE;
      const py = oy + y * TILE;
      if (blocked(gx, gy - 1)) strip(this.hedges.north, px - inner * 0.5, py - RIM + inner, TILE + inner, RIM, false);
      if (blocked(gx, gy + 1)) strip(this.hedges.south, px - inner * 0.5, py + TILE - inner, TILE + inner, RIM, false);
      if (blocked(gx - 1, gy)) strip(this.hedges.west, px - RIM + inner, py - inner * 0.5, RIM, TILE + inner, true);
      if (blocked(gx + 1, gy)) strip(this.hedges.east, px + TILE - inner, py - inner * 0.5, RIM, TILE + inner, true);
    }
  }

  /** Canopy shade over everything, in world space so it pans and zooms with the forest. */
  drawCanopy(ctx, view, t, rm) {
    const cond = this.app.conditions;
    const look = CANOPY[cond.phase] || CANOPY.day;
    const c = this.canopy;
    const tw = CANOPY_TILE * 2;
    const th = tw * (c.shade.height / c.shade.width);
    // The canopy is soft and drifts slowly, so it is drawn into two small
    // offscreen layers (a quarter of the screen's resolution), refreshed a few
    // times a second, and blended over the forest once each. Blending the full
    // screen layer by layer every frame was the most expensive part of drawing.
    const W = Math.max(1, Math.ceil(this.canvas.width / CANOPY_DOWNSCALE));
    const H = Math.max(1, Math.ceil(this.canvas.height / CANOPY_DOWNSCALE));
    let L = this.canopyLayers;
    if (!L || L.shade.width !== W || L.shade.height !== H) {
      const mk = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; };
      L = this.canopyLayers = { shade: mk(), light: mk(), key: null, at: -1 };
    }
    const rain = cond.raining ? 0.35 : 1;
    const viewKey = [view.x0, view.y0, view.w, cond.phase, rain].map((v) => (typeof v === 'number' ? v.toFixed(1) : v)).join('|');
    const stale = viewKey !== L.key || (!rm && t - L.at > CANOPY_REFRESH);
    if (stale) {
      L.key = viewKey;
      L.at = t;
      const drift = (k) => (rm ? { x: 0, y: 0 } : { x: t * 2.2 * k + Math.sin(t * 0.13 * k) * 10, y: t * 0.9 * k + Math.cos(t * 0.11 * k) * 7 });
      const d1 = drift(1);
      const d2 = drift(-0.7);
      // world → layer pixels
      const sx = W / view.w;
      const sy = H / view.h;
      // shade: white, multiplied by both leaf layers (the same maths as multiplying them onto the forest one by one)
      const sc = L.shade.getContext('2d');
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.globalCompositeOperation = 'source-over';
      sc.globalAlpha = 1;
      sc.fillStyle = '#fff';
      sc.fillRect(0, 0, W, H);
      sc.setTransform(sx, 0, 0, sy, -view.x0 * sx, -view.y0 * sy);
      sc.imageSmoothingEnabled = true;
      sc.globalCompositeOperation = 'multiply';
      sc.globalAlpha = Math.min(1, look.shade * 1.3);
      tile(sc, c.shade, tw, th, d1.x, d1.y, view);
      sc.globalAlpha = Math.min(1, look.shade * 0.9);
      tile(sc, c.shade, tw * 1.37, th * 1.37, d2.x + 97, d2.y + 41, view);
      // sunlit gaps
      const lc = L.light.getContext('2d');
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, W, H);
      lc.setTransform(sx, 0, 0, sy, -view.x0 * sx, -view.y0 * sy);
      lc.imageSmoothingEnabled = true;
      lc.globalAlpha = Math.min(1, look.light * 2.2 * rain);
      tile(lc, tinted(c.light, look.tint, this.rayCache), tw, th, d1.x, d1.y, view);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(L.shade, view.x0, view.y0, view.w, view.h);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.drawImage(L.light, view.x0, view.y0, view.w, view.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
  }

  /** Soft slanted shafts of light falling through the canopy (screen space). */
  drawRays(ctx, t, rm) {
    const cond = this.app.conditions;
    if (cond.raining) return;
    const look = CANOPY[cond.phase] || CANOPY.day;
    const key = 'ray' + look.tint.join(',');
    if (!this.rayCache.has(key)) this.rayCache.set(key, makeRay(look.tint));
    const ray = this.rayCache.get(key);
    const d = this.dpr;
    const angle = 0.42;
    const len = this.vh * 1.7;
    const span = this.vw + Math.tan(angle) * this.vh;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.imageSmoothingEnabled = true;
    const N = 6;
    for (let i = 0; i < N; i++) {
      const base = ((i + 0.5) / N) * span - Math.tan(angle) * this.vh * 0.55;
      const x = base + (rm ? 0 : Math.sin(t * 0.06 + i * 1.7) * 36);
      const w = 60 + ((i * 53) % 110);
      const pulse = rm ? 0.75 : 0.5 + 0.5 * Math.sin(t * 0.33 + i * 2.3);
      ctx.globalAlpha = (0.1 + 0.14 * pulse) * look.rays;
      ctx.save();
      ctx.translate(x, -30);
      ctx.rotate(-angle);
      ctx.drawImage(ray, -w / 2, 0, w, len);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
  }

  drawAgent(ctx, a, t, rm) {
    const m = a.m;
    const mv = this.app.state.unlocks.mutations && m.mutation ? MUTATION_BY_ID[m.mutation.mutationId]?.visual : null;
    const sy = this.squishOf(a, t, rm);
    const sx = 1 / Math.sqrt(sy) * (sy < 1 ? 1 + (1 - sy) * 0.6 : 1);
    drawMushroom(ctx, m, a.x - FULL_W / 2, a.y - FULL_H, t, { smooth: true, size: MUSHROOM_SCALE, squish: { sx, sy }, flip: a.flip, mutationVisual: mv, reducedMotion: rm });
    const top = a.y - (FULL_H - mushroomSprite(m).top) * MUSHROOM_SCALE * sy;
    if (a.carry) { ctx.fillStyle = '#2a1a10'; ctx.fillRect(a.x - 2.5, top - 5, 5, 5); ctx.fillStyle = a.carry; ctx.fillRect(a.x - 1.5, top - 4, 3, 3); }
    if (a.mode === 'work' && !rm) {
      const col = ANIM_FX[a.anim] || '#fff';
      const ph = (t * 1.5 + a.seed) % 1;
      ctx.fillStyle = col;
      if (a.anim === 'water') ctx.fillRect(a.x + 6, a.y - 9 + ph * 7, 1, 2);
      else if (a.anim === 'spores') { ctx.globalAlpha = 1 - ph; ctx.fillRect(a.x - 4 + ph * 8, a.y - 13 - ph * 5, 1, 1); ctx.fillRect(a.x + 3 - ph * 5, a.y - 10 - ph * 4, 1, 1); ctx.globalAlpha = 1; }
      else if (a.anim === 'hammer') { if (ph < 0.2) { ctx.fillRect(a.x + 7, a.y - 8, 2, 1); ctx.fillRect(a.x + 8, a.y - 9, 1, 1); } }
      else if (a.anim === 'dig') ctx.fillRect(a.x + 5 + ph * 3, a.y - 3 - Math.sin(ph * 3) * 4, 1, 1);
      else if (a.anim === 'glow') { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); ctx.fillRect(a.x - 6, a.y - 14, 1, 1); ctx.fillRect(a.x + 6, a.y - 12, 1, 1); ctx.globalAlpha = 1; }
      else if (a.anim === 'tend') { if (ph < 0.5) ctx.fillRect(a.x + 5, a.y - 17 + ph * 3, 2, 2); }
    }
    if (a.mode === 'sleep') {
      ctx.fillStyle = '#e0e8ff';
      const z = rm ? 0 : (t % 2);
      ctx.fillRect(a.x + 8, top - 2 - z * 2, 3, 1);
      ctx.fillRect(a.x + 10, top - 1 - z * 2, 1, 1);
      ctx.fillRect(a.x + 8, top - z * 2, 3, 1);
    }
    if (a.kind === 'guest' || a.kind === 'wild') {
      ctx.fillStyle = a.kind === 'guest' ? '#8fd8ff' : '#9ae07a';
      ctx.fillRect(a.x - 1.5, top - 6 + (rm ? 0 : Math.sin(t * 3)), 3, 3);
    }
  }
}

/** A spore cluster growing in a pen; it glows and bobs when ready to hatch. */
// ground layering for blends: lower types first
const LAYER_ORDER = ['g', 'h', 'm', 'l', 'd', 's', 'x', 'p', 'w', 'r'];
const LAYER_RANK = (code) => { const i = LAYER_ORDER.indexOf(code); return i < 0 ? LAYER_ORDER.length : i; };
const STEPS = 4;
const WET = new Set(['w', 'r']);
function smoothNoise(x, y, s) {
  const x0 = Math.floor(x); const y0 = Math.floor(y);
  const fx = x - x0; const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
  const a = hashNoise(x0, y0, s); const b = hashNoise(x0 + 1, y0, s);
  const c = hashNoise(x0, y0 + 1, s); const d = hashNoise(x0 + 1, y0 + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
function hashNoise(x, y, s) {
  let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** A soft pulsing glow on the ground under something ready to restore. */
function drawReadyGlow(ctx, x, y, t, rm) {
  const a = rm ? 0.32 : 0.22 + 0.14 * Math.sin(t * 3);
  const g = ctx.createRadialGradient(x, y, 1, x, y, 14);
  g.addColorStop(0, `rgba(255,215,94,${a})`);
  g.addColorStop(1, 'rgba(255,215,94,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 14, y - 14, 28, 28);
}

/** A chunky pixel arrow pointing down at (x, y), bobbing. */
function drawReadyArrow(ctx, x, y, t, rm) {
  const bob = rm ? 0 : Math.round(Math.sin(t * 4) * 2);
  const top = y - 14 + bob;
  const px = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x) + dx, top + dy, w, h); };
  // outline, then fill, then a highlight
  px(-3, -1, 6, 6, '#5a3a00'); px(-6, 4, 12, 2, '#5a3a00'); px(-5, 6, 10, 1, '#5a3a00'); px(-4, 7, 8, 1, '#5a3a00'); px(-3, 8, 6, 1, '#5a3a00'); px(-2, 9, 4, 1, '#5a3a00'); px(-1, 10, 2, 1, '#5a3a00');
  px(-2, 0, 4, 5, '#ffd75e'); px(-5, 5, 10, 1, '#ffd75e'); px(-4, 6, 8, 1, '#ffd75e'); px(-3, 7, 6, 1, '#ffd75e'); px(-2, 8, 4, 1, '#ffd75e'); px(-1, 9, 2, 1, '#ffd75e');
  px(-2, 0, 1, 5, '#fff4b0'); px(-4, 5, 2, 1, '#fff4b0');
}

function drawCluster(ctx, x, y, ready, t, rm) {
  const p = rm ? 0 : Math.sin(t * (ready ? 6 : 2)) * (ready ? 1 : 0.5);
  if (ready) {
    const a = rm ? 0.5 : 0.35 + 0.25 * Math.sin(t * 4);
    ctx.fillStyle = `rgba(255,215,94,${a})`;
    ctx.beginPath(); ctx.arc(x, y - 2 + p, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#e8d8f0'; ctx.fillRect(x - 3, y - 4 + p, 6, 5);
  ctx.fillStyle = '#c8a8e0'; ctx.fillRect(x - 2, y - 5 + p, 4, 1);
  ctx.fillStyle = '#b88ad8'; ctx.fillRect(x - 4, y - 1 + p, 2, 2); ctx.fillRect(x + 2, y - 2 + p, 2, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 3 + p, 1, 1);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Fill the view with `img` repeating every (tw, th) world px, scrolled by (offX, offY). Seamless. */
function tile(ctx, img, tw, th, offX, offY, view) {
  if (!img._pattern) img._pattern = ctx.createPattern(img, 'repeat');
  const pat = img._pattern;
  if (!pat) return;
  pat.setTransform(new DOMMatrix().translateSelf(offX, offY).scaleSelf(tw / img.width, th / img.height));
  ctx.fillStyle = pat;
  ctx.fillRect(view.x0, view.y0, view.w, view.h);
}

/** Dense, dark undergrowth: staggered rows of hedge, tileable in both directions. */
function makeFoliage(img) {
  const rowH = 64; // texture px per row of bushes
  const sw = Math.round(img.naturalWidth * (rowH / img.naturalHeight));
  const step = Math.round(rowH * 0.55);
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = step * 2;
  const x = c.getContext('2d');
  x.fillStyle = '#132219';
  x.fillRect(0, 0, c.width, c.height);
  for (let k = -2; k <= 2; k++) {
    const off = (((k % 2) + 2) % 2) * (sw / 2);
    for (const dx of [off - sw, off]) x.drawImage(img, dx, k * step - rowH * 0.3, sw, rowH);
  }
  // deepen it so the clearings stand out, then scatter a few berries and blossoms
  x.fillStyle = 'rgba(6, 14, 9, 0.38)';
  x.fillRect(0, 0, c.width, c.height);
  const dots = ['#c85a6a', '#e0c060', '#b8a0e0', '#e8e0d0'];
  for (let i = 0; i < 6; i++) {
    x.fillStyle = dots[i % dots.length];
    x.globalAlpha = 0.7;
    x.fillRect(Math.round((i * 53 + 17) % sw), Math.round((i * 31 + 9) % c.height), 2, 2);
  }
  x.globalAlpha = 1;
  c.world = FOLIAGE_ROW / rowH; // world px per texture px
  return c;
}

/** Split the canopy mask into a dark shade layer and a light-gap layer, both seamlessly tileable. */
function makeCanopy(img) {
  // the mask is soft, so half resolution looks identical and draws much faster
  const w = Math.round(img.naturalWidth / 2);
  const h = Math.round(img.naturalHeight / 2);
  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0, w, h);
  const data = sctx.getImageData(0, 0, w, h);
  const shade = new ImageData(w, h);
  const light = new ImageData(w, h);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = data.data[i]; // 255 = leaf shadow, 0 = gap
    shade.data[i] = 70; shade.data[i + 1] = 96; shade.data[i + 2] = 84; shade.data[i + 3] = v;
    light.data[i] = 255; light.data[i + 1] = 255; light.data[i + 2] = 255; light.data[i + 3] = 255 - v;
  }
  const toCanvas = (img2) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(img2, 0, 0); return mirrorTile(c); };
  return { shade: toCanvas(shade), light: toCanvas(light) };
}

/** A copy of `src` filled with one colour (kept in `cache`). */
function tinted(src, rgb, cache) {
  const key = 'tint' + rgb.join(',');
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  x.fillRect(0, 0, c.width, c.height);
  cache.set(key, c);
  return c;
}

/** A soft beam: brightest down its middle, fading along its length. */
function makeRay(rgb) {
  const W = 64;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const along = Math.min(1, v * 6) * Math.pow(1 - v, 1.4);
    for (let i = 0; i < W; i++) {
      const u = (i - W / 2) / (W / 2);
      const a = Math.exp(-u * u * 3.2) * along;
      const k = (y * W + i) * 4;
      img.data[k] = rgb[0]; img.data[k + 1] = rgb[1]; img.data[k + 2] = rgb[2]; img.data[k + 3] = Math.round(a * 255);
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

/** 2×2 mirrored copy of an image: tiles seamlessly. */
function mirrorTile(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.save(); x.translate(w * 2, 0); x.scale(-1, 1); x.drawImage(img, 0, 0); x.restore();
  x.save(); x.translate(0, h * 2); x.scale(1, -1); x.drawImage(img, 0, 0); x.restore();
  x.save(); x.translate(w * 2, h * 2); x.scale(-1, -1); x.drawImage(img, 0, 0); x.restore();
  return c;
}

export { conditionsAt };
