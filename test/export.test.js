import test from 'node:test';
import assert from 'node:assert/strict';

import { toCSV, toMarkdown, toJSON, toCiscoConfig } from '../src/export.js';
import { allocateVLSM } from '../src/vlsm.js';

const plan = allocateVLSM('192.168.1.0/24', [
  { name: 'Sales', hosts: 50 },
  { name: 'Guest, wireless', hosts: 12 },
]);

test('writes a CSV header and one row per subnet', () => {
  const lines = toCSV(plan.allocations).split('\r\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith('Name,CIDR,Mask'));
  assert.ok(lines[1].includes('192.168.1.0/26'));
});

test('quotes cells containing a comma', () => {
  assert.ok(toCSV(plan.allocations).includes('"Guest, wireless"'));
});

test('writes a Markdown table with a separator rule', () => {
  const lines = toMarkdown(plan.allocations).split('\n');
  assert.ok(lines[0].startsWith('| Name |'));
  assert.ok(/^\| ---/.test(lines[1]));
  assert.equal(lines.length, 4);
});

test('round-trips through JSON', () => {
  assert.deepEqual(JSON.parse(toJSON(plan)).allocations.length, 2);
});

test('emits one interface stanza per subnet', () => {
  const config = toCiscoConfig(plan.allocations);
  assert.ok(config.includes('interface GigabitEthernet0/0'));
  assert.ok(config.includes('ip address 192.168.1.1 255.255.255.192'));
  assert.equal(config.match(/^interface /gm).length, 2);
});
