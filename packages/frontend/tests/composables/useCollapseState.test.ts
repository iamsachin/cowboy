import { describe, it, expect } from 'vitest';
import { useCollapseState } from '../../src/composables/useCollapseState';

describe('useCollapseState', () => {
  it('returns false for unknown IDs (default collapsed)', () => {
    const { isExpanded } = useCollapseState();
    expect(isExpanded('id-1')).toBe(false);
  });

  it('toggle makes isExpanded return true', () => {
    const { isExpanded, toggle } = useCollapseState();
    toggle('id-1');
    expect(isExpanded('id-1')).toBe(true);
  });

  it('toggle twice returns to false', () => {
    const { isExpanded, toggle } = useCollapseState();
    toggle('id-1');
    toggle('id-1');
    expect(isExpanded('id-1')).toBe(false);
  });

  it('expandAll makes all provided IDs expanded', () => {
    const { isExpanded, expandAll } = useCollapseState();
    expandAll(['id-1', 'id-2', 'id-3']);
    expect(isExpanded('id-1')).toBe(true);
    expect(isExpanded('id-2')).toBe(true);
    expect(isExpanded('id-3')).toBe(true);
  });

  it('collapseAll makes all previously expanded IDs collapsed', () => {
    const { isExpanded, toggle, collapseAll } = useCollapseState();
    toggle('id-1');
    toggle('id-2');
    expect(isExpanded('id-1')).toBe(true);
    collapseAll();
    expect(isExpanded('id-1')).toBe(false);
    expect(isExpanded('id-2')).toBe(false);
  });

  it('expandedCount is 0 initially', () => {
    const { expandedCount } = useCollapseState();
    expect(expandedCount.value).toBe(0);
  });

  it('expandedCount increments on toggle', () => {
    const { expandedCount, toggle } = useCollapseState();
    toggle('id-1');
    expect(expandedCount.value).toBe(1);
    toggle('id-2');
    expect(expandedCount.value).toBe(2);
  });

  it('expandedCount returns correct count after expandAll', () => {
    const { expandedCount, expandAll } = useCollapseState();
    expandAll(['id-1', 'id-2', 'id-3']);
    expect(expandedCount.value).toBe(3);
  });

  it('collapseAll resets expandedCount to 0', () => {
    const { expandedCount, expandAll, collapseAll } = useCollapseState();
    expandAll(['id-1', 'id-2']);
    expect(expandedCount.value).toBe(2);
    collapseAll();
    expect(expandedCount.value).toBe(0);
  });

  it('multiple composable instances are independent', () => {
    const state1 = useCollapseState();
    const state2 = useCollapseState();

    state1.toggle('id-1');
    expect(state1.isExpanded('id-1')).toBe(true);
    expect(state2.isExpanded('id-1')).toBe(false);
  });
});
