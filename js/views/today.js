// views/today.js — the daily checklist.
// Tap a habit to check it off, add one (counts) or log the time (time habits).
// The ⋯ button opens a sheet with exact amounts, your own time, skip and edit.
// Each look (Habits → Look) has its own header; the list underneath is shared.

import { getState, loadStarterHabits, setEntry } from '../store.js';
import { addDays, fmtLong, fmtShort, fmtWeekday, nowTime, relativeDay, weekday, weekStartKey } from '../dates.js';
import {
  credit, entryOf, goalTime, habitsForDay, isDone, isTimed, isWeekly, levelFromXp, minutesLate, streaks, targetOf,
  timeValue, weekTally, xpBetween, xpFor,
} from '../logic.js';
import { esc, fmtNum, icons, openSheet, plural, stutter, toast } from '../ui.js';

const KANJI = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

export function render(app) {
  const { state, today } = app;
  if (!state.habits.length) return welcome();
  const date = app.viewDate || today;
  const list = habitsForDay(state, date);

  // The day's progress counts day-to-day habits. Weekly goals (Gym 4×) can't make a day "incomplete".
  let done = 0;
  let sum = 0;
  let wsum = 0;
  const segs = [];
  for (const h of list) {
    const e = entryOf(state, date, h.id);
    if (isWeekly(h) || e?.skipped) continue;
    if (isDone(h, e)) done++;
    sum += h.weight * credit(h, e, state.settings.partialCredit);
    wsum += h.weight;
    segs.push(Math.min(1, (e?.value || 0) / targetOf(h)));
  }
  const total = segs.length;
  const left = total - done;
  const d = {
    isToday: date === today,
    kicker: date === today ? '' : relativeDay(date, today),
    weekday: fmtWeekday(date),
    day: fmtShort(date),
    kanji: KANJI[weekday(date)],
    done,
    total,
    p: wsum ? sum / wsum : 0,
    segs,
    level: levelFromXp(xpBetween(state)),
    xp: xpBetween(state, date, date),
    message: total === 0 ? 'Nothing due' : left === 0 ? 'Perfect day' : date < today ? `${left} not done` : `${plural(left, 'habit')} to go`,
  };
  const hero = state.settings.theme === 'ink' ? heroInk : heroBully;
  return `
  ${hero(d)}
  <div class="content">
    ${list.length ? `<ul class="group habit-list">${list.map((h) => row(app, h, date)).join('')}</ul>` : '<p class="empty-note">No habits are scheduled for this day.</p>'}
  </div>`;
}

/* ---------- the three headers ---------- */

const nav = (d, middle) => `
  <div class="hero-nav">
    <button class="icon-btn" data-action="prev" aria-label="Previous day">${icons.left}</button>
    <div class="hero-title">${middle}</div>
    <button class="icon-btn" data-action="next" aria-label="Next day" ${d.isToday ? 'disabled' : ''}>${icons.right}</button>
  </div>`;
const kicker = (d) => (d.kicker ? `<p class="hero-kicker">${d.kicker}</p>` : '');
const count = (d) => stutter(d.total ? `${d.done}/${d.total}` : '0', `${d.done} of ${d.total} done`);
const xpText = (d) => `+${fmtNum(d.xp)} XP ${d.isToday ? 'today' : 'that day'}`;
const level = (d) => `
  <div class="level" title="${fmtNum(d.level.into)} of ${fmtNum(d.level.need)} XP to level ${d.level.level + 1}">
    <span class="level-badge">Level ${d.level.level}</span><span class="level-xp">${xpText(d)}</span>
    <span class="level-bar"><i style="width:${(d.level.pct * 100).toFixed(1)}%"></i></span>
  </div>`;
const back = (d) => (d.isToday ? '' : '<button class="pill" data-action="go-today">Back to today</button>');

/* Bully: a black poster. The count is the headline, in doubled red type; one block per habit. */
const heroBully = (d) => `
  <header class="hero hero-today">
    ${nav(d, `${kicker(d)}<h1 class="hero-date">${d.weekday} ${d.day}</h1>`)}
    <div class="hero-count">${count(d)}</div>
    <p class="hero-msg">${d.message}</p>
    <div class="meter" aria-hidden="true">${d.segs.map((f) => `<i style="--f:${f.toFixed(3)}"></i>`).join('')}</div>
    ${level(d)}${back(d)}
  </header>`;

/* Ink: paper, ink and a red sun that grows as the day fills up. */
const heroInk = (d) => `
  <header class="hero hero-today">
    <span class="sun" style="--p:${d.p.toFixed(3)}" aria-hidden="true"></span>
    <span class="hero-jp" lang="ja" aria-hidden="true">${d.kanji}</span>
    ${nav(d, `${kicker(d)}<h1 class="hero-date">${d.weekday} ${d.day}</h1>`)}
    <div class="hero-count">${count(d)}</div>
    <p class="hero-msg">${d.message}</p>
    ${level(d)}${back(d)}
  </header>`;

/* ---------- the list ---------- */

function lateText(m) {
  if (m == null) return 'logged';
  if (m === 0) return 'on time';
  return m < 0 ? `${-m} min early` : `${m} min late`;
}

function row(app, h, date) {
  const { state } = app;
  const e = entryOf(state, date, h.id);
  const value = e?.value || 0;
  const target = targetOf(h);
  const done = isDone(h, e);
  const skipped = !!e?.skipped;
  const timed = isTimed(h);
  const logged = timed && !!e?.time;
  const st = streaks(state, h, app.today);
  const unit = h.unit ? ` ${esc(h.unit)}` : '';
  const goal = goalTime(h, date);

  const details = [];
  if (skipped) details.push('<span>Skipped</span>');
  if (logged) details.push(`<span class="t-log">${e.time}</span><span>${lateText(minutesLate(h, date, e.time, state.settings.dayStartHour))}</span>`);
  else if (goal) details.push(`<span>by ${goal}</span>`);
  if (h.type === 'count' || h.type === 'amount') details.push(`<span>${fmtNum(value)} / ${fmtNum(target)}${unit}</span>`);
  if (isWeekly(h)) {
    const t = weekTally(state, h, weekStartKey(date, state.settings.weekStart));
    details.push(`<span>${t.count >= t.goal ? 'Week goal reached' : `${t.count} of ${t.goal} this week`}</span>`);
  }

  const fill = !done && !skipped && !timed ? Math.min(1, value / target) : 0;
  const flash = app.flash === h.id;
  const cls = ['habit', done && 'is-done', skipped && 'is-skipped', logged && !done && 'is-late', flash && 'flash'].filter(Boolean).join(' ');
  const logNow = timed && !logged && !skipped && date === app.today ? '<span class="log-now">Log now</span>' : '';
  return `
  <li class="${cls}">
    <button class="habit-main" data-action="tap" data-id="${h.id}" aria-pressed="${done}">
      <span class="tile" style="--fill:${fill.toFixed(3)}"><span class="tile-face">${done ? icons.check : esc(h.emoji)}</span></span>
      <span class="habit-text">
        <span class="habit-name">${esc(h.name)}</span>
        ${details.length ? `<span class="habit-meta">${details.join('')}</span>` : ''}
      </span>
      ${logNow}
      ${st.current > 0 ? `<span class="streak" title="Current streak">${st.current}<small>${st.unit === 'week' ? 'w' : 'd'}</small></span>` : ''}
    </button>
    <button class="habit-more" data-action="more" data-id="${h.id}" aria-label="Options for ${esc(h.name)}">${icons.more}</button>
    ${flash ? `<span class="xp-pop" aria-hidden="true">+${xpFor(h, state.settings)} XP</span>` : ''}
  </li>`;
}

function welcome() {
  return `
  <header class="hero hero-welcome">
    <span class="sun" style="--p:.55" aria-hidden="true"></span>
    <h1 class="wordmark">${stutter('i am habit')}</h1>
    <p class="hero-lede">Load the plan you described, or set up habits from scratch. Everything is saved on this device.</p>
  </header>
  <div class="content">
    <div class="group">
      <button class="starter" data-action="starter">
        <b>Load my starter habits</b>
        <span>Up by 06:30 on weekdays, 07:30 at weekends</span>
        <span>Gym 4× a week</span>
        <span>3,300 kcal and a protein shake</span>
        <span>Dishes after meals and a 10-minute tidy</span>
      </button>
    </div>
    <div class="group"><button class="btn wide" data-action="create">Create my own habit</button></div>
  </div>`;
}

/* ---------- tap and sheet ---------- */

/** Save a logged time, and what it's worth: full marks on time, less when late. */
function logTime(app, h, date, time) {
  const value = timeValue(h, date, time, getState().settings.dayStartHour);
  if (value >= 1 && !isDone(h, entryOf(getState(), date, h.id))) app.flash = h.id;
  setEntry(date, h.id, { time, value, skipped: false });
}

export const actions = {
  tap(el, app) {
    const date = app.viewDate || app.today;
    const h = app.state.habits.find((x) => x.id === el.dataset.id);
    if (!h) return;
    const e = entryOf(app.state, date, h.id);
    if (h.type === 'amount' || e?.skipped) return openHabitSheet(app, h.id, date);
    if (isTimed(h)) {
      // One tap logs "now". Already logged, or a past day? Then pick the time in the sheet.
      if (e?.time || date !== app.today) return openHabitSheet(app, h.id, date);
      const time = nowTime();
      logTime(app, h, date, time);
      toast(`Logged ${time}`, { action: 'Change', timeout: 6000, onAction: () => openHabitSheet(app, h.id, date, true) });
      return;
    }
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

function openHabitSheet(app, id, date, focusTime = false) {
  const habit = () => getState().habits.find((x) => x.id === id);
  const entry = () => entryOf(getState(), date, id);
  const setValue = (v) => {
    const h = habit();
    const value = Math.max(0, Math.round(v * 100) / 100);
    if (!isDone(h, entry()) && value >= targetOf(h)) app.flash = id;
    setEntry(date, id, { value, skipped: false });
  };
  const readNumber = (sheet) => parseFloat(String(sheet.root.querySelector('[name=amount]')?.value || '').replace(',', '.'));

  const sheet = openSheet(() => sheetBody(habit(), entry(), date, app.today), {
    add(el, sheet) {
      setValue((entry()?.value || 0) + Number(el.dataset.v));
      sheet.redraw();
    },
    submit(form, sheet) {
      if (isTimed(habit())) {
        const time = sheet.root.querySelector('[name=time]')?.value;
        if (!time) return toast('Pick a time first');
        logTime(app, habit(), date, time);
        return sheet.close();
      }
      const n = readNumber(sheet);
      if (Number.isFinite(n)) setValue((entry()?.value || 0) + n);
      sheet.redraw();
    },
    'log-now'(el, sheet) {
      logTime(app, habit(), date, nowTime());
      sheet.close();
    },
    set(el, sheet) {
      const n = readNumber(sheet);
      if (Number.isFinite(n)) setValue(n);
      sheet.redraw();
    },
    toggle(el, sheet) {
      setValue(isDone(habit(), entry()) ? 0 : targetOf(habit()));
      sheet.close();
    },
    reset(el, sheet) {
      setEntry(date, id, { value: 0, time: null });
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
  if (focusTime) sheet.root.querySelector('[name=time]')?.focus();
}

function sheetBody(h, e, date, today) {
  if (!h) return '<p class="empty-note">This habit no longer exists.</p>';
  const value = e?.value || 0;
  const target = targetOf(h);
  const done = isDone(h, e);
  const unit = h.unit ? ` ${esc(h.unit)}` : '';
  const goal = goalTime(h, date);

  let logging;
  if (isTimed(h)) {
    const status = e?.time ? lateText(minutesLate(h, date, e.time, getState().settings.dayStartHour)) : goal ? `target ${goal}` : 'not logged yet';
    logging = `
      <div class="big-value${e?.time && !done ? ' is-late' : ''}"><b>${e?.time || '--:--'}</b><span>${status}</span></div>
      ${date === today ? `<button type="button" class="btn primary wide" data-action="log-now">Log now, ${nowTime()}</button>` : ''}
      <form class="amount-row">
        <input name="time" type="time" value="${e?.time || goal || ''}" aria-label="Time">
        <button class="btn" type="submit">Set time</button>
      </form>
      <p class="hint">Didn’t open the app right away? Set the real time yourself.${goal ? ` On time means by ${goal}. Late scores less, down to nothing an hour late.` : ''}</p>`;
  } else if (h.type === 'check') {
    logging = `<button class="btn ${done ? '' : 'primary'} wide" data-action="toggle">${done ? 'Mark as not done' : 'Mark as done'}</button>`;
  } else {
    const steps = h.type === 'count' ? [-1, 1] : quickSteps(target);
    logging = `
      <div class="big-value"><b>${fmtNum(value)}</b><span>of ${fmtNum(target)}${unit}</span></div>
      <span class="bar"><i style="width:${Math.min(100, (value / target) * 100).toFixed(1)}%"></i></span>
      <div class="chips">${steps.map((n) => `<button type="button" class="chip" data-action="add" data-v="${n}">${n > 0 ? '+' : '−'}${fmtNum(Math.abs(n))}</button>`).join('')}</div>
      <form class="amount-row">
        <input name="amount" type="text" inputmode="decimal" placeholder="Amount${unit}" autocomplete="off" aria-label="Amount">
        <button class="btn" type="submit">Add</button>
        <button class="btn" type="button" data-action="set">Set total</button>
      </form>`;
  }
  const canReset = h.type !== 'check' && (value > 0 || e?.time);
  return `
    <div class="sheet-head">
      <span class="tile${done ? ' is-done' : ''}"><span class="tile-face">${done ? icons.check : esc(h.emoji)}</span></span>
      <div><h2>${esc(h.name)}</h2><p class="muted">${fmtLong(date)}${e?.skipped ? ', skipped' : ''}</p></div>
    </div>
    <div class="sheet-log">${logging}</div>
    <div class="sheet-list">
      <button class="row-btn" data-action="skip">${icons.skip}<span><b>${e?.skipped ? 'Unskip this day' : 'Skip this day'}</b>
        <small>For rest or sick days. Skipped days don't count against you or break your streak.</small></span></button>
      ${canReset ? `<button class="row-btn" data-action="reset">${icons.reset}<span><b>${isTimed(h) ? 'Clear the time' : 'Reset to 0'}</b></span></button>` : ''}
      <button class="row-btn" data-action="edit">${icons.edit}<span><b>Edit habit</b><small>Schedule, target, times, importance, difficulty</small></span></button>
    </div>`;
}
