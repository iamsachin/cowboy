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
        :tokenUsageByMessage="tokenUsageByMessage"
        @toggle="toggle(turnKey(turn))"
      />
      <SystemMessageIndicator
        v-else-if="turn.type === 'system-group'"
        :group="turn"
      />
      <SlashCommandChip
        v-else-if="turn.type === 'slash-command'"
        :turn="turn"
      />
      <ClearDivider
        v-else-if="turn.type === 'clear-divider'"
        :turn="turn"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ChevronsDown, ChevronsUp } from 'lucide-vue-next';
import type { MessageRow, ToolCallRow, MessageTokenUsage } from '@cowboy/shared';
import { groupTurns, type GroupedTurn } from '../composables/useGroupedTurns';
import { useCollapseState } from '../composables/useCollapseState';
import ChatMessage from './ChatMessage.vue';
import AssistantGroupCard from './AssistantGroupCard.vue';
import SystemMessageIndicator from './SystemMessageIndicator.vue';
import SlashCommandChip from './SlashCommandChip.vue';
import ClearDivider from './ClearDivider.vue';

const props = defineProps<{
  messages: MessageRow[];
  toolCalls: ToolCallRow[];
  tokenUsageByMessage?: Record<string, MessageTokenUsage>;
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

const turns = computed(() => groupTurns(sortedMessages.value, activeToolCalls.value));

function turnKey(turn: GroupedTurn): string {
  if (turn.type === 'user') return turn.message.id;
  if (turn.type === 'assistant-group') return turn.turns[0].message.id;
  if (turn.type === 'system-group') return turn.messages[0].id;
  if (turn.type === 'slash-command') return turn.message.id;
  // clear-divider
  return turn.message.id;
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
