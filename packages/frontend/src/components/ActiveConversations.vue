<template>
  <div
    v-if="!collapsed && activeConversations.length > 0"
    class="px-4 py-3 border-t border-base-300"
  >
    <div class="text-xs text-base-content/60 font-medium mb-2 flex items-center gap-1.5">
      <span class="pulse-dot shrink-0"></span>Active
    </div>
    <div class="space-y-0.5">
      <router-link
        v-for="conv in visibleConversations"
        :key="conv.id"
        :to="`/conversations/${conv.id}`"
        class="block text-xs py-1 px-2 rounded hover:bg-base-300 truncate text-base-content/70 hover:text-base-content transition-colors"
      >
        {{ conv.title || conv.agent || 'Untitled' }}
      </router-link>
      <div
        v-if="activeConversations.length > 5"
        class="text-xs text-base-content/40 px-2 pt-1"
      >
        +{{ activeConversations.length - 5 }} more
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onScopeDispose } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';
import { API_BASE } from '../utils/api-base';
import type { ConversationRow } from '../types/api';

defineProps<{
  collapsed: boolean;
}>();

const activeConversations = ref<{ id: string; title: string | null; agent: string; project: string | null }[]>([]);

const visibleConversations = computed(() => activeConversations.value.slice(0, 5));

async function fetchActiveConversations() {
  try {
    const res = await fetch(
      `${API_BASE}/api/analytics/conversations?from=2020-01-01&to=2099-12-31&limit=50&sort=date&order=desc`
    );
    if (!res.ok) return;
    const data = await res.json();
    const rows: ConversationRow[] = data.rows ?? [];
    activeConversations.value = rows
      .filter((r) => r.isActive === true)
      .map((r) => ({ id: r.id, title: r.title, agent: r.agent, project: r.project }));
  } catch {
    // Silently ignore fetch errors
  }
}

// Initial fetch
fetchActiveConversations();

// WebSocket-driven refresh with debounce
const { on } = useWebSocket();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedRefresh() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchActiveConversations, 500);
}

on('conversation:created', debouncedRefresh);
on('conversation:changed', debouncedRefresh);
on('system:full-refresh', debouncedRefresh);

onScopeDispose(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<style scoped>
.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: oklch(0.72 0.19 142);
  animation: pulse-fade 1.5s ease-in-out infinite;
}

@keyframes pulse-fade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
