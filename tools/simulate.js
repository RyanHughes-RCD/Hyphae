#!/usr/bin/env node
// Headless balance simulation (GDD 22.2). Reuses the real breeding resolver and
// configuration. Usage: node tools/simulate.js [generations=20] [runs=60]
import { getConfig, setConfig, STATS } from '../src/config.js';
import { generateStarters, resolveBreeding } from '../src/core/genetics.js';
import { computeStats, rarityTier } from '../src/core/stats.js';
import { makeRng, hashHex } from '../src/core/rng.js';

// Optional overrides: --set traits.newAdvancedTraitChance=0.3
const args = process.argv.slice(2);
const overrides = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set') {
    const [path, val] = args[++i].split('=');
    const keys = path.split('.');
    let o = overrides;
    keys.slice(0, -1).forEach((k) => { o = o[k] = o[k] || {}; });
    o[keys[keys.length - 1]] = Number(val);
  }
}
if (Object.keys(overrides).length) setConfig(overrides);
const positional = args.filter((a, i) => a !== '--set' && args[i - 1] !== '--set');
const GENS = Number(positional[0] || 20);
const RUNS = Number(positional[1] || 60);
const BROOD = 6; // breedings per generation
const UNLOCKS = { traits: true, perks: true, mutations: true };

const ctx = (seed) => ({ seed, unlocks: UNLOCKS, rareVariation: true, firstBreed: false, guaranteeTrait: false, breedingId: 'sim', forest: { id: 'f_sim', name: 'Sim' }, now: 0 });
const bestStat = (m) => Math.max(...STATS.map((s) => computeStats(m).final[s]));
const target = (m, stat) => computeStats(m).final[stat];

function strongDonor(seed) {
  const [d] = generateStarters('donor' + seed);
  d.generation = 9;
  d.status = 'guest';
  d.traits = Array.from({ length: 6 }, (_, i) => ({ traitUid: 'td' + seed + i, stat: 'MAG', bonus: 4 }));
  d.perks = [{ perkId: 'night_shift', level: 3 }, { perkId: 'moon_listener', level: 3 }, { perkId: 'rain_worker', level: 2 }];
  d.mutation = { mutationId: 'starfall_aura', bonuses: { MAG: 18 }, origin: 'spontaneous' };
  return d;
}

function runStrategy(name, run) {
  const rng = makeRng('sim' + name + run);
  let pop = generateStarters('simstart' + run);
  const goal = 'CON';
  const donor = name === 'donor' ? strongDonor(run) : null;
  const rows = [];
  let firstMutationGen = null;
  for (let g = 1; g <= GENS; g++) {
    const kids = [];
    for (let i = 0; i < BROOD; i++) {
      let a;
      let b;
      if (name === 'random') { a = rng.pick(pop); b = rng.pick(pop.filter((x) => x !== a)); } else {
        const sorted = pop.slice().sort((x, y) => target(y, goal) - target(x, goal) || y.traits.length - x.traits.length);
        a = sorted[0];
        b = donor && i % 2 === 0 ? donor : sorted[1 + (i % Math.min(2, sorted.length - 1))] || sorted[1];
      }
      const { offspring } = resolveBreeding(a, b, ctx('s' + hashHex(name, run, g, i)));
      kids.push(offspring);
      if (offspring.mutation && firstMutationGen === null) firstMutationGen = g;
    }
    pop = name === 'random' ? kids.concat(rng.shuffle(pop).slice(0, 4)) : kids.concat(pop).sort((x, y) => target(y, goal) - target(x, goal)).slice(0, 4);
    rows.push({
      gen: Math.max(...kids.map((k) => k.generation)),
      best: Math.max(...kids.map(bestStat)),
      goal: Math.max(...kids.map((k) => target(k, goal))),
      traits: kids.reduce((s, k) => s + k.traits.length, 0) / kids.length,
      perks: kids.reduce((s, k) => s + k.perks.length, 0) / kids.length,
      perkLv: Math.max(0, ...kids.flatMap((k) => k.perks.map((p) => p.level))),
      mut: kids.filter((k) => k.mutation).length / kids.length,
      legendary: kids.filter((k) => rarityTier(k).id === 'legendary').length,
      hundred: kids.filter((k) => bestStat(k) >= 100).length,
    });
  }
  return { rows, firstMutationGen };
}

const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const f = (x, d = 1) => x.toFixed(d).padStart(6);

console.log(`Mushroom Forest balance simulation — config v${getConfig().configVersion}, ${RUNS} runs × ${GENS} rounds × ${BROOD} breedings\n`);
const starterMax = [];
for (let i = 0; i < 2000; i++) for (const m of generateStarters('chk' + i)) starterMax.push(bestStat(m));
console.log(`Starters: best single stat avg ${avg(starterMax).toFixed(1)}, max ${Math.max(...starterMax)} (target < 30)\n`);

for (const strat of ['random', 'line', 'donor']) {
  const results = Array.from({ length: RUNS }, (_, r) => runStrategy(strat, r));
  console.log(`== Strategy: ${strat}${strat === 'line' ? ' (select for Construction)' : strat === 'donor' ? ' (line + strong Magic Guest donor)' : ''}`);
  console.log(' round   gen  bestStat  goalCON  traits  perks  maxPerkLv  mutated%  legendary  stat100');
  for (let g = 0; g < GENS; g++) {
    const rs = results.map((r) => r.rows[g]);
    if (g < 5 || (g + 1) % 5 === 0) {
      console.log(`${String(g + 1).padStart(6)}${f(avg(rs.map((r) => r.gen)))}${f(avg(rs.map((r) => r.best)), 1).padStart(10)}${f(avg(rs.map((r) => r.goal))).padStart(9)}${f(avg(rs.map((r) => r.traits)), 2).padStart(8)}${f(avg(rs.map((r) => r.perks)), 2).padStart(7)}${f(avg(rs.map((r) => r.perkLv))).padStart(11)}${f(avg(rs.map((r) => r.mut)) * 100).padStart(10)}${f(avg(rs.map((r) => r.legendary)), 2).padStart(11)}${f(avg(rs.map((r) => r.hundred)), 2).padStart(9)}`);
    }
  }
  const fm = results.map((r) => r.firstMutationGen).filter((x) => x !== null);
  console.log(`  first Mutation appeared in ${fm.length}/${RUNS} runs; median round ${fm.length ? fm.sort((a, b) => a - b)[Math.floor(fm.length / 2)] : '—'}\n`);
}
