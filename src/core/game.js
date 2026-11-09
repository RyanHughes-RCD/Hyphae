// Game state and actions. Pure simulation: no DOM. Every function takes an
// explicit `now` so it is testable and refresh-safe (GDD 13.4, 20).
import { getConfig, STATS } from '../config.js';
import { CATEGORIES } from '../content/attributes.js';
import { PERK_BY_ID, MUTATION_BY_ID } from '../content/genetics.js';
import {
  JOBS, JOB_BY_ID, STRUCTURES, RESOURCES, STAGES, STAGE_BY_ID, STAGE_IDS, PROJECTS, BREEDING_STATIONS,
  RESOURCE_IDS, TERRAIN, AREA_W, AREA_H, PAINTABLE_TERRAIN, TERRAIN_PAINT_COST, GLADE_THEME, THICKET_CLEAR, sizeOf,
} from '../content/world.js';
import { hash, hashHex, makeRng, freshSeed } from './rng.js';
import { computeStats, colorFamily } from './stats.js';
import { generateStarters, generateWildVisitor, resolveBreeding } from './genetics.js';
import { conditionsAt, localParts, currentTzOffset } from './time.js';

export const SCHEMA_VERSION = 5;
const HOUR = 3600000;
const MIN = 60000;

// ---------------------------------------------------------------- new game

export function newGame({ now = Date.now(), seed = freshSeed(), forestName = 'My Forest', tzOffset = currentTzOffset() } = {}) {
  const cfg = getConfig();
  const forest = { id: 'f_' + hashHex(seed, 'forest'), name: forestName };
  const state = {
    schemaVersion: SCHEMA_VERSION,
    configVersion: cfg.configVersion,
    forest,
    createdAt: now,
    lastSeenAt: now,
    tzOffset,
    worldSeed: 'w' + hashHex(seed, 'world'),
    rngRoot: 'r' + hashHex(seed, 'rng'),
    breedingCounter: 0,
    breedingsStarted: 0,
    breedingsCompleted: 0,
    glimmer: cfg.economy.startingGlimmer,
    glimmerCarry: 0,
    inventory: Object.fromEntries(RESOURCE_IDS.map((r) => [r, 0])),
    mushrooms: generateStarters(seed, forest, now),
    guests: [],
    wildVisitors: [],
    lastVisitorSlot: Math.floor(now / (cfg.world.wildVisitorSlotHours * HOUR)),
    breedings: [],
    station: 'breeding_nook',
    world: { areas: {} },
    nextObjectId: 1,
    projects: {},
    counters: { jobCycles: {}, moonstoneCycles: 0 },
    discoveries: { moonstone: false, attributes: {}, colorFamilies: {}, perks: {}, mutations: {}, traitStats: {}, synergies: {}, jobs: {} },
    unlocks: { traits: false, perks: false, mutations: false },
    flags: { firstTraitGranted: false },
    cleanup: null,
    trade: { dateKey: null, sold: {} },
    tutorials: {},
    importedShareIds: [],
    settings: { sound: false, reducedMotion: false, dev: false, autoJobs: true },
    dev: { timeOffset: 0, override: null, force: {} },
    activity: [],
  };
  for (const r of ['twigs', 'leaves']) state.inventory[r] = 4;
  createStartClearing(state, now);
  for (const m of state.mushrooms) recordDiscovery(state, m);
  autoAssign(state, now);
  event(state, 'welcome', 'Welcome to your forest', 'Three little mushrooms have made the clearing their home and have already found the jobs that suit them best. When you have a few twigs and leaves, buy a Breeding Pen from the Store and put it down to start breeding.');
  return state;
}

// ---------------------------------------------------------------- helpers

export function event(state, type, title, text) {
  if (!state._events) Object.defineProperty(state, '_events', { value: [], enumerable: false, writable: true });
  state._events.push({ type, title, text });
  state.activity.unshift({ t: state.lastSeenAt, title });
  if (state.activity.length > 40) state.activity.length = 40;
}

export function takeEvents(state) {
  const ev = state._events || [];
  state._events = [];
  return ev;
}

export function canAfford(state, cost = {}) {
  return Object.entries(cost).every(([r, n]) => (r === 'glimmer' ? state.glimmer : state.inventory[r] ?? 0) >= n);
}

function pay(state, cost = {}) {
  for (const [r, n] of Object.entries(cost)) {
    if (r === 'glimmer') state.glimmer -= n;
    else state.inventory[r] -= n;
  }
}

const fail = (reason) => ({ ok: false, reason });
const ok = (extra = {}) => ({ ok: true, ...extra });

export function findMushroom(state, uid) {
  return state.mushrooms.find((m) => m.uid === uid)
    || state.guests.find((m) => m.uid === uid)
    || state.wildVisitors.find((v) => v.mushroom.uid === uid)?.mushroom
    || null;
}

export function isOwned(state, uid) {
  return state.mushrooms.some((m) => m.uid === uid);
}

export function allObjects(state) {
  const out = [];
  for (const [areaId, area] of Object.entries(state.world.areas)) for (const o of area.objects) out.push({ ...o, areaId, ref: o });
  return out;
}

export function objectById(state, id) {
  for (const [areaId, area] of Object.entries(state.world.areas)) {
    const o = area.objects.find((x) => x.id === id);
    if (o) return { obj: o, areaId };
  }
  return null;
}

export function getUnlocks(state) {
  return state.unlocks;
}

export function statsOf(state, m) {
  return computeStats(m, { traits: state.unlocks.traits, mutations: state.unlocks.mutations });
}

// ---------------------------------------------------------------- world: one forest of clearings
//
// The forest is a grid of clearings (AREA_W × AREA_H tiles each). The starting
// clearing sits at chunk (0, 0). Story clearings are keyed by their stage id;
// extra plain clearings are keyed "c1", "c2", …  The forest grows when the
// player expands it north, east, south or west of a clearing (decision D-16).

export const DIRECTIONS = {
  north: { dx: 0, dy: -1, label: 'North', arrow: '↑' },
  east: { dx: 1, dy: 0, label: 'East', arrow: '→' },
  south: { dx: 0, dy: 1, label: 'South', arrow: '↓' },
  west: { dx: -1, dy: 0, label: 'West', arrow: '←' },
};

export function areaAt(state, cx, cy) {
  for (const [id, a] of Object.entries(state.world.areas)) if (a.cx === cx && a.cy === cy) return { id, area: a };
  return null;
}

export function areaName(id) {
  return STAGE_BY_ID[id]?.name || 'Quiet Glade';
}

const EDGE_MID = {
  north: { x: Math.floor(AREA_W / 2), y: 0 },
  south: { x: Math.floor(AREA_W / 2), y: AREA_H - 1 },
  west: { x: 0, y: Math.floor(AREA_H / 2) },
  east: { x: AREA_W - 1, y: Math.floor(AREA_H / 2) },
};
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

/** Lay a path from a clearing's centre to one of its edges (only over soft ground). */
function carvePath(area, dir) {
  const c = { x: Math.floor(AREA_W / 2), y: Math.floor(AREA_H / 2) };
  const e = EDGE_MID[dir];
  const set = (x, y) => {
    const t = area.tiles[y][x];
    if ('gmldhu'.includes(t)) setTile(area, x, y, 'p');
  };
  for (let x = Math.min(c.x, e.x); x <= Math.max(c.x, e.x); x++) set(x, c.y);
  for (let y = Math.min(c.y, e.y); y <= Math.max(c.y, e.y); y++) set(e.x, y);
}

export function setTile(area, x, y, code) {
  area.tiles[y] = area.tiles[y].slice(0, x) + code + area.tiles[y].slice(x + 1);
}

/** Smooth value noise in [0, 1) for organic patches of ground. */
function valueNoise(seed, x, y, scale) {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const r = (a, b) => hash(seed, a, b) / 4294967296;
  const sm = (t) => t * t * (3 - 2 * t);
  const top = r(x0, y0) + (r(x0 + 1, y0) - r(x0, y0)) * sm(fx);
  const bot = r(x0, y0 + 1) + (r(x0 + 1, y0 + 1) - r(x0, y0 + 1)) * sm(fx);
  return top + (bot - top) * sm(fy);
}

/**
 * A wild, randomly generated clearing: patchy themed ground, thicket creeping
 * in from every open edge, optional lakes, then (by the caller) a river,
 * a path in from the neighbour, structures and clutter.
 */
function generateTiles(state, theme, cx, cy, openSides, seed) {
  const codes = Object.keys(theme.ground);
  const weights = codes.map((c) => theme.ground[c]);
  const total = weights.reduce((a, b) => a + b, 0);
  const rows = [];
  for (let y = 0; y < AREA_H; y++) {
    let row = '';
    for (let x = 0; x < AREA_W; x++) {
      const gx = cx * AREA_W + x;
      const gy = cy * AREA_H + y;
      // patches: low-frequency noise picks the ground, a little fine noise roughens the patch edges
      let v = (valueNoise(seed + 'g', gx, gy, 3.2) * 0.8 + valueNoise(seed + 'f', gx, gy, 1.3) * 0.2) * total;
      let code = codes[codes.length - 1];
      for (let i = 0; i < codes.length; i++) { v -= weights[i]; if (v < 0) { code = codes[i]; break; } }
      // thicket creeps in from open edges with a ragged front, plus a few clumps inside
      const dEdge = Math.min(
        openSides.west ? x : 99, openSides.east ? AREA_W - 1 - x : 99,
        openSides.north ? y : 99, openSides.south ? AREA_H - 1 - y : 99,
      );
      const n = valueNoise(seed + 't', gx, gy, 2.1);
      const reach = theme.thicket * 3.2 * n;
      if (dEdge < reach || (n > 0.86 && valueNoise(seed + 'c', gx, gy, 1.7) > 0.55)) code = 'u';
      row += code;
    }
    rows.push(row);
  }
  const area = { tiles: rows };
  // lakes
  const rng = makeRng(hash(seed, 'lakes'));
  for (let i = 0; i < (theme.lakes || 0); i++) {
    const lx = rng.int(2, AREA_W - 3);
    const ly = rng.int(2, AREA_H - 3);
    const rx = rng.range(1.2, 2.4);
    const ry = rng.range(1, 1.8);
    for (let y = 0; y < AREA_H; y++) for (let x = 0; x < AREA_W; x++) {
      if (((x - lx) / rx) ** 2 + ((y - ly) / ry) ** 2 <= 1) setTile(area, x, y, 'w');
    }
  }
  return area.tiles;
}

const SIDES = {
  north: { dx: 0, dy: -1, edge: (i) => ({ x: i, y: 0 }), len: AREA_W },
  south: { dx: 0, dy: 1, edge: (i) => ({ x: i, y: AREA_H - 1 }), len: AREA_W },
  west: { dx: -1, dy: 0, edge: (i) => ({ x: 0, y: i }), len: AREA_H },
  east: { dx: 1, dy: 0, edge: (i) => ({ x: AREA_W - 1, y: i }), len: AREA_H },
};

/**
 * Grow the river into a new clearing. It continues from any neighbour whose
 * river already reaches the shared edge; otherwise it rises from a spring.
 * It then meanders out through a random open side, ready to grow further.
 */
function carveRiver(state, area, cx, cy, openSides, rng) {
  let start = null;
  for (const [dir, side] of Object.entries(SIDES)) {
    const n = areaAt(state, cx + side.dx, cy + side.dy);
    if (!n) continue;
    const opp = SIDES[OPPOSITE[dir]];
    for (let i = 0; i < side.len && !start; i++) {
      const theirs = opp.edge(i);
      if (n.area.tiles[theirs.y][theirs.x] === 'r') start = side.edge(i);
    }
  }
  if (!start) {
    // a spring: a small pool somewhere inside
    start = { x: rng.int(2, AREA_W - 3), y: rng.int(2, AREA_H - 3) };
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setTile(area, Math.min(AREA_W - 1, start.x + dx), Math.min(AREA_H - 1, start.y + dy), 'w');
  }
  const exits = Object.keys(openSides).filter((d) => openSides[d]);
  const exitDir = exits.length ? rng.pick(exits) : rng.pick(Object.keys(SIDES));
  const side = SIDES[exitDir];
  const goal = side.edge(rng.int(1, side.len - 2));
  let { x, y } = start;
  const seen = new Set();
  for (let steps = 0; steps < 80; steps++) {
    if (area.tiles[y][x] !== 'w') setTile(area, x, y, 'r');
    seen.add(x + ',' + y);
    if (x === goal.x && y === goal.y) break;
    const toward = [];
    if (goal.x !== x) toward.push([Math.sign(goal.x - x), 0]);
    if (goal.y !== y) toward.push([0, Math.sign(goal.y - y)]);
    const all = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let [dx, dy] = rng.chance(0.68) && toward.length ? rng.pick(toward) : rng.pick(all);
    let nx = x + dx;
    let ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= AREA_W || ny >= AREA_H || seen.has(nx + ',' + ny)) {
      [dx, dy] = toward[0] || [0, 0];
      nx = x + dx;
      ny = y + dy;
    }
    x = nx;
    y = ny;
  }
}

const CLUTTER = Object.entries(STRUCTURES).filter(([, d]) => d.kind === 'clutter').map(([id, d]) => ({ id, weight: d.weight }));

/** Random free land tiles for structures and clutter (spaced for structures). */
function landSpots(area) {
  const out = [];
  for (let y = 1; y <= AREA_H - 2; y++) for (let x = 1; x <= AREA_W - 2; x++) {
    const t = area.tiles[y][x];
    if (!TERRAIN[t]?.blocks && t !== 'p' && !objectAt(area, x, y)) out.push({ x, y });
  }
  return out;
}

function scatterObjects(state, area, defs, rng, kind) {
  for (const def of defs) {
    const spots = landSpots(area);
    if (!spots.length) return;
    const spaced = kind === 'ruin' ? rng.shuffle(spots).filter((p) => area.objects.every((q) => Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) >= 2)) : [];
    const spot = spaced[0] || rng.pick(spots);
    area.objects.push({ id: 'o' + state.nextObjectId++, def, x: spot.x, y: spot.y, state: kind === 'ruin' ? 'ruin' : 'built', prefab: kind === 'ruin' });
  }
}

function buildWildClearing(state, theme, cx, cy, entryDir, structures) {
  const seed = 'clr' + hash(state.worldSeed, 'clearing', cx, cy);
  const rng = makeRng(hash(seed, 'objects'));
  const openSides = {};
  for (const [dir, side] of Object.entries(SIDES)) openSides[dir] = !areaAt(state, cx + side.dx, cy + side.dy);
  const area = { cx, cy, tiles: generateTiles(state, theme, cx, cy, openSides, seed), objects: [] };
  carveRiver(state, area, cx, cy, openSides, makeRng(hash(seed, 'river')));
  carvePath(area, entryDir);
  scatterObjects(state, area, structures, rng, 'ruin');
  const clutterCount = rng.int(9, 15);
  scatterObjects(state, area, Array.from({ length: clutterCount }, () => rng.weighted(CLUTTER, (c) => c.weight).id), rng, 'clutter');
  return area;
}

function createStartClearing(state, now) {
  const st = STAGE_BY_ID.clearing;
  state.world.areas.clearing = {
    stage: 'clearing', cx: 0, cy: 0, discoveredAt: now, tiles: st.map.slice(),
    objects: st.objects.map((o) => ({ id: 'o' + state.nextObjectId++, def: o.def, x: o.x, y: o.y, state: o.state, prefab: true })),
  };
}

export function stageDiscovered(state, stageId) {
  return !!state.world.areas[stageId];
}

export function stageComplete(state, stageId) {
  const area = state.world.areas[stageId];
  if (!area) return false;
  return area.objects.filter((o) => o.prefab).every((o) => o.state === 'built');
}

export function jobUnlocked(state, jobId) {
  const job = JOB_BY_ID[jobId];
  if (!job) return false;
  return allObjects(state).some((o) => o.def === job.structure && o.state === 'built');
}

/** The next story clearing and how close the forest is to revealing it (strictly linear, D-15). */
export function nextStageInfo(state) {
  for (let i = 0; i < STAGES.length; i++) {
    const st = STAGES[i];
    if (stageDiscovered(state, st.id)) continue;
    const prev = STAGES[i - 1];
    const prevDone = prev ? stageComplete(state, prev.id) : true;
    const d = st.discover;
    let progress = 0;
    let target = 1;
    if (d.type === 'jobCycles') {
      progress = d.jobs.reduce((s, j) => s + (state.counters.jobCycles[j] || 0), 0);
      target = d.count;
    } else if (d.type === 'project') {
      const p = state.projects[d.project];
      progress = p?.state === 'done' ? 1 : 0;
    }
    progress = Math.min(progress, target);
    return { stage: st, prevDone, prevStage: prev, progress, target, ready: prevDone && progress >= target };
  }
  return null;
}

export function plainClearingCount(state) {
  return Object.values(state.world.areas).filter((a) => !a.stage || !STAGE_BY_ID[a.stage]).length;
}

export function plainExpansionCost(state) {
  const n = plainClearingCount(state);
  return { planks: 10 + 6 * n, stones: 8 + 4 * n };
}

/** What expanding in `dir` from clearing `fromId` would do right now. */
export function expansionOption(state, fromId, dir) {
  const from = state.world.areas[fromId];
  const d = DIRECTIONS[dir];
  if (!from || !d) return { ok: false, reason: 'Unknown direction.' };
  const cx = from.cx + d.dx;
  const cy = from.cy + d.dy;
  if (areaAt(state, cx, cy)) return { ok: false, occupied: true, reason: 'There is already a clearing that way.' };
  const info = nextStageInfo(state);
  if (info?.ready) return { ok: true, kind: 'stage', stage: info.stage, cx, cy, cost: {} };
  if (!stageComplete(state, 'workshop')) {
    return { ok: false, reason: info ? (info.prevDone ? info.stage.hint : `Restore everything in the ${info.prevStage.name} first.`) : 'Not ready yet.' };
  }
  const cost = plainExpansionCost(state);
  return { ok: canAfford(state, cost), kind: 'plain', cx, cy, cost, reason: canAfford(state, cost) ? null : 'Not enough materials for a new glade.', stageHint: info && !info.ready ? info : null };
}

export function expandForest(state, fromId, dir, now) {
  const opt = expansionOption(state, fromId, dir);
  if (!opt.ok) return fail(opt.reason);
  const from = state.world.areas[fromId];
  let id;
  let area;
  if (opt.kind === 'stage') {
    const st = opt.stage;
    id = st.id;
    area = buildWildClearing(state, st.theme, opt.cx, opt.cy, OPPOSITE[dir], st.objects.map((o) => o.def));
    area.stage = st.id;
  } else {
    pay(state, opt.cost);
    id = 'c' + (plainClearingCount(state) + 1);
    while (state.world.areas[id]) id += 'x';
    area = buildWildClearing(state, GLADE_THEME, opt.cx, opt.cy, OPPOSITE[dir], []);
    area.stage = null;
  }
  area.discoveredAt = now;
  carvePath(from, dir);
  // the neighbour's thicket along the shared edge gives way to the new clearing
  state.world.areas[id] = area;
  bumpWorld(state);
  if (opt.kind === 'stage') {
    const st = opt.stage;
    event(state, 'discovery', `Discovered: ${st.name}`, `${st.blurb} It's wild and overgrown: clear the clutter and thicket, bridge the river where you need to, then restore its structures to unlock new jobs.`);
    state.glimmer += getConfig().economy.milestoneGlimmer;
  } else event(state, 'expand', 'A new glade opens up', 'Clear it out to make room to build.');
  stopUnreachableWork(state);
  return ok({ id, area });
}

// ---------------------------------------------------------------- reachability (river & thicket)

export function bumpWorld(state) {
  state.world.version = (state.world.version || 0) + 1;
}

/** Tile code at global tile coordinates, or null outside the map. */
export function globalTile(state, gx, gy) {
  const cx = Math.floor(gx / AREA_W);
  const cy = Math.floor(gy / AREA_H);
  const a = areaAt(state, cx, cy);
  if (!a) return null;
  return a.area.tiles[gy - cy * AREA_H][gx - cx * AREA_W];
}

const reachCache = new WeakMap();

/** Global tiles mushrooms can walk to from home (water needs a bridge, thicket must be cleared). */
export function reachableTiles(state) {
  const v = state.world.version || 0;
  const hit = reachCache.get(state);
  if (hit && hit.v === v && hit.n === Object.keys(state.world.areas).length) return hit.set;
  const bridges = new Set();
  for (const a of Object.values(state.world.areas)) for (const o of a.objects) if (o.def === 'bridge') bridges.add((a.cx * AREA_W + o.x) + ',' + (a.cy * AREA_H + o.y));
  const home = state.world.areas.clearing;
  const start = [home.cx * AREA_W + 5, home.cy * AREA_H + 4];
  const set = new Set([start.join(',')]);
  const queue = [start];
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = nx + ',' + ny;
      if (set.has(k)) continue;
      const t = globalTile(state, nx, ny);
      if (t === null) continue;
      if (TERRAIN[t]?.blocks && !bridges.has(k)) continue;
      set.add(k);
      queue.push([nx, ny]);
    }
  }
  reachCache.set(state, { v, n: Object.keys(state.world.areas).length, set });
  return set;
}

export function isReachable(state, areaId, x, y) {
  const a = state.world.areas[areaId];
  if (!a) return false;
  return reachableTiles(state).has((a.cx * AREA_W + x) + ',' + (a.cy * AREA_H + y));
}

/** Can mushrooms get to a structure (standing on or right beside it)? */
export function objectReachable(state, objectId) {
  const f = objectById(state, objectId);
  if (!f) return false;
  return footprint(f.obj).some(([x, y]) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isReachable(state, f.areaId, x + dx, y + dy)));
}

function stopUnreachableWork(state) {
  for (const m of state.mushrooms) {
    if (m.work && !objectReachable(state, m.work.structureId)) {
      event(state, 'blocked', `${m.name} can't reach work`, 'The way is blocked by water or thicket. Build a bridge or clear a path.');
      m.work = null;
      if (m.jobPin && m.jobPin !== 'rest') m.jobPin = null;
    }
  }
}

// ---------------------------------------------------------------- cleaning up

export function clearClutter(state, objectId) {
  const f = objectById(state, objectId);
  if (!f) return fail('Unknown object.');
  const def = STRUCTURES[f.obj.def];
  if (def.kind !== 'clutter') return fail('That is not clutter.');
  if (def.needsStage && !stageComplete(state, def.needsStage)) return fail(`You need tools from the ${STAGE_BY_ID[def.needsStage].name} to clear this.`);
  if (!objectReachable(state, objectId)) return fail('Your mushrooms cannot reach it yet.');
  const area = state.world.areas[f.areaId];
  area.objects = area.objects.filter((o) => o.id !== objectId);
  for (const [r, n] of Object.entries(def.clear)) state.inventory[r] = (state.inventory[r] || 0) + n;
  bumpWorld(state);
  return ok({ gained: def.clear });
}

/** Cut back one tile of thicket next to land your mushrooms can reach. */
export function clearThicket(state, areaId, x, y) {
  const area = state.world.areas[areaId];
  if (area?.tiles[y]?.[x] !== 'u') return fail('No thicket there.');
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const gx = area.cx * AREA_W + x + dx;
    const gy = area.cy * AREA_H + y + dy;
    return reachableTiles(state).has(gx + ',' + gy);
  });
  if (!near) return fail('Clear the thicket from the edge your mushrooms can reach.');
  setTile(area, x, y, 'g');
  for (const [r, n] of Object.entries(THICKET_CLEAR)) state.inventory[r] = (state.inventory[r] || 0) + n;
  bumpWorld(state);
  return ok({ gained: THICKET_CLEAR });
}

// ---------------------------------------------------------------- the clean-up crew

const CLEANUP_SECONDS = { clutter: 6, thicket: 5, heavy: 10 }; // work per target, for one mushroom
const CLEANUP_WALK = 2; // seconds between targets
const CLEANUP_MAX_TARGETS = 40;

/**
 * Everything a clean-up crew can clear now, nearest first: clutter on land
 * your mushrooms can reach, and thicket growing from that land (clearing it
 * opens the way to whatever lies behind, which is cleared in the same trip).
 * Water still needs bridges.
 */
export function cleanupTargets(state, limit = CLEANUP_MAX_TARGETS) {
  const reach = reachableTiles(state);
  const clutterAt = new Map();
  for (const [areaId, a] of Object.entries(state.world.areas)) {
    for (const o of a.objects) {
      const def = STRUCTURES[o.def];
      if (def.kind !== 'clutter' || (def.needsStage && !stageComplete(state, def.needsStage))) continue;
      clutterAt.set((a.cx * AREA_W + o.x) + ',' + (a.cy * AREA_H + o.y), { kind: 'clutter', id: o.id, areaId, x: o.x, y: o.y, heavy: !!def.needsStage });
    }
  }
  const out = [];
  const seen = new Set(reach);
  const queue = [];
  // start from home, so the nearest work comes first
  const home = [...reach][0];
  const order = [...reach].map((k) => k.split(',').map(Number));
  const [hx, hy] = home ? home.split(',').map(Number) : [0, 0];
  order.sort((p, q) => Math.hypot(p[0] - hx, p[1] - hy) - Math.hypot(q[0] - hx, q[1] - hy));
  for (const p of order) queue.push(p);
  while (queue.length && out.length < limit) {
    const [x, y] = queue.shift();
    const key = x + ',' + y;
    if (clutterAt.has(key)) out.push(clutterAt.get(key));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const nk = nx + ',' + ny;
      if (seen.has(nk)) continue;
      const t = globalTile(state, nx, ny);
      if (t === null || t === undefined) continue;
      if (t === 'u') {
        seen.add(nk);
        const ac = areaAt(state, Math.floor(nx / AREA_W), Math.floor(ny / AREA_H));
        if (out.length < limit) out.push({ kind: 'thicket', areaId: ac.id, x: nx - ac.area.cx * AREA_W, y: ny - ac.area.cy * AREA_H });
        queue.push([nx, ny]);
      } else if (!TERRAIN[t]?.blocks) { seen.add(nk); queue.push([nx, ny]); }
    }
  }
  return out.slice(0, limit);
}

/** Send every resident to clear debris; they go back to their jobs when it is done. */
export function startCleanup(state, now) {
  if (state.cleanup) return fail('Your mushrooms are already out clearing.');
  const crew = residents(state).map((m) => m.uid);
  if (!crew.length) return fail('You have no mushrooms to send.');
  const targets = cleanupTargets(state);
  if (!targets.length) return fail('There is nothing left that your mushrooms can clear right now.');
  // share the work out: each target goes to whoever is free first
  const free = new Map(crew.map((uid) => [uid, now + CLEANUP_WALK * 1000]));
  const jobs = targets.map((t) => {
    const uid = [...free.entries()].sort((p, q) => p[1] - q[1])[0][0];
    const secs = t.heavy ? CLEANUP_SECONDS.heavy : CLEANUP_SECONDS[t.kind];
    const at = free.get(uid) + secs * 1000;
    free.set(uid, at + CLEANUP_WALK * 1000);
    return { ...t, by: uid, at, done: false };
  });
  const endsAt = Math.max(...jobs.map((j) => j.at)) + CLEANUP_WALK * 1000;
  state.cleanup = { startedAt: now, endsAt, crew, jobs, gained: {} };
  event(state, 'cleanup', 'Clean-up crew sent out', `${crew.length} mushroom${crew.length === 1 ? '' : 's'} went to clear ${jobs.length} spots. They will go back to their jobs when they are done.`);
  return ok({ targets: jobs.length, endsAt });
}

/** Clear whatever the crew has finished by `until`, and send them home when they are done. */
function processCleanup(state, until) {
  const c = state.cleanup;
  if (!c) return;
  const give = (loot) => { for (const [r, n] of Object.entries(loot)) { state.inventory[r] = (state.inventory[r] || 0) + n; c.gained[r] = (c.gained[r] || 0) + n; } };
  let changed = false;
  for (const j of c.jobs) {
    if (j.done || j.at > until) continue;
    j.done = true;
    const area = state.world.areas[j.areaId];
    if (!area) continue;
    if (j.kind === 'clutter') {
      const o = area.objects.find((q) => q.id === j.id);
      if (!o) continue;
      area.objects = area.objects.filter((q) => q.id !== j.id);
      give(STRUCTURES[o.def].clear);
    } else if (area.tiles[j.y]?.[j.x] === 'u') {
      setTile(area, j.x, j.y, 'g');
      give(THICKET_CLEAR);
    }
    changed = true;
  }
  if (changed) bumpWorld(state);
  if (c.endsAt > until) return;
  // home again: work resumes from now on (the time away earns nothing)
  for (const m of state.mushrooms) if (c.crew.includes(m.uid) && m.work) { m.work.anchor = c.endsAt; m.work.cycles = 0; }
  const got = Object.entries(c.gained).map(([r, n]) => `${n} ${RESOURCES[r]?.name || r}`).join(', ');
  event(state, 'cleanup:done', 'Clean-up finished! Your mushrooms are back at work.', `Your mushrooms cleared ${c.jobs.length} spots and went back to work.${got ? ` You got ${got}.` : ''}`);
  state.cleanup = null;
  stopUnreachableWork(state);
  checkStages(state);
}

/** Is this mushroom out with the clean-up crew right now? */
export function onCleanup(state, uid) {
  return !!state.cleanup?.crew.includes(uid);
}

/** The target a crew member is working on (or walking to) at `now`. */
export function cleanupTask(state, uid, now) {
  const c = state.cleanup;
  if (!c || !c.crew.includes(uid)) return null;
  return c.jobs.find((j) => j.by === uid && !j.done && j.at > now) || null;
}

/** A ruin your mushrooms can reach and you can afford: ready to restore. */
export function readyToRestore(state, o) {
  return o.state === 'ruin' && objectReachable(state, o.id) && canAfford(state, STRUCTURES[o.def].cost);
}

/** Announce (once) when the forest is ready to grow. */
function checkStages(state) {
  const info = nextStageInfo(state);
  if (!info?.ready) return;
  state.flags.readyAnnounced = state.flags.readyAnnounced || {};
  if (state.flags.readyAnnounced[info.stage.id]) return;
  state.flags.readyAnnounced[info.stage.id] = true;
  event(state, state.flags.readyAnnounced.__first ? 'ready' : 'unlock:expand', 'The forest is ready to grow!',
    'Tap Expand (or a signpost at the edge of a clearing) and choose north, east, south or west. A new clearing will open that way, with something to discover.');
  state.flags.readyAnnounced.__first = true;
}

export function checkUnlocks(state, now) {
  const cfg = getConfig();
  const u = state.unlocks;
  if (!u.traits && state.breedingsCompleted >= cfg.unlocks.traitsAfterBreedings) {
    u.traits = true;
    state.glimmer += cfg.economy.milestoneGlimmer;
    event(state, 'unlock:traits', 'New: Advanced Traits', 'From now on, offspring can develop Advanced Traits — permanent +4 bonuses to a job stat that can be passed down the generations. Your next breeding is guaranteed to produce one.');
  }
  if (!u.perks && (state.station === 'spore_cradle' || state.station === 'moonlit_cradle')) {
    u.perks = true;
    event(state, 'unlock:perks', 'New: Perks', 'The Spore Cradle lets offspring develop Perks — conditional bonuses like working better in the rain or at night. Matching Perks from both parents can combine into a stronger version. Up to 3 per mushroom.');
  }
  const gen5 = state.mushrooms.some((m) => m.generation >= cfg.unlocks.mutationsGeneration);
  if (!u.mutations && (state.discoveries.moonstone || gen5)) {
    u.mutations = true;
    state.glimmer += cfg.economy.milestoneGlimmer;
    event(state, 'unlock:mutations', 'New: Mutations', 'Extremely rare Mutations can now appear in offspring: dazzling visual transformations with a strong bonus. A mushroom can have only one, and mutated parents can pass theirs on.');
  }
}

export function residentCap(state) {
  const cfg = getConfig();
  let cap = cfg.world.baseResidentCap;
  for (const o of allObjects(state)) if (o.state === 'built' && STRUCTURES[o.def].kind === 'home') cap += STRUCTURES[o.def].capacity;
  return cap;
}

export function residents(state) {
  return state.mushrooms.filter((m) => m.status === 'resident');
}

// ---------------------------------------------------------------- building

export function restoreStructure(state, objectId, now) {
  const found = objectById(state, objectId);
  if (!found) return fail('Unknown structure.');
  const { obj } = found;
  if (obj.state !== 'ruin') return fail('Already restored.');
  const def = STRUCTURES[obj.def];
  if (!objectReachable(state, objectId)) return fail('Your mushrooms cannot reach it yet — bridge the water or clear the thicket.');
  if (!canAfford(state, def.cost)) return fail('Not enough materials.');
  pay(state, def.cost);
  obj.state = 'built';
  if (def.job && !state.discoveries.jobs[def.job]) {
    state.discoveries.jobs[def.job] = true;
    event(state, 'job', `Job unlocked: ${JOB_BY_ID[def.job].name}`, JOB_BY_ID[def.job].desc);
  }
  autoAssign(state, now);
  checkStages(state);
  return ok();
}

/** The tiles a structure covers (big ones are centred on their own tile). */
export function footprintAt(defId, x, y) {
  const n = sizeOf(defId);
  const h = (n - 1) / 2;
  const out = [];
  for (let dy = -h; dy <= h; dy++) for (let dx = -h; dx <= h; dx++) out.push([x + dx, y + dy]);
  return out;
}
export const footprint = (o) => footprintAt(o.def, o.x, o.y);
const covers = (o, x, y) => { const h = (sizeOf(o.def) - 1) / 2; return Math.abs(o.x - x) <= h && Math.abs(o.y - y) <= h; };

/** The object standing on a tile, if any. */
export function objectAt(area, x, y, ignoreId = null) {
  return area?.objects.find((o) => o.id !== ignoreId && covers(o, x, y)) || null;
}

export function tileFree(state, areaId, x, y, ignoreId = null) {
  const area = state.world.areas[areaId];
  if (!area || x < 0 || y < 0 || x >= AREA_W || y >= AREA_H) return false;
  return !objectAt(area, x, y, ignoreId);
}

export function buildable(state, defId) {
  const def = STRUCTURES[defId];
  if (!def?.buildable) return false;
  if (def.requiresStage && !stageComplete(state, def.requiresStage)) return false;
  if (def.kind === 'pen' && penCount(state, false) >= getConfig().breeding.maxPens) return false;
  if (def.job) {
    // extra work structures only once the job is unlocked
    if (!jobUnlocked(state, def.job)) return false;
  }
  return true;
}

/** Why a structure cannot stand on a tile (null = it can). */
function placementProblem(state, areaId, x, y, defId, ignoreId = null) {
  const def = STRUCTURES[defId];
  if (sizeOf(defId) > 1) {
    // a big structure needs every tile under it to be clear, reachable land
    const area = state.world.areas[areaId];
    for (const [fx, fy] of footprintAt(defId, x, y)) {
      const t = area?.tiles[fy]?.[fx];
      if (!t) return `The ${def.name} covers 3×3 tiles — move it further from the edge.`;
      if (!tileFree(state, areaId, fx, fy, ignoreId)) return `The ${def.name} covers 3×3 tiles and something is in the way.`;
      if (t === 'u') return 'Clear the thicket under it first.';
      if (TERRAIN[t]?.water) return 'Cannot build on water.';
      if (!isReachable(state, areaId, fx, fy)) return 'Your mushrooms cannot reach that spot yet.';
    }
    return null;
  }
  const tile = state.world.areas[areaId]?.tiles[y]?.[x];
  if (!tile || !tileFree(state, areaId, x, y, ignoreId)) return 'That spot is taken — clear it first.';
  if (tile === 'u') return 'Clear the thicket first.';
  const water = TERRAIN[tile]?.water;
  if (def.onWater && !water) return 'Bridges go over water.';
  if (!def.onWater && water && defId !== 'little_pond') return 'Cannot build on water.';
  if (def.onWater) {
    // a bridge must touch land your mushrooms can already reach
    const a = state.world.areas[areaId];
    const ok2 = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reachableTiles(state).has((a.cx * AREA_W + x + dx) + ',' + (a.cy * AREA_H + y + dy)));
    if (!ok2) return 'Build bridges out from land your mushrooms can reach.';
  } else if (!isReachable(state, areaId, x, y)) return 'Your mushrooms cannot reach that spot yet.';
  return null;
}

export function buildStructure(state, defId, areaId, x, y, now) {
  const def = STRUCTURES[defId];
  if (!buildable(state, defId)) return fail('Not available yet.');
  const problem = placementProblem(state, areaId, x, y, defId);
  if (problem) return fail(problem);
  const cost = def.buildCost || def.cost;
  if (!canAfford(state, cost)) return fail('Not enough materials.');
  pay(state, cost);
  state.world.areas[areaId].objects.push({ id: 'o' + state.nextObjectId++, def: defId, x, y, state: 'built', prefab: false });
  bumpWorld(state);
  autoAssign(state, now);
  checkStages(state);
  return ok();
}

/** Organise: any structure can be moved (within its clearing) to a free, reachable spot. */
export function moveObject(state, objectId, x, y) {
  const found = objectById(state, objectId);
  if (!found) return fail('Unknown object.');
  const def = STRUCTURES[found.obj.def];
  if (def.kind === 'clutter') return fail('Clear clutter instead of moving it.');
  if (found.obj.def === 'moonstone_ring') return fail('The Moonstone Ring cannot be moved.');
  const problem = placementProblem(state, found.areaId, x, y, found.obj.def, objectId);
  if (problem) return fail(problem);
  found.obj.x = x;
  found.obj.y = y;
  bumpWorld(state);
  stopUnreachableWork(state);
  return ok();
}

export function removeObject(state, objectId) {
  const found = objectById(state, objectId);
  if (!found) return fail('Unknown object.');
  if (found.obj.prefab) return fail('This structure cannot be removed.');
  if (STRUCTURES[found.obj.def].kind === 'clutter') return clearClutter(state, objectId);
  if (state.mushrooms.some((m) => m.work?.structureId === objectId)) return fail('Mushrooms are working here.');
  const def = STRUCTURES[found.obj.def];
  if (def.kind === 'home' && residents(state).length > residentCap(state) - def.capacity) return fail('Residents live here — archive someone first.');
  if (def.kind === 'pen' && activeBreedings(state).length > penCount(state) - 1) return fail('A spore cluster is growing here — hatch it first.');
  const area = state.world.areas[found.areaId];
  area.objects = area.objects.filter((o) => o.id !== objectId);
  bumpWorld(state);
  stopUnreachableWork(state);
  return ok();
}

export function paintTerrain(state, areaId, x, y, code) {
  const area = state.world.areas[areaId];
  if (!area) return fail('Unknown area.');
  if (!PAINTABLE_TERRAIN.includes(code)) return fail('Cannot paint that.');
  const cur = area.tiles[y]?.[x];
  if (!cur || TERRAIN[cur]?.blocks || cur === 'p' || cur === 'x') return fail('This ground cannot be changed.');
  if (cur === code) return fail('Already that terrain.');
  if (!canAfford(state, TERRAIN_PAINT_COST)) return fail('Not enough leaves.');
  pay(state, TERRAIN_PAINT_COST);
  setTile(area, x, y, code);
  return ok();
}

export function nextStation(state) {
  if (state.station === 'breeding_nook') return 'spore_cradle';
  if (state.station === 'spore_cradle') return 'moonlit_cradle';
  return null;
}

export function upgradeStation(state, now) {
  const target = nextStation(state);
  if (!target) return fail('Fully upgraded.');
  const def = BREEDING_STATIONS[target];
  if (def.requiresStage && !stageComplete(state, def.requiresStage)) return fail(`Requires ${STAGE_BY_ID[def.requiresStage].name}.`);
  if (!canAfford(state, def.cost)) return fail('Not enough materials.');
  pay(state, def.cost);
  state.station = target;
  event(state, 'station', `Upgraded to ${def.name}`, 'More incubation slots and faster incubation.');
  checkUnlocks(state, now);
  return ok();
}

export function startProject(state, projectId) {
  const p = PROJECTS[projectId];
  const cur = state.projects[projectId];
  if (cur && cur.state !== 'none') return fail('Already started.');
  if (!stageComplete(state, p.requiresStage)) return fail(`Requires ${STAGE_BY_ID[p.requiresStage].name}.`);
  if (!canAfford(state, p.cost)) return fail('Not enough materials.');
  pay(state, p.cost);
  state.projects[projectId] = { state: 'active', progress: 0 };
  event(state, 'project', `Project started: ${p.name}`, 'Assign Builders at the Building Site to make progress.');
  return ok();
}

export function activeProject(state) {
  for (const [id, p] of Object.entries(state.projects)) if (p.state === 'active') return { id, ...p, def: PROJECTS[id] };
  return null;
}

// ---------------------------------------------------------------- jobs

export function jobSlots(state, jobId) {
  const job = JOB_BY_ID[jobId];
  return allObjects(state).filter((o) => o.def === job.structure && o.state === 'built').reduce((s, o) => s + STRUCTURES[o.def].slots, 0);
}

export function workersOn(state, jobId) {
  return state.mushrooms.filter((m) => m.work?.jobId === jobId);
}

export function jobScore(final, job, cfg = getConfig()) {
  const [wp, ws] = cfg.jobs.jobScoreWeights;
  return job.secondary ? wp * final[job.primary] + ws * final[job.secondary] : final[job.primary];
}

export function effectiveness(score, cfg = getConfig()) {
  return cfg.jobs.effectivenessMin + cfg.jobs.effectivenessRange * (Math.min(100, Math.max(0, score)) / 100);
}

export function skillLabel(score) {
  if (score < 15) return 'Struggling';
  if (score < 30) return 'Steady';
  if (score < 50) return 'Skilled';
  if (score < 75) return 'Expert';
  return 'Master';
}

/** Workstations for a job that are built and that mushrooms can reach. */
function reachableStations(state, jobId) {
  const job = JOB_BY_ID[jobId];
  return allObjects(state).filter((o) => o.def === job.structure && o.state === 'built' && objectReachable(state, o.id));
}

/**
 * The player picks a job: the mushroom is pinned there (auto-jobs leave it alone).
 * If every place is taken, the worker who suits it least (and isn't pinned) steps aside.
 */
export function assignJob(state, uid, jobId, now) {
  const m = state.mushrooms.find((x) => x.uid === uid);
  if (!m) return fail('Only your own mushrooms can work.');
  if (m.status !== 'resident') return fail('Archived mushrooms cannot work. Move it back to the forest first.');
  if (!jobUnlocked(state, jobId)) return fail('That job is still locked.');
  const stations = reachableStations(state, jobId);
  if (!stations.length) return fail('Your mushrooms cannot reach that workstation — bridge the water or clear the thicket.');
  if (m.work?.jobId === jobId) { m.jobPin = jobId; return ok(); }
  const others = workersOn(state, jobId).filter((x) => x.uid !== uid);
  let free = stations.find((o) => others.filter((x) => x.work.structureId === o.id).length < STRUCTURES[o.def].slots);
  if (!free) {
    const bumpable = others.filter((x) => !x.jobPin).sort((a, b) => jobFit(state, a, JOB_BY_ID[jobId]) - jobFit(state, b, JOB_BY_ID[jobId]));
    if (!bumpable.length) return fail('Every place at this job is held by a mushroom you placed there. Build or restore another workstation.');
    const out = bumpable[0];
    free = objectById(state, out.work.structureId).obj;
    out.work = null;
  }
  m.work = { jobId, structureId: free.id, anchor: now, cycles: 0, carry: {}, assignedAt: now };
  m.jobPin = jobId;
  autoAssign(state, now);
  return ok();
}

/** Let the mushroom choose its own job again. */
export function unpinJob(state, uid, now) {
  const m = state.mushrooms.find((x) => x.uid === uid);
  if (!m) return fail('Unknown mushroom.');
  m.jobPin = null;
  autoAssign(state, now);
  return ok();
}

/** Keep the mushroom off work until you choose otherwise. */
export function unassign(state, uid, now = 0) {
  const m = state.mushrooms.find((x) => x.uid === uid);
  if (m) {
    m.work = null;
    m.jobPin = 'rest';
  }
  autoAssign(state, now);
  return ok();
}

/**
 * How well a mushroom suits a job: its job score, raised by Perks and Mutations
 * that always help that kind of work (time- and weather-bound bonuses don't count).
 */
export function jobFit(state, m, job) {
  const { final } = statsOf(state, m);
  let boost = 0;
  if (state.unlocks.perks) for (const p of m.perks) {
    const def = PERK_BY_ID[p.perkId];
    if (def?.effect === 'prod' && def.condition === 'family:' + job.family) boost += def.levels[p.level - 1];
  }
  if (state.unlocks.mutations && m.mutation) {
    const eff = MUTATION_BY_ID[m.mutation.mutationId]?.effect;
    if (eff?.type === 'prod' && eff.condition === 'family:' + job.family) boost += eff.value;
  }
  return jobScore(final, job) * (1 + boost);
}

/**
 * Auto-jobs: give every free resident the best job it can get. Mushrooms are
 * matched best-fit first across all open places, so a better-suited mushroom
 * takes a full station's place and the one it replaces moves to its next best
 * job. Mushrooms already in the right place keep their spot and progress.
 * Pinned mushrooms (chosen by the player) are never moved.
 */
export function autoAssign(state, now) {
  if (state.settings?.autoJobs === false) return [];
  const moves = [];
  const jobs = JOBS.filter((j) => jobUnlocked(state, j.id));
  const stations = new Map(jobs.map((j) => [j.id, reachableStations(state, j.id)]));
  const capacity = new Map(jobs.map((j) => [j.id, stations.get(j.id).reduce((n, o) => n + STRUCTURES[o.def].slots, 0)]));
  const residentsNow = state.mushrooms.filter((m) => m.status === 'resident');
  // pinned mushrooms keep their places (if they can still reach them)
  const used = new Map(jobs.map((j) => [j.id, 0]));
  const free = [];
  for (const m of residentsNow) {
    const pinnedHere = m.jobPin && m.jobPin !== 'rest' && m.work?.jobId === m.jobPin && stations.get(m.jobPin)?.some((o) => o.id === m.work.structureId);
    if (pinnedHere) used.set(m.jobPin, used.get(m.jobPin) + 1);
    else if (m.jobPin === 'rest') { if (m.work) m.work = null; } else free.push(m);
  }
  // best fit first over every (mushroom, job) pair
  const pairs = [];
  for (const m of free) for (const j of jobs) {
    const fit = jobFit(state, m, j);
    // a small preference for the current job avoids swapping between near-equal choices
    pairs.push({ m, j, fit: fit + (m.work?.jobId === j.id ? 0.5 : 0) });
  }
  pairs.sort((a, b) => b.fit - a.fit || JOBS.indexOf(a.j) - JOBS.indexOf(b.j) || (a.m.uid < b.m.uid ? -1 : 1));
  const target = new Map();
  for (const { m, j } of pairs) {
    if (target.has(m.uid) || used.get(j.id) >= capacity.get(j.id)) continue;
    target.set(m.uid, j.id);
    used.set(j.id, used.get(j.id) + 1);
  }
  // choose stations: keep current ones where possible, then fill free places
  const occupancy = new Map();
  const take = (o) => occupancy.set(o.id, (occupancy.get(o.id) || 0) + 1);
  for (const m of residentsNow) if (m.work && (!free.includes(m) || target.get(m.uid) === m.work.jobId) && stations.get(m.work.jobId)?.some((o) => o.id === m.work.structureId)) take({ id: m.work.structureId });
  for (const m of free) {
    const jobId = target.get(m.uid);
    const before = m.work?.jobId || null;
    if (jobId && before === jobId && stations.get(jobId).some((o) => o.id === m.work.structureId)) continue; // stays put
    if (!jobId) {
      if (m.work) { m.work = null; moves.push({ m, from: before, to: null }); }
      continue;
    }
    const st = stations.get(jobId).find((o) => (occupancy.get(o.id) || 0) < STRUCTURES[o.def].slots);
    if (!st) continue;
    take(st);
    m.work = { jobId, structureId: st.id, anchor: now, cycles: 0, carry: {}, assignedAt: now };
    moves.push({ m, from: before, to: jobId });
  }
  for (const mv of moves) {
    state.activity.unshift({ t: now, title: mv.to ? `${mv.m.name} ${mv.from ? 'moved to' : 'started work as a'} ${JOB_BY_ID[mv.to].name}` : `${mv.m.name} has no job right now` });
  }
  if (state.activity.length > 40) state.activity.length = 40;
  return moves;
}

function cycleDuration(m, job, cfg) {
  let d = job.duration * 1000;
  if (m.temperament === 'industrious') d *= cfg.temperaments.industriousDuration;
  if (m.temperament === 'sleepy') d *= cfg.temperaments.sleepyDuration;
  return d;
}

function conditionHolds(cond, job, cx) {
  if (!cond) return true;
  return cond.split('+').every((c) => {
    if (c === 'rain') return cx.raining;
    if (c === 'dawn' || c === 'night' || c === 'day' || c === 'dusk') return cx.phase === c;
    if (c === 'teammate') return cx.teammates > 0;
    if (c.startsWith('family:')) return job.family === c.slice(7);
    return false;
  });
}

/** All productivity bonuses for a mushroom at a moment. Returns {sum, parts}. */
export function productivityBonus(state, m, job, cx) {
  const cfg = getConfig();
  const parts = [];
  if (state.unlocks.perks) {
    for (const p of m.perks) {
      const def = PERK_BY_ID[p.perkId];
      if (def.effect === 'prod' && conditionHolds(def.condition, job, cx)) parts.push({ label: `${def.name} ${p.level}`, value: def.levels[p.level - 1] });
    }
  }
  if (state.unlocks.mutations && m.mutation) {
    const eff = MUTATION_BY_ID[m.mutation.mutationId]?.effect;
    if (eff?.type === 'prod' && conditionHolds(eff.condition, job, cx)) parts.push({ label: MUTATION_BY_ID[m.mutation.mutationId].name, value: eff.value });
  }
  const t = cfg.temperaments;
  if (m.temperament === 'sleepy') parts.push({ label: 'Well rested', value: t.sleepyRestedBonus });
  if (m.temperament === 'social' && cx.totalWorkers > 1) parts.push({ label: 'Social', value: t.socialBonus });
  if (m.temperament === 'gentle' && (job.family === 'cultivation' || job.family === 'animal')) parts.push({ label: 'Gentle', value: t.gentleBonus });
  if (m.temperament === 'stubborn' && cx.now - m.work.assignedAt >= t.stubbornHours * HOUR) parts.push({ label: 'Stubborn focus', value: t.stubbornBonus });
  if (cx.synergy?.[job.id]) parts.push({ label: 'Synergy', value: cx.synergy[job.id] });
  const raw = parts.reduce((s, p) => s + p.value, 0);
  return { sum: Math.min(cfg.jobs.productivityBonusCap, raw), raw, parts };
}

function workContext(state) {
  const cfg = getConfig();
  const counts = {};
  let total = 0;
  for (const m of state.mushrooms) if (m.work) { counts[m.work.jobId] = (counts[m.work.jobId] || 0) + 1; total++; }
  const synergy = {};
  for (const job of JOBS) {
    if (job.synergy && counts[job.id]) {
      const workers = workersOn(state, job.id);
      const allGreedy = workers.every((w) => w.temperament === 'greedy');
      synergy[job.synergy.job] = cfg.jobs.synergyBonus * (allGreedy ? 0.5 : 1);
    }
  }
  return { counts, total, synergy };
}

/** Estimate output per hour for UI (current conditions). */
export function estimateJob(state, m, jobId, now) {
  const job = JOB_BY_ID[jobId];
  const cfg = getConfig();
  const { final } = statsOf(state, m);
  const score = jobScore(final, job, cfg);
  const eff = effectiveness(score, cfg);
  const wc = workContext(state);
  const cx = { ...conditionsAt(now, state.worldSeed, state.tzOffset, state.dev.override), teammates: Math.max(0, (wc.counts[jobId] || 0) - (m.work?.jobId === jobId ? 1 : 0)), totalWorkers: wc.total + (m.work ? 0 : 1), synergy: wc.synergy, now };
  const fakeM = m.work ? m : { ...m, work: { assignedAt: now } };
  const bonus = productivityBonus(state, fakeM, job, cx);
  const perHour = 3600000 / cycleDuration(m, job, cfg);
  const out = {};
  for (const [r, n] of Object.entries(job.outputs)) out[r] = n * eff * (1 + bonus.sum) * perHour;
  return { score, eff, bonus, perHour, out, label: skillLabel(score), work: job.work ? eff * (1 + bonus.sum) * perHour : 0 };
}

function addResource(state, r, n, report) {
  if (n <= 0) return;
  state.inventory[r] = (state.inventory[r] || 0) + n;
  report.resources[r] = (report.resources[r] || 0) + n;
}

function addFrac(state, carry, key, amount, report) {
  carry[key] = (carry[key] || 0) + amount;
  const whole = Math.floor(carry[key] + 1e-9);
  if (whole > 0) {
    carry[key] -= whole;
    if (key === 'glimmer') { state.glimmer += whole; report.glimmer += whole; } else addResource(state, key, whole, report);
  }
}

function resolveCycle(state, m, job, idx, t, stats, wc, report) {
  const cfg = getConfig();
  const cx = { ...conditionsAt(t, state.worldSeed, state.tzOffset, state.dev.override), teammates: (wc.counts[job.id] || 1) - 1, totalWorkers: wc.total, synergy: wc.synergy, now: t };
  if (job.phases && !job.phases.includes(cx.phase)) return; // resting outside its hours
  const rng = makeRng(hash(state.worldSeed, m.uid, job.id, m.work.anchor, idx));
  const eff = effectiveness(jobScore(stats.final, job, cfg), cfg);
  const bonus = productivityBonus(state, m, job, cx).sum;
  const mult = eff * (1 + bonus);
  const carry = m.work.carry;

  // converter inputs
  if (job.inputs) {
    if (!canAfford(state, job.inputs)) { report.idle[job.id] = true; return; }
    let conserve = false;
    if (state.unlocks.perks) for (const p of m.perks) {
      const def = PERK_BY_ID[p.perkId];
      if (def.effect === 'conserve' && conditionHolds(def.condition, job, cx) && rng.chance(def.levels[p.level - 1])) conserve = true;
    }
    if (!conserve) pay(state, job.inputs);
  }
  for (const [r, n] of Object.entries(job.outputs)) addFrac(state, carry, r, n * mult, report);
  if (job.work) {
    const proj = activeProject(state);
    if (proj) {
      let w = job.work * mult;
      if (state.unlocks.perks) for (const p of m.perks) {
        const def = PERK_BY_ID[p.perkId];
        if (def.effect === 'conserve' && rng.chance(def.levels[p.level - 1])) w *= 2;
      }
      const pr = state.projects[proj.id];
      pr.progress += w;
      report.work += w;
      if (pr.progress >= proj.def.work) {
        pr.state = 'done';
        pr.progress = proj.def.work;
        event(state, 'project', `Project complete: ${proj.def.name}`, 'Something new is waiting beyond the repaired path.');
      }
    }
  }
  // chance effects
  const finds = [];
  if (state.unlocks.perks) for (const p of m.perks) {
    const def = PERK_BY_ID[p.perkId];
    if (def.effect === 'chance' && conditionHolds(def.condition, job, cx) && rng.chance(def.levels[p.level - 1])) finds.push(def.reward);
  }
  if (state.unlocks.mutations && m.mutation) {
    const eff2 = MUTATION_BY_ID[m.mutation.mutationId]?.effect;
    if (eff2?.type === 'chance' && conditionHolds(eff2.condition, job, cx) && rng.chance(eff2.value)) finds.push(eff2.reward);
  }
  const outs = Object.keys(job.outputs);
  if (outs.length && m.temperament === 'curious' && rng.chance(cfg.temperaments.curiousChance)) finds.push({ [rng.pick(outs)]: 1 });
  if (outs.length && m.temperament === 'greedy' && rng.chance(cfg.temperaments.greedyFindBonus)) finds.push({ [rng.pick(outs)]: 1 });
  for (const f of finds) for (const [r, n] of Object.entries(f)) addResource(state, r, n, report);
  if (finds.length) report.finds += finds.length;

  addFrac(state, carry, 'glimmer', cfg.economy.glimmerPerCycle * eff, report);
  state.counters.jobCycles[job.id] = (state.counters.jobCycles[job.id] || 0) + 1;
  report.cycles++;

  // rare habitat discovery (Moonstone Ring) by Local Discovery work
  if (job.findsMoonstone && !state.discoveries.moonstone) {
    state.counters.moonstoneCycles++;
    if (rng.chance(cfg.world.moonstoneChance) || state.counters.moonstoneCycles >= cfg.world.moonstoneGuaranteeCycles) {
      discoverMoonstone(state, t);
      report.discoveries.push('Moonstone Ring');
    }
  }
}

export function discoverMoonstone(state, now) {
  if (state.discoveries.moonstone) return;
  state.discoveries.moonstone = true;
  const area = state.world.areas.roothollow;
  if (area) {
    let spot = null;
    for (let y = 0; y < AREA_H && !spot; y++) for (let x = 0; x < AREA_W && !spot; x++) {
      if (tileFree(state, 'roothollow', x, y) && y > 3 && !TERRAIN[area.tiles[y][x]]?.blocks && isReachable(state, 'roothollow', x, y)) spot = { x, y };
    }
    spot = spot || { x: 0, y: 0 };
    area.objects.push({ id: 'o' + state.nextObjectId++, def: 'moonstone_ring', x: spot.x, y: spot.y, state: 'built', prefab: true });
  }
  event(state, 'discovery', 'Rare habitat: Moonstone Ring', 'A ring of softly glowing moonstones lies hidden in the Root Hollow. Rare attribute variations can now appear in offspring.');
  checkUnlocks(state, now);
}

function newReport() {
  return { resources: {}, glimmer: 0, cycles: 0, finds: 0, work: 0, discoveries: [], idle: {}, hatched: 0, elapsed: 0 };
}

/** Resolve all work cycles that completed at or before `until`. */
export function resolveWork(state, until, report = newReport()) {
  const cfg = getConfig();
  const wc = workContext(state);
  const statCache = new Map();
  for (const m of state.mushrooms) {
    if (!m.work) continue;
    if (state.cleanup?.crew.includes(m.uid)) continue; // out clearing debris
    const job = JOB_BY_ID[m.work.jobId];
    if (!job || !jobUnlocked(state, job.id)) { m.work = null; continue; }
    const d = cycleDuration(m, job, cfg);
    let guard = 0;
    while (m.work.anchor + (m.work.cycles + 1) * d <= until && guard++ < 100000) {
      const idx = m.work.cycles;
      const t = m.work.anchor + (idx + 1) * d;
      if (!statCache.has(m.uid)) statCache.set(m.uid, statsOf(state, m));
      resolveCycle(state, m, job, idx, t, statCache.get(m.uid), wc, report);
      m.work.cycles = idx + 1;
    }
  }
  return report;
}

// ---------------------------------------------------------------- wild visitors

export function habitatCounts(state) {
  const h = { flowers: 0, shade: 0, stone: 0, log: 0, water: 0, moss: 0, damp: 0, glow: 0 };
  for (const area of Object.values(state.world.areas)) {
    for (const row of area.tiles) for (const c of row) {
      if (c === 'm') h.moss += 0.2;
      if (c === 'h') h.shade += 0.2;
      if (c === 'd') h.damp += 0.2;
      if (c === 'w') h.water += 0.2;
      if (c === 's') h.stone += 0.2;
    }
    for (const o of area.objects) {
      const def = STRUCTURES[o.def];
      if (def.habitat) h[def.habitat] += 2;
    }
  }
  for (const k of Object.keys(h)) h[k] = Math.floor(h[k]);
  return h;
}

function updateVisitors(state, now, report) {
  const cfg = getConfig();
  const slotMs = cfg.world.wildVisitorSlotHours * HOUR;
  const slot = Math.floor(now / slotMs);
  state.wildVisitors = state.wildVisitors.filter((v) => v.leavesAt > now);
  if (slot <= state.lastVisitorSlot) return;
  const from = Math.max(state.lastVisitorSlot + 1, slot - 3);
  let bonus = 0;
  for (const job of JOBS) if (job.visitorBonus && workersOn(state, job.id).length) bonus += job.visitorBonus;
  for (let s = from; s <= slot; s++) {
    const arrivedAt = s * slotMs;
    const leavesAt = arrivedAt + cfg.world.wildVisitorStayHours * HOUR;
    if (leavesAt <= now || state.wildVisitors.length >= 3) continue;
    const rng = makeRng(hash(state.worldSeed, 'visitor', s));
    if (rng.chance(cfg.world.wildVisitorChance + bonus)) {
      const m = generateWildVisitor(hash(state.worldSeed, 'visitorGenes', s), habitatCounts(state), arrivedAt);
      state.wildVisitors.push({ mushroom: m, arrivedAt, leavesAt });
      recordDiscovery(state, m);
      report?.discoveries.push(`Wild Visitor: ${m.name}`);
      event(state, 'visitor', `A Wild Visitor arrived: ${m.name}`, 'Wild Visitors stay for a while and can be bred with, bringing new attributes into your forest. They cannot stay forever.');
    }
  }
  state.lastVisitorSlot = slot;
}

// ---------------------------------------------------------------- advance time

/**
 * Advance the simulation to `now`, with the offline clamp (GDD 13.4).
 * A backward clock grants nothing. Returns a report for the return summary.
 */
export function advance(state, now) {
  const cfg = getConfig();
  const report = newReport();
  if (now < state.lastSeenAt) return report; // clock moved backward
  const capMs = cfg.offline.offlineCapHours * HOUR;
  const limit = Math.min(now, state.lastSeenAt + capMs);
  report.elapsed = limit - state.lastSeenAt;
  processCleanup(state, now);
  resolveWork(state, limit, report);
  if (now > limit) {
    // time beyond the cap is not granted; rebase cycle anchors
    for (const m of state.mushrooms) if (m.work) { m.work.anchor = now; m.work.cycles = 0; }
    report.clamped = true;
  }
  updateVisitors(state, now, report);
  report.readyBreedings = state.breedings.filter((b) => b.state === 'incubating' && b.completesAt <= now).length;
  state.lastSeenAt = now;
  checkStages(state);
  checkUnlocks(state, now);
  report.moves = autoAssign(state, now);
  return report;
}

// ---------------------------------------------------------------- breeding

export function stationConfig(state) {
  return getConfig().breeding.stations[state.station];
}

/** Breeding Pens in the forest (that mushrooms can reach, unless `reachableOnly` is false). */
export function pens(state, reachableOnly = true) {
  return allObjects(state).filter((o) => o.def === 'breeding_pen' && o.state === 'built' && (!reachableOnly || objectReachable(state, o.id)));
}

export function penCount(state, reachableOnly = true) {
  return pens(state, reachableOnly).length;
}

/** How many spore clusters can grow at once: one per pen. */
export function incubationSlots(state) {
  return Math.min(getConfig().breeding.maxPens, penCount(state));
}

/** Dev / tests: put a Breeding Pen down for free in the starting clearing. */
export function devGivePen(state) {
  for (const [areaId, area] of Object.entries(state.world.areas)) {
    for (let y = 1; y < AREA_H - 1; y++) for (let x = 1; x < AREA_W - 1; x++) {
      if (!placementProblem(state, areaId, x, y, 'breeding_pen')) {
        area.objects.push({ id: 'o' + state.nextObjectId++, def: 'breeding_pen', x, y, state: 'built', prefab: false });
        bumpWorld(state);
        return true;
      }
    }
  }
  return false;
}

export function breedingCost(state) {
  const cfg = getConfig();
  if (state.breedingsStarted < cfg.breeding.freeBreedingCount) return 0;
  return Math.max(0, cfg.breeding.breedingCostGlimmer - (stationConfig(state).discount || 0));
}

export function activeBreedings(state) {
  return state.breedings.filter((b) => b.state === 'incubating');
}

/** Why a mushroom cannot be a parent right now (null = eligible). */
export function breedIneligibility(state, m, now) {
  const cfg = getConfig();
  if (!m) return 'Unknown mushroom.';
  if (activeBreedings(state).some((b) => b.a === m.uid || b.b === m.uid)) return 'Already incubating.';
  if (m.restUntil > now) return `Resting (${Math.ceil((m.restUntil - now) / MIN)} min).`;
  if (m.status !== 'guest' && m.status !== 'wild' && now - m.createdAt < cfg.breeding.offspringMaturationMinutes * MIN) return 'Still a sprout.';
  return null;
}

export function breedingContext(state, now, breedingId, seed) {
  const cfg = getConfig();
  const u = state.unlocks;
  return {
    seed,
    unlocks: { traits: u.traits, perks: u.perks, mutations: u.mutations },
    rareVariation: state.discoveries.moonstone,
    firstBreed: state.breedingsStarted === 0,
    guaranteeTrait: u.traits && cfg.traits.tutorialGuaranteedFirstTrait && !state.flags.firstTraitGranted,
    breedingId,
    forest: state.forest,
    now,
    mutationWeightMods: state.discoveries.moonstone ? { starfall_aura: 2 } : {},
    force: state.dev.force || {},
  };
}

export function startBreeding(state, uidA, uidB, now) {
  const cfg = getConfig();
  if (uidA === uidB) return fail('Choose two different mushrooms.');
  const a = findMushroom(state, uidA);
  const b = findMushroom(state, uidB);
  if (!a || !b) return fail('Unknown mushroom.');
  if (!isOwned(state, uidA) && !isOwned(state, uidB)) return fail('At least one parent must be your own mushroom.');
  const ia = breedIneligibility(state, a, now);
  const ib = breedIneligibility(state, b, now);
  if (ia) return fail(`${a.name}: ${ia}`);
  if (ib) return fail(`${b.name}: ${ib}`);
  const station = stationConfig(state);
  if (!penCount(state)) return fail('Build a Breeding Pen first (Store → Breeding).');
  if (activeBreedings(state).length >= incubationSlots(state)) return fail('Every pen already has a spore cluster growing. Hatch one or build another pen.');
  const cost = breedingCost(state);
  if (state.glimmer < cost) return fail(`Breeding costs ${cost} Glimmer — you have ${state.glimmer}.`);

  const counter = state.breedingCounter;
  const seed = 's' + hashHex(state.rngRoot, counter, a.uid, b.uid);
  const id = 'b' + hashHex(seed, 'id');
  const ctx = breedingContext(state, now, id, seed);
  const { offspring, log } = resolveBreeding(a, b, ctx);
  state.glimmer -= cost;
  state.breedingCounter = counter + 1;
  state.breedingsStarted++;
  if (log.newTrait) state.flags.firstTraitGranted = true;
  state.dev.force = {};
  const dur = cfg.breeding.incubationMinutes * MIN * station.speed;
  const rec = {
    id, a: a.uid, b: b.uid, startedAt: now, completesAt: now + dur, seed, counter,
    configVersion: cfg.configVersion, parentSnapshots: [structuredClone(a), structuredClone(b)],
    offspring, log, state: 'incubating', claimedAt: null,
  };
  state.breedings.push(rec);
  for (const p of [a, b]) p.restUntil = now + cfg.breeding.parentRestMinutes * MIN;
  return ok({ record: rec });
}

export function claimBreeding(state, id, now) {
  const rec = state.breedings.find((b) => b.id === id);
  if (!rec) return fail('Unknown incubation.');
  if (rec.state !== 'incubating') return fail('Already claimed.');
  if (now < rec.completesAt) return fail('Not ready yet.');
  const m = structuredClone(rec.offspring);
  m.createdAt = now;
  m.status = residents(state).length < residentCap(state) ? 'resident' : 'archived';
  rec.state = 'claimed';
  rec.claimedAt = now;
  state.mushrooms.push(m);
  state.breedingsCompleted++;
  recordDiscovery(state, m);
  if (m.status === 'archived') event(state, 'archive', `${m.name} went to the Spore Archive`, 'Your forest is full. Build Mushroom Homes for more residents. Archived mushrooms can still be bred and shared.');
  autoAssign(state, now);
  checkUnlocks(state, now);
  // keep the record history bounded; claimed records only need their id for double-claim protection
  const claimed = state.breedings.filter((b) => b.state === 'claimed');
  if (claimed.length > 30) {
    const drop = new Set(claimed.slice(0, claimed.length - 30).map((b) => b.id));
    state.breedings = state.breedings.filter((b) => !drop.has(b.id));
    state.claimedIds = [...(state.claimedIds || []), ...drop].slice(-500);
  }
  return ok({ mushroom: m, record: rec });
}

export function setArchived(state, uid, archived) {
  const m = state.mushrooms.find((x) => x.uid === uid);
  if (!m) return fail('Unknown mushroom.');
  if (!archived) {
    if (residents(state).length >= residentCap(state)) return fail('The forest is full. Build a Mushroom Home first.');
    m.status = 'resident';
  } else {
    m.work = null;
    m.status = 'archived';
  }
  autoAssign(state, state.lastSeenAt);
  return ok();
}

export function renameMushroom(state, uid, name) {
  const m = state.mushrooms.find((x) => x.uid === uid);
  if (!m) return fail('Unknown mushroom.');
  const clean = sanitizeName(name);
  if (!clean) return fail('Please enter a name.');
  m.name = clean;
  return ok();
}

export function sanitizeName(s) {
  const max = getConfig().sharing.nameMaxLength;
  return String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
}

// ---------------------------------------------------------------- discoveries (Field Guide)

export function recordDiscovery(state, m) {
  const d = state.discoveries;
  for (const cat of CATEGORIES) d.attributes[m.genes[cat]] = true;
  d.colorFamilies[colorFamily(m.genes.color).id] = true;
  for (const p of m.perks) d.perks[p.perkId] = Math.max(d.perks[p.perkId] || 0, p.level);
  for (const t of m.traits) d.traitStats[t.stat] = true;
  if (m.mutation) d.mutations[m.mutation.mutationId] = true;
}

// ---------------------------------------------------------------- economy

export function tradeInfo(state, now) {
  const { dateKey } = localParts(now, state.tzOffset);
  if (state.trade.dateKey !== dateKey) state.trade = { dateKey, sold: {} };
  return state.trade;
}

export function sellResource(state, res, qty, now) {
  const cfg = getConfig();
  const rate = cfg.economy.tradeRates[res];
  if (!rate) return fail('The Trading Stump does not buy that.');
  qty = Math.floor(qty);
  if (qty <= 0) return fail('Nothing to sell.');
  if ((state.inventory[res] || 0) < qty) return fail('Not enough to sell.');
  const t = tradeInfo(state, now);
  const left = cfg.economy.tradeDailyLimit - (t.sold[res] || 0);
  if (qty > left) return fail(`Daily limit reached (${left} more today).`);
  const gain = Math.floor(qty * rate);
  if (gain <= 0) return fail('Sell a few more to earn Glimmer.');
  state.inventory[res] -= qty;
  t.sold[res] = (t.sold[res] || 0) + qty;
  state.glimmer += gain;
  return ok({ gain });
}

// ---------------------------------------------------------------- dev controls

export function devGrant(state, amount = 50) {
  for (const r of RESOURCE_IDS) state.inventory[r] += amount;
  state.glimmer += amount * 4;
}

export function devUnlockAll(state, now) {
  const dirs = ['east', 'south', 'west', 'north'];
  let guard = 0;
  while (nextStageInfo(state) && guard++ < 20) {
    const info = nextStageInfo(state);
    for (const p of Object.keys(PROJECTS)) state.projects[p] = { state: 'done', progress: PROJECTS[p].work };
    for (const j of info.stage.discover.jobs || []) state.counters.jobCycles[j] = Math.max(state.counters.jobCycles[j] || 0, info.stage.discover.count);
    let done = false;
    for (const [id] of Object.entries(state.world.areas)) {
      for (const d of dirs) if (!done && expansionOption(state, id, d).ok) { expandForest(state, id, d, now); done = true; }
      if (done) break;
    }
    devConnectAll(state);
    for (const a of Object.values(state.world.areas)) for (const o of a.objects) {
      if (STRUCTURES[o.def].kind === 'clutter') continue;
      o.state = 'built';
      const def = STRUCTURES[o.def];
      if (def.job) state.discoveries.jobs[def.job] = true;
    }
  }
  if (!penCount(state, false)) devGivePen(state);
  state.station = 'moonlit_cradle';
  state.breedingsCompleted = Math.max(state.breedingsCompleted, 2);
  discoverMoonstone(state, now);
  checkUnlocks(state, now);
}

/**
 * Dev / test helper: make every structure reachable by cutting the shortest
 * route from home through thicket (cleared) and water (bridged).
 */
export function devConnectAll(state) {
  const targets = [];
  for (const [id, a] of Object.entries(state.world.areas)) for (const o of a.objects) if (STRUCTURES[o.def].kind !== 'clutter' && o.def !== 'bridge') targets.push({ id, o, a });
  for (const { id, o, a } of targets) {
    if (objectReachable(state, o.id)) continue;
    const reach = reachableTiles(state);
    const goal = (a.cx * AREA_W + o.x) + ',' + (a.cy * AREA_H + o.y);
    const prev = new Map();
    const queue = [...reach].map((k) => k.split(',').map(Number));
    const seen = new Set(reach);
    let found = null;
    while (queue.length && !found) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (x + dx) + ',' + (y + dy);
        if (seen.has(k) || globalTile(state, x + dx, y + dy) === null) continue;
        seen.add(k);
        prev.set(k, x + ',' + y);
        if (k === goal) { found = k; break; }
        queue.push([x + dx, y + dy]);
      }
    }
    for (let k = found; k && !reach.has(k); k = prev.get(k)) {
      const [gx, gy] = k.split(',').map(Number);
      const cx = Math.floor(gx / AREA_W);
      const cy = Math.floor(gy / AREA_H);
      const ar = areaAt(state, cx, cy).area;
      const lx = gx - cx * AREA_W;
      const ly = gy - cy * AREA_H;
      const t = ar.tiles[ly][lx];
      if (t === 'u') setTile(ar, lx, ly, 'g');
      else if (TERRAIN[t]?.water && !ar.objects.some((q) => q.x === lx && q.y === ly)) ar.objects.push({ id: 'o' + state.nextObjectId++, def: 'bridge', x: lx, y: ly, state: 'built', prefab: false });
    }
    bumpWorld(state);
  }
}

export function devFinishIncubations(state, now) {
  for (const b of activeBreedings(state)) b.completesAt = now;
  for (const m of state.mushrooms) m.restUntil = 0;
}

export { STAGE_IDS, TERRAIN };
