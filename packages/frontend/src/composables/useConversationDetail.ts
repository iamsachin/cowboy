import { ref } from 'vue';
import type { ConversationDetailResponse } from '@cowboy/shared';

export function useConversationDetail(conversationId: string) {
  const data = ref<ConversationDetailResponse | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const notFound = ref(false);

  async function fetchDetail(): Promise<void> {
    loading.value = true;
    error.value = null;
    notFound.value = false;
    try {
      const res = await fetch(`/api/analytics/conversations/${conversationId}`);
      if (res.status === 404) {
        notFound.value = true;
        return;
      }
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      data.value = await res.json();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  // Fetch immediately on creation
  fetchDetail();

  return {
    data,
    loading,
    error,
    notFound,
    fetchDetail,
  };
}
