<template>
  <div class="bg-base-200 border border-base-300 rounded-lg">
    <!-- Clickable summary header (always visible) -->
    <div
      class="cursor-pointer select-none py-2 px-4"
      @click="$emit('toggle')"
    >
      <!-- Line 1: metadata row -->
      <div class="flex items-center gap-2 text-xs">
        <ChevronDown
          class="w-4 h-4 shrink-0 transition-transform"
          :class="{ 'rotate-180': expanded }"
        />
        <span
          v-if="turn.message.model"
          class="badge badge-sm"
          :class="modelBadge.cssClass"
        >{{ modelBadge.label }}</span>
        <span
          v-if="turn.toolCalls.length > 0"
          class="text-base-content/50"
        >{{ turn.toolCalls.length }} tool call{{ turn.toolCalls.length === 1 ? '' : 's' }}</span>
        <span
          v-if="duration"
          class="text-base-content/50"
        >{{ duration }}</span>
        <span class="text-base-content/40 ml-auto">{{ formatTime(turn.message.createdAt) }}</span>
      </div>

      <!-- Line 2: preview snippet -->
      <div class="text-xs text-base-content/50 truncate pl-6">
        {{ previewSnippet }}
      </div>
    </div>

    <!-- Expanded content -->
    <div v-if="expanded" class="px-4 pb-4 pt-2">
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Brain, ChevronDown } from 'lucide-vue-next';
import type { AssistantTurn, Turn } from '../composables/useGroupedTurns';
import { parseContent, formatTime } from '../utils/content-parser';
import { stripXmlTags } from '../utils/content-sanitizer';
import { getPreviewSnippet, calculateDuration } from '../utils/turn-helpers';
import { getModelBadge } from '../utils/model-labels';
import CodeBlock from './CodeBlock.vue';
import ToolCallRowComponent from './ToolCallRow.vue';

const props = defineProps<{
  turn: AssistantTurn;
  expanded: boolean;
  nextTurn?: Turn;
}>();

defineEmits<{
  toggle: [];
}>();

const modelBadge = computed(() => getModelBadge(props.turn.message.model));

const parsedContent = computed(() => {
  if (props.turn.message.content == null) return [];
  const cleaned = stripXmlTags(props.turn.message.content);
  if (!cleaned) return [];
  return parseContent(props.turn.message.content);
});

const previewSnippet = computed(() => getPreviewSnippet(props.turn));

const duration = computed(() => calculateDuration(props.turn, props.nextTurn));
</script>
