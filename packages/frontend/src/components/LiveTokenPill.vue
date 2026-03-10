<template>
  <div v-if="!dismissed" class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
    <!-- Popover Chart Card -->
    <Transition name="popover-fade">
      <div
        v-if="expanded"
        class="card bg-base-200 rounded-box shadow-xl w-96"
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

    <!-- Pill Button -->
    <button
      class="btn btn-sm gap-2 shadow-lg group"
      :class="[
        isIdle ? 'opacity-50' : '',
        isSpike ? 'animate-token-pulse' : '',
      ]"
      @click.stop="expanded = !expanded"
    >
      <span class="text-xs">&#8593; {{ formatTokenCount(currentInput) }}/min</span>
      <span class="text-xs">&#8595; {{ formatTokenCount(currentOutput) }}/min</span>
      <X
        class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        @click.stop="dismiss()"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { X } from 'lucide-vue-next';
import LiveTokenChart from './LiveTokenChart.vue';
import { useTokenRate } from '../composables/useTokenRate';
import { formatTokenCount } from '../utils/format-tokens';

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
