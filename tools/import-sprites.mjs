#!/usr/bin/env node
// Merge sprites saved in the Sprite Workshop into assets/sprites.json.
// Usage: node tools/import-sprites.mjs <folder of workshop JSON docs> [assets/sprites.json]
// Each doc is one saved sprite ({ key, name, category, kind, w, h, rows, palette? })
// or a revert/delete marker ({ key, deleted: true }).
import fs from 'node:fs';
import path from 'node:path';

export const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const ROLE_CHARS = { cap: 'hlbdD', stem: 'shkrcwW', face: 'ep', marking: 'amwy', gills: 'gkLvi' };
// mushroom part frames (see src/render/sprites.js)
export const PART_W = 30;
export const PART_H = 36;
export const GILL_H = 4;
const PREFIX_CATEGORY = { structure: 'structure', tile: 'tile', cap: 'cap', stem: 'stem', marking: 'marking', gills: 'gills', face: 'face' };

/** Validate one workshop doc; returns a clean sprite or throws with a readable reason. */
export function cleanSprite(doc) {
  const key = String(doc.key || '');
  if (!/^[a-z]+:[A-Za-z0-9_.-]+$/.test(key)) throw new Error(`bad key "${key}"`);
  const prefix = key.split(':')[0];
  const category = String(doc.category || '');
  if (prefix !== 'custom' && PREFIX_CATEGORY[prefix] !== category) throw new Error(`${key}: category "${category}" does not match`);
  if (prefix === 'custom' && !['decoration', 'other', 'cap', 'stem', 'marking'].includes(category)) throw new Error(`${key}: unknown category "${category}"`);
  const { kind, w, h, rows } = doc;
  if (!['color', 'roles'].includes(kind)) throw new Error(`${key}: unknown kind`);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 64 || h > 64) throw new Error(`${key}: bad size`);
  if (category === 'tile' && (w !== 16 || h !== 16)) throw new Error(`${key}: tiles must be 16×16`);
  if (['cap', 'stem', 'face', 'marking'].includes(category) && (w !== PART_W || h !== PART_H)) throw new Error(`${key}: mushroom parts must be ${PART_W}×${PART_H}`);
  if (category === 'gills' && (w !== PART_W || h !== GILL_H)) throw new Error(`${key}: gills must be ${PART_W}×${GILL_H}`);
  if (!Array.isArray(rows) || rows.length !== h || rows.some((r) => typeof r !== 'string' || r.length !== w)) throw new Error(`${key}: rows do not match the size`);
  const out = { name: String(doc.name || key).slice(0, 32), category, kind, w, h, rows };
  if (kind === 'color') {
    const pal = doc.palette;
    if (!Array.isArray(pal) || pal.length > ALPHA.length || pal.some((p) => !/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(p))) throw new Error(`${key}: bad palette`);
    const ok = new Set(['.', ...ALPHA.slice(0, pal.length)]);
    if (rows.some((r) => [...r].some((c) => !ok.has(c)))) throw new Error(`${key}: a pixel uses a colour that is not in the palette`);
    out.palette = pal.map((p) => p.toLowerCase());
  } else {
    const roles = ROLE_CHARS[category];
    if (!roles) throw new Error(`${key}: ${category} sprites must be full-colour`);
    const ok = new Set(['.', ...roles]);
    if (rows.some((r) => [...r].some((c) => !ok.has(c)))) throw new Error(`${key}: unknown colour role`);
  }
  return out;
}

/** Apply workshop docs to a sprites.json object. Returns { json, changes, errors }. */
export function applyDocs(json, docs) {
  const sprites = { ...(json.sprites || {}) };
  const changes = [];
  const errors = [];
  for (const doc of docs) {
    try {
      if (doc.deleted) {
        if (sprites[doc.key]) { delete sprites[doc.key]; changes.push(`restored original: ${doc.key}`); }
        continue;
      }
      const clean = cleanSprite(doc);
      changes.push(`${sprites[doc.key] ? 'updated' : 'added'}: ${doc.key}`);
      sprites[doc.key] = clean;
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { json: { ...json, sprites }, changes, errors };
}

function readDocs(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir, { recursive: true })) {
    if (!String(f).endsWith('.json')) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, String(f)), 'utf8'));
    out.push(doc.data && doc.data.key ? doc.data : doc);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, target = 'assets/sprites.json'] = process.argv.slice(2);
  if (!dir) { console.error('usage: node tools/import-sprites.mjs <docs folder> [assets/sprites.json]'); process.exit(1); }
  const json = JSON.parse(fs.readFileSync(target, 'utf8'));
  const { json: next, changes, errors } = applyDocs(json, readDocs(dir));
  fs.writeFileSync(target, JSON.stringify(next, null, 1) + '\n');
  console.log(changes.join('\n') || 'no changes');
  if (errors.length) { console.error('skipped:\n' + errors.join('\n')); process.exitCode = 2; }
}
