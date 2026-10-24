// logic.js — the rules of the game, as pure functions.
// (state, dates) go in, numbers come out. No DOM, no storage, so every rule
// is easy to read, change and test: see tests/logic.test.js (`npm test`).

import { addDays, eachDay, toMinutes, weekday, weekStartKey } from './dates.js';

/* ---------- one habit, one day ---------- */

export const isWeekly = (h) => h.schedule.kind === 'weekly';
export const isTimed = (h) => h.type === 'time';

/** What counts as 100%: 3 for "3 meals", 3,300 for kcal, and 1 for check and time habits. */
export const targetOf = (h) => ((h.type === 'count' || h.type === 'amount') && Number(h.target) > 0 ? Number(h.target) : 1);

export const entryOf = (state, key, id) => state.entries[key]?.[id];

/** Tracked on this day? (on or after its start, and before it was archived) */
export const isActive = (h, key) => key >= h.startDate && (!h.archivedAt || key < h.archivedAt);

/** Supposed to happen on this weekday? Weekly goals ("4× a week") can happen any day. */
export const isScheduled = (h, key) => (h.schedule.kind === 'days' ? h.schedule.days.includes(weekday(key)) : true);

export const isDone = (h, e) => !!e && !e.skipped && (e.value || 0) >= targetOf(h);

/** 0–1. With partial credit, 2 of 3 dishes = 0.67. Without it, only "done" counts. */
export function credit(h, e, partial) {
  if (!e || e.skipped) return 0;
  const p = (e.value || 0) / targetOf(h);
  return partial ? Math.min(1, p) : p >= 1 ? 1 : 0;
}

/** Habits to list on a given day. Archived habits disappear from their archive date on. */
export const habitsForDay = (state, key) =>
  state.habits.filter((h) => (!h.archivedAt || key < h.archivedAt) && isScheduled(h, key));

/** What one cell of the week grid shows. */
export function dayStatus(state, h, key, today) {
  if (key > today) return 'future';
  if (!isActive(h, key)) return 'inactive';
  if (!isScheduled(h, key)) return 'off';
  const e = entryOf(state, key, h.id);
  if (e?.skipped) return 'skipped';
  if (isDone(h, e)) return 'done';
  if (isTimed(h) && e?.time) return 'late'; // logged, but after the target time
  if ((e?.value || 0) > 0) return 'partial';
  if (isWeekly(h)) return 'open'; // a rest day isn't a miss for "4× a week"
  return key === today ? 'pending' : 'missed';
}

/* ---------- time habits ("up by 06:30") ---------- */

/** Minutes late that score nothing. In between, the score drops evenly: 15 min late = 75%. */
export const LATE_WINDOW = 60;

/** The target time on that day, like "06:30", or null. Each weekday can have its own. */
export const goalTime = (h, key) => h.times?.[weekday(key)] || null;

/** Minutes after the target (negative = early). Null when the day has no target. */
export function minutesLate(h, key, time, dayStartHour = 0) {
  const goal = goalTime(h, key);
  return goal ? toMinutes(time, dayStartHour) - toMinutes(goal, dayStartHour) : null;
}

/** What a logged time is worth: 1 on time (or with no target), then less, down to 0 at LATE_WINDOW. */
export function timeValue(h, key, time, dayStartHour = 0) {
  const late = minutesLate(h, key, time, dayStartHour);
  if (late == null || late <= 0) return 1;
  return Math.max(0, Math.round((1 - late / LATE_WINDOW) * 100) / 100);
}

/** Logged times from `from` to `to`: average, earliest and latest (in minutes) and how many were on time. */
export function timeStats(state, h, from, to) {
  const dsh = state.settings.dayStartHour;
  const mins = [];
  let onTime = 0;
  for (const key of eachDay(from, to)) {
    const e = entryOf(state, key, h.id);
    if (!e?.time || e.skipped) continue;
    mins.push(toMinutes(e.time, dsh));
    if (isDone(h, e)) onTime++;
  }
  if (!mins.length) return null;
  const avg = mins.reduce((a, b) => a + b, 0) / mins.length;
  return { avg, logged: mins.length, onTime, earliest: Math.min(...mins), latest: Math.max(...mins) };
}

/* ---------- weekly goals ---------- */

/** Sessions in the week that starts on wkStart, and how many are needed. */
export function weekTally(state, h, wkStart) {
  let avail = 0;
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const key = addDays(wkStart, i);
    if (!isActive(h, key)) continue;
    const e = entryOf(state, key, h.id);
    if (e?.skipped) continue; // skipped days shrink the goal
    avail++;
    if (isDone(h, e)) count++;
  }
  const goal = h.schedule.perWeek;
  // A partial week (first week, sick days) needs a proportional number of sessions.
  const required = Math.ceil((goal * avail) / 7 - 1e-9);
  return { count, goal, required, avail, met: avail > 0 && count >= required };
}

/* ---------- streaks ---------- */

/**
 * current: scheduled days in a row that were completed (weeks in a row for weekly goals).
 * Unscheduled and skipped days are stepped over. Today never breaks a streak: you still have time.
 * best: the longest run ever.
 */
export const streaks = (state, h, today) => (isWeekly(h) ? weeklyStreaks(state, h, today) : dailyStreaks(state, h, today));

const lastTrackedDay = (h, today) => (h.archivedAt && h.archivedAt <= today ? addDays(h.archivedAt, -1) : today);

function dailyStreaks(state, h, today) {
  let run = 0;
  let best = 0;
  for (const key of eachDay(h.startDate, lastTrackedDay(h, today))) {
    if (!isScheduled(h, key)) continue;
    const e = entryOf(state, key, h.id);
    if (e?.skipped) continue;
    if (isDone(h, e)) best = Math.max(best, ++run);
    else if (key !== today) run = 0;
  }
  return { current: run, best, unit: 'day' };
}

function weeklyStreaks(state, h, today) {
  const ws = state.settings.weekStart;
  const thisWeek = weekStartKey(today, ws);
  const lastWeek = weekStartKey(lastTrackedDay(h, today), ws);
  let run = 0;
  let best = 0;
  for (let wk = weekStartKey(h.startDate, ws); wk <= lastWeek; wk = addDays(wk, 7)) {
    const t = weekTally(state, h, wk);
    if (t.avail === 0) continue; // a fully skipped week
    if (t.met) best = Math.max(best, ++run);
    else if (wk !== thisWeek) run = 0; // this week is still in play
  }
  return { current: run, best, unit: 'week' };
}

/* ---------- scores ---------- */

/**
 * How well one habit went over [from, to]: { pct, got, opp }, or null if nothing was due.
 * Weekly goals are pro-rated: by Wednesday, 4× a week expects 4 × 3/7 ≈ 1.7 sessions,
 * so 2 sessions already counts as 100% (on track).
 */
export function habitScore(state, h, from, to) {
  let got = 0;
  let opp = 0;
  if (isWeekly(h)) {
    const weeks = new Map();
    for (const key of eachDay(from, to)) {
      if (!isActive(h, key)) continue;
      const e = entryOf(state, key, h.id);
      if (e?.skipped) continue;
      const wk = weekStartKey(key, state.settings.weekStart);
      const t = weeks.get(wk) ?? { avail: 0, count: 0 };
      t.avail++;
      if (isDone(h, e)) t.count++;
      weeks.set(wk, t);
    }
    for (const { avail, count } of weeks.values()) {
      const expected = (h.schedule.perWeek * avail) / 7;
      opp += expected;
      got += Math.min(count, expected);
    }
  } else {
    for (const key of eachDay(from, to)) {
      if (!isActive(h, key) || !isScheduled(h, key)) continue;
      const e = entryOf(state, key, h.id);
      if (e?.skipped) continue;
      opp += 1;
      got += credit(h, e, state.settings.partialCredit);
    }
  }
  return opp > 0 ? { pct: got / opp, got, opp } : null;
}

/** Overall score = weighted average of each habit's score. Weight 3 counts 3× as much as weight 1. */
export function score(state, from, to) {
  let sum = 0;
  let wsum = 0;
  const byHabit = {};
  for (const h of state.habits) {
    const r = habitScore(state, h, from, to);
    byHabit[h.id] = r;
    if (!r) continue;
    const w = Number(h.weight) || 1;
    sum += w * r.pct;
    wsum += w;
  }
  return { pct: wsum ? sum / wsum : null, byHabit };
}

/** One day's score. Only day-to-day habits count; weekly goals are judged per week. */
export function dayScore(state, key) {
  let sum = 0;
  let wsum = 0;
  let done = 0;
  let total = 0;
  for (const h of state.habits) {
    if (isWeekly(h) || !isActive(h, key) || !isScheduled(h, key)) continue;
    const e = entryOf(state, key, h.id);
    if (e?.skipped) continue;
    const w = Number(h.weight) || 1;
    total++;
    if (isDone(h, e)) done++;
    sum += w * credit(h, e, state.settings.partialCredit);
    wsum += w;
  }
  return { pct: wsum ? sum / wsum : null, done, total };
}

export function perfectDays(state, from, to) {
  let n = 0;
  for (const key of eachDay(from, to)) {
    const d = dayScore(state, key);
    if (d.total > 0 && d.done === d.total) n++;
  }
  return n;
}

/* ---------- XP and levels ---------- */

export const xpFor = (h, settings) => Number(settings.xp?.[h.difficulty]) || 0;

/** XP earned from `from` to `to` (both included). Leave both out for all-time XP. */
export function xpBetween(state, from = '0000-00-00', to = '9999-12-31') {
  const byId = new Map(state.habits.map((h) => [h.id, h]));
  let xp = 0;
  for (const [key, day] of Object.entries(state.entries)) {
    if (key < from || key > to) continue;
    for (const [id, e] of Object.entries(day)) {
      const h = byId.get(id);
      if (h && isDone(h, e)) xp += xpFor(h, state.settings);
    }
  }
  return xp;
}

/** Level L starts at 50·L·(L−1) XP: level 2 at 100, 3 at 300, 4 at 600, 5 at 1,000 ... */
export function levelFromXp(xp) {
  let level = 1;
  while (50 * (level + 1) * level <= xp) level++;
  const floor = 50 * level * (level - 1);
  const need = 50 * (level + 1) * level - floor;
  return { level, into: xp - floor, need, pct: (xp - floor) / need };
}

/* ---------- this week vs last week ---------- */

/**
 * Which two periods to compare. Today isn't over yet, so only finished days count:
 * Monday to yesterday, against the same weekdays last week. On the first day of a
 * week nothing has finished, so it compares last week with the week before.
 */
export function comparisonSpans(today, weekStart) {
  const wk = weekStartKey(today, weekStart);
  if (today > wk) {
    const to = addDays(today, -1);
    return { mode: 'week-to-date', cur: { from: wk, to }, prev: { from: addDays(wk, -7), to: addDays(to, -7) } };
  }
  return {
    mode: 'full-week',
    cur: { from: addDays(wk, -7), to: addDays(wk, -1) },
    prev: { from: addDays(wk, -14), to: addDays(wk, -8) },
  };
}

/**
 * pts: difference in percentage points (73% → 82% is +9 pts).
 * rel: relative change (82 / 73 − 1 = 12% better). Null when last time was 0%.
 */
export function change(cur, prev) {
  if (cur == null || prev == null) return null;
  const a = Math.round(cur * 100);
  const b = Math.round(prev * 100);
  return { pts: a - b, rel: b > 0 ? (a - b) / b : null };
}

/** Score of each of the last n weeks. The current week only counts finished days. */
export function weeklyTrend(state, today, n = 8) {
  const thisWeek = weekStartKey(today, state.settings.weekStart);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const from = addDays(thisWeek, -7 * i);
    const to = i === 0 ? addDays(today, -1) : addDays(from, 6);
    out.push({ from, to, current: i === 0, pct: to >= from ? score(state, from, to).pct : null });
  }
  return out;
}
