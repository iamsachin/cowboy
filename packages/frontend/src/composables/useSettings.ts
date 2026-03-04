import { ref, onMounted } from 'vue';

export interface SettingsResponse {
  id: number;
  claudeCodePath: string;
  claudeCodeEnabled: boolean;
  cursorPath: string;
  cursorEnabled: boolean;
  syncEnabled: boolean;
  syncUrl: string;
  syncFrequency: number;
  syncCategories: string[];
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSyncSuccess: boolean | null;
  syncCursor: string | null;
}

export interface PathValidationResult {
  valid: boolean;
  fileCount: number;
  message: string;
}

export interface TestSyncResult {
  success: boolean;
  status?: number;
  error?: string;
}

export interface SyncNowResult {
  message: string;
}

export function useSettings() {
  const settings = ref<SettingsResponse | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const pathValidation = ref<Record<string, PathValidationResult>>({});
  const testResult = ref<TestSyncResult | null>(null);
  const syncNowResult = ref<SyncNowResult | null>(null);

  async function fetchSettings(): Promise<void> {
    loading.value = true;
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(`Settings fetch failed: ${res.status}`);
      settings.value = await res.json();
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    } finally {
      loading.value = false;
    }
  }

  async function saveAgentSettings(data: {
    claudeCodePath: string;
    claudeCodeEnabled: boolean;
    cursorPath: string;
    cursorEnabled: boolean;
  }): Promise<void> {
    saving.value = true;
    try {
      const res = await fetch('/api/settings/agent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Save agent settings failed: ${res.status}`);
      settings.value = await res.json();
    } catch (e) {
      console.error('Failed to save agent settings:', e);
    } finally {
      saving.value = false;
    }
  }

  async function saveSyncSettings(data: {
    syncEnabled: boolean;
    syncUrl: string;
    syncFrequency: number;
    syncCategories: string[];
  }): Promise<void> {
    saving.value = true;
    try {
      const res = await fetch('/api/settings/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Save sync settings failed: ${res.status}`);
      settings.value = await res.json();
    } catch (e) {
      console.error('Failed to save sync settings:', e);
    } finally {
      saving.value = false;
    }
  }

  async function validatePath(path: string, agent: string): Promise<void> {
    try {
      const res = await fetch('/api/settings/validate-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, agent }),
      });
      if (!res.ok) throw new Error(`Path validation failed: ${res.status}`);
      pathValidation.value[agent] = await res.json();
    } catch (e) {
      console.error('Failed to validate path:', e);
      pathValidation.value[agent] = { valid: false, fileCount: 0, message: 'Validation request failed' };
    }
  }

  async function testConnection(url: string): Promise<void> {
    testResult.value = null;
    try {
      const res = await fetch('/api/settings/test-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(`Test connection failed: ${res.status}`);
      testResult.value = await res.json();
    } catch (e) {
      console.error('Failed to test connection:', e);
      testResult.value = { success: false, error: (e as Error).message };
    }
  }

  async function triggerSyncNow(): Promise<void> {
    syncNowResult.value = null;
    try {
      const res = await fetch('/api/settings/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Sync now failed: ${res.status}`);
      syncNowResult.value = await res.json();
    } catch (e) {
      console.error('Failed to trigger sync:', e);
      syncNowResult.value = { message: (e as Error).message };
    }
  }

  onMounted(() => {
    fetchSettings();
  });

  return {
    settings,
    loading,
    saving,
    pathValidation,
    testResult,
    syncNowResult,
    fetchSettings,
    saveAgentSettings,
    saveSyncSettings,
    validatePath,
    testConnection,
    triggerSyncNow,
  };
}
