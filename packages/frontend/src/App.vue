<template>
  <!-- Splash screen while backend is starting -->
  <div v-if="!backendReady" class="flex items-center justify-center h-screen bg-base-100 text-base-content">
    <div class="text-center">
      <div class="text-6xl mb-4">🤠</div>
      <p v-if="!startupError" class="text-lg animate-pulse">Starting...</p>
      <p v-else class="text-lg text-error">Backend failed to start</p>
    </div>
  </div>

  <!-- Main app once backend is ready -->
  <template v-else>
    <DashboardLayout>
      <RouterView />
    </DashboardLayout>
    <ToastContainer />
  </template>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { RouterView } from 'vue-router';
import DashboardLayout from './layouts/DashboardLayout.vue';
import ToastContainer from './components/ToastContainer.vue';

const backendReady = ref(false);
const startupError = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

function checkHealth() {
  fetch('/api/health')
    .then((res) => {
      if (res.ok) return res.json();
      throw new Error('not ready');
    })
    .then((data) => {
      if (data && data.status === 'ok') {
        backendReady.value = true;
        cleanup();
      }
    })
    .catch(() => {
      // Backend not ready yet, keep polling
    });
}

function cleanup() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }
}

onMounted(() => {
  // Poll /api/health every 500ms
  checkHealth();
  pollTimer = setInterval(checkHealth, 500);

  // Timeout after 30 seconds
  timeoutTimer = setTimeout(() => {
    if (!backendReady.value) {
      startupError.value = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  }, 30_000);
});

onUnmounted(() => {
  cleanup();
});
</script>
