import { ref } from 'vue';
import type { ConversationDetailResponse } from '../types';
import { useWebSocket } from './useWebSocket';
import { groupTurns, type GroupedTurn } from './useGroupedTurns';
import { API_BASE } from '../utils/api-base';

/**
 * Compute group keys from a ConversationDetailResponse.
 * Uses the same turnKey logic as ConversationDetail.vue.
 */
function computeGroupKeys(detail: ConversationDetailResponse): Set<string> {
  const turns = groupTurns(detail.messages, detail.toolCalls, detail.compactionEvents);
  const keys = new Set<string>();
  for (const turn of turns) {
    keys.add(turnKey(turn));
  }
  return keys;
}

function turnKey(turn: GroupedTurn): string {
  if (turn.type === 'user') return turn.message.id;
  if (turn.type === 'assistant-group') return turn.turns[0].message.id;
  if (turn.type === 'system-group') return turn.messages[0].id;
  if (turn.type === 'slash-command') return turn.message.id;
  if (turn.type === 'agent-prompt') return turn.message.id;
  if (turn.type === 'compaction') return turn.id;
  // clear-divider
  return turn.message.id;
}

const DEBOUNCE_MS = 150;

export function useConversationDetail(conversationId: string) {
  const data = ref<ConversationDetailResponse | null>(null);
  const loading = ref(true);
  const refreshing = ref(false);
  const error = ref<string | null>(null);
  const notFound = ref(false);

  // Group key tracking for detecting new groups after refetch
  const previousGroupKeys = ref<Set<string>>(new Set());
  const newGroupKeys = ref<Set<string>>(new Set());

  // In-flight queue state
  let fetchInFlight = false;
  let pendingRefetch = false;

  // Debounce state
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function doFetch(isInitial: boolean): Promise<void> {
    if (isInitial) {
      loading.value = true;
    } else {
      refreshing.value = true;
    }
    error.value = null;

    if (!isInitial) {
      // Don't reset notFound on live refetch
    } else {
      notFound.value = false;
    }

    fetchInFlight = true;
    try {
      const res = await fetch(`${API_BASE}/api/analytics/conversations/${conversationId}`);
      if (res.status === 404) {
        notFound.value = true;
        return;
      }
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const newData: ConversationDetailResponse = await res.json();

      // Track group keys for new group detection
      if (!isInitial && data.value) {
        const oldKeys = computeGroupKeys(data.value);
        const currentKeys = computeGroupKeys(newData);
        previousGroupKeys.value = oldKeys;
        const newKeys = new Set<string>();
        for (const key of currentKeys) {
          if (!oldKeys.has(key)) {
            newKeys.add(key);
          }
        }
        newGroupKeys.value = newKeys;
      }

      data.value = newData;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      if (isInitial) {
        loading.value = false;
      } else {
        refreshing.value = false;
      }
      fetchInFlight = false;

      // If a refetch was queued while we were in-flight, fire it now
      if (pendingRefetch) {
        pendingRefetch = false;
        doFetch(false);
      }
    }
  }

  function debouncedRefetch(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (fetchInFlight) {
        // Queue one more refetch after current completes
        pendingRefetch = true;
      } else {
        doFetch(false);
      }
    }, DEBOUNCE_MS);
  }

  // Fetch immediately on creation (initial load)
  doFetch(true);

  // Live refetch on typed WebSocket events (conversation-scoped)
  const { on } = useWebSocket();
  on('conversation:changed', (evt) => {
    if (evt.conversationId === conversationId) {
      debouncedRefetch();
    }
  });

  // system:full-refresh bypasses debounce
  on('system:full-refresh', () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (fetchInFlight) {
      pendingRefetch = true;
    } else {
      doFetch(false);
    }
  });

  return {
    data,
    loading,
    refreshing,
    error,
    notFound,
    fetchDetail: () => doFetch(true),
    previousGroupKeys,
    newGroupKeys,
  };
}
