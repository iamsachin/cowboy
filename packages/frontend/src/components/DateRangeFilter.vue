<template>
  <div class="flex items-center gap-2 flex-wrap">
    <!-- Preset buttons -->
    <div class="join">
      <button
        v-for="p in presets"
        :key="p.value"
        class="join-item btn btn-sm"
        :class="!isCustom && preset === p.value ? 'btn-primary' : 'btn-ghost'"
        @click="setPreset(p.value)"
      >
        {{ p.label }}
      </button>
    </div>

    <!-- Custom date picker -->
    <div class="relative">
      <VueDatePicker
        v-model="pickerRange"
        range
        :enable-time-picker="false"
        :dark="isDark"
        auto-apply
        placeholder="Custom range"
        input-class-name="input input-bordered input-sm w-48 text-xs"
        @update:model-value="onPickerChange"
      />
    </div>

    <!-- Clear custom range indicator -->
    <div v-if="isCustom" class="flex items-center gap-1">
      <span class="badge badge-sm badge-primary">
        {{ customFrom }} - {{ customTo }}
      </span>
      <button
        class="btn btn-ghost btn-xs btn-circle"
        @click="setPreset('30d')"
        title="Clear custom range"
      >
        <X class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { VueDatePicker } from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';
import { X } from 'lucide-vue-next';
import { useDateRange } from '../composables/useDateRange';
import type { Preset } from '../composables/useDateRange';

const { preset, customFrom, customTo, isCustom, setPreset, setCustomRange } = useDateRange();

const isDark = computed(() => {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme !== 'light' && theme !== 'cupcake' && theme !== 'garden';
});

const presets: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All time' },
];

const pickerRange = ref<Date[] | null>(null);

// Sync picker from custom range state
watch(
  [customFrom, customTo],
  ([from, to]) => {
    if (from && to) {
      pickerRange.value = [new Date(from + 'T00:00:00'), new Date(to + 'T00:00:00')];
    } else {
      pickerRange.value = null;
    }
  },
  { immediate: true }
);

function onPickerChange(dates: Date[] | null) {
  if (dates && dates.length === 2 && dates[0] && dates[1]) {
    const from = dates[0].toISOString().slice(0, 10);
    const to = dates[1].toISOString().slice(0, 10);
    setCustomRange(from, to);
  }
}
</script>
