// The Store: everything you can buy and put down, by kind.
import * as G from '../../core/game.js';
import { getConfig } from '../../config.js';
import { STRUCTURES, STORE_TABS, JOB_BY_ID, STAGE_BY_ID, BREEDING_STATIONS, PAINTABLE_TERRAIN, TERRAIN, TERRAIN_PAINT_COST } from '../../content/world.js';
import { drawStructure, drawTile } from '../../render/world.js';
import { h, costView, section } from '../common.js';

const SCALE = 3;

/** A small picture of a store item on a patch of grass. */
function preview(draw, w = 24, hgt = 24) {
  const c = h('canvas', { class: 'store-art', width: w * SCALE, height: hgt * SCALE, 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#5f9e48';
  ctx.fillRect(0, 0, w, hgt);
  ctx.fillStyle = '#4f8a3c';
  for (let i = 0; i < 18; i++) ctx.fillRect((i * 7) % w, (i * 11) % hgt, 1, 1);
  draw(ctx);
  return c;
}

function owned(state, defId) {
  return G.allObjects(state).filter((o) => o.def === defId && o.state === 'built').length;
}

function lockReason(state, defId) {
  const d = STRUCTURES[defId];
  if (d.kind === 'pen' && G.penCount(state, false) >= getConfig().breeding.maxPens) return `You have the most pens you can keep (${getConfig().breeding.maxPens}).`;
  if (d.requiresStage && !G.stageComplete(state, d.requiresStage)) return `Restore the ${STAGE_BY_ID[d.requiresStage].name} first.`;
  if (d.job && !G.jobUnlocked(state, d.job)) return `Unlock the ${JOB_BY_ID[d.job].name} job first.`;
  return null;
}

function itemCard(app, defId) {
  const s = app.state;
  const d = STRUCTURES[defId];
  const cost = d.buildCost || d.cost;
  const locked = lockReason(s, defId);
  const afford = G.canAfford(s, cost);
  const n = owned(s, defId);
  return h('article', { class: 'store-item' + (locked ? ' locked' : '') },
    preview((ctx) => { ctx.translate(4, 6); drawStructure(ctx, d, 0, 0, 'built', 0); }),
    h('div', { class: 'store-body' },
      h('h3', {}, d.name),
      h('p', { class: 'small' }, d.desc || ''),
      n ? h('p', { class: 'small muted' }, `You have ${n}`) : null,
      locked ? h('p', { class: 'small warn' }, locked) : costView(s, cost),
      h('button', {
        type: 'button', class: 'btn primary', disabled: !!locked || !afford,
        onclick: () => { app.buildTool = { kind: 'place', def: defId }; app.go('forest'); app.toast(`Tap a free spot to put down the ${d.name}.`); },
      }, locked ? 'Locked' : afford ? 'Buy & place' : 'Not enough materials')));
}

function upgradeCard(app) {
  const s = app.state;
  const next = G.nextStation(s);
  const now = BREEDING_STATIONS[s.station];
  if (!next) return section('Pen upgrades', h('p', { class: 'small' }, `Your pens are ${now.name}s — fully upgraded.`));
  const def = BREEDING_STATIONS[next];
  const locked = def.requiresStage && !G.stageComplete(s, def.requiresStage) ? `Restore the ${STAGE_BY_ID[def.requiresStage].name} first.` : null;
  return h('article', { class: 'store-item' + (locked ? ' locked' : '') },
    preview((ctx) => { ctx.translate(4, 6); drawStructure(ctx, STRUCTURES.breeding_pen, 0, 0, 'built', 0); ctx.fillStyle = next === 'spore_cradle' ? 'rgba(184,138,216,0.55)' : 'rgba(200,210,255,0.55)'; ctx.fillRect(2, 2, 12, 3); }),
    h('div', { class: 'store-body' },
      h('h3', {}, `Upgrade every pen: ${def.name}`),
      h('p', { class: 'small' }, next === 'spore_cradle' ? 'Unlocks Perks in offspring and incubates 10% faster.' : 'Incubates 25% faster and breeding costs 2 Glimmer less.'),
      locked ? h('p', { class: 'small warn' }, locked) : costView(s, def.cost),
      h('button', { type: 'button', class: 'btn primary', disabled: !!locked || !G.canAfford(s, def.cost), onclick: () => app.act(() => G.upgradeStation(s, app.now()), `Your pens are now ${def.name}s.`) }, 'Upgrade')));
}

function groundCard(app, code) {
  const T = TERRAIN[code];
  return h('article', { class: 'store-item' },
    preview((ctx) => { ctx.translate(4, 4); drawTile(ctx, code, 0, 0, 0, 0, false); }),
    h('div', { class: 'store-body' },
      h('h3', {}, T.name),
      h('p', { class: 'small' }, 'Paint the ground one tile at a time. Moss, damp soil and shade each attract different Wild Visitors.'),
      h('div', { class: 'small' }, 'Per tile: ', costView(app.state, TERRAIN_PAINT_COST)),
      h('button', { type: 'button', class: 'btn primary', onclick: () => { app.buildTool = { kind: 'paint', code }; app.go('forest'); app.toast(`Tap tiles to paint ${T.name.toLowerCase()}.`); } }, 'Paint')));
}

export function renderStore(app) {
  const s = app.state;
  const tab = app.ui.storeTab || 'workstation';
  let items;
  if (tab === 'ground') items = PAINTABLE_TERRAIN.map((c) => groundCard(app, c));
  else {
    const defs = Object.entries(STRUCTURES).filter(([, d]) => d.buildable && d.store === tab).map(([id]) => id);
    // available first, then locked; keep the catalogue order within each
    defs.sort((a, b) => Number(!!lockReason(s, a)) - Number(!!lockReason(s, b)));
    items = defs.map((id) => itemCard(app, id));
    if (tab === 'breeding') items.push(upgradeCard(app));
  }
  return h('div', {},
    h('h2', { class: 'screen-title' }, 'Store'),
    h('p', { class: 'small muted' }, 'Buy something, then tap a free spot in the forest to put it down. Use Build → Move to rearrange things later.'),
    h('div', { class: 'tabs scroll-x', role: 'tablist' }, STORE_TABS.map(([id, label]) => h('button', {
      type: 'button', role: 'tab', class: 'tab' + (tab === id ? ' active' : ''), 'aria-selected': String(tab === id),
      onclick: () => { app.ui.storeTab = id; app.render(); },
    }, label))),
    h('div', { class: 'store-grid' }, items.length ? items : h('p', { class: 'empty' }, 'Nothing here yet.')));
}
