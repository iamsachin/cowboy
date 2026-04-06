<template>
  <div class="h-screen w-screen pt-0 p-2" style="background: transparent;">
    <!-- Arrow pointing up toward tray icon -->
    <div class="flex justify-center">
      <div class="w-4 h-4 bg-base-100 rotate-45 translate-y-2 z-10"></div>
    </div>
    <div class="flex flex-col flex-1 min-h-0 bg-base-100 text-base-content rounded-2xl overflow-hidden shadow-2xl" style="height: calc(100% - 8px);">

      <!-- View: Conversation list -->
      <template v-if="!selectedId">
        <div class="shrink-0 px-3 pt-3 pb-2 border-b border-base-300">
          <span class="text-sm font-semibold">Recent Conversations</span>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div v-if="conversations.length === 0" class="flex flex-col items-center justify-center h-full text-base-content/30">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p class="text-sm">No conversations</p>
          </div>
          <button
            v-for="conv in conversations"
            :key="conv.id"
            class="w-full text-left px-3 py-2.5 border-b border-base-300/50 hover:bg-base-200 transition-colors flex items-center gap-2"
            @click="selectedId = conv.id"
          >
            <span v-if="conv.isActive" class="inline-block w-2 h-2 rounded-full bg-success animate-pulse shrink-0"></span>
            <span v-else class="inline-block w-2 h-2 rounded-full bg-base-300 shrink-0"></span>
            <div class="min-w-0 flex-1">
              <div class="text-sm truncate">{{ displayTitle(conv.title) }}</div>
              <div class="text-xs text-base-content/40 truncate">{{ conv.agent }} · {{ formatRelativeDate(conv.date) }}</div>
            </div>
          </button>
        </div>
      </template>

      <!-- View: Conversation detail -->
      <template v-else>
        <div class="shrink-0 px-3 pt-3 pb-2 border-b border-base-300 flex items-center gap-2">
          <button class="btn btn-ghost btn-xs btn-circle" @click="selectedId = null">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="text-sm font-semibold truncate">{{ selectedTitle }}</span>
          <span v-if="selectedIsActive" class="inline-block w-2 h-2 rounded-full bg-success animate-pulse shrink-0"></span>
        </div>
        <TrayConversationView :key="selectedId" :conversationId="selectedId!" />
      </template>

      <!-- Bottom bar -->
      <div class="shrink-0 px-3 py-2.5 flex items-center gap-2 border-t border-base-300">
        <button class="btn btn-sm btn-ghost gap-1.5 text-base-content/70 hover:text-base-content" @click="showMainWindow">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h18M3 12h18m-9 5h9" />
          </svg>
          Show App
        </button>
        <button
          class="btn btn-sm btn-ghost btn-circle tooltip tooltip-top"
          :class="pinned ? 'text-primary' : 'text-base-content/40'"
          :data-tip="pinned ? 'Unpin panel' : 'Pin panel open'"
          @click="togglePin"
        >
          <PinOff v-if="pinned" class="w-4 h-4" />
          <Pin v-else class="w-4 h-4" />
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-sm btn-error btn-outline rounded-lg" @click="quitApp">
          Quit
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useWebSocket } from '../composables/useWebSocket';
import { cleanTitle } from '../utils/content-sanitizer';
import { API_BASE } from '../utils/api-base';
import { Pin, PinOff } from 'lucide-vue-next';
import TrayConversationView from '../components/TrayConversationView.vue';
import type { ConversationRow } from '../types';

// --- State ---
const conversations = ref<ConversationRow[]>([]);
const selectedId = ref<string | null>(null);
const pinned = ref(false);

let fetchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// --- Fetch last 10 primary conversations ---
async function fetchConversations() {
  try {
    const res = await fetch(
      `${API_BASE}/api/analytics/conversations?from=2020-01-01&to=2099-12-31&limit=10&sort=date&order=desc`
    );
    if (!res.ok) return;
    const data = await res.json();
    const rows: ConversationRow[] = data.rows ?? [];
    // Filter to primary conversations only (no sub-agents)
    conversations.value = rows.filter((r) => !r.parentConversationId);
  } catch {
    // Silently fail
  }
}

function debouncedFetch() {
  if (fetchDebounceTimer) clearTimeout(fetchDebounceTimer);
  fetchDebounceTimer = setTimeout(fetchConversations, 500);
}

// --- WebSocket subscriptions (conversation list only — detail handled by TrayConversationView) ---
const { on } = useWebSocket();

on('conversation:created', () => { debouncedFetch(); });
on('conversation:changed', () => { debouncedFetch(); });
on('system:full-refresh', () => { fetchConversations(); });

// --- Make window background transparent ---
document.documentElement.style.background = 'transparent';
document.body.style.background = 'transparent';

// --- Pin toggle (syncs to Rust for auto-hide on blur) ---
async function togglePin() {
  pinned.value = !pinned.value;
  try {
    await invoke('set_tray_pinned', { pinned: pinned.value });
  } catch {
    // ignore
  }
}

// --- Initial load ---
fetchConversations();

// --- Computed ---
const selectedTitle = computed(() => {
  const conv = conversations.value.find((c) => c.id === selectedId.value);
  return displayTitle(conv?.title ?? null);
});

const selectedIsActive = computed(() => {
  const conv = conversations.value.find((c) => c.id === selectedId.value);
  return conv?.isActive ?? false;
});

// --- Helpers ---
function displayTitle(title: string | null): string {
  const cleaned = cleanTitle(title || '');
  return cleaned || 'Untitled';
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

async function showMainWindow() {
  try {
    const panel = getCurrentWebviewWindow();
    await panel.hide();
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

onUnmounted(() => {
  if (fetchDebounceTimer) clearTimeout(fetchDebounceTimer);
});
</script>
