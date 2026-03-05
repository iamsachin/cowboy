<template>
  <div class="space-y-3">
    <!-- Sticky toolbar -->
    <div
      v-if="totalGroups > 0"
      class="sticky top-0 z-10 bg-base-200/95 backdrop-blur-sm border-b border-base-300 px-4 py-2 flex items-center justify-between rounded-t-lg mb-2"
    >
      <span class="text-xs text-base-content/60">
        {{ expandedCount > 0 ? `${expandedCount} of ${totalGroups} expanded` : `${totalGroups} turns` }}
      </span>
      <div class="tooltip tooltip-left" :data-tip="allExpanded ? 'Collapse All' : 'Expand All'">
        <button class="btn btn-ghost btn-xs" @click="toggleAll">
          <ChevronsUp v-if="allExpanded" class="w-4 h-4" />
          <ChevronsDown v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Turn list -->
    <template v-for="turn in turns" :key="turnKey(turn)">
      <ChatMessage
        v-if="turn.type === 'user'"
        :message="turn.message"
      />
      <AssistantGroupCard
        v-else-if="turn.type === 'assistant-group'"
        :group="turn"
        :expanded="isExpanded(turnKey(turn))"
        @toggle="toggle(turnKey(turn))"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ChevronsDown, ChevronsUp } from 'lucide-vue-next';
import type { MessageRow, ToolCallRow } from '@cowboy/shared';
import { groupTurns, type GroupedTurn } from '../composables/useGroupedTurns';
import { useCollapseState } from '../composables/useCollapseState';
import { isSystemInjected, isClearCommand } from '../utils/content-sanitizer';
import ChatMessage from './ChatMessage.vue';
import AssistantGroupCard from './AssistantGroupCard.vue';

const props = defineProps<{
  messages: MessageRow[];
  toolCalls: ToolCallRow[];
}>();

// Filter to messages after the last /clear command (context reset boundary)
const activeMessages = computed(() => {
  const sorted = [...props.messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Find the last /clear message index
  let clearIdx = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].role === 'user' && isClearCommand(sorted[i].content)) {
      clearIdx = i;
      break;
    }
  }

  if (clearIdx === -1) return props.messages;

  // Include the /clear message itself (it's a user command worth showing)
  return sorted.slice(clearIdx);
});

// Remove system-injected user messages before grouping so they don't create
// false group boundaries between consecutive assistant turns
const filteredMessages = computed(() =>
  activeMessages.value.filter(m => m.role !== 'user' || !isSystemInjected(m.content))
);

// Filter tool calls to only those belonging to active messages
const activeToolCalls = computed(() => {
  const messageIds = new Set(activeMessages.value.map(m => m.id));
  return props.toolCalls.filter(tc => messageIds.has(tc.messageId));
});

const turns = computed(() => groupTurns(filteredMessages.value, activeToolCalls.value));

function turnKey(turn: GroupedTurn): string {
  if (turn.type === 'user') return turn.message.id;
  return turn.turns[0].message.id;
}

const { isExpanded, toggle, expandAll, collapseAll, expandedCount } = useCollapseState();

const groupIds = computed(() =>
  turns.value.filter(t => t.type === 'assistant-group').map(t => turnKey(t))
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
</script>
