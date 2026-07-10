import * as Crypto from 'expo-crypto';

const TOKEN_LENGTH = 16;

/**
 * One-way, device-local hash of a local contact_id — never reversible server-side.
 * See specs/006-pseudonymous-contact-tokens.
 */
export async function computeContactToken(contactId: string): Promise<string> {
  const fullHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, contactId);
  return fullHash.slice(0, TOKEN_LENGTH);
}
