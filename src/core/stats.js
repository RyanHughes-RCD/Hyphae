// Stat calculation (GDD Section 7). Pure functions.
import { getConfig, STATS, COLOR_GROUPS } from '../config.js';
import { ATTRIBUTE_BY_ID, CATEGORIES, ALLOC_TEMPLATES, COLOR_FAMILIES, AFFINITY_NAMES } from '../content/attributes.js';

export const zeroStats = () => Object.fromEntries(STATS.map((s) => [s, 0]));

/**
 * Integer apportionment by the largest-remainder method using exact integer
 * arithmetic. Ties break toward the lower index.
 */
export function largestRemainder(total, weights) {
  const W = weights.reduce((a, b) => a + b, 0);
  if (W <= 0) return weights.map(() => 0);
  const floors = weights.map((w) => Math.floor((total * w) / W));
  const rems = weights.map((w) => (total * w) % W);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = weights.map((_, i) => i).sort((a, b) => rems[b] - rems[a] || a - b);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) floors[order[k]]++;
  return floors;
}

/** Step 1: RGB -> points per colour group [red, green, blue]. */
export function colorGroupPoints(rgb, cfg = getConfig()) {
  let [r, g, b] = rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))));
  if (r + g + b === 0) [r, g, b] = cfg.stats.colorZeroFallback;
  return largestRemainder(cfg.stats.colorBudget, [r, g, b]);
}

/** Step 2: full colour contribution using the allocation sub-gene. */
export function colorContribution(rgb, alloc, cfg = getConfig()) {
  const out = zeroStats();
  const [rp, gp, bp] = colorGroupPoints(rgb, cfg);
  const groups = [['red', rp], ['green', gp], ['blue', bp]];
  for (const [group, pts] of groups) {
    const entry = alloc[group];
    const n = COLOR_GROUPS[group].length;
    const weights = ALLOC_TEMPLATES[entry.t][n];
    const split = largestRemainder(pts, weights);
    entry.o.forEach((stat, i) => { out[stat] += split[i]; });
  }
  return out;
}

/** Contribution of one ordinary attribute (fixed for its id). */
export function attributeContribution(attrId) {
  const def = ATTRIBUTE_BY_ID[attrId];
  const out = zeroStats();
  if (!def) return out;
  for (const [s, v] of Object.entries(def.stats)) out[s] += v;
  return out;
}

export function baseStats(genes, cfg = getConfig()) {
  const out = zeroStats();
  for (const cat of CATEGORIES) {
    const c = attributeContribution(genes[cat]);
    for (const s of STATS) out[s] += c[s];
  }
  const col = colorContribution(genes.color, genes.alloc, cfg);
  for (const s of STATS) out[s] += col[s];
  return out;
}

/**
 * Final stats. `active` says which genetic systems are unlocked for this
 * mushroom's owner; locked entries are dormant and grant nothing.
 */
export function computeStats(m, active = { traits: true, mutations: true }, cfg = getConfig()) {
  const base = baseStats(m.genes, cfg);
  const traitBonus = zeroStats();
  const mutationBonus = zeroStats();
  if (active.traits) for (const t of m.traits || []) traitBonus[t.stat] += t.bonus;
  if (active.mutations && m.mutation) {
    for (const [s, v] of Object.entries(m.mutation.bonuses || {})) mutationBonus[s] += v;
  }
  const final = zeroStats();
  const overflow = zeroStats();
  for (const s of STATS) {
    const raw = base[s] + traitBonus[s] + mutationBonus[s];
    final[s] = Math.min(cfg.stats.statCap, raw);
    overflow[s] = Math.max(0, raw - cfg.stats.statCap);
  }
  return { base, traitBonus, mutationBonus, final, overflow };
}

export function affinity(final) {
  let best = STATS[0];
  for (const s of STATS) if (final[s] > final[best]) best = s;
  return { stat: best, name: AFFINITY_NAMES[best] };
}

export function topStats(stats, n = 2) {
  return STATS.slice().sort((a, b) => stats[b] - stats[a] || STATS.indexOf(a) - STATS.indexOf(b)).slice(0, n);
}

export function rarityScore(m, cfg = getConfig()) {
  const p = cfg.rarity.points;
  let score = 0;
  for (const cat of CATEGORIES) {
    const tier = ATTRIBUTE_BY_ID[m.genes[cat]]?.tier;
    if (tier === 'uncommon') score += p.uncommon;
    if (tier === 'rare') score += p.rare;
  }
  score += (m.traits || []).length * p.trait;
  score += (m.perks || []).reduce((s, pk) => s + pk.level, 0) * p.perkLevel;
  if (m.mutation) score += p.mutation;
  return score;
}

export function rarityTier(m, cfg = getConfig()) {
  const score = rarityScore(m, cfg);
  let tier = cfg.rarity.tiers[0];
  for (const t of cfg.rarity.tiers) if (score >= t.min) tier = t;
  return { ...tier, score };
}

export function colorFamily(rgb) {
  let best = COLOR_FAMILIES[0];
  let bestD = Infinity;
  for (const f of COLOR_FAMILIES) {
    const d = (f.rgb[0] - rgb[0]) ** 2 * 0.3 + (f.rgb[1] - rgb[1]) ** 2 * 0.59 + (f.rgb[2] - rgb[2]) ** 2 * 0.11;
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

export function dominantGroup(rgb) {
  const pts = colorGroupPoints(rgb);
  const idx = pts.indexOf(Math.max(...pts));
  return ['red', 'green', 'blue'][idx];
}

export function statSum(stats) {
  return STATS.reduce((s, k) => s + stats[k], 0);
}
