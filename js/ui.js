// ui.js — small helpers shared by the views.

/** Escape user text before putting it in HTML (habit names could contain < or &). */
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const fmtNum = (n) => Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 1 });
export const fmtPct = (p) => (p == null ? '–' : `${Math.round(p * 100)}%`);
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ---------- looks ---------- */

// Each look is a block in css/styles.css: [data-theme="..."]. `color` tints the browser's title bar.
// Adding one? Add its id to LOOKS in store.js too, or saved settings will fall back to Bully.
export const THEMES = [
  { id: 'bully', name: 'Bully', note: 'Black poster, doubled red type', color: '#000000', preview: '<span>2/5</span>' },
  { id: 'ink', name: 'Ink', note: 'Paper, ink and a red sun', color: '#ece6d9', preview: '<span>2/5</span><i></i>' },
];

export function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  if (document.documentElement.dataset.theme !== t.id) document.documentElement.dataset.theme = t.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.color);
}

/**
 * Big display text in the doubled style of the Bully cover: a stretched copy with a
 * squashed copy on top. Screen readers get `label` instead of the text twice.
 */
export const stutter = (text, label = text) =>
  `<span class="stutter" role="img" aria-label="${esc(label)}"><span aria-hidden="true">${esc(text)}</span><span aria-hidden="true">${esc(text)}</span></span>`;

const svg = (body, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">${body}</svg>`;

export const icons = {
  check: svg('<path d="M5 12.5l4.2 4.2L19 7"/>', 'i-check'),
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
  more: svg('<rect x="4" y="11" width="2.5" height="2.5" fill="currentColor" stroke="none"/><rect x="10.75" y="11" width="2.5" height="2.5" fill="currentColor" stroke="none"/><rect x="17.5" y="11" width="2.5" height="2.5" fill="currentColor" stroke="none"/>'),
  skip: svg('<path d="M4 12h12M12 7l5 5-5 5M20 5v14"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};

/* ---------- toast ---------- */

let toastTimer;
export function toast(message, { action, onAction, timeout = 2600 } = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  el.querySelector('button')?.addEventListener('click', () => {
    el.classList.remove('show');
    onAction?.();
  });
  el.classList.add('show');
  clearTimeout(toastTimer);
  if (timeout) toastTimer = setTimeout(() => el.classList.remove('show'), timeout);
}

/* ---------- bottom sheet (a native <dialog>) ---------- */

/**
 * render() returns the sheet's HTML. handlers[name](el, sheet) runs when an element
 * with data-action="name" is tapped; handlers.submit(form, sheet) when a form inside submits.
 */
export function openSheet(render, handlers = {}) {
  const dlg = document.getElementById('sheet');
  const sheet = {
    root: dlg,
    redraw: () => { dlg.innerHTML = `<div class="sheet-inner"><div class="sheet-grip"></div>${render()}</div>`; },
    close: closeSheet,
  };
  sheet.redraw();
  dlg.onclick = (e) => {
    if (e.target === dlg) return closeSheet(); // tap on the dimmed backdrop
    const el = e.target.closest('[data-action]');
    if (el && handlers[el.dataset.action]) handlers[el.dataset.action](el, sheet);
  };
  dlg.onsubmit = (e) => {
    e.preventDefault();
    handlers.submit?.(e.target, sheet);
  };
  if (!dlg.open) dlg.showModal();
  return sheet;
}

export function closeSheet() {
  const dlg = document.getElementById('sheet');
  if (dlg.open) dlg.close();
}
