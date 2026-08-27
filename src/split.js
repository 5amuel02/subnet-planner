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
