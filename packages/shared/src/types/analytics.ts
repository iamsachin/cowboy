export type Granularity = 'daily' | 'weekly' | 'monthly';

/**
 * Auto-detect granularity from date range.
 * <14 days = daily, 14-90 days = weekly, >90 days = monthly
 */
export function autoGranularity(from: string, to: string): Granularity {
  const days = Math.ceil(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days < 14) return 'daily';
  if (days <= 90) return 'weekly';
  return 'monthly';
}
