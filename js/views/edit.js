// views/edit.js — create or edit a habit.
// Sections appear and disappear through CSS (data-type / data-sched / data-times on the
// <form>), so the form never re-renders while you're filling it in.

import { deleteHabit, makeHabit, saveHabit, setArchived } from '../store.js';
import { DOW, weekOrder } from '../dates.js';
import { COLORS, esc, hc, icons, toast } from '../ui.js';
import { DIFFICULTY } from './habits.js';

const EMOJI = ['⏰', '🌅', '🛏️', '🏋️', '🏃', '🚶', '🍽️', '🥤', '💧', '🥗', '🧽', '🧹', '🧺', '📚', '🧘', '💊', '📵', '✍️'];
const TYPES = [
  ['check', 'Check', 'Done or not done.'],
  ['count', 'Count', 'Tap once per time you do it, e.g. dishes after 3 meals.'],
  ['amount', 'Amount', 'Log amounts towards a target, e.g. 3,300 kcal.'],
];
const SCHEDULES = [['daily', 'Every day'], ['days', 'Some days'], ['weekly', 'Times a week']];

/** A segmented control backed by a hidden input, so the form can read its value. */
const seg = (name, value, options) => `
  <div class="seg" role="group">
    <input type="hidden" name="${name}" value="${value}">
    ${options
      .map(([v, label, sub]) => `<button type="button" data-action="seg" data-name="${name}" data-v="${v}" aria-pressed="${String(v) === String(value)}">${label}${sub ? `<small>${sub}</small>` : ''}</button>`)
      .join('')}
  </div>`;

export function render(app) {
  const id = app.route.param;
  const existing = app.state.habits.find((h) => h.id === id);
  if (id !== 'new' && !existing) {
    return `<div class="content"><p class="empty-note">This habit doesn’t exist any more.</p><button class="btn wide" data-action="back">Go back</button></div>`;
  }
  const h = existing || makeHabit({ name: '', startDate: app.today });
  const { xp, weekStart } = app.state.settings;
  const order = weekOrder(weekStart);

  return `
  <header class="hero hero-plain">
    <div class="hero-nav">
      <button class="icon-btn" data-action="back" aria-label="Back">${icons.left}</button>
      <div class="hero-title"><h1>${existing ? 'Edit habit' : 'New habit'}</h1></div>
      <span class="icon-btn spacer" aria-hidden="true"></span>
    </div>
  </header>
  <form id="editor" class="content editor" data-type="${h.type}" data-sched="${h.schedule.kind}" data-times="${h.times ? 'on' : 'off'}" novalidate autocomplete="off">
    <section class="group form-card">
      <div class="name-row" style="${hc(h)}">
        <input name="emoji" class="emoji-input" value="${esc(h.emoji)}" maxlength="8" aria-label="Emoji">
        <input name="title" value="${esc(h.name)}" placeholder="Name, e.g. Read 20 pages" aria-label="Name" enterkeyhint="done">
      </div>
      <div class="emoji-picks">${EMOJI.map((e) => `<button type="button" data-action="emoji" data-v="${e}" aria-label="Use ${e}">${e}</button>`).join('')}</div>
      <input type="hidden" name="color" value="${h.color}">
      <div class="swatches">${COLORS.map((c) => `<button type="button" class="swatch" style="--hc: var(--c-${c})" data-action="color" data-v="${c}" aria-pressed="${h.color === c}" aria-label="${c}"></button>`).join('')}</div>
    </section>

    <section class="group form-card">
      <h2>How you log it</h2>
      ${seg('type', h.type, TYPES.map(([v, label]) => [v, label]))}
      ${TYPES.map(([v, , hint]) => `<p class="hint only-${v}">${hint}</p>`).join('')}
      <div class="grid2 needs-target">
        <label class="field"><span class="label">Target per day</span><input name="target" inputmode="decimal" value="${h.type === 'check' ? '' : h.target}" placeholder="3"></label>
        <label class="field"><span class="label">Unit</span><input name="unit" value="${esc(h.unit)}" placeholder="meals, kcal, pages"></label>
      </div>
    </section>

    <section class="group form-card">
      <h2>When</h2>
      ${seg('sched', h.schedule.kind, SCHEDULES)}
      <div class="day-chips only-days">${order.map((d) => `<button type="button" class="chip day-chip" data-action="day" data-v="${d}" aria-pressed="${h.schedule.days.includes(d)}">${DOW[d]}</button>`).join('')}</div>
      <label class="field only-weekly"><span class="label">Sessions per week, on any days</span>
        <select name="perWeek">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${n === h.schedule.perWeek ? 'selected' : ''}>${n}× a week</option>`).join('')}</select></label>
      <label class="toggle-row"><span><b>Target time</b><small>Shown on the habit, like “by 06:30”. Each day can have its own time.</small></span>
        <input type="checkbox" class="switch" name="hasTimes" ${h.times ? 'checked' : ''}></label>
      <div class="times only-times">
        <div class="times-all"><input type="time" name="timeAll" value="${h.times?.[order[0]] || ''}" aria-label="One time for every day">
          <button type="button" class="btn small" data-action="time-all">Use for every day</button></div>
        <div class="times-grid">${order.map((d) => `<label><span>${DOW[d]}</span><input type="time" name="time-${d}" value="${h.times?.[d] || ''}"></label>`).join('')}</div>
      </div>
    </section>

    <section class="group form-card">
      <h2>Importance</h2>
      <p class="hint">How much this habit counts towards your weekly score.</p>
      ${seg('weight', h.weight, [1, 2, 3, 4, 5].map((n) => [n, `×${n}`]))}
      <h2>Difficulty</h2>
      <p class="hint">Harder habits earn more XP each time you complete them.</p>
      ${seg('difficulty', h.difficulty, [1, 2, 3].map((d) => [d, DIFFICULTY[d], `${xp[d]} XP`]))}
    </section>

    <div class="form-actions">
      <button type="submit" class="btn primary wide">${existing ? 'Save changes' : 'Add habit'}</button>
      ${
        existing
          ? `<div class="btn-row">
          <button type="button" class="btn" data-action="archive">${existing.archivedAt ? 'Restore habit' : 'Archive habit'}</button>
          <button type="button" class="btn danger" data-action="delete">Delete habit</button></div>
        <p class="fineprint">Archiving hides the habit and keeps its history. Deleting removes both.</p>`
          : ''
      }
    </div>
  </form>`;
}

export function mount(root, app) {
  const form = root.querySelector('#editor');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    save(form, app);
  });
  form.elements.namedItem('hasTimes').addEventListener('change', (e) => {
    form.dataset.times = e.target.checked ? 'on' : 'off';
  });
}

const leave = (app) => app.go(app.returnTo || '#habits');

export const actions = {
  back: leave,
  seg(el) {
    const group = el.closest('.seg');
    group.querySelector('input[type=hidden]').value = el.dataset.v;
    group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    const form = el.closest('form');
    if (el.dataset.name === 'type') form.dataset.type = el.dataset.v;
    if (el.dataset.name === 'sched') form.dataset.sched = el.dataset.v;
  },
  emoji(el) {
    el.closest('form').elements.namedItem('emoji').value = el.dataset.v;
  },
  color(el) {
    const form = el.closest('form');
    form.elements.namedItem('color').value = el.dataset.v;
    form.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    form.querySelector('.name-row').style.setProperty('--hc', `var(--c-${el.dataset.v})`);
  },
  day(el) {
    el.setAttribute('aria-pressed', String(el.getAttribute('aria-pressed') !== 'true'));
  },
  'time-all'(el) {
    const f = el.closest('form').elements;
    const t = f.namedItem('timeAll').value;
    if (!t) return toast('Pick a time first');
    for (let d = 0; d < 7; d++) f.namedItem(`time-${d}`).value = t;
  },
  archive(el, app) {
    const h = app.state.habits.find((x) => x.id === app.route.param);
    const wasArchived = !!h.archivedAt;
    setArchived(h.id, !wasArchived);
    toast(wasArchived ? 'Habit restored' : 'Habit archived');
    leave(app);
  },
  delete(el, app) {
    if (!confirm('Delete this habit and all of its history?')) return;
    deleteHabit(app.route.param);
    toast('Habit deleted');
    leave(app);
  },
};

function save(form, app) {
  const f = form.elements;
  const val = (n) => String(f.namedItem(n)?.value ?? '').trim();
  const name = val('title');
  if (!name) {
    f.namedItem('title').focus();
    return toast('Give the habit a name');
  }
  const type = val('type');
  const kind = val('sched');
  const days = [...form.querySelectorAll('.day-chip[aria-pressed="true"]')].map((b) => Number(b.dataset.v));
  if (kind === 'days' && !days.length) return toast('Pick at least one day');

  let target = 1;
  if (type !== 'check') {
    target = parseFloat(val('target').replace(',', '.'));
    if (!(target > 0)) return toast('Set a target above 0');
  }

  let times = null;
  if (f.namedItem('hasTimes').checked) {
    times = {};
    for (let d = 0; d < 7; d++) if (val(`time-${d}`)) times[d] = val(`time-${d}`);
    if (!Object.keys(times).length) return toast('Add a time, or switch off target time');
  }

  const existing = app.state.habits.find((h) => h.id === app.route.param);
  saveHabit(
    makeHabit({
      ...existing,
      name,
      type,
      target,
      times,
      emoji: val('emoji') || '✅',
      unit: type === 'check' ? '' : val('unit'),
      color: val('color'),
      schedule: { kind, days: days.length ? days : existing?.schedule.days, perWeek: Number(val('perWeek')) },
      weight: Number(val('weight')),
      difficulty: Number(val('difficulty')),
      startDate: existing?.startDate || app.today,
    }),
  );
  toast(existing ? 'Changes saved' : 'Habit added');
  leave(app);
}
