// Forest screen: area tabs, scene, build mode, restoration and stage progress.
import * as G from '../../core/game.js';
import { STRUCTURES, STAGES, STAGE_BY_ID, JOB_BY_ID, PAINTABLE_TERRAIN, TERRAIN, TERRAIN_PAINT_COST, PROJECTS, BREEDING_STATIONS, THICKET_CLEAR } from '../../content/world.js';
import { h, costView, section } from '../common.js';
import { assignPicker, jobCard } from './jobs.js';

export function renderForest(app) {
  const s = app.state;
  const tool = app.buildTool;
  const ruins = [];
  for (const [, area] of Object.entries(s.world.areas)) for (const o of area.objects) if (o.state === 'ruin') ruins.push(o);
  const affordable = ruins.filter((o) => G.canAfford(s, STRUCTURES[o.def].cost)).length;
  const info = G.nextStageInfo(s);
  const ready = !!info?.ready;

  let pill = null;
  if (!tool && info) {
    if (ready) pill = h('button', { type: 'button', class: 'fv-pill ready', onclick: () => expandModal(app) }, '✨ The forest is ready to grow! Expand ▸');
    else if (info.prevDone && info.stage.discover.type === 'jobCycles') pill = h('button', { type: 'button', class: 'fv-pill', onclick: () => tasksModal(app) }, `Next discovery: ${info.progress}/${info.target}`);
  }
  const top = h('div', { class: 'fv-top' }, pill);

  const bottom = tool ? buildBar(app) : h('div', { class: 'fv-actions' },
    actionBtn('🔨', 'Build', () => { app.buildTool = { kind: 'clear' }; app.render(); }),
    actionBtn('🧭', 'Expand', () => expandModal(app), ready ? 'glow' : ''),
    actionBtn('📋', 'Tasks', () => tasksModal(app), '', affordable));

  app.forestOverlay.replaceChildren(top, bottom);
  // entering build mode: move the clearing in view clear of the build panel
  if (tool) {
    // (re)frame whenever the build panel opens or changes height
    requestAnimationFrame(() => {
      const ph = bottom.getBoundingClientRect().height;
      if (!app.ui.buildFocused || Math.abs(ph - (app.ui.buildPanelH || 0)) > 24) {
        app.ui.buildFocused = true;
        app.ui.buildPanelH = ph;
        app.forest.focusAbove(ph);
      }
    });
  } else if (app.ui.buildFocused) {
    app.ui.buildFocused = false;
    app.forest.computeFit();
    app.forest.focusArea(app.forest.centreArea(), true);
  }
  return app.canvasWrap;
}

function actionBtn(icon, label, onclick, extra = '', badge = 0) {
  return h('button', { type: 'button', class: `fv-btn action ${extra}`, onclick },
    h('span', { class: 'fv-ico', 'aria-hidden': 'true' }, icon), h('span', { class: 'fv-lbl' }, label),
    badge ? h('span', { class: 'fv-badge' }, String(badge)) : null);
}

/** Choose a direction to grow the forest from the clearing in view (or a given one). */
export function expandModal(app, fromId = null, onlyDir = null) {
  const s = app.state;
  fromId = fromId || app.forest.centreArea();
  const info = G.nextStageInfo(s);
  const cell = (dir) => {
    const d = G.DIRECTIONS[dir];
    const opt = G.expansionOption(s, fromId, dir);
    const from = s.world.areas[fromId];
    if (opt.occupied) {
      const n = G.areaAt(s, from.cx + d.dx, from.cy + d.dy);
      return h('button', { type: 'button', class: `dir-btn ${dir}`, disabled: true }, h('b', {}, `${d.arrow} ${d.label}`), h('span', { class: 'small' }, G.areaName(n.id)));
    }
    const what = opt.kind === 'stage' ? 'Something new to discover!' : opt.kind === 'plain' ? 'A quiet glade' : 'Not yet';
    return h('button', {
      type: 'button', class: `dir-btn ${dir}` + (opt.ok ? ' ok' : ''), disabled: !opt.ok,
      onclick: () => {
        md.close();
        const r = app.act(() => G.expandForest(s, fromId, dir, app.now()));
        if (r.ok) { app.forest.computeFit(); app.forest.focusArea(r.id, true); }
      },
    }, h('b', {}, `${d.arrow} ${d.label}`), h('span', { class: 'small' }, what), opt.kind === 'plain' ? costView(s, opt.cost) : null);
  };
  const dirs = onlyDir ? [onlyDir] : ['north', 'west', 'east', 'south'];
  let note;
  if (info?.ready) note = h('p', {}, 'The next part of the forest is ready to be discovered. Choose which way it grows — its structures will appear somewhere in the new clearing.');
  else if (info) note = h('p', { class: 'small' }, info.prevDone ? `Not ready to discover more yet: ${info.stage.hint}` : `Not ready yet: restore everything in the ${info.prevStage.name} first.`,
    G.stageComplete(s, 'workshop') ? ' You can still open a quiet glade for extra building space.' : '');
  else note = h('p', { class: 'small' }, 'Every part of the story forest has been found. Quiet glades give you more room to build.');
  const md = app.modal(h('div', {},
    note,
    h('div', { class: 'dir-grid' + (onlyDir ? ' single' : '') },
      dirs.map(cell),
      onlyDir ? null : h('div', { class: 'dir-centre' }, h('span', { class: 'small muted' }, 'From'), h('b', {}, G.areaName(fromId)))),
    onlyDir ? null : h('p', { class: 'small muted' }, 'Tip: pan to another clearing to expand from there. New ground is wild — expect to clear it out.')),
  { title: onlyDir ? `Expand ${G.DIRECTIONS[onlyDir].label.toLowerCase()} from ${G.areaName(fromId)}` : 'Grow the forest' });
}

/** Restoration, discovery progress and projects — opened from the forest. */
export function tasksModal(app) {
  const s = app.state;
  const ruins = [];
  for (const [id, area] of Object.entries(s.world.areas)) {
    for (const o of area.objects) if (o.state === 'ruin') ruins.push({ o, st: { name: G.areaName(id) } });
  }
  const md = app.modal(h('div', {},
    ruins.length ? section('Restore to unlock', ruins.map(({ o, st }) => {
      const def = STRUCTURES[o.def];
      const reach = G.objectReachable(s, o.id);
      return h('div', { class: 'list-row' },
        h('div', {}, h('b', {}, def.name), h('div', { class: 'small muted' }, st.name), def.job ? h('div', { class: 'small' }, `Unlocks the ${JOB_BY_ID[def.job].name} job`) : null,
          reach ? costView(s, def.cost) : h('div', { class: 'small warn' }, 'Out of reach — bridge the water or clear the thicket to get there.')),
        h('button', { type: 'button', class: 'btn primary', disabled: !reach || !G.canAfford(s, def.cost), onclick: () => { md.close(); app.act(() => G.restoreStructure(s, o.id, app.now()), `${def.name} restored!`); } }, 'Restore'));
    })) : null,
    cleanupCard(app),
    stageCard(app),
    projectCard(app),
    h('p', { class: 'small muted' }, 'Tip: drag to look around, pinch to zoom, and tap anything in the forest.')), { title: 'Forest tasks' });
}

function cleanupCard(app) {
  const s = app.state;
  let clutter = 0;
  let thicket = 0;
  for (const a of Object.values(s.world.areas)) {
    clutter += a.objects.filter((o) => STRUCTURES[o.def].kind === 'clutter').length;
    thicket += a.tiles.join('').split('u').length - 1;
  }
  if (!clutter && !thicket) return null;
  return section('Clean up', h('p', { class: 'small' }, `${clutter} pieces of clutter and ${thicket} thicket tiles are left to clear. Clearing gives you twigs, leaves, stones and more.`),
    h('button', { type: 'button', class: 'btn', onclick: () => { app.closeAllModals(); app.buildTool = { kind: 'clear' }; app.render(); } }, '🧹 Start clearing'));
}

/** Tapped a thicket tile. */
export function thicketPanel(app, areaId, x, y) {
  const s = app.state;
  const md = app.modal(h('div', {}, h('p', {}, 'Dense thicket. Cut it back to grow the usable ground — the hedge moves back as you clear.'), costView(s, {}), h('p', { class: 'small' }, `You get: ${Object.entries(THICKET_CLEAR).map(([r, n]) => `${n} ${r}`).join(', ')}`)), {
    title: 'Thicket',
    footer: [h('button', { type: 'button', class: 'btn primary', onclick: () => { md.close(); app.act(() => G.clearThicket(s, areaId, x, y), 'Thicket cut back.'); } }, 'Clear it')],
  });
}

export function stageCard(app) {
  const s = app.state;
  const info = G.nextStageInfo(s);
  if (!info) return section('Forest explored', h('p', {}, 'You have discovered every area of the forest. More areas may grow in future seasons.'));
  const { stage, prevDone, prevStage, progress, target } = info;
  const body = [];
  if (info.ready) {
    return section('The forest is ready to grow!', h('p', {}, 'Expand the forest north, east, south or west to discover what lies beyond.'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => { app.closeAllModals(); expandModal(app); } }, '🧭 Choose a direction'));
  }
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
  const kinds = [['clear', 'Clear'], ['place', 'Place'], ['paint', 'Paint'], ['move', 'Move'], ['remove', 'Remove']];
  return h('div', { class: 'card build-bar' },
    h('div', { class: 'row gap wrap' },
      kinds.map(([k, label]) => h('button', { type: 'button', class: 'btn small' + (tool.kind === k ? ' primary' : ''), onclick: () => setTool(k === 'clear' ? { kind: 'clear' } : k === 'place' ? { kind: 'place', def: null } : k === 'paint' ? { kind: 'paint', code: 'm' } : k === 'move' ? { kind: 'move', objectId: null } : { kind: 'remove' }) }, label)),
      h('button', { type: 'button', class: 'btn small', onclick: () => setTool(null) }, 'Done')),
    tool.kind === 'place' ? h('div', { class: 'build-list' }, defs.map(([id, d]) => {
      const avail = G.buildable(s, id);
      const cost = d.buildCost || d.cost;
      return h('button', {
        type: 'button', class: 'build-item' + (tool.def === id ? ' selected' : '') + (avail ? '' : ' locked'),
        disabled: !avail, onclick: () => setTool({ kind: 'place', def: id }),
      }, h('b', {}, d.name), h('span', { class: 'small' }, avail ? (d.kind === 'decor' ? 'Decoration — attracts Wild Visitors' : d.kind === 'home' ? `+${d.capacity} residents` : d.kind === 'bridge' ? 'Crosses the river or a lake' : `+${d.slots} ${JOB_BY_ID[d.job].name} slot(s)`) : lockText(d)), costView(s, cost));
    })) : null,
    tool.kind === 'paint' ? h('div', {}, h('div', { class: 'row gap wrap' }, PAINTABLE_TERRAIN.map((c) => h('button', {
      type: 'button', class: 'btn small terrain-btn' + (tool.code === c ? ' primary' : ''), onclick: () => setTool({ kind: 'paint', code: c }),
    }, h('span', { class: 'swatch', style: { background: TERRAIN[c].color } }), TERRAIN[c].name))), h('div', { class: 'small' }, 'Tap tiles to paint. Each tile costs ', costView(s, TERRAIN_PAINT_COST), '. Moss, damp soil and shade attract different Wild Visitors.')) : null,
    h('p', { class: 'small hint' }, {
      clear: 'Tap weeds, rocks, brambles, branches or thicket to clear them. You keep what you clear.',
      place: tool.def ? `Tap an empty tile to place a ${STRUCTURES[tool.def].name}.` : 'Choose something to build, then tap a tile.',
      paint: 'Tap tiles to change the ground.',
      move: tool.objectId ? 'Tap an empty tile to move it there.' : 'Tap any structure to pick it up, then tap where it should go.',
      remove: 'Tap a decoration, bridge or extra structure to remove it.',
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
    if (!G.objectReachable(s, o.id)) body.push(h('p', { class: 'warn' }, 'Out of reach — build a bridge or clear the thicket to get here.'));
    if (def.job) body.push(h('p', {}, `Restoring it unlocks the ${JOB_BY_ID[def.job].name} job: ${JOB_BY_ID[def.job].desc}`));
    body.push(costView(s, def.cost));
    const m = app.modal(body, {
      title: def.name,
      footer: [h('button', { type: 'button', class: 'btn primary', disabled: !G.canAfford(s, def.cost) || !G.objectReachable(s, o.id), onclick: () => { m.close(); app.act(() => G.restoreStructure(s, o.id, app.now()), `${def.name} restored!`); } }, 'Restore')],
    });
    return;
  }
  if (def.job) {
    const card = jobCard(app, JOB_BY_ID[def.job], true);
    app.modal(card, { title: def.name });
    return;
  }
  if (def.kind === 'clutter') {
    const tools = def.needsStage && !G.stageComplete(s, def.needsStage);
    const reach = G.objectReachable(s, o.id);
    const m = app.modal([h('p', {}, tools ? `Too big to shift by hand — you need tools from the ${STAGE_BY_ID[def.needsStage].name}.` : reach ? 'Clear it away to make room.' : 'Your mushrooms cannot reach it yet.'),
      h('p', { class: 'small' }, `You get: ${Object.entries(def.clear).map(([r, n]) => `${n} ${r}`).join(', ')}`)], {
      title: def.name,
      footer: [h('button', { type: 'button', class: 'btn primary', disabled: tools || !reach, onclick: () => { m.close(); app.act(() => G.clearClutter(s, o.id), 'Cleared!'); } }, 'Clear it')],
    });
    return;
  }
  if (def.kind === 'bridge') {
    app.modal(h('p', {}, 'A little bridge over the water. Mushrooms can cross here.'), { title: 'Bridge' });
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
