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
