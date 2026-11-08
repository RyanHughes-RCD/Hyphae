// More: inventory & trading, sharing, settings, activity, dev tools.
import * as G from '../../core/game.js';
import { getConfig } from '../../config.js';
import { RESOURCES, RESOURCE_IDS } from '../../content/world.js';
import { exportMushroom, previewImport, importGuest } from '../../core/share.js';
import { saveFileText, parseSave, clearStorage, writeToStorage } from '../../core/save.js';
import { resolveBreeding } from '../../core/genetics.js';
import { hashHex } from '../../core/rng.js';
import { localParts } from '../../core/time.js';
import { h, fmt, resIcon, section, empty, mushroomCard, statBars, attributeList, traitChip, perkChip, mutationChip } from '../common.js';

export const GAME_VERSION = '0.1.0';

export function renderMore(app) {
  const tabs = [['inventory', 'Inventory'], ['share', 'Share'], ['settings', 'Settings'], ['activity', 'Activity']];
  if (app.state.settings.dev) tabs.push(['dev', 'Dev']);
  const tab = app.ui.moreTab;
  const body = { inventory, share, settings, activity, dev }[tab] || inventory;
  return h('div', {},
    h('h2', { class: 'screen-title' }, 'More'),
    h('div', { class: 'tabs scroll-x' }, tabs.map(([id, label]) => h('button', { type: 'button', class: 'tab' + (tab === id ? ' active' : ''), onclick: () => { app.ui.moreTab = id; app.render(); } }, label))),
    body(app));
}

function inventory(app) {
  const s = app.state;
  const cfg = getConfig().economy;
  const trade = G.tradeInfo(s, app.now());
  const cats = { natural: 'Natural', fungal: 'Fungal', magical: 'Magical', crafted: 'Crafted' };
  const groups = Object.entries(cats).map(([cat, label]) => {
    const ids = RESOURCE_IDS.filter((r) => RESOURCES[r].cat === cat && (s.inventory[r] > 0 || s.discoveries.resSeen?.[r]));
    return section(label, ids.length ? h('div', { class: 'res-table' }, ids.map((r) => {
      const rate = cfg.tradeRates[r];
      const left = cfg.tradeDailyLimit - (trade.sold[r] || 0);
      const qty = Math.min(10, left, s.inventory[r]);
      return h('div', { class: 'res-line' },
        resIcon(r), h('span', { class: 'grow' }, RESOURCES[r].name), h('b', {}, fmt(s.inventory[r])),
        rate ? h('button', {
          type: 'button', class: 'btn small', disabled: qty <= 0 || Math.floor(qty * rate) <= 0,
          title: `${rate} Glimmer each · ${left} more today`,
          onclick: () => app.act(() => G.sellResource(s, r, qty, app.now()), (res) => `+${res.gain} Glimmer`),
        }, `Sell ${qty > 0 ? qty : ''} → ${Math.floor(Math.max(qty, 0) * rate)}✦`) : null);
    })) : empty('Nothing yet.'));
  });
  return h('div', {},
    section('Glimmer', h('p', {}, resIcon('glimmer'), h('b', {}, ` ${fmt(s.glimmer)} Glimmer`)),
      h('p', { class: 'small' }, `Glimmer is earned from every work cycle and by trading surplus at the Trading Stump (up to ${cfg.tradeDailyLimit} of each resource per day). It pays for breeding. It can never be bought.`)),
    groups);
}

export function shareModal(app, m, code) {
  const ta = h('textarea', { readonly: true, rows: 5, class: 'code' }, code);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      app.toast('Share code copied!');
    } catch {
      ta.select();
      document.execCommand?.('copy');
      app.toast('Select the code and copy it.');
    }
  };
  const download = () => downloadFile(`${m.name}-share.json`, JSON.stringify({ format: 'mushroom-forest-share', code }), 'application/json');
  app.modal(h('div', {},
    h('p', {}, `Send this code (or file) to a friend. They can breed with ${m.name} as a Guest — you keep your mushroom.`),
    ta,
    h('p', { class: 'small muted' }, 'The code contains genetics and lineage only — never resources or progress.')), {
    title: `Share ${m.name}`,
    footer: [h('button', { type: 'button', class: 'btn', onclick: download }, 'Download file'), h('button', { type: 'button', class: 'btn primary', onclick: copy }, 'Copy code')],
  });
}

function share(app) {
  const s = app.state;
  const ta = h('textarea', { rows: 4, class: 'code', placeholder: 'Paste a share code (MF1-…) here' });
  const file = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', class: 'file' });
  const result = h('div', {});
  const preview = (text) => {
    const p = previewImport(s, text, app.now());
    if (!p.ok) {
      result.replaceChildren(h('div', { class: 'card error' }, h('b', {}, 'Cannot import:'), h('ul', {}, p.errors.map((e) => h('li', {}, e)))));
      return;
    }
    const g = p.guest;
    result.replaceChildren(h('div', { class: 'card' },
      h('h3', {}, `Preview: ${g.name}`),
      h('p', { class: 'small' }, `From ${g.origin.forestName} · Generation ${g.generation}. Stats are recalculated from its genetics.`),
      mushroomCard(app, g, { onclick: () => {} }),
      statBars(app, g), attributeList(g),
      g.traits.length ? h('div', { class: 'gene-list' }, g.traits.map((t) => traitChip(app, t))) : null,
      g.perks.length ? h('div', { class: 'gene-list' }, g.perks.map((pk) => perkChip(app, pk))) : null,
      g.mutation ? mutationChip(app, g.mutation) : null,
      h('button', { type: 'button', class: 'btn primary', onclick: () => { const r = app.act(() => importGuest(s, text, app.now()), `${g.name} joined your Guest Grove!`); if (r.ok) { ta.value = ''; result.replaceChildren(); } } }, 'Add as Guest')));
  };
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    if (f.size > 20000) { app.toast('That file is too large.', 'error'); return; }
    preview(await f.text());
  });
  const owned = s.mushrooms;
  return h('div', {},
    section('Share a mushroom', h('p', { class: 'small' }, 'Choose one of your mushrooms to create a share code. Guests from friends cannot be re-shared.'),
      h('div', { class: 'card-grid' }, owned.map((m) => mushroomCard(app, m, { onclick: () => { const r = exportMushroom(s, m.uid, Date.now()); if (r.ok) shareModal(app, m, r.code); else app.toast(r.reason, 'error'); } })))),
    section('Import from a friend', ta, h('div', { class: 'row gap wrap' }, h('button', { type: 'button', class: 'btn primary', onclick: () => preview(ta.value) }, 'Preview'), h('label', { class: 'btn' }, 'Open file…', file)), result,
      h('p', { class: 'small muted' }, `Guest Grove: ${s.guests.length}/${getConfig().sharing.guestCap}. Guests are genetic donors: they cannot work and never grant resources. Note: without a server the game cannot prove a code was bred fairly — it only guarantees every Guest is a legal mushroom.`)));
}

function settings(app) {
  const s = app.state;
  const nameIn = h('input', { type: 'text', value: s.forest.name, maxlength: 24, 'aria-label': 'Forest name' });
  const saveIn = h('input', { type: 'file', accept: '.json,application/json', class: 'file' });
  saveIn.addEventListener('change', async () => {
    const f = saveIn.files?.[0];
    if (!f) return;
    try {
      const next = parseSave(await f.text());
      app.confirm('Load this save?', `This replaces your current forest with "${next.forest.name}" (${next.mushrooms.length} mushrooms). Export a backup first if you want to keep this one.`, 'Load save', () => {
        app.state = next;
        app.state.tzOffset = new Date().getTimezoneOffset();
        writeToStorage(app.state);
        app.closeAllModals();
        app.render();
        app.toast('Save loaded.');
      }, true);
    } catch (err) {
      app.toast(`Could not load: ${err.message} Your current save is unchanged.`, 'error');
    }
    saveIn.value = '';
  });
  return h('div', {},
    section('Forest', h('label', { class: 'field' }, 'Forest name', nameIn), h('button', { type: 'button', class: 'btn', onclick: () => {
      const n = G.sanitizeName(nameIn.value);
      if (!n) return app.toast('Please enter a name.', 'error');
      s.forest.name = n; app.save(); app.render(); app.toast('Renamed.');
    } }, 'Save name')),
    section('Display', h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.settings.reducedMotion, onchange: (e) => { s.settings.reducedMotion = e.target.checked; app.save(); } }), ' Reduce motion'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.settings.canopyLight !== false, onchange: (e) => { s.settings.canopyLight = e.target.checked; app.save(); } }), ' Dappled light and sun rays'),
      h('p', { class: 'small muted' }, 'Day and night follow your device\'s local time.')),
    section('Backup', h('p', { class: 'small' }, 'Your forest is saved automatically in this browser. Export a backup file to keep it safe or move it to another device.'),
      h('div', { class: 'row gap wrap' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => downloadFile(`mushroom-forest-${localParts(Date.now(), s.tzOffset).dateKey}.json`, saveFileText(s), 'application/json') }, 'Export save'),
        h('label', { class: 'btn' }, 'Import save…', saveIn))),
    section('Danger zone', h('button', { type: 'button', class: 'btn danger', onclick: () => app.confirm('Start over?', 'This deletes your forest, all mushrooms and progress in this browser. This cannot be undone.', 'Continue', () => app.confirm('Really start over?', 'Last chance — export a backup first if you might want it.', 'Delete everything', () => {
      clearStorage();
      app.state = G.newGame({ now: Date.now() });
      app.save(); app.closeAllModals(); app.go('forest'); app.flushEvents();
    }, true), true) }, 'Reset forest')),
    section('About', h('p', { class: 'small' }, `Mushroom Forest v${GAME_VERSION} · save schema ${s.schemaVersion} · config v${getConfig().configVersion}`),
      h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: s.settings.dev, onchange: (e) => { s.settings.dev = e.target.checked; app.save(); app.render(); } }), ' Developer tools')));
}

function activity(app) {
  const list = app.state.activity;
  return section('Recent activity', list.length ? h('ul', { class: 'activity' }, list.map((a) => h('li', {}, a.title))) : empty('Nothing yet.'));
}

function dev(app) {
  const s = app.state;
  const genIn = h('input', { type: 'number', min: 2, max: 30, value: 6, style: { width: '4em' } });
  const btn = (label, fn) => h('button', { type: 'button', class: 'btn small', onclick: () => { fn(); app.save(); app.render(); } }, label);
  const override = s.dev.override || {};
  return h('div', {},
    section('Developer tools', h('p', { class: 'small warn' }, 'For testing only. Also enabled with ?dev in the URL.'),
      h('div', { class: 'row gap wrap' },
        btn('+50 of everything', () => G.devGrant(s, 50)),
        btn('Unlock all areas & systems', () => { G.devUnlockAll(s, app.now()); app.flushEvents(); }),
        btn('Finish incubations & rests', () => G.devFinishIncubations(s, app.now())),
        btn('+1 hour', () => { s.dev.timeOffset += 3600000; app.tick(); }),
        btn('+8 hours', () => { s.dev.timeOffset += 8 * 3600000; app.tick(); }),
        btn('Reset time offset', () => { s.dev.timeOffset = 0; s.lastSeenAt = Math.min(s.lastSeenAt, Date.now()); }))),
    section('Force next breeding', h('div', { class: 'row gap wrap' },
      ['trait', 'perk', 'mutation'].map((k) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!s.dev.force[k], onchange: (e) => { s.dev.force[k] = e.target.checked; } }), ' ' + k)))),
    section('Conditions override', h('div', { class: 'row gap wrap' },
      h('select', { onchange: (e) => { s.dev.override = { ...override, phase: e.target.value || undefined }; app.updateConditions(); app.render(); } }, ['', 'dawn', 'day', 'dusk', 'night'].map((p) => h('option', { value: p, selected: override.phase === p }, p || 'phase: real'))),
      h('select', { onchange: (e) => { s.dev.override = { ...override, weather: e.target.value || undefined }; app.updateConditions(); app.render(); } }, ['', 'clear', 'rain'].map((p) => h('option', { value: p, selected: override.weather === p }, p || 'weather: real'))))),
    section('Generate test mushroom', h('div', { class: 'row gap' }, 'Generation ', genIn, btn('Create', () => {
      const [a, b] = s.mushrooms;
      const seed = 'dev' + hashHex(Date.now(), Math.random());
      const { offspring } = resolveBreeding(a, b, { ...G.breedingContext(s, app.now(), 'dev', seed), unlocks: { traits: true, perks: true, mutations: true }, force: { trait: true, perk: true, mutation: Math.random() < 0.5 } });
      offspring.generation = Math.max(2, Number(genIn.value) || 6);
      offspring.status = G.residents(s).length < G.residentCap(s) ? 'resident' : 'archived';
      s.mushrooms.push(offspring);
      G.recordDiscovery(s, offspring);
      app.toast(`Created ${offspring.name}`);
    }))));
}

function downloadFile(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name.replace(/[^\w.\- ]/g, '_') });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { RESOURCE_IDS };
