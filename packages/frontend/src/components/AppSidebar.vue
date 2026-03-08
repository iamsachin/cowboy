<template>
  <aside
    class="bg-base-200 h-screen flex flex-col transition-all duration-200 shrink-0"
    :class="collapsed ? 'w-16' : 'w-60'"
  >
    <!-- Header -->
    <div class="p-3 flex items-center justify-between border-b border-base-300">
      <!-- Collapsed: hat icon as expand button -->
      <button
        v-if="collapsed"
        class="btn btn-ghost btn-sm btn-square mx-auto"
        @click="collapsed = false"
        aria-label="Expand sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="w-5 h-5 text-primary"
        >
          <path d="M2 14c0 0 1-3 3.5-4.5C5 7 4 4 4 4s3.5 1.5 5 4c.5-.2 1-.3 1.5-.35L12 3l1.5 4.65c.5.05 1 .15 1.5.35 1.5-2.5 5-4 5-4s-1 3-1.5 5.5C21 10.5 22 14 22 14H2z" />
          <path d="M4 15c0 2.5 3.5 5 8 5s8-2.5 8-5H4z" opacity="0.3" />
        </svg>
      </button>
      <!-- Expanded: hat + title + tagline -->
      <div v-if="!collapsed" class="flex flex-col">
        <span class="flex items-center gap-1.5 text-lg font-bold text-primary tracking-tight">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="w-5 h-5 shrink-0"
          >
            <path d="M2 14c0 0 1-3 3.5-4.5C5 7 4 4 4 4s3.5 1.5 5 4c.5-.2 1-.3 1.5-.35L12 3l1.5 4.65c.5.05 1 .15 1.5.35 1.5-2.5 5-4 5-4s-1 3-1.5 5.5C21 10.5 22 14 22 14H2z" />
            <path d="M4 15c0 2.5 3.5 5 8 5s8-2.5 8-5H4z" opacity="0.3" />
          </svg>
          Cowboy
        </span>
        <span class="text-xs text-base-content/50 font-normal italic">Taming wild agents daily</span>
      </div>
      <button
        v-if="!collapsed"
        class="btn btn-ghost btn-sm btn-square"
        @click="collapsed = true"
        aria-label="Collapse sidebar"
      >
        <ChevronLeft class="w-4 h-4" />
      </button>
    </div>

    <!-- Navigation -->
    <ul class="menu menu-sm gap-1 px-2 pt-2">
      <li v-for="item in navItems" :key="item.path">
        <router-link
          :to="item.disabled ? '' : item.path"
          class="flex items-center gap-3"
          :class="[
            collapsed ? 'tooltip tooltip-right justify-center' : '',
            item.disabled ? 'opacity-40 pointer-events-none' : '',
          ]"
          :data-tip="collapsed ? item.label : undefined"
          :aria-disabled="item.disabled"
        >
          <component :is="item.icon" class="w-5 h-5 shrink-0" />
          <span v-if="!collapsed" class="flex-1">{{ item.label }}</span>
          <span
            v-if="!collapsed && item.disabled"
            class="badge badge-xs badge-ghost ml-auto"
          >
            Soon
          </span>
        </router-link>
      </li>
    </ul>

    <!-- Quick Stats Strip -->
    <div v-if="!collapsed && overview" class="px-4 py-3 border-t border-base-300">
      <div class="text-xs text-base-content/60 font-medium mb-2">Quick Stats</div>
      <div class="space-y-1.5">
        <div class="flex justify-between text-xs">
          <span class="text-base-content/50">Conversations</span>
          <span class="font-medium text-base-content/80">{{ overview.conversationCount.toLocaleString() }}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-base-content/50">Tokens</span>
          <span class="font-medium text-base-content/80">{{ formatTokens(overview.totalTokens) }}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-base-content/50">Est. Cost</span>
          <span class="font-medium text-base-content/80">${{ overview.estimatedCost.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Rotating Tip -->
    <div v-if="!collapsed" class="px-4 py-3 border-t border-base-300">
      <div class="text-xs text-base-content/40 leading-relaxed">
        <span class="text-base-content/50 font-medium">Tip:</span> {{ tips[currentTipIndex] }}
      </div>
    </div>

    <!-- Connection Status Footer -->
    <div class="border-t border-base-300 mt-auto">
      <ConnectionStatus :collapsed="collapsed" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import ConnectionStatus from './ConnectionStatus.vue';
import { useAnalytics } from '../composables/useAnalytics';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BarChart3,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next';

const collapsed = ref(localStorage.getItem('sidebar-collapsed') === 'true');

watch(collapsed, (val) => {
  localStorage.setItem('sidebar-collapsed', String(val));
});

const navItems = [
  { path: '/overview', label: 'Overview', icon: LayoutDashboard, disabled: false },
  { path: '/conversations', label: 'Conversations', icon: MessageSquare, disabled: false },
  { path: '/agents', label: 'Agents', icon: Bot, disabled: false },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, disabled: false },
  { path: '/plans', label: 'Plans', icon: ClipboardList, disabled: false },
  { path: '/settings', label: 'Settings', icon: Settings, disabled: false },
];

// Quick Stats
const { overview } = useAnalytics();

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

// Rotating Tips
const tips = [
  'Use date range presets to quickly compare time periods',
  'Click any conversation row to see the full message thread',
  'Filter by agent to isolate performance patterns',
  'The Analytics page shows token usage trends over time',
  'Check model distribution to optimize API costs',
  'Sort conversations by cost to find expensive sessions',
  'Active days shows how many days had agent activity',
  'Cache read tokens reduce your effective API costs',
  'Use the Plans view to track agent task completion',
  'Compare agent performance side by side on the Agents page',
];

const currentTipIndex = ref(Math.floor(Math.random() * tips.length));

const tipInterval = setInterval(() => {
  currentTipIndex.value = (currentTipIndex.value + 1) % tips.length;
}, 30_000);

onUnmounted(() => {
  clearInterval(tipInterval);
});
</script>
