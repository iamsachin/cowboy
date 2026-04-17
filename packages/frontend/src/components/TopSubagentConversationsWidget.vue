<template>
  <div class="bg-base-200 rounded-lg p-4">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-semibold">Top Sub-agent-heavy Conversations</h2>
    </div>

    <div v-if="loading && rows.length === 0" class="flex justify-center py-6">
      <span class="loading loading-spinner loading-md"></span>
    </div>

    <div v-else-if="rows.length === 0" class="text-center py-6 text-base-content/50">
      No sub-agent activity in this period
    </div>

    <div v-else class="overflow-x-auto">
      <table class="table table-zebra table-sm">
        <thead>
          <tr>
            <th class="w-12"></th>
            <th>Title</th>
            <th class="text-right">Sub-agents</th>
            <th>Outcomes</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="row.conversationId"
            class="cursor-pointer hover"
            @click="router.push({ name: 'conversation-detail', params: { id: row.conversationId } })"
          >
            <td>
              <span class="badge badge-sm badge-ghost font-bold">{{ index + 1 }}</span>
            </td>
            <td>
              <div class="max-w-[18rem] truncate">
                {{ row.title ? truncate(row.title, 40) : 'Untitled' }}
              </div>
            </td>
            <td class="text-right font-mono">{{ row.subagentCount }}</td>
            <td class="whitespace-nowrap text-xs">
              <span v-if="row.successCount > 0" class="text-success mr-2">{{ row.successCount }} ✓</span>
              <span v-if="row.errorCount > 0" class="text-error mr-2">{{ row.errorCount }} ✗</span>
              <span v-if="row.interruptedCount > 0" class="text-warning">{{ row.interruptedCount }} ⏸</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onScopeDispose } from 'vue';
import { useRouter } from 'vue-router';
import { useDateRange } from '../composables/useDateRange';
import { useWebSocket } from '../composables/useWebSocket';
import type { TopSubagentConversationRow } from '../types/api';
import { API_BASE } from '../utils/api-base';

const router = useRouter();
const { dateRange } = useDateRange();

const rows = ref<TopSubagentConversationRow[]>([]);
const loading = ref(false);

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

async function fetchTop(isLive = false) {
  if (!isLive) loading.value = true;
  try {
    const { from, to } = dateRange.value;
    const res = await fetch(
      `${API_BASE}/api/analytics/subagents/top-conversations?limit=5&from=${from}&to=${to}`
    );
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    rows.value = await res.json();
  } catch {
    // Silently fail — widget is non-critical
  } finally {
    loading.value = false;
  }
}

watch(() => dateRange.value, () => fetchTop(), { deep: true, immediate: true });

let wsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedWsRefetch(): void {
  if (wsDebounceTimer) clearTimeout(wsDebounceTimer);
  wsDebounceTimer = setTimeout(() => {
    wsDebounceTimer = null;
    fetchTop(true);
  }, 500);
}

const { on } = useWebSocket();
on('conversation:changed', debouncedWsRefetch);
on('conversation:created', debouncedWsRefetch);
on('system:full-refresh', debouncedWsRefetch);
on('tool_call:changed', debouncedWsRefetch);

onScopeDispose(() => {
  if (wsDebounceTimer) clearTimeout(wsDebounceTimer);
});
</script>
