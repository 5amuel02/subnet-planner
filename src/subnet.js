/** Subnet geometry: where a block starts, where it ends, and what sits inside. */

import { AddressError, formatIPv4, toBinary, toHex, addOffset } from './ipv4.js';
import { parseCIDR, prefixToMask, prefixToMaskText, wildcardMask } from './mask.js';

/** The first address of the block containing `address` at this prefix. */
export function networkAddress(address, prefix) {
  return ((address >>> 0) & prefixToMask(prefix)) >>> 0;
}

/** The last address of that block — the broadcast address for /0../30. */
export function broadcastAddress(address, prefix) {
  return ((networkAddress(address, prefix) | wildcardMask(prefixToMask(prefix))) >>> 0);
}

/** How many addresses the block spans, including network and broadcast. */
export function totalAddresses(prefix) {
  return 2 ** (32 - prefix);
}

/**
 * Usable host addresses in a block.
 *
 * A /31 is a point-to-point link (RFC 3021): both addresses are usable, there
 * is no broadcast. A /32 is a single host route. Everything wider loses the
 * network and broadcast addresses.
 */
export function usableHosts(prefix) {
  if (prefix === 32) return 1;
  if (prefix === 31) return 2;
  return totalAddresses(prefix) - 2;
}

/** First and last address a host can actually be configured with. */
export function hostRange(address, prefix) {
  const network = networkAddress(address, prefix);
  const broadcast = broadcastAddress(address, prefix);
  if (prefix >= 31) return { first: network, last: broadcast };
  return { first: addOffset(network, 1), last: addOffset(broadcast, -1) };
}

/** The smallest prefix that still fits `hosts` usable addresses. */
export function prefixForHosts(hosts) {
  if (!Number.isInteger(hosts) || hosts < 1) {
    throw new AddressError('host count must be a positive whole number');
  }
  for (let prefix = 32; prefix >= 0; prefix -= 1) {
    if (usableHosts(prefix) >= hosts) return prefix;
  }
  throw new AddressError(`${hosts} hosts do not fit in IPv4`);
}

/** Legacy classful bucket. Informational only — nothing routes this way now. */
export function addressClass(address) {
  const firstOctet = (address >>> 24) & 255;
  if (firstOctet < 128) return 'A';
  if (firstOctet < 192) return 'B';
  if (firstOctet < 224) return 'C';
  if (firstOctet < 240) return 'D (multicast)';
  return 'E (reserved)';
}

const SPECIAL_RANGES = [
  ['10.0.0.0/8', 'private (RFC 1918)'],
  ['172.16.0.0/12', 'private (RFC 1918)'],
  ['192.168.0.0/16', 'private (RFC 1918)'],
  ['127.0.0.0/8', 'loopback'],
  ['169.254.0.0/16', 'link-local (APIPA)'],
  ['100.64.0.0/10', 'carrier-grade NAT (RFC 6598)'],
  ['192.0.2.0/24', 'documentation (TEST-NET-1)'],
  ['198.51.100.0/24', 'documentation (TEST-NET-2)'],
  ['203.0.113.0/24', 'documentation (TEST-NET-3)'],
  ['224.0.0.0/4', 'multicast'],
  ['240.0.0.0/4', 'reserved'],
  ['0.0.0.0/8', 'this network'],
];

/** Human label for well-known space, or "public unicast" when it is ordinary. */
export function addressScope(address) {
  for (const [block, label] of SPECIAL_RANGES) {
    const { address: base, prefix } = parseCIDR(block);
    if (networkAddress(address, prefix) === base) return label;
  }
  return 'public unicast';
}
