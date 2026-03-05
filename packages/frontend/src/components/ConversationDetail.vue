<template>
  <div class="space-y-3">
    <template v-for="turn in turns" :key="turn.message.id">
      <ChatMessage
        v-if="turn.type === 'user'"
        :message="turn.message"
      />
      <TurnCard
        v-else
        :turn="turn"
        :expanded="true"
        @toggle="() => {}"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MessageRow, ToolCallRow } from '@cowboy/shared';
import { groupTurns } from '../composables/useGroupedTurns';
import ChatMessage from './ChatMessage.vue';
import TurnCard from './TurnCard.vue';

const props = defineProps<{
  messages: MessageRow[];
  toolCalls: ToolCallRow[];
}>();

const turns = computed(() => groupTurns(props.messages, props.toolCalls));
</script>
