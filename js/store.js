// store.js — the single source of truth.
// All data is one plain object, saved to localStorage as JSON after every change.
// Views never edit it directly: they call the functions below, which save and
// then tell subscribers (app.js) to re-render.
// When you add sync later (Supabase/Firebase), this is the only file that changes.

import { todayKey } from './dates.js';
import { STARTER_HABITS } from './starter.js';

// Still "dawn-habits" from the app's first name. Renaming it would hide everything you've saved.
const STORAGE_KEY = 'dawn-habits';
const SCHEMA = 1;

export const DEFAULT_SETTINGS = {
  weekStart: 1, // 1 = Monday, 0 = Sunday
  dayStartHour: 3, // check-offs before 03:00 count for the previous day
  partialCredit: true, // 2 of 3 dishes = 67% in scores (streaks still need 100%)
  xp: { 1: 10, 2: 20, 3: 35 }, // XP per completion: easy, medium, hard
  theme: 'bully', // the look: 'bully' or 'ink' (Habits → Look)
};

const LOOKS = ['bully', 'ink']; // the ids in THEMES (ui.js)

const emptyState = () => ({
  schema: SCHEMA,
  habits: [],
  entries: {}, // { "2026-10-24": { [habitId]: { value, skipped, updatedAt } } }
  settings: structuredClone(DEFAULT_SETTINGS),
});

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const clamp = (n, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number(n) || fallback));

/** A complete, valid habit from a partial one. Also used to clean up imported backups. */
export function makeHabit(p = {}) {
  const type = ['check', 'count', 'amount', 'time'].includes(p.type) ? p.type : 'check';
  const s = p.schedule || {};
  return {
    id: p.id || newId(),
    name: String(p.name ?? 'New habit'),
    emoji: p.emoji || '✅',
    color: p.color || 'amber', // from the first design; kept so old backups stay complete
    type,
    target: (type === 'count' || type === 'amount') && Number(p.target) > 0 ? Number(p.target) : 1,
    unit: p.unit || '',
    schedule: {
      kind: ['daily', 'days', 'weekly'].includes(s.kind) ? s.kind : 'daily',
      days: Array.isArray(s.days) && s.days.length ? s.days.map(Number) : [1, 2, 3, 4, 5],
      perWeek: clamp(s.perWeek, 1, 7, 3),
    },
    times: p.times && Object.keys(p.times).length ? { ...p.times } : null, // { 1: "06:30", ... } by weekday
    weight: clamp(p.weight, 1, 5, 1),
    difficulty: clamp(p.difficulty, 1, 3, 1),
    startDate: p.startDate || todayKey(),
    archivedAt: p.archivedAt || null,
    createdAt: p.createdAt || Date.now(),
  };
}

// Fill in anything missing so older backups keep working. When the data shape
// changes one day, bump SCHEMA and convert old data here (if (data.schema < 2) ...).
function normalize(data) {
  const base = emptyState();
  const settings = { ...base.settings, ...data.settings, xp: { ...base.settings.xp, ...data.settings?.xp } };
  if (!LOOKS.includes(settings.theme)) settings.theme = base.settings.theme; // e.g. the retired Gothic look
  return {
    schema: SCHEMA,
    habits: Array.isArray(data.habits) ? data.habits.map(makeHabit) : [],
    entries: data.entries && typeof data.entries === 'object' ? data.entries : {},
    settings,
  };
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : emptyState();
  } catch (err) {
    console.error('Could not read saved data', err);
    // Keep the unreadable copy instead of overwriting it with the next save.
    if (raw) {
      try { localStorage.setItem(`${STORAGE_KEY}-unreadable-${Date.now()}`, raw); } catch { /* storage full */ }
    }
    return emptyState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Could not save', err);
    dispatchEvent(new CustomEvent('store-error', { detail: err }));
  }
}

let state = load();
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(state));

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit(mutate) {
  mutate(state);
  save();
  notify();
}

// Data changed in another tab or window (handy on a PC): reload it.
addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  state = load();
  notify();
});

/* ---------- check-offs ---------- */

export function setEntry(key, habitId, patch) {
  commit((s) => {
    const day = (s.entries[key] ||= {});
    // Unchecking sets value 0 instead of deleting: with updatedAt, that's what sync needs later.
    day[habitId] = { value: 0, skipped: false, ...day[habitId], ...patch, updatedAt: Date.now() };
    // Logging a day before the habit existed (backfilling) moves its start back.
    const h = s.habits.find((x) => x.id === habitId);
    if (h && key < h.startDate) h.startDate = key;
  });
}

/* ---------- habits ---------- */

export function saveHabit(habit) {
  commit((s) => {
    const i = s.habits.findIndex((h) => h.id === habit.id);
    if (i === -1) s.habits.push(habit);
    else s.habits[i] = habit;
  });
}

export function setArchived(id, archived) {
  commit((s) => {
    const h = s.habits.find((x) => x.id === id);
    if (h) h.archivedAt = archived ? todayKey(s.settings.dayStartHour) : null;
  });
}

export function deleteHabit(id) {
  commit((s) => {
    s.habits = s.habits.filter((h) => h.id !== id);
    for (const day of Object.values(s.entries)) delete day[id];
  });
}

/** Move a habit up (-1) or down (+1) in the list of active habits. */
export function moveHabit(id, dir) {
  commit((s) => {
    const visible = s.habits.filter((h) => !h.archivedAt);
    const i = visible.findIndex((h) => h.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= visible.length) return;
    const a = s.habits.indexOf(visible[i]);
    const b = s.habits.indexOf(visible[j]);
    [s.habits[a], s.habits[b]] = [s.habits[b], s.habits[a]];
  });
}

export function loadStarterHabits() {
  commit((s) => {
    const startDate = todayKey(s.settings.dayStartHour);
    s.habits.push(...STARTER_HABITS.map((h) => makeHabit({ ...h, startDate })));
  });
}

/* ---------- settings and backups ---------- */

export function updateSettings(patch) {
  commit((s) => {
    s.settings = { ...s.settings, ...patch };
  });
}

export const exportJSON = () => JSON.stringify({ app: 'dawn-habits', exportedAt: new Date().toISOString(), ...state }, null, 2);

/** Parse and validate a backup file. Throws if it isn't one. */
export function parseBackup(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.habits) || typeof data.entries !== 'object') throw new Error('Not a habit backup');
  return normalize(data);
}

export function replaceAll(data) {
  commit((s) => Object.assign(s, data));
}

export const resetAll = () => replaceAll(emptyState());

/* ---------- ask the browser not to clear our storage ---------- */

export async function requestPersistence() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

export async function isPersisted() {
  try { return (await navigator.storage?.persisted?.()) ?? false; } catch { return false; }
}
