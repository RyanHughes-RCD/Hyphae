// Resources, jobs, structures, stages/areas (GDD Sections 11-13). Data only.

export const RESOURCES = {
  berries: { name: 'Berries', color: '#c83a5a', cat: 'natural' },
  seeds: { name: 'Seeds', color: '#c9a46a', cat: 'natural' },
  flowers: { name: 'Flowers', color: '#f08cc0', cat: 'natural' },
  twigs: { name: 'Twigs', color: '#8a5a32', cat: 'natural' },
  leaves: { name: 'Leaves', color: '#6aa640', cat: 'natural' },
  nuts: { name: 'Nuts', color: '#a8743a', cat: 'natural' },
  stones: { name: 'Stones', color: '#9a9aa4', cat: 'natural' },
  bark: { name: 'Bark', color: '#6a4426', cat: 'natural' },
  dew: { name: 'Dew', color: '#8fd8ff', cat: 'natural' },
  feathers: { name: 'Feathers', color: '#e8e0d0', cat: 'natural' },
  roots: { name: 'Roots', color: '#b0784a', cat: 'natural' },
  clay: { name: 'Clay', color: '#c0704a', cat: 'natural' },
  spores: { name: 'Spores', color: '#d9c27a', cat: 'fungal' },
  rareSpores: { name: 'Rare Spores', color: '#b46cff', cat: 'fungal' },
  compost: { name: 'Compost', color: '#5a4030', cat: 'fungal' },
  geodes: { name: 'Geodes', color: '#7a60c0', cat: 'magical' },
  moonlight: { name: 'Moonlight', color: '#e0e8ff', cat: 'magical' },
  glowDust: { name: 'Glow Dust', color: '#ffe066', cat: 'magical' },
  spiritDew: { name: 'Spirit Dew', color: '#9ff0e0', cat: 'magical' },
  stardust: { name: 'Stardust', color: '#fff4b0', cat: 'magical' },
  planks: { name: 'Planks', color: '#c8955a', cat: 'crafted' },
  decorations: { name: 'Decorations', color: '#ff9a50', cat: 'crafted' },
  gifts: { name: 'Gifts', color: '#ff6a8a', cat: 'crafted' },
  charms: { name: 'Charms', color: '#ffd0f0', cat: 'crafted' },
};
export const RESOURCE_IDS = Object.keys(RESOURCES);

// family is used by perk conditions ("family:cultivation")
// outputs: expected amount per cycle at effectiveness 1.0
// inputs: consumed per cycle (converter jobs); if missing the worker idles
export const JOBS = [
  { id: 'gardener', name: 'Gardener', family: 'cultivation', primary: 'CUL', secondary: 'ANI', structure: 'garden_bed', duration: 45, outputs: { berries: 1, seeds: 0.35, flowers: 0.2 }, anim: 'water', desc: 'Tends garden beds for berries, seeds and flowers.' },
  { id: 'forager', name: 'Forager', family: 'foraging', primary: 'FOR', secondary: 'DIS', structure: 'wild_thicket', duration: 40, outputs: { twigs: 1, leaves: 1, nuts: 0.25, stones: 0.35, bark: 0.3 }, anim: 'carry', desc: 'Gathers twigs, leaves, nuts, stones and bark.' },
  { id: 'mycologist', name: 'Mycologist', family: 'mycology', primary: 'MYC', secondary: 'CUL', structure: 'spore_bed', duration: 60, outputs: { spores: 1, compost: 0.5 }, anim: 'spores', desc: 'Cultivates spore beds for spores and compost.' },
  { id: 'woodworker', name: 'Woodworker', family: 'construction', primary: 'CON', secondary: 'FOR', structure: 'workbench', duration: 60, inputs: { twigs: 2, bark: 1 }, outputs: { planks: 1 }, anim: 'hammer', desc: 'Turns twigs and bark into planks.' },
  { id: 'builder', name: 'Builder', family: 'construction', primary: 'CON', secondary: 'SOC', structure: 'building_site', duration: 60, outputs: {}, work: 1, anim: 'hammer', desc: 'Advances forest projects such as path repairs.' },
  { id: 'dew_collector', name: 'Dew Collector', family: 'foraging', primary: 'FOR', secondary: 'MAG', structure: 'dew_reeds', duration: 50, outputs: { dew: 1 }, anim: 'carry', desc: 'Collects dew from the reeds.' },
  { id: 'waterer', name: 'Waterer', family: 'cultivation', primary: 'CUL', secondary: 'ANI', structure: 'water_barrel', duration: 50, outputs: { seeds: 0.2 }, synergy: { job: 'gardener' }, anim: 'water', desc: 'Waters the garden: Gardeners work better while a Waterer works.' },
  { id: 'nest_tender', name: 'Nest Tender', family: 'animal', primary: 'ANI', secondary: 'CUL', structure: 'reed_nest', duration: 60, outputs: { feathers: 0.6 }, visitorBonus: 0.15, anim: 'tend', desc: 'Tends reed nests: feathers, and Wild Visitors come more often.' },
  { id: 'excavator', name: 'Excavator', family: 'discovery', primary: 'DIS', secondary: 'CON', structure: 'dig_site', duration: 70, outputs: { roots: 1, clay: 0.5, geodes: 0.08 }, findsMoonstone: true, anim: 'dig', desc: 'Digs for roots, clay, geodes and hidden places.' },
  { id: 'night_watcher', name: 'Night Watcher', family: 'discovery', primary: 'DIS', secondary: 'MAG', structure: 'lookout_stump', duration: 70, outputs: { moonlight: 0.5, glowDust: 0.25 }, phases: ['dusk', 'night'], findsMoonstone: true, anim: 'glow', desc: 'Watches the forest at dusk and night for moonlight and glow traces.' },
  { id: 'enchanter', name: 'Enchanter', family: 'magic', primary: 'MAG', secondary: 'SOC', structure: 'shrine', duration: 80, outputs: { glowDust: 1 }, anim: 'glow', desc: 'Keeps the shrine glowing; makes glow dust.' },
  { id: 'spirit_keeper', name: 'Spirit Keeper', family: 'magic', primary: 'MAG', secondary: 'ANI', structure: 'moonlit_grove', duration: 80, outputs: { spiritDew: 0.7 }, visitorBonus: 0.1, anim: 'glow', desc: 'Tends the moonlit grove; gathers spirit dew.' },
  { id: 'festival_helper', name: 'Festival Helper', family: 'social', primary: 'SOC', secondary: 'CON', structure: 'gathering_circle', duration: 70, outputs: { decorations: 0.6 }, anim: 'tend', desc: 'Makes festival decorations.' },
  { id: 'gift_maker', name: 'Gift Maker', family: 'social', primary: 'SOC', secondary: 'MAG', structure: 'gift_table', duration: 70, outputs: { gifts: 0.5, charms: 0.2 }, anim: 'tend', desc: 'Crafts gifts and charms.' },
];
export const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j]));

// kind: work | special | home | decor
export const STRUCTURES = {
  garden_bed: { name: 'Garden Bed', kind: 'work', job: 'gardener', slots: 1, cost: { twigs: 8, leaves: 4 }, buildable: true, sprite: 'bed' },
  wild_thicket: { name: 'Wild Thicket', kind: 'work', job: 'forager', slots: 3, cost: { seeds: 4, leaves: 6 }, buildable: true, sprite: 'bush' },
  breeding_nook: { name: 'Breeding Nook', kind: 'special', sprite: 'nook' },
  trading_stump: { name: 'Trading Stump', kind: 'special', sprite: 'stump' },
  spore_bed: { name: 'Spore Bed', kind: 'work', job: 'mycologist', slots: 2, cost: { twigs: 10, leaves: 10 }, buildable: true, buildCost: { compost: 4, twigs: 6 }, sprite: 'sporebed' },
  workbench: { name: 'Workbench', kind: 'work', job: 'woodworker', slots: 2, cost: { twigs: 15, bark: 6, stones: 8 }, sprite: 'bench' },
  building_site: { name: 'Building Site', kind: 'work', job: 'builder', slots: 2, cost: { twigs: 10, stones: 6 }, sprite: 'site' },
  dew_reeds: { name: 'Dew Reeds', kind: 'work', job: 'dew_collector', slots: 2, cost: { planks: 4, twigs: 6 }, sprite: 'reeds' },
  water_barrel: { name: 'Water Barrel', kind: 'work', job: 'waterer', slots: 1, cost: { planks: 6 }, sprite: 'barrel' },
  reed_nest: { name: 'Reed Nest', kind: 'work', job: 'nest_tender', slots: 2, cost: { twigs: 8, leaves: 8 }, sprite: 'nest' },
  dig_site: { name: 'Dig Site', kind: 'work', job: 'excavator', slots: 2, cost: { planks: 6, stones: 10 }, sprite: 'dig' },
  lookout_stump: { name: 'Lookout Stump', kind: 'work', job: 'night_watcher', slots: 2, cost: { planks: 8, bark: 6 }, sprite: 'lookout' },
  shrine: { name: 'Shrine', kind: 'work', job: 'enchanter', slots: 2, cost: { stones: 20, moonlight: 6, glowDust: 4 }, sprite: 'shrine' },
  moonlit_grove: { name: 'Moonlit Grove', kind: 'work', job: 'spirit_keeper', slots: 2, cost: { seeds: 10, dew: 10, moonlight: 4 }, sprite: 'grove' },
  gathering_circle: { name: 'Gathering Circle', kind: 'work', job: 'festival_helper', slots: 2, cost: { planks: 15, flowers: 10 }, sprite: 'circle' },
  gift_table: { name: 'Gift Table', kind: 'work', job: 'gift_maker', slots: 2, cost: { planks: 10, spiritDew: 4 }, sprite: 'table' },
  mushroom_home: { name: 'Mushroom Home', kind: 'home', capacity: 2, cost: { planks: 6, stones: 4 }, buildable: true, requiresStage: 'workshop', sprite: 'home' },
  cozy_home: { name: 'Cozy Home', kind: 'home', capacity: 4, cost: { planks: 12, decorations: 4, stones: 6 }, buildable: true, requiresStage: 'community', sprite: 'cozyhome' },
  // decorations — habitat influence for Wild Visitors (GDD 5.3)
  flower_patch: { name: 'Flower Patch', kind: 'decor', cost: { seeds: 2 }, buildable: true, habitat: 'flowers', sprite: 'flowers' },
  fern_clump: { name: 'Fern Clump', kind: 'decor', cost: { leaves: 4 }, buildable: true, habitat: 'shade', sprite: 'fern' },
  stone_ring: { name: 'Stone Ring', kind: 'decor', cost: { stones: 5 }, buildable: true, habitat: 'stone', sprite: 'stones' },
  fallen_log: { name: 'Fallen Log', kind: 'decor', cost: { bark: 4, twigs: 4 }, buildable: true, habitat: 'log', sprite: 'log' },
  little_pond: { name: 'Little Pond', kind: 'decor', cost: { stones: 4, dew: 4 }, buildable: true, requiresStage: 'pond', habitat: 'water', sprite: 'pond' },
  lantern: { name: 'Glow Lantern', kind: 'decor', cost: { planks: 2, glowDust: 1 }, buildable: true, requiresStage: 'roothollow', habitat: 'glow', sprite: 'lantern' },
  moonstone_ring: { name: 'Moonstone Ring', kind: 'special', sprite: 'moonstone' },
  // crossing water: makes a river or lake tile walkable
  bridge: { name: 'Bridge', kind: 'bridge', cost: { twigs: 6, bark: 2 }, buildable: true, onWater: true, sprite: 'bridge' },
  // clutter strewn across new expansions — clear it to make room (yields a few resources)
  weeds: { name: 'Weeds', kind: 'clutter', clear: { leaves: 1 }, weight: 6, sprite: 'weeds' },
  brambles: { name: 'Brambles', kind: 'clutter', clear: { twigs: 2, berries: 1 }, weight: 4, sprite: 'brambles' },
  rocks: { name: 'Loose Rocks', kind: 'clutter', clear: { stones: 2 }, weight: 3, sprite: 'rocks' },
  branch: { name: 'Fallen Branch', kind: 'clutter', clear: { twigs: 2, bark: 1 }, weight: 3, sprite: 'branch' },
  old_stump: { name: 'Old Stump', kind: 'clutter', clear: { bark: 2, roots: 1 }, needsStage: 'workshop', weight: 2, sprite: 'oldstump' },
  boulder: { name: 'Boulder', kind: 'clutter', clear: { stones: 5 }, needsStage: 'workshop', weight: 1, sprite: 'boulder' },
};

export const BREEDING_STATIONS = {
  breeding_nook: { name: 'Breeding Nook' },
  spore_cradle: { name: 'Spore Cradle', cost: { planks: 12, spores: 10 }, requiresStage: 'workshop' },
  moonlit_cradle: { name: 'Moonlit Cradle', cost: { planks: 20, moonlight: 8, glowDust: 6 }, requiresStage: 'landmark' },
};

export const PROJECTS = {
  creek_path: { name: 'Creek Path Repair', desc: 'Repair the overgrown path to the creek.', cost: { planks: 8, stones: 6 }, work: 12, requiresStage: 'workshop', reveals: 'pond' },
};

// Terrain: g grass, m moss, d damp soil, l leaf litter, s stone, w water, h deep shade, x magical, p path
export const TERRAIN = {
  g: { name: 'Grass', color: '#5f9e48', dark: '#4f8a3c' },
  m: { name: 'Moss', color: '#4f8f5a', dark: '#3f7a4b' },
  d: { name: 'Damp soil', color: '#6a5038', dark: '#5a432e' },
  l: { name: 'Leaf litter', color: '#9a7a3a', dark: '#86692f' },
  s: { name: 'Stone', color: '#8a8a90', dark: '#76767c' },
  w: { name: 'Shallow water', color: '#4f8fc0', dark: '#4380b0', water: true, blocks: true },
  h: { name: 'Deep shade', color: '#355a3a', dark: '#2c4d31' },
  x: { name: 'Magical ground', color: '#6a5aa0', dark: '#5a4b8e' },
  p: { name: 'Path', color: '#b09a6a', dark: '#9e895c' },
  u: { name: 'Thicket', color: '#1d3322', dark: '#132219', blocks: true },
  r: { name: 'River', color: '#3a78b0', dark: '#2f6a9e', water: true, blocks: true },
};
export const PAINTABLE_TERRAIN = ['g', 'm', 'd', 'l', 's', 'h'];
// plain glades (extra space) use this theme
export const GLADE_THEME = { ground: { g: 68, m: 22, l: 10 }, thicket: 0.45 };
export const TERRAIN_PAINT_COST = { leaves: 1 };

// clearing a thicket tile
export const THICKET_CLEAR = { twigs: 1, leaves: 1 };

export const AREA_W = 10;
export const AREA_H = 9;

// Stages are strictly linear (GDD 12.1, decision D-15).
// discover: how the area is found; objects: prefab structures (state ruin = to restore)
export const STAGES = [
  {
    id: 'clearing', name: 'Starting Clearing', discover: { type: 'start' },
    blurb: 'A small sunny clearing — home.',
    map: [
      'ggggllgggg',
      'gmmgglgggg',
      'gmgggggllg',
      'ggggpggglg',
      'gggppppggg',
      'gggpggpggg',
      'llgpggpgmm',
      'lggggggggm',
      'gggllgggmm',
    ],
    objects: [
      { def: 'garden_bed', x: 1, y: 3, state: 'built' },
      { def: 'garden_bed', x: 2, y: 5, state: 'built' },
      { def: 'wild_thicket', x: 8, y: 2, state: 'built' },
      { def: 'breeding_nook', x: 5, y: 1, state: 'built' },
      { def: 'trading_stump', x: 7, y: 6, state: 'built' },
    ],
  },
  {
    id: 'fungal', name: 'First Fungal Patch', discover: { type: 'jobCycles', jobs: ['forager'], count: 15 },
    blurb: 'Foraging in the leaf litter uncovered a damp fallen log, crowded with tiny fungi.',
    hint: 'Forage in the clearing to find what lies under the leaves (15 forage cycles).',
    theme: { ground: { d: 45, m: 30, h: 15, l: 10 }, thicket: 0.5 },
    objects: [{ def: 'spore_bed', x: 4, y: 3, state: 'ruin' }],
  },
  {
    id: 'workshop', name: 'Woodland Workshop', discover: { type: 'jobCycles', jobs: ['mycologist'], count: 15 },
    blurb: 'Your Mycologists decomposed the log blocking the path. Beyond it: an old woodland workshop.',
    hint: 'Mycologists slowly decompose the log blocking the path (15 Mycologist cycles).',
    theme: { ground: { g: 45, l: 35, s: 12, m: 8 }, thicket: 0.45 },
    objects: [
      { def: 'workbench', x: 3, y: 3, state: 'ruin' },
      { def: 'building_site', x: 6, y: 4, state: 'ruin' },
    ],
  },
  {
    id: 'pond', name: 'Pond and Creek', discover: { type: 'project', project: 'creek_path' },
    blurb: 'The creek path is repaired. Reeds sway beside a quiet pond.',
    hint: 'Builders must repair the Creek Path (start the project from the Workshop).',
    theme: { ground: { g: 45, m: 40, l: 15 }, lakes: 2, thicket: 0.4 },
    objects: [
      { def: 'dew_reeds', x: 1, y: 3, state: 'ruin' },
      { def: 'water_barrel', x: 7, y: 5, state: 'ruin' },
      { def: 'reed_nest', x: 2, y: 6, state: 'ruin' },
    ],
  },
  {
    id: 'roothollow', name: 'Root Hollow', discover: { type: 'jobCycles', jobs: ['dew_collector', 'waterer', 'nest_tender'], count: 20 },
    blurb: 'As the creek water receded, an old root bank opened into a hollow beneath the trees.',
    hint: 'Work at the pond until the water recedes from the root bank (20 pond job cycles).',
    theme: { ground: { d: 50, h: 32, s: 18 }, thicket: 0.6 },
    objects: [
      { def: 'dig_site', x: 3, y: 4, state: 'ruin' },
      { def: 'lookout_stump', x: 6, y: 2, state: 'ruin' },
    ],
  },
  {
    id: 'landmark', name: 'Enchanted Landmark', discover: { type: 'jobCycles', jobs: ['night_watcher'], count: 10 },
    blurb: 'Glow traces led your Night Watchers to an overgrown shrine in a moonlit grove.',
    hint: 'Night Watchers follow glow traces at dusk and night (10 Night Watcher cycles).',
    theme: { ground: { x: 45, m: 35, h: 20 }, thicket: 0.5 },
    objects: [
      { def: 'shrine', x: 4, y: 3, state: 'ruin' },
      { def: 'moonlit_grove', x: 2, y: 6, state: 'ruin' },
    ],
  },
  {
    id: 'community', name: 'Community Clearing', discover: { type: 'jobCycles', jobs: ['spirit_keeper'], count: 15 },
    blurb: "The Spirit Keeper's visitors revealed a hidden gathering place.",
    hint: 'Spirit Keepers attract visitors who know the way (15 Spirit Keeper cycles).',
    theme: { ground: { g: 70, m: 20, l: 10 }, thicket: 0.35 },
    objects: [
      { def: 'gathering_circle', x: 4, y: 3, state: 'ruin' },
      { def: 'gift_table', x: 7, y: 6, state: 'ruin' },
    ],
  },
];
export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
export const STAGE_IDS = STAGES.map((s) => s.id);
