import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';

// Mock onMounted/onUnmounted since we're testing outside a component
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue');
  return {
    ...actual,
    onMounted: (fn: () => void) => fn(), // Execute immediately
    onUnmounted: vi.fn(), // No-op
  };
});

function createMockElement(overrides?: Partial<HTMLElement>) {
  const el = {
    scrollHeight: 1000,
    scrollTop: 0,
    clientHeight: 500,
    scrollTo: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as HTMLElement;
  return el;
}

describe('useScrollTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function getModule() {
    return await import('../../src/composables/useScrollTracker');
  }

  it('isAtBottom returns true when scrollHeight - scrollTop - clientHeight <= 100', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 450, // 1000 - 450 - 500 = 50, which is <= 100
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { isAtBottom, checkBottom } = useScrollTracker(containerRef);

    checkBottom();
    expect(isAtBottom.value).toBe(true);
  });

  it('isAtBottom returns false when scrollHeight - scrollTop - clientHeight > 100', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 200, // 1000 - 200 - 500 = 300, which is > 100
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { isAtBottom, checkBottom } = useScrollTracker(containerRef);

    checkBottom();
    expect(isAtBottom.value).toBe(false);
  });

  it('isAtBottom returns true at exact boundary (100px)', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 400, // 1000 - 400 - 500 = 100, which is exactly == 100 (should be true)
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { isAtBottom, checkBottom } = useScrollTracker(containerRef);

    checkBottom();
    expect(isAtBottom.value).toBe(true);
  });

  it('scrollToBottom sets scrollTop to scrollHeight via scrollTo (instant)', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 200,
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { scrollToBottom } = useScrollTracker(containerRef);

    scrollToBottom();
    expect(el.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'instant' });
  });

  it('scrollToBottom supports smooth mode', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 200,
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { scrollToBottom } = useScrollTracker(containerRef);

    scrollToBottom(true);
    expect(el.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
  });

  it('captureScrollPosition adjusts scrollTop by delta in scrollHeight after callback', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 200, // 1000 - 200 - 500 = 300, NOT at bottom
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { checkBottom, captureScrollPosition } = useScrollTracker(containerRef);

    // Ensure we're NOT at bottom
    checkBottom();

    const restore = captureScrollPosition();
    expect(restore).not.toBeNull();

    // Simulate content height change (e.g., new messages added)
    Object.defineProperty(el, 'scrollHeight', { value: 1200, configurable: true });

    // Restore should adjust scrollTop by delta (1200 - 1000 = 200)
    restore!();
    expect(el.scrollTop).toBe(400); // 200 + 200 = 400
  });

  it('captureScrollPosition auto-scrolls when isAtBottom is true', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 450, // 1000 - 450 - 500 = 50, AT bottom
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { checkBottom, captureScrollPosition } = useScrollTracker(containerRef);

    // Ensure we're at bottom
    checkBottom();

    const restore = captureScrollPosition();
    expect(restore).not.toBeNull();

    // Simulate content height change
    Object.defineProperty(el, 'scrollHeight', { value: 1200, configurable: true });

    // When at bottom, restore should auto-scroll to bottom instead of preserving position
    restore!();
    expect(el.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'instant' });
  });

  it('registers passive scroll listener on mount', async () => {
    const el = createMockElement();
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    useScrollTracker(containerRef);

    expect(el.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
  });
});
