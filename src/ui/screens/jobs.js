// Jobs screen and assignment picker (GDD 11.2, 15.1).
import * as G from '../../core/game.js';
import { JOBS, STRUCTURES, STAGE_BY_ID, STAGES } from '../../content/world.js';
import { STAT_NAMES } from '../../config.js';
import { h, fmt, resIcon, resName, mushroomThumb, section, empty } from '../common.js';
import { stageCard } from './forest.js';

function structureStage(defId) {
  for (const st of STAGES) if (st.objects.some((o) => o.def === defId)) return st;
  return null;
}

export function jobCard(app, job, inModal = false) {
  const s = app.state;
  const unlocked = G.jobUnlocked(s, job.id);
  const slots = G.jobSlots(s, job.id);
  const workers = G.workersOn(s, job.id);
  const st = structureStage(job.structure);
  return h('div', { class: 'card job' + (unlocked ? '' : ' locked') },
    h('div', { class: 'row space' }, h('h3', {}, job.name), unlocked ? h('span', { class: 'badge' }, `${workers.length}/${slots}`) : h('span', { class: 'badge locked' }, '🔒')),
    h('p', { class: 'small' }, job.desc),
    h('div', { class: 'small' }, `Primary: ${STAT_NAMES[job.primary]}${job.secondary ? ` · Secondary: ${STAT_NAMES[job.secondary]}` : ''}`),
    h('div', { class: 'small' }, 'Produces: ', Object.keys(job.outputs).length ? Object.keys(job.outputs).map((r) => h('span', { class: 'chip' }, resIcon(r), resName(r))) : 'project work', job.inputs ? [' · uses ', Object.entries(job.inputs).map(([r, n]) => `${n} ${resName(r)}`).join(' + ')] : null, job.phases ? ' · works at dusk and night' : null),
    !unlocked ? h('p', { class: 'small warn' }, st && !G.stageDiscovered(s, st.id) ? 'Expand the forest to discover this job.' : `Restore the ${STRUCTURES[job.structure].name} in the ${st ? st.name : 'forest'} to unlock.`) : null,
    unlocked ? h('div', { class: 'workers' }, workers.length ? workers.map((m) => {
      const est = G.estimateJob(s, m, job.id, app.now());
      return h('div', { class: 'worker' },
        h('button', { type: 'button', class: 'linkish', onclick: () => app.openMushroom(m.uid) }, mushroomThumb(app, m, 1), h('span', {}, m.name)),
        h('span', { class: 'small' }, `${est.label} · ${(est.eff * (1 + est.bonus.sum)).toFixed(2)}×`),
        h('button', { type: 'button', class: 'btn small', onclick: () => { app.act(() => G.unassign(s, m.uid)); if (inModal) app.closeModal(); } }, 'Remove'));
    }) : h('p', { class: 'small muted' }, 'No one is working here.')) : null,
    unlocked ? h('button', { type: 'button', class: 'btn primary', disabled: workers.length >= slots, onclick: () => assignPicker(app, job.id) }, workers.length >= slots ? 'All slots full — build another' : 'Assign a mushroom') : null,
  );
}

export function renderJobs(app) {
  const s = app.state;
  const unlocked = JOBS.filter((j) => G.jobUnlocked(s, j.id));
  const locked = JOBS.filter((j) => !G.jobUnlocked(s, j.id));
  const idle = G.residents(s).filter((m) => !m.work);
  return h('div', {},
    h('h2', { class: 'screen-title' }, 'Jobs'),
    idle.length ? h('div', { class: 'card notice' }, `${idle.length} resident(s) have free time: `, idle.map((m) => m.name).join(', '), '.') : null,
    unlocked.map((j) => jobCard(app, j)),
    stageCard(app),
    h('h3', { class: 'sub' }, 'Locked jobs'),
    locked.length ? locked.map((j) => jobCard(app, j)) : empty('Every job is unlocked!'),
  );
}

/** Pick a resident for a job: ranked by job score with an output estimate. */
export function assignPicker(app, jobId) {
  const s = app.state;
  const now = app.now();
  const job = JOBS.find((j) => j.id === jobId);
  const list = G.residents(s).map((m) => ({ m, est: G.estimateJob(s, m, jobId, now) })).sort((a, b) => b.est.score - a.est.score);
  const modal = app.modal(h('div', { class: 'picker' },
    h('p', { class: 'small' }, `Ranked by job score (${STAT_NAMES[job.primary]} ×0.7${job.secondary ? ` + ${STAT_NAMES[job.secondary]} ×0.3` : ''}). Estimates use current time and weather.`),
    list.length ? list.map(({ m, est }) => {
      const outs = Object.entries(est.out).map(([r, n]) => `${n.toFixed(n < 10 ? 1 : 0)} ${resName(r)}`).join(', ') || (est.work ? `${est.work.toFixed(1)} work` : '');
      return h('button', {
        type: 'button', class: 'pick-row' + (m.work?.jobId === jobId ? ' selected' : ''),
        onclick: () => { modal.close(); app.act(() => G.assignJob(s, m.uid, jobId, app.now()), `${m.name} is now a ${job.name}.`); },
      },
      mushroomThumb(app, m, 1),
      h('div', { class: 'grow' },
        h('b', {}, m.name), ' ', h('span', { class: 'small' }, m.work ? `(now: ${app.jobName(m.work.jobId)})` : '(free)'),
        h('div', { class: 'small' }, `Score ${fmt(est.score)} · ${est.label} · ${(est.eff * (1 + est.bonus.sum)).toFixed(2)}×`),
        h('div', { class: 'small muted' }, `≈ ${outs} per hour`),
        est.bonus.parts.length ? h('div', { class: 'small perk-line' }, est.bonus.parts.map((p) => `${p.label} +${Math.round(p.value * 100)}%`).join(' · '), est.bonus.raw > est.bonus.sum ? ' (capped)' : '') : null));
    }) : h('p', { class: 'empty' }, 'No resident mushrooms available.'),
  ), { title: `Assign: ${job.name}` });
}

export { STAGE_BY_ID };
