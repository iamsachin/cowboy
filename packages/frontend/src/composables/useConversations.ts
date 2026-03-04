import { ref, watch } from 'vue';
import type { ConversationListResponse } from '@cowboy/shared';
import { useDateRange } from './useDateRange';

export function useConversations() {
  const { dateRange } = useDateRange();

  const data = ref<ConversationListResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Pagination state
  const page = ref(1);
  const limit = ref(20);

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

  // Watch dateRange changes: reset page to 1 and re-fetch
  watch(
    () => dateRange.value,
    () => {
      page.value = 1;
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
