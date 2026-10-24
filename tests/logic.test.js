// Run with: npm test   (Node 18+, no installs needed)
// These pin down the rules in js/logic.js. Change a rule? Change its test too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, diffDays, todayKey, weekStartKey } from '../js/dates.js';
import {
  change, comparisonSpans, dayScore, dayStatus, levelFromXp, score, streaks, weekTally, xpBetween,
} from '../js/logic.js';

const settings = { weekStart: 1, dayStartHour: 3, partialCredit: true, xp: { 1: 10, 2: 20, 3: 35 } };
const habit = (over = {}) => ({
  id: 'h', name: 'H', type: 'check', target: 1, schedule: { kind: 'daily', days: [], perWeek: 4 },
  weight: 1, difficulty: 1, startDate: '2026-10-01', archivedAt: null, ...over,
});
/** log({ '2026-10-20': 1, '2026-10-21': 'skip' }) → entries for habit 'h' */
const log = (days, id = 'h') => {
  const entries = {};
  for (const [k, v] of Object.entries(days)) {
    entries[k] = { [id]: v === 'skip' ? { value: 0, skipped: true } : { value: v, skipped: false } };
  }
  return entries;
};
const merge = (...parts) => {
  const out = {};
  for (const p of parts) for (const [k, v] of Object.entries(p)) out[k] = { ...out[k], ...v };
  return out;
};

test('date keys survive month ends and the October DST switch', () => {
  assert.equal(addDays('2026-10-24', 1), '2026-10-25');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(diffDays('2026-11-01', '2026-10-24'), 8);
});

test('weeks start on Monday or Sunday', () => {
  assert.equal(weekStartKey('2026-10-24', 1), '2026-10-19'); // Saturday → Monday
  assert.equal(weekStartKey('2026-10-25', 1), '2026-10-19'); // Sunday belongs to the same week
  assert.equal(weekStartKey('2026-10-24', 0), '2026-10-18'); // Sunday start
});

test('day start hour: 01:30 still counts as the previous day', () => {
  const night = new Date(2026, 9, 25, 1, 30).getTime();
  assert.equal(todayKey(3, night), '2026-10-24');
  assert.equal(todayKey(0, night), '2026-10-25');
});

test('daily streak: today pending keeps it, a miss breaks it, a skip steps over', () => {
  const h = habit();
  const today = '2026-10-24';
  let s = { habits: [h], settings, entries: log({ '2026-10-21': 1, '2026-10-22': 1, '2026-10-23': 1 }) };
  assert.equal(streaks(s, h, today).current, 3);
  s = { ...s, entries: merge(s.entries, log({ '2026-10-24': 1 })) };
  assert.equal(streaks(s, h, today).current, 4);
  s = { ...s, entries: log({ '2026-10-20': 1, '2026-10-21': 'skip', '2026-10-22': 1, '2026-10-23': 1 }) };
  assert.equal(streaks(s, h, today).current, 3);
  s = { ...s, entries: log({ '2026-10-19': 1, '2026-10-20': 1, '2026-10-21': 1, '2026-10-23': 1 }) };
  assert.deepEqual([streaks(s, h, today).current, streaks(s, h, today).best], [1, 3]);
});

test('specific-day habits ignore unscheduled days', () => {
  const h = habit({ schedule: { kind: 'days', days: [1, 3, 5], perWeek: 3 } }); // Mon Wed Fri
  const s = { habits: [h], settings, entries: log({ '2026-10-19': 1, '2026-10-21': 1, '2026-10-23': 1 }) };
  assert.equal(streaks(s, h, '2026-10-24').current, 3);
  assert.equal(dayStatus(s, h, '2026-10-22', '2026-10-24'), 'off');
});

test('count habits: below target is partial credit, not done', () => {
  const h = habit({ type: 'count', target: 3 });
  const s = { habits: [h], settings, entries: log({ '2026-10-23': 2 }) };
  assert.equal(dayStatus(s, h, '2026-10-23', '2026-10-24'), 'partial');
  assert.equal(Math.round(dayScore(s, '2026-10-23').pct * 100), 67);
  const strict = { ...s, settings: { ...settings, partialCredit: false } };
  assert.equal(dayScore(strict, '2026-10-23').pct, 0);
});

test('weekly goal: streak counts weeks and the current week never breaks it', () => {
  const h = habit({ schedule: { kind: 'weekly', days: [], perWeek: 4 }, startDate: '2026-10-05' });
  const four = (mon) => Object.fromEntries([0, 1, 3, 5].map((i) => [addDays(mon, i), 1]));
  const s = { habits: [h], settings, entries: log({ ...four('2026-10-05'), ...four('2026-10-12'), '2026-10-19': 1 }) };
  assert.equal(streaks(s, h, '2026-10-21').current, 2); // this week (1/4) is still open
  assert.equal(weekTally(s, h, '2026-10-19').count, 1);
});

test('weekly goal is pro-rated mid-week', () => {
  const h = habit({ schedule: { kind: 'weekly', days: [], perWeek: 4 } });
  const s = { habits: [h], settings, entries: log({ '2026-10-19': 1, '2026-10-20': 1 }) };
  // Mon–Wed expects 4 × 3/7 ≈ 1.71 sessions; 2 done → 100%
  assert.equal(score(s, '2026-10-19', '2026-10-21').pct, 1);
  // The full week expects 4; 2 done → 50%
  assert.equal(score(s, '2026-10-19', '2026-10-25').pct, 0.5);
});

test('score is a weighted average of habits', () => {
  const a = habit({ id: 'a', weight: 3 });
  const b = habit({ id: 'b', weight: 1 });
  const s = { habits: [a, b], settings, entries: log({ '2026-10-23': 1 }, 'a') };
  assert.equal(score(s, '2026-10-23', '2026-10-23').pct, 0.75); // (3×1 + 1×0) / 4
});

test('skipped days are left out of scores', () => {
  const h = habit();
  const s = { habits: [h], settings, entries: log({ '2026-10-22': 1, '2026-10-23': 'skip' }) };
  assert.equal(score(s, '2026-10-22', '2026-10-23').pct, 1);
});

test('XP follows difficulty, levels at 100 / 300 / 600 XP', () => {
  const h = habit({ difficulty: 3 });
  const s = { habits: [h], settings, entries: log({ '2026-10-22': 1, '2026-10-23': 1, '2026-10-24': 0 }) };
  assert.equal(xpBetween(s), 70);
  assert.deepEqual([levelFromXp(0).level, levelFromXp(99).level, levelFromXp(100).level, levelFromXp(600).level], [1, 1, 2, 4]);
});

test('comparison uses finished days only', () => {
  const thu = comparisonSpans('2026-10-22', 1);
  assert.deepEqual(thu.cur, { from: '2026-10-19', to: '2026-10-21' });
  assert.deepEqual(thu.prev, { from: '2026-10-12', to: '2026-10-14' });
  const mon = comparisonSpans('2026-10-19', 1);
  assert.equal(mon.mode, 'full-week');
  assert.deepEqual(mon.cur, { from: '2026-10-12', to: '2026-10-18' });
});

test('change reports points and relative %', () => {
  assert.deepEqual(change(0.82, 0.73), { pts: 9, rel: 9 / 73 });
  assert.equal(change(0.5, 0).rel, null);
  assert.equal(change(null, 0.5), null);
});
