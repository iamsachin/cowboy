<template>
  <div class="bg-base-200 rounded-lg p-4">
    <div class="flex items-center gap-2 mb-3">
      <component :is="icon" class="w-5 h-5 text-primary" />
      <h3 class="text-sm font-semibold">{{ title }}</h3>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <!-- Claude Code -->
      <div class="space-y-1">
        <div class="text-xs text-base-content/60">Claude Code</div>
        <div class="text-lg font-bold" style="color: rgba(56, 189, 248, 1)">
          {{ claudeValue }}
        </div>
        <div v-if="claudeTrend !== undefined && claudeTrend !== null" class="text-xs">
          <span :class="trendClass(claudeTrend)">
            {{ trendText(claudeTrend) }}
          </span>
        </div>
      </div>
      <!-- Cursor -->
      <div class="space-y-1">
        <div class="text-xs text-base-content/60">Cursor</div>
        <div class="text-lg font-bold" style="color: rgba(168, 85, 247, 1)">
          {{ cursorValue }}
        </div>
        <div v-if="cursorTrend !== undefined && cursorTrend !== null" class="text-xs">
          <span :class="trendClass(cursorTrend)">
            {{ trendText(cursorTrend) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  title: string;
  claudeValue: string;
  cursorValue: string;
  claudeTrend?: number | null;
  cursorTrend?: number | null;
  icon: Component;
}>();

function trendText(trend: number): string {
  const sign = trend > 0 ? '+' : '';
  return `${sign}${Math.round(trend)}%`;
}

function trendClass(trend: number): string {
  if (trend > 0) return 'text-success';
  if (trend < 0) return 'text-error';
  return 'opacity-60';
}
</script>
