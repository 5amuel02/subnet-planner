/** Turn a plan into something you can paste into a report or a spreadsheet. */

const COLUMNS = [
  ['name', 'Name'],
  ['cidr', 'CIDR'],
  ['mask', 'Mask'],
  ['firstHost', 'First host'],
  ['lastHost', 'Last host'],
  ['broadcast', 'Broadcast'],
  ['requested', 'Needed'],
  ['usableHosts', 'Usable'],
  ['wasted', 'Wasted'],
];

/** RFC 4180: double the quotes, and wrap anything containing a separator. */
function csvCell(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCSV(allocations, columns = COLUMNS) {
  const lines = [columns.map(([, label]) => csvCell(label)).join(',')];
  for (const row of allocations) {
    lines.push(columns.map(([key]) => csvCell(row[key])).join(','));
  }
  return lines.join('\r\n');
}

export function toMarkdown(allocations, columns = COLUMNS) {
  const header = `| ${columns.map(([, label]) => label).join(' | ')} |`;
  const rule = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = allocations.map(
    (row) => `| ${columns.map(([key]) => row[key] ?? '').join(' | ')} |`,
  );
  return [header, rule, ...body].join('\n');
}

export function toJSON(plan) {
  return JSON.stringify(plan, null, 2);
}

/** Cisco-flavoured interface stanzas, one per allocated subnet. */
export function toCiscoConfig(allocations) {
  return allocations.map((row, index) => [
    `interface GigabitEthernet0/${index}`,
    ` description ${row.name}`,
    ` ip address ${row.firstHost} ${row.mask}`,
    ' no shutdown',
    '!',
  ].join('\n')).join('\n');
}
