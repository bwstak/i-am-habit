// views/stats.js — the dashboard: are you doing better than last week, and where?

import { addDays, DOW, fmtTime, fromKey, toMinutes, weekday } from '../dates.js';
import {
  change, comparisonSpans, entryOf, goalTime, isDone, isScheduled, isTimed, levelFromXp, perfectDays, score, streaks,
  timeStats, weeklyTrend, xpBetween,
} from '../logic.js';
import { esc, fmtNum, fmtPct, plural, stutter } from '../ui.js';

const span = ({ from, to }) => (from === to ? DOW[weekday(from)] : `${DOW[weekday(from)]}–${DOW[weekday(to)]}`);
const width = (p) => `${((p ?? 0) * 100).toFixed(1)}%`;

export function render(app) {
  const { state, today } = app;
  const habits = state.habits.filter((h) => !h.archivedAt);
  const header = '<header class="hero hero-plain"><h1 class="hero-word">Progress</h1></header>';
  if (!habits.length) return `${header}<div class="content"><p class="empty-note">Add a habit and your stats will build up here.</p></div>`;

  const spans = comparisonSpans(today, state.settings.weekStart);
  const { mode, cur, prev } = spans;
  const toDate = mode === 'week-to-date';
  const a = score(state, cur.from, cur.to);
  const b = score(state, prev.from, prev.to);
  const { big, cap } = headline(a.pct, b.pct, change(a.pct, b.pct), toDate ? 'the same days last week' : 'the week before');
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
      <div class="score-big">${stutter(big, `${big}. ${cap}`)}</div>
      <p class="score-cap">${cap}</p>
      <div class="cmp">
        <div class="cmp-row"><span>${curName}</span><b>${fmtPct(a.pct)}</b><span class="bar"><i style="width:${width(a.pct)}"></i></span></div>
        <div class="cmp-row is-prev"><span>${prevName}</span><b>${fmtPct(b.pct)}</b><span class="bar"><i style="width:${width(b.pct)}"></i></span></div>
      </div>
      <p class="fineprint">${toDate ? 'Today joins the comparison once it’s over, so both sides cover finished days only.' : 'A new week just started, so this compares the last two full weeks.'}
        Scores are weighted by importance.</p>
    </section>

    ${habits.filter(isTimed).map((h) => timeSection(state, h, today, spans)).join('')}

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

function headline(cur, prev, d, ref) {
  if (cur == null) return { big: '–', cap: 'No finished days yet. Check back tomorrow.' };
  if (prev == null) return { big: fmtPct(cur), cap: 'So far. Next week you’ll see how it compares.' };
  if (d.rel == null) return { big: fmtPct(cur), cap: `Up from 0% on ${ref}.` };
  if (d.pts === 0) return { big: '±0%', cap: `Level with ${ref}.` };
  const sign = d.pts > 0 ? '+' : '−';
  return { big: `${sign}${Math.round(Math.abs(d.rel) * 100)}%`, cap: `${d.pts > 0 ? 'Better' : 'Lower'} than ${ref}, ${sign}${Math.abs(d.pts)} points.` };
}

function relBadge(a, b) {
  if (!b) return '';
  const r = Math.round(((a - b) / b) * 100);
  return `<small class="${r > 0 ? 'up' : r < 0 ? 'down' : ''}">${r > 0 ? '+' : ''}${r}%</small>`;
}

/* ---------- time habits: average time and the last 14 days ---------- */

function timeSection(state, h, today, { mode, cur, prev }) {
  const a = timeStats(state, h, cur.from, cur.to);
  const b = timeStats(state, h, prev.from, prev.to);
  let vs = 'No times logged yet';
  if (a && b) {
    const diff = Math.round(a.avg - b.avg);
    vs = diff === 0 ? 'Same as last week' : `${Math.abs(diff)} min ${diff < 0 ? 'earlier' : 'later'} than last week`;
  } else if (a) vs = 'Nothing to compare with yet';
  return `
  <section class="group wake">
    <h2>${esc(h.name)}</h2>
    <div class="wake-nums">
      <div><span class="label">Average, ${mode === 'week-to-date' ? 'this week' : 'last week'}</span><b>${a ? fmtTime(a.avg) : '–'}</b><small>${vs}</small></div>
      <div><span class="label">On time</span><b>${a ? `${a.onTime}/${a.logged}` : '–'}</b><small>${a ? `earliest ${fmtTime(a.earliest)}, latest ${fmtTime(a.latest)}` : 'days logged'}</small></div>
    </div>
    ${timeChart(state, h, today)}
    <p class="fineprint">The last 14 days. Squares are the times you logged, red when late. Dashes are your target.</p>
  </section>`;
}

function timeChart(state, h, today) {
  const dsh = state.settings.dayStartHour;
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const pts = days.map((key) => {
    const e = entryOf(state, key, h.id);
    const goal = goalTime(h, key);
    return {
      key,
      t: e?.time && !e.skipped ? toMinutes(e.time, dsh) : null,
      goal: goal && isScheduled(h, key) && key >= h.startDate ? toMinutes(goal, dsh) : null,
      done: isDone(h, e),
    };
  });
  if (!pts.some((p) => p.t != null)) return '<p class="empty-note">Log a few mornings and the chart appears here.</p>';
  const values = pts.flatMap((p) => [p.t, p.goal]).filter((v) => v != null);
  const step = Math.max(...values) - Math.min(...values) > 150 ? 60 : 30;
  const lo = Math.floor((Math.min(...values) - 10) / step) * step;
  const hi = Math.max(Math.ceil((Math.max(...values) + 10) / step) * step, lo + 2 * step);
  const [W, H, L, R, T, B] = [340, 168, 42, 4, 8, 22];
  const cw = (W - L - R) / days.length;
  const x = (i) => L + cw * (i + 0.5);
  const y = (m) => T + ((m - lo) / (hi - lo)) * (H - T - B); // earlier is higher up
  const f = (n) => n.toFixed(1);
  let grid = '';
  for (let m = lo; m <= hi; m += step) {
    grid += `<line class="wc-grid" x1="${L}" x2="${W - R}" y1="${f(y(m))}" y2="${f(y(m))}"/><text class="wc-lab" x="${L - 6}" y="${f(y(m) + 3)}" text-anchor="end">${fmtTime(m)}</text>`;
  }
  const goals = pts.map((p, i) => (p.goal == null ? '' : `<line class="wc-goal" x1="${f(x(i) - cw / 2 + 3)}" x2="${f(x(i) + cw / 2 - 3)}" y1="${f(y(p.goal))}" y2="${f(y(p.goal))}"/>`)).join('');
  const dots = pts.map((p, i) => (p.t == null ? '' : `<rect class="${p.done ? 'wc-dot' : 'wc-late'}" x="${f(x(i) - 4.5)}" y="${f(y(p.t) - 4.5)}" width="9" height="9"/>`)).join('');
  const labels = pts.map((p, i) => `<text class="wc-lab${p.key === today ? ' wc-today' : ''}" x="${f(x(i))}" y="${H - 6}" text-anchor="middle">${DOW[weekday(p.key)][0]}</text>`).join('');
  return `<svg class="wake-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Logged times for the last 14 days">${grid}${goals}${dots}${labels}</svg>`;
}

/* ---------- trend, table, highlights ---------- */

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
  return `<div class="ht-row" role="row">
    <span class="ht-name"><i>${esc(h.emoji)}</i><span>${esc(h.name)}${h.weight > 1 ? ` <small>×${h.weight}</small>` : ''}</span></span>
    <span>${fmtPct(now?.pct)}</span><span class="muted">${fmtPct(before?.pct)}</span>${delta}
    <span>${st.current}<small>/${st.best}</small></span></div>`;
}

function highlights(rows) {
  const both = rows.filter((r) => r.now && r.before).map((r) => ({ ...r, pts: change(r.now.pct, r.before.pct).pts }));
  if (!both.length) return '';
  const up = both.reduce((m, r) => (r.pts > m.pts ? r : m));
  const down = both.reduce((m, r) => (r.pts < m.pts ? r : m));
  const item = (r, title, text) => `<div class="insight"><span class="tile sm"><span class="tile-face">${esc(r.h.emoji)}</span></span>
    <span><b>${title}</b><small>${text}</small></span></div>`;
  const parts = [];
  if (up.pts > 0) parts.push(item(up, `Biggest gain: ${esc(up.h.name)}`, `Up ${up.pts} points on last week.`));
  if (down.pts < 0) parts.push(item(down, `Needs attention: ${esc(down.h.name)}`, `Down ${-down.pts} points. Could it be easier, or on fewer days?`));
  return parts.length ? `<section class="group insights"><h2>Highlights</h2>${parts.join('')}</section>` : '';
}
