/**
 * IPv4 address primitives.
 *
 * Addresses are carried around as unsigned 32-bit integers. Every bitwise
 * result is forced back through `>>> 0` because JavaScript's bitwise operators
 * work on *signed* 32-bit values, so anything with the top bit set (224.0.0.0
 * and up) comes out negative otherwise.
 */

export class AddressError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AddressError';
  }
}

/** A bare octet: 0-255, decimal, and no leading zeros (which read as octal). */
export function isValidOctet(text) {
  if (!/^(0|[1-9][0-9]{0,2})$/.test(text)) return false;
  return Number(text) <= 255;
}

/** Parse dotted-quad text into an unsigned 32-bit integer. */
export function parseIPv4(text) {
  if (typeof text !== 'string') {
    throw new AddressError('address must be a string');
  }
  const parts = text.trim().split('.');
  if (parts.length !== 4) {
    throw new AddressError(`"${text}" needs exactly four octets`);
  }
  let value = 0;
  for (const part of parts) {
    if (!isValidOctet(part)) {
      throw new AddressError(`"${part}" is not an octet between 0 and 255`);
    }
    value = (value * 256) + Number(part);
  }
  return value >>> 0;
}

/** True when the text parses as an address, without throwing. */
export function isValidIPv4(text) {
  try {
    parseIPv4(text);
    return true;
  } catch {
    return false;
  }
}

/** Split an unsigned 32-bit integer into its four octets, high byte first. */
export function toOctets(value) {
  const n = value >>> 0;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

/** Render an unsigned 32-bit integer back to dotted-quad text. */
export function formatIPv4(value) {
  return toOctets(value).join('.');
}

/** Clamp-free addition used to walk address space; wraps are a bug, not a feature. */
export function addOffset(value, offset) {
  const next = (value >>> 0) + offset;
  if (next < 0 || next > 0xffffffff) {
    throw new AddressError('address arithmetic ran off the end of IPv4 space');
  }
  return next >>> 0;
}

/** Zero-padded binary for one address, grouped by octet: "11000000.10101000...". */
export function toBinary(value, separator = '.') {
  return toOctets(value)
    .map((octet) => octet.toString(2).padStart(8, '0'))
    .join(separator);
}

/** The flat 32-character bit string, handy for slicing at the prefix boundary. */
export function toBitString(value) {
  return (value >>> 0).toString(2).padStart(32, '0');
}

/** Hexadecimal form, as shown by some router CLIs: "0xC0A80101". */
export function toHex(value) {
  return '0x' + (value >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
