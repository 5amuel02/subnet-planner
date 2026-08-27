/**
 * Variable Length Subnet Masking.
 *
 * Requests are sorted largest-first and packed from the start of the parent
 * block. Sorting descending is what keeps the plan compact: because every
 * block size is a power of two, a larger block placed after smaller ones would
 * need padding to reach its own alignment boundary, and that padding is waste.
 */

import { AddressError, formatIPv4, addOffset } from './ipv4.js';
import { parseCIDR } from './mask.js';
import {
  networkAddress, totalAddresses, usableHosts, hostRange, prefixForHosts,
} from './subnet.js';
import { rangeToCidrs } from './split.js';

/** Normalise `{ name, hosts }` requests, rejecting anything unusable. */
export function normaliseRequests(requests) {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new AddressError('give at least one subnet requirement');
  }
  return requests.map((request, index) => {
    const hosts = Number(request.hosts);
    if (!Number.isInteger(hosts) || hosts < 1) {
      throw new AddressError(`"${request.name || `row ${index + 1}`}" needs a host count of 1 or more`);
    }
    return {
      name: String(request.name || `subnet-${index + 1}`).trim(),
      hosts,
      prefix: prefixForHosts(hosts),
      order: index,
    };
  });
}

/**
 * Allocate every request inside `blockText`.
 *
 * Returns the placed subnets in address order, whatever space is left over as
 * CIDR blocks, and the efficiency of the plan.
 */
export function allocateVLSM(blockText, requests) {
  const { address, prefix } = parseCIDR(blockText);
  const parentStart = networkAddress(address, prefix);
  const parentSize = totalAddresses(prefix);
  const parentEnd = parentStart + parentSize - 1;

  const items = normaliseRequests(requests);
  const ordered = [...items].sort((a, b) => a.prefix - b.prefix || a.order - b.order);

  const allocations = [];
  let cursor = parentStart;

  for (const item of ordered) {
    const size = totalAddresses(item.prefix);
    if (cursor + size - 1 > parentEnd) {
      throw new AddressError(
        `"${item.name}" needs a /${item.prefix} (${size} addresses) but only `
        + `${parentEnd - cursor + 1} are left in ${blockText}`,
      );
    }
    const { first, last } = hostRange(cursor, item.prefix);
    allocations.push({
      name: item.name,
      requested: item.hosts,
      prefix: item.prefix,
      cidr: `${formatIPv4(cursor)}/${item.prefix}`,
      network: formatIPv4(cursor),
      firstHost: formatIPv4(first),
      lastHost: formatIPv4(last),
      broadcast: formatIPv4(addOffset(cursor, size - 1)),
      mask: undefined,
      size,
      usableHosts: usableHosts(item.prefix),
      wasted: usableHosts(item.prefix) - item.hosts,
      offset: cursor - parentStart,
    });
    cursor += size;
  }

  const usedAddresses = cursor - parentStart;
  return {
    parent: `${formatIPv4(parentStart)}/${prefix}`,
    parentSize,
    allocations,
    free: rangeToCidrs(cursor, parentEnd),
    freeAddresses: parentSize - usedAddresses,
    usedAddresses,
    requestedHosts: items.reduce((sum, item) => sum + item.hosts, 0),
    efficiency: items.reduce((sum, item) => sum + item.hosts, 0) / parentSize,
  };
}
