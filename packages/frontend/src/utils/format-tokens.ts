/**
 * Compact token count formatting.
 * >= 1M -> "1.2M", >= 1k -> "12.3k", else raw number as string.
 * Drops trailing ".0" (e.g., "12.0k" -> "12k").
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    const val = (count / 1_000_000).toFixed(1);
    return val.endsWith('.0') ? val.slice(0, -2) + 'M' : val + 'M';
  }
  if (count >= 1_000) {
    const val = (count / 1_000).toFixed(1);
    return val.endsWith('.0') ? val.slice(0, -2) + 'k' : val + 'k';
  }
  return String(count);
}

/**
 * Format cost with conditional precision — canonical cost formatter.
 * Zero -> "$0.00"
 * >= $0.01 -> "$X.XX" (2 decimals)
 * >= $0.001 -> "$X.XXX" (3 decimals)
 * >= $0.0001 -> "$X.XXXX" (4 decimals)
 * < $0.0001 -> "< $0.0001"
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost >= 0.01) return `$${cost.toFixed(2)}`;
  if (cost >= 0.001) return `$${cost.toFixed(3)}`;
  if (cost >= 0.0001) return `$${cost.toFixed(4)}`;
  return '< $0.0001';
}

/**
 * Format cost with conditional precision (legacy, prefer formatCost).
 * >= $0.01 -> "$X.XX" (2 decimals)
 * >= $0.001 -> "$X.XXX" (3 decimals)
 * < $0.001 -> "< $0.001"
 */
export function formatTurnCost(cost: number): string {
  if (cost >= 0.01) return `$${cost.toFixed(2)}`;
  if (cost >= 0.001) return `$${cost.toFixed(3)}`;
  return '< $0.001';
}
