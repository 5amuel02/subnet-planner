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
