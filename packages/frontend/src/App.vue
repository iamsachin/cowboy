<template>
  <DashboardLayout>
    <RouterView />
  </DashboardLayout>
  <ToastContainer />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import DashboardLayout from './layouts/DashboardLayout.vue';
import ToastContainer from './components/ToastContainer.vue';
</script>
