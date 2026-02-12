import crypto from 'crypto';

const API_KEY_PREFIX = 'cnk_';
const API_KEY_LENGTH = 32; // bytes of randomness

/**
 * Generate a new API key with cnk_ prefix.
 * Returns the raw key (shown once) and its SHA-256 hash (stored in DB).
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH).toString('hex');
  const rawKey = `${API_KEY_PREFIX}${randomBytes}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 8);
  return { rawKey, keyHash, keyPrefix };
}

/**
 * SHA-256 hash of an API key for storage/lookup.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format: must start with cnk_ and have correct length.
 */
export function validateApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length === API_KEY_PREFIX.length + API_KEY_LENGTH * 2;
}
