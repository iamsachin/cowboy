import { ref, watch, onScopeDispose, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ConversationListResponse } from '@cowboy/shared';
import { useDateRange } from './useDateRange';
import { useWebSocket } from './useWebSocket';

export function useConversations(agentFilter?: Ref<string | undefined>) {
  const route = useRoute();
  const router = useRouter();
  const { dateRange } = useDateRange();

  const data = ref<ConversationListResponse | null>(null);
  const loading = ref(false);
  const refreshing = ref(false);
  const error = ref<string | null>(null);

  // New-row tracking for UI highlights
  const previousIds = new Set<string>();
  const newIds = ref<Set<string>>(new Set());
  let newIdsClearTimer: ReturnType<typeof setTimeout> | null = null;

  // Pagination state — initialize from URL query
  const initialPage = Number(route.query.page) || 1;
  const page = ref(initialPage);
  const limit = ref(20);
  let isInitialLoad = true;

  // Sort state
  const sortField = ref('date');
  const sortOrder = ref<'asc' | 'desc'>('desc');

  function trackNewRows(rows: { id: string }[]): void {
    const currentIds = new Set(rows.map((r) => r.id));
    if (previousIds.size === 0) {
      // Initial load — populate previousIds but don't mark anything as new
      currentIds.forEach((id) => previousIds.add(id));
      return;
    }
    const added = new Set<string>();
    currentIds.forEach((id) => {
      if (!previousIds.has(id)) added.add(id);
    });
    newIds.value = added;
    // Update previousIds for next comparison
    previousIds.clear();
    currentIds.forEach((id) => previousIds.add(id));
    // Auto-clear after 2s
    if (newIdsClearTimer) clearTimeout(newIdsClearTimer);
    if (added.size > 0) {
      newIdsClearTimer = setTimeout(() => {
        newIds.value = new Set();
        newIdsClearTimer = null;
      }, 2000);
    }
  }

  async function fetchConversations(isLive = false): Promise<void> {
    if (isLive) {
      refreshing.value = true;
    } else {
      loading.value = true;
    }
    error.value = null;
    try {
      const { from, to } = dateRange.value;
      const params = new URLSearchParams({
        from,
        to,
        page: page.value.toString(),
        limit: limit.value.toString(),
        sort: sortField.value,
        order: sortOrder.value,
      });
      if (agentFilter?.value) {
        params.set('agent', agentFilter.value);
      }
      const res = await fetch(`/api/analytics/conversations?${params}`);
      if (!res.ok) throw new Error(`Conversations fetch failed: ${res.status}`);
      const result: ConversationListResponse = await res.json();
      data.value = result;
      trackNewRows(result.rows);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
      refreshing.value = false;
    }
  }

  function setSort(field: string): void {
    if (sortField.value === field) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortField.value = field;
      sortOrder.value = 'desc';
    }
    page.value = 1;
    fetchConversations();
  }

  function setPage(p: number): void {
    page.value = p;
    fetchConversations();
  }

  // Sync page to URL query param
  watch(page, (newPage) => {
    const query = { ...route.query };
    if (newPage > 1) {
      query.page = String(newPage);
    } else {
      delete query.page;
    }
    router.replace({ query });
  });

  // Debounced WS refetch — coalesces rapid events into one fetch
  let wsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  function debouncedWsRefetch(): void {
    if (wsDebounceTimer) clearTimeout(wsDebounceTimer);
    wsDebounceTimer = setTimeout(() => {
      wsDebounceTimer = null;
      fetchConversations(true);
    }, 500);
  }

  const { on } = useWebSocket();
  on('conversation:created', debouncedWsRefetch);
  on('conversation:changed', debouncedWsRefetch);
  on('system:full-refresh', debouncedWsRefetch);

  onScopeDispose(() => {
    if (wsDebounceTimer) {
      clearTimeout(wsDebounceTimer);
      wsDebounceTimer = null;
    }
    if (newIdsClearTimer) {
      clearTimeout(newIdsClearTimer);
      newIdsClearTimer = null;
    }
  });

  // Watch dateRange and agentFilter changes: reset page to 1 and re-fetch
  watch(
    [() => dateRange.value, () => agentFilter?.value],
    () => {
      if (!isInitialLoad) {
        page.value = 1;
      }
      isInitialLoad = false;
      fetchConversations();
    },
    { deep: true, immediate: true }
  );

  return {
    data,
    loading,
    refreshing,
    error,
    page,
    limit,
    sortField,
    sortOrder,
    newIds,
    setSort,
    setPage,
  };
}
