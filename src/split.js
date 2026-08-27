/** Splitting one block into equal children, and rebuilding blocks from ranges. */

import { AddressError, formatIPv4, addOffset } from './ipv4.js';
import { parseCIDR } from './mask.js';
import { networkAddress, totalAddresses, usableHosts, hostRange } from './subnet.js';

/** A table this long already stops being readable; beyond it, refuse. */
export const MAX_ROWS = 4096;

/**
 * Cut a block into equal-sized children at `childPrefix`.
 *
 * This is the classic "split a /24 into /26s" exercise: the answer is always a
 * power of two children, each the same size.
 */
export function splitEqual(blockText, childPrefix, limit = MAX_ROWS) {
  const { address, prefix } = parseCIDR(blockText);
  if (childPrefix < prefix) {
    throw new AddressError(`/${childPrefix} is wider than the /${prefix} being split`);
  }
  const count = 2 ** (childPrefix - prefix);
  if (count > limit) {
    throw new AddressError(
      `splitting /${prefix} into /${childPrefix} yields ${count} subnets, over the ${limit} row limit`,
    );
  }

  const start = networkAddress(address, prefix);
  const step = totalAddresses(childPrefix);
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    const base = addOffset(start, index * step);
    const { first, last } = hostRange(base, childPrefix);
    rows.push({
      index,
      cidr: `${formatIPv4(base)}/${childPrefix}`,
      network: formatIPv4(base),
      firstHost: formatIPv4(first),
      lastHost: formatIPv4(last),
      broadcast: formatIPv4(addOffset(base, step - 1)),
      usableHosts: usableHosts(childPrefix),
    });
  }
  return rows;
}

/**
 * Cover an arbitrary inclusive address range with the fewest aligned CIDR
 * blocks. Used to describe the space a VLSM plan leaves unallocated.
 *
 * At each step it takes the largest block that both starts at `cursor` (that
 * is, `cursor` is aligned to it) and still fits inside what remains.
 */
export function rangeToCidrs(start, end) {
  if (end < start) return [];
  const blocks = [];
  let cursor = start >>> 0;

  while (cursor <= end) {
    let prefix = 32;
    while (prefix > 0) {
      const candidate = prefix - 1;
      const size = totalAddresses(candidate);
      const aligned = cursor % size === 0;
      const fits = cursor + size - 1 <= end;
      if (!aligned || !fits) break;
      prefix = candidate;
    }
    const size = totalAddresses(prefix);
    blocks.push({
      cidr: `${formatIPv4(cursor)}/${prefix}`,
      prefix,
      size,
      network: formatIPv4(cursor),
      last: formatIPv4(cursor + size - 1),
    });
    if (cursor + size > 0xffffffff) break;
    cursor += size;
  }
  return blocks;
}
