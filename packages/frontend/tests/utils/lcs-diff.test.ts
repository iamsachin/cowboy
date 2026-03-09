import { describe, it, expect } from 'vitest';
import { computeLineDiff } from '../../src/utils/lcs-diff';
import type { DiffLine, DiffResult } from '../../src/utils/lcs-diff';

describe('computeLineDiff', () => {
  it('identifies added, removed, and unchanged lines in a simple swap', () => {
    const result = computeLineDiff('a\nb\nc', 'a\nx\nc');
    expect(result.lines).toEqual([
      { type: 'unchanged', content: 'a', oldLineNum: 1, newLineNum: 1 },
      { type: 'remove', content: 'b', oldLineNum: 2 },
      { type: 'add', content: 'x', newLineNum: 2 },
      { type: 'unchanged', content: 'c', oldLineNum: 3, newLineNum: 3 },
    ]);
    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it('returns all-add lines when old text is empty', () => {
    const result = computeLineDiff('', 'a\nb');
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(0);
    expect(result.lines.every(l => l.type === 'add')).toBe(true);
    expect(result.lines.length).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it('returns all-remove lines when new text is empty', () => {
    const result = computeLineDiff('a\nb', '');
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(2);
    expect(result.lines.every(l => l.type === 'remove')).toBe(true);
    expect(result.lines.length).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it('returns 1 unchanged line when texts are identical', () => {
    const result = computeLineDiff('same', 'same');
    expect(result.lines).toEqual([
      { type: 'unchanged', content: 'same', oldLineNum: 1, newLineNum: 1 },
    ]);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('handles mixed diffs correctly', () => {
    const result = computeLineDiff('a\nb\nc\nd', 'a\nc\ne');
    // a is unchanged, b is removed, c is unchanged, d is removed, e is added
    const types = result.lines.map(l => l.type);
    expect(types).toContain('unchanged');
    expect(types).toContain('remove');
    expect(types).toContain('add');
    // a and c should be unchanged
    const unchanged = result.lines.filter(l => l.type === 'unchanged');
    expect(unchanged.map(l => l.content)).toEqual(['a', 'c']);
    // b and d should be removed
    const removed = result.lines.filter(l => l.type === 'remove');
    expect(removed.map(l => l.content)).toEqual(['b', 'd']);
    // e should be added
    const added = result.lines.filter(l => l.type === 'add');
    expect(added.map(l => l.content)).toEqual(['e']);
    expect(result.truncated).toBe(false);
  });

  it('sets oldLineNum for unchanged and remove lines', () => {
    const result = computeLineDiff('a\nb\nc', 'a\nx\nc');
    const unchangedAndRemoved = result.lines.filter(l => l.type === 'unchanged' || l.type === 'remove');
    for (const line of unchangedAndRemoved) {
      expect(line.oldLineNum).toBeDefined();
      expect(typeof line.oldLineNum).toBe('number');
    }
  });

  it('sets newLineNum for unchanged and add lines', () => {
    const result = computeLineDiff('a\nb\nc', 'a\nx\nc');
    const unchangedAndAdded = result.lines.filter(l => l.type === 'unchanged' || l.type === 'add');
    for (const line of unchangedAndAdded) {
      expect(line.newLineNum).toBeDefined();
      expect(typeof line.newLineNum).toBe('number');
    }
  });

  it('does not set oldLineNum on add lines', () => {
    const result = computeLineDiff('a', 'a\nb');
    const addLines = result.lines.filter(l => l.type === 'add');
    for (const line of addLines) {
      expect(line.oldLineNum).toBeUndefined();
    }
  });

  it('does not set newLineNum on remove lines', () => {
    const result = computeLineDiff('a\nb', 'a');
    const removeLines = result.lines.filter(l => l.type === 'remove');
    for (const line of removeLines) {
      expect(line.newLineNum).toBeUndefined();
    }
  });

  it('truncates inputs exceeding 500 lines and sets truncated flag', () => {
    const bigOld = Array.from({ length: 600 }, (_, i) => `old-line-${i}`).join('\n');
    const bigNew = Array.from({ length: 600 }, (_, i) => `new-line-${i}`).join('\n');
    const result = computeLineDiff(bigOld, bigNew);
    expect(result.truncated).toBe(true);
    // Should only process up to 500 lines from each
    const maxOldLineNum = Math.max(
      ...result.lines.filter(l => l.oldLineNum !== undefined).map(l => l.oldLineNum!)
    );
    const maxNewLineNum = Math.max(
      ...result.lines.filter(l => l.newLineNum !== undefined).map(l => l.newLineNum!)
    );
    expect(maxOldLineNum).toBeLessThanOrEqual(500);
    expect(maxNewLineNum).toBeLessThanOrEqual(500);
  });

  it('does not set truncated flag for inputs within 500 lines', () => {
    const small = Array.from({ length: 100 }, (_, i) => `line-${i}`).join('\n');
    const result = computeLineDiff(small, small);
    expect(result.truncated).toBe(false);
  });

  it('handles both empty strings', () => {
    const result = computeLineDiff('', '');
    expect(result.lines).toEqual([]);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.truncated).toBe(false);
  });
});
