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
        <span v-if="groupTokens" class="text-base-content/50 tooltip tooltip-bottom" :data-tip="tokenTooltip">
          {{ formatTokenCount(groupTokens.contextTokens) }} ctx / {{ formatTokenCount(groupTokens.outputTokens) }} out
        </span>
        <span v-if="groupTokens?.cost != null" class="text-success/70">
          {{ formatCost(groupTokens.cost) }}
        </span>
        <span class="text-base-content/40 ml-auto">{{ formatTime(group.firstTimestamp) }}</span>
      </div>

      <!-- File names row -->
      <div v-if="displayedFilenames" class="text-xs text-base-content/40 pl-6 truncate">
        {{ displayedFilenames }}
      </div>

      <!-- Rendered markdown preview (text groups) -->
      <div v-if="previewHtml" class="preview-clamp pl-6">
        <div class="thinking-content text-xs text-base-content/60" v-html="previewHtml"></div>
      </div>

      <!-- Tool summary (tool-only groups) -->
      <div v-if="toolSummaryText" class="text-xs text-base-content/50 pl-6">
        {{ toolSummaryText }}
      </div>
    </div>

    <!-- Expanded: show all individual turns -->
    <div v-if="expanded" class="max-h-[80vh] overflow-y-auto px-4 pb-4 pt-2 space-y-3">
      <div
        v-for="turn in group.turns"
        :key="turn.message.id"
        class="pl-3"
      >
        <!-- Thinking section -->
        <div v-if="turn.message.thinking" class="bg-purple-500/5 border-l-2 border-purple-400 rounded-r mb-2">
          <details class="pl-3 py-1">
            <summary class="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
              <Brain class="w-4 h-4 text-purple-400 shrink-0" />
              <span>Thinking</span>
            </summary>
            <div class="thinking-content text-xs mt-1 pl-6 text-base-content/70" v-html="renderMarkdown(turn.message.thinking!)"></div>
          </details>
        </div>

        <!-- Turn text content -->
        <div v-if="getTurnContent(turn).length > 0">
          <template v-for="(block, idx) in getTurnContent(turn)" :key="idx">
            <div
              v-if="block.type === 'text'"
              class="relative group/copy"
            >
              <button
                class="btn btn-xs btn-ghost absolute top-1 right-1 opacity-0 group-hover/copy:opacity-100 transition-opacity z-10"
                @click.stop="copyContent(block.content, `${turn.message.id}-${idx}`)"
              >
                <Check v-if="copiedBlockKey === `${turn.message.id}-${idx}`" class="w-3 h-3 text-success" />
                <Copy v-else class="w-3 h-3" />
                <span class="ml-1">{{ copiedBlockKey === `${turn.message.id}-${idx}` ? 'Copied!' : 'Copy' }}</span>
              </button>
              <div
                class="thinking-content text-sm text-base-content/70"
                v-html="renderMarkdown(block.content)"
              ></div>
            </div>
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
          {{ formatTokenCount(getTurnTokens(turn)!.inputTokens + getTurnTokens(turn)!.cacheReadTokens) }} in / {{ formatTokenCount(getTurnTokens(turn)!.outputTokens) }} out
          <span v-if="getTurnTokens(turn)!.cost != null"> &middot; {{ formatCost(getTurnTokens(turn)!.cost!) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Brain, ChevronRight, Copy, Check } from 'lucide-vue-next';
import type { MessageTokenUsage } from '../types';
import type { AssistantGroup, AssistantTurn } from '../composables/useGroupedTurns';
import { parseContent, formatTime } from '../utils/content-parser';
import { stripXmlTags } from '../utils/content-sanitizer';
import { getLastTextContent, getToolSummary, extractFilenames, formatMs } from '../utils/turn-helpers';
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

const lastTextContent = computed(() => getLastTextContent(props.group));

const previewHtml = computed(() => {
  if (lastTextContent.value) {
    return renderMarkdown(lastTextContent.value);
  }
  return null;
});

const toolSummaryText = computed(() => {
  if (lastTextContent.value) return null; // only show for tool-only groups
  return getToolSummary(props.group);
});

const displayedFilenames = computed(() => {
  const files = extractFilenames(props.group);
  if (files.length === 0) return null;
  if (files.length <= 3) return files.join(', ');
  return files.slice(0, 3).join(', ') + ` +${files.length - 3} more`;
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

  // Context tokens = last turn's (inputTokens + cacheReadTokens) — actual context window size
  let contextTokens = 0;
  for (const turn of [...props.group.turns].reverse()) {
    const lastUsage = props.tokenUsageByMessage[turn.message.id];
    if (lastUsage) {
      contextTokens = lastUsage.inputTokens + lastUsage.cacheReadTokens;
      break;
    }
  }

  return found ? { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, cost, contextTokens } : null;
});

const tokenTooltip = computed(() => {
  if (!groupTokens.value) return '';
  const ctx = formatTokenCount(groupTokens.value.contextTokens);
  const cache = formatTokenCount(groupTokens.value.cacheReadTokens);
  const newInput = formatTokenCount(groupTokens.value.inputTokens);
  const output = formatTokenCount(groupTokens.value.outputTokens);
  return `Context: ${ctx} | Cache reads: ${cache} | New input: ${newInput} | Output: ${output}`;
});

function getTurnContent(turn: AssistantTurn) {
  if (turn.message.content == null) return [];
  const cleaned = stripXmlTags(turn.message.content);
  if (!cleaned) return [];
  return parseContent(cleaned);
}

const copiedBlockKey = ref<string | null>(null);

async function copyContent(content: string, blockKey: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
    copiedBlockKey.value = blockKey;
    setTimeout(() => {
      copiedBlockKey.value = null;
    }, 2000);
  } catch {
    // Clipboard API not available
  }
}
</script>

<style>
@import '../styles/markdown-content.css';

.preview-clamp {
  max-height: 3.6em;
  overflow: hidden;
  position: relative;
}
.preview-clamp::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1.2em;
  background: linear-gradient(to bottom, transparent, oklch(var(--b2)));
  pointer-events: none;
}
</style>
