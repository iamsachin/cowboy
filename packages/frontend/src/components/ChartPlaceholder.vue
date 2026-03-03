<template>
  <div class="card bg-base-200 rounded-box">
    <div class="card-body p-4">
      <h3 class="card-title text-sm font-semibold">{{ title }}</h3>
      <div
        class="flex items-center justify-center border-2 border-dashed border-base-300 rounded-lg"
        :style="{ height }"
      >
        <div class="text-center text-base-content/40">
          <BarChart3 class="w-8 h-8 mx-auto mb-2" />
          <p class="text-sm">Chart coming in Phase 3</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BarChart3 } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    title: string;
    height?: string;
  }>(),
  {
    height: '16rem',
  }
);
</script>
