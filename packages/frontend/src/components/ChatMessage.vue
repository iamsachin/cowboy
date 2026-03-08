<template>
  <!-- Image-only message: compact attachment badge, no header/bubble -->
  <div v-if="isImageOnly" class="flex justify-end ml-auto max-w-[85%] -mt-2">
    <div class="flex items-center gap-1 text-xs text-base-content/50 px-3 py-0.5">
      <ImageIcon class="w-3.5 h-3.5" />
      <span>{{ imageCount }} image{{ imageCount > 1 ? 's' : '' }} attached</span>
    </div>
  </div>

  <!-- Normal message with content -->
  <div v-else class="flex flex-col items-end ml-auto max-w-[85%]">
    <div class="text-xs text-base-content/50 mb-1">
      You
      <time class="ml-1">{{ formatTime(message.createdAt) }}</time>
    </div>
    <div class="bg-primary/20 text-base-content border border-primary/40 rounded-lg px-3 py-2 text-sm whitespace-normal break-words">
      <template v-if="commandText">
        <p class="whitespace-pre-wrap font-mono">{{ commandText }}</p>
      </template>
      <template v-else-if="message.content != null">
        <template v-for="(block, idx) in parsedContent" :key="idx">
          <p v-if="block.type === 'text'" class="whitespace-pre-wrap">{{ block.content }}</p>
          <CodeBlock
            v-else
            :code="block.content"
            :language="block.language"
          />
        </template>
        <div v-if="imageCount > 0" class="flex items-center gap-1 text-xs text-base-content/60" :class="{ 'mt-1': parsedContent.length > 0 }">
          <ImageIcon class="w-3.5 h-3.5" />
          <span>{{ imageCount }} image{{ imageCount > 1 ? 's' : '' }} attached</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ImageIcon } from 'lucide-vue-next';
import type { MessageRow } from '@cowboy/shared';
import CodeBlock from './CodeBlock.vue';
import { parseContent, formatTime } from '../utils/content-parser';
import { isSlashCommand, extractCommandText } from '../utils/content-sanitizer';

const IMAGE_RE = /\[Image: source: [^\]]+\]/g;

const props = defineProps<{
  message: MessageRow;
}>();

const commandText = computed(() => {
  if (!props.message.content || !isSlashCommand(props.message.content)) return null;
  return extractCommandText(props.message.content);
});

const imageCount = computed(() => {
  if (!props.message.content) return 0;
  return (props.message.content.match(IMAGE_RE) || []).length;
});

const parsedContent = computed(() => {
  if (props.message.content == null) return [];
  // Strip image references from content before parsing
  const cleaned = props.message.content.replace(IMAGE_RE, '').trim();
  if (!cleaned) return [];
  return parseContent(cleaned);
});

const isImageOnly = computed(() => {
  return imageCount.value > 0 && parsedContent.value.length === 0 && !commandText.value;
});
</script>
