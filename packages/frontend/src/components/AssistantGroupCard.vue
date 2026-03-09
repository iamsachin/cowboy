<template>
  <div class="bg-base-200 border border-base-300 rounded-lg">
    <!-- Clickable summary header -->
    <div
      class="cursor-pointer select-none py-2 px-4"
      @click="$emit('toggle')"
    >
      <div class="flex items-center gap-2 text-xs">
        <ChevronRight
          class="w-4 h-4 shrink-0 transition-transform"
          :class="{ 'rotate-90': expanded }"
        />
        <span
          v-if="group.model"
          class="badge badge-sm"
          :class="modelBadge.cssClass"
        >{{ modelBadge.label }}</span>
        <span v-if="group.toolCallCount > 0" class="text-base-content/50">
          {{ group.toolCallCount }} tool call{{ group.toolCallCount === 1 ? '' : 's' }}
        </span>
        <span class="text-base-content/50">
          {{ group.messageCount }} message{{ group.messageCount === 1 ? '' : 's' }}
        </span>
        <span
          v-if="duration"
          class="text-base-content/50"
        >{{ duration }}</span>
        <span v-if="groupTokens" class="text-base-content/50">
          {{ formatTokenCount(groupTokens.inputTokens) }} in / {{ formatTokenCount(groupTokens.outputTokens) }} out
        </span>
        <span v-if="groupTokens?.cost != null" class="text-success/70">
          {{ formatCost(groupTokens.cost) }}
        </span>
        <span class="text-base-content/40 ml-auto">{{ formatTime(group.firstTimestamp) }}</span>
      </div>

      <!-- Preview: first turn's snippet -->
      <div class="text-xs text-base-content/50 truncate pl-6">
        {{ previewSnippet }}
      </div>
    </div>

    <!-- Expanded: show all individual turns -->
    <div v-if="expanded" class="max-h-[80vh] overflow-y-auto px-4 pb-4 pt-2 space-y-3">
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
          <div class="thinking-content text-xs mt-1 pl-6 text-base-content/70" v-html="renderMarkdown(turn.message.thinking!)"></div>
        </details>

        <!-- Turn text content -->
        <div v-if="getTurnContent(turn).length > 0">
          <template v-for="(block, idx) in getTurnContent(turn)" :key="idx">
            <div
              v-if="block.type === 'text'"
              class="thinking-content text-sm text-base-content/70"
              v-html="renderMarkdown(block.content)"
            ></div>
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

        <!-- Per-turn token info -->
        <div v-if="getTurnTokens(turn)" class="text-xs text-base-content/40 mt-1">
          {{ formatTokenCount(getTurnTokens(turn)!.inputTokens) }} in / {{ formatTokenCount(getTurnTokens(turn)!.outputTokens) }} out
          <span v-if="getTurnTokens(turn)!.cost != null"> &middot; {{ formatCost(getTurnTokens(turn)!.cost!) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Brain, ChevronRight } from 'lucide-vue-next';
import type { MessageTokenUsage } from '@cowboy/shared';
import type { AssistantGroup, AssistantTurn } from '../composables/useGroupedTurns';
import { parseContent, formatTime } from '../utils/content-parser';
import { stripXmlTags } from '../utils/content-sanitizer';
import { getPreviewSnippet, formatMs } from '../utils/turn-helpers';
import { formatTokenCount, formatCost } from '../utils/format-tokens';
import { getModelBadge } from '../utils/model-labels';
import { renderMarkdown } from '../utils/render-markdown';
import CodeBlock from './CodeBlock.vue';
import ToolCallRowComponent from './ToolCallRow.vue';

const props = defineProps<{
  group: AssistantGroup;
  expanded: boolean;
  tokenUsageByMessage?: Record<string, MessageTokenUsage>;
}>();

defineEmits<{
  toggle: [];
}>();

const modelBadge = computed(() => getModelBadge(props.group.model));

const previewSnippet = computed(() => {
  // Use first turn with content for preview
  for (const turn of props.group.turns) {
    const snippet = getPreviewSnippet(turn);
    if (snippet) return snippet;
  }
  return props.group.toolCallCount > 0
    ? `Used ${props.group.toolCallCount} tool call${props.group.toolCallCount === 1 ? '' : 's'}`
    : 'Assistant response';
});

const duration = computed(() => {
  const start = new Date(props.group.firstTimestamp).getTime();
  const end = new Date(props.group.lastTimestamp).getTime();
  const ms = end - start;
  if (ms <= 0) return null;
  return formatMs(ms);
});

function getTurnTokens(turn: AssistantTurn): MessageTokenUsage | null {
  return props.tokenUsageByMessage?.[turn.message.id] ?? null;
}

const groupTokens = computed(() => {
  if (!props.tokenUsageByMessage) return null;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let cost: number | null = null;
  let found = false;

  for (const turn of props.group.turns) {
    const usage = props.tokenUsageByMessage[turn.message.id];
    if (usage) {
      found = true;
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
      cacheReadTokens += usage.cacheReadTokens;
      cacheCreationTokens += usage.cacheCreationTokens;
      if (usage.cost != null) {
        cost = (cost ?? 0) + usage.cost;
      }
    }
  }

  return found ? { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, cost } : null;
});

function getTurnContent(turn: AssistantTurn) {
  if (turn.message.content == null) return [];
  const cleaned = stripXmlTags(turn.message.content);
  if (!cleaned) return [];
  return parseContent(cleaned);
}
</script>

<style>
@import '../styles/markdown-content.css';
</style>
