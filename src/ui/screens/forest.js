// Forest screen: area tabs, scene, build mode, restoration and stage progress.
import * as G from '../../core/game.js';
import { STRUCTURES, STAGES, STAGE_BY_ID, JOB_BY_ID, PAINTABLE_TERRAIN, TERRAIN, TERRAIN_PAINT_COST, PROJECTS, BREEDING_STATIONS } from '../../content/world.js';
import { h, costView, section } from '../common.js';
import { assignPicker, jobCard } from './jobs.js';

export function renderForest(app) {
  const s = app.state;
  const areas = STAGES.filter((st) => G.stageDiscovered(s, st.id));
  if (!s.world.areas[app.ui.area]) app.ui.area = 'clearing';
  app.forest.setArea(app.ui.area);
  const area = s.world.areas[app.ui.area];

  const tabs = h('div', { class: 'tabs scroll-x', role: 'tablist' }, areas.map((st) => h('button', {
    type: 'button', role: 'tab', class: 'tab' + (st.id === app.ui.area ? ' active' : ''),
    onclick: () => { app.ui.area = st.id; app.render(); },
  }, st.name)));

  const ruins = area.objects.filter((o) => o.state === 'ruin');
  const tool = app.buildTool;

  return h('div', { class: 'forest-screen' },
    tabs,
    app.canvasWrap,
    tool ? buildBar(app) : h('div', { class: 'row gap' },
      h('button', { type: 'button', class: 'btn', onclick: () => { app.buildTool = { kind: 'place', def: null }; app.render(); } }, '🔨 Build & decorate'),
      h('span', { class: 'small muted' }, 'Tap a mushroom or structure for details.')),
    ruins.length ? section('Restore to unlock', ruins.map((o) => {
      const def = STRUCTURES[o.def];
      return h('div', { class: 'list-row' },
        h('div', {}, h('b', {}, def.name), def.job ? h('div', { class: 'small' }, `Unlocks the ${JOB_BY_ID[def.job].name} job`) : null, costView(s, def.cost)),
        h('button', { type: 'button', class: 'btn primary', disabled: !G.canAfford(s, def.cost), onclick: () => app.act(() => G.restoreStructure(s, o.id, app.now()), `${def.name} restored!`) }, 'Restore'));
    })) : null,
    stageCard(app),
    projectCard(app),
  );
}

export function stageCard(app) {
  const s = app.state;
  const info = G.nextStageInfo(s);
  if (!info) return section('Forest explored', h('p', {}, 'You have discovered every area of the forest. More areas may grow in future seasons.'));
  const { stage, prevDone, prevStage, progress, target } = info;
  const body = [];
  if (!prevDone) body.push(h('p', {}, `First, restore everything in the ${prevStage.name}.`));
  body.push(h('p', { class: 'small' }, stage.hint || ''));
  if (stage.discover.type === 'jobCycles') {
    body.push(h('div', { class: 'progress' }, h('span', { style: { width: `${(progress / target) * 100}%` } })), h('div', { class: 'small' }, `${progress} / ${target}`));
  }
  return section(`Next discovery: ??? (${STAGES.indexOf(stage) + 1}/${STAGES.length})`, body);
}

function projectCard(app) {
  const s = app.state;
  const out = [];
  for (const [id, p] of Object.entries(PROJECTS)) {
    const cur = s.projects[id];
    if (cur?.state === 'done') continue;
    if (!G.stageComplete(s, p.requiresStage)) continue;
    if (!cur || cur.state === 'none') {
      out.push(h('div', { class: 'list-row' }, h('div', {}, h('b', {}, p.name), h('div', { class: 'small' }, p.desc), costView(s, p.cost)),
        h('button', { type: 'button', class: 'btn primary', disabled: !G.canAfford(s, p.cost), onclick: () => app.act(() => G.startProject(s, id)) }, 'Start')));
    } else {
      const builders = G.workersOn(s, 'builder').length;
      out.push(h('div', {}, h('b', {}, p.name), h('div', { class: 'progress' }, h('span', { style: { width: `${(cur.progress / p.work) * 100}%` } })),
        h('div', { class: 'small' }, `${cur.progress.toFixed(1)} / ${p.work} work · ${builders ? `${builders} Builder(s) working` : 'Assign Builders at the Building Site'}`)));
    }
  }
  return out.length ? section('Projects', out) : null;
}

function buildBar(app) {
  const s = app.state;
  const tool = app.buildTool;
  const defs = Object.entries(STRUCTURES).filter(([id, d]) => d.buildable);
  const setTool = (t) => { app.buildTool = t; app.render(); };
  const kinds = [['place', 'Place'], ['paint', 'Paint ground'], ['move', 'Move'], ['remove', 'Remove']];
  return h('div', { class: 'card build-bar' },
    h('div', { class: 'row gap wrap' },
      kinds.map(([k, label]) => h('button', { type: 'button', class: 'btn small' + (tool.kind === k ? ' primary' : ''), onclick: () => setTool(k === 'place' ? { kind: 'place', def: null } : k === 'paint' ? { kind: 'paint', code: 'm' } : k === 'move' ? { kind: 'move', objectId: null } : { kind: 'remove' }) }, label)),
      h('button', { type: 'button', class: 'btn small', onclick: () => setTool(null) }, 'Done')),
    tool.kind === 'place' ? h('div', { class: 'build-list' }, defs.map(([id, d]) => {
      const avail = G.buildable(s, id);
      const cost = d.buildCost || d.cost;
      return h('button', {
        type: 'button', class: 'build-item' + (tool.def === id ? ' selected' : '') + (avail ? '' : ' locked'),
        disabled: !avail, onclick: () => setTool({ kind: 'place', def: id }),
      }, h('b', {}, d.name), h('span', { class: 'small' }, avail ? (d.kind === 'decor' ? 'Decoration — attracts Wild Visitors' : d.kind === 'home' ? `+${d.capacity} residents` : `+${d.slots} ${JOB_BY_ID[d.job].name} slot(s)`) : lockText(d)), costView(s, cost));
    })) : null,
    tool.kind === 'paint' ? h('div', {}, h('div', { class: 'row gap wrap' }, PAINTABLE_TERRAIN.map((c) => h('button', {
      type: 'button', class: 'btn small terrain-btn' + (tool.code === c ? ' primary' : ''), onclick: () => setTool({ kind: 'paint', code: c }),
    }, h('span', { class: 'swatch', style: { background: TERRAIN[c].color } }), TERRAIN[c].name))), h('div', { class: 'small' }, 'Tap tiles to paint. Each tile costs ', costView(s, TERRAIN_PAINT_COST), '. Moss, damp soil and shade attract different Wild Visitors.')) : null,
    h('p', { class: 'small hint' }, {
      place: tool.def ? `Tap an empty tile to place a ${STRUCTURES[tool.def].name}.` : 'Choose something to build, then tap a tile.',
      paint: 'Tap tiles to change the ground.',
      move: tool.objectId ? 'Tap an empty tile to move it there.' : 'Tap a decoration, home or extra workstation to move it.',
      remove: 'Tap a decoration or extra structure to remove it.',
    }[tool.kind]));
}

function lockText(d) {
  if (d.requiresStage) return `Requires ${STAGE_BY_ID[d.requiresStage].name}`;
  if (d.job) return `Unlock ${JOB_BY_ID[d.job].name} first`;
  return 'Locked';
}

/** Modal for a tapped structure. */
export function objectPanel(app, id) {
  const s = app.state;
  const found = G.objectById(s, id);
  if (!found) return;
  const o = found.obj;
  const def = STRUCTURES[o.def];
  const body = [];
  if (o.state === 'ruin') {
    body.push(h('p', {}, 'Overgrown and in need of restoration.'));
    if (def.job) body.push(h('p', {}, `Restoring it unlocks the ${JOB_BY_ID[def.job].name} job: ${JOB_BY_ID[def.job].desc}`));
    body.push(costView(s, def.cost));
    const m = app.modal(body, {
      title: def.name,
      footer: [h('button', { type: 'button', class: 'btn primary', disabled: !G.canAfford(s, def.cost), onclick: () => { m.close(); app.act(() => G.restoreStructure(s, o.id, app.now()), `${def.name} restored!`); } }, 'Restore')],
    });
    return;
  }
  if (def.job) {
    const card = jobCard(app, JOB_BY_ID[def.job], true);
    app.modal(card, { title: def.name });
    return;
  }
  if (o.def === 'breeding_nook') {
    const st = BREEDING_STATIONS[s.station];
    const m = app.modal([h('p', {}, `Your breeding station: ${st.name}.`), h('p', {}, 'Pair two mushrooms here to grow a spore cluster that hatches into a new mushroom.')], {
      title: st.name, footer: [h('button', { type: 'button', class: 'btn primary', onclick: () => { m.close(); app.go('breed'); } }, 'Go to Breeding')],
    });
    return;
  }
  if (o.def === 'trading_stump') {
    const m = app.modal([h('p', {}, 'The Trading Stump buys surplus resources for Glimmer (with a daily limit per resource).')], {
      title: 'Trading Stump', footer: [h('button', { type: 'button', class: 'btn primary', onclick: () => { m.close(); app.ui.moreTab = 'inventory'; app.go('more'); } }, 'Open trading')],
    });
    return;
  }
  if (def.kind === 'home') {
    app.modal([h('p', {}, `A cozy home for ${def.capacity} more resident mushrooms.`), h('p', {}, `Residents: ${G.residents(s).length} / ${G.residentCap(s)}`)], { title: def.name });
    return;
  }
  if (o.def === 'moonstone_ring') {
    app.modal(h('p', {}, 'A ring of softly glowing moonstones — a rare habitat. While it exists, rare attribute variations can appear in offspring, and Starfall Aura mutations are twice as likely.'), { title: 'Moonstone Ring' });
    return;
  }
  app.modal(h('p', {}, `A decoration. It shapes the habitat${def.habitat ? ` (${def.habitat})` : ''}, which influences which Wild Visitors arrive.`), { title: def.name });
}

export { assignPicker };
