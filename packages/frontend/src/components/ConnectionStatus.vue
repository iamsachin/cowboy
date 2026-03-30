<template>
  <div class="flex items-center gap-2 py-2" :class="collapsed ? 'justify-center' : 'px-3'">
    <span
      class="w-2 h-2 rounded-full shrink-0"
      :class="dotClass"
    />
    <span
      v-if="!collapsed"
      class="text-xs"
      :class="labelClass"
    >
      {{ labelText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';

defineProps<{
  collapsed: boolean;
}>();

const { state, reconnectAttempt } = useWebSocket();

const dotClass = computed(() => {
  switch (state.value) {
    case 'connected':
      return 'bg-success';
    case 'reconnecting':
      return 'bg-warning animate-pulse';
    case 'disconnected':
      return 'bg-error';
  }
});

const labelText = computed(() => {
  switch (state.value) {
    case 'connected':
      return 'Live';
    case 'reconnecting':
      return 'Reconnecting...';
    case 'disconnected':
      return 'Offline';
  }
});

const labelClass = computed(() => {
  switch (state.value) {
    case 'connected':
      return 'text-success';
    case 'reconnecting':
      return 'text-warning';
    case 'disconnected':
      return 'text-error';
  }
});

</script>
