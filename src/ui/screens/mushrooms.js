// Collection screen and Mushroom Detail (GDD 15.2).
import * as G from '../../core/game.js';
import { JOBS } from '../../content/world.js';
import { MUTATION_BY_ID } from '../../content/genetics.js';
import { affinity, rarityScore } from '../../core/stats.js';
import { drawMushroom, SPRITE_W, SPRITE_H } from '../../render/sprites.js';
import { exportMushroom, removeGuest } from '../../core/share.js';
import {
  h, mushroomCard, statBars, attributeList, traitChip, perkChip, mutationChip, rarityBadge, temperamentText, section, empty, fmt, fmtDuration,
} from '../common.js';
import { shareModal } from './more.js';

export function renderMushrooms(app) {
  const s = app.state;
  const tabs = [
    ['resident', `Residents (${G.residents(s).length}/${G.residentCap(s)})`],
    ['archived', `Archive (${s.mushrooms.filter((m) => m.status === 'archived').length})`],
    ['guest', `Guests (${s.guests.length})`],
    ['wild', `Visitors (${s.wildVisitors.length})`],
  ];
  let list;
  if (app.ui.mushroomsTab === 'guest') list = s.guests;
  else if (app.ui.mushroomsTab === 'wild') list = s.wildVisitors.map((v) => v.mushroom);
  else list = s.mushrooms.filter((m) => m.status === app.ui.mushroomsTab);
  const sorters = {
    newest: (a, b) => b.createdAt - a.createdAt,
    generation: (a, b) => b.generation - a.generation,
    rarity: (a, b) => rarityScore(b) - rarityScore(a),
    affinity: (a, b) => affinity(G.statsOf(s, a).final).name.localeCompare(affinity(G.statsOf(s, b).final).name),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  list = list.slice().sort(sorters[app.ui.sort] || sorters.newest);
  const emptyText = {
    resident: 'No residents.',
    archived: 'The Spore Archive is empty. When your forest is full, new offspring rest here.',
    guest: 'No Guests yet. Import a friend\'s share code from More → Share to breed with their mushrooms.',
    wild: 'No Wild Visitors right now. Decorations and habitats attract them; Nest Tenders help too.',
  }[app.ui.mushroomsTab];
  return h('div', {},
    h('h2', { class: 'screen-title' }, 'Mushrooms'),
    h('div', { class: 'tabs scroll-x' }, tabs.map(([id, label]) => h('button', { type: 'button', class: 'tab' + (app.ui.mushroomsTab === id ? ' active' : ''), onclick: () => { app.ui.mushroomsTab = id; app.render(); } }, label))),
    h('label', { class: 'row gap small' }, 'Sort by ', h('select', { onchange: (e) => { app.ui.sort = e.target.value; app.render(); } },
      Object.keys(sorters).map((k) => h('option', { value: k, selected: app.ui.sort === k }, k)))),
    app.ui.mushroomsTab === 'wild' && s.wildVisitors.length ? h('p', { class: 'small' }, 'Wild Visitors can be bred with while they are here. They cannot work or stay forever.') : null,
    list.length ? h('div', { class: 'card-grid' }, list.map((m) => {
      const v = s.wildVisitors.find((x) => x.mushroom.uid === m.uid);
      return mushroomCard(app, m, v ? { extra: h('span', { dataset: { countdown: v.leavesAt, prefix: 'Leaves in ' } }, 'Leaves in ' + fmtDuration(v.leavesAt - app.now())) } : {});
    })) : empty(emptyText),
  );
}

function animatedSprite(app, m) {
  const scale = 5;
  const c = h('canvas', { class: 'sprite big', width: SPRITE_W + 16, height: SPRITE_H + 8, style: { width: `${(SPRITE_W + 16) * scale}px`, height: `${(SPRITE_H + 8) * scale}px` } });
  const ctx = c.getContext('2d');
  const mv = app.state.unlocks.mutations && m.mutation ? MUTATION_BY_ID[m.mutation.mutationId]?.visual : null;
  let alive = true;
  const loop = (ts) => {
    if (!alive || (c._started && !c.isConnected)) return;
    c._started = true;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    const t = ts / 1000;
    const bob = Math.sin(t * 2) > 0.7 ? -1 : 0;
    drawMushroom(ctx, m, 8, 4, t, { bob, mutationVisual: mv, reducedMotion: app.state.settings.reducedMotion });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return { el: c, stop: () => { alive = false; } };
}

function lineageView(app, m) {
  const p = m.lineage?.parents;
  if (!p) return h('p', { class: 'small' }, m.origin?.kind === 'starter' ? 'One of your three starter mushrooms.' : m.origin?.kind === 'wild' ? 'A wild mushroom from beyond the forest.' : 'No recorded parents.');
  const node = (x) => {
    const here = G.findMushroom(app.state, x.uid);
    const label = [x.name, ` (Gen ${x.generation})`, x.forestName && x.forestName !== app.state.forest.name ? ` · from ${x.forestName}` : '', x.guest ? ' · guest' : x.wild ? ' · wild visitor' : ''].join('');
    return here ? h('button', { type: 'button', class: 'linkish', onclick: () => { app.closeModal(); app.openMushroom(x.uid); } }, label) : h('span', {}, label);
  };
  return h('div', { class: 'lineage' }, p.map((par) => h('div', { class: 'lineage-branch' },
    h('div', { class: 'lin-parent' }, '↳ ', node(par)),
    par.parents ? h('div', { class: 'lin-grand small' }, par.parents.map((g) => h('div', {}, '   ↳ ', node(g)))) : null)));
}

export function mushroomDetail(app, m) {
  const s = app.state;
  const owned = G.isOwned(s, m.uid);
  const st = G.statsOf(s, m);
  const aff = affinity(st.final);
  const spr = animatedSprite(app, m);
  const now = app.now();

  const nameRow = h('div', { class: 'detail-name' },
    h('h2', {}, m.name),
    owned ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Rename', onclick: () => renamePrompt(app, m) }, '✎') : null);

  const workInfo = [];
  if (m.status === 'resident') {
    if (m.work) {
      const est = G.estimateJob(s, m, m.work.jobId, now);
      workInfo.push(h('p', {}, h('b', {}, app.jobName(m.work.jobId)), ` — ${est.label}, score ${fmt(est.score)}, productivity ${(est.eff * (1 + est.bonus.sum)).toFixed(2)}×`),
        est.bonus.parts.length ? h('p', { class: 'small perk-line' }, 'Active now: ', est.bonus.parts.map((p) => `${p.label} +${Math.round(p.value * 100)}%`).join(' · ')) : null);
    } else workInfo.push(h('p', {}, 'Enjoying some free time.'));
  } else if (m.status === 'archived') workInfo.push(h('p', {}, 'Resting in the Spore Archive. It can be bred and shared, but not work.'));
  else if (m.status === 'guest') workInfo.push(h('p', {}, `A Guest from ${m.origin?.forestName || 'a friend'}'s forest — a genetic donor. Guests cannot work and never grant resources.`));
  else workInfo.push(h('p', {}, 'A Wild Visitor. It can be bred with while it stays.'));
  if (m.restUntil > now) workInfo.push(h('p', { class: 'small' }, 'Resting after breeding: ', h('span', { dataset: { countdown: m.restUntil, done: 'rested' } }, fmtDuration(m.restUntil - now))));

  const actions = [];
  if (owned && m.status === 'resident') actions.push(h('button', { type: 'button', class: 'btn primary', onclick: () => jobChooser(app, m) }, m.work ? 'Change job' : 'Assign job'));
  if (owned && m.work) actions.push(h('button', { type: 'button', class: 'btn', onclick: () => { app.act(() => G.unassign(s, m.uid)); app.closeModal(); } }, 'Stop working'));
  actions.push(h('button', { type: 'button', class: 'btn', onclick: () => { app.ui.breed = { a: m.uid, b: app.ui.breed.b === m.uid ? null : app.ui.breed.b, picking: null }; app.closeAllModals(); app.go('breed'); } }, 'Breed'));
  if (owned) actions.push(h('button', { type: 'button', class: 'btn', onclick: () => { const r = exportMushroom(s, m.uid, Date.now()); if (r.ok) shareModal(app, m, r.code); else app.toast(r.reason, 'error'); } }, 'Share'));
  if (owned && m.status === 'resident') actions.push(h('button', { type: 'button', class: 'btn', onclick: () => { app.act(() => G.setArchived(s, m.uid, true), `${m.name} moved to the Spore Archive.`); app.closeModal(); } }, 'Archive'));
  if (owned && m.status === 'archived') actions.push(h('button', { type: 'button', class: 'btn', onclick: () => { const r = app.act(() => G.setArchived(s, m.uid, false), `${m.name} returned to the forest.`); if (r.ok) app.closeModal(); } }, 'Return to forest'));
  if (m.status === 'guest') actions.push(h('button', { type: 'button', class: 'btn danger', onclick: () => app.confirm('Remove Guest?', `Remove ${m.name} from your Guest Grove? Offspring you already bred keep their lineage.`, 'Remove', () => { app.act(() => removeGuest(s, m.uid)); app.closeAllModals(); }, true) }, 'Remove guest'));

  const body = h('div', { class: 'detail' },
    h('div', { class: 'detail-top' }, spr.el,
      h('div', {},
        nameRow,
        h('div', { class: 'row gap wrap' }, rarityBadge(m), h('span', { class: 'badge' }, `Gen ${m.generation}`), h('span', { class: 'badge' }, `${aff.name} affinity`)),
        h('p', { class: 'small' }, temperamentText(m)),
        workInfo,
        h('div', { class: 'row gap wrap' }, actions))),
    section('Job stats', statBars(app, m)),
    section('Ordinary attributes', attributeList(m)),
    section(`Advanced Traits (${m.traits.length}/8)`, m.traits.length ? h('div', { class: 'gene-list' }, m.traits.map((t) => traitChip(app, t))) : empty(s.unlocks.traits ? 'None yet. Offspring can develop permanent +4 stat bonuses.' : 'Unlocks after your second breeding.')),
    section(`Perks (${m.perks.length}/3)`, m.perks.length ? h('div', { class: 'gene-list' }, m.perks.map((p) => perkChip(app, p))) : empty(s.unlocks.perks ? 'No Perks yet.' : 'Unlocks with the Spore Cradle upgrade.')),
    section('Mutation', m.mutation ? mutationChip(app, m.mutation) : empty(s.unlocks.mutations ? 'No Mutation. They are extremely rare.' : 'Mutations are still a mystery…')),
    section('Lineage', lineageView(app, m)),
  );
  app.modal(body, { wide: true, onclose: spr.stop });
}

function renamePrompt(app, m) {
  const input = h('input', { type: 'text', value: m.name, maxlength: 24, 'aria-label': 'New name' });
  const md = app.modal(h('div', {}, input), {
    title: 'Rename',
    footer: [h('button', { type: 'button', class: 'btn primary', onclick: () => { const r = app.act(() => G.renameMushroom(app.state, m.uid, input.value)); if (r.ok) { md.close(); app.closeModal(); app.openMushroom(m.uid); } } }, 'Save')],
  });
  setTimeout(() => input.focus(), 50);
}

function jobChooser(app, m) {
  const s = app.state;
  const now = app.now();
  const jobs = JOBS.filter((j) => G.jobUnlocked(s, j.id));
  const md = app.modal(h('div', { class: 'picker' }, jobs.map((j) => {
    const est = G.estimateJob(s, m, j.id, now);
    const full = G.workersOn(s, j.id).filter((x) => x.uid !== m.uid).length >= G.jobSlots(s, j.id);
    return h('button', {
      type: 'button', class: 'pick-row' + (m.work?.jobId === j.id ? ' selected' : '') + (full ? ' disabled' : ''), disabled: full,
      onclick: () => { md.close(); app.act(() => G.assignJob(s, m.uid, j.id, app.now()), `${m.name} is now a ${j.name}.`); app.closeModal(); app.openMushroom(m.uid); },
    }, h('div', { class: 'grow' }, h('b', {}, j.name), h('div', { class: 'small' }, full ? 'All slots full' : `Score ${fmt(est.score)} · ${est.label} · ${(est.eff * (1 + est.bonus.sum)).toFixed(2)}×`)));
  })), { title: `Job for ${m.name}` });
}
