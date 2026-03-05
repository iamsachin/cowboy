<template>
  <div class="bg-base-200 border border-base-300 rounded-lg">
    <!-- Clickable summary header -->
    <div
      class="cursor-pointer select-none py-2 px-4"
      @click="$emit('toggle')"
    >
      <div class="flex items-center gap-2 text-xs">
        <ChevronDown
          class="w-4 h-4 shrink-0 transition-transform"
          :class="{ 'rotate-180': expanded }"
        />
        <span
          v-if="group.model"
          class="badge badge-sm badge-ghost"
        >{{ group.model }}</span>
        <span class="text-base-content/50">
          {{ group.toolCallCount }} tool call{{ group.toolCallCount === 1 ? '' : 's' }}
        </span>
        <span class="text-base-content/50">
          {{ group.messageCount }} message{{ group.messageCount === 1 ? '' : 's' }}
        </span>
        <span
          v-if="duration"
          class="text-base-content/50"
        >{{ duration }}</span>
        <span class="text-base-content/40 ml-auto">{{ formatTime(group.firstTimestamp) }}</span>
      </div>

      <!-- Preview: first turn's snippet -->
      <div class="text-xs text-base-content/50 truncate pl-6">
        {{ previewSnippet }}
      </div>
    </div>

    <!-- Expanded: show all individual turns -->
    <div v-if="expanded" class="px-4 pb-4 pt-2 space-y-3">
      <div
        v-for="turn in group.turns"
        :key="turn.message.id"
        class="border-l-2 border-base-300 pl-3"
      >
        <!-- Thinking section -->
        <details v-if="turn.message.thinking" class="mb-2">
          <summary class="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <Brain class="w-4 h-4 text-info shrink-0" />
            <span>Thinking</span>
          </summary>
          <pre class="text-xs whitespace-pre-wrap break-words mt-1 pl-6 text-base-content/70">{{ turn.message.thinking }}</pre>
        </details>

        <!-- Turn text content -->
        <div v-if="getTurnContent(turn).length > 0">
          <template v-for="(block, idx) in getTurnContent(turn)" :key="idx">
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

        <!-- Tool calls for this turn -->
        <div v-if="turn.toolCalls.length > 0" class="mt-1 space-y-1">
          <ToolCallRowComponent
            v-for="tc in turn.toolCalls"
            :key="tc.id"
            :toolCall="tc"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Brain, ChevronDown } from 'lucide-vue-next';
import type { AssistantGroup, AssistantTurn } from '../composables/useGroupedTurns';
import { parseContent, formatTime } from '../utils/content-parser';
import { stripXmlTags } from '../utils/content-sanitizer';
import { getPreviewSnippet, formatMs } from '../utils/turn-helpers';
import CodeBlock from './CodeBlock.vue';
import ToolCallRowComponent from './ToolCallRow.vue';

const props = defineProps<{
  group: AssistantGroup;
  expanded: boolean;
}>();

defineEmits<{
  toggle: [];
}>();

const previewSnippet = computed(() => {
  // Use first turn with content for preview
  for (const turn of props.group.turns) {
    const snippet = getPreviewSnippet(turn);
    if (snippet) return snippet;
  }
  return `Used ${props.group.toolCallCount} tool calls`;
});

const duration = computed(() => {
  const start = new Date(props.group.firstTimestamp).getTime();
  const end = new Date(props.group.lastTimestamp).getTime();
  const ms = end - start;
  if (ms <= 0) return null;
  return formatMs(ms);
});

function getTurnContent(turn: AssistantTurn) {
  if (turn.message.content == null) return [];
  const cleaned = stripXmlTags(turn.message.content);
  if (!cleaned) return [];
  return parseContent(turn.message.content);
}
</script>
