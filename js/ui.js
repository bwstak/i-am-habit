// ui.js — small helpers shared by the views.

/** Escape user text before putting it in HTML (habit names could contain < or &). */
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const fmtNum = (n) => Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 1 });
export const fmtPct = (p) => (p == null ? '–' : `${Math.round(p * 100)}%`);
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const COLORS = ['amber', 'coral', 'red', 'pink', 'violet', 'blue', 'teal', 'green'];
/** Inline style that gives an element its habit colour as --hc. */
export const hc = (h) => `--hc: var(--c-${COLORS.includes(h.color) ? h.color : 'amber'})`;

/** SVG progress ring, p from 0 to 1. */
export function ring(p, { size = 52, stroke = 4, cls = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, p)));
  const m = size / 2;
  return `<svg class="ring ${cls}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="ring-track" cx="${m}" cy="${m}" r="${r}" stroke-width="${stroke}" fill="none"/>
    <circle class="ring-fill" cx="${m}" cy="${m}" r="${r}" stroke-width="${stroke}" fill="none" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${m} ${m})"/></svg>`;
}

const svg = (body, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  check: svg('<path d="M5 12.5l4.2 4.2L19 7"/>', 'i-check'),
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
  more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>'),
  skip: svg('<path d="M4 12h12M12 7l5 5-5 5M20 5v14"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};

/* ---------- the sky: night → sunrise as the day fills up ---------- */

const NIGHT = { top: '#0e1030', low: '#1e2154' };
const DUSK = { top: '#1a1f55', low: '#7d3d7a' };
const MORNING = { top: '#2b3f8e', low: '#ff9550' };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t)).join(' ')})`;

/** CSS variables for the Today header at progress p (0–1). */
export function skyVars(p) {
  const t = Math.max(0, Math.min(1, p));
  const [a, b, k] = t < 0.5 ? [NIGHT, DUSK, t * 2] : [DUSK, MORNING, (t - 0.5) * 2];
  const top = mix(a.top, b.top, k);
  document.documentElement.style.setProperty('--shim', top); // strip behind the iPhone status bar
  return `--sky-top:${top};--sky-low:${mix(a.low, b.low, k)};--sun-y:${(122 - 70 * t).toFixed(1)}%;--sun-a:${(0.25 + 0.75 * t).toFixed(2)}`;
}

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
