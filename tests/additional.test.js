// Additional recommended tests (GDD 22.3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetConfig, setConfig, getConfig, STATS } from '../src/config.js';
import { ATTRIBUTES, CATEGORIES } from '../src/content/attributes.js';
import { baseStats, statSum, colorGroupPoints, computeStats } from '../src/core/stats.js';
import { generateStarters, resolveBreeding, newMushroom } from '../src/core/genetics.js';
import { phaseAt, conditionsAt, weatherForDate } from '../src/core/time.js';
import * as G from '../src/core/game.js';
import { exportMushroom, importGuest } from '../src/core/share.js';
import { serialize, parseSave } from '../src/core/save.js';

const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);
const HOUR = 3600000;
test.beforeEach(() => resetConfig());

function mk(uid, over = {}, extra = {}) {
  const genes = {
    cap: 'roundcap', stem: 'sturdy', markings: 'spots', gills: 'pored', glow: 'none', color: [200, 100, 50],
    alloc: { red: { t: 'lean', o: ['CUL', 'MYC', 'FOR'] }, green: { t: 'focus', o: ['CON', 'MAG', 'ANI'] }, blue: { t: 'even', o: ['DIS', 'SOC'] } },
    accent: [240, 230, 210], stemColor: [230, 220, 200], pattern: 1, ...over,
  };
  return newMushroom({ uid, name: uid, generation: 2, genes, temperament: 'gentle', ...extra });
}
const ctx = (seed, over = {}) => ({ seed, unlocks: { traits: true, perks: true, mutations: true }, rareVariation: false, firstBreed: false, guaranteeTrait: false, breedingId: 'b', forest: { id: 'f', name: 'F' }, now: NOW, ...over });

test('attribute rows sum to their category budget (+2 for Rare)', () => {
  const cfg = getConfig().stats;
  for (const a of ATTRIBUTES) {
    const sum = Object.values(a.stats).reduce((x, y) => x + y, 0);
    assert.equal(sum, cfg.categoryBudgets[a.category] + (a.tier === 'rare' ? cfg.rareTierBudgetBonus : 0), a.id);
  }
});

test('base total is 66 without Rare attributes and +2 per Rare attribute', () => {
  for (const m of generateStarters('x')) assert.equal(statSum(baseStats(m.genes)), 66);
  const rare = mk('r', { cap: 'spirecap', stem: 'crystal' });
  assert.equal(statSum(baseStats(rare.genes)), 70);
});

test('largest-remainder rounding: Amber is 7/5/0', () => {
  assert.deepEqual(colorGroupPoints([255, 170, 0]), [7, 5, 0]);
  assert.deepEqual(colorGroupPoints([255, 0, 0]), [12, 0, 0]);
});

test('colour allocation survives save and share round trips', () => {
  const s = G.newGame({ now: NOW, seed: 'alloc', tzOffset: 0 });
  const before = s.mushrooms.map((m) => computeStats(m).final);
  const re = parseSave(serialize(s));
  assert.deepEqual(re.mushrooms.map((m) => computeStats(m).final), before);
  const other = G.newGame({ now: NOW, seed: 'other', tzOffset: 0 });
  const imp = importGuest(other, exportMushroom(s, s.mushrooms[0].uid, NOW).code, NOW);
  assert.ok(imp.ok);
  assert.deepEqual(computeStats(imp.guest).final, before[0]);
  assert.notEqual(imp.guest.uid, s.mushrooms[0].uid);
});

test('starter constraints hold across many seeds', () => {
  for (let i = 0; i < 1000; i++) {
    const ms = generateStarters('c' + i);
    const caps = new Set(ms.map((m) => m.genes.cap));
    assert.equal(caps.size, 3);
    assert.equal(new Set(ms.map((m) => m.temperament)).size, 3);
  }
});

test('locked systems roll nothing; donor genes arrive dormant and activate on unlock', () => {
  setConfig({ traits: { traitInheritChanceSingle: 1 }, perks: { perkInheritChanceSingle: 1 } });
  const donor = mk('d', {}, { traits: [{ traitUid: 'tA', stat: 'MAG', bonus: 4 }], perks: [{ perkId: 'rain_worker', level: 2 }], status: 'guest' });
  const { offspring, log } = resolveBreeding(mk('a'), donor, ctx('lock', { unlocks: { traits: false, perks: false, mutations: false }, force: { trait: true, perk: true, mutation: true } }));
  assert.equal(log.newTrait, null);
  assert.equal(log.newPerk, null);
  assert.equal(log.spontaneousRolled, false);
  assert.equal(offspring.traits.length, 1);
  const s = G.newGame({ now: NOW, seed: 'dorm', tzOffset: 0 });
  s.mushrooms.push(offspring);
  const dormant = G.statsOf(s, offspring).final.MAG;
  s.unlocks.traits = true;
  assert.equal(G.statsOf(s, offspring).final.MAG, dormant + 4);
});

test('at most one new Advanced Trait per breeding, and the cap of 8 holds', () => {
  setConfig({ traits: { newAdvancedTraitChance: 1, traitInheritChanceSingle: 1, traitInheritChanceShared: 1 } });
  const t = (p, n) => Array.from({ length: n }, (_, i) => ({ traitUid: p + i, stat: STATS[i % 8], bonus: 4 }));
  for (let i = 0; i < 100; i++) {
    const { offspring } = resolveBreeding(mk('a', {}, { traits: t('a', 5) }), mk('b', {}, { traits: t('b', 5) }), ctx('c' + i));
    assert.ok(offspring.traits.length <= 8);
  }
  const { offspring } = resolveBreeding(mk('a'), mk('b'), ctx('one'));
  assert.equal(offspring.traits.length, 1);
});

test('breeding never modifies either parent', () => {
  const a = mk('a', {}, { perks: [{ perkId: 'rain_worker', level: 1 }] });
  const b = mk('b', {}, { perks: [{ perkId: 'rain_worker', level: 1 }] });
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  for (let i = 0; i < 50; i++) resolveBreeding(a, b, ctx('p' + i));
  assert.equal(JSON.stringify(a), ja);
  assert.equal(JSON.stringify(b), jb);
});

test('day phases follow local time; weather is stable per local date', () => {
  const at = (h, tz = 0) => Date.UTC(2026, 10, 8, h, 30) + tz * 60000;
  assert.equal(phaseAt(at(6), 0), 'dawn');
  assert.equal(phaseAt(at(12), 0), 'day');
  assert.equal(phaseAt(at(19), 0), 'dusk');
  assert.equal(phaseAt(at(23), 0), 'night');
  assert.equal(phaseAt(at(2), 0), 'night');
  // UTC 12:30 is 07:30 in UTC-5 (offset +300)
  assert.equal(phaseAt(Date.UTC(2026, 10, 8, 12, 30), 300), 'dawn');
  assert.deepEqual(weatherForDate('w1', '2026-11-08'), weatherForDate('w1', '2026-11-08'));
  let rainy = 0;
  for (let d = 1; d <= 200; d++) if (weatherForDate('w2', `2027-01-${d}`).kind === 'rain') rainy++;
  assert.ok(rainy > 10 && rainy < 60, `rain days ${rainy}/200`);
  assert.equal(conditionsAt(at(12), 'w', 0, { phase: 'night', weather: 'rain' }).raining, true);
});

test('first breeding is free, then Glimmer is required and deducted exactly', () => {
  const s = G.newGame({ now: NOW, seed: 'cost', tzOffset: 0 });
  const [a, b, c] = s.mushrooms;
  assert.equal(G.breedingCost(s), 0);
  const first = G.startBreeding(s, a.uid, b.uid, NOW);
  assert.ok(first.ok);
  assert.ok(G.claimBreeding(s, first.record.id, first.record.completesAt).ok);
  s.mushrooms.forEach((m) => { m.restUntil = 0; });
  s.station = 'spore_cradle';
  const cost = G.breedingCost(s);
  assert.equal(cost, getConfig().breeding.breedingCostGlimmer);
  s.glimmer = cost - 1;
  assert.equal(G.startBreeding(s, a.uid, c.uid, NOW + 1).ok, false);
  s.glimmer = cost + 3;
  assert.ok(G.startBreeding(s, a.uid, c.uid, NOW + 2).ok);
  assert.equal(s.glimmer, 3);
});

test('offline: no double grants, backward clock grants nothing, cap at 8 hours', () => {
  const s = G.newGame({ now: NOW, seed: 'off', tzOffset: 0 });
  G.assignJob(s, s.mushrooms[0].uid, 'forager', NOW);
  const r1 = G.advance(s, NOW + 2 * HOUR);
  const inv = JSON.stringify(s.inventory);
  const r2 = G.advance(s, NOW + 2 * HOUR);
  assert.equal(r2.cycles, 0);
  assert.equal(JSON.stringify(s.inventory), inv);
  const back = G.advance(s, NOW + HOUR);
  assert.equal(back.cycles, 0);
  assert.equal(JSON.stringify(s.inventory), inv);
  assert.ok(r1.cycles > 0);
  // 30 hours away is clamped to 8 hours of work
  const t = G.newGame({ now: NOW, seed: 'off', tzOffset: 0 });
  G.assignJob(t, t.mushrooms[0].uid, 'forager', NOW);
  const r8 = G.advance(t, NOW + 30 * HOUR);
  const u = G.newGame({ now: NOW, seed: 'off', tzOffset: 0 });
  G.assignJob(u, u.mushrooms[0].uid, 'forager', NOW);
  const rExact = G.advance(u, NOW + 8 * HOUR);
  assert.equal(r8.cycles, rExact.cycles);
  assert.ok(r8.clamped);
  // after the clamp, play continues from now
  const after = G.advance(t, NOW + 30 * HOUR + 10 * 60000);
  assert.ok(after.cycles > 0 && after.cycles < 30);
});

test('productivity bonus never exceeds the cap', () => {
  const s = G.newGame({ now: NOW, seed: 'cap', tzOffset: 0 });
  s.unlocks.perks = true;
  s.unlocks.mutations = true;
  const m = s.mushrooms[0];
  m.temperament = 'social';
  m.perks = [{ perkId: 'rain_worker', level: 5 }, { perkId: 'night_shift', level: 5 }, { perkId: 'green_thumb', level: 4 }];
  m.mutation = { mutationId: 'verdant_glow', bonuses: { CUL: 18 } };
  m.work = { assignedAt: 0 };
  const job = { id: 'gardener', family: 'cultivation' };
  const b = G.productivityBonus(s, m, job, { raining: true, phase: 'night', teammates: 2, totalWorkers: 5, synergy: { gardener: 0.15 }, now: NOW });
  assert.ok(b.raw > getConfig().jobs.productivityBonusCap);
  assert.equal(b.sum, getConfig().jobs.productivityBonusCap);
});

test('guests cannot work and at least one parent must be owned', () => {
  const A = G.newGame({ now: NOW, seed: 'gA', tzOffset: 0 });
  const B = G.newGame({ now: NOW, seed: 'gB', tzOffset: 0 });
  const g1 = importGuest(B, exportMushroom(A, A.mushrooms[0].uid, NOW).code, NOW).guest;
  const g2 = importGuest(B, exportMushroom(A, A.mushrooms[1].uid, NOW).code, NOW).guest;
  assert.equal(G.assignJob(B, g1.uid, 'gardener', NOW).ok, false);
  assert.equal(G.startBreeding(B, g1.uid, g2.uid, NOW).ok, false);
  const r = G.startBreeding(B, B.mushrooms[0].uid, g1.uid, NOW);
  assert.ok(r.ok);
  assert.equal(r.record.offspring.lineage.parents[1].guest, true);
  assert.equal(r.record.offspring.lineage.parents[1].forestName, A.forest.name);
  // guests cannot be re-shared
  assert.equal(exportMushroom(B, g1.uid, NOW).ok, false);
});

test('invalid saves are rejected without replacing anything', () => {
  assert.throws(() => parseSave('not json'));
  assert.throws(() => parseSave(JSON.stringify({ schemaVersion: 1 })));
  const s = G.newGame({ now: NOW, seed: 'sv', tzOffset: 0 });
  const bad = JSON.parse(serialize(s));
  bad.mushrooms[0].genes.cap = 'hackcap';
  assert.throws(() => parseSave(JSON.stringify(bad)));
  const neg = JSON.parse(serialize(s));
  neg.glimmer = -5;
  assert.throws(() => parseSave(JSON.stringify(neg)));
  const future = JSON.parse(serialize(s));
  future.schemaVersion = 99;
  assert.throws(() => parseSave(JSON.stringify(future)), /newer version/);
});

test('every category has Basic attributes for starters', () => {
  for (const cat of CATEGORIES) assert.ok(ATTRIBUTES.some((a) => a.category === cat && a.tier === 'basic'));
});
