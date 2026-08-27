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
