// Perk and Mutation definitions (GDD 8.2, 8.3). Data only.

// effect types consumed by the job simulation (src/core/work.js):
//  prod      : +productivity % while condition holds
//  chance    : chance per cycle of extra output { resource, amount }
//  conserve  : chance to not consume converter inputs / extra builder work
export const PERKS = [
  { id: 'rain_worker', name: 'Rain Worker', desc: 'More productive while it rains.', condition: 'rain', effect: 'prod', levels: [0.03, 0.05, 0.07, 0.09, 0.12], rule: 'standard', related: 'any' },
  { id: 'morning_dew', name: 'Morning Dew', desc: 'Chance to gather extra dew at dawn.', condition: 'dawn', effect: 'chance', reward: { dew: 1 }, levels: [0.05, 0.08, 0.11, 0.15], rule: 'standard', related: 'FOR' },
  { id: 'treasure_nose', name: 'Treasure Nose', desc: 'Better chance of bonus finds while digging.', condition: 'family:discovery', effect: 'chance', reward: { geodes: 1 }, levels: [0.04, 0.06, 0.08, 0.10, 0.13], rule: 'slow', related: 'DIS' },
  { id: 'night_shift', name: 'Night Shift', desc: 'More productive at night.', condition: 'night', effect: 'prod', levels: [0.04, 0.06, 0.08, 0.10, 0.12], rule: 'standard', related: 'any' },
  { id: 'early_riser', name: 'Early Riser', desc: 'More productive at dawn.', condition: 'dawn', effect: 'prod', levels: [0.05, 0.08, 0.11, 0.14, 0.18], rule: 'standard', related: 'any' },
  { id: 'green_thumb', name: 'Green Thumb', desc: 'More output from plant-tending jobs.', condition: 'family:cultivation', effect: 'prod', levels: [0.05, 0.08, 0.11, 0.14], rule: 'standard', related: 'CUL' },
  { id: 'spore_sower', name: 'Spore Sower', desc: 'Chance to spread an extra fungal patch (bonus spores).', condition: 'family:mycology', effect: 'chance', reward: { spores: 2 }, levels: [0.03, 0.05, 0.07, 0.09], rule: 'standard', related: 'MYC' },
  { id: 'team_player', name: 'Team Player', desc: 'More productive when sharing a job with another mushroom.', condition: 'teammate', effect: 'prod', levels: [0.03, 0.05, 0.07, 0.10], rule: 'standard', related: 'SOC' },
  { id: 'careful_builder', name: 'Careful Builder', desc: 'Chance to conserve construction materials.', condition: 'family:construction', effect: 'conserve', levels: [0.05, 0.08, 0.11, 0.15], rule: 'slow', related: 'CON' },
  { id: 'moon_listener', name: 'Moon Listener', desc: 'Chance of moonlight during night-time magic work.', condition: 'night+family:magic', effect: 'chance', reward: { moonlight: 1 }, levels: [0.04, 0.06, 0.09, 0.12], rule: 'standard', related: 'MAG' },
  { id: 'gentle_keeper', name: 'Gentle Keeper', desc: 'More output from animal care work.', condition: 'family:animal', effect: 'prod', levels: [0.05, 0.08, 0.11, 0.15], rule: 'standard', related: 'ANI' },
  { id: 'gift_wrapper', name: 'Gift Wrapper', desc: 'Chance of an extra gift.', condition: 'family:social', effect: 'chance', reward: { gifts: 1 }, levels: [0.05, 0.08, 0.12], rule: 'slow', related: 'SOC' },
];
export const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));

export const MUTATIONS = [
  {
    id: 'starfall_aura', name: 'Starfall Aura', weight: 1,
    desc: 'Star-like particles drift around it. Finds stardust during night work.',
    bonus: { MAG: 18 }, effect: { type: 'chance', condition: 'night', reward: { stardust: 1 }, value: 0.05 },
    visual: { kind: 'stars', color: [255, 240, 160] },
  },
  {
    id: 'verdant_glow', name: 'Verdant Glow', weight: 1,
    desc: 'A green glowing outline. Better at tending plants.',
    bonus: { CUL: 18 }, effect: { type: 'prod', condition: 'family:cultivation', value: 0.10 },
    visual: { kind: 'outline', color: [120, 255, 120] },
  },
  {
    id: 'deep_spore_bloom', name: 'Deep-Spore Bloom', weight: 1,
    desc: 'Purple spores float around it. Produces rare spores.',
    bonus: { MYC: 18 }, effect: { type: 'chance', condition: 'family:mycology', reward: { rareSpores: 1 }, value: 0.15 },
    visual: { kind: 'spores', color: [190, 110, 255] },
  },
  {
    id: 'prismatic_veil', name: 'Prismatic Veil', weight: 1,
    desc: 'A multicoloured shimmer. Small boosts to its four weakest stats.',
    bonusRule: { type: 'lowestBase', count: 4, amount: 5 }, effect: null,
    visual: { kind: 'prism', color: [255, 255, 255] },
  },
];
export const MUTATION_BY_ID = Object.fromEntries(MUTATIONS.map((m) => [m.id, m]));

export const TRAIT_NAMES = {
  CUL: 'Deep Roots', MYC: 'Spore Heart', FOR: 'Quick Gatherer', CON: 'Steady Hands',
  MAG: 'Moon-Touched', ANI: 'Warm Presence', DIS: 'Keen Nose', SOC: 'Kind Spirit',
};
