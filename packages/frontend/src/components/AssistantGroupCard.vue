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
          v-if="modelBadge.label"
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
        <TokenBreakdownPopover
          v-if="groupTokens"
          :input-tokens="groupTokens.inputTokens"
          :output-tokens="groupTokens.outputTokens"
          :cache-read-tokens="groupTokens.cacheReadTokens"
          :cache-creation-tokens="groupTokens.cacheCreationTokens"
          :cost="groupTokens.cost"
          :context-tokens="groupTokens.contextTokens"
        >
          <span class="text-base-content/50">
            {{ formatTokenCount(groupTokens.contextTokens) }} ctx / {{ formatTokenCount(groupTokens.outputTokens) }} out
          </span>
        </TokenBreakdownPopover>
        <span v-if="groupTokens?.cost != null" class="text-success/70">
          {{ formatCost(groupTokens.cost) }}
        </span>
        <span class="text-base-content/40 ml-auto">{{ formatTime(group.firstTimestamp) }}</span>
      </div>

      <!-- File names row -->
      <div v-if="displayedFilenames" class="text-xs text-base-content/40 pl-6 truncate">
        {{ displayedFilenames }}
      </div>
    </div>

    <!-- Expanded: show process (thinking + tools) for each turn -->
    <div v-if="expanded" class="max-h-[80vh] overflow-y-auto px-4 pb-2 pt-1 space-y-3">
      <div
        v-for="turn in group.turns"
        :key="turn.message.id"
        class="pl-3"
      >
        <!-- Thinking section (animated toggle) -->
        <div v-if="turn.message.thinking" class="bg-purple-500/5 border-l-2 border-purple-400 rounded-r mb-2 pl-3 py-1">
          <BaseExpandableItem
            :expanded="expandedThinking.has(turn.message.id)"
            :icon="Brain"
            icon-class="text-purple-400"
            label="Thinking"
            @toggle="toggleThinking(turn.message.id)"
          >
            <div class="text-xs pl-2 pb-2 pr-3 text-base-content/70 thinking-content" v-html="renderMarkdown(turn.message.thinking!)"></div>
          </BaseExpandableItem>
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
          <div
            v-for="(tc, tcIdx) in turn.toolCalls"
            :key="tc.id"
            :data-tool-call-id="tc.id"
            style="scroll-margin-top: 3rem"
          >
            <ToolCallRowComponent
              :toolCall="tc"
              :autoExpand="tc.id === autoExpandToolCallId"
              :tokenInfo="tcIdx === turn.toolCalls.length - 1 ? formatTurnTokenInfo(turn) : undefined"
              :isActive="isActive"
              :parentModel="group.model"
            />
          </div>
        </div>

        <!-- Per-turn token info (only for turns without tool calls) -->
        <div v-if="getTurnTokens(turn) && turn.toolCalls.length === 0" class="text-xs text-base-content/40 mt-1">
          {{ formatTokenCount(getTurnTokens(turn)!.inputTokens + getTurnTokens(turn)!.cacheReadTokens) }} in / {{ formatTokenCount(getTurnTokens(turn)!.outputTokens) }} out
          <span v-if="getTurnTokens(turn)!.cost != null"> &middot; {{ formatCost(getTurnTokens(turn)!.cost!) }}</span>
        </div>
      </div>

      <!-- Skill definition system messages (attached to this group) -->
      <SystemMessageIndicator
        v-if="skillDefGroup"
        :group="skillDefGroup"
      />
    </div>

    <!-- Last text output: visible only when collapsed (when expanded, content is shown inline) -->
    <div v-if="!expanded && lastOutputHtml" class="px-4 pb-3 pl-10">
      <div class="thinking-content text-sm text-base-content/70" v-html="lastOutputHtml"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Brain, ChevronRight, Copy, Check } from 'lucide-vue-next';
import type { MessageTokenUsage } from '../types';
import type { AssistantGroup, AssistantTurn, SystemGroup, SystemMessageCategory } from '../composables/useGroupedTurns';
import { classifySystemMessage } from '../composables/useGroupedTurns';
import SystemMessageIndicator from './SystemMessageIndicator.vue';
import { parseContent, formatTime } from '../utils/content-parser';
import { stripXmlTags } from '../utils/content-sanitizer';
import { getLastTextContent, extractFilenames, formatMs } from '../utils/turn-helpers';
import { formatTokenCount, formatCost } from '../utils/format-tokens';
import { getModelBadge } from '../utils/model-labels';
import { renderMarkdown } from '../utils/render-markdown';
import CodeBlock from './CodeBlock.vue';
import ToolCallRowComponent from './ToolCallRow.vue';
import TokenBreakdownPopover from './TokenBreakdownPopover.vue';
import BaseExpandableItem from './BaseExpandableItem.vue';

const props = defineProps<{
  group: AssistantGroup;
  expanded: boolean;
  tokenUsageByMessage?: Record<string, MessageTokenUsage>;
  isActive: boolean;
}>();

defineEmits<{
  toggle: [];
}>();

const modelBadge = computed(() => getModelBadge(props.group.model));

const lastTextContent = computed(() => getLastTextContent(props.group));

/** Full rendered last text output -- always visible below header */
const lastOutputHtml = computed(() => {
  if (lastTextContent.value) {
    return renderMarkdown(lastTextContent.value);
  }
  return null;
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

function formatTurnTokenInfo(turn: AssistantTurn): string | undefined {
  const tokens = getTurnTokens(turn);
  if (!tokens) return undefined;
  let info = `${formatTokenCount(tokens.inputTokens + tokens.cacheReadTokens)} in / ${formatTokenCount(tokens.outputTokens)} out`;
  if (tokens.cost != null) {
    info += ` \u00b7 ${formatCost(tokens.cost)}`;
  }
  return info;
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

  // Context tokens = last turn's (inputTokens + cacheReadTokens) -- actual context window size
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

const autoExpandToolCallId = computed(() => {
  const turns = props.group.turns;
  if (turns.length === 0) return null;
  const lastTurn = turns[turns.length - 1];
  // Only auto-expand if last turn has no text content
  if (getTurnContent(lastTurn).length > 0) return null;
  if (lastTurn.toolCalls.length === 0) return null;
  return lastTurn.toolCalls[lastTurn.toolCalls.length - 1].id;
});

const skillDefGroup = computed((): SystemGroup | null => {
  const defs = props.group.skillDefinitions;
  if (!defs || defs.length === 0) return null;
  return {
    type: 'system-group',
    messages: defs,
    categories: defs.map(m => classifySystemMessage(m.content || '')),
    count: defs.length,
  };
});

function getTurnContent(turn: AssistantTurn) {
  if (turn.message.content == null) return [];
  const cleaned = stripXmlTags(turn.message.content);
  if (!cleaned) return [];
  return parseContent(cleaned);
}

// -- Copy button state (from Task 1) --
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

// -- Animated thinking blocks (Part B) --
const expandedThinking = reactive(new Set<string>());

function toggleThinking(messageId: string): void {
  if (expandedThinking.has(messageId)) {
    expandedThinking.delete(messageId);
  } else {
    expandedThinking.add(messageId);
  }
}
</script>

<style>
@import '../styles/markdown-content.css';

/* Animated thinking block expand/collapse */
.thinking-body {
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.2s ease;
}
.thinking-body--collapsed {
  max-height: 0;
  opacity: 0;
}
.thinking-body--expanded {
  max-height: 2000px;
  opacity: 1;
}
</style>
