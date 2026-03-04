import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/overview',
  },
  {
    path: '/overview',
    name: 'overview',
    component: () => import('../pages/OverviewPage.vue'),
  },
  {
    path: '/conversations',
    name: 'conversations',
    component: () => import('../pages/ConversationsPage.vue'),
  },
  {
    path: '/conversations/:id',
    name: 'conversation-detail',
    component: () => import('../pages/ConversationDetailPage.vue'),
  },
  {
    path: '/agents',
    name: 'agents',
    component: () => import('../pages/AgentsPage.vue'),
  },
  {
    path: '/analytics',
    name: 'analytics',
    component: () => import('../pages/AnalyticsPage.vue'),
  },
  {
    path: '/plans',
    name: 'plans',
    component: () => import('../pages/PlansPage.vue'),
  },
  {
    path: '/plans/:id',
    name: 'plan-detail',
    component: () => import('../pages/PlanDetailPage.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../pages/SettingsPage.vue'),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
