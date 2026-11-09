// Starters, wild visitors and the breeding resolver (GDD Sections 6.7, 9).
import { getConfig, STATS, COLOR_GROUPS } from '../config.js';
import {
  ATTRIBUTE_BY_ID, CATEGORIES, attributesIn, ALLOC_TEMPLATE_IDS, STARTER_PALETTE,
  SECONDARY_PALETTE, STEM_PALETTE, TEMPERAMENTS, NAME_PARTS,
} from '../content/attributes.js';
import { PERKS, PERK_BY_ID, MUTATIONS, MUTATION_BY_ID } from '../content/genetics.js';
import { makeRng, subRng, hashHex } from './rng.js';
import { baseStats, computeStats, topStats, dominantGroup } from './stats.js';
import { clamp255, rgbToHsv, hsvToRgb } from './color.js';

// ---------- helpers ----------

export function makeName(rng) {
  return rng.pick(NAME_PARTS.start) + rng.pick(NAME_PARTS.end);
}

function randomAlloc(rng) {
  const alloc = {};
  for (const [group, stats] of Object.entries(COLOR_GROUPS)) {
    alloc[group] = { t: rng.pick(ALLOC_TEMPLATE_IDS), o: rng.shuffle(stats) };
  }
  return alloc;
}

const jitter = (rgb, rng, j) => rgb.map((c) => clamp255(c + rng.int(-j, j)));

function randomGenes(rng, tiers, color) {
  const g = {};
  for (const cat of CATEGORIES) g[cat] = rng.pick(attributesIn(cat, tiers)).id;
  g.color = color;
  // the second colour gene: hidden unless it happens to resemble the shown one
  g.colorAlleles = [color.slice(), jitter(rng.pick(STARTER_PALETTE).rgb, rng, 20)];
  g.alloc = randomAlloc(rng);
  g.accent = jitter(rng.pick(SECONDARY_PALETTE).rgb, rng, 14);
  g.stemColor = jitter(rng.pick(STEM_PALETTE).rgb, rng, 8);
  g.pattern = rng.int(0, 99999);
  return g;
}

export function newMushroom(fields) {
  return {
    uid: fields.uid,
    name: fields.name,
    createdAt: fields.createdAt ?? 0,
    generation: fields.generation ?? 1,
    status: fields.status ?? 'resident',
    parents: fields.parents ?? null,
    lineage: fields.lineage ?? null,
    genes: fields.genes,
    temperament: fields.temperament,
    traits: fields.traits ?? [],
    perks: fields.perks ?? [],
    mutation: fields.mutation ?? null,
    origin: fields.origin ?? { kind: 'starter' },
    work: null,
    restUntil: 0,
  };
}

/** Resolve Mutation bonuses for a specific carrier (GDD 8.3). */
export function resolveMutationBonuses(mutationId, genes) {
  const def = MUTATION_BY_ID[mutationId];
  if (def.bonus) return { ...def.bonus };
  const rule = def.bonusRule;
  const base = baseStats(genes);
  const lowest = STATS.slice().sort((a, b) => base[a] - base[b] || STATS.indexOf(a) - STATS.indexOf(b)).slice(0, rule.count);
  return Object.fromEntries(lowest.map((s) => [s, rule.amount]));
}

// ---------- starters (GDD 6.7) ----------

function starterOk(ms, cfg) {
  const finals = ms.map((m) => computeStats(m).final);
  if (finals.some((f) => STATS.some((s) => f[s] > cfg.starters.starterMaxStat))) return false;
  const tops = finals.map((f) => topStats(f, 2));
  const cul = tops.map((t, i) => (t.includes('CUL') ? i : -1)).filter((i) => i >= 0);
  const forr = tops.map((t, i) => (t.includes('FOR') ? i : -1)).filter((i) => i >= 0);
  const pairOk = cul.some((a) => forr.some((b) => a !== b));
  if (!pairOk) return false;
  const union = new Set(tops.flat());
  if (union.size < 5) return false;
  const groups = new Set(ms.map((m) => dominantGroup(m.genes.color)));
  if (groups.size !== 3) return false;
  return true;
}

export function generateStarters(seed, forest = {}, now = 0) {
  const cfg = getConfig();
  const byGroup = { red: [], green: [], blue: [] };
  for (const p of STARTER_PALETTE) byGroup[dominantGroup(p.rgb)].push(p);
  const caps = attributesIn('cap', ['basic']);
  for (let attempt = 0; attempt < cfg.starters.starterMaxAttempts; attempt++) {
    const rng = subRng(seed, 'starters:' + attempt);
    const groups = rng.shuffle(['red', 'green', 'blue']);
    const capPick = rng.shuffle(caps).slice(0, 3);
    const temps = rng.shuffle(TEMPERAMENTS).slice(0, 3);
    const ms = groups.map((group, i) => {
      const pal = rng.pick(byGroup[group]);
      const genes = randomGenes(rng, ['basic'], jitter(pal.rgb, rng, cfg.starters.starterColorJitter));
      genes.cap = capPick[i].id;
      genes.colorAlleles[0] = genes.color.slice();
      return newMushroom({
        uid: 'm_' + hashHex(seed, 'starter', attempt, i),
        name: makeName(rng),
        createdAt: now,
        generation: 1,
        genes,
        temperament: temps[i].id,
        origin: { kind: 'starter', forestId: forest.id, forestName: forest.name },
      });
    });
    if (starterOk(ms, cfg)) return ms;
  }
  return curatedStarters(seed, forest, now);
}

export function curatedStarters(seed, forest = {}, now = 0) {
  const mk = (i, name, genes, temperament) => newMushroom({
    // curated starters: each carries a hidden colour from another part of the wheel
    uid: 'm_' + hashHex(seed, 'curated', i), name, createdAt: now, generation: 1,
    genes: { ...genes, colorAlleles: [genes.color.slice(), [[84, 104, 176], [178, 54, 40], [104, 150, 62]][i]] }, temperament,
    origin: { kind: 'starter', forestId: forest.id, forestName: forest.name },
  });
  const base = { pattern: 7 };
  return [
    mk(0, 'Bramble', { ...base, accent: [238, 196, 72], stemColor: [206, 184, 150], cap: 'bellcap', stem: 'rooted', markings: 'plain', gills: 'fine', glow: 'none', color: [178, 54, 40],
      alloc: { red: { t: 'lean', o: ['CUL', 'MYC', 'FOR'] }, green: { t: 'even', o: ['ANI', 'CON', 'MAG'] }, blue: { t: 'even', o: ['DIS', 'SOC'] } } }, 'gentle'),
    mk(1, 'Pipkin', { ...base, accent: [250, 236, 120], stemColor: [178, 178, 142], cap: 'flatcap', stem: 'slender', markings: 'stripes', gills: 'pored', glow: 'none', color: [104, 150, 62],
      alloc: { red: { t: 'focus', o: ['FOR', 'CUL', 'MYC'] }, green: { t: 'lean', o: ['CON', 'ANI', 'MAG'] }, blue: { t: 'even', o: ['DIS', 'SOC'] } } }, 'industrious'),
    mk(2, 'Wisplet', { ...base, accent: [112, 192, 240], stemColor: [152, 148, 154], cap: 'conecap', stem: 'bulbous', markings: 'speckles', gills: 'deep', glow: 'faint', color: [84, 104, 176],
      alloc: { red: { t: 'focus', o: ['MYC', 'CUL', 'FOR'] }, green: { t: 'focus', o: ['MAG', 'CON', 'ANI'] }, blue: { t: 'lean', o: ['SOC', 'DIS'] } } }, 'curious'),
  ];
}

// ---------- wild visitors (GDD 5.6) ----------

const HABITAT_ATTRS = {
  flowers: ['frillcap', 'patches', 'tiltcap', 'warty'], shade: ['twisted', 'pulse', 'shaggy', 'inky'], stone: ['ridged'], log: ['shelfcap', 'lumpcap'],
  water: ['rings', 'soft', 'tuftcap', 'gloss'], moss: ['ringed'], damp: ['toothed', 'lumpcap', 'beads'], glow: ['soft', 'pulse'],
};

export function generateWildVisitor(seed, habitats, now) {
  const rng = makeRng(seed);
  const genes = randomGenes(rng, ['basic'], jitter(rng.pick(STARTER_PALETTE).rgb, rng, 30));
  genes.colorAlleles[0] = genes.color.slice();
  // one guaranteed Uncommon attribute, preferring present habitats
  const pool = [];
  for (const [h, count] of Object.entries(habitats)) {
    if (count > 0 && HABITAT_ATTRS[h]) for (const id of HABITAT_ATTRS[h]) for (let k = 0; k < Math.min(count, 5); k++) pool.push(id);
  }
  const uncommon = attributesIn('cap', ['uncommon']).concat(...['stem', 'markings', 'gills', 'glow'].map((c) => attributesIn(c, ['uncommon']))).map((a) => a.id);
  const pickId = pool.length && rng.chance(0.75) ? rng.pick(pool) : rng.pick(uncommon);
  genes[ATTRIBUTE_BY_ID[pickId].category] = pickId;
  if (rng.chance(0.25)) {
    const other = rng.pick(uncommon);
    genes[ATTRIBUTE_BY_ID[other].category] = other;
  }
  return newMushroom({
    uid: 'w_' + hashHex(seed, 'wild'), name: makeName(rng), createdAt: now, generation: 1,
    genes, temperament: rng.pick(TEMPERAMENTS).id, status: 'wild', origin: { kind: 'wild' },
  });
}

// ---------- breeding (GDD 9.4) ----------

function snapshot(m) {
  return {
    uid: m.uid, name: m.name, generation: m.generation,
    forestName: m.origin?.forestName ?? null, guest: m.status === 'guest', wild: m.status === 'wild',
    parents: m.lineage?.parents?.map((p) => ({ uid: p.uid, name: p.name, generation: p.generation, forestName: p.forestName ?? null })) ?? null,
  };
}

function inheritAttribute(rng, a, b, cat, ctx, cfg, log) {
  const chosen = rng.chance(cfg.inheritance.attributeParentWeight) ? a.genes[cat] : b.genes[cat];
  let vc = cfg.inheritance.attributeVariationChance;
  if (a.temperament === 'mischievous' || b.temperament === 'mischievous') vc *= cfg.inheritance.mischievousVariationMultiplier;
  const variationOn = !ctx.firstBreed || cfg.inheritance.firstBreedVariationEnabled;
  if (variationOn && rng.chance(vc)) {
    const neigh = ATTRIBUTE_BY_ID[chosen].neighbours.map((id) => ATTRIBUTE_BY_ID[id]);
    const rare = neigh.filter((n) => n.tier === 'rare');
    const normal = neigh.filter((n) => n.tier !== 'rare');
    let pool = normal;
    if (ctx.rareVariation && rare.length && (rng.chance(cfg.inheritance.rareVariationShare) || !normal.length)) pool = rare;
    if (pool.length) {
      const v = rng.pick(pool).id;
      log.variations.push({ category: cat, from: chosen, to: v });
      return v;
    }
  }
  return chosen;
}

function blend(rng, ca, cb, cfg, jitterAmt) {
  const [lo, hi] = cfg.inheritance.colorBlendRange;
  const t = rng.range(lo, hi);
  return ca.map((c, i) => clamp255(c + (cb[i] - c) * t + rng.int(-jitterAmt, jitterAmt)));
}

/**
 * Second colour and stem colour: similar parent colours blend, different ones
 * pass on one or the other. Now and then the colour jumps to another shade
 * from its palette.
 */
function inheritShade(rng, ca, cb, variationOn, jumpChance, palette, j) {
  let out;
  if (rgbDist(ca, cb) < 70) out = blend(rng, ca, cb, getConfig(), 4);
  else out = (rng.chance(0.5) ? ca : cb).map((c) => clamp255(c + rng.int(-4, 4)));
  if (variationOn && rng.chance(jumpChance)) out = jitter(rng.pick(palette).rgb, rng, j);
  return out;
}

export function colorAllelesOf(genes) {
  return genes.colorAlleles || [genes.color, genes.color];
}

const rgbDist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

function hueShift(rgb, deg) {
  const [h, s, v] = rgbToHsv(rgb);
  // greys have no hue to turn, so a shift also adds a little colour
  return hsvToRgb([h + deg, Math.min(1, Math.max(s, 0.25) * 1.05), Math.max(v, 0.3)]);
}

/** Does this mushroom carry a colour gene that its cap does not show? */
export function hiddenColor(genes, cfg = getConfig()) {
  const [p, q] = colorAllelesOf(genes);
  const d = cfg.inheritance.colorAlleleBlendDistance;
  if (rgbDist(p, q) < d) return null;
  const hidden = rgbDist(genes.color, p) > rgbDist(genes.color, q) ? p : q;
  return rgbDist(hidden, genes.color) >= d ? hidden : null;
}

/**
 * Colour genetics: each parent passes on one of its two colour genes (which
 * may sport to a neighbouring shade). Similar genes blend; different ones
 * show one and hide the other. Occasionally the shown colour shifts further,
 * and that shift is inherited.
 */
function inheritColor(rng, a, b, ctx, cfg, log) {
  const ci = cfg.inheritance;
  const variationOn = !ctx.firstBreed || ci.firstBreedVariationEnabled;
  const mischief = a.temperament === 'mischievous' || b.temperament === 'mischievous' ? ci.mischievousVariationMultiplier : 1;
  const pass = (parent) => {
    let gene = rng.pick(colorAllelesOf(parent.genes)).slice();
    if (variationOn && rng.chance(ci.colorSportChance * mischief)) {
      const [lo, hi] = ci.colorSportShift;
      gene = hueShift(gene, (rng.chance(0.5) ? 1 : -1) * rng.range(lo, hi));
      log.variations.push({ category: 'color', from: null, to: 'sport' });
    }
    return gene;
  };
  const alleles = [pass(a), pass(b)];
  let color;
  let shown;
  if (rgbDist(alleles[0], alleles[1]) < ci.colorAlleleBlendDistance) {
    const [lo, hi] = ci.colorBlendRange;
    const t = rng.range(lo, hi);
    color = alleles[0].map((c, i) => clamp255(c + (alleles[1][i] - c) * t + rng.int(-ci.colorExpressJitter, ci.colorExpressJitter)));
    shown = -1;
  } else {
    shown = rng.chance(0.5) ? 0 : 1;
    color = alleles[shown].map((c) => clamp255(c + rng.int(-ci.colorExpressJitter, ci.colorExpressJitter)));
    if (rgbDist(alleles[shown], [a.genes.color, b.genes.color].reduce((x, y) => (rgbDist(alleles[shown], x) < rgbDist(alleles[shown], y) ? x : y))) > ci.colorAlleleBlendDistance) {
      log.variations.push({ category: 'color', from: null, to: 'hidden' });
    }
  }
  if (variationOn && rng.chance(ci.colorVariationChance * mischief)) {
    color = hueShift(color, rng.range(-ci.colorVariationHueShift, ci.colorVariationHueShift));
    // the shift is heritable: it rewrites the gene behind the shown colour
    if (shown === -1) { alleles[0] = color.slice(); } else alleles[shown] = color.slice();
    log.variations.push({ category: 'color', from: null, to: 'hue' });
  }
  const vc = cfg.inheritance.attributeVariationChance * mischief;
  const alloc = {};
  for (const group of Object.keys(COLOR_GROUPS)) {
    const src = rng.chance(0.5) ? a.genes.alloc[group] : b.genes.alloc[group];
    const entry = { t: src.t, o: src.o.slice() };
    if (variationOn && rng.chance(vc)) {
      if (rng.chance(0.5)) entry.t = rng.pick(ALLOC_TEMPLATE_IDS.filter((t) => t !== entry.t));
      else {
        const i = rng.int(0, entry.o.length - 1);
        const j = (i + 1) % entry.o.length;
        [entry.o[i], entry.o[j]] = [entry.o[j], entry.o[i]];
      }
      log.variations.push({ category: 'alloc:' + group, from: null, to: entry.t });
    }
    alloc[group] = entry;
  }
  return {
    color, colorAlleles: alleles, alloc,
    accent: inheritShade(rng, a.genes.accent, b.genes.accent, variationOn, ci.colorSportChance * 2 * mischief, SECONDARY_PALETTE, 10),
    stemColor: inheritShade(rng, a.genes.stemColor, b.genes.stemColor, variationOn, ci.colorSportChance * mischief, STEM_PALETTE, 6),
    pattern: rng.int(0, 99999),
  };
}

function combinePerk(rng, def, la, lb, cfg) {
  const max = def.levels.length;
  let level;
  if (def.rule === 'fixed') level = 1;
  else if (def.rule === 'slow') {
    level = la === lb ? (rng.chance(cfg.perks.slowEqualUpgradeChance) ? la + 1 : la) : Math.max(la, lb);
  } else {
    level = la === lb ? la + 1 : Math.max(la, lb) + (rng.chance(cfg.perks.standardUnequalUpgradeChance) ? 1 : 0);
  }
  return Math.min(max, level);
}

/**
 * Resolve an offspring. Pure and deterministic for (a, b, ctx).
 * ctx: { seed, unlocks:{traits,perks,mutations}, rareVariation, firstBreed,
 *        guaranteeTrait, breedingId, forest:{id,name}, now, mutationWeightMods, force }
 * Returns { offspring, log }.
 */
export function resolveBreeding(a, b, ctx) {
  const cfg = getConfig();
  const seed = ctx.seed;
  const force = ctx.force || {};
  const log = {
    variations: [], inheritedTraits: 0, newTrait: null, inheritedPerks: [], upgradedPerks: [], newPerk: null,
    mutation: null, mutationSource: null, spontaneousRolled: false,
  };
  const uid = 'm_' + hashHex(seed, 'offspring');
  const generation = Math.max(a.generation, b.generation) + 1;
  const nameRng = subRng(seed, 'name');
  const name = makeName(nameRng);

  // 1. ordinary attributes
  const rngA = subRng(seed, 'attributes');
  const genes = {};
  for (const cat of CATEGORIES) genes[cat] = inheritAttribute(rngA, a, b, cat, ctx, cfg, log);
  Object.assign(genes, inheritColor(subRng(seed, 'color'), a, b, ctx, cfg, log));

  // 2. base stats
  const base = baseStats(genes, cfg);

  // 3. inherit Advanced Traits
  const rngT = subRng(seed, 'traitsInherit');
  const pool = new Map();
  for (const t of a.traits) pool.set(t.traitUid, { t, n: 1 });
  for (const t of b.traits) {
    if (pool.has(t.traitUid)) pool.get(t.traitUid).n = 2;
    else pool.set(t.traitUid, { t, n: 1 });
  }
  let traits = [];
  for (const key of [...pool.keys()].sort()) {
    const { t, n } = pool.get(key);
    const p = n === 2 ? cfg.traits.traitInheritChanceShared : cfg.traits.traitInheritChanceSingle;
    if (rngT.chance(p)) traits.push({ entry: { ...t }, shared: n === 2 });
  }
  if (traits.length > cfg.traits.maxAdvancedTraits) {
    traits = rngT.shuffle(traits).sort((x, y) => Number(y.shared) - Number(x.shared)).slice(0, cfg.traits.maxAdvancedTraits);
  }
  traits = traits.map((x) => x.entry);
  log.inheritedTraits = traits.length;

  // 4. new Advanced Trait (max one)
  const rngNT = subRng(seed, 'traitNew');
  const rollTrait = rngNT.chance(cfg.traits.newAdvancedTraitChance);
  if (ctx.unlocks.traits && traits.length < cfg.traits.maxAdvancedTraits && (rollTrait || ctx.guaranteeTrait || force.trait)) {
    const current = { ...base };
    for (const t of traits) current[t.stat] += t.bonus;
    const eligible = STATS.filter((s) => current[s] + cfg.traits.advancedTraitBonus <= cfg.stats.statCap);
    if (eligible.length) {
      const stat = rngNT.pick(eligible);
      const t = {
        traitUid: 't_' + hashHex(seed, 'trait'), stat, bonus: cfg.traits.advancedTraitBonus,
        originMushroomId: uid, originName: name, originGeneration: generation,
        originForestId: ctx.forest?.id ?? null, originBreedingId: ctx.breedingId ?? null,
      };
      traits.push(t);
      log.newTrait = t;
    }
  }

  // 5-6. inherit and combine Perks
  const rngP = subRng(seed, 'perksInherit');
  const perkPool = new Map();
  for (const p of a.perks) perkPool.set(p.perkId, { a: p, b: null });
  for (const p of b.perks) {
    if (perkPool.has(p.perkId)) perkPool.get(p.perkId).b = p;
    else perkPool.set(p.perkId, { a: null, b: p });
  }
  let perks = [];
  for (const id of [...perkPool.keys()].sort()) {
    const def = PERK_BY_ID[id];
    if (!def) continue;
    const { a: pa, b: pb } = perkPool.get(id);
    if (pa && pb) {
      if (rngP.chance(cfg.perks.perkInheritChanceShared)) {
        const level = combinePerk(rngP, def, pa.level, pb.level, cfg);
        const src = pa.level >= pb.level ? pa : pb;
        const entry = { ...src, level };
        if (level > Math.max(pa.level, pb.level)) log.upgradedPerks.push({ perkId: id, from: Math.max(pa.level, pb.level), to: level });
        perks.push({ entry, shared: true });
      }
    } else {
      const p = pa || pb;
      if (rngP.chance(cfg.perks.perkInheritChanceSingle)) perks.push({ entry: { ...p }, shared: false });
    }
  }
  if (perks.length > cfg.perks.maxPerks) {
    perks = rngP.shuffle(perks)
      .sort((x, y) => Number(y.shared) - Number(x.shared) || y.entry.level - x.entry.level)
      .slice(0, cfg.perks.maxPerks);
  }
  perks = perks.map((x) => x.entry);
  log.inheritedPerks = perks.map((p) => p.perkId);

  // 7. new Perk
  const rngNP = subRng(seed, 'perkNew');
  const rollPerk = rngNP.chance(cfg.perks.newPerkChance);
  if (ctx.unlocks.perks && perks.length < cfg.perks.maxPerks && (rollPerk || force.perk)) {
    const held = new Set(perks.map((p) => p.perkId));
    const candidates = PERKS.filter((p) => !held.has(p.id));
    const cur = { ...base };
    for (const t of traits) cur[t.stat] += t.bonus;
    const tops = topStats(cur, 2);
    const related = candidates.filter((p) => p.related === 'any' || tops.includes(p.related));
    const pickFrom = related.length && rngNP.chance(cfg.perks.newPerkAffinityWeight) ? related : candidates;
    if (pickFrom.length) {
      const def = rngNP.pick(pickFrom);
      const p = { perkId: def.id, level: 1, originMushroomId: uid, originGeneration: generation, originForestId: ctx.forest?.id ?? null };
      perks.push(p);
      log.newPerk = p;
    }
  }

  // 8. parental Mutation
  const rngM = subRng(seed, 'mutationInherit');
  let mutation = null;
  const mutated = [a, b].filter((p) => p.mutation && MUTATION_BY_ID[p.mutation.mutationId]);
  if (mutated.length === 1) {
    if (rngM.chance(cfg.mutations.mutationInheritChanceSingle)) mutation = mutated[0].mutation;
  } else if (mutated.length === 2) {
    if (rngM.chance(cfg.mutations.mutationInheritChanceBoth)) {
      const [ma, mb] = mutated.map((p) => p.mutation);
      mutation = ma.mutationId === mb.mutationId ? ma : (rngM.chance(0.5) ? ma : mb);
    }
  }
  if (mutation) {
    mutation = {
      mutationId: mutation.mutationId, bonuses: resolveMutationBonuses(mutation.mutationId, genes), origin: 'inherited',
      originMushroomId: mutation.originMushroomId, originGeneration: mutation.originGeneration, originForestId: mutation.originForestId,
    };
    log.mutation = mutation.mutationId;
    log.mutationSource = 'inherited';
  }

  // 9. spontaneous Mutation — only if none inherited
  if (!mutation && ctx.unlocks.mutations) {
    log.spontaneousRolled = true;
    const rngS = subRng(seed, 'mutationSpontaneous');
    if (rngS.chance(cfg.mutations.spontaneousMutationChance) || force.mutation) {
      const mods = ctx.mutationWeightMods || {};
      const def = rngS.weighted(MUTATIONS, (m) => m.weight * (mods[m.id] ?? 1));
      mutation = {
        mutationId: def.id, bonuses: resolveMutationBonuses(def.id, genes), origin: 'spontaneous',
        originMushroomId: uid, originGeneration: generation, originForestId: ctx.forest?.id ?? null,
      };
      log.mutation = def.id;
      log.mutationSource = 'spontaneous';
    }
  }

  // temperament
  const rngTe = subRng(seed, 'temperament');
  const ti = cfg.inheritance.temperamentInheritance;
  const r = rngTe.next();
  const temperament = r < ti.parentA ? a.temperament : r < ti.parentA + ti.parentB ? b.temperament : rngTe.pick(TEMPERAMENTS).id;

  const offspring = newMushroom({
    uid, name, createdAt: ctx.now ?? 0, generation, genes, temperament, traits, perks, mutation,
    parents: [a.uid, b.uid],
    lineage: { parents: [snapshot(a), snapshot(b)] },
    origin: { kind: 'bred', forestId: ctx.forest?.id ?? null, forestName: ctx.forest?.name ?? null, breedingId: ctx.breedingId ?? null },
  });

  // 10. validate
  return { offspring: enforceLimits(offspring), log };
}

/** Enforce trait/perk/mutation limits deterministically (defensive). */
export function enforceLimits(m) {
  const cfg = getConfig();
  if (m.traits.length > cfg.traits.maxAdvancedTraits) m.traits = m.traits.slice(0, cfg.traits.maxAdvancedTraits);
  const seen = new Set();
  m.perks = m.perks.filter((p) => PERK_BY_ID[p.perkId] && !seen.has(p.perkId) && seen.add(p.perkId));
  if (m.perks.length > cfg.perks.maxPerks) m.perks = m.perks.slice(0, cfg.perks.maxPerks);
  for (const p of m.perks) p.level = Math.max(1, Math.min(PERK_BY_ID[p.perkId].levels.length, p.level));
  if (m.mutation && !MUTATION_BY_ID[m.mutation.mutationId]) m.mutation = null;
  return m;
}

/** Plausibility bounds used by import validation (GDD 14.4). */
export function maxTraitsForGeneration(gen) {
  const cfg = getConfig();
  return Math.min(cfg.traits.maxAdvancedTraits, 2 ** Math.max(0, gen - 1) - 1);
}
