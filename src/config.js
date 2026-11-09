// Centralized, versioned balance configuration (GDD Section 19).
// Every tunable number in the game lives here. Game logic reads it through
// getConfig() so tests and the balance simulator can inject alternatives.

export const STATS = ['CUL', 'MYC', 'FOR', 'CON', 'MAG', 'ANI', 'DIS', 'SOC'];

export const STAT_NAMES = {
  CUL: 'Cultivation', MYC: 'Mycology', FOR: 'Foraging', CON: 'Construction',
  MAG: 'Magic', ANI: 'Animal Care', DIS: 'Local Discovery', SOC: 'Social Craft',
};

export const COLOR_GROUPS = {
  red: ['CUL', 'MYC', 'FOR'],
  green: ['CON', 'MAG', 'ANI'],
  blue: ['DIS', 'SOC'],
};

const DEFAULT_CONFIG = {
  configVersion: 1,

  stats: {
    statCap: 100,
    categoryBudgets: { cap: 27, stem: 18, markings: 15, gills: 12, glow: 9 },
    rareTierBudgetBonus: 3,
    colorBudget: 12,
    colorZeroFallback: [1, 1, 1],
  },

  starters: {
    starterCount: 3,
    starterMaxStat: 45,
    starterMaxAttempts: 500,
    starterColorJitter: 10,
  },

  traits: {
    advancedTraitBonus: 4,
    maxAdvancedTraits: 8,
    newAdvancedTraitChance: 0.25,
    traitInheritChanceSingle: 0.5,
    traitInheritChanceShared: 0.75,
    advancedTraitStatWeighting: 'uniform',
    tutorialGuaranteedFirstTrait: true,
  },

  perks: {
    maxPerks: 3,
    newPerkChance: 0.08,
    perkInheritChanceSingle: 0.5,
    perkInheritChanceShared: 0.9,
    standardUnequalUpgradeChance: 0.25,
    slowEqualUpgradeChance: 0.4,
    newPerkAffinityWeight: 0.6,
  },

  mutations: {
    maxMutations: 1,
    spontaneousMutationChance: 0.0075,
    mutationInheritChanceSingle: 0.35,
    mutationInheritChanceBoth: 0.6,
  },

  inheritance: {
    attributeParentWeight: 0.5,
    attributeVariationChance: 0.06,
    mischievousVariationMultiplier: 1.25,
    rareVariationShare: 0.2,
    firstBreedVariationEnabled: false,
    colorBlendRange: [0.3, 0.7],
    colorJitter: 12,
    // two colour genes per mushroom: one shown, one possibly hidden
    colorAlleleBlendDistance: 90, // genes closer than this (RGB distance) blend; otherwise one is shown, 50/50
    colorExpressJitter: 8,
    colorSportChance: 0.04, // a passed-on colour gene shifts to a neighbouring shade
    colorSportShift: [25, 45], // degrees around the colour wheel
    colorVariationChance: 0.15, // the shown colour shifts (and the change is inherited)
    colorVariationHueShift: 60,
    temperamentInheritance: { parentA: 0.45, parentB: 0.45, random: 0.1 },
  },

  breeding: {
    incubationMinutes: 3,
    parentRestMinutes: 10,
    offspringMaturationMinutes: 0,
    freeBreedingCount: 1,
    breedingCostGlimmer: 15,
    maxPens: 3, // each Breeding Pen incubates one spore cluster at a time
    // pen upgrades (apply to every pen)
    stations: {
      breeding_nook: { speed: 1.0, discount: 0 },
      spore_cradle: { speed: 0.9, discount: 0 },
      moonlit_cradle: { speed: 0.75, discount: 2 },
    },
  },

  unlocks: {
    traitsAfterBreedings: 2,
    mutationsGeneration: 5,
  },

  jobs: {
    jobScoreWeights: [0.7, 0.3],
    effectivenessMin: 0.5,
    effectivenessRange: 1.5,
    productivityBonusCap: 0.6,
    synergyBonus: 0.15,
  },

  temperaments: {
    industriousDuration: 0.9,
    curiousChance: 0.03,
    sleepyDuration: 1.15,
    sleepyRestedBonus: 0.15,
    socialBonus: 0.05,
    greedyFindBonus: 0.08,
    gentleBonus: 0.05,
    stubbornBonus: 0.08,
    stubbornHours: 12,
  },

  economy: {
    startingGlimmer: 0,
    glimmerPerCycle: 0.5,
    tradeDailyLimit: 30,
    tradeRates: {
      berries: 1, seeds: 1, flowers: 2, twigs: 0.5, leaves: 0.5, nuts: 1,
      stones: 1, bark: 1, spores: 1.5, compost: 1, planks: 3, dew: 2,
      feathers: 2, roots: 1.5, clay: 1.5, geodes: 8, moonlight: 4,
      glowDust: 5, spiritDew: 5, decorations: 4, gifts: 6,
    },
    milestoneGlimmer: 10,
  },

  world: {
    dayPhaseHours: { dawn: 5, day: 8, dusk: 18, night: 21 },
    weatherWeights: { clear: 65, cloudy: 20, rain: 15 },
    rainWindows: { min: 1, max: 2, minHours: 1, maxHours: 3 },
    wildVisitorStayHours: 12,
    wildVisitorSlotHours: 3,
    wildVisitorChance: 0.35,
    visibleMushroomCap: 10,
    baseResidentCap: 8,
    homeCapacity: 2,
    moonstoneChance: 0.02,
    moonstoneGuaranteeCycles: 60,
  },

  offline: { offlineCapHours: 8 },

  rarity: {
    points: { uncommon: 1, rare: 3, trait: 1, perkLevel: 1, mutation: 8 },
    tiers: [
      { id: 'common', name: 'Common', min: 0 },
      { id: 'uncommon', name: 'Uncommon', min: 3 },
      { id: 'rare', name: 'Rare', min: 7 },
      { id: 'epic', name: 'Epic', min: 13 },
      { id: 'legendary', name: 'Legendary', min: 20 },
    ],
  },

  sharing: {
    maxSharePayloadBytes: 4096,
    guestCap: 10,
    nameMaxLength: 24,
  },
};

let active = structuredClone(DEFAULT_CONFIG);

export function getConfig() {
  return active;
}

export function defaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}

/** Replace config (tests / simulator). Deep-merges overrides onto defaults. */
export function setConfig(overrides = {}) {
  active = deepMerge(structuredClone(DEFAULT_CONFIG), overrides);
  return active;
}

export function resetConfig() {
  active = structuredClone(DEFAULT_CONFIG);
  return active;
}

function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}
