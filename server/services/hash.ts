import { createHash } from 'crypto';

const TOKEN_LENGTH = 16;

/**
 * One-way hash, same scheme as mobile's contactToken (SHA-256, truncated to 16 hex chars).
 * Used server-side for values that must never leave the server in raw form — e.g. a
 * partnership_id, which (unlike a local contact_id) is a live FK joinable to real user
 * identity. See specs/008-relationship-profile.
 */
export function oneWayHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, TOKEN_LENGTH);
}
