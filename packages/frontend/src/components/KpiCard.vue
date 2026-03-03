<template>
  <div class="stat bg-base-200 rounded-box">
    <div class="stat-figure text-primary">
      <component :is="icon" class="w-8 h-8" />
    </div>
    <div class="stat-title text-xs uppercase tracking-wide">{{ title }}</div>
    <div class="stat-value text-primary">{{ value }}</div>
    <div class="stat-desc">{{ description }}</div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  title: string;
  value: string;
  description: string;
  icon: Component;
}>();
</script>
