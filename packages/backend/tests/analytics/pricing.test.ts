import { describe, it, expect } from 'vitest';
import { calculateCost, autoGranularity } from '@cowboy/shared';

describe('calculateCost', () => {
  it('returns correct cost and savings for exact model match (claude-sonnet-4-5)', () => {
    const result = calculateCost('claude-sonnet-4-5', 1000000, 500000, 200000, 100000);
    expect(result).not.toBeNull();
    // cost = (1000000*3 + 500000*15 + 200000*0.30 + 100000*3.75) / 1_000_000
    //      = (3000000 + 7500000 + 60000 + 375000) / 1_000_000
    //      = 10935000 / 1_000_000 = 10.935
    expect(result!.cost).toBeCloseTo(10.935, 5);
    // savings = 200000 * (3 - 0.30) / 1_000_000 = 200000 * 2.70 / 1_000_000 = 0.54
    expect(result!.savings).toBeCloseTo(0.54, 5);
  });

  it('returns correct cost for fuzzy model match (model string containing key)', () => {
    const result = calculateCost('claude-sonnet-4-5-20250514', 1000000, 500000, 200000, 100000);
    expect(result).not.toBeNull();
    expect(result!.cost).toBeCloseTo(10.935, 5);
    expect(result!.savings).toBeCloseTo(0.54, 5);
  });

  it('returns null for unknown model', () => {
    const result = calculateCost('unknown-model', 1000000, 500000, 200000, 100000);
    expect(result).toBeNull();
  });

  it('returns { cost: 0, savings: 0 } with zero tokens', () => {
    const result = calculateCost('claude-sonnet-4-5', 0, 0, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.cost).toBe(0);
    expect(result!.savings).toBe(0);
  });

  it('handles haiku model pricing correctly', () => {
    const result = calculateCost('claude-haiku-4-5', 50000, 25000, 10000, 5000);
    expect(result).not.toBeNull();
    // cost = (50000*1 + 25000*5 + 10000*0.10 + 5000*1.25) / 1_000_000
    //      = (50000 + 125000 + 1000 + 6250) / 1_000_000
    //      = 182250 / 1_000_000 = 0.18225
    expect(result!.cost).toBeCloseTo(0.18225, 5);
    // savings = 10000 * (1 - 0.10) / 1_000_000 = 0.009
    expect(result!.savings).toBeCloseTo(0.009, 5);
  });
});

describe('autoGranularity', () => {
  it('returns daily for 7-day range', () => {
    expect(autoGranularity('2026-01-01', '2026-01-08')).toBe('daily');
  });

  it('returns daily for 13-day range', () => {
    expect(autoGranularity('2026-01-01', '2026-01-14')).toBe('daily');
  });

  it('returns weekly for 14-day range', () => {
    expect(autoGranularity('2026-01-01', '2026-01-15')).toBe('weekly');
  });

  it('returns weekly for 90-day range', () => {
    expect(autoGranularity('2026-01-01', '2026-04-01')).toBe('weekly');
  });

  it('returns monthly for 91-day range', () => {
    expect(autoGranularity('2026-01-01', '2026-04-02')).toBe('monthly');
  });

  it('returns monthly for 120-day range', () => {
    expect(autoGranularity('2026-01-01', '2026-05-01')).toBe('monthly');
  });
});
