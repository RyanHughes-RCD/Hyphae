// Breeding screen and reveal (GDD 9.1, 15.3).
import * as G from '../../core/game.js';
import { getConfig, STATS, STAT_NAMES } from '../../config.js';
import { ATTRIBUTE_BY_ID, CATEGORIES, CATEGORY_NAMES } from '../../content/attributes.js';
import { PERK_BY_ID, MUTATION_BY_ID, TRAIT_NAMES } from '../../content/genetics.js';
import { BREEDING_STATIONS } from '../../content/world.js';
import { drawMushroom, SPRITE_W, SPRITE_H } from '../../render/sprites.js';
import { hex } from '../../core/color.js';
import { h, costView, mushroomCard, mushroomThumb, section, fmtDuration, empty } from '../common.js';

export function renderBreed(app) {
  const s = app.state;
  const now = app.now();
  const station = G.stationConfig(s);
  const stationDef = BREEDING_STATIONS[s.station];
  const active = G.activeBreedings(s);
  const next = G.nextStation(s);
  const cost = G.breedingCost(s);
  const sel = app.ui.breed;
  const a = sel.a ? G.findMushroom(s, sel.a) : null;
  const b = sel.b ? G.findMushroom(s, sel.b) : null;
  if (sel.a && !a) sel.a = null;
  if (sel.b && !b) sel.b = null;

  const incub = active.map((r) => {
    const ready = r.completesAt <= now;
    const pa = r.parentSnapshots[0];
    const pb = r.parentSnapshots[1];
    return h('div', { class: 'incubation' + (ready ? ' ready' : '') },
      h('div', { class: 'spore-cluster' + (ready ? ' ready' : ''), 'aria-hidden': 'true' }),
      h('div', { class: 'grow' }, h('b', {}, `${pa.name} × ${pb.name}`),
        h('div', { class: 'small' }, ready ? 'Ready to hatch!' : h('span', { dataset: { countdown: r.completesAt, done: 'Ready to hatch!', prefix: 'Hatches in ' } }, 'Hatches in ' + fmtDuration(r.completesAt - now)))),
      h('button', { type: 'button', class: 'btn primary', disabled: !ready, onclick: () => claim(app, r.id) }, 'Hatch'));
  });

  const slot = (which, m) => h('div', { class: 'parent-slot' },
    m ? mushroomCard(app, m, { onclick: () => pickParent(app, which) }) : h('button', { type: 'button', class: 'm-card empty-slot', onclick: () => pickParent(app, which) }, h('span', { class: 'plus' }, '+'), `Choose parent ${which.toUpperCase()}`));

  const canBreed = a && b && active.length < station.slots;
  return h('div', {},
    h('h2', { class: 'screen-title' }, 'Breeding'),
    section(stationDef.name,
      h('p', { class: 'small' }, `${active.length}/${station.slots} incubation slot(s) · incubation ${fmtDuration(getConfig().breeding.incubationMinutes * 60000 * station.speed)} · cost: `, cost ? costView(s, { glimmer: cost }) : h('b', {}, 'Free (first breeding)')),
      next ? h('div', { class: 'list-row' }, h('div', {}, h('b', {}, `Upgrade to ${BREEDING_STATIONS[next].name}`), h('div', { class: 'small' }, next === 'spore_cradle' ? 'Unlocks Perks, +1 slot, 10% faster.' : '+1 slot, 25% faster, small discount.'), costView(s, BREEDING_STATIONS[next].cost),
        BREEDING_STATIONS[next].requiresStage && !G.stageComplete(s, BREEDING_STATIONS[next].requiresStage) ? h('div', { class: 'small warn' }, 'Requires a later area of the forest.') : null),
      h('button', { type: 'button', class: 'btn', onclick: () => app.act(() => G.upgradeStation(s, app.now())) }, 'Upgrade')) : null),
    incub.length ? section('Incubating', incub) : null,
    section('New pairing',
      h('div', { class: 'parents' }, slot('a', a), h('div', { class: 'times', 'aria-hidden': 'true' }, '×'), slot('b', b)),
      a && b ? inheritanceHints(app, a, b) : h('p', { class: 'small' }, 'Pick any two mushrooms. Parents are never used up — they stay in your forest and keep working.'),
      h('div', { class: 'row gap' },
        h('button', {
          type: 'button', class: 'btn primary big', disabled: !canBreed,
          onclick: () => {
            const r = app.act(() => G.startBreeding(s, a.uid, b.uid, app.now()), 'A spore cluster begins to grow…');
            if (r.ok) { app.ui.breed = { a: null, b: null }; app.render(); }
          },
        }, cost ? `Begin breeding (${cost} Glimmer)` : 'Begin breeding (free)'),
        a || b ? h('button', { type: 'button', class: 'btn', onclick: () => { app.ui.breed = { a: null, b: null }; app.render(); } }, 'Clear') : null)),
    recent(app),
  );
}

function recent(app) {
  const done = app.state.breedings.filter((r) => r.state === 'claimed').slice(-5).reverse();
  if (!done.length) return null;
  return section('Recent offspring', h('div', { class: 'card-grid' }, done.map((r) => {
    const m = G.findMushroom(app.state, r.offspring.uid);
    return m ? mushroomCard(app, m) : null;
  })));
}

function pickParent(app, which) {
  const s = app.state;
  const now = app.now();
  const other = which === 'a' ? app.ui.breed.b : app.ui.breed.a;
  const otherOwned = other ? G.isOwned(s, other) : true;
  const groups = [
    ['Residents', G.residents(s)],
    ['Spore Archive', s.mushrooms.filter((m) => m.status === 'archived')],
    ['Guests', s.guests],
    ['Wild Visitors', s.wildVisitors.map((v) => v.mushroom)],
  ];
  const md = app.modal(h('div', {}, groups.filter(([, l]) => l.length).map(([label, list]) => h('div', {},
    h('h3', { class: 'sub' }, label),
    h('div', { class: 'card-grid' }, list.map((m) => {
      let reason = G.breedIneligibility(s, m, now);
      if (m.uid === other) reason = 'Already chosen';
      if (!reason && !G.isOwned(s, m.uid) && !otherOwned) reason = 'Needs one of your own mushrooms as the other parent';
      return mushroomCard(app, m, {
        disabled: !!reason, disabledReason: reason,
        onclick: () => { if (reason) { app.toast(reason, 'error'); return; } app.ui.breed[which] = m.uid; md.close(); app.render(); },
      });
    }))))), { title: `Choose parent ${which.toUpperCase()}`, wide: true });
}

function inheritanceHints(app, a, b) {
  const s = app.state;
  const rows = CATEGORIES.map((cat) => {
    const x = ATTRIBUTE_BY_ID[a.genes[cat]].name;
    const y = ATTRIBUTE_BY_ID[b.genes[cat]].name;
    return h('div', { class: 'attr-row' }, h('span', { class: 'attr-cat' }, CATEGORY_NAMES[cat]), h('span', {}, x === y ? x : `${x} or ${y}`), h('span', { class: 'small muted' }, s.breedingsStarted === 0 ? '' : '· variation possible'));
  });
  rows.push(h('div', { class: 'attr-row' }, h('span', { class: 'attr-cat' }, 'Cap colour'),
    h('span', { class: 'blend', style: { background: `linear-gradient(90deg, ${hex(a.genes.color)}, ${hex(b.genes.color)})` } }), h('span', { class: 'small muted' }, 'a blend of both')));

  const traitPool = new Map();
  for (const t of a.traits) traitPool.set(t.traitUid, { t, n: 1 });
  for (const t of b.traits) traitPool.has(t.traitUid) ? (traitPool.get(t.traitUid).n = 2) : traitPool.set(t.traitUid, { t, n: 1 });
  const perkPool = new Map();
  for (const p of a.perks.concat(b.perks)) perkPool.set(p.perkId, (perkPool.get(p.perkId) || 0) + 1);
  const muts = [a, b].filter((m) => m.mutation);

  const lines = [];
  if (traitPool.size) lines.push(h('div', {}, h('b', {}, 'Advanced Traits that may be inherited: '), [...traitPool.values()].map(({ t, n }) => h('span', { class: 'chip' + (n === 2 ? ' strong' : '') }, `+4 ${STAT_NAMES[t.stat]}${n === 2 ? ' (both parents — more likely)' : ''}`))));
  lines.push(h('div', { class: 'small' }, s.unlocks.traits ? 'Chance of a brand-new Advanced Trait.' : 'Advanced Traits unlock after your second breeding.'));
  if (perkPool.size) lines.push(h('div', {}, h('b', {}, 'Perks that may be inherited: '), [...perkPool.entries()].map(([id, n]) => h('span', { class: 'chip' + (n === 2 ? ' strong' : '') }, `${PERK_BY_ID[id].name}${n === 2 ? ' (both — may combine into a stronger version)' : ''}`))));
  lines.push(h('div', { class: 'small' }, s.unlocks.perks ? 'Small chance of a new Perk if a slot is free.' : 'Perks unlock with the Spore Cradle.'));
  if (muts.length) lines.push(h('div', {}, h('b', {}, 'Mutation: '), muts.map((m) => MUTATION_BY_ID[m.mutation.mutationId].name).join(' / '), ' may be inherited (at most one).'));
  else if (s.unlocks.mutations) lines.push(h('div', { class: 'small' }, 'A very rare spontaneous Mutation is possible.'));
  const lockedDonor = (!s.unlocks.traits && (a.traits.length || b.traits.length)) || (!s.unlocks.perks && (a.perks.length || b.perks.length)) || (!s.unlocks.mutations && muts.length);
  if (lockedDonor) lines.push(h('p', { class: 'small warn' }, 'Some of these genes belong to systems you have not unlocked yet. Offspring can carry them as dormant genes that activate later.'));
  return h('div', { class: 'hints' }, h('h4', {}, 'Possible inheritance'), h('div', { class: 'attr-list' }, rows), lines, h('p', { class: 'small muted' }, 'Outcomes are never guaranteed — every offspring is a surprise.'));
}

function claim(app, id) {
  const s = app.state;
  const rec = s.breedings.find((r) => r.id === id);
  const res = app.act(() => G.claimBreeding(s, id, app.now()));
  if (!res.ok) return;
  reveal(app, res.mushroom, rec);
}

function reveal(app, m, rec) {
  const s = app.state;
  const log = rec.log;
  const scale = 5;
  const c = h('canvas', { class: 'sprite big', width: SPRITE_W + 16, height: SPRITE_H + 8, style: { width: `${(SPRITE_W + 16) * scale}px`, height: `${(SPRITE_H + 8) * scale}px` } });
  const ctx = c.getContext('2d');
  const start = performance.now();
  const mv = s.unlocks.mutations && m.mutation ? MUTATION_BY_ID[m.mutation.mutationId].visual : null;
  const rm = s.settings.reducedMotion;
  const details = h('div', { class: 'reveal-details' + (rm ? '' : ' hidden') });
  const loop = (ts) => {
    if (!c.isConnected && ts - start > 500) return;
    const e = rm ? 3 : (ts - start) / 1000;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    if (e < 1.3) {
      const p = 1 + Math.sin(e * 14) * 0.08 * e;
      const r = 7 * p;
      ctx.fillStyle = '#e8d8f0';
      ctx.beginPath(); ctx.arc(20, 22, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b88ad8';
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(20 + Math.cos(i + e * 3) * r * 0.6), Math.round(22 + Math.sin(i * 2 + e * 3) * r * 0.6), 2, 2);
    } else {
      const k = Math.min(1, (e - 1.3) / 0.4);
      ctx.globalAlpha = k;
      drawMushroom(ctx, m, 8, 4, ts / 1000, { mutationVisual: mv, reducedMotion: rm, bob: Math.sin(ts / 300) > 0.8 ? -1 : 0 });
      ctx.globalAlpha = 1;
      if (e < 2.2) for (let i = 0; i < 10; i++) {
        const a = i * 0.63 + e;
        const d = (e - 1.3) * 22;
        ctx.fillStyle = i % 2 ? '#ffd75e' : '#ffffff';
        ctx.fillRect(Math.round(20 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), 1, 1);
      }
      if (details.classList.contains('hidden')) details.classList.remove('hidden');
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const highlights = [];
  if (log.mutation) highlights.push(h('div', { class: 'highlight mutation' }, `✦ MUTATION! ${MUTATION_BY_ID[log.mutation].name} (${log.mutationSource})`));
  if (log.newTrait) highlights.push(h('div', { class: 'highlight trait' }, `New Advanced Trait: ${TRAIT_NAMES[log.newTrait.stat]} (+4 ${STAT_NAMES[log.newTrait.stat]})`));
  if (log.newPerk) highlights.push(h('div', { class: 'highlight perk' }, `New Perk: ${PERK_BY_ID[log.newPerk.perkId].name}`));
  for (const u of log.upgradedPerks) highlights.push(h('div', { class: 'highlight perk' }, `Perk combined: ${PERK_BY_ID[u.perkId].name} ${u.from} → ${u.to}`));
  if (log.inheritedTraits) highlights.push(h('div', { class: 'small' }, `Inherited ${log.inheritedTraits} Advanced Trait(s).`));
  const varied = log.variations.filter((v) => CATEGORIES.includes(v.category));
  for (const v of varied) highlights.push(h('div', { class: 'highlight' }, `Variation! ${CATEGORY_NAMES[v.category]}: ${ATTRIBUTE_BY_ID[v.to].name} (${ATTRIBUTE_BY_ID[v.to].tier})`));
  if (log.variations.some((v) => v.category === 'color')) highlights.push(h('div', { class: 'highlight' }, 'Variation! An unexpected colour shift.'));
  if (!highlights.length) highlights.push(h('div', { class: 'small' }, 'A fresh combination of its parents\' attributes.'));

  const pa = rec.parentSnapshots[0];
  const pb = rec.parentSnapshots[1];
  const sa = G.statsOf(s, pa).final;
  const sb = G.statsOf(s, pb).final;
  const so = G.statsOf(s, m).final;
  const cmp = h('table', { class: 'cmp' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, pa.name), h('th', {}, pb.name), h('th', {}, m.name))),
    h('tbody', {}, STATS.map((k) => h('tr', {}, h('td', {}, STAT_NAMES[k]), h('td', {}, sa[k]), h('td', {}, sb[k]), h('td', { class: so[k] > Math.max(sa[k], sb[k]) ? 'up' : '' }, so[k])))));
  details.append(h('div', { class: 'highlights' }, highlights), cmp,
    h('p', { class: 'small' }, m.status === 'archived' ? `${m.name} went to the Spore Archive (your forest is full).` : `${m.name} joined your forest. Generation ${m.generation}.`));
  app.modal(h('div', { class: 'reveal' }, h('div', { class: 'reveal-stage' }, c), h('h2', { class: 'center' }, m.name), details), {
    title: 'A new mushroom hatched!', wide: true,
    footer: [h('button', { type: 'button', class: 'btn', onclick: () => { app.closeModal(); app.openMushroom(m.uid); } }, 'View details'), h('button', { type: 'button', class: 'btn primary', onclick: () => app.closeModal() }, 'Lovely!')],
  });
}

export { mushroomThumb, empty };
