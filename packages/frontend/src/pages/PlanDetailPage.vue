<template>
  <div class="px-4 pt-2 pb-4 max-w-4xl mx-auto">
    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center items-center min-h-[60vh]">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Not found state -->
    <div v-else-if="notFound" class="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <div role="alert" class="alert alert-warning max-w-md">
        <AlertTriangle class="w-5 h-5" />
        <span>Plan not found</span>
      </div>
      <router-link to="/plans" class="btn btn-ghost btn-sm gap-1">
        <ArrowLeft class="w-4 h-4" />
        Back to plans
      </router-link>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <div role="alert" class="alert alert-error max-w-md">
        <span>{{ error }}</span>
      </div>
      <router-link to="/plans" class="btn btn-ghost btn-sm gap-1">
        <ArrowLeft class="w-4 h-4" />
        Back to plans
      </router-link>
    </div>

    <!-- Detail view -->
    <template v-else-if="detail">
      <!-- Back link -->
      <router-link to="/plans" class="btn btn-ghost btn-sm gap-1 mb-4">
        <ArrowLeft class="w-4 h-4" />
        Back to plans
      </router-link>

      <!-- Header -->
      <div class="bg-base-200 rounded-lg p-4 mb-6">
        <h1 class="text-xl font-bold mb-3">{{ detail.plan.title }}</h1>
        <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div class="flex items-center gap-1">
            <span class="text-base-content/60">Status:</span>
            <span class="badge badge-sm" :class="statusBadgeClass(detail.plan.status)">
              {{ detail.plan.status }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-base-content/60">Agent:</span>
            <AgentBadge :agent="detail.plan.agent" />
          </div>
          <div v-if="detail.plan.project" class="flex items-center gap-1">
            <span class="text-base-content/60">Project:</span>
            <span>{{ detail.plan.project }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-base-content/60">Date:</span>
            <span>{{ formatDate(detail.plan.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Steps summary -->
      <div class="mb-4 text-sm text-base-content/70">
        {{ detail.plan.completedSteps }} of {{ detail.plan.totalSteps }} steps complete
      </div>

      <!-- Step list -->
      <PlanStepList :steps="detail.steps" />

      <!-- View in conversation link -->
      <div class="mt-6">
        <router-link
          :to="{ name: 'conversation-detail', params: { id: detail.plan.conversationId } }"
          class="btn btn-outline btn-sm gap-2"
        >
          <ExternalLink class="w-4 h-4" />
          View in conversation
        </router-link>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, AlertTriangle, ExternalLink } from 'lucide-vue-next';
import type { PlanDetailResponse } from '../types';
import { API_BASE } from '../utils/api-base';
import AgentBadge from '../components/AgentBadge.vue';
import PlanStepList from '../components/PlanStepList.vue';

const route = useRoute();
const id = route.params.id as string;

const detail = ref<PlanDetailResponse | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const notFound = ref(false);

async function fetchDetail(): Promise<void> {
  loading.value = true;
  error.value = null;
  notFound.value = false;
  try {
    const res = await fetch(`${API_BASE}/api/plans/${encodeURIComponent(id)}`);
    if (res.status === 404) {
      notFound.value = true;
      return;
    }
    if (!res.ok) throw new Error(`Failed to fetch plan: ${res.status}`);
    detail.value = await res.json();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
}

fetchDetail();

// Set document title
watchEffect(() => {
  if (detail.value?.plan.title) {
    document.title = `${detail.value.plan.title} - Cowboy`;
  } else {
    document.title = 'Plan Detail - Cowboy';
  }
});

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'complete':
      return 'badge-success';
    case 'partial':
      return 'badge-warning';
    case 'not-started':
    case 'unknown':
    default:
      return 'badge-ghost';
  }
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
</script>
