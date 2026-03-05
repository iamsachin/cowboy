<template>
  <div class="flex flex-col items-end ml-auto max-w-[85%]">
    <div class="text-xs text-base-content/50 mb-1">
      You
      <time class="ml-1">{{ formatTime(turn.message.createdAt) }}</time>
    </div>
    <div class="flex items-center gap-1.5 badge badge-outline font-mono text-xs px-2 py-1 h-auto">
      <Terminal class="w-3 h-3 shrink-0 text-base-content/50" />
      <span>{{ turn.commandText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Terminal } from 'lucide-vue-next';
import type { SlashCommandTurn } from '../composables/useGroupedTurns';
import { formatTime } from '../utils/content-parser';

defineProps<{
  turn: SlashCommandTurn;
}>();
</script>
