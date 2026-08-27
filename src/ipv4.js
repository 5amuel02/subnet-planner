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
