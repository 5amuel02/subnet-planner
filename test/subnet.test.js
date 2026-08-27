import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describe, usableHosts, totalAddresses, prefixForHosts, contains, overlaps, addressScope,
} from '../src/subnet.js';
import { splitEqual, rangeToCidrs, MAX_ROWS } from '../src/split.js';
import { parseIPv4 } from '../src/ipv4.js';
import { AddressError } from '../src/ipv4.js';

test('describes an ordinary /24', () => {
  const result = describe('192.168.1.10/24');
  assert.equal(result.network, '192.168.1.0');
  assert.equal(result.broadcast, '192.168.1.255');
  assert.equal(result.firstHost, '192.168.1.1');
  assert.equal(result.lastHost, '192.168.1.254');
  assert.equal(result.mask, '255.255.255.0');
  assert.equal(result.wildcard, '0.0.0.255');
  assert.equal(result.usableHosts, 254);
  assert.equal(result.scope, 'private (RFC 1918)');
});

test('handles the whole address space at /0', () => {
  const result = describe('0.0.0.0/0');
  assert.equal(result.network, '0.0.0.0');
  assert.equal(result.broadcast, '255.255.255.255');
  assert.equal(result.totalAddresses, 4294967296);
});

test('treats /31 as point-to-point and /32 as a host route', () => {
  const p2p = describe('10.0.0.4/31');
  assert.equal(p2p.usableHosts, 2);
  assert.equal(p2p.firstHost, '10.0.0.4');
  assert.equal(p2p.lastHost, '10.0.0.5');
  assert.equal(p2p.isPointToPoint, true);

  const host = describe('10.0.0.7/32');
  assert.equal(host.usableHosts, 1);
  assert.equal(host.firstHost, '10.0.0.7');
  assert.equal(host.lastHost, '10.0.0.7');
  assert.equal(host.isHostRoute, true);
});

test('sizes blocks from a host requirement', () => {
  assert.equal(prefixForHosts(1), 32);
  assert.equal(prefixForHosts(2), 31);
  assert.equal(prefixForHosts(3), 29);
  assert.equal(prefixForHosts(50), 26);
  assert.equal(prefixForHosts(254), 24);
  assert.equal(prefixForHosts(255), 23);
  assert.throws(() => prefixForHosts(0), AddressError);
});

test('usable hosts never exceed total addresses', () => {
  for (let prefix = 0; prefix <= 32; prefix += 1) {
    assert.ok(usableHosts(prefix) <= totalAddresses(prefix));
    assert.ok(usableHosts(prefix) >= 1);
  }
});

test('recognises reserved space', () => {
  assert.equal(addressScope(parseIPv4('127.0.0.1')), 'loopback');
  assert.equal(addressScope(parseIPv4('169.254.10.1')), 'link-local (APIPA)');
  assert.equal(addressScope(parseIPv4('8.8.8.8')), 'public unicast');
});

test('answers containment and overlap questions', () => {
  assert.equal(contains('10.0.0.0/8', '10.255.3.1'), true);
  assert.equal(contains('10.0.0.0/8', '11.0.0.1'), false);
  assert.equal(overlaps('10.0.0.0/8', '10.1.0.0/16'), true);
  assert.equal(overlaps('10.1.0.0/16', '10.2.0.0/16'), false);
});

test('splits a block into equal children', () => {
  const rows = splitEqual('192.168.1.0/24', 26);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].cidr, '192.168.1.0/26');
  assert.equal(rows[1].network, '192.168.1.64');
  assert.equal(rows[3].broadcast, '192.168.1.255');
  assert.equal(rows[2].usableHosts, 62);
});

test('splitting to the same prefix returns the block itself', () => {
  const rows = splitEqual('172.16.0.0/16', 16);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cidr, '172.16.0.0/16');
});

test('refuses to widen or to build an unreadable table', () => {
  assert.throws(() => splitEqual('192.168.1.0/24', 20), AddressError);
  assert.throws(() => splitEqual('10.0.0.0/8', 32, MAX_ROWS), AddressError);
});

test('covers a range with the fewest aligned blocks', () => {
  const blocks = rangeToCidrs(parseIPv4('192.168.1.64'), parseIPv4('192.168.1.255'));
  assert.deepEqual(blocks.map((block) => block.cidr), ['192.168.1.64/26', '192.168.1.128/25']);

  const single = rangeToCidrs(parseIPv4('10.0.0.0'), parseIPv4('10.0.0.255'));
  assert.deepEqual(single.map((block) => block.cidr), ['10.0.0.0/24']);

  assert.deepEqual(rangeToCidrs(parseIPv4('10.0.0.5'), parseIPv4('10.0.0.4')), []);
});
