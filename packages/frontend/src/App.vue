<template>
  <DashboardLayout>
    <RouterView />
  </DashboardLayout>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import DashboardLayout from './layouts/DashboardLayout.vue';
</script>
