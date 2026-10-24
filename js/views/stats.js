// views/stats.js — the dashboard: are you doing better than last week, and where?

import { DOW, weekday, fromKey } from '../dates.js';
import { change, comparisonSpans, levelFromXp, perfectDays, score, streaks, weeklyTrend, xpBetween } from '../logic.js';
import { esc, fmtNum, fmtPct, hc, plural } from '../ui.js';

const span = ({ from, to }) => (from === to ? DOW[weekday(from)] : `${DOW[weekday(from)]}–${DOW[weekday(to)]}`);
const width = (p) => `${((p ?? 0) * 100).toFixed(1)}%`;

export function render(app) {
  const { state, today } = app;
  const habits = state.habits.filter((h) => !h.archivedAt);
  const header = `<header class="hero hero-plain"><div class="hero-title left"><h1>Progress</h1></div></header>`;
  if (!habits.length) return `${header}<div class="content"><p class="empty-note">Add a habit and your stats will build up here.</p></div>`;

  const { mode, cur, prev } = comparisonSpans(today, state.settings.weekStart);
  const toDate = mode === 'week-to-date';
  const a = score(state, cur.from, cur.to);
  const b = score(state, prev.from, prev.to);
  const d = change(a.pct, b.pct);
  const curName = toDate ? `This week (${span(cur)})` : 'Last week';
  const prevName = toDate ? 'Same days last week' : 'The week before';

  const xpAll = xpBetween(state);
  const level = levelFromXp(xpAll);
  const xpA = xpBetween(state, cur.from, cur.to);
  const xpB = xpBetween(state, prev.from, prev.to);
  const rows = habits.map((h) => ({ h, now: a.byHabit[h.id], before: b.byHabit[h.id], st: streaks(state, h, today) }));
  const best = rows.reduce((m, r) => (r.st.best > (m?.st.best ?? 0) ? r : m), null);

  return `
  ${header}
  <div class="content">
    <section class="group score-card">
      <h2 class="headline">${headline(a.pct, b.pct, d, prevName)}</h2>
      <div class="cmp">
        <div class="cmp-row"><span>${curName}</span><span class="bar"><i style="width:${width(a.pct)}"></i></span><b>${fmtPct(a.pct)}</b></div>
        <div class="cmp-row is-prev"><span>${prevName}</span><span class="bar"><i style="width:${width(b.pct)}"></i></span><b>${fmtPct(b.pct)}</b></div>
      </div>
      <p class="fineprint">${toDate ? 'Today joins the comparison once it’s over, so both sides cover finished days only.' : 'A new week just started, so this compares the last two full weeks.'}
        Scores are weighted by importance.</p>
    </section>

    <section class="group xp-card">
      <div class="xp-head">
        <span class="level-badge big">Level ${level.level}</span>
        <div><b>${fmtNum(xpAll)} XP</b><span class="muted">${fmtNum(level.need - level.into)} XP to level ${level.level + 1}</span></div>
      </div>
      <span class="level-bar"><i style="width:${width(level.pct)}"></i></span>
      <div class="mini-stats">
        <div><span class="label">XP, ${toDate ? 'this week' : 'last week'}</span><b>${fmtNum(xpA)}</b>${relBadge(xpA, xpB)}</div>
        <div><span class="label">Perfect days</span><b>${perfectDays(state, cur.from, cur.to)}</b><small>vs ${perfectDays(state, prev.from, prev.to)}</small></div>
        <div><span class="label">Best streak</span><b>${best ? plural(best.st.best, best.st.unit) : '–'}</b><small>${best ? esc(best.h.name) : ''}</small></div>
      </div>
    </section>

    <section class="group">
      <h2>Weekly score, last 8 weeks</h2>
      <div class="trend">${weeklyTrend(state, today, 8).map(trendBar).join('')}</div>
    </section>

    <section class="group">
      <h2>By habit</h2>
      <div class="htable" role="table">
        <div class="ht-head" role="row"><span>Habit</span><span>${toDate ? 'Now' : 'Last'}</span><span>Before</span><span>Change</span><span>Streak</span></div>
        ${rows.map(habitRow).join('')}
      </div>
      <p class="fineprint">Streak shows current / best, in days (weeks for weekly goals).</p>
    </section>
    ${highlights(rows)}
  </div>`;
}

function headline(cur, prev, d, prevName) {
  if (cur == null) return 'No finished days yet. Check back tomorrow.';
  if (prev == null) return `${fmtPct(cur)} so far. Next week you’ll see how it compares.`;
  if (d.rel == null) return `Up from 0% to ${fmtPct(cur)}.`;
  const pct = Math.round(Math.abs(d.rel) * 100);
  const pts = `<span class="delta ${d.pts > 0 ? 'up' : d.pts < 0 ? 'down' : ''}">${d.pts > 0 ? '+' : ''}${d.pts} pts</span>`;
  if (d.pts === 0) return `Level with ${prevName.toLowerCase()} ${pts}`;
  return `${pct}% ${d.pts > 0 ? 'better' : 'lower'} than ${prevName.toLowerCase()} ${pts}`;
}

function relBadge(a, b) {
  if (!b) return '';
  const r = Math.round(((a - b) / b) * 100);
  return `<small class="${r > 0 ? 'up' : r < 0 ? 'down' : ''}">${r > 0 ? '+' : ''}${r}%</small>`;
}

function trendBar(t) {
  const dt = fromKey(t.from);
  return `<div class="tcol${t.current ? ' is-current' : ''}" title="Week of ${dt.getDate()}/${dt.getMonth() + 1}: ${fmtPct(t.pct)}">
    <span class="tval">${t.pct == null ? '' : Math.round(t.pct * 100)}</span>
    <span class="tbar"><i style="height:${width(t.pct)}"></i></span>
    <span class="tlab">${t.current ? 'Now' : `${dt.getDate()}/${dt.getMonth() + 1}`}</span></div>`;
}

function habitRow({ h, now, before, st }) {
  const d = change(now?.pct, before?.pct);
  const delta = d ? `<span class="${d.pts > 0 ? 'up' : d.pts < 0 ? 'down' : 'muted'}">${d.pts > 0 ? '+' : ''}${d.pts}</span>` : '<span class="muted">–</span>';
  return `<div class="ht-row" role="row" style="${hc(h)}">
    <span class="ht-name"><i>${esc(h.emoji)}</i><span>${esc(h.name)}${h.weight > 1 ? ` <small>×${h.weight}</small>` : ''}</span></span>
    <span>${fmtPct(now?.pct)}</span><span class="muted">${fmtPct(before?.pct)}</span>${delta}
    <span>${st.current}<small>/${st.best}</small></span></div>`;
}

function highlights(rows) {
  const both = rows.filter((r) => r.now && r.before).map((r) => ({ ...r, pts: change(r.now.pct, r.before.pct).pts }));
  if (!both.length) return '';
  const up = both.reduce((m, r) => (r.pts > m.pts ? r : m));
  const down = both.reduce((m, r) => (r.pts < m.pts ? r : m));
  const item = (r, title, text) => `<div class="insight" style="${hc(r.h)}"><span class="tile sm"><span class="tile-face">${esc(r.h.emoji)}</span></span>
    <span><b>${title}</b><small>${text}</small></span></div>`;
  const parts = [];
  if (up.pts > 0) parts.push(item(up, `Biggest gain: ${esc(up.h.name)}`, `Up ${up.pts} points on last week.`));
  if (down.pts < 0) parts.push(item(down, `Needs attention: ${esc(down.h.name)}`, `Down ${-down.pts} points. Could it be easier, or on fewer days?`));
  return parts.length ? `<section class="group insights"><h2>Highlights</h2>${parts.join('')}</section>` : '';
}
