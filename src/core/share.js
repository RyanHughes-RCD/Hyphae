// Portable mushroom share codes and import validation (GDD 14).
import { getConfig, STATS, COLOR_GROUPS } from '../config.js';
import { ATTRIBUTE_BY_ID, CATEGORIES, ALLOC_TEMPLATE_IDS, TEMPERAMENT_BY_ID } from '../content/attributes.js';
import { PERK_BY_ID, MUTATION_BY_ID } from '../content/genetics.js';
import { hash, hashHex } from './rng.js';
import { newMushroom, resolveMutationBonuses, maxTraitsForGeneration } from './genetics.js';
import { sanitizeName, recordDiscovery } from './game.js';

export const SHARE_VERSION = 1;
const PREFIX = 'MF1-';

// ---------- encoding ----------
function toB64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function canonicalGenetics(m) {
  // the hidden colour is only part of the identity when it differs from the shown one,
  // so share codes made before colour genes existed keep their ids
  const al = m.genes.colorAlleles;
  const hidden = al && !(sameRgb(al[0], m.genes.color) && sameRgb(al[1], m.genes.color)) ? al : null;
  return JSON.stringify([m.genes.cap, m.genes.stem, m.genes.markings, m.genes.gills, m.genes.glow, m.genes.color, ...(hidden ? [hidden] : []), m.genes.alloc,
    m.genes.accent, m.genes.stemColor, m.genes.pattern, m.temperament, m.generation,
    m.traits.map((t) => [t.traitUid, t.stat, t.bonus]), m.perks.map((p) => [p.perkId, p.level]), m.mutation?.mutationId ?? null]);
}

const sameRgb = (p, q) => p && q && p[0] === q[0] && p[1] === q[1] && p[2] === q[2];

export function computeShareId(m, originalId, originForestId) {
  return 'sh_' + hashHex(canonicalGenetics(m), originalId, originForestId);
}

/** Build the compact share record for an owned mushroom. */
export function shareRecord(state, m, now = Date.now()) {
  const originalId = m.origin?.originalId || m.uid;
  const originForestId = state.forest.id;
  const lin = m.lineage?.parents?.map((p) => ({
    n: p.name, id: p.uid, g: p.generation, f: p.forestName ?? null,
    p: p.parents ? p.parents.map((q) => ({ n: q.name, id: q.uid, g: q.generation, f: q.forestName ?? null })) : null,
  })) ?? null;
  return {
    v: SHARE_VERSION,
    sid: computeShareId(m, originalId, originForestId),
    n: m.name,
    oid: originalId,
    fid: originForestId,
    fn: state.forest.name,
    g: m.generation,
    ge: {
      c: m.genes.cap, st: m.genes.stem, mk: m.genes.markings, gi: m.genes.gills, gl: m.genes.glow,
      col: m.genes.color, ca: m.genes.colorAlleles, al: m.genes.alloc, ac: m.genes.accent, sc: m.genes.stemColor, p: m.genes.pattern,
    },
    te: m.temperament,
    tr: m.traits.map((t) => [t.traitUid, t.stat, t.bonus, t.originMushroomId, t.originName, t.originGeneration, t.originForestId]),
    pk: m.perks.map((p) => [p.perkId, p.level, p.originMushroomId, p.originGeneration, p.originForestId]),
    mu: m.mutation ? [m.mutation.mutationId, m.mutation.origin, m.mutation.originMushroomId, m.mutation.originGeneration, m.mutation.originForestId] : null,
    ln: lin,
    x: now,
  };
}

export function exportMushroom(state, uid, now = Date.now()) {
  const m = state.mushrooms.find((x) => x.uid === uid);
  if (!m) return { ok: false, reason: 'Only your own mushrooms can be shared (Guests cannot be re-shared).' };
  const json = JSON.stringify(shareRecord(state, m, now));
  const code = PREFIX + toB64Url(json) + '.' + hash(json).toString(36);
  if (code.length > getConfig().sharing.maxSharePayloadBytes) return { ok: false, reason: 'This mushroom record is too large to share.' };
  return { ok: true, code, json };
}

// ---------- validation ----------
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isRgb = (a) => Array.isArray(a) && a.length === 3 && a.every((c) => isInt(c, 0, 255));
const isId = (s) => typeof s === 'string' && s.length > 0 && s.length <= 48 && /^[A-Za-z0-9_\-]+$/.test(s);
const optId = (s) => s === null || s === undefined || isId(s);
const okStr = (s, max) => typeof s === 'string' && s.length <= max;

export function decodeShareText(text) {
  const cfg = getConfig();
  if (typeof text !== 'string') return { ok: false, errors: ['Nothing to import.'] };
  let t = text.trim();
  if (t.length > cfg.sharing.maxSharePayloadBytes * 2) return { ok: false, errors: ['The share data is too large.'] };
  // Accept a share file ({"format":"mushroom-forest-share","code":...}) or a bare code
  if (t.startsWith('{')) {
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj.code === 'string') t = obj.code.trim();
      else return { ok: false, errors: ['This file is not a Mushroom Forest share file.'] };
    } catch {
      return { ok: false, errors: ['This file could not be read.'] };
    }
  }
  if (t.length > cfg.sharing.maxSharePayloadBytes) return { ok: false, errors: ['The share code is too large.'] };
  if (!t.startsWith(PREFIX)) return { ok: false, errors: ['Share codes start with "MF1-".'] };
  const body = t.slice(PREFIX.length);
  const dot = body.lastIndexOf('.');
  if (dot < 0) return { ok: false, errors: ['The share code is incomplete.'] };
  let json;
  try {
    json = fromB64Url(body.slice(0, dot));
  } catch {
    return { ok: false, errors: ['The share code is damaged.'] };
  }
  if (hash(json).toString(36) !== body.slice(dot + 1)) return { ok: false, errors: ['The share code is damaged (checksum mismatch). Make sure you copied all of it.'] };
  let rec;
  try {
    rec = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['The share code is damaged.'] };
  }
  return { ok: true, record: rec };
}

/** Validate a decoded share record. Returns a list of human-readable errors. */
export function validateRecord(rec) {
  const cfg = getConfig();
  const e = [];
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return ['Invalid share record.'];
  if (rec.v !== SHARE_VERSION) {
    return [typeof rec.v === 'number' && rec.v > SHARE_VERSION ? 'This mushroom needs a newer version of Mushroom Forest.' : 'Unsupported share format.'];
  }
  if (!isId(rec.sid) || !isId(rec.oid) || !isId(rec.fid)) e.push('Missing or invalid identity fields.');
  if (!okStr(rec.n, cfg.sharing.nameMaxLength) || !sanitizeName(rec.n)) e.push('Invalid name.');
  if (rec.fn !== null && rec.fn !== undefined && !okStr(rec.fn, cfg.sharing.nameMaxLength)) e.push('Invalid forest name.');
  if (!isInt(rec.g, 1, 100000)) e.push('Invalid generation.');
  const ge = rec.ge;
  if (!ge || typeof ge !== 'object') return e.concat('Missing genes.');
  const genes = { cap: ge.c, stem: ge.st, markings: ge.mk, gills: ge.gi, glow: ge.gl };
  let unknownContent = false;
  for (const cat of CATEGORIES) {
    const def = ATTRIBUTE_BY_ID[genes[cat]];
    if (!def) { unknownContent = typeof genes[cat] === 'string'; e.push(`Unknown ${cat} attribute.`); } else if (def.category !== cat) e.push(`Attribute in wrong category: ${cat}.`);
  }
  if (!isRgb(ge.col) || !isRgb(ge.ac) || !isRgb(ge.sc)) e.push('Invalid colour values.');
  if (ge.ca !== undefined && !(Array.isArray(ge.ca) && ge.ca.length === 2 && ge.ca.every(isRgb))) e.push('Invalid colour genes.');
  if (!isInt(ge.p, 0, 99999)) e.push('Invalid pattern seed.');
  if (!ge.al || typeof ge.al !== 'object') e.push('Invalid colour allocation.');
  else {
    for (const [group, stats] of Object.entries(COLOR_GROUPS)) {
      const a = ge.al[group];
      if (!a || !ALLOC_TEMPLATE_IDS.includes(a.t) || !Array.isArray(a.o) || a.o.length !== stats.length
        || new Set(a.o).size !== stats.length || !a.o.every((s) => stats.includes(s))) e.push(`Invalid ${group} colour allocation.`);
    }
  }
  if (!TEMPERAMENT_BY_ID[rec.te]) e.push('Unknown temperament.');

  // Advanced Traits
  if (!Array.isArray(rec.tr)) e.push('Invalid traits.');
  else {
    if (rec.tr.length > cfg.traits.maxAdvancedTraits) e.push(`Too many Advanced Traits (max ${cfg.traits.maxAdvancedTraits}).`);
    const uids = new Set();
    for (const t of rec.tr) {
      if (!Array.isArray(t) || !isId(t[0]) || !STATS.includes(t[1])) { e.push('Invalid Advanced Trait.'); continue; }
      if (t[2] !== cfg.traits.advancedTraitBonus) e.push(`Advanced Trait bonus must be +${cfg.traits.advancedTraitBonus}.`);
      if (uids.has(t[0])) e.push('Duplicate Advanced Trait.');
      uids.add(t[0]);
      if (!optId(t[3]) || !(t[4] === null || okStr(t[4], cfg.sharing.nameMaxLength)) || !(t[5] === null || isInt(t[5], 1, 100000)) || !optId(t[6])) e.push('Invalid Advanced Trait origin.');
    }
    if (isInt(rec.g, 1, 100000) && rec.tr.length > maxTraitsForGeneration(rec.g)) e.push('Implausible: too many Advanced Traits for its generation.');
  }
  // Perks
  if (!Array.isArray(rec.pk)) e.push('Invalid perks.');
  else {
    if (rec.pk.length > cfg.perks.maxPerks) e.push(`Too many Perks (max ${cfg.perks.maxPerks}).`);
    const ids = new Set();
    for (const p of rec.pk) {
      const def = Array.isArray(p) && PERK_BY_ID[p[0]];
      if (!def) { if (Array.isArray(p) && typeof p[0] === 'string') unknownContent = true; e.push('Unknown Perk.'); continue; }
      if (ids.has(p[0])) e.push('Duplicate Perk.');
      ids.add(p[0]);
      if (!isInt(p[1], 1, def.levels.length)) e.push(`${def.name} level out of range.`);
      else if (isInt(rec.g, 1, 100000) && rec.g < p[1] + 1) e.push(`Implausible: ${def.name} level too high for its generation.`);
      if (!optId(p[2]) || !(p[3] === null || isInt(p[3], 1, 100000)) || !optId(p[4])) e.push('Invalid Perk origin.');
    }
  }
  // Mutation
  if (rec.mu !== null && rec.mu !== undefined) {
    if (!Array.isArray(rec.mu) || !MUTATION_BY_ID[rec.mu[0]]) {
      if (Array.isArray(rec.mu) && typeof rec.mu[0] === 'string') unknownContent = true;
      e.push('Unknown Mutation.');
    } else {
      if (!['spontaneous', 'inherited'].includes(rec.mu[1])) e.push('Invalid Mutation origin.');
      if (isInt(rec.g, 1, 100000) && rec.g < 2) e.push('Implausible: generation 1 mushrooms cannot carry Mutations.');
    }
  }
  if (rec.ln !== null && rec.ln !== undefined) {
    const okSnap = (s) => s && okStr(s.n, cfg.sharing.nameMaxLength) && isId(s.id) && isInt(s.g, 1, 100000) && (s.f === null || s.f === undefined || okStr(s.f, cfg.sharing.nameMaxLength));
    if (!Array.isArray(rec.ln) || rec.ln.length !== 2 || !rec.ln.every((s) => okSnap(s) && (s.p === null || s.p === undefined || (Array.isArray(s.p) && s.p.length <= 2 && s.p.every(okSnap))))) e.push('Invalid lineage.');
  }
  if (unknownContent) e.unshift('This mushroom needs a newer version of Mushroom Forest.');
  return [...new Set(e)];
}

/** Turn a validated record into a Guest mushroom (stats are never trusted — they are recalculated). */
export function recordToGuest(state, rec, now) {
  const genes = {
    cap: rec.ge.c, stem: rec.ge.st, markings: rec.ge.mk, gills: rec.ge.gi, glow: rec.ge.gl,
    color: rec.ge.col.slice(), colorAlleles: rec.ge.ca ? rec.ge.ca.map((c) => c.slice()) : [rec.ge.col.slice(), rec.ge.col.slice()], alloc: structuredClone(rec.ge.al), accent: rec.ge.ac.slice(), stemColor: rec.ge.sc.slice(), pattern: rec.ge.p,
  };
  const m = newMushroom({
    uid: 'g_' + hashHex(rec.sid, state.forest.id),
    name: sanitizeName(rec.n),
    createdAt: now,
    generation: rec.g,
    status: 'guest',
    genes,
    temperament: rec.te,
    traits: rec.tr.map((t) => ({
      traitUid: t[0], stat: t[1], bonus: getConfig().traits.advancedTraitBonus,
      originMushroomId: t[3] ?? null, originName: t[4] ? sanitizeName(t[4]) : null, originGeneration: t[5] ?? null, originForestId: t[6] ?? null, originBreedingId: null,
    })),
    perks: rec.pk.map((p) => ({ perkId: p[0], level: p[1], originMushroomId: p[2] ?? null, originGeneration: p[3] ?? null, originForestId: p[4] ?? null })),
    mutation: rec.mu ? {
      mutationId: rec.mu[0], bonuses: resolveMutationBonuses(rec.mu[0], genes), origin: rec.mu[1],
      originMushroomId: rec.mu[2] ?? null, originGeneration: rec.mu[3] ?? null, originForestId: rec.mu[4] ?? null,
    } : null,
    lineage: rec.ln ? {
      parents: rec.ln.map((s) => ({
        uid: s.id, name: sanitizeName(s.n), generation: s.g, forestName: s.f ? sanitizeName(s.f) : null,
        parents: s.p ? s.p.map((q) => ({ uid: q.id, name: sanitizeName(q.n), generation: q.g, forestName: q.f ? sanitizeName(q.f) : null })) : null,
      })),
    } : null,
    origin: { kind: 'guest', forestId: rec.fid, forestName: rec.fn ? sanitizeName(rec.fn) : 'A friend', originalId: rec.oid },
  });
  m.shareId = rec.sid;
  return m;
}

/** Decode + validate + check duplicates. Does not modify state. */
export function previewImport(state, text, now = Date.now()) {
  const dec = decodeShareText(text);
  if (!dec.ok) return dec;
  const errors = validateRecord(dec.record);
  if (errors.length) return { ok: false, errors };
  const rec = dec.record;
  if (rec.fid === state.forest.id) return { ok: false, errors: ['This mushroom came from your own forest.'] };
  if (state.importedShareIds.includes(rec.sid) || state.guests.some((g) => g.shareId === rec.sid)) return { ok: false, errors: ['This mushroom is already in your Guest Grove.'] };
  // the share id must match its genetics (detects edited genetics with a reused id)
  const guest = recordToGuest(state, rec, now);
  if (computeShareId(guest, rec.oid, rec.fid) !== rec.sid) return { ok: false, errors: ['This share code was modified and cannot be trusted.'] };
  if (state.guests.length >= getConfig().sharing.guestCap) return { ok: false, errors: [`Your Guest Grove is full (${getConfig().sharing.guestCap}). Remove a Guest first.`] };
  return { ok: true, guest, record: rec };
}

export function importGuest(state, text, now = Date.now()) {
  const p = previewImport(state, text, now);
  if (!p.ok) return p;
  state.guests.push(p.guest);
  state.importedShareIds.push(p.record.sid);
  recordDiscovery(state, p.guest);
  return { ok: true, guest: p.guest };
}

export function removeGuest(state, uid) {
  state.guests = state.guests.filter((g) => g.uid !== uid);
  return { ok: true };
}
