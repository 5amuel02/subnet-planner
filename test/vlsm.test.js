import test from 'node:test';
import assert from 'node:assert/strict';

import { allocateVLSM, normaliseRequests } from '../src/vlsm.js';
import { AddressError } from '../src/ipv4.js';

const DEPARTMENTS = [
  { name: 'Sales', hosts: 50 },
  { name: 'Engineering', hosts: 30 },
  { name: 'Guest', hosts: 12 },
  { name: 'WAN link', hosts: 2 },
];

test('packs a classic four-department plan', () => {
  const plan = allocateVLSM('192.168.1.0/24', DEPARTMENTS);
  assert.deepEqual(plan.allocations.map((a) => a.cidr), [
    '192.168.1.0/26',
    '192.168.1.64/27',
    '192.168.1.96/28',
    '192.168.1.112/31',
  ]);
  assert.equal(plan.allocations[0].name, 'Sales');
  assert.equal(plan.allocations[0].mask, '255.255.255.192');
  assert.equal(plan.allocations[1].lastHost, '192.168.1.94');
  assert.equal(plan.usedAddresses, 114);
  assert.equal(plan.freeAddresses, 142);
});

test('places larger blocks first whatever order they arrive in', () => {
  const shuffled = [...DEPARTMENTS].reverse();
  const plan = allocateVLSM('192.168.1.0/24', shuffled);
  assert.deepEqual(plan.allocations.map((a) => a.name), [
    'Sales', 'Engineering', 'Guest', 'WAN link',
  ]);
});

test('reports the leftover space as aligned blocks', () => {
  const plan = allocateVLSM('192.168.1.0/24', DEPARTMENTS);
  assert.deepEqual(plan.free.map((block) => block.cidr), [
    '192.168.1.114/31',
    '192.168.1.116/30',
    '192.168.1.120/29',
    '192.168.1.128/25',
  ]);
  const freeTotal = plan.free.reduce((sum, block) => sum + block.size, 0);
  assert.equal(freeTotal, plan.freeAddresses);
});

test('every allocation fits the hosts that were asked for', () => {
  const plan = allocateVLSM('10.0.0.0/16', [
    { name: 'a', hosts: 1000 }, { name: 'b', hosts: 500 }, { name: 'c', hosts: 1 },
  ]);
  for (const allocation of plan.allocations) {
    assert.ok(allocation.usableHosts >= allocation.requested);
    assert.equal(allocation.wasted, allocation.usableHosts - allocation.requested);
  }
});

test('allocations never overlap and stay inside the parent', () => {
  const plan = allocateVLSM('172.16.0.0/20', [
    { name: 'a', hosts: 500 }, { name: 'b', hosts: 200 }, { name: 'c', hosts: 60 },
  ]);
  let cursor = -1;
  for (const allocation of plan.allocations) {
    assert.ok(allocation.offset > cursor, 'allocations must advance');
    cursor = allocation.offset + allocation.size - 1;
    assert.ok(cursor < plan.parentSize, 'allocation ran past the parent block');
  }
});

test('refuses a plan that does not fit', () => {
  assert.throws(
    () => allocateVLSM('192.168.1.0/24', [{ name: 'big', hosts: 300 }]),
    AddressError,
  );
  assert.throws(
    () => allocateVLSM('192.168.1.0/25', [
      { name: 'a', hosts: 100 }, { name: 'b', hosts: 100 },
    ]),
    AddressError,
  );
});

test('rejects unusable requirements', () => {
  assert.throws(() => normaliseRequests([]), AddressError);
  assert.throws(() => normaliseRequests([{ name: 'x', hosts: 0 }]), AddressError);
  assert.throws(() => normaliseRequests([{ name: 'x', hosts: 'many' }]), AddressError);
  assert.equal(normaliseRequests([{ hosts: 5 }])[0].name, 'subnet-1');
});
