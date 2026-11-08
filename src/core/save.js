// Save/load, schema validation and migration (GDD 3, 18, 20).
import { RESOURCE_IDS, STAGE_BY_ID, STRUCTURES } from '../content/world.js';
import { SCHEMA_VERSION } from './game.js';
import { enforceLimits } from './genetics.js';
import { validateRecord, shareRecord } from './share.js';

export const SAVE_KEY = 'mushroomForest.save';
export const BACKUP_KEY = 'mushroomForest.save.backup';

// Ordered migrations: index i migrates schema i+1 -> i+2. (None yet: v1 is the first schema.)
const MIGRATIONS = [];

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
    if (!STAGE_BY_ID[id] || !Array.isArray(area.objects) || !Array.isArray(area.tiles)) throw new Error('Invalid world data.');
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
