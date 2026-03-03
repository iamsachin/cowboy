<template>
  <div class="flex h-screen bg-base-300">
    <AppSidebar />
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppSidebar from '../components/AppSidebar.vue';
</script>
