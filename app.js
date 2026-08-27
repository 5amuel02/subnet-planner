/**
 * subnet-planner UI.
 *
 * Panels register a render function and are re-run whenever state changes.
 * Each panel owns its own error line, so a bad block in the calculator does
 * not blank out the VLSM plan below it.
 */

import { describe } from './src/subnet.js';
import { toBitString } from './src/ipv4.js';
import { t, LANGUAGES } from './src/i18n.js';

const $ = (selector) => document.querySelector(selector);

export const state = {
  lang: 'id',
  theme: 'auto',
  block: '192.168.1.0/24',
  splitPrefix: 26,
  allowP2P: true,
  requests: [
    { name: 'Sales', hosts: 50 },
    { name: 'Engineering', hosts: 30 },
    { name: 'Guest', hosts: 12 },
    { name: 'WAN link', hosts: 2 },
  ],
  plan: null,
  lookup: '',
};

const panels = [];
/** Register a panel renderer. Order of registration is order of render. */
export function panel(render) {
  panels.push(render);
}

export function renderAll() {
  for (const render of panels) render();
}

/** Show or clear a panel's error line. Returns true when there is an error. */
export function setError(selector, message) {
  const node = $(selector);
  if (!node) return false;
  node.hidden = !message;
  node.textContent = message || '';
  return Boolean(message);
}

/* --- language and theme --------------------------------------------------- */

function applyLanguage() {
  document.documentElement.lang = state.lang;
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(state.lang, node.dataset.i18n);
  }
  $('#lang-toggle').textContent = state.lang.toUpperCase();
}

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'auto') root.removeAttribute('data-theme');
  else root.dataset.theme = state.theme;
  $('#theme-toggle').textContent = { auto: '◐', light: '☀', dark: '☾' }[state.theme];
}

/* --- calculator ----------------------------------------------------------- */

const FACTS = [
  'network', 'broadcast', 'mask', 'wildcard', 'firstHost', 'lastHost',
  'totalAddresses', 'usableHosts', 'addressClass', 'scope',
];

panel(function renderCalculator() {
  const target = $('#facts');
  let result;
  try {
    result = describe(state.block);
  } catch (error) {
    setError('#block-error', error.message);
    target.innerHTML = '';
    state.described = null;
    return;
  }
  setError('#block-error', '');
  state.described = result;

  target.innerHTML = FACTS.map((key) => `
    <div>
      <dt>${t(state.lang, key)}</dt>
      <dd>${String(result[key]).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</dd>
    </div>`).join('');
});

/* --- 32-bit ruler --------------------------------------------------------- */

panel(function renderRuler() {
  const target = $('#ruler');
  if (!state.described) {
    target.innerHTML = '';
    return;
  }
  const { prefix, raw } = state.described;
  const bits = toBitString(raw.network);

  let html = '';
  for (let octet = 0; octet < 4; octet += 1) {
    if (octet > 0) html += '<span class="ruler__dot">.</span>';
    html += '<span class="ruler__octet">';
    for (let bit = 0; bit < 8; bit += 1) {
      const index = octet * 8 + bit;
      const role = index < prefix ? ' ruler__bit--network' : '';
      html += `<span class="ruler__bit${role}">${bits[index]}</span>`;
    }
    html += '</span>';
  }
  html += `<span class="ruler__legend">${prefix} ${t(state.lang, 'networkBits')}`
    + ` · ${32 - prefix} ${t(state.lang, 'hostBits')}</span>`;
  target.innerHTML = html;
});

/* --- boot ----------------------------------------------------------------- */

function wireBase() {
  $('#block').addEventListener('input', (event) => {
    state.block = event.target.value;
    renderAll();
  });
  $('#lang-toggle').addEventListener('click', () => {
    const next = (LANGUAGES.indexOf(state.lang) + 1) % LANGUAGES.length;
    state.lang = LANGUAGES[next];
    applyLanguage();
    renderAll();
  });
  $('#theme-toggle').addEventListener('click', () => {
    const cycle = ['auto', 'light', 'dark'];
    state.theme = cycle[(cycle.indexOf(state.theme) + 1) % cycle.length];
    applyTheme();
  });
}

export function boot() {
  applyLanguage();
  applyTheme();
  wireBase();
  $('#block').value = state.block;
  renderAll();
}

boot();
