<template>
  <div class="h-full overflow-y-auto border-l border-base-300 bg-base-100 px-3 py-4">
    <div class="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-3 px-1">
      Timeline
    </div>
    <div class="relative">
      <!-- Vertical line connector -->
      <div class="absolute left-[7px] top-2 bottom-2 w-px bg-base-300"></div>
      <!-- Event items -->
      <div
        v-for="(event, idx) in events"
        :key="event.key"
        :data-timeline-key="event.key"
        class="relative flex items-start gap-2 py-1.5 px-1 rounded cursor-pointer hover:bg-base-200 transition-colors"
        :class="{ 'bg-base-200/70': event.key === activeKey }"
        @click="$emit('navigate', event.key, event.turnIndex)"
      >
        <!-- Dot -->
        <div class="relative z-10 mt-1 w-[15px] shrink-0 flex justify-center">
          <span
            class="block w-2 h-2 rounded-full"
            :class="[
              dotColor(event),
              isActive && idx === events.length - 1 ? 'pulse-dot' : '',
            ]"
          />
        </div>
        <!-- Label -->
        <span
          class="text-xs truncate leading-5"
          :class="labelClass(event)"
        >
          {{ event.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TimelineEvent } from '../composables/useTimeline';

defineProps<{
  events: TimelineEvent[];
  activeKey: string | null;
  isActive: boolean;
}>();

defineEmits<{
  navigate: [key: string, turnIndex: number];
}>();

function dotColor(event: TimelineEvent): string {
  switch (event.type) {
    case 'user':
      return 'bg-primary';
    case 'assistant-group':
      return 'bg-secondary';
    case 'compaction':
      return 'bg-warning';
  }
}

function labelClass(event: TimelineEvent): string {
  switch (event.type) {
    case 'user':
      return 'text-base-content/80 font-medium';
    case 'assistant-group':
      return 'text-base-content/60';
    case 'compaction':
      return 'text-warning/70 italic';
  }
}
</script>

<style scoped>
.pulse-dot {
  background-color: oklch(0.75 0.18 142);
  animation: pulse-fade 1.5s ease-in-out infinite;
}

@keyframes pulse-fade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.row-highlight {
  animation: row-enter 2s ease-out;
}

@keyframes row-enter {
  0% { background-color: oklch(0.85 0.1 142 / 0.3); }
  100% { background-color: transparent; }
}
</style>
