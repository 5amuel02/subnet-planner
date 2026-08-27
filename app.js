/**
 * subnet-planner UI.
 *
 * Panels register a render function and are re-run whenever state changes.
 * Each panel owns its own error line, so a bad block in the calculator does
 * not blank out the VLSM plan below it.
 */

import { describe } from './src/subnet.js';
import { toBitString } from './src/ipv4.js';
import { splitEqual } from './src/split.js';
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

/* --- equal splitter ------------------------------------------------------- */

const SPLIT_COLUMNS = ['#', 'CIDR', 'network', 'firstHost', 'lastHost', 'broadcast', 'usableHosts'];

panel(function renderSplitter() {
  const slider = $('#split-prefix');
  const table = $('#split-table');
  $('#split-prefix-out').textContent = `/${state.splitPrefix}`;

  if (!state.described) {
    table.innerHTML = '';
    $('#split-count').textContent = '';
    return;
  }
  // Never offer a child prefix wider than the block being split.
  slider.min = String(state.described.prefix);

  let rows;
  try {
    rows = splitEqual(state.block, state.splitPrefix);
  } catch (error) {
    setError('#split-error', error.message);
    table.innerHTML = '';
    $('#split-count').textContent = '';
    return;
  }
  setError('#split-error', '');
  $('#split-count').textContent = t(state.lang, 'splitCount')(rows.length);

  const head = SPLIT_COLUMNS
    .map((key) => `<th>${key.length > 4 ? t(state.lang, key) : key}</th>`).join('');
  const body = rows.map((row) => `<tr>
    <td>${row.index}</td><td>${row.cidr}</td><td>${row.network}</td>
    <td>${row.firstHost}</td><td>${row.lastHost}</td><td>${row.broadcast}</td>
    <td>${row.usableHosts}</td></tr>`).join('');
  table.innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
});

/* --- VLSM requirements form ----------------------------------------------- */

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

panel(function renderRequests() {
  const table = $('#request-table');
  const head = `<thead><tr>
      <th>${t(state.lang, 'subnetName')}</th>
      <th>${t(state.lang, 'hostsNeeded')}</th>
      <th></th>
    </tr></thead>`;
  const body = state.requests.map((request, index) => `<tr>
      <td><input type="text" data-field="name" data-index="${index}"
                 value="${escapeAttribute(request.name)}"></td>
      <td><input type="number" min="1" max="16777214" data-field="hosts" data-index="${index}"
                 value="${escapeAttribute(request.hosts)}"></td>
      <td><button type="button" class="linklike" data-remove="${index}"
                  aria-label="remove">&times;</button></td>
    </tr>`).join('');
  table.innerHTML = `${head}<tbody>${body}</tbody>`;
});

function wireRequests() {
  // The rows are rebuilt on every render, so listen on the table instead of
  // on each input and read the row index back off the target.
  $('#request-table').addEventListener('input', (event) => {
    const { field, index } = event.target.dataset;
    if (!field) return;
    const row = state.requests[Number(index)];
    row[field] = field === 'hosts' ? Number(event.target.value) : event.target.value;
  });

  $('#request-table').addEventListener('click', (event) => {
    const target = event.target.dataset.remove;
    if (target === undefined) return;
    state.requests.splice(Number(target), 1);
    renderAll();
  });

  $('#add-row').addEventListener('click', () => {
    state.requests.push({ name: '', hosts: 10 });
    renderAll();
  });

  $('#allow-p2p').addEventListener('change', (event) => {
    state.allowP2P = event.target.checked;
  });
}

/* --- boot ----------------------------------------------------------------- */

function wireBase() {
  $('#block').addEventListener('input', (event) => {
    state.block = event.target.value;
    renderAll();
  });
  $('#split-prefix').addEventListener('input', (event) => {
    state.splitPrefix = Number(event.target.value);
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
  wireRequests();
  $('#block').value = state.block;
  renderAll();
}

boot();
