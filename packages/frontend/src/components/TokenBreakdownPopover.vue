<template>
  <span
    ref="triggerRef"
    @mouseenter="showPopover"
    @mouseleave="startHideTimer"
  >
    <slot />
  </span>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="popoverRef"
      class="fixed bg-base-300 border border-base-content/10 rounded-lg shadow-xl p-3 text-xs z-50 min-w-[220px]"
      :style="popoverStyle"
      @mouseenter="cancelHideTimer"
      @mouseleave="startHideTimer"
    >
      <div class="space-y-1">
        <div class="flex justify-between gap-4">
          <span class="text-base-content/50">Input tokens</span>
          <span>{{ formatTokenCount(inputTokens) }} <span class="text-base-content/40">({{ pct(inputTokens) }})</span></span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-base-content/50">Cache read</span>
          <span>{{ formatTokenCount(cacheReadTokens) }} <span class="text-base-content/40">({{ pct(cacheReadTokens) }})</span></span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-base-content/50">Cache write</span>
          <span>{{ formatTokenCount(cacheCreationTokens) }} <span class="text-base-content/40">({{ pct(cacheCreationTokens) }})</span></span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-base-content/50">Output tokens</span>
          <span>{{ formatTokenCount(outputTokens) }} <span class="text-base-content/40">({{ pct(outputTokens) }})</span></span>
        </div>
        <div class="border-t border-base-content/10 my-1"></div>
        <div class="flex justify-between gap-4 font-medium">
          <span>Total</span>
          <span>{{ formatTokenCount(total) }}</span>
        </div>
        <div v-if="contextTokens > 0" class="flex justify-between gap-4 text-base-content/50">
          <span>Context window</span>
          <span>{{ formatTokenCount(contextTokens) }}</span>
        </div>
        <div v-if="cost != null" class="flex justify-between gap-4 text-success mt-1">
          <span>Cost</span>
          <span>{{ formatCost(cost) }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';
import { formatTokenCount, formatCost } from '../utils/format-tokens';

const props = defineProps<{
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number | null;
  contextTokens: number;
}>();

const triggerRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);
const visible = ref(false);
const popoverStyle = ref<Record<string, string>>({});
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const total = computed(() =>
  props.inputTokens + props.outputTokens + props.cacheReadTokens + props.cacheCreationTokens
);

function pct(value: number): string {
  if (total.value === 0) return '0%';
  return ((value / total.value) * 100).toFixed(1) + '%';
}

function showPopover(): void {
  cancelHideTimer();
  visible.value = true;
  requestAnimationFrame(() => positionPopover());
}

function startHideTimer(): void {
  hideTimer = setTimeout(() => {
    visible.value = false;
  }, 100);
}

function cancelHideTimer(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function positionPopover(): void {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 240));

  if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
    popoverStyle.value = {
      top: `${rect.bottom + 4}px`,
      left: `${left}px`,
    };
  } else {
    popoverStyle.value = {
      bottom: `${window.innerHeight - rect.top + 4}px`,
      left: `${left}px`,
    };
  }
}

onBeforeUnmount(() => {
  cancelHideTimer();
});
</script>
