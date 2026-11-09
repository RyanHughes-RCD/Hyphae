// Ordinary attribute definitions (GDD Section 7.3). Data only.
// statContributions must sum to the category budget (+rareTierBudgetBonus for Rare).
// Each attribute feeds one or two stats, so mushrooms come out spiky specialists.

export const CATEGORIES = ['cap', 'stem', 'markings', 'gills', 'glow'];

export const CATEGORY_NAMES = {
  cap: 'Cap shape', stem: 'Stem', markings: 'Markings', gills: 'Gills / underside', glow: 'Ordinary glow',
};

const A = (id, category, name, tier, stats, neighbours, hint) => ({
  id, category, name, tier, stats, neighbours, hint,
});

export const ATTRIBUTES = [
  // Cap shape (27; Rare 30)
  A('roundcap', 'cap', 'Roundcap', 'basic', { CON: 18, CUL: 9 }, ['bellcap', 'flatcap', 'shelfcap', 'lumpcap', 'tiltcap'], 'A starter shape.'),
  A('flatcap', 'cap', 'Flatcap', 'basic', { FOR: 15, SOC: 12 }, ['roundcap', 'wavycap', 'shelfcap', 'tiltcap'], 'A starter shape.'),
  A('bellcap', 'cap', 'Bellcap', 'basic', { CUL: 15, ANI: 12 }, ['roundcap', 'conecap', 'frillcap', 'tuftcap', 'inkcap'], 'A starter shape.'),
  A('wavycap', 'cap', 'Wavycap', 'basic', { MYC: 15, DIS: 12 }, ['flatcap', 'clustercap', 'frillcap', 'lumpcap'], 'A starter shape.'),
  A('conecap', 'cap', 'Conecap', 'basic', { MAG: 15, DIS: 12 }, ['bellcap', 'clustercap', 'spirecap', 'tuftcap', 'inkcap'], 'A starter shape.'),
  A('clustercap', 'cap', 'Clustercap', 'basic', { SOC: 15, MYC: 12 }, ['wavycap', 'conecap', 'lanterncap', 'tuftcap', 'lumpcap'], 'A starter shape.'),
  A('shelfcap', 'cap', 'Shelfcap', 'uncommon', { CON: 15, FOR: 12 }, ['roundcap', 'flatcap'], 'Varies from Roundcap or Flatcap lines; visits near fallen logs.'),
  A('frillcap', 'cap', 'Frillcap', 'uncommon', { SOC: 15, CUL: 12 }, ['bellcap', 'wavycap', 'tiltcap'], 'Varies from Bellcap or Wavycap lines; visits flower-rich glades.'),
  A('lanterncap', 'cap', 'Lanterncap', 'rare', { MAG: 21, SOC: 9 }, ['clustercap', 'frillcap'], 'A rare variation once a rare habitat is known.'),
  A('spirecap', 'cap', 'Spirecap', 'rare', { MAG: 18, DIS: 12 }, ['conecap', 'shelfcap', 'inkcap'], 'A rare variation once a rare habitat is known.'),
  // distinct growth forms, each leaning hard into one kind of work
  A('tuftcap', 'cap', 'Tuftcap', 'uncommon', { FOR: 15, MAG: 12 }, ['clustercap', 'bellcap', 'conecap'], 'A tuft of little glassy bells. Visits near water.'),
  A('lumpcap', 'cap', 'Lumpcap', 'uncommon', { MYC: 18, CUL: 9 }, ['roundcap', 'wavycap', 'clustercap'], 'A low, lumpy crust that hides its stem. Visits damp soil and fallen logs.'),
  A('tiltcap', 'cap', 'Tippedcap', 'uncommon', { ANI: 15, SOC: 12 }, ['roundcap', 'flatcap', 'frillcap'], 'A wide cap worn at a jaunty angle. Visits flower-rich glades.'),
  A('inkcap', 'cap', 'Shaggy Inkcap', 'rare', { DIS: 21, MAG: 9 }, ['conecap', 'spirecap', 'bellcap'], 'A tall shaggy bullet that weeps ink. A rare variation once a rare habitat is known.'),

  // Stem (18; Rare 21)
  A('sturdy', 'stem', 'Sturdy', 'basic', { CON: 12, FOR: 6 }, ['bulbous', 'ringed', 'stubby'], 'A starter stem.'),
  A('slender', 'stem', 'Slender', 'basic', { FOR: 12, DIS: 6 }, ['rooted', 'twisted', 'lanky'], 'A starter stem.'),
  A('bulbous', 'stem', 'Bulbous', 'basic', { MYC: 12, ANI: 6 }, ['sturdy', 'ringed', 'stubby', 'warty'], 'A starter stem.'),
  A('rooted', 'stem', 'Rooted', 'basic', { DIS: 12, CUL: 6 }, ['slender', 'twisted', 'lanky'], 'A starter stem.'),
  A('ringed', 'stem', 'Ringed', 'uncommon', { SOC: 12, ANI: 6 }, ['sturdy', 'bulbous', 'crystal', 'warty'], 'Visits mossy ground.'),
  A('twisted', 'stem', 'Twisted', 'uncommon', { MAG: 12, SOC: 6 }, ['slender', 'rooted', 'crystal'], 'Visits deep shade.'),
  A('crystal', 'stem', 'Crystal-veined', 'rare', { MAG: 12, CON: 9 }, ['ringed', 'twisted'], 'A rare variation once a rare habitat is known.'),
  A('lanky', 'stem', 'Lanky', 'basic', { DIS: 18 }, ['slender', 'rooted'], 'A starter stem: long and thin.'),
  A('stubby', 'stem', 'Stubby', 'basic', { MYC: 12, CUL: 6 }, ['sturdy', 'bulbous', 'warty'], 'A starter stem: short and thick.'),
  A('warty', 'stem', 'Warty', 'uncommon', { ANI: 12, SOC: 6 }, ['bulbous', 'ringed', 'stubby'], 'A fat stem studded with bright warts. Visits flower-rich glades.'),

  // Markings (15; Rare 18)
  A('plain', 'markings', 'Plain', 'basic', { CUL: 9, CON: 6 }, ['spots', 'stripes', 'gloss'], 'A starter marking.'),
  A('spots', 'markings', 'Spots', 'basic', { ANI: 15 }, ['plain', 'speckles', 'patches', 'beads'], 'A starter marking.'),
  A('stripes', 'markings', 'Stripes', 'basic', { CON: 9, DIS: 6 }, ['plain', 'rings', 'shaggy'], 'A starter marking.'),
  A('speckles', 'markings', 'Speckles', 'basic', { MYC: 15 }, ['spots', 'rings', 'beads', 'gloss'], 'A starter marking.'),
  A('rings', 'markings', 'Rings', 'uncommon', { MAG: 9, MYC: 6 }, ['stripes', 'speckles', 'constellation', 'shaggy'], 'Visits near water.'),
  A('patches', 'markings', 'Patches', 'uncommon', { SOC: 9, CUL: 6 }, ['spots', 'constellation'], 'Visits leafy ground.'),
  A('constellation', 'markings', 'Constellation', 'rare', { MAG: 12, DIS: 6 }, ['rings', 'patches'], 'A rare variation once a rare habitat is known.'),
  A('beads', 'markings', 'Beads', 'uncommon', { MYC: 9, CUL: 6 }, ['spots', 'speckles'], 'Glossy droplets in its second colour. Visits damp soil.'),
  A('shaggy', 'markings', 'Shaggy scales', 'uncommon', { DIS: 15 }, ['stripes', 'rings'], 'Rows of ragged scales. Visits deep shade.'),
  A('gloss', 'markings', 'Glassy sheen', 'uncommon', { FOR: 9, MAG: 6 }, ['plain', 'speckles'], 'A wet, glassy shine tinted by its second colour. Visits near water.'),

  // Gills (12; Rare 15)
  A('fine', 'gills', 'Fine gills', 'basic', { MYC: 8, CUL: 4 }, ['deep', 'ridged'], 'A starter underside.'),
  A('deep', 'gills', 'Deep gills', 'basic', { MYC: 12 }, ['fine', 'toothed', 'inky'], 'A starter underside.'),
  A('pored', 'gills', 'Pored', 'basic', { FOR: 6, CON: 6 }, ['ridged', 'toothed'], 'A starter underside.'),
  A('ridged', 'gills', 'Ridged', 'uncommon', { CON: 12 }, ['fine', 'pored', 'velvet'], 'Visits stony ground.'),
  A('toothed', 'gills', 'Toothed', 'uncommon', { DIS: 8, FOR: 4 }, ['deep', 'pored', 'velvet', 'inky'], 'Visits damp soil.'),
  A('velvet', 'gills', 'Velvet', 'rare', { ANI: 9, SOC: 6 }, ['ridged', 'toothed'], 'A rare variation once a rare habitat is known.'),
  A('inky', 'gills', 'Inky drips', 'uncommon', { DIS: 6, MAG: 6 }, ['deep', 'toothed'], 'An underside that drips ink. Visits deep shade.'),

  // Ordinary glow (9; Rare 12)
  A('none', 'glow', 'No glow', 'basic', { CUL: 5, FOR: 4 }, ['faint'], 'A starter glow.'),
  A('faint', 'glow', 'Faint', 'basic', { SOC: 5, MAG: 4 }, ['none', 'soft', 'pulse'], 'A starter glow.'),
  A('soft', 'glow', 'Soft', 'uncommon', { MAG: 6, ANI: 3 }, ['faint', 'radiant'], 'Visits at night near water.'),
  A('pulse', 'glow', 'Pulse', 'uncommon', { DIS: 9 }, ['faint', 'radiant'], 'Visits deep shade.'),
  A('radiant', 'glow', 'Radiant', 'rare', { MAG: 12 }, ['soft', 'pulse'], 'A rare variation once a rare habitat is known.'),
];

export const ATTRIBUTE_BY_ID = Object.fromEntries(ATTRIBUTES.map((a) => [a.id, a]));

export function attributesIn(category, tiers = ['basic', 'uncommon', 'rare']) {
  return ATTRIBUTES.filter((a) => a.category === category && tiers.includes(a.tier));
}

// Colour-allocation templates (GDD 7.4.3)
export const ALLOC_TEMPLATES = {
  focus: { 3: [1, 0, 0], 2: [1, 0] },
  lean: { 3: [2, 1, 0], 2: [2, 1] },
  even: { 3: [1, 1, 1], 2: [1, 1] },
};
export const ALLOC_TEMPLATE_IDS = ['focus', 'lean', 'even'];

// Basic starter palette (GDD 7.4.5)
export const STARTER_PALETTE = [
  { name: 'Brick Red', rgb: [178, 54, 40] },
  { name: 'Amber', rgb: [230, 150, 40] },
  { name: 'Butter Yellow', rgb: [236, 206, 92] },
  { name: 'Chestnut', rgb: [140, 82, 50] },
  { name: 'Cream', rgb: [238, 222, 190] },
  { name: 'Moss', rgb: [104, 150, 62] },
  { name: 'Fern', rgb: [70, 158, 92] },
  { name: 'Sage', rgb: [120, 165, 120] },
  { name: 'Sky', rgb: [104, 168, 224] },
  { name: 'Slate Blue', rgb: [84, 104, 176] },
  { name: 'Plum', rgb: [124, 66, 140] },
  { name: 'Teal', rgb: [50, 140, 160] },
];

// Second colour: what patterns, warts, beads and sheen are painted in (cosmetic)
export const SECONDARY_PALETTE = [
  { name: 'Gold', rgb: [238, 196, 72] },
  { name: 'Bone White', rgb: [244, 236, 214] },
  { name: 'Scarlet', rgb: [208, 40, 52] },
  { name: 'Sky', rgb: [112, 192, 240] },
  { name: 'Lime', rgb: [172, 222, 82] },
  { name: 'Magenta', rgb: [222, 82, 172] },
  { name: 'Tangerine', rgb: [242, 142, 52] },
  { name: 'Violet', rgb: [152, 104, 222] },
  { name: 'Aqua', rgb: [72, 204, 192] },
  { name: 'Ink', rgb: [44, 36, 56] },
  { name: 'Blossom', rgb: [250, 172, 204] },
  { name: 'Lemon', rgb: [250, 236, 120] },
];

// Stem colours: drab, earthy shades (cosmetic)
export const STEM_PALETTE = [
  { name: 'Cream', rgb: [232, 220, 196] },
  { name: 'Bone', rgb: [214, 206, 186] },
  { name: 'Biscuit', rgb: [206, 184, 150] },
  { name: 'Tan', rgb: [186, 154, 118] },
  { name: 'Fawn', rgb: [172, 142, 122] },
  { name: 'Ash', rgb: [170, 166, 158] },
  { name: 'Dove', rgb: [152, 148, 154] },
  { name: 'Lichen', rgb: [178, 178, 142] },
  { name: 'Heather', rgb: [178, 162, 170] },
  { name: 'Umber', rgb: [132, 106, 86] },
  { name: 'Ochre', rgb: [196, 170, 112] },
  { name: 'Sage', rgb: [168, 180, 158] },
];

// Named colour families for the Field Guide collection (GDD 7.4.4)
export const COLOR_FAMILIES = [
  { id: 'crimson', name: 'Crimson', rgb: [190, 30, 45] },
  { id: 'brick', name: 'Brick', rgb: [170, 60, 40] },
  { id: 'coral', name: 'Coral', rgb: [240, 120, 100] },
  { id: 'rose', name: 'Rose', rgb: [230, 140, 170] },
  { id: 'amber', name: 'Amber', rgb: [230, 150, 40] },
  { id: 'chestnut', name: 'Chestnut', rgb: [130, 80, 50] },
  { id: 'butter', name: 'Butter', rgb: [236, 206, 92] },
  { id: 'gold', name: 'Gold', rgb: [210, 170, 30] },
  { id: 'cream', name: 'Cream', rgb: [238, 222, 190] },
  { id: 'lime', name: 'Lime', rgb: [170, 210, 60] },
  { id: 'moss', name: 'Moss', rgb: [104, 150, 62] },
  { id: 'fern', name: 'Fern', rgb: [70, 158, 92] },
  { id: 'sage', name: 'Sage', rgb: [130, 165, 125] },
  { id: 'forest', name: 'Forest', rgb: [40, 100, 50] },
  { id: 'teal', name: 'Teal', rgb: [50, 140, 160] },
  { id: 'sky', name: 'Sky', rgb: [110, 170, 225] },
  { id: 'slate', name: 'Slate Blue', rgb: [84, 104, 176] },
  { id: 'indigo', name: 'Indigo', rgb: [60, 50, 140] },
  { id: 'plum', name: 'Plum', rgb: [124, 66, 140] },
  { id: 'lilac', name: 'Lilac', rgb: [185, 150, 215] },
  { id: 'ghost', name: 'Ghost White', rgb: [245, 245, 250] },
  { id: 'ash', name: 'Ash Grey', rgb: [140, 140, 140] },
  { id: 'midnight', name: 'Midnight', rgb: [30, 30, 50] },
  { id: 'umber', name: 'Umber', rgb: [80, 55, 40] },
];

export const TEMPERAMENTS = [
  { id: 'industrious', name: 'Industrious', desc: 'Shorter work cycles.' },
  { id: 'curious', name: 'Curious', desc: 'Small chance of a bonus item while working.' },
  { id: 'sleepy', name: 'Sleepy', desc: 'Works a little slower but always well rested (+15% output).' },
  { id: 'social', name: 'Social', desc: 'Small bonus while other mushrooms are working.' },
  { id: 'greedy', name: 'Greedy', desc: 'More bonus finds, but weaker contribution to shared synergies.' },
  { id: 'mischievous', name: 'Mischievous', desc: 'More attribute variation in its offspring.' },
  { id: 'gentle', name: 'Gentle', desc: 'Small bonus on plant and animal work.' },
  { id: 'stubborn', name: 'Stubborn', desc: 'Bonus after holding the same job for 12 hours.' },
];
export const TEMPERAMENT_BY_ID = Object.fromEntries(TEMPERAMENTS.map((t) => [t.id, t]));

export const AFFINITY_NAMES = {
  CUL: 'Bloom', MYC: 'Spore', FOR: 'Verdant', CON: 'Hearth', MAG: 'Glow', ANI: 'Kin', DIS: 'Burrow', SOC: 'Shimmer',
};

export const NAME_PARTS = {
  start: ['Bram', 'Puff', 'Tum', 'Morel', 'Chan', 'Shi', 'Truf', 'Porc', 'Lich', 'Fen', 'Mos', 'Bur', 'Pip', 'Wisp', 'Dap', 'Hazel', 'Nim', 'Bel', 'Cor', 'Spri', 'Ol', 'Quill', 'Rus', 'Thim'],
  end: ['ble', 'kin', 'let', 'wick', 'bun', 'cap', 'sy', 'by', 'nut', 'ly', 'o', 'ella', 'wort', 'drop', 'fern', 'moss', 'pod', 'bell', 'twig', 'ie'],
};
