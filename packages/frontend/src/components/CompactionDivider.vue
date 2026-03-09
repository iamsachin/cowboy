<template>
  <div>
    <!-- Clickable divider bar -->
    <div
      class="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors select-none"
      :class="severityClasses"
      @click="expanded = !expanded"
    >
      <Scissors class="w-4 h-4 shrink-0" />
      <span class="text-xs font-medium">Context compacted</span>
      <span v-if="hasDelta" class="text-xs opacity-80">
        {{ formatTokenCount(turn.tokensBefore!) }} &rarr; {{ formatTokenCount(turn.tokensAfter!) }}
        ({{ freedDisplay }} freed)
      </span>
      <div class="flex-1" />
      <ChevronDown
        class="w-4 h-4 shrink-0 transition-transform duration-200"
        :class="{ 'rotate-180': expanded }"
      />
    </div>

    <!-- Expanded summary -->
    <div
      v-if="expanded && turn.summary"
      class="bg-amber-500/5 rounded-b-lg p-4 max-h-[300px] overflow-y-auto"
    >
      <div class="thinking-content text-sm text-base-content/70" v-html="renderedSummary"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Scissors, ChevronDown } from 'lucide-vue-next';
import type { CompactionTurn } from '../composables/useGroupedTurns';
import { formatTokenCount } from '../utils/format-tokens';
import { renderMarkdown } from '../utils/render-markdown';

const props = defineProps<{
  turn: CompactionTurn;
}>();

const expanded = ref(false);

const hasDelta = computed(() =>
  props.turn.tokensBefore != null && props.turn.tokensAfter != null
);

const freedPercentage = computed(() => {
  if (!hasDelta.value) return null;
  const before = props.turn.tokensBefore!;
  if (before === 0) return 0;
  return ((before - props.turn.tokensAfter!) / before) * 100;
});

const freedDisplay = computed(() => {
  if (!hasDelta.value) return '';
  const freed = props.turn.tokensBefore! - props.turn.tokensAfter!;
  return formatTokenCount(freed);
});

const severityClasses = computed(() => {
  const pct = freedPercentage.value;
  if (pct == null) {
    // Default to amber when no token data
    return 'bg-amber-500/10 text-amber-400';
  }
  if (pct > 70) return 'bg-red-500/10 text-red-400';
  if (pct >= 30) return 'bg-amber-500/10 text-amber-400';
  return 'bg-green-500/10 text-green-400';
});

const renderedSummary = computed(() => {
  if (!props.turn.summary) return '';
  return renderMarkdown(props.turn.summary);
});
</script>

<style>
@import '../styles/markdown-content.css';
</style>
