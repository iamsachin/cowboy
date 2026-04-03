<template>
  <div class="px-3 py-2">
    <div class="relative">
      <!-- Vertical line connector -->
      <div class="timeline-connector absolute left-[7px] top-2 bottom-2 w-px bg-base-300"></div>
      <!-- Event items -->
      <div
        v-for="(event, idx) in events"
        :key="event.key"
        :data-timeline-key="event.key"
        class="relative flex items-start gap-2 py-1.5 px-1 rounded cursor-pointer hover:bg-base-200 transition-colors"
        :class="{ 'bg-primary/10 border-l-2 border-l-primary': event.key === activeKey }"
        @click="$emit('navigate', event.key, event.turnIndex)"
      >
        <!-- Icon -->
        <div class="relative z-10 mt-0.5 w-[15px] shrink-0 flex justify-center">
          <component
            :is="iconConfig(event).icon"
            :size="14"
            :class="[
              iconConfig(event).colorClass,
              isActive && idx === events.length - 1 ? 'pulse-icon' : '',
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
import { User, Bot, Minimize2 } from 'lucide-vue-next';
import type { TimelineEvent } from '../composables/useTimeline';

defineProps<{
  events: TimelineEvent[];
  activeKey: string | null;
  isActive: boolean;
}>();

defineEmits<{
  navigate: [key: string, turnIndex: number];
}>();

function iconConfig(event: TimelineEvent) {
  switch (event.type) {
    case 'user':
      return { icon: User, colorClass: 'text-primary' };
    case 'assistant-group':
      return { icon: Bot, colorClass: 'text-secondary' };
    case 'compaction':
      return { icon: Minimize2, colorClass: 'text-warning' };
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
.pulse-icon {
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
