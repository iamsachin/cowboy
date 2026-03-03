import { describe, it, expect } from 'vitest';
import { generateId } from '../../src/ingestion/id-generator.js';

describe('generateId', () => {
  it('produces a deterministic 32-char hex string', () => {
    const id = generateId('claude-code', 'abc-123');
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns the same value for the same inputs across calls', () => {
    const id1 = generateId('claude-code', 'abc-123');
    const id2 = generateId('claude-code', 'abc-123');
    expect(id1).toBe(id2);
  });

  it('produces different IDs for different agent prefixes', () => {
    const claudeId = generateId('claude-code', 'abc-123');
    const cursorId = generateId('cursor', 'abc-123');
    expect(claudeId).not.toBe(cursorId);
  });

  it('produces different IDs for different session values', () => {
    const id1 = generateId('claude-code', 'session-1');
    const id2 = generateId('claude-code', 'session-2');
    expect(id1).not.toBe(id2);
  });

  it('handles single part input', () => {
    const id = generateId('only-one-part');
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('handles many parts', () => {
    const id = generateId('a', 'b', 'c', 'd', 'e');
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});
