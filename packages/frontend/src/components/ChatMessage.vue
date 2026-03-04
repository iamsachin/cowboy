<template>
  <div class="chat chat-end ml-auto max-w-[85%]">
    <div class="chat-header text-xs text-base-content/50 mb-1">
      You
      <time class="ml-1">{{ formatTime(message.createdAt) }}</time>
    </div>
    <div class="chat-bubble chat-bubble-primary whitespace-normal break-words">
      <template v-if="message.content != null">
        <template v-for="(block, idx) in parsedContent" :key="idx">
          <p v-if="block.type === 'text'" class="whitespace-pre-wrap">{{ block.content }}</p>
          <CodeBlock
            v-else
            :code="block.content"
            :language="block.language"
          />
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MessageRow } from '@cowboy/shared';
import CodeBlock from './CodeBlock.vue';
import { parseContent, formatTime } from '../utils/content-parser';

const props = defineProps<{
  message: MessageRow;
}>();

const parsedContent = computed(() => {
  if (props.message.content == null) return [];
  return parseContent(props.message.content);
});
</script>
