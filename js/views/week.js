// views/week.js — one week at a glance. Tap any day to open it on the Today tab
// (that's also how you fill in a day you forgot).

import { addDays, DOW, fmtRange, fromKey, weekStartKey } from '../dates.js';
import { dayScore, dayStatus, entryOf, isTimed, isWeekly, perfectDays, score, targetOf, weekTally, xpBetween } from '../logic.js';
import { esc, fmtNum, fmtPct, icons } from '../ui.js';

const SAYS = {
  done: 'done', partial: 'partly done', late: 'logged late', missed: 'missed', pending: 'not done yet', skipped: 'skipped',
  off: 'not scheduled', open: 'no session', future: 'upcoming', inactive: 'not tracked yet',
};

export function render(app) {
  const { state, today } = app;
  const start = addDays(weekStartKey(today, state.settings.weekStart), 7 * app.weekOffset);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const habits = state.habits.filter((h) => h.startDate <= end && (!h.archivedAt || h.archivedAt > start));
  const finished = end < today ? end : addDays(today, -1); // today isn't over yet
  const hasFinished = finished >= start;
  const current = app.weekOffset === 0;
  const name = current ? 'This week' : app.weekOffset === -1 ? 'Last week' : `${-app.weekOffset} weeks ago`;

  return `
  <header class="hero hero-plain">
    <div class="hero-nav">
      <button class="icon-btn" data-action="prev" aria-label="Previous week">${icons.left}</button>
      <div class="hero-title"><p class="hero-date">${fmtRange(start, end)}</p></div>
      <button class="icon-btn" data-action="next" aria-label="Next week" ${current ? 'disabled' : ''}>${icons.right}</button>
    </div>
    <h1 class="hero-word">${name}</h1>
  </header>
  <div class="content">
    <section class="group week-summary">
      <div><span class="label">${current ? 'Score so far' : 'Score'}</span><b>${hasFinished ? fmtPct(score(state, start, finished).pct) : '–'}</b></div>
      <div><span class="label">Perfect days</span><b>${hasFinished ? perfectDays(state, start, finished) : 0}</b></div>
      <div><span class="label">XP earned</span><b>${fmtNum(xpBetween(state, start, end))}</b></div>
    </section>
    ${
      habits.length
        ? `<section class="group week-card">
        <div class="week-grid">
          <span></span>
          ${days.map((d) => dayHeader(d, today)).join('')}
          ${habits.map((h) => habitRow(state, h, days, today, start)).join('')}
          <span class="wg-name wg-foot">Day score</span>
          ${days.map((d) => `<span class="wg-score">${d <= today ? pctNumber(dayScore(state, d).pct) : ''}</span>`).join('')}
        </div>
        ${legend(habits.some(isTimed))}
      </section>`
        : '<p class="empty-note">No habits were tracked this week.</p>'
    }
  </div>`;
}

const pctNumber = (p) => (p == null ? '' : Math.round(p * 100));

function dayHeader(d, today) {
  const dt = fromKey(d);
  return `<button class="wg-day${d === today ? ' is-today' : ''}" data-action="open-day" data-date="${d}" ${d > today ? 'disabled' : ''}
    aria-label="Open ${DOW[dt.getDay()]} ${dt.getDate()}"><span>${DOW[dt.getDay()].slice(0, 2)}</span><b>${dt.getDate()}</b></button>`;
}

function habitRow(state, h, days, today, start) {
  const t = isWeekly(h) ? weekTally(state, h, start) : null;
  const cells = days.map((d) => {
    const s = dayStatus(state, h, d, today);
    const p = s === 'partial' || s === 'late' ? Math.min(1, (entryOf(state, d, h.id)?.value || 0) / targetOf(h)) : 0;
    return `<button class="cell s-${s}" style="--p:${p.toFixed(3)}" data-action="open-day" data-date="${d}"
      ${d > today ? 'disabled' : ''} aria-label="${esc(h.name)}, ${d}: ${SAYS[s]}"></button>`;
  });
  return `
    <span class="wg-name"><span class="wg-emoji">${esc(h.emoji)}</span><span class="wg-label">${esc(h.name)}</span>
      ${t ? `<small class="${t.count >= t.goal ? 'ok' : ''}">${t.count}/${t.goal}</small>` : ''}</span>
    ${cells.join('')}`;
}

function legend(withLate) {
  const item = (s, label, p = 0) => `<span><i class="cell s-${s}" style="--p:${p}"></i>${label}</span>`;
  return `<p class="legend">${item('done', 'Done')}${item('partial', 'Partly', 0.5)}${withLate ? item('late', 'Late', 0.5) : ''}${item('missed', 'Missed')}${item('skipped', 'Skipped')}${item('off', 'Not due')}</p>`;
}

export const actions = {
  prev(el, app) {
    app.weekOffset--;
    app.render();
  },
  next(el, app) {
    app.weekOffset = Math.min(0, app.weekOffset + 1);
    app.render();
  },
  'open-day'(el, app) {
    const d = el.dataset.date;
    if (d > app.today) return;
    app.viewDate = d === app.today ? null : d;
    app.go('#today');
  },
};
