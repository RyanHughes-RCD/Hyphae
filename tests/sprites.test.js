// Sprite Workshop uploads: validation and merging, and custom decorations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDocs, cleanSprite } from '../tools/import-sprites.mjs';
import { STRUCTURES, registerCustomDecorations } from '../src/content/world.js';

const rows = (w, h, ch = '.') => Array.from({ length: h }, () => ch.repeat(w));

test('valid workshop sprites are merged; reverts restore the original', () => {
  const docs = [
    { key: 'structure:home', category: 'structure', kind: 'color', w: 16, h: 18, palette: ['#ff0000', '#00ff0080'], rows: rows(16, 18, '1') },
    { key: 'cap:roundcap', category: 'cap', kind: 'roles', w: 24, h: 28, rows: rows(24, 28, 'b') },
    { key: 'gills:fine', category: 'gills', kind: 'roles', w: 24, h: 2, rows: rows(24, 2, 'g') },
    { key: 'tile:g', deleted: true },
  ];
  const { json, changes, errors } = applyDocs({ version: 1, sprites: { 'tile:g': { kind: 'color' } } }, docs);
  assert.deepEqual(errors, []);
  assert.ok(json.sprites['structure:home'] && json.sprites['cap:roundcap'] && json.sprites['gills:fine']);
  assert.equal(json.sprites['tile:g'], undefined);
  assert.equal(changes.length, 4);
});

test('invalid sprites are rejected with a reason', () => {
  const bad = [
    { key: 'tile:g', category: 'tile', kind: 'color', w: 8, h: 8, palette: ['#000000'], rows: rows(8, 8, '0') },
    { key: 'cap:roundcap', category: 'cap', kind: 'roles', w: 24, h: 28, rows: rows(24, 28, 'z') },
    { key: 'structure:home', category: 'structure', kind: 'color', w: 16, h: 16, palette: ['#000000'], rows: rows(16, 16, '5') },
    { key: 'structure:home', category: 'tile', kind: 'color', w: 16, h: 16, palette: ['#000000'], rows: rows(16, 16, '0') },
    { key: 'custom:x', category: 'decoration', kind: 'color', w: 16, h: 16, palette: ['javascript:'], rows: rows(16, 16, '0') },
    { key: '../evil', category: 'tile', kind: 'color', w: 16, h: 16, palette: [], rows: rows(16, 16) },
  ];
  for (const d of bad) assert.throws(() => cleanSprite(d));
});

test('custom decorations become buildable decorations', () => {
  registerCustomDecorations({
    'custom:mossy-lantern': { name: 'Mossy Lantern', category: 'decoration', kind: 'color', w: 16, h: 24, palette: ['#ffffff'], rows: rows(16, 24, '0') },
    'custom:idea': { name: 'Idea', category: 'other', kind: 'color', w: 16, h: 16, palette: [], rows: rows(16, 16) },
  });
  const d = STRUCTURES['custom_mossy_lantern'];
  assert.ok(d && d.kind === 'decor' && d.buildable && d.overrideKey === 'custom:mossy-lantern');
  assert.equal(STRUCTURES['custom_idea'], undefined);
});
