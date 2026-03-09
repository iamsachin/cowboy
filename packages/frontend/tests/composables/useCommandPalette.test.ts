import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';

// Mock vue-router
const pushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const mockConversations = [
  { id: 'c1', date: new Date(Date.now() - 5 * 60_000).toISOString(), agent: 'claude', title: 'Fix login bug', project: 'myapp', model: 'claude-3', inputTokens: 100, outputTokens: 200, cacheReadTokens: 0, cacheCreationTokens: 0, cost: 0.01, savings: 0 },
  { id: 'c2', date: new Date(Date.now() - 2 * 3600_000).toISOString(), agent: 'cursor', title: 'Overview refactor', project: 'webapp', model: 'gpt-4', inputTokens: 50, outputTokens: 100, cacheReadTokens: 0, cacheCreationTokens: 0, cost: 0.005, savings: 0 },
  { id: 'c3', date: new Date(Date.now() - 3 * 86_400_000).toISOString(), agent: 'claude', title: 'Add search feature', project: 'myapp', model: 'claude-3', inputTokens: 150, outputTokens: 300, cacheReadTokens: 0, cacheCreationTokens: 0, cost: 0.02, savings: 0 },
  { id: 'c4', date: new Date(Date.now() - 10 * 86_400_000).toISOString(), agent: 'claude', title: 'Setup project', project: 'other', model: 'claude-3', inputTokens: 80, outputTokens: 160, cacheReadTokens: 0, cacheCreationTokens: 0, cost: 0.008, savings: 0 },
  { id: 'c5', date: new Date(Date.now() - 60_000).toISOString(), agent: 'cursor', title: 'Debug API endpoint', project: 'myapp', model: 'gpt-4', inputTokens: 200, outputTokens: 400, cacheReadTokens: 0, cacheCreationTokens: 0, cost: 0.03, savings: 0 },
];

function createFetchMock() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ rows: mockConversations, total: mockConversations.length, page: 1, limit: 100 }),
  });
}

// We need a fresh module for each test since it uses singleton state
async function freshPalette() {
  // Dynamic import with cache busting via vi.resetModules()
  const mod = await import('../../src/composables/useCommandPalette');
  const mockRouter = { push: pushMock } as any;
  return mod.useCommandPalette(mockRouter);
}

describe('useCommandPalette', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    vi.resetModules();
    originalFetch = globalThis.fetch;
    globalThis.fetch = createFetchMock();
    pushMock.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns all 6 pages and conversations when query is empty', async () => {
    const result = await freshPalette();
    await result.open();
    await nextTick();

    expect(result.filteredPages.value.length).toBe(6);
    expect(result.filteredConversations.value.length).toBeLessThanOrEqual(10);
    expect(result.filteredConversations.value.length).toBe(mockConversations.length);
  });

  it('filters pages by query', async () => {
    const result = await freshPalette();
    await result.open();
    await nextTick();

    result.query.value = 'over';
    await nextTick();

    const pageNames = result.filteredPages.value.map((p) => p.name);
    expect(pageNames).toContain('Overview');
    expect(pageNames.length).toBeLessThan(6);
  });

  it('returns empty conversations for nonexistent query', async () => {
    const result = await freshPalette();
    await result.open();
    await nextTick();

    result.query.value = 'xyznonexistent';
    await nextTick();

    expect(result.filteredConversations.value.length).toBe(0);
  });

  it('limits conversation results to 10 max', async () => {
    const manyConvos = Array.from({ length: 15 }, (_, i) => ({
      id: `c${i}`, date: new Date().toISOString(), agent: 'claude', title: `Conversation ${i}`,
      project: 'proj', model: 'claude-3', inputTokens: 10, outputTokens: 20,
      cacheReadTokens: 0, cacheCreationTokens: 0, cost: 0.01, savings: 0,
    }));
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rows: manyConvos, total: 15, page: 1, limit: 100 }),
    });

    const result = await freshPalette();
    await result.open();
    await nextTick();

    expect(result.filteredConversations.value.length).toBeLessThanOrEqual(10);
  });

  it('resets highlightedIndex to 0 on query change', async () => {
    const result = await freshPalette();
    await result.open();
    await nextTick();

    result.navigateDown();
    result.navigateDown();
    expect(result.highlightedIndex.value).toBe(2);

    result.query.value = 'test';
    await nextTick();

    expect(result.highlightedIndex.value).toBe(0);
  });

  it('navigateUp clamps to 0', async () => {
    const result = await freshPalette();
    await result.open();
    await nextTick();

    result.navigateUp();
    result.navigateUp();
    expect(result.highlightedIndex.value).toBe(0);
  });

  it('navigateDown clamps to total results - 1', async () => {
    const result = await freshPalette();
    await result.open();
    await nextTick();

    const total = result.allResults.value.length;
    for (let i = 0; i < total + 5; i++) {
      result.navigateDown();
    }
    expect(result.highlightedIndex.value).toBe(total - 1);
  });

  it('relativeDate returns correct relative strings', async () => {
    const result = await freshPalette();

    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(result.relativeDate(fiveMinAgo)).toBe('5m ago');

    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    expect(result.relativeDate(twoHoursAgo)).toBe('2h ago');

    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    expect(result.relativeDate(threeDaysAgo)).toBe('3d ago');
  });

  it('relativeDate returns formatted date for > 7 days', async () => {
    const result = await freshPalette();

    const oldDate = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const formatted = result.relativeDate(oldDate);
    expect(formatted).not.toContain('ago');
    expect(formatted).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it('select navigates to page and closes palette', async () => {
    const result = await freshPalette();
    await result.open();
    await nextTick();

    expect(result.isOpen.value).toBe(true);
    // First result should be a page (Overview)
    result.select();
    expect(pushMock).toHaveBeenCalledWith('/overview');
    expect(result.isOpen.value).toBe(false);
  });

  it('select navigates to conversation', async () => {
    const result = await freshPalette();
    await result.open();
    await nextTick();

    // Navigate past all 6 pages to first conversation
    for (let i = 0; i < 6; i++) {
      result.navigateDown();
    }
    result.select();
    expect(pushMock).toHaveBeenCalledWith('/conversations/c1');
    expect(result.isOpen.value).toBe(false);
  });
});
