<template>
  <div class="p-4">
    <div class="flex items-center gap-2 mb-4">
      <button class="btn btn-ghost btn-sm" @click="router.back()">
        <ArrowLeft class="w-4 h-4" />
        Back
      </button>
    </div>
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-bold">Conversation</h1>
      <span class="badge badge-outline font-mono text-xs">{{ route.params.id }}</span>
    </div>
    <div class="mt-8 flex justify-center">
      <span class="loading loading-spinner loading-lg"></span>
      <span class="ml-3 text-base-content/60">Loading conversation...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
</script>
