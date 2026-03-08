<template>
  <div class="toast toast-end z-50">
    <TransitionGroup name="toast-fade">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="alert shadow-lg"
        :class="alertClass(toast.type)"
      >
        <span>{{ toast.message }}</span>
        <button class="btn btn-ghost btn-xs" @click="removeToast(toast.id)">
          <X class="w-3 h-3" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast';
import { X } from 'lucide-vue-next';

const { toasts, removeToast } = useToast();

function alertClass(type: 'success' | 'error' | 'info'): string {
  switch (type) {
    case 'success':
      return 'alert-success';
    case 'error':
      return 'alert-error';
    case 'info':
      return 'alert-info';
  }
}
</script>

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
