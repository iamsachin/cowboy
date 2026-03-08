<template>
  <div class="p-4 max-w-5xl mx-auto">
    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center items-center min-h-[60vh]">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Not found state -->
    <div v-else-if="notFound" class="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <div role="alert" class="alert alert-warning max-w-md">
        <AlertTriangle class="w-5 h-5" />
        <span>Conversation not found</span>
      </div>
      <router-link to="/conversations" class="btn btn-ghost btn-sm gap-1">
        <ArrowLeft class="w-4 h-4" />
        Back to conversations
      </router-link>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <div role="alert" class="alert alert-error max-w-md">
        <span>{{ error }}</span>
      </div>
      <router-link to="/conversations" class="btn btn-ghost btn-sm gap-1">
        <ArrowLeft class="w-4 h-4" />
        Back to conversations
      </router-link>
    </div>

    <!-- Success state -->
    <template v-else-if="data">
      <!-- Back link -->
      <router-link to="/conversations" class="btn btn-ghost btn-sm gap-1 mb-4">
        <ArrowLeft class="w-4 h-4" />
        Back to conversations
      </router-link>

      <!-- Metadata header bar -->
      <div class="bg-base-200 rounded-lg p-4 mb-6">
        <h1 class="text-xl font-bold mb-3">
          {{ displayTitle }}
        </h1>
        <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <!-- Agent badge -->
          <div class="flex items-center gap-1">
            <span class="text-base-content/60">Agent:</span>
            <span class="badge badge-outline badge-sm">{{ data.conversation.agent }}</span>
          </div>

          <!-- Model -->
          <div class="flex items-center gap-1">
            <span class="text-base-content/60">Model:</span>
            <span>{{ data.conversation.model || '--' }}</span>
          </div>

          <!-- Project -->
          <div class="flex items-center gap-1">
            <span class="text-base-content/60">Project:</span>
            <span>{{ data.conversation.project || '--' }}</span>
          </div>

          <!-- Date -->
          <div class="flex items-center gap-1">
            <span class="text-base-content/60">Date:</span>
            <span>{{ formatDate(data.conversation.createdAt) }}</span>
          </div>

          <!-- Duration -->
          <div class="flex items-center gap-1">
            <span class="text-base-content/60">Duration:</span>
            <span>{{ messageDuration }}</span>
          </div>

          <!-- Total tokens -->
          <div class="flex items-center gap-1">
            <span class="text-base-content/60">Tokens:</span>
            <span>{{ formatNumber(totalTokens) }}</span>
            <span
              v-if="data.tokenSummary.cacheReadTokens > 0"
              class="text-base-content/50 text-xs"
            >({{ formatNumber(data.tokenSummary.cacheReadTokens) }} cached)</span>
          </div>

          <!-- Cost -->
          <div class="flex items-center gap-1">
            <span class="text-base-content/60">Cost:</span>
            <span>{{ data.tokenSummary.cost != null ? formatCost(data.tokenSummary.cost) : 'N/A' }}</span>
            <span
              v-if="data.tokenSummary.savings != null && data.tokenSummary.savings > 0"
              class="text-success text-xs"
            >
              (saved {{ formatCost(data.tokenSummary.savings) }})
            </span>
          </div>
        </div>
      </div>

      <!-- Inline plans section (collapsible) -->
      <div v-if="conversationPlans.length > 0" class="collapse collapse-arrow bg-base-200 rounded-lg mb-6">
        <input type="checkbox" checked />
        <div class="collapse-title text-sm font-semibold flex items-center gap-2">
          <ClipboardList class="w-4 h-4" />
          Extracted Plans ({{ conversationPlans.length }})
        </div>
        <div class="collapse-content">
          <div v-for="plan in conversationPlans" :key="plan.plan.id" class="mb-4">
            <h4 class="font-medium text-sm mb-2">{{ plan.plan.title }}</h4>
            <PlanStepList :steps="plan.steps" compact />
          </div>
        </div>
      </div>

      <!-- Conversation timeline -->
      <ConversationDetail
        :messages="data.messages"
        :toolCalls="data.toolCalls"
        :tokenUsageByMessage="data.tokenUsageByMessage"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, AlertTriangle, ClipboardList } from 'lucide-vue-next';
import type { PlanDetailResponse } from '@cowboy/shared';
import { useConversationDetail } from '../composables/useConversationDetail';
import ConversationDetail from '../components/ConversationDetail.vue';
import PlanStepList from '../components/PlanStepList.vue';
import { cleanTitle } from '../utils/content-sanitizer';
import { formatCost } from '../utils/format-tokens';

const route = useRoute();
const id = route.params.id as string;

const { data, loading, error, notFound } = useConversationDetail(id);

// Fetch inline plans for this conversation
const conversationPlans = ref<PlanDetailResponse[]>([]);

async function fetchConversationPlans(): Promise<void> {
  try {
    const res = await fetch(`/api/plans/by-conversation/${encodeURIComponent(id)}`);
    if (res.ok) {
      conversationPlans.value = await res.json();
    }
  } catch {
    // Silently ignore -- plans are supplementary
  }
}

fetchConversationPlans();

const totalTokens = computed(() => {
  if (!data.value) return 0;
  const s = data.value.tokenSummary;
  return s.inputTokens + s.outputTokens;
});

const messageDuration = computed(() => {
  if (!data.value) return '--';
  const c = data.value.conversation;
  const first = c.firstMessageAt || c.createdAt;
  const last = c.lastMessageAt || c.updatedAt;
  if (first === last) return '--';
  return formatDuration(first, last);
});

const displayTitle = computed(() => cleanTitle(data.value?.conversation.title || ''));

// Set document title
watchEffect(() => {
  document.title = `${displayTitle.value} - Cowboy`;
});

const numberFormatter = new Intl.NumberFormat();

function formatNumber(n: number): string {
  return numberFormatter.format(n);
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

function formatDuration(start: string, end: string): string {
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 0) return '--';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  } catch {
    return '--';
  }
}
</script>
