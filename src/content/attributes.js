// Ordinary attribute definitions (GDD Section 7.3). Data only.
// statContributions must sum to the category budget (+rareTierBudgetBonus for Rare).

export const CATEGORIES = ['cap', 'stem', 'markings', 'gills', 'glow'];

export const CATEGORY_NAMES = {
  cap: 'Cap shape', stem: 'Stem', markings: 'Markings', gills: 'Gills / underside', glow: 'Ordinary glow',
};

const A = (id, category, name, tier, stats, neighbours, hint) => ({
  id, category, name, tier, stats, neighbours, hint,
});

export const ATTRIBUTES = [
  // Cap shape (18; Rare 20)
  A('roundcap', 'cap', 'Roundcap', 'basic', { CUL: 5, MYC: 3, CON: 10 }, ['bellcap', 'flatcap', 'shelfcap', 'lumpcap', 'tiltcap'], 'A starter shape.'),
  A('flatcap', 'cap', 'Flatcap', 'basic', { FOR: 8, CON: 4, SOC: 6 }, ['roundcap', 'wavycap', 'shelfcap', 'tiltcap'], 'A starter shape.'),
  A('bellcap', 'cap', 'Bellcap', 'basic', { CUL: 8, MAG: 4, ANI: 6 }, ['roundcap', 'conecap', 'frillcap', 'tuftcap', 'inkcap'], 'A starter shape.'),
  A('wavycap', 'cap', 'Wavycap', 'basic', { MYC: 8, FOR: 4, DIS: 6 }, ['flatcap', 'clustercap', 'frillcap', 'lumpcap'], 'A starter shape.'),
  A('conecap', 'cap', 'Conecap', 'basic', { MYC: 4, MAG: 8, DIS: 6 }, ['bellcap', 'clustercap', 'spirecap', 'tuftcap', 'inkcap'], 'A starter shape.'),
  A('clustercap', 'cap', 'Clustercap', 'basic', { CUL: 4, MYC: 6, SOC: 8 }, ['wavycap', 'conecap', 'lanterncap', 'tuftcap', 'lumpcap'], 'A starter shape.'),
  A('shelfcap', 'cap', 'Shelfcap', 'uncommon', { FOR: 6, CON: 8, ANI: 4 }, ['roundcap', 'flatcap'], 'Varies from Roundcap or Flatcap lines; visits near fallen logs.'),
  A('frillcap', 'cap', 'Frillcap', 'uncommon', { CUL: 6, ANI: 4, SOC: 8 }, ['bellcap', 'wavycap', 'tiltcap'], 'Varies from Bellcap or Wavycap lines; visits flower-rich glades.'),
  A('lanterncap', 'cap', 'Lanterncap', 'rare', { MAG: 11, ANI: 3, SOC: 6 }, ['clustercap', 'frillcap'], 'A rare variation once a rare habitat is known.'),
  A('spirecap', 'cap', 'Spirecap', 'rare', { MAG: 9, DIS: 11 }, ['conecap', 'shelfcap', 'inkcap'], 'A rare variation once a rare habitat is known.'),
  // distinct growth forms, each leaning hard into one kind of work
  A('tuftcap', 'cap', 'Tuftcap', 'uncommon', { FOR: 10, MAG: 8 }, ['clustercap', 'bellcap', 'conecap'], 'A tuft of little glassy bells. Visits near water.'),
  A('lumpcap', 'cap', 'Lumpcap', 'uncommon', { MYC: 12, CUL: 6 }, ['roundcap', 'wavycap', 'clustercap'], 'A low, lumpy crust that hides its stem. Visits damp soil and fallen logs.'),
  A('tiltcap', 'cap', 'Tippedcap', 'uncommon', { ANI: 10, SOC: 8 }, ['roundcap', 'flatcap', 'frillcap'], 'A wide cap worn at a jaunty angle. Visits flower-rich glades.'),
  A('inkcap', 'cap', 'Shaggy Inkcap', 'rare', { DIS: 12, MAG: 8 }, ['conecap', 'spirecap', 'bellcap'], 'A tall shaggy bullet that weeps ink. A rare variation once a rare habitat is known.'),

  // Stem (12; Rare 14)
  A('sturdy', 'stem', 'Sturdy', 'basic', { CUL: 2, FOR: 4, CON: 6 }, ['bulbous', 'ringed', 'stubby'], 'A starter stem.'),
  A('slender', 'stem', 'Slender', 'basic', { FOR: 6, MAG: 2, DIS: 4 }, ['rooted', 'twisted', 'lanky'], 'A starter stem.'),
  A('bulbous', 'stem', 'Bulbous', 'basic', { CUL: 2, MYC: 6, ANI: 4 }, ['sturdy', 'ringed', 'stubby', 'warty'], 'A starter stem.'),
  A('rooted', 'stem', 'Rooted', 'basic', { CUL: 4, MYC: 2, DIS: 6 }, ['slender', 'twisted', 'lanky'], 'A starter stem.'),
  A('ringed', 'stem', 'Ringed', 'uncommon', { CON: 2, ANI: 4, SOC: 6 }, ['sturdy', 'bulbous', 'crystal', 'warty'], 'Visits mossy ground.'),
  A('twisted', 'stem', 'Twisted', 'uncommon', { MAG: 6, DIS: 2, SOC: 4 }, ['slender', 'rooted', 'crystal'], 'Visits deep shade.'),
  A('crystal', 'stem', 'Crystal-veined', 'rare', { CON: 6, MAG: 8 }, ['ringed', 'twisted'], 'A rare variation once a rare habitat is known.'),
  A('lanky', 'stem', 'Lanky', 'basic', { DIS: 6, FOR: 4, MAG: 2 }, ['slender', 'rooted'], 'A starter stem: long and thin.'),
  A('stubby', 'stem', 'Stubby', 'basic', { MYC: 6, CUL: 4, CON: 2 }, ['sturdy', 'bulbous', 'warty'], 'A starter stem: short and thick.'),
  A('warty', 'stem', 'Warty', 'uncommon', { ANI: 7, SOC: 5 }, ['bulbous', 'ringed', 'stubby'], 'A fat stem studded with bright warts. Visits flower-rich glades.'),

  // Markings (10; Rare 12)
  A('plain', 'markings', 'Plain', 'basic', { CUL: 4, FOR: 3, CON: 3 }, ['spots', 'stripes', 'gloss'], 'A starter marking.'),
  A('spots', 'markings', 'Spots', 'basic', { FOR: 2, ANI: 5, SOC: 3 }, ['plain', 'speckles', 'patches', 'beads'], 'A starter marking.'),
  A('stripes', 'markings', 'Stripes', 'basic', { FOR: 2, CON: 5, DIS: 3 }, ['plain', 'rings', 'shaggy'], 'A starter marking.'),
  A('speckles', 'markings', 'Speckles', 'basic', { CUL: 2, MYC: 5, DIS: 3 }, ['spots', 'rings', 'beads', 'gloss'], 'A starter marking.'),
  A('rings', 'markings', 'Rings', 'uncommon', { MYC: 3, MAG: 5, SOC: 2 }, ['stripes', 'speckles', 'constellation', 'shaggy'], 'Visits near water.'),
  A('patches', 'markings', 'Patches', 'uncommon', { CUL: 3, ANI: 2, SOC: 5 }, ['spots', 'constellation'], 'Visits leafy ground.'),
  A('constellation', 'markings', 'Constellation', 'rare', { MAG: 7, DIS: 5 }, ['rings', 'patches'], 'A rare variation once a rare habitat is known.'),
  A('beads', 'markings', 'Beads', 'uncommon', { MYC: 6, CUL: 4 }, ['spots', 'speckles'], 'Glossy droplets in its second colour. Visits damp soil.'),
  A('shaggy', 'markings', 'Shaggy scales', 'uncommon', { DIS: 6, CON: 4 }, ['stripes', 'rings'], 'Rows of ragged scales. Visits deep shade.'),
  A('gloss', 'markings', 'Glassy sheen', 'uncommon', { FOR: 5, MAG: 5 }, ['plain', 'speckles'], 'A wet, glassy shine tinted by its second colour. Visits near water.'),

  // Gills (8; Rare 10)
  A('fine', 'gills', 'Fine gills', 'basic', { CUL: 2, MYC: 4, ANI: 2 }, ['deep', 'ridged'], 'A starter underside.'),
  A('deep', 'gills', 'Deep gills', 'basic', { MYC: 5, DIS: 3 }, ['fine', 'toothed', 'inky'], 'A starter underside.'),
  A('pored', 'gills', 'Pored', 'basic', { FOR: 4, CON: 4 }, ['ridged', 'toothed'], 'A starter underside.'),
  A('ridged', 'gills', 'Ridged', 'uncommon', { CON: 4, MAG: 2, DIS: 2 }, ['fine', 'pored', 'velvet'], 'Visits stony ground.'),
  A('toothed', 'gills', 'Toothed', 'uncommon', { FOR: 2, DIS: 4, SOC: 2 }, ['deep', 'pored', 'velvet', 'inky'], 'Visits damp soil.'),
  A('velvet', 'gills', 'Velvet', 'rare', { ANI: 5, SOC: 5 }, ['ridged', 'toothed'], 'A rare variation once a rare habitat is known.'),
  A('inky', 'gills', 'Inky drips', 'uncommon', { DIS: 4, MAG: 4 }, ['deep', 'toothed'], 'An underside that drips ink. Visits deep shade.'),

  // Ordinary glow (6; Rare 8)
  A('none', 'glow', 'No glow', 'basic', { CUL: 2, FOR: 2, CON: 2 }, ['faint'], 'A starter glow.'),
  A('faint', 'glow', 'Faint', 'basic', { MAG: 3, SOC: 3 }, ['none', 'soft', 'pulse'], 'A starter glow.'),
  A('soft', 'glow', 'Soft', 'uncommon', { MAG: 4, ANI: 2 }, ['faint', 'radiant'], 'Visits at night near water.'),
  A('pulse', 'glow', 'Pulse', 'uncommon', { MAG: 2, DIS: 4 }, ['faint', 'radiant'], 'Visits deep shade.'),
  A('radiant', 'glow', 'Radiant', 'rare', { MAG: 8 }, ['soft', 'pulse'], 'A rare variation once a rare habitat is known.'),
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
