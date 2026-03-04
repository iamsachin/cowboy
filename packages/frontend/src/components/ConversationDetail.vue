<template>
  <div class="space-y-2">
    <template v-for="item in timeline" :key="item.type + '-' + item.id">
      <ChatMessage
        v-if="item.type === 'message'"
        :message="(item.item as MessageRow)"
      />
      <ToolCallCard
        v-else
        :toolCall="(item.item as ToolCallRow)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MessageRow, ToolCallRow } from '@cowboy/shared';
import ChatMessage from './ChatMessage.vue';
import ToolCallCard from './ToolCallCard.vue';
import { stripXmlTags } from '../utils/content-sanitizer';

interface TimelineItem {
  type: 'message' | 'toolCall';
  item: MessageRow | ToolCallRow;
  id: string;
  createdAt: string;
}

const props = defineProps<{
  messages: MessageRow[];
  toolCalls: ToolCallRow[];
}>();

function isEmptyMessage(item: TimelineItem): boolean {
  if (item.type !== 'message') return false;
  const msg = item.item as MessageRow;
  return msg.content === null || stripXmlTags(msg.content).length === 0;
}

const timeline = computed<TimelineItem[]>(() => {
  const messageItems: TimelineItem[] = props.messages.map((m) => ({
    type: 'message' as const,
    item: m,
    id: m.id,
    createdAt: m.createdAt,
  }));

  const toolCallItems: TimelineItem[] = props.toolCalls.map((tc) => ({
    type: 'toolCall' as const,
    item: tc,
    id: tc.id,
    createdAt: tc.createdAt,
  }));

  return [...messageItems, ...toolCallItems]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .filter((item) => !isEmptyMessage(item));
});
</script>
