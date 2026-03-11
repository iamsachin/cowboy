<template>
  <div ref="turnListRef" class="space-y-3">
    <!-- Sticky toolbar -->
    <div
      v-if="totalGroups > 0"
      class="sticky top-0 z-10 bg-base-200/95 backdrop-blur-sm border-b border-base-300 px-4 py-2 flex items-center justify-between rounded-t-lg mb-2"
    >
      <span class="text-xs text-base-content/60">
        {{ expandedCount > 0 ? `${expandedCount} of ${totalGroups} expanded` : `${totalGroups} assistant groups` }}
      </span>
      <div class="tooltip tooltip-left" :data-tip="allExpanded ? 'Collapse All' : 'Expand All'">
        <button class="btn btn-ghost btn-xs" @click="toggleAll">
          <ChevronsUp v-if="allExpanded" class="w-4 h-4" />
          <ChevronsDown v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Search bar (Cmd+F) - sticky below toolbar -->
    <div class="sticky top-[40px] z-10">
      <ConversationSearchBar
        :query="searchState.query.value"
        :current-match="searchState.currentMatchDisplay.value"
        :total-matches="searchState.totalMatches.value"
        :visible="searchState.isOpen.value"
        @update:query="searchState.query.value = $event"
        @next="searchState.goNext()"
        @prev="searchState.goPrev()"
        @close="searchState.close()"
      />
    </div>

    <!-- Turn list -->
    <template v-for="turn in visibleTurns" :key="turnKey(turn)">
      <div :data-turn-key="turnKey(turn)" :class="{ 'group-fade-in': newGroupKeys.has(turnKey(turn)) }">
        <ChatMessage
          v-if="turn.type === 'user'"
          :message="turn.message"
        />
        <div
          v-else-if="turn.type === 'assistant-group'"
          :data-group-id="turnKey(turn)"
          :class="{ 'ring-2 ring-primary rounded-lg': turnKey(turn) === focusedGroupId }"
        >
          <AssistantGroupCard
            :group="turn"
            :expanded="isExpanded(turnKey(turn))"
            :tokenUsageByMessage="tokenUsageByMessage"
            @toggle="toggle(turnKey(turn))"
          />
        </div>
        <SystemMessageIndicator
          v-else-if="turn.type === 'system-group'"
          :group="turn"
        />
        <SlashCommandChip
          v-else-if="turn.type === 'slash-command'"
          :turn="turn"
        />
        <AgentPromptChip
          v-else-if="turn.type === 'agent-prompt'"
          :turn="turn"
        />
        <ClearDivider
          v-else-if="turn.type === 'clear-divider'"
          :turn="turn"
          :isFirst="visibleTurns[0] === turn"
        />
        <CompactionDivider
          v-else-if="turn.type === 'compaction'"
          :turn="turn"
        />
      </div>
    </template>

    <!-- Load more button for large conversations -->
    <button
      v-if="hasMore"
      class="btn btn-ghost btn-sm w-full mt-2"
      @click="loadMore"
    >
      Load more ({{ remainingCount }} remaining)
    </button>

    <!-- New messages pill -->
    <NewMessagesPill
      :count="newMessageCount"
      @scrollToBottom="handleScrollToBottom"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted, toRef } from 'vue';
import { ChevronsDown, ChevronsUp } from 'lucide-vue-next';
import type { MessageRow, ToolCallRow, MessageTokenUsage, CompactionEvent } from '../types';
import { groupTurns, type GroupedTurn } from '../composables/useGroupedTurns';
import { useCollapseState } from '../composables/useCollapseState';
import { useConversationSearch } from '../composables/useConversationSearch';
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts';
import { useScrollTracker } from '../composables/useScrollTracker';
import ChatMessage from './ChatMessage.vue';
import AssistantGroupCard from './AssistantGroupCard.vue';
import SystemMessageIndicator from './SystemMessageIndicator.vue';
import SlashCommandChip from './SlashCommandChip.vue';
import ClearDivider from './ClearDivider.vue';
import CompactionDivider from './CompactionDivider.vue';
import AgentPromptChip from './AgentPromptChip.vue';
import ConversationSearchBar from './ConversationSearchBar.vue';
import NewMessagesPill from './NewMessagesPill.vue';

const props = defineProps<{
  messages: MessageRow[];
  toolCalls: ToolCallRow[];
  tokenUsageByMessage?: Record<string, MessageTokenUsage>;
  compactionEvents?: CompactionEvent[];
  conversationId: string;
  newGroupKeys: Set<string>;
  scrollContainerRef: HTMLElement | null;
}>();

// Sort all messages — groupTurns handles all classification internally
const sortedMessages = computed(() =>
  [...props.messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
);

// Filter tool calls to only those belonging to the message set
const activeToolCalls = computed(() => {
  const messageIds = new Set(props.messages.map(m => m.id));
  return props.toolCalls.filter(tc => messageIds.has(tc.messageId));
});

const turns = computed(() => groupTurns(sortedMessages.value, activeToolCalls.value, props.compactionEvents));

// Scroll tracking
const scrollContainerRefLocal = toRef(props, 'scrollContainerRef');
const { isAtBottom, scrollToBottom, captureScrollPosition } = useScrollTracker(scrollContainerRefLocal);

// Pagination: show first PAGE_SIZE groups, then load more on demand
const PAGE_SIZE = 50;
const visibleCount = ref(PAGE_SIZE);

const visibleTurns = computed(() => turns.value.slice(0, visibleCount.value));
const hasMore = computed(() => visibleCount.value < turns.value.length);
const remainingCount = computed(() => turns.value.length - visibleCount.value);

function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, turns.value.length);
}

// Reset pagination only on conversation change, NOT on live updates
watch(() => props.conversationId, () => {
  visibleCount.value = PAGE_SIZE;
});

// Auto-expand visible count when at bottom and new messages arrive
watch(() => props.messages.length, () => {
  if (isAtBottom.value) {
    visibleCount.value = turns.value.length;
  }
});

// Scroll position management: auto-scroll if at bottom after DOM update
watch(() => props.messages.length, async (newLen, oldLen) => {
  if (newLen === oldLen) return;
  const restore = captureScrollPosition();
  await nextTick();
  if (restore) restore();
});

// New messages pill: only show when NOT at bottom
const newMessageCount = computed(() => {
  if (isAtBottom.value) return 0;
  return props.newGroupKeys.size;
});

function handleScrollToBottom() {
  scrollToBottom(true);
}

function turnKey(turn: GroupedTurn): string {
  if (turn.type === 'user') return turn.message.id;
  if (turn.type === 'assistant-group') return turn.turns[0].message.id;
  if (turn.type === 'system-group') return turn.messages[0].id;
  if (turn.type === 'slash-command') return turn.message.id;
  if (turn.type === 'agent-prompt') return turn.message.id;
  if (turn.type === 'compaction') return turn.id;
  // clear-divider
  return turn.message.id;
}

const collapseState = useCollapseState();
const { isExpanded, toggle, expandAll, collapseAll, expandedCount } = collapseState;

const groupIds = computed(() =>
  visibleTurns.value.filter(t => t.type === 'assistant-group').map(t => turnKey(t))
);
const totalGroups = computed(() => groupIds.value.length);
const allExpanded = computed(() =>
  expandedCount.value === totalGroups.value && totalGroups.value > 0
);

function toggleAll() {
  if (allExpanded.value) {
    collapseAll();
  } else {
    expandAll(groupIds.value);
  }
}

// --- In-conversation search (Cmd+F) ---
const turnListRef = ref<HTMLElement | null>(null);
const searchState = useConversationSearch(turnListRef, collapseState, groupIds);

// --- Keyboard navigation (J/K/E) ---
const focusedGroupIndex = ref(-1);

const focusedGroupId = computed(() => {
  const ids = groupIds.value;
  const idx = focusedGroupIndex.value;
  if (idx >= 0 && idx < ids.length) return ids[idx];
  return null;
});

function scrollFocusedIntoView() {
  nextTick(() => {
    if (!turnListRef.value || !focusedGroupId.value) return;
    const el = turnListRef.value.querySelector(
      `[data-group-id="${focusedGroupId.value}"]`
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

const { register, unregister } = useKeyboardShortcuts();

register({
  key: 'f',
  meta: true,
  handler: () => {
    searchState.open();
  },
  description: 'Search in conversation',
  label: 'Cmd+F',
  group: 'Navigation',
});

register({
  key: 'j',
  handler: () => {
    if (groupIds.value.length === 0) return;
    focusedGroupIndex.value = Math.min(
      focusedGroupIndex.value + 1,
      groupIds.value.length - 1
    );
    scrollFocusedIntoView();
  },
  description: 'Next assistant group',
  label: 'J',
  group: 'Navigation',
});

register({
  key: 'k',
  handler: () => {
    if (groupIds.value.length === 0) return;
    focusedGroupIndex.value = Math.max(
      focusedGroupIndex.value - 1,
      0
    );
    scrollFocusedIntoView();
  },
  description: 'Previous assistant group',
  label: 'K',
  group: 'Navigation',
});

register({
  key: 'e',
  handler: () => {
    if (focusedGroupIndex.value >= 0 && focusedGroupId.value) {
      toggle(focusedGroupId.value);
    }
  },
  description: 'Expand/collapse focused group',
  label: 'E',
  group: 'Navigation',
});

// Auto-expand when there's only one assistant group
watch(groupIds, (ids) => {
  if (ids.length === 1 && !isExpanded(ids[0])) {
    toggle(ids[0]);
  }
}, { immediate: true });

// Reset focus when conversation changes
watch(() => props.conversationId, () => {
  focusedGroupIndex.value = -1;
});

onUnmounted(() => {
  unregister('f', true);
  unregister('j');
  unregister('k');
  unregister('e');
  searchState.close();
});

defineExpose({
  loadUpTo(index: number) {
    if (index >= visibleCount.value) {
      visibleCount.value = index + 1;
    }
  },
  expandGroup(key: string) {
    if (!collapseState.isExpanded(key)) {
      collapseState.toggle(key);
    }
  },
  turns,
});
</script>

<style scoped>
@keyframes group-fade-in-anim {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.group-fade-in {
  animation: group-fade-in-anim 0.2s ease-out;
}
</style>
