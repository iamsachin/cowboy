import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, nextTick } from 'vue';
import { useConversationSearch } from '../../src/composables/useConversationSearch';
import type { CollapseState } from '../../src/composables/useCollapseState';
import { computed } from 'vue';

// Mock useKeyboardShortcuts since it requires component lifecycle
vi.mock('../../src/composables/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({
    register: vi.fn(),
    unregister: vi.fn(),
    shortcuts: computed(() => []),
    showCheatSheet: ref(false),
  }),
}));

function createContainer(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

function mockCollapseState(): CollapseState {
  const expanded = new Set<string>();
  return {
    isExpanded: (id: string) => expanded.has(id),
    toggle: (id: string) => {
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
    },
    expandAll: (ids: string[]) => ids.forEach(id => expanded.add(id)),
    collapseAll: () => expanded.clear(),
    expandedCount: computed(() => expanded.size),
  };
}

describe('useConversationSearch', () => {
  let container: HTMLElement;
  let containerRef: ReturnType<typeof ref<HTMLElement | null>>;
  let collapseState: CollapseState;
  let groupIds: ReturnType<typeof ref<string[]>>;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = createContainer(
      '<div data-group-id="g1"><p>Hello world, this is a test</p></div>' +
      '<div data-group-id="g2"><p>Another hello here</p></div>' +
      '<div><p>No group hello text</p></div>'
    );
    containerRef = ref(container);
    collapseState = mockCollapseState();
    groupIds = ref(['g1', 'g2']);
  });

  it('returns empty matches for empty query', async () => {
    const search = useConversationSearch(containerRef, collapseState, groupIds);
    search.query.value = '';
    await nextTick();
    // Allow debounce
    await new Promise(r => setTimeout(r, 300));
    expect(search.totalMatches.value).toBe(0);
    expect(search.matches.value).toHaveLength(0);
  });

  it('finds all case-insensitive matches and wraps in mark elements', async () => {
    const search = useConversationSearch(containerRef, collapseState, groupIds);
    search.query.value = 'hello';
    await nextTick();
    await new Promise(r => setTimeout(r, 300));
    expect(search.totalMatches.value).toBe(3);
    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(3);
  });

  it('matches are case-insensitive', async () => {
    const search = useConversationSearch(containerRef, collapseState, groupIds);
    search.query.value = 'HELLO';
    await nextTick();
    await new Promise(r => setTimeout(r, 300));
    expect(search.totalMatches.value).toBe(3);
  });

  it('goNext increments currentIndex and wraps around', async () => {
    const search = useConversationSearch(containerRef, collapseState, groupIds);
    search.query.value = 'hello';
    await nextTick();
    await new Promise(r => setTimeout(r, 300));

    expect(search.currentIndex.value).toBe(0);
    search.goNext();
    expect(search.currentIndex.value).toBe(1);
    search.goNext();
    expect(search.currentIndex.value).toBe(2);
    // Wrap around
    search.goNext();
    expect(search.currentIndex.value).toBe(0);
  });

  it('goPrev decrements currentIndex and wraps to last', async () => {
    const search = useConversationSearch(containerRef, collapseState, groupIds);
    search.query.value = 'hello';
    await nextTick();
    await new Promise(r => setTimeout(r, 300));

    expect(search.currentIndex.value).toBe(0);
    // Wrap to last
    search.goPrev();
    expect(search.currentIndex.value).toBe(2);
    search.goPrev();
    expect(search.currentIndex.value).toBe(1);
  });

  it('clearHighlights removes all mark elements and restores text', async () => {
    const search = useConversationSearch(containerRef, collapseState, groupIds);
    search.query.value = 'hello';
    await nextTick();
    await new Promise(r => setTimeout(r, 300));

    expect(container.querySelectorAll('mark').length).toBe(3);

    search.close();
    await nextTick();

    expect(container.querySelectorAll('mark').length).toBe(0);
    // Text content should be preserved
    expect(container.textContent).toContain('Hello world');
    expect(container.textContent).toContain('Another hello');
    expect(container.textContent).toContain('No group hello');
  });

  it('currentMatchDisplay is 1-indexed', async () => {
    const search = useConversationSearch(containerRef, collapseState, groupIds);
    search.query.value = 'hello';
    await nextTick();
    await new Promise(r => setTimeout(r, 300));

    expect(search.currentMatchDisplay.value).toBe(1);
    search.goNext();
    expect(search.currentMatchDisplay.value).toBe(2);
  });

  it('tracks groupId for each match', async () => {
    const search = useConversationSearch(containerRef, collapseState, groupIds);
    search.query.value = 'hello';
    await nextTick();
    await new Promise(r => setTimeout(r, 300));

    // First match is in g1, second in g2, third has no group
    expect(search.matches.value[0].groupId).toBe('g1');
    expect(search.matches.value[1].groupId).toBe('g2');
    expect(search.matches.value[2].groupId).toBeNull();
  });

  it('new search clears previous highlights', async () => {
    const search = useConversationSearch(containerRef, collapseState, groupIds);
    search.query.value = 'hello';
    await nextTick();
    await new Promise(r => setTimeout(r, 300));
    expect(container.querySelectorAll('mark').length).toBe(3);

    search.query.value = 'test';
    await nextTick();
    await new Promise(r => setTimeout(r, 300));
    // Only 1 match for "test"
    expect(container.querySelectorAll('mark').length).toBe(1);
    expect(search.totalMatches.value).toBe(1);
  });
});
