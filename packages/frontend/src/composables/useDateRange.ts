import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export type Preset = 'today' | '7d' | '30d' | 'all';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeFromPreset(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const to = formatDate(today);

  switch (preset) {
    case 'today':
      return { from: to, to };
    case '7d': {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { from: formatDate(d), to };
    }
    case '30d': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { from: formatDate(d), to };
    }
    case 'all':
      return { from: '2020-01-01', to };
  }
}

// Module-level refs for singleton state
const preset = ref<Preset>('30d');
const customFrom = ref<string | null>(null);
const customTo = ref<string | null>(null);
let initialized = false;

export function useDateRange() {
  const route = useRoute();
  const router = useRouter();

  // Read initial values from URL query params (once)
  if (!initialized) {
    const q = route.query;
    if (q.preset && ['today', '7d', '30d', 'all'].includes(q.preset as string)) {
      preset.value = q.preset as Preset;
    }
    if (q.from && typeof q.from === 'string') {
      customFrom.value = q.from;
    }
    if (q.to && typeof q.to === 'string') {
      customTo.value = q.to;
    }
    initialized = true;
  }

  const isCustom = computed(() => customFrom.value !== null && customTo.value !== null);

  const dateRange = computed<{ from: string; to: string }>(() => {
    if (isCustom.value) {
      return { from: customFrom.value!, to: customTo.value! };
    }
    return computeFromPreset(preset.value);
  });

  function setPreset(p: Preset) {
    preset.value = p;
    customFrom.value = null;
    customTo.value = null;
  }

  function setCustomRange(from: string, to: string) {
    customFrom.value = from;
    customTo.value = to;
  }

  // Sync state to URL query params
  watch(
    [preset, customFrom, customTo],
    () => {
      const query: Record<string, string> = { preset: preset.value };
      if (customFrom.value) query.from = customFrom.value;
      if (customTo.value) query.to = customTo.value;
      router.replace({ query }).catch(() => {
        // Ignore navigation duplicated errors
      });
    },
    { flush: 'post' }
  );

  return {
    preset,
    customFrom,
    customTo,
    isCustom,
    dateRange,
    setPreset,
    setCustomRange,
  };
}
