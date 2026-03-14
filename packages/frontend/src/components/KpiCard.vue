<template>
  <div class="stat bg-base-200 rounded-box">
    <div class="stat-title text-xs uppercase tracking-wide">{{ title }}</div>
    <div class="stat-value text-base-content">{{ value }}</div>
    <div v-if="trend !== undefined || description" class="stat-desc">
      <template v-if="trend !== undefined && trend !== null">
        <span :class="trendColorClass">
          <component :is="trendIcon" class="w-3 h-3 inline" />
          {{ trendText }}
        </span>
        <span v-if="trendLabel" class="ml-1 opacity-60">{{ trendLabel }}</span>
      </template>
      <template v-else>
        {{ description }}
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { TrendingUp, TrendingDown, Minus } from 'lucide-vue-next';

const props = defineProps<{
  title: string;
  value: string;
  description: string;
  icon: Component;
  trend?: number | null;
  trendLabel?: string;
}>();

const trendText = computed(() => {
  if (props.trend === null || props.trend === undefined) return '';
  const sign = props.trend > 0 ? '+' : '';
  return `${sign}${Math.round(props.trend)}%`;
});

const trendColorClass = computed(() => {
  if (props.trend === null || props.trend === undefined) return '';
  if (props.trend > 0) return 'text-success';
  if (props.trend < 0) return 'text-error';
  return 'opacity-60';
});

const trendIcon = computed<Component>(() => {
  if (props.trend !== null && props.trend !== undefined && props.trend > 0) return TrendingUp;
  if (props.trend !== null && props.trend !== undefined && props.trend < 0) return TrendingDown;
  return Minus;
});
</script>
