import { createHash } from 'node:crypto';

/**
 * Generate a deterministic ID from content parts.
 * Uses SHA-256 hash, truncated to 32 hex characters (128 bits).
 * Same inputs always produce the same output, enabling idempotent re-runs.
 */
export function generateId(...parts: string[]): string {
  return createHash('sha256')
    .update(parts.join('::'))
    .digest('hex')
    .substring(0, 32);
}
