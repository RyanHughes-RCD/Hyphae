// Small DOM toolkit and shared UI components. All user/imported text is set as
// text nodes (never innerHTML), so imported names cannot inject markup.
import { STATS, STAT_NAMES, getConfig } from '../config.js';
import { RESOURCES } from '../content/world.js';
import { ATTRIBUTE_BY_ID, CATEGORY_NAMES, CATEGORIES, TEMPERAMENT_BY_ID } from '../content/attributes.js';
import { PERK_BY_ID, MUTATION_BY_ID, TRAIT_NAMES } from '../content/genetics.js';
import { mushroomCanvas, resourceColor } from '../render/sprites.js';
import { affinity, rarityTier, colorFamily, colorGroupPoints, colorContribution } from '../core/stats.js';
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
  return h('div', { class: 'attr-list' }, rows);
}

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
