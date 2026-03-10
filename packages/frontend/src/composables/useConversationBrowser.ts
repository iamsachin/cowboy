import { ref, watch, onScopeDispose } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ConversationListResponse, SearchConversationListResponse } from '@cowboy/shared';
import { useDateRange } from './useDateRange';
import { useWebSocket } from './useWebSocket';

export type BrowserResponse = ConversationListResponse | SearchConversationListResponse;

export function useConversationBrowser() {
  const route = useRoute();
  const router = useRouter();
  const { dateRange } = useDateRange();

  const data = ref<BrowserResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Pagination state — initialize from URL query param
  const initialPage = parseInt(route.query.page as string, 10);
  const page = ref(Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1);
  const limit = ref(20);

  // Prevent dateRange immediate watcher from resetting page on initial mount
  let isInitialLoad = true;

  // Sync page changes back to URL (replace, not push, to avoid history pollution)
  watch(page, (newPage) => {
    router.replace({ query: { ...route.query, page: newPage > 1 ? String(newPage) : undefined } });
  });

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
    // Immediate search (e.g. on Enter key) — cancel any pending debounce
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
    page.value = 1;
    fetchConversations();
  }

  function clearSearch(): void {
    searchQuery.value = '';
    page.value = 1;
    fetchConversations();
  }

  // Debounced auto-search: triggers 400ms after user stops typing
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  watch(searchQuery, (newVal, oldVal) => {
    if (newVal === oldVal) return;
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
    if (newVal === '') {
      // Immediately clear search results
      page.value = 1;
      fetchConversations();
    } else {
      searchTimeout = setTimeout(() => {
        searchTimeout = null;
        page.value = 1;
        fetchConversations();
      }, 400);
    }
  });

  onScopeDispose(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
  });

  // Filter options from API (projects, agents for the current date range)
  const filterOptions = ref<{ projects: string[]; agents: string[] } | null>(null);

  async function fetchFilterOptions(): Promise<void> {
    try {
      const { from, to } = dateRange.value;
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/analytics/filters?${params}`);
      if (!res.ok) return;
      filterOptions.value = await res.json();
    } catch {
      // Silently fail — filter dropdowns will use fallback
    }
  }

  // Watch dateRange changes: reset page to 1 and re-fetch
  watch(
    () => dateRange.value,
    () => {
      if (isInitialLoad) {
        isInitialLoad = false;
        // On initial load, preserve page from URL — don't reset to 1
      } else {
        page.value = 1;
      }
      fetchConversations();
      fetchFilterOptions();
    },
    { deep: true, immediate: true }
  );

  // Live refetch on typed WebSocket events (preserves filter/sort/page state)
  const { on } = useWebSocket();
  on('conversation:changed', () => fetchConversations());
  on('conversation:created', () => fetchConversations());
  on('system:full-refresh', () => fetchConversations());

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
    clearSearch,
    filterOptions,
  };
}
