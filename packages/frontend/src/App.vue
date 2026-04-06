<template>
  <!-- Tray panel: skip splash and dashboard layout -->
  <template v-if="isTrayPanel">
    <div class="bg-base-100 h-screen overflow-hidden">
      <RouterView />
    </div>
  </template>

  <!-- Splash screen while backend is starting -->
  <div v-else-if="!backendReady" class="flex items-center justify-center h-screen bg-base-100 text-base-content">
    <div class="text-center">
      <img src="/cowboy-icon.png" alt="Cowboy" class="w-24 h-24 mx-auto mb-6 rounded-2xl" />
      <p v-if="!startupError" class="text-base text-base-content/60 animate-pulse">{{ loadingQuip }}</p>
      <p v-else class="text-lg text-error">Backend failed to start</p>
    </div>
  </div>

  <!-- Main app once backend is ready -->
  <template v-else>
    <DashboardLayout>
      <RouterView :key="$route.fullPath" />
    </DashboardLayout>
    <ToastContainer />
  </template>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import DashboardLayout from './layouts/DashboardLayout.vue';
import ToastContainer from './components/ToastContainer.vue';
import { API_BASE } from './utils/api-base';

const route = useRoute();
const isTrayPanel = computed(() => route.path === '/tray-panel');

const loadingQuips = [
  'Saddling up the AI agents...',
  'Wrangling tokens from the digital frontier...',
  'Teaching robots to line dance...',
  'Herding LLMs into the corral...',
  'Tipping hat to the token gods...',
  'Riding shotgun with your copilot...',
  'Lassoing context windows...',
  'Rolling tumbleweeds through the codebase...',
  'Brewing cowboy coffee for the bots...',
  'Dusting off the neural spurs...',
];

const loadingQuip = loadingQuips[Math.floor(Math.random() * loadingQuips.length)];
const backendReady = ref(false);
const startupError = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

function checkHealth() {
  fetch(`${API_BASE}/api/health`)
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
