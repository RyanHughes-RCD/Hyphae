// Save/load, schema validation and migration (GDD 3, 18, 20).
import { RESOURCE_IDS, STAGE_BY_ID, STRUCTURES } from '../content/world.js';
import { STARTER_PALETTE } from '../content/attributes.js';
import { hash } from './rng.js';
import { SCHEMA_VERSION } from './game.js';
import { enforceLimits } from './genetics.js';
import { validateRecord, shareRecord } from './share.js';

export const SAVE_KEY = 'mushroomForest.save';
export const BACKUP_KEY = 'mushroomForest.save.backup';

// Ordered migrations: index i migrates schema i+1 -> i+2.
const MIGRATIONS = [
  // v1 -> v2: separate areas became clearings in one forest. Give each a chunk
  // position, placing them in discovery order next to existing clearings.
  (obj) => {
    const areas = obj.world?.areas || {};
    const order = Object.entries(areas).sort((a, b) => (a[1].discoveredAt || 0) - (b[1].discoveredAt || 0));
    const taken = new Set();
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const placed = [];
    for (const [id, area] of order) {
      area.stage = id;
      let spot = { cx: 0, cy: 0 };
      if (id !== 'clearing' || taken.has('0,0')) {
        outer: for (const p of placed.length ? placed : [{ cx: 0, cy: 0 }]) {
          for (const [dx, dy] of dirs) {
            const k = `${p.cx + dx},${p.cy + dy}`;
            if (!taken.has(k)) { spot = { cx: p.cx + dx, cy: p.cy + dy }; break outer; }
          }
        }
      }
      area.cx = spot.cx;
      area.cy = spot.cy;
      taken.add(`${spot.cx},${spot.cy}`);
      placed.push(spot);
    }
    obj.schemaVersion = 2;
    return obj;
  },
  // v2 -> v3: colour became two genes. The shown colour becomes one gene and
  // each mushroom gets a hidden colour, chosen from its id so it is stable.
  (obj) => {
    const add = (m) => {
      if (!m?.genes || m.genes.colorAlleles) return;
      const pal = STARTER_PALETTE[hash(m.uid, 'hiddenColour') % STARTER_PALETTE.length].rgb;
      m.genes.colorAlleles = [m.genes.color.slice(), pal.slice()];
    };
    for (const m of [...(obj.mushrooms || []), ...(obj.guests || [])]) add(m);
    for (const v of obj.wildVisitors || []) add(v.mushroom);
    for (const r of obj.breedings || []) { add(r.offspring); for (const p of r.parentSnapshots || []) add(p); }
    obj.schemaVersion = 3;
    return obj;
  },
  // v3 -> v4: the free Breeding Nook became a Breeding Pen you buy and place;
  // existing nooks turn into pens (now movable).
  (obj) => {
    for (const area of Object.values(obj.world?.areas || {})) {
      for (const o of area.objects || []) if (o.def === 'breeding_nook') { o.def = 'breeding_pen'; o.prefab = false; }
    }
    obj.schemaVersion = 4;
    return obj;
  },
];

export function migrate(obj) {
  let v = obj.schemaVersion;
  if (typeof v !== 'number' || v < 1) throw new Error('Unknown save version.');
  if (v > SCHEMA_VERSION) throw new Error('This save was made by a newer version of Mushroom Forest.');
  while (v < SCHEMA_VERSION) {
    obj = MIGRATIONS[v - 1](obj);
    v = obj.schemaVersion;
  }
  return obj;
}

function validMushroom(m, forestLike) {
  if (!m || typeof m !== 'object' || typeof m.uid !== 'string' || !m.genes) return false;
  // reuse the share-record validator on the genetic content
  const rec = shareRecord(forestLike, { ...m, lineage: null }, 0);
  rec.n = rec.n || 'x';
  const errs = validateRecord(rec).filter((e) => !e.startsWith('Implausible'));
  return errs.length === 0;
}

/** Throws with a readable message if the object is not a valid save. */
export function validateSave(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Not a save file.');
  for (const k of ['forest', 'mushrooms', 'inventory', 'world', 'guests', 'breedings', 'unlocks', 'discoveries', 'counters']) {
    if (!(k in obj)) throw new Error(`Save is missing "${k}".`);
  }
  if (!Array.isArray(obj.mushrooms) || obj.mushrooms.length === 0) throw new Error('Save has no mushrooms.');
  if (typeof obj.forest?.id !== 'string') throw new Error('Save has no forest identity.');
  const forestLike = { forest: obj.forest };
  for (const m of obj.mushrooms.concat(obj.guests)) if (!validMushroom(m, forestLike)) throw new Error(`Save contains an invalid mushroom (${m?.name ?? '?'}).`);
  if (typeof obj.glimmer !== 'number' || obj.glimmer < 0 || !Number.isFinite(obj.glimmer)) throw new Error('Invalid Glimmer balance.');
  for (const [r, n] of Object.entries(obj.inventory)) if (typeof n !== 'number' || n < 0 || !Number.isFinite(n)) throw new Error(`Invalid amount of ${r}.`);
  for (const [id, area] of Object.entries(obj.world.areas || {})) {
    if (!(STAGE_BY_ID[id] || /^c\d+x*$/.test(id)) || !Array.isArray(area.objects) || !Array.isArray(area.tiles)
      || !Number.isInteger(area.cx) || !Number.isInteger(area.cy)) throw new Error('Invalid world data.');
    for (const o of area.objects) if (!STRUCTURES[o.def]) throw new Error('Unknown structure in save.');
  }
  return true;
}

/** Normalize a loaded save: fill new fields, enforce caps in logic (never trust stored values). */
export function normalize(obj) {
  for (const r of RESOURCE_IDS) if (typeof obj.inventory[r] !== 'number') obj.inventory[r] = 0;
  obj.glimmer = Math.floor(obj.glimmer);
  for (const m of obj.mushrooms.concat(obj.guests)) enforceLimits(m);
  obj.dev = obj.dev || { timeOffset: 0, override: null, force: {} };
  obj.dev.force = obj.dev.force || {};
  obj.settings = obj.settings || { sound: false, reducedMotion: false, dev: false };
  obj.tutorials = obj.tutorials || {};
  obj.activity = obj.activity || [];
  obj.importedShareIds = obj.importedShareIds || [];
  obj.wildVisitors = obj.wildVisitors || [];
  obj.flags = obj.flags || { firstTraitGranted: false };
  return obj;
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function parseSave(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('This file is not a Mushroom Forest save.');
  }
  if (obj && obj.format === 'mushroom-forest-save') obj = obj.save;
  obj = migrate(obj);
  validateSave(obj);
  return normalize(obj);
}

// ---------- browser storage (localStorage; small and synchronous) ----------

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadFromStorage() {
  const ls = storage();
  if (!ls) return { state: null };
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    const text = ls.getItem(key);
    if (!text) continue;
    try {
      return { state: parseSave(text), fromBackup: key === BACKUP_KEY };
    } catch (err) {
      console.warn('Save in', key, 'rejected:', err.message);
    }
  }
  return { state: null };
}

/** Write the save; the previous valid save is kept as a backup. */
export function writeToStorage(state) {
  const ls = storage();
  if (!ls) return false;
  const text = serialize(state);
  try {
    const prev = ls.getItem(SAVE_KEY);
    if (prev) ls.setItem(BACKUP_KEY, prev);
    ls.setItem(SAVE_KEY, text);
    return true;
  } catch (err) {
    console.warn('Could not save:', err.message);
    return false;
  }
}

export function clearStorage() {
  const ls = storage();
  if (!ls) return;
  ls.removeItem(SAVE_KEY);
  ls.removeItem(BACKUP_KEY);
}

export function saveFileText(state) {
  return JSON.stringify({ format: 'mushroom-forest-save', exportedAt: Date.now(), save: state });
}
