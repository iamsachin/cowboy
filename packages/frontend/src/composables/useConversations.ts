import { ref, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ConversationListResponse } from '@cowboy/shared';
import { useDateRange } from './useDateRange';

export function useConversations(agentFilter?: Ref<string | undefined>) {
  const route = useRoute();
  const router = useRouter();
  const { dateRange } = useDateRange();

  const data = ref<ConversationListResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Pagination state — initialize from URL query
  const initialPage = Number(route.query.page) || 1;
  const page = ref(initialPage);
  const limit = ref(20);
  let isInitialLoad = true;

  // Sort state
  const sortField = ref('date');
  const sortOrder = ref<'asc' | 'desc'>('desc');

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
      if (agentFilter?.value) {
        params.set('agent', agentFilter.value);
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
    error,
    page,
    limit,
    sortField,
    sortOrder,
    setSort,
    setPage,
  };
}
