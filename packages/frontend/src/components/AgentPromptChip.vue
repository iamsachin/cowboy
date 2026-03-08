<template>
  <div class="flex flex-col items-start my-1 w-full">
    <div
      class="cursor-pointer select-none flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/30 text-emerald-400/60 text-xs hover:bg-emerald-900/50 transition-colors"
      @click="expanded = !expanded"
    >
      <ChevronRight
        class="w-3 h-3 shrink-0 transition-transform"
        :class="{ 'rotate-90': expanded }"
      />
      <BotIcon class="w-3 h-3 shrink-0" />
      <span>{{ summaryLabel }}</span>
    </div>

    <Transition name="fade">
      <div
        v-if="expanded"
        class="mt-2 w-full max-w-xl bg-emerald-950/30 border border-emerald-800/30 rounded-lg overflow-hidden"
      >
        <div class="px-3 py-2">
          <div class="max-h-60 overflow-y-auto text-xs text-base-content/60 whitespace-pre-wrap break-words">
            {{ turn.message.content }}
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronRight, BotIcon } from 'lucide-vue-next';
import type { AgentPromptTurn } from '../composables/useGroupedTurns';

const props = defineProps<{
  turn: AgentPromptTurn;
}>();

const expanded = ref(false);

const summaryLabel = computed(() => {
  if (props.turn.description) {
    return `Agent prompt: ${props.turn.description}`;
  }
  // Derive a short label from the first line of content
  const firstLine = (props.turn.message.content || '').split('\n')[0].slice(0, 60);
  return `Agent prompt: ${firstLine}${firstLine.length >= 60 ? '...' : ''}`;
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
