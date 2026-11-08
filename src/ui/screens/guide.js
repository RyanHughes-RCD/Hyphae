// Field Guide (GDD 16).
import * as G from '../../core/game.js';
import { STATS, STAT_NAMES, getConfig, COLOR_GROUPS } from '../../config.js';
import { ATTRIBUTES, CATEGORIES, CATEGORY_NAMES, COLOR_FAMILIES, TEMPERAMENTS } from '../../content/attributes.js';
import { PERKS, MUTATIONS, TRAIT_NAMES } from '../../content/genetics.js';
import { JOBS, STAGES, STRUCTURES } from '../../content/world.js';
import { colorGroupPoints, colorContribution, colorFamily } from '../../core/stats.js';
import { hex } from '../../core/color.js';
import { h, section, statText, resName } from '../common.js';

const TABS = [
  ['attributes', 'Attributes'], ['colour', 'Colour'], ['traits', 'Traits'], ['perks', 'Perks'], ['mutations', 'Mutations'],
  ['jobs', 'Jobs'], ['milestones', 'Milestones'], ['areas', 'Areas'],
];

export function renderGuide(app) {
  const tab = app.ui.guideTab;
  const body = {
    attributes: attributesTab, colour: colourTab, traits: traitsTab, perks: perksTab, mutations: mutationsTab,
    jobs: jobsTab, milestones: milestonesTab, areas: areasTab,
  }[tab] || attributesTab;
  return h('div', {},
    h('h2', { class: 'screen-title' }, 'Field Guide'),
    h('div', { class: 'tabs scroll-x' }, TABS.map(([id, label]) => h('button', { type: 'button', class: 'tab' + (tab === id ? ' active' : ''), onclick: () => { app.ui.guideTab = id; app.render(); } }, label))),
    body(app));
}

function attributesTab(app) {
  const d = app.state.discoveries.attributes;
  const total = ATTRIBUTES.length;
  const found = ATTRIBUTES.filter((a) => d[a.id]).length;
  return h('div', {},
    h('p', {}, `Every ordinary attribute always adds the same stats. Each category has a fixed budget (cap 18, stem 12, markings 10, gills 8, glow 6); Rare attributes get +${getConfig().stats.rareTierBudgetBonus}. Discovered ${found}/${total}.`),
    CATEGORIES.map((cat) => section(CATEGORY_NAMES[cat], ATTRIBUTES.filter((a) => a.category === cat).map((a) => h('div', { class: 'attr-row' + (d[a.id] ? '' : ' unknown') },
      h('span', { class: 'attr-name' }, d[a.id] ? a.name : '???', ' ', h('span', { class: `tier tier-${a.tier}` }, a.tier)),
      h('span', { class: 'small' }, d[a.id] ? statText(a.stats) : a.hint))))));
}

function colourTab(app) {
  const st = { rgb: app.ui.rgb || [255, 255, 0] };
  const out = h('div', { class: 'colour-demo' });
  const draw = () => {
    const [rp, gp, bp] = colorGroupPoints(st.rgb);
    const alloc = { red: { t: 'lean', o: COLOR_GROUPS.red }, green: { t: 'lean', o: COLOR_GROUPS.green }, blue: { t: 'lean', o: COLOR_GROUPS.blue } };
    const c = colorContribution(st.rgb, alloc);
    out.replaceChildren(
      h('div', { class: 'row gap' }, h('span', { class: 'swatch big', style: { background: hex(st.rgb) } }), h('b', {}, colorFamily(st.rgb).name)),
      h('p', {}, `Red group ${rp} · Green group ${gp} · Blue group ${bp}  (always 12)`),
      h('p', { class: 'small' }, 'With a "Lean" allocation in stat order: ', statText(c)));
  };
  const sliders = ['R', 'G', 'B'].map((label, i) => h('label', { class: 'slider' }, label, h('input', {
    type: 'range', min: 0, max: 255, value: st.rgb[i], oninput: (e) => { st.rgb[i] = Number(e.target.value); app.ui.rgb = st.rgb; draw(); },
  })));
  draw();
  const fams = app.state.discoveries.colorFamilies;
  return h('div', {},
    section('How colour works',
      h('p', {}, 'A mushroom\'s cap colour always contributes exactly 12 stat points, no matter how bright or dark it is.'),
      h('ul', {},
        h('li', {}, 'Red share → Cultivation, Mycology, Foraging'),
        h('li', {}, 'Green share → Construction, Magic, Animal Care'),
        h('li', {}, 'Blue share → Local Discovery, Social Craft')),
      h('p', {}, 'The RGB values are divided by their total to split the 12 points (yellow = 6/6/0, white = 4/4/4, pure red = 12/0/0). A hidden colour-allocation gene then decides how each group\'s points spread: Focus (all to one stat), Lean (2:1) or Even. It never changes once a mushroom is born.')),
    section('Try it', sliders, out),
    section(`Colour families discovered (${Object.keys(fams).length}/${COLOR_FAMILIES.length})`, h('div', { class: 'swatches' }, COLOR_FAMILIES.map((f) => h('span', { class: 'fam' + (fams[f.id] ? '' : ' unknown'), title: fams[f.id] ? f.name : '???' }, h('span', { class: 'swatch', style: { background: fams[f.id] ? hex(f.rgb) : '#333' } }), fams[f.id] ? f.name : '???')))));
}

function traitsTab(app) {
  const s = app.state;
  const d = s.discoveries.traitStats;
  const cfg = getConfig().traits;
  return h('div', {},
    section('Advanced Traits', h('p', {}, `Permanent genetic bonuses: each gives +${cfg.advancedTraitBonus} to one job stat. A breeding can create at most one new trait (${Math.round(cfg.newAdvancedTraitChance * 100)}% chance, on a random stat with room under the 100 cap). Each parent's trait is passed on ${Math.round(cfg.traitInheritChanceSingle * 100)}% of the time — ${Math.round(cfg.traitInheritChanceShared * 100)}% if both parents carry it. Up to ${cfg.maxAdvancedTraits} per mushroom.`),
      h('p', { class: s.unlocks.traits ? 'small ok' : 'small warn' }, s.unlocks.traits ? 'Unlocked.' : 'Unlocks after your second completed breeding.')),
    section('Discovered', STATS.map((k) => h('div', { class: 'attr-row' + (d[k] ? '' : ' unknown') }, h('span', {}, d[k] ? TRAIT_NAMES[k] : '???'), h('span', { class: 'small' }, `+4 ${STAT_NAMES[k]}`)))));
}

function perksTab(app) {
  const s = app.state;
  const d = s.discoveries.perks;
  return h('div', {},
    section('Perks', h('p', {}, 'Conditional bonuses and special behaviours (max 3 per mushroom). Matching Perks from both parents combine: equal levels usually rise by one; "slow" Perks rise only sometimes. Perks never change stats.'),
      h('p', { class: s.unlocks.perks ? 'small ok' : 'small warn' }, s.unlocks.perks ? 'Unlocked.' : 'Unlocks when you upgrade the Breeding Nook to the Spore Cradle.')),
    section(`Collection (${Object.keys(d).length}/${PERKS.length})`, PERKS.map((p) => h('div', { class: 'attr-row' + (d[p.id] ? '' : ' unknown') },
      h('span', {}, d[p.id] ? h('b', {}, p.name) : '???', d[p.id] ? ` (best level ${d[p.id]}/${p.levels.length})` : ''),
      h('span', { class: 'small' }, d[p.id] ? `${p.desc} ${p.levels.map((v) => Math.round(v * 100) + '%').join(' / ')} · ${p.rule}` : 'Undiscovered')))));
}

function mutationsTab(app) {
  const s = app.state;
  const d = s.discoveries.mutations;
  return h('div', {},
    section('Mutations', h('p', {}, `Extremely rare (${(getConfig().mutations.spontaneousMutationChance * 100).toFixed(2)}% per breeding) transformations with a striking look and a strong bonus. Only one per mushroom; mutated parents can pass theirs on.`),
      h('p', { class: s.unlocks.mutations ? 'small ok' : 'small warn' }, s.unlocks.mutations ? 'Unlocked.' : 'Unlocks when you discover a rare habitat, or own a Generation 5 mushroom.')),
    section(`Collection (${Object.keys(d).length}/${MUTATIONS.length})`, MUTATIONS.map((m) => h('div', { class: 'attr-row' + (d[m.id] ? '' : ' unknown') },
      h('span', {}, d[m.id] ? h('b', {}, '✦ ' + m.name) : '✦ ???'),
      h('span', { class: 'small' }, d[m.id] ? `${m.desc} ${m.bonus ? statText(m.bonus) : '+5 to four weakest stats'}` : 'A mysterious shimmer…')))));
}

function jobsTab(app) {
  const s = app.state;
  return h('div', {},
    section('How jobs work', h('p', {}, 'Job score = 70% primary stat + 30% secondary stat. Effectiveness rises in a straight line from 0.5× (score 0) to 2.0× (score 100). Perks, temperament, Mutations and synergies add productivity, capped at +60%.'),
      h('p', { class: 'small' }, 'Synergy: a working Waterer makes Gardeners 15% more productive.')),
    JOBS.map((j) => section(`${j.name}${G.jobUnlocked(s, j.id) ? '' : ' 🔒'}`, h('p', { class: 'small' }, j.desc),
      h('p', { class: 'small' }, `${STAT_NAMES[j.primary]} / ${STAT_NAMES[j.secondary]} · ${j.duration}s cycle · ${STRUCTURES[j.structure].name}`),
      h('p', { class: 'small' }, 'Outputs: ', Object.entries(j.outputs).map(([r, n]) => `${n} ${resName(r)}`).join(', ') || 'project work'))),
    section('Temperaments', TEMPERAMENTS.map((t) => h('div', { class: 'attr-row' }, h('b', {}, t.name), h('span', { class: 'small' }, t.desc)))));
}

function milestonesTab(app) {
  const s = app.state;
  const maxGen = Math.max(...s.mushrooms.map((m) => m.generation));
  const items = [
    ['First breeding', s.breedingsCompleted >= 1, 'Learn how attributes mix.'],
    ['Advanced Traits', s.unlocks.traits, 'Complete 2 breedings.'],
    ['Perks', s.unlocks.perks, 'Upgrade to the Spore Cradle (needs the Woodland Workshop).'],
    ['Mutations', s.unlocks.mutations, 'Discover the Moonstone Ring, or own a Generation 5 mushroom.'],
    ['Generation 5', maxGen >= 5, `Highest generation: ${maxGen}`],
    ['Generation 10', maxGen >= 10, ''],
    ['Rare habitat', s.discoveries.moonstone, 'Excavators and Night Watchers search the Root Hollow.'],
  ];
  return section('Breeding milestones', items.map(([t, done, hint]) => h('div', { class: 'attr-row' }, h('span', {}, done ? '✅ ' : '⬜ ', t), h('span', { class: 'small' }, hint))),
    h('p', { class: 'small' }, `Breedings completed: ${s.breedingsCompleted}`));
}

function areasTab(app) {
  const s = app.state;
  return h('div', {}, STAGES.map((st, i) => {
    const disc = G.stageDiscovered(s, st.id);
    return section(`${i + 1}. ${disc ? st.name : '???'}`, h('p', { class: 'small' }, disc ? st.blurb : st.hint || 'Undiscovered.'),
      disc ? h('p', { class: 'small' }, G.stageComplete(s, st.id) ? 'Fully restored.' : 'Has structures to restore.') : null);
  }), section('Habitats', h('p', { class: 'small' }, 'Decorations and terrain shape your habitats: flowers, shade, stone, logs, water, moss, damp soil and glow each attract Wild Visitors with matching Uncommon attributes.'),
    h('p', { class: 'small' }, 'Current habitat scores: ', Object.entries(G.habitatCounts(s)).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ') || 'none')));
}
