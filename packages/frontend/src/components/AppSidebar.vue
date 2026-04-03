<template>
  <aside
    class="bg-base-200 h-screen flex flex-col transition-all duration-200 shrink-0"
    :class="collapsed ? 'w-16' : 'w-60'"
  >
    <!-- Header (below traffic light padding) -->
    <div class="p-3 border-b border-base-300" :class="collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center justify-between'">
      <div v-if="!collapsed" class="flex items-center gap-2.5">
        <img src="/cowboy-icon.png" alt="Cowboy" class="w-8 h-8 rounded-lg" />
        <div class="flex flex-col">
          <span class="text-sm font-bold text-primary tracking-tight leading-tight">Cowboy</span>
          <span class="text-[10px] text-base-content/50 font-normal italic leading-tight">Taming wild agents daily</span>
        </div>
      </div>
      <img v-if="collapsed" src="/cowboy-icon.png" alt="Cowboy" class="w-8 h-8 rounded-lg" />
      <button
        class="btn btn-ghost btn-sm btn-square"
        @click="collapsed = !collapsed"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <component :is="collapsed ? ChevronRight : ChevronLeft" class="w-4 h-4" />
      </button>
    </div>

    <!-- Navigation -->
    <ul class="menu menu-sm gap-1 pt-2" :class="collapsed ? 'px-0 items-center w-full' : 'px-2'">
      <li v-for="item in navItems" :key="item.path">
        <router-link
          :to="item.disabled ? '' : item.path"
          class="flex items-center gap-3"
          :class="[
            collapsed ? 'justify-center' : '',
            item.disabled ? 'opacity-40 pointer-events-none' : '',
          ]"
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

    <!-- Live Token Rate -->
    <div class="border-t border-base-300">
      <LiveTokenPill :collapsed="collapsed" />
    </div>

    <!-- Connection Status + Theme Toggle Footer -->
    <div class="border-t border-base-300 flex items-center" :class="collapsed ? 'flex-col gap-1 py-1' : ''">
      <ConnectionStatus :collapsed="collapsed" :class="collapsed ? '' : 'flex-1'" />
      <ThemeToggle :collapsed="collapsed" :class="collapsed ? '' : 'pr-2'" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import ConnectionStatus from './ConnectionStatus.vue';
import LiveTokenPill from './LiveTokenPill.vue';
import ThemeToggle from './ThemeToggle.vue';
import { useAnalytics } from '../composables/useAnalytics';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BarChart3,
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
