<template>
  <div
    class="mx-2 mb-2 overflow-hidden"
    :class="isIdle ? 'opacity-50' : ''"
  >
    <template v-if="!collapsed">
      <!-- Chart -->
      <div class="h-44">
        <LiveTokenChart :data="filledTokenRate" />
      </div>
      <!-- Speed indicators -->
      <div class="flex items-center justify-center gap-3 px-3 py-1.5 text-xs text-base-content/60">
        <span>&#8593; {{ formatTokenCount(currentInput) }}/min</span>
        <span>&#8595; {{ formatTokenCount(currentOutput) }}/min</span>
      </div>
    </template>
    <template v-else>
      <!-- Collapsed: icon only -->
      <div class="flex justify-center py-2">
        <Activity class="w-4 h-4 text-base-content/60" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Activity } from 'lucide-vue-next';
import LiveTokenChart from './LiveTokenChart.vue';
import { useTokenRate } from '../composables/useTokenRate';
import { formatTokenCount } from '../utils/format-tokens';

const props = defineProps<{
  collapsed: boolean;
}>();

const {
  currentInput,
  currentOutput,
  filledTokenRate,
} = useTokenRate();

const isIdle = computed(() => currentInput.value === 0 && currentOutput.value === 0);
</script>
