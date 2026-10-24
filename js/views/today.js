// views/today.js — the daily checklist.
// Tap a habit to check it off (or add one, for counts). The ⋯ button opens a sheet
// with exact amounts, skip and edit.

import { getState, loadStarterHabits, setEntry } from '../store.js';
import { addDays, fmtLong, relativeDay, weekday, weekStartKey } from '../dates.js';
import {
  credit, entryOf, habitsForDay, isDone, isWeekly, levelFromXp, streaks, targetOf, weekTally, xpBetween, xpFor,
} from '../logic.js';
import { esc, fmtNum, hc, icons, openSheet, plural, ring, skyVars } from '../ui.js';

export function render(app) {
  const { state, today } = app;
  if (!state.habits.length) return welcome();
  const date = app.viewDate || today;
  const list = habitsForDay(state, date);

  // The day's progress counts day-to-day habits. Weekly goals (Gym 4×) can't make a day "incomplete".
  let done = 0;
  let total = 0;
  let sum = 0;
  let wsum = 0;
  for (const h of list) {
    const e = entryOf(state, date, h.id);
    if (isWeekly(h) || e?.skipped) continue;
    total++;
    if (isDone(h, e)) done++;
    sum += h.weight * credit(h, e, state.settings.partialCredit);
    wsum += h.weight;
  }
  const p = wsum ? sum / wsum : 0;
  const level = levelFromXp(xpBetween(state));
  const xpToday = xpBetween(state, date, date);
  const message =
    total === 0 ? 'Nothing due today' : done === total ? 'Every habit done. Perfect day.' : `${plural(total - done, 'habit')} to go`;

  return `
  <header class="hero sky" style="${skyVars(total ? p : 0)}">
    <div class="sun" aria-hidden="true"></div>
    <div class="hero-nav">
      <button class="icon-btn" data-action="prev" aria-label="Previous day">${icons.left}</button>
      <div class="hero-title">
        ${date === today ? '' : `<p class="hero-kicker">${relativeDay(date, today)}</p>`}
        <h1>${fmtLong(date)}</h1>
      </div>
      <button class="icon-btn" data-action="next" aria-label="Next day" ${date >= today ? 'disabled' : ''}>${icons.right}</button>
    </div>
    <div class="hero-count">
      <span class="hero-big">${done}<small> of ${total}</small></span>
      <span class="hero-msg">${message}</span>
    </div>
    <div class="level" title="${fmtNum(level.into)} of ${fmtNum(level.need)} XP to level ${level.level + 1}">
      <span class="level-badge">Level ${level.level}</span>
      <span class="level-xp">+${fmtNum(xpToday)} XP ${date === today ? 'today' : 'that day'}</span>
      <span class="level-bar"><i style="width:${(level.pct * 100).toFixed(1)}%"></i></span>
    </div>
    ${date === today ? '' : '<button class="pill" data-action="go-today">Back to today</button>'}
  </header>
  <div class="content">
    ${list.length ? `<ul class="group habit-list">${list.map((h) => row(app, h, date)).join('')}</ul>` : '<p class="empty-note">No habits are scheduled for this day.</p>'}
  </div>`;
}

function row(app, h, date) {
  const { state } = app;
  const e = entryOf(state, date, h.id);
  const value = e?.value || 0;
  const target = targetOf(h);
  const done = isDone(h, e);
  const skipped = !!e?.skipped;
  const p = Math.min(1, value / target);
  const st = streaks(state, h, app.today);
  const unit = h.unit ? ` ${esc(h.unit)}` : '';

  const details = [];
  if (skipped) details.push('<span>Skipped</span>');
  const time = h.times?.[weekday(date)];
  if (time) details.push(`<span>by ${time}</span>`);
  if (h.type !== 'check') details.push(`<span>${fmtNum(value)} / ${fmtNum(target)}${unit}</span>`);
  if (isWeekly(h)) {
    const t = weekTally(state, h, weekStartKey(date, state.settings.weekStart));
    details.push(`<span>${t.count >= t.goal ? 'Week goal reached' : `${t.count} of ${t.goal} this week`}</span>`);
  }

  const flash = app.flash === h.id;
  const cls = ['habit', done && 'is-done', skipped && 'is-skipped', flash && 'flash'].filter(Boolean).join(' ');
  return `
  <li class="${cls}" style="${hc(h)}">
    <button class="habit-main" data-action="tap" data-id="${h.id}" aria-pressed="${done}">
      <span class="tile">
        ${!done && !skipped && h.type !== 'check' && p > 0 ? ring(p, { size: 48, stroke: 4, cls: 'tile-ring' }) : ''}
        <span class="tile-face">${done ? icons.check : esc(h.emoji)}</span>
      </span>
      <span class="habit-text">
        <span class="habit-name">${esc(h.name)}</span>
        ${details.length ? `<span class="habit-meta">${details.join('')}</span>` : ''}
      </span>
      ${st.current > 0 ? `<span class="streak" title="Current streak">🔥 ${st.current}<small>${st.unit === 'week' ? 'w' : 'd'}</small></span>` : ''}
    </button>
    <button class="habit-more" data-action="more" data-id="${h.id}" aria-label="Options for ${esc(h.name)}">${icons.more}</button>
    ${flash ? `<span class="xp-pop" aria-hidden="true">+${xpFor(h, state.settings)} XP</span>` : ''}
  </li>`;
}

function welcome() {
  return `
  <header class="hero sky hero-welcome" style="${skyVars(0.35)}">
    <div class="sun" aria-hidden="true"></div>
    <h1>Build the day you want to wake up to</h1>
    <p class="hero-lede">Load the plan you described, or set up habits from scratch. Everything is saved on this device.</p>
  </header>
  <div class="content">
    <button class="group starter" data-action="starter">
      <b>Load my starter habits</b>
      <span>⏰ Up by 06:30 on weekdays, 07:30 at weekends</span>
      <span>🏋️ Gym 4× a week</span>
      <span>🍽️ 3,300 kcal and 🥤 a protein shake</span>
      <span>🧽 Dishes after meals and 🧹 a 10-minute tidy</span>
    </button>
    <button class="btn wide" data-action="create">Create my own habit</button>
  </div>`;
}

/* ---------- tap and sheet ---------- */

export const actions = {
  tap(el, app) {
    const date = app.viewDate || app.today;
    const h = app.state.habits.find((x) => x.id === el.dataset.id);
    if (!h) return;
    const e = entryOf(app.state, date, h.id);
    if (h.type === 'amount' || e?.skipped) return openHabitSheet(app, h.id, date);
    const wasDone = isDone(h, e);
    const value = h.type === 'check' ? (wasDone ? 0 : 1) : (e?.value || 0) + 1;
    app.flash = !wasDone && value >= targetOf(h) ? h.id : null;
    setEntry(date, h.id, { value });
  },
  more: (el, app) => openHabitSheet(app, el.dataset.id, app.viewDate || app.today),
  prev(el, app) {
    app.viewDate = addDays(app.viewDate || app.today, -1);
    app.render();
  },
  next(el, app) {
    const d = addDays(app.viewDate || app.today, 1);
    app.viewDate = d >= app.today ? null : d;
    app.render();
  },
  'go-today'(el, app) {
    app.viewDate = null;
    app.render();
  },
  starter: () => loadStarterHabits(),
  create(el, app) {
    app.returnTo = '#today';
    app.go('#edit/new');
  },
};

/** Quick-add buttons scaled to the target: 3,300 kcal → +100, +200, +500, +1,000. */
function quickSteps(target) {
  const b = Math.max(1, 10 ** (Math.floor(Math.log10(target)) - 1));
  return [b, 2 * b, 5 * b, 10 * b];
}

function openHabitSheet(app, id, date) {
  const habit = () => getState().habits.find((x) => x.id === id);
  const entry = () => entryOf(getState(), date, id);
  const setValue = (v) => {
    const h = habit();
    const value = Math.max(0, Math.round(v * 100) / 100);
    if (!isDone(h, entry()) && value >= targetOf(h)) app.flash = id;
    setEntry(date, id, { value, skipped: false });
  };
  const readInput = (sheet) => parseFloat(String(sheet.root.querySelector('[name=amount]')?.value || '').replace(',', '.'));

  openSheet(() => sheetBody(habit(), entry(), date), {
    add(el, sheet) {
      setValue((entry()?.value || 0) + Number(el.dataset.v));
      sheet.redraw();
    },
    submit(form, sheet) {
      const n = readInput(sheet);
      if (Number.isFinite(n)) setValue((entry()?.value || 0) + n);
      sheet.redraw();
    },
    set(el, sheet) {
      const n = readInput(sheet);
      if (Number.isFinite(n)) setValue(n);
      sheet.redraw();
    },
    toggle(el, sheet) {
      setValue(isDone(habit(), entry()) ? 0 : targetOf(habit()));
      sheet.close();
    },
    reset(el, sheet) {
      setEntry(date, id, { value: 0 });
      sheet.redraw();
    },
    skip(el, sheet) {
      setEntry(date, id, { skipped: !entry()?.skipped });
      sheet.close();
    },
    edit(el, sheet) {
      sheet.close();
      app.returnTo = '#today';
      app.go(`#edit/${id}`);
    },
  });
}

function sheetBody(h, e, date) {
  if (!h) return '<p class="empty-note">This habit no longer exists.</p>';
  const value = e?.value || 0;
  const target = targetOf(h);
  const done = isDone(h, e);
  const unit = h.unit ? ` ${esc(h.unit)}` : '';
  const steps = h.type === 'count' ? [-1, 1] : quickSteps(target);

  const logging =
    h.type === 'check'
      ? `<button class="btn ${done ? '' : 'primary'} wide" data-action="toggle">${done ? 'Mark as not done' : 'Mark as done'}</button>`
      : `<div class="big-value"><b>${fmtNum(value)}</b><span>of ${fmtNum(target)}${unit}</span></div>
         <span class="bar"><i style="width:${Math.min(100, (value / target) * 100).toFixed(1)}%"></i></span>
         <div class="chips">${steps.map((n) => `<button type="button" class="chip" data-action="add" data-v="${n}">${n > 0 ? '+' : '−'}${fmtNum(Math.abs(n))}</button>`).join('')}</div>
         <form class="amount-row">
           <input name="amount" type="text" inputmode="decimal" placeholder="Amount${unit}" autocomplete="off" aria-label="Amount">
           <button class="btn" type="submit">Add</button>
           <button class="btn" type="button" data-action="set">Set total</button>
         </form>`;

  return `
    <div class="sheet-head" style="${hc(h)}">
      <span class="tile${done ? ' is-done' : ''}"><span class="tile-face">${done ? icons.check : esc(h.emoji)}</span></span>
      <div><h2>${esc(h.name)}</h2><p class="muted">${fmtLong(date)}${e?.skipped ? ', skipped' : ''}</p></div>
    </div>
    <div class="sheet-log" style="${hc(h)}">${logging}</div>
    <div class="sheet-list">
      <button class="row-btn" data-action="skip">${icons.skip}<span><b>${e?.skipped ? 'Unskip this day' : 'Skip this day'}</b>
        <small>For rest or sick days. Skipped days don't count against you or break your streak.</small></span></button>
      ${h.type !== 'check' && value > 0 ? `<button class="row-btn" data-action="reset">${icons.reset}<span><b>Reset to 0</b></span></button>` : ''}
      <button class="row-btn" data-action="edit">${icons.edit}<span><b>Edit habit</b><small>Schedule, target, times, importance, difficulty</small></span></button>
    </div>`;
}
