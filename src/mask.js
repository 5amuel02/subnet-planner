/** Prefix lengths, subnet masks, and the conversions between them. */

import { AddressError, parseIPv4, formatIPv4, toBitString } from './ipv4.js';

/** Parse a prefix length, accepting "24" or "/24". Range is 0-32 inclusive. */
export function parsePrefix(text) {
  const cleaned = String(text).trim().replace(/^\//, '');
  if (!/^(0|[1-9][0-9]?)$/.test(cleaned)) {
    throw new AddressError(`"${text}" is not a prefix length`);
  }
  const prefix = Number(cleaned);
  if (prefix > 32) {
    throw new AddressError('prefix length cannot exceed /32');
  }
  return prefix;
}

/**
 * Build the mask for a prefix length.
 *
 * The obvious `-1 << (32 - prefix)` shifts by 32 when prefix is 0, and JS
 * shift counts are taken mod 32 — so that would yield 0xFFFFFFFF instead of 0.
 * The zero case is therefore handled on its own.
 */
export function prefixToMask(prefix) {
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * Recover the prefix length from a mask, rejecting non-contiguous masks such
 * as 255.0.255.0. A valid mask is a run of ones followed by a run of zeros.
 */
export function maskToPrefix(mask) {
  const bits = toBitString(mask);
  const match = /^(1*)(0*)$/.exec(bits);
  if (!match) {
    throw new AddressError(`${formatIPv4(mask)} is not a contiguous subnet mask`);
  }
  return match[1].length;
}

/** The wildcard (inverse) mask that access lists are written against. */
export function wildcardMask(mask) {
  return (~(mask >>> 0)) >>> 0;
}

/** Convenience: the mask that goes with a prefix, as dotted-quad text. */
export function prefixToMaskText(prefix) {
  return formatIPv4(prefixToMask(prefix));
}

/**
 * Parse a block written any of the three ways people actually type them:
 *
 *   192.168.1.0/24
 *   192.168.1.0/255.255.255.0
 *   192.168.1.0 255.255.255.0
 *
 * A bare address with no mask is treated as a /32 host route.
 */
export function parseCIDR(text) {
  if (typeof text !== 'string') {
    throw new AddressError('block must be a string');
  }
  const input = text.trim();
  if (!input) throw new AddressError('block is empty');

  const [head, ...rest] = input.split(/[\s/]+/);
  const address = parseIPv4(head);

  if (rest.length === 0) return { address, prefix: 32 };
  if (rest.length > 1) {
    throw new AddressError(`"${text}" has more than one mask`);
  }

  const maskPart = rest[0];
  const prefix = maskPart.includes('.')
    ? maskToPrefix(parseIPv4(maskPart))
    : parsePrefix(maskPart);

  return { address, prefix };
}
