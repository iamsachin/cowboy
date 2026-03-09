import { ref, computed, watch, nextTick, type Ref, type ComputedRef } from 'vue';
import type { CollapseState } from './useCollapseState';

export interface SearchMatch {
  markEl: HTMLElement;
  groupId: string | null;
}

const HIGHLIGHT_CLASS = 'bg-warning/60 rounded-sm';
const CURRENT_CLASS = 'bg-primary text-primary-content';

/**
 * In-conversation text search with DOM TreeWalker highlighting.
 *
 * Walks text nodes inside the container, wraps case-insensitive matches
 * in <mark> elements, and provides prev/next navigation that auto-expands
 * collapsed groups and scrolls matches into view.
 */
export function useConversationSearch(
  containerRef: Ref<HTMLElement | null>,
  collapseState: CollapseState,
  groupIds: Ref<string[]>,
) {
  const query = ref('');
  const matches = ref<SearchMatch[]>([]);
  const currentIndex = ref(0);
  const isOpen = ref(false);

  const totalMatches = computed(() => matches.value.length);
  const currentMatchDisplay = computed(() =>
    matches.value.length > 0 ? currentIndex.value + 1 : 0,
  );

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
    query.value = '';
    clearHighlights();
  }

  function clearHighlights() {
    for (const match of matches.value) {
      const mark = match.markEl;
      const parent = mark.parentNode;
      if (!parent) continue;
      const text = document.createTextNode(mark.textContent || '');
      parent.replaceChild(text, mark);
      // Merge adjacent text nodes
      parent.normalize();
    }
    matches.value = [];
    currentIndex.value = 0;
  }

  function findGroupId(node: Node): string | null {
    let el: Element | null = node.nodeType === Node.ELEMENT_NODE
      ? node as Element
      : node.parentElement;
    while (el) {
      const gid = el.getAttribute('data-group-id');
      if (gid) return gid;
      el = el.parentElement;
    }
    return null;
  }

  function performSearch(q: string) {
    clearHighlights();

    const container = containerRef.value;
    if (!container || !q) return;

    const lowerQuery = q.toLowerCase();
    const newMatches: SearchMatch[] = [];

    // Collect text nodes first to avoid live NodeList issues during mutation
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node);
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      const lowerText = text.toLowerCase();
      const indices: number[] = [];
      let pos = 0;
      while (pos < lowerText.length) {
        const idx = lowerText.indexOf(lowerQuery, pos);
        if (idx === -1) break;
        indices.push(idx);
        pos = idx + lowerQuery.length;
      }

      if (indices.length === 0) continue;

      const groupId = findGroupId(textNode);
      const parent = textNode.parentNode;
      if (!parent) continue;

      // Build replacement fragments
      const frag = document.createDocumentFragment();
      let lastEnd = 0;

      for (const idx of indices) {
        // Text before the match
        if (idx > lastEnd) {
          frag.appendChild(document.createTextNode(text.slice(lastEnd, idx)));
        }

        // The match wrapped in <mark>
        const mark = document.createElement('mark');
        mark.className = HIGHLIGHT_CLASS;
        mark.textContent = text.slice(idx, idx + q.length);
        frag.appendChild(mark);

        newMatches.push({ markEl: mark, groupId });
        lastEnd = idx + q.length;
      }

      // Remaining text after last match
      if (lastEnd < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastEnd)));
      }

      parent.replaceChild(frag, textNode);
    }

    matches.value = newMatches;
    currentIndex.value = 0;

    // Highlight first match as current
    if (newMatches.length > 0) {
      updateCurrentHighlight(-1, 0);
    }
  }

  function updateCurrentHighlight(oldIdx: number, newIdx: number) {
    if (oldIdx >= 0 && oldIdx < matches.value.length) {
      const prev = matches.value[oldIdx].markEl;
      prev.className = HIGHLIGHT_CLASS;
    }
    if (newIdx >= 0 && newIdx < matches.value.length) {
      const curr = matches.value[newIdx].markEl;
      curr.className = `${HIGHLIGHT_CLASS} ${CURRENT_CLASS}`;
    }
  }

  async function navigateToMatch(newIdx: number) {
    const match = matches.value[newIdx];
    if (!match) return;

    // Auto-expand collapsed group
    if (match.groupId && !collapseState.isExpanded(match.groupId)) {
      collapseState.expandAll([match.groupId]);
      await nextTick();
    }

    match.markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function goNext() {
    if (matches.value.length === 0) return;
    const oldIdx = currentIndex.value;
    const newIdx = (oldIdx + 1) % matches.value.length;
    currentIndex.value = newIdx;
    updateCurrentHighlight(oldIdx, newIdx);
    navigateToMatch(newIdx);
  }

  function goPrev() {
    if (matches.value.length === 0) return;
    const oldIdx = currentIndex.value;
    const newIdx = (oldIdx - 1 + matches.value.length) % matches.value.length;
    currentIndex.value = newIdx;
    updateCurrentHighlight(oldIdx, newIdx);
    navigateToMatch(newIdx);
  }

  // Debounced search on query change
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  watch(query, (newQuery) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(newQuery);
    }, 200);
  });

  return {
    query,
    isOpen,
    matches,
    currentIndex,
    totalMatches,
    currentMatchDisplay,
    open,
    close,
    goNext,
    goPrev,
  };
}
