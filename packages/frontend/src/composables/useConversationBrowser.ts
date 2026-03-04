import { ref, watch, onScopeDispose } from 'vue';
import type { ConversationListResponse, SearchConversationListResponse } from '@cowboy/shared';
import { useDateRange } from './useDateRange';
import { useWebSocket } from './useWebSocket';

export type BrowserResponse = ConversationListResponse | SearchConversationListResponse;

export function useConversationBrowser() {
  const { dateRange } = useDateRange();

  const data = ref<BrowserResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Pagination state
  const page = ref(1);
  const limit = ref(20);

  // Sort state
  const sortField = ref('date');
  const sortOrder = ref<'asc' | 'desc'>('desc');

  // Filter state
  const agent = ref('');
  const project = ref('');
  const searchQuery = ref('');

  async function fetchConversations(): Promise<void> {
    loading.value = true;
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
      if (agent.value) {
        params.set('agent', agent.value);
      }
      if (project.value) {
        params.set('project', project.value);
      }
      if (searchQuery.value) {
        params.set('search', searchQuery.value);
      }
      const res = await fetch(`/api/analytics/conversations?${params}`);
      if (!res.ok) throw new Error(`Conversations fetch failed: ${res.status}`);
      data.value = await res.json();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
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

  function setAgent(a: string): void {
    agent.value = a;
    page.value = 1;
    fetchConversations();
  }

  function setProject(p: string): void {
    project.value = p;
    page.value = 1;
    fetchConversations();
  }

  function submitSearch(): void {
    page.value = 1;
    fetchConversations();
  }

  // Watch dateRange changes: reset page to 1 and re-fetch
  watch(
    () => dateRange.value,
    () => {
      page.value = 1;
      fetchConversations();
    },
    { deep: true, immediate: true }
  );

  // Live refetch on WebSocket data-changed signal (preserves filter/sort/page state)
  const { onDataChanged } = useWebSocket();
  const unsubscribe = onDataChanged(() => {
    fetchConversations();
  });
  onScopeDispose(unsubscribe);

  return {
    data,
    loading,
    error,
    page,
    limit,
    sortField,
    sortOrder,
    agent,
    project,
    searchQuery,
    setSort,
    setPage,
    setAgent,
    setProject,
    submitSearch,
  };
}
