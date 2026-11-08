// Forest scene: a full-screen, pannable and zoomable camera over the current
// area. Tiles, structures, gliding mushrooms with squash-and-stretch, day/night
// and rain. Visual only — it reads the simulation and never decides outcomes.
import { AREA_W, AREA_H, STRUCTURES, JOB_BY_ID } from '../content/world.js';
import { MUTATION_BY_ID } from '../content/genetics.js';
import { getConfig } from '../config.js';
import { drawTile, drawStructure, drawArt, TILE } from './world.js';
import { drawMushroom, SPRITE_W, SPRITE_H, resourceColor } from './sprites.js';
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
const CANOPY_TILE = 300; // logical px covered by one copy of the canopy shadow

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
    this.fitZoom = Math.max(0.5, fitTo(LW, LH));
    const b = this.bounds();
    this.forestZoom = Math.max(0.25, Math.min(this.fitZoom, fitTo(b.x1 - b.x0, b.y1 - b.y0)));
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

  /** Signposts at every open edge of every clearing: where the forest can grow. */
  signposts() {
    const out = [];
    const G = this.app.game;
    for (const { id, area, ox, oy } of this.areas()) {
      for (const dir of ['north', 'east', 'south', 'west']) {
        const d = G.DIRECTIONS[dir];
        if (G.areaAt(this.app.state, area.cx + d.dx, area.cy + d.dy)) continue;
        const x = ox + LW / 2 + d.dx * (LW / 2 + 10);
        const y = oy + LH / 2 + d.dy * (LH / 2 + 10) + 8;
        out.push({ areaId: id, dir, x, y, ready: G.expansionOption(this.app.state, id, dir).ok });
      }
    }
    return out;
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
    const post = this.signposts().find((sp) => Math.abs(w.x - sp.x) < 10 && w.y > sp.y - 20 && w.y < sp.y + 4);
    if (post) { this.app.onTapSignpost(post.areaId, post.dir); return; }
    if (!inArea) return;
    const obj = this.app.state.world.areas[t.areaId].objects.find((o) => o.x === t.x && o.y === t.y);
    if (obj) this.app.onTapObject(obj.id);
  }

  // ------------------------------------------------------------- mushrooms
  population() {
    const s = this.app.state;
    const out = [];
    const objIds = new Set();
    for (const a of Object.values(s.world.areas)) for (const o of a.objects) objIds.add(o.id);
    for (const m of s.mushrooms) {
      if (m.status !== 'resident') continue;
      if (m.work && objIds.has(m.work.structureId)) out.push({ m, kind: 'worker' });
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
    const offsets = [[-6, 18], [22, 18], [8, 22]];
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
  /** Trees and undergrowth filling the empty cells around the forest's clearings. */
  woods() {
    const areas = Object.values(this.app.state.world.areas);
    const sig = areas.map((a) => a.cx + ',' + a.cy).sort().join(';');
    if (this.woodsSig === sig) return this.woodsCache;
    const occ = new Set(areas.map((a) => a.cx + ',' + a.cy));
    const cells = new Set();
    for (const a of areas) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const k = (a.cx + dx) + ',' + (a.cy + dy);
      if (!occ.has(k)) cells.add(k);
    }
    const small = ['bush', 'fern', 'flowers', 'stones', 'log', 'fern', 'flowers'];
    const out = [];
    for (const k of cells) {
      const [cx, cy] = k.split(',').map(Number);
      const rng = makeRng(hash('woods', k));
      const near = { n: occ.has(cx + ',' + (cy - 1)), s: occ.has(cx + ',' + (cy + 1)), w: occ.has((cx - 1) + ',' + cy), e: occ.has((cx + 1) + ',' + cy) };
      const touching = near.n || near.s || near.w || near.e;
      for (let i = 0; i < 26; i++) {
        const lx = rng.next() * LW;
        const ly = rng.next() * LH;
        // leave room at edges that face a clearing (and its signpost)
        if ((near.n && ly < 26) || (near.s && ly > LH - 12) || (near.w && lx < 14) || (near.e && lx > LW - 22)) continue;
        if (touching && Math.hypot(lx - LW / 2, ly - LH / 2) < 30) { /* centre of an open cell: keep mixed */ }
        const treeChance = touching ? 0.4 : 0.7;
        const kind = rng.chance(treeChance) ? (rng.chance(0.5) ? 'tree' : 'pine') : rng.pick(small);
        out.push({ x: Math.round(cx * LW + lx), y: Math.round(cy * LH + ly), kind });
      }
    }
    this.woodsSig = sig;
    this.woodsCache = out;
    return out;
  }

  terrainFor(id, area, t, rm) {
    let c = this.terrainCaches.get(id);
    if (!c) {
      c = { key: null, canvas: document.createElement('canvas') };
      c.canvas.width = LW;
      c.canvas.height = LH;
      this.terrainCaches.set(id, c);
    }
    const key = area.tiles.join('') + (rm ? 0 : Math.floor(t * 2));
    if (c.key !== key) {
      const tctx = c.canvas.getContext('2d');
      tctx.clearRect(0, 0, LW, LH);
      for (let y = 0; y < AREA_H; y++) for (let x = 0; x < AREA_W; x++) drawTile(tctx, area.tiles[y][x], x, y, rm ? 0 : t, 0, true);
      c.key = key;
    }
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#4f7a38';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, ox, oy);

    // 1. grass everywhere in view (smooth when shrinking the painting, crisp when enlarging it)
    if (this.grassTile) {
      const gt = this.grassTile;
      const tw = GRASS_TILE * 2;
      const th = tw * (gt.height / gt.width);
      ctx.imageSmoothingEnabled = k * (GRASS_TILE / this.grass.naturalWidth) < 1.2;
      ctx.imageSmoothingQuality = 'high';
      for (let gy = Math.floor(view.y0 / th) * th; gy < view.y0 + view.h; gy += th) {
        for (let gx = Math.floor(view.x0 / tw) * tw; gx < view.x0 + view.w; gx += tw) ctx.drawImage(gt, gx, gy, tw + 0.5 / k, th + 0.5 / k);
      }
    }
    ctx.imageSmoothingEnabled = false;

    // 2. terrain of every clearing in view
    const areas = this.areas();
    for (const a of areas) {
      if (a.ox > view.x0 + view.w || a.ox + LW < view.x0 || a.oy > view.y0 + view.h || a.oy + LH < view.y0) continue;
      ctx.drawImage(this.terrainFor(a.id, a.area, t, rm), a.ox, a.oy);
    }

    // 3. depth-sorted: woods, signposts, structures, mushrooms
    const items = [];
    for (const d of this.woods()) if (inView(d.x, d.y)) items.push({ y: d.y + TILE, draw: () => drawArt(ctx, d.kind, d.x, d.y, rm ? 0 : t) });
    if (!this.postCache || t - this.postCache.t > 0.5) this.postCache = { t, posts: this.signposts() };
    for (const sp of this.postCache.posts) if (inView(sp.x, sp.y)) items.push({ y: sp.y, draw: () => drawSignpost(ctx, sp, t, rm) });
    for (const a of areas) {
      for (const o of a.area.objects) {
        if (!inView(a.ox + o.x * TILE, a.oy + o.y * TILE)) continue;
        items.push({ y: a.oy + o.y * TILE + TILE, draw: () => { ctx.save(); ctx.translate(a.ox, a.oy); drawStructure(ctx, STRUCTURES[o.def], o.x, o.y, o.state, rm ? 0 : t); ctx.restore(); } });
      }
    }
    for (const ag of this.agents.values()) if (inView(ag.x, ag.y)) items.push({ y: ag.y, draw: () => this.drawAgent(ctx, ag, t, rm) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();

    // 4. light through the treetops: drifting canopy shade with sunlit gaps
    const lightOn = s.settings.canopyLight !== false;
    if (lightOn && this.canopy) this.drawCanopy(ctx, view, t, rm);

    // 5. build overlay: tile grid on every clearing
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
          ctx.strokeRect(o.x + ht.x * TILE, o.y + ht.y * TILE, TILE, TILE);
        }
      }
      if (this.app.buildTool.kind === 'move' && this.app.buildTool.objectId) {
        const f = this.app.game.objectById(s, this.app.buildTool.objectId);
        if (f) { const o = this.areaOrigin(f.areaId); ctx.strokeStyle = '#8fd8ff'; ctx.strokeRect(o.x + f.obj.x * TILE, o.y + f.obj.y * TILE, TILE, TILE); }
      }
    }

    // 6. pop-ups
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

    // 7. time of day and weather, across the whole screen
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

  /** Canopy shade over everything, in world space so it pans and zooms with the forest. */
  drawCanopy(ctx, view, t, rm) {
    const cond = this.app.conditions;
    const look = CANOPY[cond.phase] || CANOPY.day;
    const c = this.canopy;
    const tw = CANOPY_TILE * 2;
    const th = tw * (c.shade.height / c.shade.width);
    // two layers drifting in different directions make the light gaps slowly change shape
    const drift = (k) => (rm ? { x: 0, y: 0 } : { x: t * 2.2 * k + Math.sin(t * 0.13 * k) * 10, y: t * 0.9 * k + Math.cos(t * 0.11 * k) * 7 });
    const d1 = drift(1);
    const d2 = drift(-0.7);
    ctx.imageSmoothingEnabled = true;
    // leaf shade multiplies, so the greens stay rich instead of turning grey
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = look.shade * 1.3;
    tile(ctx, c.shade, tw, th, d1.x, d1.y, view);
    ctx.globalAlpha = look.shade * 0.9;
    tile(ctx, c.shade, tw * 1.37, th * 1.37, d2.x + 97, d2.y + 41, view);
    // sunlit gaps: warm, brightened ground where the leaves part
    const rain = cond.raining ? 0.35 : 1;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = Math.min(1, look.light * 2.2 * rain);
    tile(ctx, tinted(c.light, look.tint, this.rayCache), tw, th, d1.x, d1.y, view);
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
    drawMushroom(ctx, m, a.x - SPRITE_W / 2, a.y - SPRITE_H, t, { smooth: true, squish: { sx, sy }, flip: a.flip, mutationVisual: mv, reducedMotion: rm });
    const top = a.y - SPRITE_H * sy;
    if (a.carry) { ctx.fillStyle = '#2a1a10'; ctx.fillRect(a.x - 2.5, top - 5, 5, 5); ctx.fillStyle = a.carry; ctx.fillRect(a.x - 1.5, top - 4, 3, 3); }
    if (a.mode === 'work' && !rm) {
      const col = ANIM_FX[a.anim] || '#fff';
      const ph = (t * 1.5 + a.seed) % 1;
      ctx.fillStyle = col;
      if (a.anim === 'water') ctx.fillRect(a.x + 9, a.y - 14 + ph * 10, 1, 2);
      else if (a.anim === 'spores') { ctx.globalAlpha = 1 - ph; ctx.fillRect(a.x - 6 + ph * 12, a.y - 20 - ph * 8, 1, 1); ctx.fillRect(a.x + 4 - ph * 8, a.y - 16 - ph * 6, 1, 1); ctx.globalAlpha = 1; }
      else if (a.anim === 'hammer') { if (ph < 0.2) { ctx.fillRect(a.x + 10, a.y - 12, 2, 1); ctx.fillRect(a.x + 12, a.y - 14, 1, 1); } }
      else if (a.anim === 'dig') ctx.fillRect(a.x + 8 + ph * 4, a.y - 4 - Math.sin(ph * 3) * 6, 1, 1);
      else if (a.anim === 'glow') { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); ctx.fillRect(a.x - 9, a.y - 22, 1, 1); ctx.fillRect(a.x + 9, a.y - 18, 1, 1); ctx.globalAlpha = 1; }
      else if (a.anim === 'tend') { if (ph < 0.5) ctx.fillRect(a.x + 8, a.y - 26 + ph * 4, 2, 2); }
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

/** A little wooden signpost pointing the way the forest could grow. */
function drawSignpost(ctx, sp, t, rm) {
  const x = sp.x;
  const y = sp.y;
  const bob = sp.ready && !rm ? Math.sin(t * 4) * 0.8 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 4, y - 1, 8, 2);
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(x - 1, y - 14, 2, 14);
  if (sp.ready) {
    ctx.fillStyle = `rgba(255,215,94,${rm ? 0.5 : 0.35 + 0.25 * Math.sin(t * 4)})`;
    ctx.fillRect(x - 9, y - 22 + bob, 18, 11);
  }
  ctx.fillStyle = sp.ready ? '#e0b060' : '#b07a44';
  ctx.fillRect(x - 7, y - 20 + bob, 14, 7);
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(x - 7, y - 14 + bob, 14, 1);
  // arrow
  ctx.fillStyle = '#3a240e';
  const ay = y - 17 + bob;
  const dirs = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] };
  const [dx, dy] = dirs[sp.dir];
  if (dx) {
    ctx.fillRect(x - 4, ay, 8, 1);
    ctx.fillRect(x + 3 * dx, ay - 1, 1, 3);
    ctx.fillRect(x + 2 * dx, ay - 2, 1, 5);
  } else {
    ctx.fillRect(x, ay - 2, 1, 5);
    ctx.fillRect(x - 1, ay + 1 * dy, 3, 1);
    ctx.fillRect(x - 2, ay + 0 * dy, 5, 1);
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Fill the view with `img` repeating every (tw, th) world px, scrolled by (offX, offY). Seamless. */
function tile(ctx, img, tw, th, offX, offY, view) {
  if (!img._pattern) img._pattern = ctx.createPattern(img, 'repeat');
  const pat = img._pattern;
  pat.setTransform(new DOMMatrix().translateSelf(offX, offY).scaleSelf(tw / img.width, th / img.height));
  ctx.fillStyle = pat;
  ctx.fillRect(view.x0, view.y0, view.w, view.h);
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
