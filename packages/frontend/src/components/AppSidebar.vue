<template>
  <aside
    class="bg-base-200 h-screen flex flex-col transition-all duration-200 shrink-0"
    :class="collapsed ? 'w-16' : 'w-60'"
  >
    <!-- Header -->
    <div class="p-3 flex items-center justify-between border-b border-base-300">
      <span
        v-if="!collapsed"
        class="text-lg font-bold text-primary tracking-tight"
      >
        Cowboy
      </span>
      <button
        class="btn btn-ghost btn-sm btn-square"
        @click="collapsed = !collapsed"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <component :is="collapsed ? ChevronRight : ChevronLeft" class="w-4 h-4" />
      </button>
    </div>

    <!-- Navigation -->
    <ul class="menu menu-sm flex-1 gap-1 px-2 pt-2">
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
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next';

const collapsed = ref(false);

const navItems = [
  { path: '/overview', label: 'Overview', icon: LayoutDashboard, disabled: false },
  { path: '/conversations', label: 'Conversations', icon: MessageSquare, disabled: true },
  { path: '/agents', label: 'Agents', icon: Bot, disabled: true },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, disabled: true },
  { path: '/settings', label: 'Settings', icon: Settings, disabled: true },
];
</script>
