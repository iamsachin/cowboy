import { ref } from 'vue';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Module-level singleton state
const toasts = ref<Toast[]>([]);
let nextId = 1;

function addToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = nextId++;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    removeToast(id);
  }, 3000);
}

function removeToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

function success(message: string) {
  addToast(message, 'success');
}

function error(message: string) {
  addToast(message, 'error');
}

export function useToast() {
  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
  };
}
