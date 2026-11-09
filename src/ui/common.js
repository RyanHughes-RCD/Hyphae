// Small DOM toolkit and shared UI components. All user/imported text is set as
// text nodes (never innerHTML), so imported names cannot inject markup.
import { STATS, STAT_NAMES, getConfig } from '../config.js';
import { RESOURCES } from '../content/world.js';
import { ATTRIBUTE_BY_ID, CATEGORY_NAMES, CATEGORIES, TEMPERAMENT_BY_ID, SECONDARY_PALETTE, STEM_PALETTE } from '../content/attributes.js';
import { PERK_BY_ID, MUTATION_BY_ID, TRAIT_NAMES } from '../content/genetics.js';
import { mushroomCanvas, resourceColor } from '../render/sprites.js';
import { affinity, rarityTier, colorFamily, colorGroupPoints, colorContribution, topStats } from '../core/stats.js';
import { statsOf } from '../core/game.js';
import { hiddenColor } from '../core/genetics.js';
import { hex } from '../core/color.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n)));

export function fmtDuration(ms) {
  if (ms <= 0) return 'ready';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function resIcon(id) {
  return h('span', { class: 'res-icon', style: { background: resourceColor(id) }, 'aria-hidden': 'true' });
}

export function resName(id) {
  return id === 'glimmer' ? 'Glimmer' : RESOURCES[id]?.name || id;
}

/** Cost chips; each chip red when unaffordable. */
export function costView(state, cost = {}) {
  const entries = Object.entries(cost);
  if (!entries.length) return h('span', { class: 'cost' }, 'Free');
  return h('span', { class: 'cost' }, entries.map(([r, n]) => {
    const have = r === 'glimmer' ? state.glimmer : state.inventory[r] || 0;
    return h('span', { class: 'chip' + (have >= n ? '' : ' short'), title: `${resName(r)}: have ${fmt(have)}` }, resIcon(r), `${n} ${resName(r)}`);
  }));
}

export function rarityBadge(m) {
  const t = rarityTier(m);
  return h('span', { class: `badge rarity-${t.id}` }, t.name);
}

export function mushroomThumb(app, m, scale = 2) {
  const mv = app.state.unlocks.mutations && m.mutation ? MUTATION_BY_ID[m.mutation.mutationId]?.visual : null;
  return mushroomCanvas(m, scale, { mutationVisual: mv, reducedMotion: true });
}

export function statusLabel(app, m) {
  if (m.status === 'guest') return `Guest from ${m.origin?.forestName || 'a friend'}`;
  if (m.status === 'wild') return 'Wild Visitor';
  if (m.status === 'archived') return 'Spore Archive';
  return m.work ? app.jobName(m.work.jobId) : 'Free time';
}

export function mushroomCard(app, m, opts = {}) {
  const st = statsOf(app.state, m);
  const aff = affinity(st.final);
  return h('button', { class: 'm-card' + (opts.selected ? ' selected' : '') + (opts.disabled ? ' disabled' : ''), type: 'button', onclick: opts.onclick || (() => app.openMushroom(m.uid)), title: opts.disabledReason || '' },
    mushroomThumb(app, m, 2),
    h('div', { class: 'm-card-body' },
      h('div', { class: 'm-name' }, m.name),
      h('div', { class: 'm-meta' }, `Gen ${m.generation} · ${aff.name}`),
      h('div', { class: 'm-meta' }, rarityBadge(m), m.mutation ? h('span', { class: 'badge mut' }, '✦') : null),
      opts.extra ? h('div', { class: 'm-meta' }, opts.extra) : h('div', { class: 'm-meta small' }, opts.disabledReason || statusLabel(app, m)),
    ));
}

/** Eight stat bars with stacked attribute / trait / mutation segments. */
export function statBars(app, m, opts = {}) {
  const st = statsOf(app.state, m);
  const cap = getConfig().stats.statCap;
  return h('div', { class: 'stat-bars' }, STATS.map((s) => {
    const b = st.base[s];
    const tr = st.traitBonus[s];
    const mu = st.mutationBonus[s];
    const total = Math.min(cap, b + tr + mu);
    const pct = (v) => `${(Math.max(0, v) / cap) * 100}%`;
    const bT = Math.min(b, cap);
    const tT = Math.min(tr, cap - bT);
    const mT = Math.max(0, total - bT - tT);
    const cmp = opts.compare ? opts.compare[s] : null;
    return h('div', { class: 'stat-row' },
      h('span', { class: 'stat-name' }, STAT_NAMES[s]),
      h('span', { class: 'stat-bar' },
        h('span', { class: 'seg base', style: { width: pct(bT) } }),
        h('span', { class: 'seg trait', style: { width: pct(tT) } }),
        h('span', { class: 'seg mut', style: { width: pct(mT) } })),
      h('span', { class: 'stat-val' }, String(st.final[s]),
        st.overflow[s] ? h('span', { class: 'overflow', title: 'Points above the 100 cap have no effect' }, ` (+${st.overflow[s]} capped)`) : null,
        cmp !== null && cmp !== undefined ? h('span', { class: st.final[s] > cmp ? 'up' : st.final[s] < cmp ? 'down' : 'same' }, st.final[s] > cmp ? ` ▲${st.final[s] - cmp}` : st.final[s] < cmp ? ` ▼${cmp - st.final[s]}` : '') : null),
    );
  }), h('div', { class: 'legend small' }, h('span', { class: 'seg-key base' }), 'Attributes ', h('span', { class: 'seg-key trait' }), 'Advanced Traits ', h('span', { class: 'seg-key mut' }), 'Mutation'));
}

export function attributeList(m) {
  const rows = CATEGORIES.map((cat) => {
    const a = ATTRIBUTE_BY_ID[m.genes[cat]];
    return h('div', { class: 'attr-row' },
      h('span', { class: 'attr-cat' }, CATEGORY_NAMES[cat]),
      h('span', { class: 'attr-name' }, a.name, ' ', h('span', { class: `tier tier-${a.tier}` }, a.tier)),
      h('span', { class: 'attr-stats small' }, statText(a.stats)));
  });
  const fam = colorFamily(m.genes.color);
  const [rp, gp, bp] = colorGroupPoints(m.genes.color);
  const contrib = colorContribution(m.genes.color, m.genes.alloc);
  rows.push(h('div', { class: 'attr-row' },
    h('span', { class: 'attr-cat' }, 'Cap colour'),
    h('span', { class: 'attr-name' }, h('span', { class: 'swatch', style: { background: hex(m.genes.color) } }), fam.name, h('span', { class: 'small' }, ` rgb(${m.genes.color.join(', ')})`)),
    h('span', { class: 'attr-stats small' }, `R ${rp} / G ${gp} / B ${bp} → `, statText(contrib))));
  rows.push(h('div', { class: 'attr-row' },
    h('span', { class: 'attr-cat' }, 'Colour genes'),
    hiddenColor(m.genes)
      ? h('span', { class: 'attr-name' }, h('span', { class: 'swatch', style: { background: hex(m.genes.color) } }), 'shown + ', h('span', { class: 'swatch hidden-swatch', title: 'A hidden colour' }, '?'), 'a hidden colour')
      : h('span', { class: 'attr-name' }, 'No hidden colour'),
    h('span', { class: 'attr-stats small' }, hiddenColor(m.genes) ? 'Its offspring may show the hidden colour instead.' : 'Both of its colour genes look alike.')));
  rows.push(h('div', { class: 'attr-row' },
    h('span', { class: 'attr-cat' }, 'Second colour'),
    h('span', { class: 'attr-name' }, h('span', { class: 'swatch', style: { background: hex(m.genes.accent) } }), nearestName(SECONDARY_PALETTE, m.genes.accent)),
    h('span', { class: 'attr-stats small' }, 'Paints its spots, stripes, beads, warts and sheen. Looks only.')));
  rows.push(h('div', { class: 'attr-row' },
    h('span', { class: 'attr-cat' }, 'Stem colour'),
    h('span', { class: 'attr-name' }, h('span', { class: 'swatch', style: { background: hex(m.genes.stemColor) } }), nearestName(STEM_PALETTE, m.genes.stemColor)),
    h('span', { class: 'attr-stats small' }, 'Looks only.')));
  return h('div', { class: 'attr-list' }, rows);
}

const nearestName = (pal, rgb) => pal.reduce((best, p) => {
  const d = Math.hypot(p.rgb[0] - rgb[0], p.rgb[1] - rgb[1], p.rgb[2] - rgb[2]);
  return d < best.d ? { d, name: p.name } : best;
}, { d: Infinity, name: '' }).name;

export function statText(stats) {
  return STATS.filter((s) => stats[s]).map((s) => `${s} +${stats[s]}`).join(', ') || '—';
}

export function traitChip(app, t) {
  const dormant = !app.state.unlocks.traits;
  return h('div', { class: 'gene-chip trait' + (dormant ? ' dormant' : '') },
    h('b', {}, `${TRAIT_NAMES[t.stat]} — +${t.bonus} ${STAT_NAMES[t.stat]}`),
    h('div', { class: 'small' }, t.originName ? `First appeared in ${t.originName}${t.originGeneration ? `, Gen ${t.originGeneration}` : ''}` : 'Inherited'),
    dormant ? h('div', { class: 'small warn' }, 'Dormant — activates when Advanced Traits unlock') : null);
}

export function perkChip(app, p) {
  const def = PERK_BY_ID[p.perkId];
  const dormant = !app.state.unlocks.perks;
  const val = def.levels[p.level - 1];
  return h('div', { class: 'gene-chip perk' + (dormant ? ' dormant' : '') },
    h('b', {}, `${def.name} ${'★'.repeat(p.level)}${'☆'.repeat(def.levels.length - p.level)}`),
    h('div', { class: 'small' }, `${def.desc} (${Math.round(val * 100)}%; max ${Math.round(def.levels[def.levels.length - 1] * 100)}%)`),
    dormant ? h('div', { class: 'small warn' }, 'Dormant — activates with the Spore Cradle') : null);
}

export function mutationChip(app, mu) {
  const def = MUTATION_BY_ID[mu.mutationId];
  const dormant = !app.state.unlocks.mutations;
  return h('div', { class: 'gene-chip mutation' + (dormant ? ' dormant' : '') },
    h('b', {}, `✦ ${def.name}`),
    h('div', { class: 'small' }, def.desc),
    h('div', { class: 'small' }, 'Bonus: ', statText(mu.bonuses), ' · ', mu.origin === 'spontaneous' ? 'appeared spontaneously' : 'inherited'),
    dormant ? h('div', { class: 'small warn' }, 'Dormant — activates when Mutations unlock') : null);
}

export function temperamentText(m) {
  const t = TEMPERAMENT_BY_ID[m.temperament];
  return t ? `${t.name} — ${t.desc}` : m.temperament;
}

export function section(title, ...children) {
  return h('section', { class: 'card' }, h('h3', {}, title), ...children);
}

export function empty(text) {
  return h('p', { class: 'empty' }, text);
}

// ---------------------------------------------------------------- stat radar (spider graph)

/** Series colours for the radar (checked for contrast and colour-blind separation on the card surface). */
export const RADAR_COLOURS = ['#c0821a', '#3f8fd6'];
const RADAR_LABEL = { CUL: 'Cultivation', MYC: 'Mycology', FOR: 'Foraging', CON: 'Construction', MAG: 'Magic', ANI: 'Animal Care', DIS: 'Discovery', SOC: 'Social' };

function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  for (const c of children.flat(Infinity)) if (c) el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

/**
 * A spider graph of final job stats for one or two mushrooms on a shared
 * scale. Hover or tap an axis for exact values. series: [{ m, label }]
 */
export function statRadar(app, series, opts = {}) {
  // colour follows the slot (pen A is always amber, B always blue), not the number of mushrooms shown
  const data = series.map((x, i) => (x && x.m ? { ...x, colour: RADAR_COLOURS[i], st: statsOf(app.state, x.m).final } : null)).filter(Boolean);
  const n = STATS.length;
  const top = Math.max(1, ...data.flatMap((d) => STATS.map((s) => d.st[s])));
  const max = Math.min(100, Math.max(60, Math.ceil(top / 20) * 20));
  const R = 84;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, v) => [Math.cos(ang(i)) * R * (v / max), Math.sin(ang(i)) * R * (v / max)];
  const fmtPt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;

  const grid = [];
  for (let v = 20; v <= max; v += 20) {
    grid.push(svg('polygon', { class: 'radar-ring' + (v === max ? ' outer' : ''), points: STATS.map((_, i) => fmtPt(pt(i, v))).join(' ') }));
    grid.push(svg('text', { class: 'radar-tick', x: 5, y: (-R * v) / max + 3 }, String(v)));
  }
  const spokes = STATS.map((_, i) => svg('line', { class: 'radar-spoke', x1: 0, y1: 0, x2: pt(i, max)[0], y2: pt(i, max)[1] }));
  const labels = STATS.map((s, i) => {
    const [x, y] = pt(i, max * 1.17);
    const c = Math.cos(ang(i));
    return svg('text', { class: 'radar-label', 'data-stat': s, x: x.toFixed(1), y: (y + 4).toFixed(1), 'text-anchor': Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end' }, RADAR_LABEL[s]);
  });
  const shapes = data.map((d) => svg('g', { class: 'radar-series' },
    svg('polygon', { points: STATS.map((s, i) => fmtPt(pt(i, d.st[s]))).join(' '), fill: d.colour, 'fill-opacity': data.length > 1 ? 0.18 : 0.28, stroke: d.colour, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    STATS.map((s, i) => { const [x, y] = pt(i, d.st[s]); return svg('circle', { class: 'radar-dot', cx: x.toFixed(1), cy: y.toFixed(1), r: 4, fill: d.colour }); })));

  // exact values: hover or tap anywhere in an axis's wedge
  const readout = h('div', { class: 'radar-readout small', 'aria-live': 'polite' }, 'Hover or tap the chart for exact values.');
  const focus = svg('line', { class: 'radar-focus', x1: 0, y1: 0, x2: 0, y2: 0 });
  const show = (i) => {
    const s = STATS[i];
    const [x, y] = pt(i, max);
    focus.setAttribute('x2', x.toFixed(1)); focus.setAttribute('y2', y.toFixed(1)); focus.classList.add('on');
    for (const l of labels) l.classList.toggle('on', l.dataset.stat === s);
    readout.replaceChildren(h('b', {}, STAT_NAMES[s] + ': '), ...data.map((d, k) => h('span', { class: 'radar-val' }, k ? ' · ' : '', data.length > 1 ? h('span', { class: 'radar-key', style: { background: d.colour } }) : null, data.length > 1 ? `${d.label} ` : '', h('b', {}, String(d.st[s])))));
  };
  const hits = STATS.map((_, i) => {
    const a0 = ang(i) - Math.PI / n;
    const a1 = ang(i) + Math.PI / n;
    const r = R * 1.35;
    const el = svg('path', { class: 'radar-hit', d: `M0,0 L${(Math.cos(a0) * r).toFixed(1)},${(Math.sin(a0) * r).toFixed(1)} A${r},${r} 0 0 1 ${(Math.cos(a1) * r).toFixed(1)},${(Math.sin(a1) * r).toFixed(1)} Z` });
    el.addEventListener('pointerenter', () => show(i));
    el.addEventListener('click', () => show(i));
    return el;
  });

  const summary = data.map((d) => `${d.label || d.m.name}: ` + STATS.map((s) => `${STAT_NAMES[s]} ${d.st[s]}`).join(', ')).join('. ');
  const chart = svg('svg', { class: 'radar', viewBox: '-178 -112 356 226', role: 'img', 'aria-label': `Stat spider graph. ${summary}` },
    grid, spokes, shapes, focus, labels, hits);
  chart.addEventListener('pointerleave', () => { focus.classList.remove('on'); for (const l of labels) l.classList.remove('on'); });
  const legend = data.length > 1
    ? h('div', { class: 'radar-legend small' }, data.map((d) => h('span', {}, h('span', { class: 'radar-key', style: { background: d.colour } }), d.label)))
    : null;
  return h('figure', { class: 'radar-wrap' + (opts.compact ? ' compact' : '') }, opts.title ? h('figcaption', { class: 'radar-title' }, opts.title) : null, legend, chart, readout);
}

/** A small spider graph for picking mushrooms: shape only, plus its two best stats underneath. */
export function miniRadar(app, m) {
  const st = statsOf(app.state, m).final;
  const n = STATS.length;
  const top = Math.max(1, ...STATS.map((s) => st[s]));
  const max = Math.min(100, Math.max(60, Math.ceil(top / 20) * 20));
  const R = 40;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, v) => `${(Math.cos(ang(i)) * R * (v / max)).toFixed(1)},${(Math.sin(ang(i)) * R * (v / max)).toFixed(1)}`;
  const rings = [];
  for (let v = 20; v <= max; v += 20) rings.push(svg('polygon', { class: 'radar-ring' + (v === max ? ' outer' : ''), points: STATS.map((_, i) => pt(i, v)).join(' ') }));
  const spokes = STATS.map((_, i) => { const [x, y] = pt(i, max).split(','); return svg('line', { class: 'radar-spoke', x1: 0, y1: 0, x2: x, y2: y }); });
  const best = topStats(st, 2);
  const chart = svg('svg', { class: 'mini-radar', viewBox: '-44 -44 88 88', role: 'img', 'aria-label': `${m.name}'s stats: ` + STATS.map((s) => `${STAT_NAMES[s]} ${st[s]}`).join(', ') },
    rings, spokes,
    svg('polygon', { points: STATS.map((s, i) => pt(i, st[s])).join(' '), fill: RADAR_COLOURS[0], 'fill-opacity': 0.3, stroke: RADAR_COLOURS[0], 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
  return h('div', { class: 'mini-radar-wrap' }, chart, h('span', { class: 'mini-radar-top', title: best.map((s) => `${STAT_NAMES[s]} ${st[s]}`).join(', ') }, best.map((s) => `${s} ${st[s]}`).join(' · ')));
}
