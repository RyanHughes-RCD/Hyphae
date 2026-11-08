// The 16 required tests from GDD Section 22.1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetConfig, setConfig, getConfig, STATS } from '../src/config.js';
import { CATEGORIES, ATTRIBUTE_BY_ID } from '../src/content/attributes.js';
import { computeStats, colorGroupPoints, colorContribution, baseStats, statSum } from '../src/core/stats.js';
import { generateStarters, resolveBreeding, newMushroom } from '../src/core/genetics.js';
import * as G from '../src/core/game.js';
import { exportMushroom, importGuest, previewImport, shareRecord } from '../src/core/share.js';
import { serialize, parseSave } from '../src/core/save.js';
import { hash } from '../src/core/rng.js';

const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);
const ALL_ON = { traits: true, perks: true, mutations: true };

function mk(uid, genesOver = {}, extra = {}) {
  const genes = {
    cap: 'roundcap', stem: 'sturdy', markings: 'spots', gills: 'pored', glow: 'none', color: [255, 170, 0],
    alloc: { red: { t: 'lean', o: ['CUL', 'MYC', 'FOR'] }, green: { t: 'focus', o: ['CON', 'MAG', 'ANI'] }, blue: { t: 'even', o: ['DIS', 'SOC'] } },
    accent: [240, 230, 210], stemColor: [230, 220, 200], pattern: 1, ...genesOver,
  };
  return newMushroom({ uid, name: uid, generation: 2, genes, temperament: 'gentle', ...extra });
}

function ctx(seed, over = {}) {
  return { seed, unlocks: ALL_ON, rareVariation: false, firstBreed: false, guaranteeTrait: false, breedingId: 'b', forest: { id: 'f_test', name: 'Test' }, now: NOW, ...over };
}

test.beforeEach(() => resetConfig());

test('1. every new player receives exactly three basic mushrooms', () => {
  for (let i = 0; i < 300; i++) {
    const s = G.newGame({ now: NOW, seed: 'seed' + i, tzOffset: 0 });
    assert.equal(s.mushrooms.length, 3);
    for (const m of s.mushrooms) {
      assert.equal(m.generation, 1);
      for (const cat of CATEGORIES) assert.equal(ATTRIBUTE_BY_ID[m.genes[cat]].tier, 'basic');
      for (const s2 of STATS) assert.ok(computeStats(m).final[s2] <= getConfig().starters.starterMaxStat);
    }
  }
});

test('2. starter mushrooms have no Advanced Traits, Perks or Mutations', () => {
  for (let i = 0; i < 300; i++) {
    for (const m of generateStarters('s' + i)) {
      assert.deepEqual(m.traits, []);
      assert.deepEqual(m.perks, []);
      assert.equal(m.mutation, null);
    }
  }
});

test('3. identical ordinary attributes always generate identical stat contributions', () => {
  const a = mk('a');
  const b = mk('b');
  assert.deepEqual(baseStats(a.genes), baseStats(b.genes));
  const before = JSON.stringify(computeStats(a));
  for (let i = 0; i < 5; i++) assert.equal(JSON.stringify(computeStats(a)), before);
  const reloaded = JSON.parse(JSON.stringify(a));
  assert.deepEqual(computeStats(reloaded), computeStats(a));
});

test('4. every colour gene contributes exactly 12 points', () => {
  const edge = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255], [1, 0, 0], [255, 255, 255], [7, 3, 1], [128, 64, 200]];
  for (let i = 0; i < 2000; i++) edge.push([hash(i, 'r') % 256, hash(i, 'g') % 256, hash(i, 'b') % 256]);
  for (const rgb of edge) {
    const pts = colorGroupPoints(rgb);
    assert.equal(pts.reduce((x, y) => x + y, 0), 12, String(rgb));
    for (const t of ['focus', 'lean', 'even']) {
      const alloc = { red: { t, o: ['CUL', 'MYC', 'FOR'] }, green: { t, o: ['CON', 'MAG', 'ANI'] }, blue: { t, o: ['DIS', 'SOC'] } };
      assert.equal(statSum(colorContribution(rgb, alloc)), 12);
    }
  }
});

test('5. yellow distributes its budget 6/6/0', () => {
  assert.deepEqual(colorGroupPoints([255, 255, 0]), [6, 6, 0]);
  const alloc = { red: { t: 'lean', o: ['CUL', 'MYC', 'FOR'] }, green: { t: 'lean', o: ['CON', 'MAG', 'ANI'] }, blue: { t: 'even', o: ['DIS', 'SOC'] } };
  assert.deepEqual(colorContribution([255, 255, 0], alloc), { CUL: 4, MYC: 2, FOR: 0, CON: 4, MAG: 2, ANI: 0, DIS: 0, SOC: 0 });
});

test('6. white distributes its budget 4/4/4 (brightness independent)', () => {
  assert.deepEqual(colorGroupPoints([255, 255, 255]), [4, 4, 4]);
  assert.deepEqual(colorGroupPoints([100, 100, 100]), [4, 4, 4]);
  assert.deepEqual(colorGroupPoints([0, 0, 0]), [4, 4, 4]);
  const alloc = { red: { t: 'focus', o: ['MYC', 'CUL', 'FOR'] }, green: { t: 'focus', o: ['CON', 'MAG', 'ANI'] }, blue: { t: 'focus', o: ['SOC', 'DIS'] } };
  assert.deepEqual(colorContribution([255, 255, 255], alloc), { CUL: 0, MYC: 4, FOR: 0, CON: 4, MAG: 0, ANI: 0, DIS: 0, SOC: 4 });
});

test('7. Advanced Traits provide exactly +4 to one eligible stat', () => {
  setConfig({ traits: { newAdvancedTraitChance: 1 } });
  const a = mk('a');
  const b = mk('b', { cap: 'bellcap' });
  let made = 0;
  for (let i = 0; i < 300; i++) {
    const { offspring, log } = resolveBreeding(a, b, ctx('t' + i));
    assert.ok(log.newTrait);
    made++;
    const withT = computeStats(offspring);
    const without = computeStats({ ...offspring, traits: [] });
    const diffs = STATS.filter((s) => withT.final[s] !== without.final[s]);
    assert.equal(diffs.length, 1);
    assert.equal(withT.final[diffs[0]] - without.final[diffs[0]], 4);
  }
  assert.equal(made, 300);
  // a stat without 4 points of headroom is never chosen
  const traits = Array.from({ length: 7 }, (_, i) => ({ traitUid: 'tc' + i, stat: 'CON', bonus: 4 }));
  setConfig({ traits: { newAdvancedTraitChance: 1, traitInheritChanceSingle: 1, traitInheritChanceShared: 1 }, stats: { statCap: 60 } });
  const strong = mk('s', {}, { traits });
  for (let i = 0; i < 100; i++) {
    const { offspring, log } = resolveBreeding(strong, strong, ctx('h' + i));
    const cur = computeStats({ ...offspring, traits: offspring.traits.filter((t) => t !== log.newTrait) });
    if (log.newTrait) assert.ok(cur.final[log.newTrait.stat] + 4 <= 60);
  }
});

test('8. no stat can exceed 100', () => {
  const traits = Array.from({ length: 8 }, (_, i) => ({ traitUid: 't' + i, stat: 'MAG', bonus: 4 }));
  const m = mk('max', { cap: 'lanterncap', stem: 'crystal', markings: 'constellation', glow: 'radiant', gills: 'ridged', color: [0, 255, 0],
    alloc: { red: { t: 'focus', o: ['CUL', 'MYC', 'FOR'] }, green: { t: 'focus', o: ['MAG', 'CON', 'ANI'] }, blue: { t: 'focus', o: ['DIS', 'SOC'] } } },
  { traits, mutation: { mutationId: 'starfall_aura', bonuses: { MAG: 18, CON: 18 } } });
  // the strongest legal Magic build reaches 98; force an over-cap case explicitly
  m.traits.push({ traitUid: 'extra', stat: 'MAG', bonus: 4 });
  const s = computeStats(m);
  assert.equal(s.final.MAG, 100);
  assert.ok(s.overflow.MAG > 0);
  for (const k of STATS) assert.ok(s.final[k] <= 100);
});

test('9. no mushroom can have more than three Perks', () => {
  setConfig({ perks: { perkInheritChanceSingle: 1, perkInheritChanceShared: 1, newPerkChance: 1 } });
  const a = mk('a', {}, { perks: [{ perkId: 'rain_worker', level: 1 }, { perkId: 'night_shift', level: 1 }, { perkId: 'green_thumb', level: 1 }] });
  const b = mk('b', {}, { perks: [{ perkId: 'team_player', level: 1 }, { perkId: 'spore_sower', level: 1 }, { perkId: 'gift_wrapper', level: 1 }] });
  for (let i = 0; i < 300; i++) {
    const { offspring } = resolveBreeding(a, b, ctx('p' + i));
    assert.ok(offspring.perks.length <= 3);
    assert.equal(new Set(offspring.perks.map((p) => p.perkId)).size, offspring.perks.length);
  }
});

test('10. no mushroom can have more than one Mutation', () => {
  setConfig({ mutations: { spontaneousMutationChance: 1, mutationInheritChanceSingle: 1 } });
  const a = mk('a', {}, { mutation: { mutationId: 'verdant_glow', bonuses: { CUL: 18 }, origin: 'spontaneous' } });
  const b = mk('b');
  for (let i = 0; i < 300; i++) {
    const { offspring } = resolveBreeding(a, b, ctx('m' + i));
    assert.ok(offspring.mutation === null || typeof offspring.mutation.mutationId === 'string');
    assert.ok(!Array.isArray(offspring.mutation));
  }
});

test('11. two mutated parents cannot produce a child with two Mutations', () => {
  setConfig({ mutations: { mutationInheritChanceBoth: 1, spontaneousMutationChance: 1 } });
  const a = mk('a', {}, { mutation: { mutationId: 'verdant_glow', bonuses: { CUL: 18 }, origin: 'spontaneous' } });
  const b = mk('b', {}, { mutation: { mutationId: 'deep_spore_bloom', bonuses: { MYC: 18 }, origin: 'spontaneous' } });
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const { offspring, log } = resolveBreeding(a, b, ctx('mm' + i));
    assert.ok(offspring.mutation);
    assert.ok(['verdant_glow', 'deep_spore_bloom'].includes(offspring.mutation.mutationId));
    assert.equal(log.spontaneousRolled, false);
    seen.add(offspring.mutation.mutationId);
  }
  assert.equal(seen.size, 2);
});

test('12. duplicate Perks follow their configured upgrade rules', () => {
  setConfig({ perks: { perkInheritChanceShared: 1, newPerkChance: 0 } });
  // standard, equal levels: guaranteed +1 (3% -> 5%)
  const rw = (lv) => [{ perkId: 'rain_worker', level: lv }];
  for (let i = 0; i < 100; i++) {
    const { offspring } = resolveBreeding(mk('a', {}, { perks: rw(1) }), mk('b', {}, { perks: rw(1) }), ctx('u' + i));
    assert.equal(offspring.perks[0].level, 2);
  }
  // standard, unequal: max, or max+1 at the configured chance; never above max level
  let up = 0;
  for (let i = 0; i < 400; i++) {
    const { offspring } = resolveBreeding(mk('a', {}, { perks: rw(2) }), mk('b', {}, { perks: rw(4) }), ctx('v' + i));
    const lv = offspring.perks[0].level;
    assert.ok(lv === 4 || lv === 5);
    if (lv === 5) up++;
  }
  assert.ok(up > 60 && up < 140, `unequal upgrade rate ${up}/400`);
  for (let i = 0; i < 50; i++) {
    const { offspring } = resolveBreeding(mk('a', {}, { perks: rw(5) }), mk('b', {}, { perks: rw(5) }), ctx('w' + i));
    assert.equal(offspring.perks[0].level, 5);
  }
  // slow rule, equal: +1 only at the configured chance
  const tn = (lv) => [{ perkId: 'treasure_nose', level: lv }];
  let slowUp = 0;
  for (let i = 0; i < 400; i++) {
    const { offspring } = resolveBreeding(mk('a', {}, { perks: tn(1) }), mk('b', {}, { perks: tn(1) }), ctx('x' + i));
    if (offspring.perks[0].level === 2) slowUp++;
    else assert.equal(offspring.perks[0].level, 1);
  }
  assert.ok(slowUp > 120 && slowUp < 200, `slow upgrade rate ${slowUp}/400`);
});

test('13. spontaneous Mutation rolls only happen when no parental Mutation was inherited', () => {
  setConfig({ mutations: { mutationInheritChanceSingle: 0.5 } });
  const a = mk('a', {}, { mutation: { mutationId: 'verdant_glow', bonuses: { CUL: 18 }, origin: 'spontaneous' } });
  const b = mk('b');
  let inherited = 0;
  let rolled = 0;
  for (let i = 0; i < 400; i++) {
    const { log } = resolveBreeding(a, b, ctx('s' + i));
    if (log.mutationSource === 'inherited') { inherited++; assert.equal(log.spontaneousRolled, false); } else { rolled++; assert.equal(log.spontaneousRolled, true); }
  }
  assert.ok(inherited > 0 && rolled > 0);
  // locked system: never rolls
  const { log } = resolveBreeding(mk('c'), mk('d'), ctx('locked', { unlocks: { traits: true, perks: true, mutations: false } }));
  assert.equal(log.spontaneousRolled, false);
});

test('14. refreshing during incubation cannot change the offspring', () => {
  const s = G.newGame({ now: NOW, seed: 'refresh', tzOffset: 0 });
  const [a, b] = s.mushrooms;
  const r = G.startBreeding(s, a.uid, b.uid, NOW);
  assert.ok(r.ok);
  const sealed = JSON.stringify(r.record.offspring);
  // save, reload, change clock backward, change config version, then claim
  const reloaded = parseSave(serialize(s));
  G.advance(reloaded, NOW - 3600e3);
  setConfig({ configVersion: 99, traits: { newAdvancedTraitChance: 1 }, inheritance: { attributeVariationChance: 1 } });
  const claim = G.claimBreeding(reloaded, r.record.id, NOW + 3600e3);
  assert.ok(claim.ok);
  const claimed = { ...claim.mushroom, createdAt: r.record.offspring.createdAt, status: r.record.offspring.status };
  assert.equal(JSON.stringify(claimed), sealed);
  // claiming twice is impossible
  assert.equal(G.claimBreeding(reloaded, r.record.id, NOW + 7200e3).ok, false);
  // restoring an older save and breeding the same pair yields the same offspring
  resetConfig();
  const again = parseSave(serialize(G.newGame({ now: NOW, seed: 'refresh', tzOffset: 0 })));
  const r2 = G.startBreeding(again, a.uid, b.uid, NOW + 5);
  assert.deepEqual(r2.record.offspring.genes, r.record.offspring.genes);
});

test('15. invalid imported mushrooms cannot grant illegal bonuses', () => {
  const A = G.newGame({ now: NOW, seed: 'A', forestName: 'Alder', tzOffset: 0 });
  const B = G.newGame({ now: NOW, seed: 'B', forestName: 'Birch', tzOffset: 0 });
  const encode = (rec) => {
    const json = JSON.stringify(rec);
    return 'MF1-' + Buffer.from(json).toString('base64url') + '.' + hash(json).toString(36);
  };
  const base = shareRecord(A, A.mushrooms[0], NOW);
  const bad = [
    { ...base, tr: Array.from({ length: 9 }, (_, i) => ['t' + i, 'MAG', 4, null, null, null, null]), g: 50 },
    { ...base, tr: [['t1', 'MAG', 40, null, null, null, null]], g: 3 },
    { ...base, tr: [['t1', 'POWER', 4, null, null, null, null]], g: 3 },
    { ...base, pk: [['rain_worker', 9, null, null, null]], g: 20 },
    { ...base, pk: [['rain_worker', 1, null, null, null], ['night_shift', 1, null, null, null], ['green_thumb', 1, null, null, null], ['team_player', 1, null, null, null]], g: 20 },
    { ...base, pk: [['godmode', 1, null, null, null]], g: 5 },
    { ...base, mu: ['starfall_aura', 'spontaneous', null, null, null], g: 1 },
    { ...base, mu: ['unknown_mut', 'spontaneous', null, null, null], g: 4 },
    { ...base, tr: [['t1', 'MAG', 4, null, null, null, null], ['t2', 'MAG', 4, null, null, null, null]], g: 2 },
    { ...base, ge: { ...base.ge, c: 'megacap' } },
    { ...base, ge: { ...base.ge, col: [300, 0, 0] } },
    { ...base, ge: { ...base.ge, al: { red: { t: 'focus', o: ['MAG', 'MAG', 'MAG'] }, green: base.ge.al.green, blue: base.ge.al.blue } } },
    { ...base, n: '<script>alert(1)</script>xxxxxxxxxxxxxxxxx' },
    { ...base, v: 7 },
  ];
  const beforeInv = JSON.stringify(B.inventory);
  const beforeGlimmer = B.glimmer;
  for (const rec of bad) {
    const res = importGuest(B, encode(rec), NOW);
    assert.equal(res.ok, false, JSON.stringify(rec).slice(0, 120));
  }
  // modified genetics with a reused share id is rejected
  assert.equal(importGuest(B, encode({ ...base, ge: { ...base.ge, c: base.ge.c === 'roundcap' ? 'flatcap' : 'roundcap' } }), NOW).ok, false);
  // garbage
  for (const junk of ['', 'hello', 'MF1-!!!!', 'MF1-abc.def', '{"code":5}', 'MF1-' + 'A'.repeat(9000)]) assert.equal(importGuest(B, junk, NOW).ok, false);
  assert.equal(B.guests.length, 0);
  // injected stats/resources in an otherwise valid record are ignored
  const sneaky = { ...base, stats: { MAG: 100 }, inventory: { glimmer: 99999 }, glimmer: 5000 };
  const ok = importGuest(B, encode(sneaky), NOW);
  assert.ok(ok.ok);
  assert.equal(JSON.stringify(B.inventory), beforeInv);
  assert.equal(B.glimmer, beforeGlimmer);
  assert.deepEqual(computeStats(ok.guest), computeStats(A.mushrooms[0]));
  // a real export round-trips
  const C = G.newGame({ now: NOW, seed: 'C', tzOffset: 0 });
  assert.ok(previewImport(C, exportMushroom(A, A.mushrooms[1].uid, NOW).code, NOW).ok);
});

test('16. jobs remain locked until discovery and construction conditions are met', () => {
  const s = G.newGame({ now: NOW, seed: 'jobs', tzOffset: 0 });
  const m = s.mushrooms[0];
  assert.ok(G.jobUnlocked(s, 'gardener'));
  assert.ok(G.jobUnlocked(s, 'forager'));
  for (const j of ['mycologist', 'woodworker', 'builder', 'dew_collector', 'excavator', 'enchanter', 'gift_maker']) {
    assert.equal(G.jobUnlocked(s, j), false, j);
    assert.equal(G.assignJob(s, m.uid, j, NOW).ok, false);
  }
  // discovery alone is not enough
  s.counters.jobCycles.forager = 15;
  G.advance(s, NOW + 1);
  assert.ok(G.stageDiscovered(s, 'fungal'));
  assert.equal(G.jobUnlocked(s, 'mycologist'), false);
  // construction (restoration) completes the unlock
  const bed = s.world.areas.fungal.objects[0];
  s.inventory.twigs = 50; s.inventory.leaves = 50;
  assert.ok(G.restoreStructure(s, bed.id, NOW + 2).ok);
  assert.ok(G.jobUnlocked(s, 'mycologist'));
  assert.ok(G.assignJob(s, m.uid, 'mycologist', NOW + 3).ok);
  // the next stage stays hidden until its own trigger, in strict order
  assert.equal(G.stageDiscovered(s, 'workshop'), false);
  s.counters.jobCycles.night_watcher = 999; // a later stage's trigger does not skip ahead
  G.advance(s, NOW + 4);
  assert.equal(G.stageDiscovered(s, 'landmark'), false);
});
