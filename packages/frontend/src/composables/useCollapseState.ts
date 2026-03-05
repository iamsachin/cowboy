import { reactive, computed, type ComputedRef } from 'vue';

export interface CollapseState {
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  expandAll: (ids: string[]) => void;
  collapseAll: () => void;
  expandedCount: ComputedRef<number>;
}

/**
 * Manages expand/collapse state for turn cards via a reactive Map.
 *
 * Each call creates an independent instance (not a shared singleton).
 * Absent keys default to collapsed (false).
 */
export function useCollapseState(): CollapseState {
  const state = reactive(new Map<string, boolean>());

  function isExpanded(id: string): boolean {
    return state.get(id) === true;
  }

  function toggle(id: string): void {
    state.set(id, !isExpanded(id));
  }

  function expandAll(ids: string[]): void {
    for (const id of ids) {
      state.set(id, true);
    }
  }

  function collapseAll(): void {
    state.clear();
  }

  const expandedCount = computed(() => {
    let count = 0;
    for (const val of state.values()) {
      if (val) count++;
    }
    return count;
  });

  return { isExpanded, toggle, expandAll, collapseAll, expandedCount };
}
