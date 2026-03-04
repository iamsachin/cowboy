<template>
  <div class="bg-base-200 border border-base-300 rounded-lg p-4 max-w-[85%]">
    <!-- Header: role label + timestamp -->
    <div class="flex items-center gap-2 text-xs text-base-content/50 mb-2">
      <span>Assistant</span>
      <time>{{ formatTime(turn.message.createdAt) }}</time>
    </div>

    <!-- Thinking section (collapsed by default) -->
    <details
      v-if="turn.message.thinking"
      class="mb-2"
    >
      <summary class="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
        <Brain class="w-4 h-4 text-info shrink-0" />
        <span>Thinking</span>
      </summary>
      <pre class="text-xs whitespace-pre-wrap break-words mt-1 pl-6 text-base-content/70">{{ turn.message.thinking }}</pre>
    </details>

    <!-- Assistant text body -->
    <div v-if="parsedContent.length > 0">
      <template v-for="(block, idx) in parsedContent" :key="idx">
        <p
          v-if="block.type === 'text'"
          class="whitespace-pre-wrap text-sm text-base-content/70"
        >{{ block.content }}</p>
        <CodeBlock
          v-else
          :code="block.content"
          :language="block.language"
        />
      </template>
    </div>

    <!-- Tool call list -->
    <div v-if="turn.toolCalls.length > 0" class="mt-3 space-y-1">
      <ToolCallRowComponent
        v-for="tc in turn.toolCalls"
        :key="tc.id"
        :toolCall="tc"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Brain } from 'lucide-vue-next';
import type { AssistantTurn } from '../composables/useGroupedTurns';
import { parseContent, formatTime } from '../utils/content-parser';
import { stripXmlTags } from '../utils/content-sanitizer';
import CodeBlock from './CodeBlock.vue';
import ToolCallRowComponent from './ToolCallRow.vue';

const props = defineProps<{
  turn: AssistantTurn;
}>();

const parsedContent = computed(() => {
  if (props.turn.message.content == null) return [];
  const cleaned = stripXmlTags(props.turn.message.content);
  if (!cleaned) return [];
  return parseContent(props.turn.message.content);
});
</script>
