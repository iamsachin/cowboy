<template>
  <div class="space-y-3">
    <!-- Sticky toolbar -->
    <div
      v-if="totalAssistantTurns > 0"
      class="sticky top-0 z-10 bg-base-200/95 backdrop-blur-sm border-b border-base-300 px-4 py-2 flex items-center justify-between rounded-t-lg mb-2"
    >
      <span class="text-xs text-base-content/60">
        {{ expandedCount > 0 ? `${expandedCount} of ${totalAssistantTurns} expanded` : `${totalAssistantTurns} turns` }}
      </span>
      <div class="tooltip tooltip-left" :data-tip="allExpanded ? 'Collapse All' : 'Expand All'">
        <button class="btn btn-ghost btn-xs" @click="toggleAll">
          <ChevronsUp v-if="allExpanded" class="w-4 h-4" />
          <ChevronsDown v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Turn list -->
    <template v-for="(turn, idx) in turns" :key="turn.message.id">
      <ChatMessage
        v-if="turn.type === 'user'"
        :message="turn.message"
      />
      <TurnCard
        v-else
        :turn="turn"
        :expanded="isExpanded(turn.message.id)"
        :nextTurn="turns[idx + 1]"
        @toggle="toggle(turn.message.id)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ChevronsDown, ChevronsUp } from 'lucide-vue-next';
import type { MessageRow, ToolCallRow } from '@cowboy/shared';
import { groupTurns } from '../composables/useGroupedTurns';
import { useCollapseState } from '../composables/useCollapseState';
import ChatMessage from './ChatMessage.vue';
import TurnCard from './TurnCard.vue';

const props = defineProps<{
  messages: MessageRow[];
  toolCalls: ToolCallRow[];
}>();

const turns = computed(() => groupTurns(props.messages, props.toolCalls));

const { isExpanded, toggle, expandAll, collapseAll, expandedCount } = useCollapseState();

const assistantTurnIds = computed(() =>
  turns.value.filter(t => t.type === 'assistant').map(t => t.message.id)
);
const totalAssistantTurns = computed(() => assistantTurnIds.value.length);
const allExpanded = computed(() =>
  expandedCount.value === totalAssistantTurns.value && totalAssistantTurns.value > 0
);

function toggleAll() {
  if (allExpanded.value) {
    collapseAll();
  } else {
    expandAll(assistantTurnIds.value);
  }
}
</script>
