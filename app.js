/**
 * subnet-planner UI.
 *
 * Panels register a render function and are re-run whenever state changes.
 * Each panel owns its own error line, so a bad block in the calculator does
 * not blank out the VLSM plan below it.
 */

import { describe, contains } from './src/subnet.js';
import { toBitString } from './src/ipv4.js';
import { splitEqual } from './src/split.js';
import { allocateVLSM } from './src/vlsm.js';
import { toCSV, toMarkdown, toJSON, toCiscoConfig } from './src/export.js';
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
    if (state.plan) allocate();
  });

  $('#allocate').addEventListener('click', allocate);
}

/* --- VLSM plan ------------------------------------------------------------ */

const PLAN_COLUMNS = [
  ['name', 'subnetName'], ['cidr', 'CIDR'], ['mask', 'mask'],
  ['firstHost', 'firstHost'], ['lastHost', 'lastHost'], ['broadcast', 'broadcast'],
  ['requested', 'hostsNeeded'], ['usableHosts', 'usableHosts'], ['wasted', 'wasted'],
];

function allocate() {
  try {
    state.plan = allocateVLSM(state.block, state.requests, {
      allowPointToPoint: state.allowP2P,
    });
    setError('#vlsm-error', '');
  } catch (error) {
    state.plan = null;
    setError('#vlsm-error', error.message);
  }
  renderAll();
}

panel(function renderPlan() {
  const table = $('#plan-table');
  const summary = $('#plan-summary');

  if (!state.plan) {
    table.innerHTML = '';
    summary.textContent = t(state.lang, 'emptyPlan');
    return;
  }
  const plan = state.plan;
  const percent = (plan.efficiency * 100).toFixed(1);
  summary.innerHTML = `
    <span>${t(state.lang, 'used')} <b>${plan.usedAddresses}</b></span>
    <span>${t(state.lang, 'free')} <b>${plan.freeAddresses}</b></span>
    <span>${t(state.lang, 'efficiency')} <b>${percent}%</b></span>`;

  const head = PLAN_COLUMNS
    .map(([, label]) => `<th>${label === 'CIDR' ? label : t(state.lang, label)}</th>`).join('');
  const body = plan.allocations
    .map((row) => `<tr>${PLAN_COLUMNS.map(([key]) => `<td>${row[key]}</td>`).join('')}</tr>`)
    .join('');
  const free = plan.free
    .map((block) => `<tr><td>${t(state.lang, 'free')}</td><td>${block.cidr}</td>`
      + `<td colspan="7">${block.size}</td></tr>`).join('');
  table.innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}${free}</tbody>`;
});

/* --- address space map ---------------------------------------------------- */

/* Evenly spaced hues so neighbouring blocks stay distinguishable. */
function segmentColour(index, total) {
  const hue = Math.round((index / Math.max(total, 1)) * 320);
  return `hsl(${hue} 62% 52%)`;
}

panel(function renderMap() {
  const map = $('#plan-map');
  if (!state.plan) {
    map.innerHTML = '';
    map.hidden = true;
    return;
  }
  map.hidden = false;

  const { parentSize, allocations, free } = state.plan;
  const segments = [
    ...allocations.map((row, index) => ({
      size: row.size,
      colour: segmentColour(index, allocations.length),
      label: `${row.name} — ${row.cidr}`,
      free: false,
    })),
    ...free.map((block) => ({
      size: block.size, colour: null, label: `${t(state.lang, 'free')} — ${block.cidr}`, free: true,
    })),
  ];

  map.innerHTML = segments.map((segment) => {
    const width = (segment.size / parentSize) * 100;
    const style = segment.free
      ? `width:${width}%`
      : `width:${width}%;background:${segment.colour}`;
    const classes = segment.free ? 'map__seg map__seg--free' : 'map__seg';
    return `<span class="${classes}" style="${style}" title="${segment.label}"></span>`;
  }).join('');
});

/* --- address lookup ------------------------------------------------------- */

panel(function renderLookup() {
  const result = $('#lookup-result');
  const query = state.lookup.trim();
  if (!query || !state.described) {
    result.textContent = '';
    result.className = 'verdict';
    return;
  }
  let inside;
  try {
    inside = contains(state.block, query);
  } catch (error) {
    result.textContent = error.message;
    result.className = 'verdict verdict--out';
    return;
  }
  const verdict = t(state.lang, inside ? 'inside' : 'outside');
  result.textContent = `${query} ${verdict} ${state.described.cidr}`;
  result.className = `verdict ${inside ? 'verdict--in' : 'verdict--out'}`;
});

/* --- exporting ------------------------------------------------------------ */

const FORMATS = [
  ['CSV', 'text/csv', 'csv', (plan) => toCSV(plan.allocations)],
  ['Markdown', 'text/markdown', 'md', (plan) => toMarkdown(plan.allocations)],
  ['JSON', 'application/json', 'json', (plan) => toJSON(plan)],
  ['Cisco', 'text/plain', 'txt', (plan) => toCiscoConfig(plan.allocations)],
];

function download(filename, mime, text) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyText(button, text) {
  await navigator.clipboard.writeText(text);
  const original = button.textContent;
  button.textContent = t(state.lang, 'copied');
  setTimeout(() => { button.textContent = original; }, 1200);
}

panel(function renderExports() {
  const row = $('#export-row');
  row.innerHTML = '';
  if (!state.plan) return;

  for (const [label, mime, extension, render] of FORMATS) {
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn';
    copy.textContent = `${t(state.lang, 'copy')} ${label}`;
    copy.addEventListener('click', () => copyText(copy, render(state.plan)));

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'chip';
    save.textContent = `↓ ${extension}`;
    save.title = `${t(state.lang, 'download')} ${label}`;
    save.addEventListener('click', () => download(
      `subnet-plan.${extension}`, mime, render(state.plan),
    ));

    row.append(copy, save);
  }
});

/* --- shareable URL -------------------------------------------------------- */

/* Requirements ride in the hash as "name:hosts" pairs, names URI-encoded so a
   comma or colon in a department name cannot break the split. */
function encodeRequests(requests) {
  return requests
    .filter((request) => Number(request.hosts) > 0)
    .map((request) => `${encodeURIComponent(request.name)}:${request.hosts}`)
    .join(',');
}

function decodeRequests(text) {
  return text.split(',').map((pair) => {
    const separator = pair.lastIndexOf(':');
    if (separator < 0) return null;
    const hosts = Number(pair.slice(separator + 1));
    if (!Number.isInteger(hosts) || hosts < 1) return null;
    return { name: decodeURIComponent(pair.slice(0, separator)), hosts };
  }).filter(Boolean);
}

/* Read the hash without decoding it. URLSearchParams would percent-decode the
   requirement list before it is split, and a department called "Guest, wifi"
   would then split into two rows. Each field is decoded once, by hand. */
function parseHash() {
  const fields = {};
  for (const pair of window.location.hash.replace(/^#/, '').split('&')) {
    const separator = pair.indexOf('=');
    if (separator > 0) fields[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
  return fields;
}

export function restoreFromURL() {
  const fields = parseHash();
  if (fields.block) state.block = decodeURIComponent(fields.block);
  if (fields.split) state.splitPrefix = Number(fields.split);
  if (fields.lang) state.lang = fields.lang;
  if (fields.theme) state.theme = fields.theme;
  if (fields.p2p) state.allowP2P = fields.p2p === '1';
  if (fields.req) {
    const requests = decodeRequests(fields.req);
    if (requests.length) state.requests = requests;
  }
}

/* Registered last, so the URL always reflects what the panels just rendered.
   replaceState keeps the back button usable instead of stacking every keystroke. */
panel(function syncURL() {
  const hash = [
    `block=${encodeURIComponent(state.block)}`,
    `split=${state.splitPrefix}`,
    `lang=${state.lang}`,
    `theme=${state.theme}`,
    `p2p=${state.allowP2P ? '1' : '0'}`,
    `req=${encodeRequests(state.requests)}`,
  ].join('&');
  window.history.replaceState(null, '', `#${hash}`);
});

/* --- keyboard shortcuts --------------------------------------------------- */

const SHORTCUTS = [
  ['/', 'scFocus', () => { $('#block').focus(); $('#block').select(); }],
  ['a', 'scAllocate', allocate],
  ['n', 'scAddRow', () => $('#add-row').click()],
  ['t', 'scTheme', () => $('#theme-toggle').click()],
  ['l', 'scLang', () => $('#lang-toggle').click()],
  ['?', 'scHelp', () => $('#help').showModal()],
];

/* Never steal a key from someone typing into a field. */
function isTyping(target) {
  return target instanceof HTMLElement
    && (target.matches('input, textarea, select') || target.isContentEditable);
}

function renderHelp() {
  $('#help-list').innerHTML = SHORTCUTS
    .map(([key, label]) => `<li><kbd>${key}</kbd> — ${t(state.lang, label)}</li>`).join('');
}

function wireShortcuts() {
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape' && isTyping(event.target)) {
      event.target.blur();
      return;
    }
    if (isTyping(event.target)) return;

    const match = SHORTCUTS.find(([key]) => key === event.key);
    if (!match) return;
    event.preventDefault();
    match[2]();
  });

  $('#help-open').addEventListener('click', () => $('#help').showModal());
}

panel(renderHelp);

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
  $('#lookup-input').addEventListener('input', (event) => {
    state.lookup = event.target.value;
    renderAll();
  });
  $('#lang-toggle').addEventListener('click', () => {
    const next = (LANGUAGES.indexOf(state.lang) + 1) % LANGUAGES.length;
    state.lang = LANGUAGES[next];
    applyLanguage();
    renderAll();
  });
  $('#share').addEventListener('click', async (event) => {
    await copyText(event.target, window.location.href);
  });
  $('#theme-toggle').addEventListener('click', () => {
    const cycle = ['auto', 'light', 'dark'];
    state.theme = cycle[(cycle.indexOf(state.theme) + 1) % cycle.length];
    applyTheme();
  });
}

export function boot() {
  restoreFromURL();
  applyLanguage();
  applyTheme();
  wireBase();
  wireRequests();
  wireShortcuts();
  $('#block').value = state.block;
  $('#split-prefix').value = String(state.splitPrefix);
  $('#allow-p2p').checked = state.allowP2P;
  renderAll();
}

boot();
