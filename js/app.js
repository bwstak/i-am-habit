// app.js — starts the app: routing between tabs, events, the service worker.
//
// How rendering works (worth understanding before you change things):
//  1. Each view exports render(app) → an HTML string, plus an `actions` object.
//  2. Buttons say what they do with data-action="name". One click listener on <main>
//     finds the closest data-action and calls the current view's actions[name].
//  3. Actions change data through store.js, which saves and notifies us, and we
//     re-render the whole view. It's small, so that's fast and keeps things simple.

import { getState, requestPersistence, subscribe } from './store.js';
import { todayKey } from './dates.js';
import { applyTheme, toast } from './ui.js';
import * as today from './views/today.js';
import * as week from './views/week.js';
import * as stats from './views/stats.js';
import * as habits from './views/habits.js';
import * as edit from './views/edit.js';

const views = { today, week, stats, habits, edit };
const main = document.getElementById('view');

function parseRoute() {
  const [name, param = ''] = location.hash.slice(1).split('/');
  return views[name] ? { name, param: decodeURIComponent(param) } : { name: 'today', param: '' };
}

const app = {
  route: parseRoute(),
  viewDate: null, // the day shown on Today; null means "the real today"
  weekOffset: 0, // 0 = this week, -1 = last week ...
  flash: null, // id of the habit just completed, so it can animate
  returnTo: '#habits', // where the editor goes back to
  get state() {
    return getState();
  },
  get today() {
    return todayKey(getState().settings.dayStartHour);
  },
  go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  },
  render,
};

function render() {
  applyTheme(getState().settings.theme);
  const view = views[app.route.name];
  main.innerHTML = view.render(app);
  view.mount?.(main, app);
  app.flash = null;
  const tab = app.route.name === 'edit' ? 'habits' : app.route.name;
  for (const a of document.querySelectorAll('.tabbar a')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

addEventListener('hashchange', () => {
  const before = app.route.name;
  app.route = parseRoute();
  render();
  if (app.route.name !== before) scrollTo(0, 0);
});

main.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  views[app.route.name].actions?.[el.dataset.action]?.(el, app, e);
});
main.addEventListener('change', (e) => views[app.route.name].onChange?.(e.target, app, e));

// Data changed: re-render. Not in the editor, though, or it would wipe what you typed.
subscribe(() => {
  if (app.route.name !== 'edit') render();
});

addEventListener('store-error', () => toast('Couldn’t save. Your device storage may be full.', { timeout: 6000 }));

// Back in the app the next morning: re-render so "today" is the new day.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && app.route.name !== 'edit') render();
});

// Ask the browser to keep our storage (some browsers ask you first, so wait for a tap).
addEventListener('pointerdown', () => requestPersistence(), { once: true });

render();
registerServiceWorker();

/* ---------- offline support and updates ---------- */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // The first install takes control of the page too; that's not an update, so don't reload for it.
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    location.reload();
  });

  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const offer = (worker) =>
        toast('A new version is ready', { action: 'Update', timeout: 0, onAction: () => worker.postMessage('SKIP_WAITING') });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
        });
      });
      // Look for a new version whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch((err) => console.warn('Offline support unavailable:', err));
}
