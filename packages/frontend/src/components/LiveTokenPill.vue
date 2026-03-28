<template>
  <div v-if="!dismissed" class="relative">
    <!-- Popover Chart Card — opens above the pill -->
    <Transition name="popover-fade">
      <div
        v-if="expanded"
        class="absolute bottom-full mb-2 z-50 card bg-base-200 rounded-box shadow-xl"
        :class="collapsed ? 'left-0 w-72' : 'left-0 right-0 w-auto'"
        @click.stop
      >
        <div class="card-body p-4">
          <h3 class="card-title text-sm">Token Rate (60 min)</h3>
          <div class="h-48">
            <LiveTokenChart :data="filledTokenRate" />
          </div>
        </div>
      </div>
    </Transition>

    <!-- Inline Pill -->
    <button
      class="w-full flex items-center gap-2 py-2 group"
      :class="[
        collapsed ? 'justify-center px-1' : 'px-3',
        isIdle ? 'opacity-50' : '',
        isSpike ? 'animate-token-pulse' : '',
      ]"
      @click.stop="expanded = !expanded"
    >
      <template v-if="collapsed">
        <div
          class="tooltip tooltip-right"
          :data-tip="`↑ ${formatTokenCount(currentInput)}/min  ↓ ${formatTokenCount(currentOutput)}/min`"
        >
          <Activity class="w-4 h-4 shrink-0 text-base-content/60" />
        </div>
      </template>
      <template v-else>
        <Activity class="w-4 h-4 shrink-0 text-base-content/60" />
        <span class="text-xs text-base-content/60">&#8593; {{ formatTokenCount(currentInput) }}/min</span>
        <span class="text-xs text-base-content/60">&#8595; {{ formatTokenCount(currentOutput) }}/min</span>
        <X
          class="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-base-content/40"
          @click.stop="dismiss()"
        />
      </template>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { X, Activity } from 'lucide-vue-next';
import LiveTokenChart from './LiveTokenChart.vue';
import { useTokenRate } from '../composables/useTokenRate';
import { formatTokenCount } from '../utils/format-tokens';

defineProps<{
  collapsed: boolean;
}>();

const {
  currentInput,
  currentOutput,
  filledTokenRate,
  dismissed,
  dismiss,
} = useTokenRate();

const expanded = ref(false);

const isIdle = computed(() => currentInput.value === 0 && currentOutput.value === 0);

// Spike detection: current minute exceeds 2x the average of the previous 5 minutes
const isSpike = computed(() => {
  const filled = filledTokenRate.value;
  if (filled.length < 6) return false;

  const recent = filled.slice(-6, -1); // previous 5 minutes
  const avgCombined =
    recent.reduce((sum, p) => sum + p.inputTokens + p.outputTokens, 0) / 5;

  if (avgCombined === 0) return false;

  const currentCombined = currentInput.value + currentOutput.value;
  return currentCombined > avgCombined * 2;
});

// Click-outside handler
function onClickOutside(): void {
  if (expanded.value) {
    expanded.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside);
});
</script>

<style scoped>
.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes token-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); }
  50% { box-shadow: 0 0 8px 4px rgba(56, 189, 248, 0.2); }
}

.animate-token-pulse {
  animation: token-pulse 2s ease-in-out infinite;
}
</style>
