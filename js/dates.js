// dates.js — every day in the app is a local "YYYY-MM-DD" string (a "date key").
//
// Why strings instead of Date objects?
//  - They mean the same day everywhere: no timezone surprises.
//  - They sort correctly as text, so `a < b` compares dates.
//  - They work as object keys (entries["2026-10-24"]) and survive JSON.
// Classic bug avoided: new Date().toISOString().slice(0, 10) is the UTC date,
// which is the wrong day for part of every night in Europe.

export const LOCALE = 'en-GB'; // try 'en-US' or 'nl-NL'

const pad = (n) => String(n).padStart(2, '0');

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Noon, not midnight: adding days across a daylight-saving switch
// can then never land on the wrong calendar day.
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** Whole days from b to a (a minus b). */
export const diffDays = (a, b) => Math.round((fromKey(a) - fromKey(b)) / 86_400_000);

/** 0 = Sunday ... 6 = Saturday, same as Date#getDay(). */
export const weekday = (key) => fromKey(key).getDay();

/** First day of the week that contains `key`. weekStart: 1 = Monday, 0 = Sunday. */
export const weekStartKey = (key, weekStart = 1) => addDays(key, -((weekday(key) - weekStart + 7) % 7));

/** Loop over date keys from `from` to `to`, both included. */
export function* eachDay(from, to) {
  for (let k = from; k <= to; k = addDays(k, 1)) yield k;
}

/** Today's key. With dayStartHour = 3, 01:30 at night still counts as yesterday. */
export const todayKey = (dayStartHour = 0, now = Date.now()) => toKey(new Date(now - dayStartHour * 3_600_000));

/** Weekday numbers in display order, e.g. [1, 2, 3, 4, 5, 6, 0] for a Monday start. */
export const weekOrder = (weekStart = 1) => Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmt = (key, opts) => fromKey(key).toLocaleDateString(LOCALE, opts);
export const fmtLong = (key) => fmt(key, { weekday: 'long', day: 'numeric', month: 'short' });
export const fmtShort = (key) => fmt(key, { day: 'numeric', month: 'short' });

/** "19–25 Oct", or "28 Sep – 4 Oct" when the month changes. */
export function fmtRange(from, to) {
  const a = fromKey(from);
  return a.getMonth() === fromKey(to).getMonth() ? `${a.getDate()}–${fmtShort(to)}` : `${fmtShort(from)} – ${fmtShort(to)}`;
}

export function relativeDay(key, today) {
  const n = diffDays(today, key);
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  return n > 1 ? `${n} days ago` : 'Upcoming';
}
