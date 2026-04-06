<template>
  <div class="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden rounded-lg">
    <!-- Drag region -->
    <div class="h-1.5 shrink-0" style="-webkit-app-region: drag"></div>

    <!-- Tab bar -->
    <div class="shrink-0 border-b border-base-300 px-2 pt-1 pb-0 overflow-x-auto">
      <div v-if="activeConversations.length > 0" class="tabs tabs-boxed bg-transparent gap-1">
        <button
          v-for="conv in activeConversations"
          :key="conv.id"
          class="tab tab-sm gap-1.5 min-w-0 max-w-[160px]"
          :class="{ 'tab-active': selectedId === conv.id }"
          @click="selectedId = conv.id"
        >
          <span class="inline-block w-2 h-2 rounded-full bg-success animate-pulse shrink-0"></span>
          <span class="truncate text-xs">{{ displayTitle(conv.title) }}</span>
        </button>
      </div>
      <div v-else class="py-1 text-xs text-base-content/50 text-center">No active conversations</div>
    </div>

    <!-- Content area -->
    <div ref="contentRef" class="flex-1 overflow-y-auto px-3 py-2 space-y-2">
      <!-- Empty state -->
      <div v-if="activeConversations.length === 0" class="flex flex-col items-center justify-center h-full text-base-content/40">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p class="text-sm">No active conversations</p>
      </div>

      <!-- Loading state -->
      <div v-else-if="detailLoading" class="flex items-center justify-center h-full">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <!-- Conversation messages -->
      <template v-else-if="groupedMessages.length > 0">
        <div v-for="(turn, idx) in groupedMessages" :key="idx" class="text-xs">
          <!-- User message -->
          <div v-if="turn.type === 'user'" class="chat chat-end">
            <div class="chat-bubble chat-bubble-primary text-xs whitespace-pre-wrap break-words max-w-[280px]">
              {{ truncateContent(turn.message.content) }}
            </div>
          </div>

          <!-- Assistant group -->
          <div v-else-if="turn.type === 'assistant-group'" class="chat chat-start">
            <div class="chat-bubble text-xs whitespace-pre-wrap break-words max-w-[300px]">
              {{ truncateContent(getAssistantText(turn)) }}
              <div v-if="turn.toolCallCount > 0" class="mt-1">
                <span class="badge badge-xs badge-outline opacity-70">{{ turn.toolCallCount }} tool call{{ turn.toolCallCount > 1 ? 's' : '' }}</span>
              </div>
            </div>
          </div>

          <!-- Slash command -->
          <div v-else-if="turn.type === 'slash-command'" class="text-center">
            <span class="badge badge-sm badge-ghost font-mono opacity-60">{{ turn.commandText }}</span>
          </div>

          <!-- Clear divider -->
          <div v-else-if="turn.type === 'clear-divider'" class="divider text-xs opacity-40">/clear</div>

          <!-- Compaction -->
          <div v-else-if="turn.type === 'compaction'" class="divider text-xs opacity-40">context compacted</div>
        </div>
      </template>

      <!-- No messages yet -->
      <div v-else-if="selectedId" class="flex items-center justify-center h-full text-base-content/40">
        <p class="text-sm">No messages yet</p>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="shrink-0 border-t border-base-300 px-3 py-2 flex justify-between items-center gap-2">
      <button class="btn btn-sm btn-ghost" @click="showMainWindow">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h18M3 12h18m-9 5h9" />
        </svg>
        Show App
      </button>
      <button class="btn btn-sm btn-error btn-outline" @click="quitApp">
        Quit
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useWebSocket } from '../composables/useWebSocket';
import { groupTurns, type AssistantGroup, type GroupedTurn } from '../composables/useGroupedTurns';
import { cleanTitle, stripXmlTags } from '../utils/content-sanitizer';
import { API_BASE } from '../utils/api-base';
import type { ConversationDetailResponse, ConversationRow } from '../types';

// --- Active conversations ---
const activeConversations = ref<{ id: string; title: string | null }[]>([]);
const selectedId = ref<string | null>(null);
const detailLoading = ref(false);
const groupedMessages = ref<GroupedTurn[]>([]);
const contentRef = ref<HTMLElement | null>(null);

let fetchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let detailDebounceTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchActiveConversations() {
  try {
    const res = await fetch(
      `${API_BASE}/api/analytics/conversations?from=2020-01-01&to=2099-12-31&limit=50&sort=date&order=desc`
    );
    if (!res.ok) return;
    const data = await res.json();
    const rows: ConversationRow[] = data.rows ?? [];
    const active = rows.filter((r) => r.isActive === true);
    activeConversations.value = active.map((r) => ({ id: r.id, title: r.title }));

    // Auto-select logic
    if (activeConversations.value.length > 0) {
      const currentStillActive = activeConversations.value.some((c) => c.id === selectedId.value);
      if (!selectedId.value || !currentStillActive) {
        selectedId.value = activeConversations.value[0].id;
      }
    } else {
      selectedId.value = null;
      groupedMessages.value = [];
    }
  } catch {
    // Silently fail — panel is non-critical
  }
}

function debouncedFetchActive() {
  if (fetchDebounceTimer) clearTimeout(fetchDebounceTimer);
  fetchDebounceTimer = setTimeout(fetchActiveConversations, 500);
}

// --- Conversation detail ---
async function fetchDetail(id: string) {
  detailLoading.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/analytics/conversations/${id}`);
    if (!res.ok) {
      groupedMessages.value = [];
      return;
    }
    const data: ConversationDetailResponse = await res.json();
    groupedMessages.value = groupTurns(data.messages, data.toolCalls, data.compactionEvents);
    // Auto-scroll to bottom
    await nextTick();
    if (contentRef.value) {
      contentRef.value.scrollTop = contentRef.value.scrollHeight;
    }
  } catch {
    groupedMessages.value = [];
  } finally {
    detailLoading.value = false;
  }
}

function debouncedRefetchDetail() {
  if (!selectedId.value) return;
  if (detailDebounceTimer) clearTimeout(detailDebounceTimer);
  const id = selectedId.value;
  detailDebounceTimer = setTimeout(() => fetchDetail(id), 500);
}

// Watch selected conversation
watch(
  () => selectedId.value,
  (id) => {
    if (id) {
      fetchDetail(id);
    } else {
      groupedMessages.value = [];
    }
  }
);

// --- WebSocket subscriptions ---
const { on } = useWebSocket();

on('conversation:created', () => {
  debouncedFetchActive();
});

on('conversation:changed', (evt) => {
  debouncedFetchActive();
  if (evt.conversationId === selectedId.value) {
    debouncedRefetchDetail();
  }
});

on('system:full-refresh', () => {
  fetchActiveConversations();
  if (selectedId.value) {
    fetchDetail(selectedId.value);
  }
});

// --- Initial load ---
fetchActiveConversations();

// --- Helpers ---
function displayTitle(title: string | null): string {
  return cleanTitle(title || '');
}

function getAssistantText(group: AssistantGroup): string {
  // Collect all assistant message content from the group
  for (const turn of group.turns) {
    if (turn.message.content) {
      return stripXmlTags(turn.message.content);
    }
  }
  return '(no content)';
}

function truncateContent(content: string | null): string {
  if (!content) return '';
  const cleaned = stripXmlTags(content);
  if (cleaned.length > 500) return cleaned.slice(0, 500) + '...';
  return cleaned;
}

async function showMainWindow() {
  try {
    const main = await WebviewWindow.getByLabel('main');
    if (main) {
      await main.show();
      await main.setFocus();
    }
  } catch {
    // Fallback: ignore
  }
}

async function quitApp() {
  try {
    await invoke('quit_app');
  } catch {
    // Fallback
  }
}

// Cleanup timers
onUnmounted(() => {
  if (fetchDebounceTimer) clearTimeout(fetchDebounceTimer);
  if (detailDebounceTimer) clearTimeout(detailDebounceTimer);
});
</script>
