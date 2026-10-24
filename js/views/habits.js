// views/habits.js — manage habits, change the rules, back up your data.

import {
  deleteHabit, exportJSON, isPersisted, moveHabit, parseBackup, replaceAll, resetAll, setArchived, updateSettings,
} from '../store.js';
import { DOW, weekOrder } from '../dates.js';
import { esc, hc, icons, toast } from '../ui.js';

export const DIFFICULTY = ['', 'Easy', 'Medium', 'Hard'];

export function scheduleText(h, weekStart) {
  const s = h.schedule;
  if (s.kind === 'daily') return 'Every day';
  if (s.kind === 'weekly') return `${s.perWeek}× a week`;
  const order = weekOrder(weekStart);
  const days = [...s.days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (days.length === 7) return 'Every day';
  if (days.join() === '1,2,3,4,5') return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  return days.map((d) => DOW[d]).join(', ');
}

export function render(app) {
  const { settings: s, habits } = app.state;
  const active = habits.filter((h) => !h.archivedAt);
  const archived = habits.filter((h) => h.archivedAt);

  return `
  <header class="hero hero-plain"><div class="hero-title left"><h1>Habits and rules</h1></div></header>
  <div class="content">
    <section class="group list-card">
      ${active
        .map(
          (h, i) => `
        <div class="hrow" style="${hc(h)}">
          <button class="hrow-main" data-action="edit" data-id="${h.id}">
            <span class="tile sm"><span class="tile-face">${esc(h.emoji)}</span></span>
            <span class="habit-text"><span class="habit-name">${esc(h.name)}</span>
              <span class="habit-meta"><span>${scheduleText(h, s.weekStart)}</span><span>Importance ×${h.weight}</span><span>${DIFFICULTY[h.difficulty]}</span></span></span>
          </button>
          <span class="hrow-order">
            <button class="icon-btn sm" data-action="up" data-id="${h.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(h.name)} up">${icons.up}</button>
            <button class="icon-btn sm" data-action="down" data-id="${h.id}" ${i === active.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(h.name)} down">${icons.down}</button>
          </span>
        </div>`,
        )
        .join('')}
      <button class="add-row" data-action="new">${icons.plus}<span>New habit</span></button>
    </section>

    ${
      archived.length
        ? `<section class="group list-card"><h2>Archived</h2>
      ${archived
        .map(
          (h) => `<div class="hrow" style="${hc(h)}">
        <span class="hrow-main"><span class="tile sm"><span class="tile-face">${esc(h.emoji)}</span></span><span class="habit-name">${esc(h.name)}</span></span>
        <button class="btn small" data-action="restore" data-id="${h.id}">Restore</button>
        <button class="btn small danger" data-action="remove" data-id="${h.id}">Delete</button></div>`,
        )
        .join('')}</section>`
        : ''
    }

    <section class="group settings">
      <h2>Rules</h2>
      <div class="setting"><span><b>Week starts on</b></span>
        <span class="seg seg-sm">
          <button data-action="week-start" data-v="1" aria-pressed="${s.weekStart === 1}">Mon</button>
          <button data-action="week-start" data-v="0" aria-pressed="${s.weekStart === 0}">Sun</button>
        </span></div>
      <label class="setting"><span><b>New day starts at</b><small>Checking something off at 01:00 still counts for the evening before.</small></span>
        <select name="dayStartHour">${[0, 1, 2, 3, 4, 5, 6].map((hr) => `<option value="${hr}" ${hr === s.dayStartHour ? 'selected' : ''}>0${hr}:00</option>`).join('')}</select></label>
      <label class="setting"><span><b>Partial credit</b><small>2 of 3 dishes scores 67% instead of 0%. Streaks always need the full target.</small></span>
        <input type="checkbox" class="switch" name="partialCredit" ${s.partialCredit ? 'checked' : ''}></label>
      <div class="setting col"><span><b>XP per completion</b><small>Harder habits earn more. Levels start at 100, 300, 600 and 1,000 XP.</small></span>
        <span class="xp-inputs">${[1, 2, 3]
          .map((d) => `<label><span>${DIFFICULTY[d]}</span><input type="number" inputmode="numeric" min="0" max="999" name="xp-${d}" value="${s.xp[d]}"></label>`)
          .join('')}</span></div>
    </section>

    <section class="group settings">
      <h2>Your data</h2>
      <p class="fineprint first">Saved on this device only<span id="persist"></span>. Your phone and PC keep separate copies until sync exists, so export a backup now and then. A backup is also how you copy everything from one device to the other.</p>
      <div class="btn-row">
        <button class="btn" data-action="export">Export backup</button>
        <button class="btn" data-action="import">Import backup</button>
        <input type="file" name="import" accept="application/json,.json" class="visually-hidden" tabindex="-1" aria-hidden="true">
      </div>
      <button class="btn danger wide" data-action="reset">Erase all data on this device</button>
    </section>
    <p class="fineprint center" id="version"></p>
  </div>`;
}

export async function mount(root) {
  const p = root.querySelector('#persist');
  if (p && (await isPersisted())) p.textContent = ', protected from automatic clean-up';
  const v = root.querySelector('#version');
  if (v && 'caches' in window) {
    const key = (await caches.keys()).find((k) => k.startsWith('dawn-'));
    v.textContent = key ? `Offline copy: ${key}` : 'Offline copy not installed yet';
  }
}

export const actions = {
  new(el, app) {
    app.returnTo = '#habits';
    app.go('#edit/new');
  },
  edit(el, app) {
    app.returnTo = '#habits';
    app.go(`#edit/${el.dataset.id}`);
  },
  up: (el) => moveHabit(el.dataset.id, -1),
  down: (el) => moveHabit(el.dataset.id, 1),
  restore: (el) => setArchived(el.dataset.id, false),
  remove(el) {
    if (confirm('Delete this habit and all of its history?')) deleteHabit(el.dataset.id);
  },
  'week-start': (el) => updateSettings({ weekStart: Number(el.dataset.v) }),
  export: (el, app) => exportBackup(app.today),
  import: (el) => el.parentElement.querySelector('input[type=file]').click(),
  reset() {
    if (!confirm('Erase every habit and all history on this device? This can’t be undone. Export a backup first if you might want it back.')) return;
    resetAll();
    toast('All data erased');
  },
};

export function onChange(el, app) {
  const { settings } = app.state;
  if (el.name === 'dayStartHour') updateSettings({ dayStartHour: Number(el.value) });
  else if (el.name === 'partialCredit') updateSettings({ partialCredit: el.checked });
  else if (el.name?.startsWith('xp-')) {
    const xp = Math.min(999, Math.max(0, Math.round(Number(el.value) || 0)));
    updateSettings({ xp: { ...settings.xp, [el.name.slice(3)]: xp } });
  } else if (el.name === 'import' && el.files?.[0]) importBackup(el.files[0]);
}

async function exportBackup(today) {
  const name = `dawn-backup-${today}.json`;
  const file = new File([exportJSON()], name, { type: 'application/json' });
  // On a phone the share sheet can save to Files or AirDrop the backup to your computer.
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Backup exported');
}

async function importBackup(file) {
  let data;
  try {
    data = parseBackup(await file.text());
  } catch {
    toast('That file isn’t a Dawn backup');
    return;
  }
  if (!confirm(`Replace everything on this device with this backup (${data.habits.length} habits)?`)) return;
  replaceAll(data);
  toast('Backup imported');
}
