import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseIPv4, formatIPv4, isValidIPv4, toOctets, toBinary, toHex, addOffset, AddressError,
} from '../src/ipv4.js';
import {
  parsePrefix, prefixToMask, maskToPrefix, wildcardMask, parseCIDR,
} from '../src/mask.js';

test('parses dotted-quad into a 32-bit integer', () => {
  assert.equal(parseIPv4('0.0.0.0'), 0);
  assert.equal(parseIPv4('192.168.1.1'), 3232235777);
  assert.equal(parseIPv4('255.255.255.255'), 4294967295);
});

test('keeps high-bit addresses unsigned', () => {
  assert.equal(parseIPv4('224.0.0.1'), 3758096385);
  assert.ok(parseIPv4('240.0.0.0') > 0);
});

test('rejects malformed addresses', () => {
  for (const bad of ['1.2.3', '1.2.3.4.5', '256.0.0.1', '192.168.01.1', 'a.b.c.d', '']) {
    assert.throws(() => parseIPv4(bad), AddressError, `expected ${bad} to be rejected`);
  }
  assert.equal(isValidIPv4('192.168.1.1'), true);
  assert.equal(isValidIPv4('192.168.1.256'), false);
});

test('round-trips through formatting', () => {
  for (const address of ['0.0.0.0', '10.1.2.3', '172.31.255.254', '255.255.255.255']) {
    assert.equal(formatIPv4(parseIPv4(address)), address);
  }
  assert.deepEqual(toOctets(parseIPv4('192.168.1.1')), [192, 168, 1, 1]);
});

test('renders binary and hexadecimal', () => {
  assert.equal(toBinary(parseIPv4('192.168.1.1')), '11000000.10101000.00000001.00000001');
  assert.equal(toHex(parseIPv4('192.168.1.1')), '0xC0A80101');
});

test('refuses arithmetic that leaves IPv4 space', () => {
  assert.equal(addOffset(parseIPv4('10.0.0.0'), 255), parseIPv4('10.0.0.255'));
  assert.throws(() => addOffset(parseIPv4('255.255.255.255'), 1), AddressError);
  assert.throws(() => addOffset(0, -1), AddressError);
});

test('converts between prefixes and masks', () => {
  assert.equal(prefixToMask(0), 0);
  assert.equal(formatIPv4(prefixToMask(24)), '255.255.255.0');
  assert.equal(formatIPv4(prefixToMask(32)), '255.255.255.255');
  assert.equal(maskToPrefix(prefixToMask(26)), 26);
  assert.equal(parsePrefix('/16'), 16);
  assert.throws(() => parsePrefix('/33'), AddressError);
});

test('rejects non-contiguous masks', () => {
  assert.throws(() => maskToPrefix(parseIPv4('255.0.255.0')), AddressError);
});

test('derives wildcard masks', () => {
  assert.equal(formatIPv4(wildcardMask(prefixToMask(24))), '0.0.0.255');
  assert.equal(formatIPv4(wildcardMask(prefixToMask(30))), '0.0.0.3');
});

test('accepts every CIDR notation people type', () => {
  const expected = { address: parseIPv4('192.168.1.0'), prefix: 24 };
  assert.deepEqual(parseCIDR('192.168.1.0/24'), expected);
  assert.deepEqual(parseCIDR('192.168.1.0/255.255.255.0'), expected);
  assert.deepEqual(parseCIDR('192.168.1.0 255.255.255.0'), expected);
  assert.deepEqual(parseCIDR('192.168.1.7'), { address: parseIPv4('192.168.1.7'), prefix: 32 });
});
