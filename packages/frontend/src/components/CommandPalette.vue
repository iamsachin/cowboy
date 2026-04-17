<template>
  <Teleport to="body">
    <Transition name="palette-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/40" @click="close" />

        <!-- Palette -->
        <div class="relative z-10 w-full max-w-lg rounded-box bg-base-100 shadow-2xl border border-base-300 overflow-hidden">
          <!-- Search input -->
          <div class="flex items-center gap-2 px-4 py-3 border-b border-base-300">
            <Search class="w-5 h-5 text-base-content/40 shrink-0" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="input input-ghost w-full focus:outline-none bg-transparent p-0 h-auto min-h-0"
              placeholder="Search pages, conversations, sub-agents... (try 'sub 3')"
              @keydown.arrow-up.prevent="navigateUp"
              @keydown.arrow-down.prevent="navigateDown"
              @keydown.enter.prevent="select"
              @keydown.escape.prevent="close"
            />
            <span v-if="loading" class="loading loading-spinner loading-sm text-base-content/40" />
          </div>

          <!-- Results -->
          <div class="max-h-80 overflow-y-auto py-1">
            <!-- Current conversation sub-agents -->
            <template v-if="filteredCurrentSubagents.length > 0">
              <div class="px-3 py-1 text-xs font-semibold uppercase text-base-content/50">
                In this conversation
              </div>
              <div
                v-for="(result, idx) in filteredCurrentSubagents"
                :key="'cur-sub-' + (result.type === 'current-subagent' ? result.item.toolCallId : idx)"
                class="flex items-center gap-3 px-3 py-2 cursor-pointer"
                :class="flatIndex('current-subagent', idx) === highlightedIndex ? 'bg-base-200' : 'hover:bg-base-200/50'"
                @mouseenter="highlightedIndex = flatIndex('current-subagent', idx)"
                @click="selectAt(flatIndex('current-subagent', idx))"
              >
                <Bot class="w-4 h-4 text-info shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="badge badge-ghost badge-xs">#{{ result.type === 'current-subagent' ? result.index + 1 : '' }}</span>
                    <span class="text-sm truncate">{{ result.type === 'current-subagent' ? result.item.description : '' }}</span>
                  </div>
                  <div class="text-xs text-base-content/50">
                    {{ result.type === 'current-subagent' ? result.item.status : '' }}
                  </div>
                </div>
              </div>
            </template>

            <!-- Pages section -->
            <template v-if="filteredPages.length > 0">
              <div class="px-3 py-1 text-xs font-semibold uppercase text-base-content/50 mt-1">
                Pages
              </div>
              <div
                v-for="(page, idx) in filteredPages"
                :key="'page-' + page.name"
                class="flex items-center gap-3 px-3 py-2 cursor-pointer"
                :class="flatIndex('page', idx) === highlightedIndex ? 'bg-base-200' : 'hover:bg-base-200/50'"
                @mouseenter="highlightedIndex = flatIndex('page', idx)"
                @click="selectAt(flatIndex('page', idx))"
              >
                <component :is="pageIcon(page.icon)" class="w-4 h-4 text-base-content/50" />
                <span class="text-sm">{{ page.name }}</span>
              </div>
            </template>

            <!-- Conversations section -->
            <template v-if="filteredConversations.length > 0">
              <div class="px-3 py-1 text-xs font-semibold uppercase text-base-content/50 mt-1">
                Conversations
              </div>
              <div
                v-for="(convo, idx) in filteredConversations"
                :key="'convo-' + convo.id"
                class="flex items-center gap-3 px-3 py-2 cursor-pointer"
                :class="flatIndex('conversation', idx) === highlightedIndex ? 'bg-base-200' : 'hover:bg-base-200/50'"
                @mouseenter="highlightedIndex = flatIndex('conversation', idx)"
                @click="selectAt(flatIndex('conversation', idx))"
              >
                <MessageSquare class="w-4 h-4 text-base-content/40 shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm truncate">{{ convo.title }}</span>
                    <span class="badge badge-outline badge-xs shrink-0">{{ convo.agent }}</span>
                  </div>
                  <div class="flex items-center gap-2 text-xs text-base-content/50">
                    <span v-if="convo.project" class="truncate">{{ convo.project }}</span>
                    <span class="shrink-0">{{ relativeDate(convo.date) }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Recent sub-agents (cross-conversation) -->
            <template v-if="filteredRecentSubagents.length > 0">
              <div class="px-3 py-1 text-xs font-semibold uppercase text-base-content/50 mt-1">
                Recent sub-agents
              </div>
              <div
                v-for="(result, idx) in filteredRecentSubagents"
                :key="'rec-sub-' + (result.type === 'recent-subagent' ? result.item.toolCallId : idx)"
                class="flex items-center gap-3 px-3 py-2 cursor-pointer"
                :class="flatIndex('recent-subagent', idx) === highlightedIndex ? 'bg-base-200' : 'hover:bg-base-200/50'"
                @mouseenter="highlightedIndex = flatIndex('recent-subagent', idx)"
                @click="selectAt(flatIndex('recent-subagent', idx))"
              >
                <Bot class="w-4 h-4 text-base-content/40 shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm truncate">{{ result.type === 'recent-subagent' ? result.item.description : '' }}</div>
                  <div class="text-xs text-base-content/50">
                    {{ result.type === 'recent-subagent' ? (result.item.status ?? '--') : '' }} · {{ result.type === 'recent-subagent' ? relativeDate(result.item.timestamp) : '' }}
                  </div>
                </div>
              </div>
            </template>

            <!-- Empty state -->
            <div
              v-if="filteredPages.length === 0 && filteredConversations.length === 0 && filteredCurrentSubagents.length === 0 && filteredRecentSubagents.length === 0"
              class="px-3 py-6 text-center text-sm text-base-content/40"
            >
              No results found
            </div>
          </div>

          <!-- Footer hint -->
          <div class="flex items-center gap-3 px-3 py-2 border-t border-base-300 text-xs text-base-content/40">
            <span><kbd class="kbd kbd-xs">↑↓</kbd> Navigate</span>
            <span><kbd class="kbd kbd-xs">↵</kbd> Open</span>
            <span><kbd class="kbd kbd-xs">esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, type Component } from 'vue';
import {
  Search,
  LayoutDashboard,
  MessageSquare,
  Bot,
  BarChart3,
  ClipboardList,
  Settings,
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { useCommandPalette } from '../composables/useCommandPalette';

const router = useRouter();
const {
  isOpen,
  query,
  loading,
  filteredPages,
  filteredConversations,
  filteredCurrentSubagents,
  filteredRecentSubagents,
  highlightedIndex,
  close,
  navigateUp,
  navigateDown,
  select: paletteSelect,
  relativeDate,
} = useCommandPalette(router);

const inputRef = ref<HTMLInputElement | null>(null);

// Auto-focus input when palette opens
watch(isOpen, async (val) => {
  if (val) {
    await nextTick();
    inputRef.value?.focus();
  }
});

const iconMap: Record<string, Component> = {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BarChart3,
  ClipboardList,
  Settings,
};

function pageIcon(name: string): Component {
  return iconMap[name] || Search;
}

/** Compute flat index for a result given its type and local index.
 *  Order matches allResults in useCommandPalette: current-subagent → page → conversation → recent-subagent. */
function flatIndex(
  type: 'current-subagent' | 'page' | 'conversation' | 'recent-subagent',
  localIdx: number,
): number {
  const cs = filteredCurrentSubagents.value.length;
  const p = filteredPages.value.length;
  const c = filteredConversations.value.length;
  if (type === 'current-subagent') return localIdx;
  if (type === 'page') return cs + localIdx;
  if (type === 'conversation') return cs + p + localIdx;
  return cs + p + c + localIdx; // recent-subagent
}

function select() {
  paletteSelect();
}

function selectAt(idx: number) {
  highlightedIndex.value = idx;
  paletteSelect();
}
</script>

<style scoped>
.palette-fade-enter-active,
.palette-fade-leave-active {
  transition: opacity 0.15s ease;
}
.palette-fade-enter-from,
.palette-fade-leave-to {
  opacity: 0;
}
</style>
