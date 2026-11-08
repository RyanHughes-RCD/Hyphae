// App controller: owns the state, the clock, saving, navigation and modals.
import * as G from '../core/game.js';
import { loadFromStorage, writeToStorage } from '../core/save.js';
import { conditionsAt } from '../core/time.js';
import { JOB_BY_ID, STRUCTURES } from '../content/world.js';
import { h, fmt, resIcon, resName } from './common.js';
import { ForestView } from '../render/forest.js';
import { renderForest, objectPanel, thicketPanel } from './screens/forest.js';
import { renderMushrooms, mushroomDetail } from './screens/mushrooms.js';
import { renderBreed } from './screens/breed.js';
import { renderJobs } from './screens/jobs.js';
import { renderGuide } from './screens/guide.js';
import { renderMore } from './screens/more.js';

const NAV = [
  { id: 'forest', label: 'Forest', icon: '🌳' },
  { id: 'mushrooms', label: 'Mushrooms', icon: '🍄' },
  { id: 'breed', label: 'Breed', icon: '✨' },
  { id: 'jobs', label: 'Jobs', icon: '🧺' },
  { id: 'guide', label: 'Guide', icon: '📖' },
  { id: 'more', label: 'More', icon: '☰' },
];

export class App {
  constructor(root) {
    this.root = root;
    this.screen = 'forest';
    this.ui = { mushroomsTab: 'resident', sort: 'newest', breed: { a: null, b: null, picking: null }, guideTab: 'attributes', moreTab: 'inventory', jobOpen: null };
    this.buildTool = null;
    this.game = G; // the forest view reads world helpers through this
    this.modalStack = [];
    this.lastSave = 0;
    this.devMode = new URLSearchParams(location.search).has('dev');
  }

  now() {
    return Date.now() + (this.state?.dev?.timeOffset || 0);
  }

  start() {
    const { state, fromBackup } = loadFromStorage();
    let report = null;
    if (state) {
      this.state = state;
      this.state.tzOffset = new Date().getTimezoneOffset();
      report = G.advance(this.state, this.now());
    } else {
      this.state = G.newGame({ now: Date.now() });
    }
    if (this.devMode) this.state.settings.dev = true;
    this.buildShell();
    this.forest = new ForestView(this.canvas, this);
    this.updateConditions();
    this.render();
    if (fromBackup) this.toast('Your latest save could not be read, so the backup was loaded.');
    if (report && report.elapsed > 2 * 60000) this.showReturnSummary(report);
    this.flushEvents();
    this.save(true);

    setInterval(() => this.tick(), 1000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(true); else this.tick(); });
    window.addEventListener('pagehide', () => this.save(true));
    let last = performance.now();
    const frame = (ts) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      if (this.screen === 'forest' && !document.hidden) {
        this.forest.syncAgents(ts / 1000);
        this.forest.step(dt);
        this.forest.draw(ts / 1000);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  updateConditions() {
    this.conditions = conditionsAt(this.now(), this.state.worldSeed, this.state.tzOffset, this.state.dev.override);
  }

  tick() {
    const before = this.state.breedings.filter((b) => b.state === 'incubating' && b.completesAt <= this.now()).length;
    const report = G.advance(this.state, this.now());
    this.updateConditions();
    if (report.elapsed > 5 * 60000) this.showReturnSummary(report);
    const ready = this.state.breedings.filter((b) => b.state === 'incubating' && b.completesAt <= this.now()).length;
    if (ready > before) this.toast('A spore cluster is ready to hatch! Visit Breed.');
    this.flushEvents();
    this.updateLive(report, ready !== before);
    if (Date.now() - this.lastSave > 10000) this.save();
  }

  save(force = false) {
    if (!this.state) return;
    writeToStorage(this.state);
    this.lastSave = Date.now();
    void force;
  }

  /** Run a simulation action, report failures, persist, refresh. */
  act(fn, okMsg) {
    const res = fn();
    if (res && res.ok === false) {
      this.toast(res.reason || (res.errors || []).join(' '), 'error');
      return res;
    }
    if (okMsg) this.toast(typeof okMsg === 'function' ? okMsg(res) : okMsg);
    this.flushEvents();
    this.save();
    this.render();
    return res;
  }

  flushEvents() {
    const evs = G.takeEvents(this.state);
    if (evs.length && this.main) this.render();
    for (const e of evs) {
      const big = e.type.startsWith('unlock') || e.type === 'discovery' || e.type === 'welcome';
      if (big && !this.state.tutorials[e.type + e.title]) {
        this.state.tutorials[e.type + e.title] = true;
        this.modal(h('div', { class: 'tutorial' }, h('h2', {}, e.title), h('p', {}, e.text), h('p', { class: 'small' }, 'You can read about this any time in the Field Guide.')), { title: null });
      } else if (!big) this.toast(e.title);
    }
  }

  jobName(id) {
    return JOB_BY_ID[id]?.name || id;
  }

  // ---------------------------------------------------------- shell
  buildShell() {
    this.root.innerHTML = '';
    this.header = h('header', { class: 'topbar' });
    this.main = h('main', { class: 'screen' });
    // the forest view: full-screen canvas plus an overlay layer for its controls
    this.canvas = h('canvas', { class: 'forest-canvas', 'aria-label': 'Forest scene. Drag to look around, pinch to zoom, tap a mushroom or structure.' });
    this.forestOverlay = h('div', { class: 'fv-overlay' });
    this.canvasWrap = h('div', { class: 'forest-view' }, this.canvas, this.forestOverlay);
    this.stage = h('div', { class: 'stage' }, this.main);
    this.nav = h('nav', { class: 'bottomnav' }, NAV.map((n) => h('button', { type: 'button', class: 'nav-btn', dataset: { id: n.id }, onclick: () => this.go(n.id) }, h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, n.icon), h('span', {}, n.label))));
    this.modalRoot = h('div', { class: 'modal-root' });
    this.toastRoot = h('div', { class: 'toast-root', 'aria-live': 'polite' });
    this.root.append(this.header, this.stage, this.nav, this.modalRoot, this.toastRoot);
  }

  go(screen) {
    if (screen !== 'forest') this.buildTool = null;
    this.screen = screen;
    this.render();
    this.main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  renderHeader() {
    const s = this.state;
    const c = this.conditions;
    const phaseIcon = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' }[c.phase];
    const weatherIcon = c.raining ? '🌧️' : c.weather === 'cloudy' ? '☁️' : '';
    this.header.replaceChildren(
      h('div', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, '🍄'), h('span', { class: 'forest-name' }, s.forest.name)),
      h('div', { class: 'top-stats' },
        h('span', { class: 'pill', title: `${c.phase}${c.raining ? ', raining' : ''}` }, phaseIcon, weatherIcon, ' ', cap(c.phase)),
        h('span', { class: 'pill glimmer', title: 'Glimmer' }, resIcon('glimmer'), h('b', { dataset: { live: 'glimmer' } }, fmt(s.glimmer)))),
    );
  }

  render() {
    if (!this.state) return;
    this.renderHeader();
    for (const b of this.nav.querySelectorAll('.nav-btn')) {
      b.classList.toggle('active', b.dataset.id === this.screen);
      const ready = b.dataset.id === 'breed' && this.state.breedings.some((x) => x.state === 'incubating' && x.completesAt <= this.now());
      b.classList.toggle('alert', ready);
    }
    const scroll = this.main.scrollTop;
    let node;
    switch (this.screen) {
      case 'mushrooms': node = renderMushrooms(this); break;
      case 'breed': node = renderBreed(this); break;
      case 'jobs': node = renderJobs(this); break;
      case 'guide': node = renderGuide(this); break;
      case 'more': node = renderMore(this); break;
      default: node = renderForest(this);
    }
    const forest = this.screen === 'forest';
    this.main.classList.toggle('forest-mode', forest);
    this.main.replaceChildren(forest ? node : h('div', { class: 'screen-inner' }, node));
    this.main.scrollTop = scroll;
    if (forest) requestAnimationFrame(() => this.forest.resize());
  }

  /** Per-second refresh of live values without a full re-render. */
  updateLive(report, breedingChanged) {
    const g = this.header.querySelector('[data-live="glimmer"]');
    if (g) g.textContent = fmt(this.state.glimmer);
    for (const el of this.main.querySelectorAll('[data-countdown]')) {
      const ms = Number(el.dataset.countdown) - this.now();
      el.textContent = ms > 0 ? (el.dataset.prefix || '') + fmtShort(ms) : el.dataset.done || 'Ready!';
    }
    const busy = this.modalStack.length || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT';
    const periodic = Math.floor(Date.now() / 1000) % 5 === 0;
    if (!busy && (breedingChanged || (periodic && ['jobs', 'more', 'breed'].includes(this.screen)) || (report.cycles && this.screen === 'forest' && periodic))) this.render();
    else if (periodic) this.renderHeader();
  }

  // ---------------------------------------------------------- modals / toasts
  modal(content, opts = {}) {
    const close = () => this.closeModal(wrap);
    const wrap = h('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === wrap && !opts.sticky) close(); } },
      h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'modal-head' }, opts.title ? h('h2', {}, opts.title) : h('span'), h('button', { type: 'button', class: 'icon-btn close', 'aria-label': 'Close', onclick: close }, '✕')),
        h('div', { class: 'modal-body' }, content),
        opts.footer ? h('div', { class: 'modal-foot' }, opts.footer) : null));
    this.modalRoot.appendChild(wrap);
    this.modalStack.push(wrap);
    wrap._onclose = opts.onclose;
    return { close, el: wrap };
  }

  closeModal(wrap) {
    wrap = wrap || this.modalStack[this.modalStack.length - 1];
    if (!wrap) return;
    wrap.remove();
    this.modalStack = this.modalStack.filter((w) => w !== wrap);
    wrap._onclose?.();
  }

  closeAllModals() {
    while (this.modalStack.length) this.closeModal();
  }

  confirm(title, text, okLabel, onOk, danger = false) {
    const m = this.modal(h('p', {}, text), {
      title,
      footer: [h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { type: 'button', class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { m.close(); onOk(); } }, okLabel)],
    });
  }

  toast(text, kind = 'info') {
    const t = h('div', { class: `toast ${kind}` }, text);
    this.toastRoot.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3800);
  }

  showReturnSummary(r) {
    const res = Object.entries(r.resources).filter(([, n]) => n > 0);
    const hrs = r.elapsed / 3600000;
    this.modal(h('div', { class: 'return' },
      h('p', {}, `While you were away (${hrs >= 1 ? hrs.toFixed(1) + ' hours' : Math.round(r.elapsed / 60000) + ' minutes'}${r.clamped ? ', capped at ' + 8 + ' hours' : ''}), your mushrooms completed ${r.cycles} work cycles.`),
      res.length ? h('div', { class: 'res-grid' }, res.map(([id, n]) => h('div', { class: 'res-cell' }, resIcon(id), h('span', {}, resName(id)), h('b', {}, '+' + fmt(n))))) : h('p', { class: 'empty' }, 'Nobody was working. Assign jobs so your forest keeps busy while you are away.'),
      r.glimmer ? h('p', {}, resIcon('glimmer'), ` +${r.glimmer} Glimmer`) : null,
      r.work ? h('p', {}, `Project progress: +${r.work.toFixed(1)}`) : null,
      r.finds ? h('p', {}, `Bonus finds: ${r.finds}`) : null,
      r.discoveries.length ? h('p', {}, 'Discoveries: ', r.discoveries.join(', ')) : null,
      r.readyBreedings ? h('p', { class: 'highlight' }, `${r.readyBreedings} spore cluster(s) ready to hatch!`) : null,
    ), { title: 'Welcome back!' });
  }

  // ---------------------------------------------------------- entry points used by the forest view
  openMushroom(uid) {
    const m = G.findMushroom(this.state, uid);
    if (!m) return;
    mushroomDetail(this, m);
  }

  onTapMushroom(uid) {
    this.openMushroom(uid);
  }

  onTapThicket(areaId, x, y) {
    thicketPanel(this, areaId, x, y);
  }

  onTapObject(id) {
    objectPanel(this, id);
  }

  onTapTile(areaId, x, y) {
    const tool = this.buildTool;
    if (!tool) return;
    const now = this.now();
    if (tool.kind === 'clear') {
      const area = this.state.world.areas[areaId];
      const o = area.objects.find((q) => q.x === x && q.y === y);
      if (o && STRUCTURES[o.def].kind === 'clutter') this.act(() => G.clearClutter(this.state, o.id), (r) => `Cleared! ${gainText(r.gained)}`);
      else if (area.tiles[y][x] === 'u') this.act(() => G.clearThicket(this.state, areaId, x, y), (r) => `Thicket cut back. ${gainText(r.gained)}`);
      return;
    }
    if (tool.kind === 'place') {
      this.act(() => G.buildStructure(this.state, tool.def, areaId, x, y, now), `Built ${STRUCTURES[tool.def].name}.`);
    } else if (tool.kind === 'paint') {
      this.act(() => G.paintTerrain(this.state, areaId, x, y, tool.code));
    } else if (tool.kind === 'move') {
      if (!tool.objectId) {
        const o = this.state.world.areas[areaId].objects.find((q) => q.x === x && q.y === y);
        if (!o) return;
        if (STRUCTURES[o.def].kind === 'clutter') { this.toast('Clear clutter instead of moving it.', 'error'); return; }
        this.buildTool = { kind: 'move', objectId: o.id };
        this.render();
      } else {
        const res = this.act(() => G.moveObject(this.state, tool.objectId, x, y));
        if (res.ok) { this.buildTool = { kind: 'move', objectId: null }; this.render(); }
      }
    } else if (tool.kind === 'remove') {
      const o = this.state.world.areas[areaId].objects.find((q) => q.x === x && q.y === y);
      if (!o) return;
      this.confirm('Remove?', `Remove this ${STRUCTURES[o.def].name}? Materials are not refunded.`, 'Remove', () => this.act(() => G.removeObject(this.state, o.id)), true);
    }
  }
}

export function gainText(g = {}) {
  return Object.entries(g).map(([r, n]) => `+${n} ${resName(r)}`).join(', ');
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtShort(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
