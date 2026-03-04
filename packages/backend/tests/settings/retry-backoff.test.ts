import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test postWithRetry as a standalone exported function.
const { postWithRetry } = await import('../../src/plugins/sync-scheduler.js');

describe('postWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('succeeds on first try and returns the response', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await postWithRetry('http://example.com/sync', { data: 1 });
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on a later attempt', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const promise = postWithRetry('http://example.com/sync', { data: 1 }, {
      maxRetries: 3,
      initialDelay: 5000,
      maxDelay: 60000,
      backoffFactor: 2,
    });

    // Advance past the first retry delay (5000ms + jitter up to 2500ms)
    await vi.advanceTimersByTimeAsync(10000);

    const result = await promise;
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('delays increase with exponential backoff', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const promise = postWithRetry('http://example.com/sync', { data: 1 }, {
      maxRetries: 3,
      initialDelay: 5000,
      maxDelay: 60000,
      backoffFactor: 2,
    });

    // First retry delay: 5000ms base (+ jitter up to 2500ms)
    await vi.advanceTimersByTimeAsync(8000);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second retry delay: 10000ms base (+ jitter up to 5000ms)
    await vi.advanceTimersByTimeAsync(16000);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    await promise;
  });

  it('throws after exhausting all retries', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('persistent failure'));
    vi.stubGlobal('fetch', mockFetch);

    const promise = postWithRetry('http://example.com/sync', { data: 1 }, {
      maxRetries: 3,
      initialDelay: 5000,
      maxDelay: 60000,
      backoffFactor: 2,
    });

    // Advance enough time for all retries to exhaust.
    // Catch the rejection so it doesn't leak as unhandled.
    const settled = promise.catch((err: Error) => err);
    await vi.advanceTimersByTimeAsync(200000);

    const result = await settled;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('persistent failure');
    // 1 initial + 3 retries = 4 calls total
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('sends POST with JSON body and Content-Type header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    await postWithRetry('http://example.com/sync', { test: true });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com/sync',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      }),
    );
  });

  it('throws on non-ok HTTP response after retries', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('Server Error', { status: 500 }));
    vi.stubGlobal('fetch', mockFetch);

    const promise = postWithRetry('http://example.com/sync', { data: 1 }, {
      maxRetries: 2,
      initialDelay: 1000,
      maxDelay: 60000,
      backoffFactor: 2,
    });

    // Catch the rejection so it doesn't leak as unhandled.
    const settled = promise.catch((err: Error) => err);
    await vi.advanceTimersByTimeAsync(100000);

    const result = await settled;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('HTTP 500');
    // 1 initial + 2 retries = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
