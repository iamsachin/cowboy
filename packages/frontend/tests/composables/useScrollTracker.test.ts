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
    const { captureScrollPosition } = useScrollTracker(containerRef);

    // Simulate user scrolling away so captureScrollPosition preserves position
    const scrollHandler = el.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll'
    )?.[1] as () => void;
    scrollHandler();
    vi.advanceTimersByTime(16);

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

  // --- New intent-based tracking tests ---

  it('userScrolledAway defaults to false', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 450,
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { userScrolledAway } = useScrollTracker(containerRef);

    expect(userScrolledAway.value).toBe(false);
  });

  it('user scroll away from bottom sets userScrolledAway to true', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 200, // NOT at bottom (300 > 100)
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { userScrolledAway } = useScrollTracker(containerRef);

    // Simulate user scroll: get the onScroll handler and call it
    const scrollHandler = el.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll'
    )?.[1] as () => void;
    expect(scrollHandler).toBeDefined();

    scrollHandler();
    // RAF callback
    vi.advanceTimersByTime(16);

    expect(userScrolledAway.value).toBe(true);
  });

  it('user scroll to near bottom sets userScrolledAway to false', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 200,
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { userScrolledAway } = useScrollTracker(containerRef);

    // First, simulate scrolling away
    const scrollHandler = el.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll'
    )?.[1] as () => void;

    scrollHandler();
    vi.advanceTimersByTime(16);
    expect(userScrolledAway.value).toBe(true);

    // Now scroll back to bottom
    Object.defineProperty(el, 'scrollTop', { value: 450, configurable: true });
    scrollHandler();
    vi.advanceTimersByTime(16);

    expect(userScrolledAway.value).toBe(false);
  });

  it('scrollToBottom(true) resets userScrolledAway to false (pill click path)', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 200,
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { userScrolledAway, scrollToBottom } = useScrollTracker(containerRef);

    // Simulate user scrolling away
    const scrollHandler = el.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll'
    )?.[1] as () => void;

    scrollHandler();
    vi.advanceTimersByTime(16);
    expect(userScrolledAway.value).toBe(true);

    // Click pill (scrollToBottom with smooth=true)
    scrollToBottom(true);
    expect(userScrolledAway.value).toBe(false);
  });

  it('programmatic scrollToBottom does NOT set userScrolledAway to true', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 450, // at bottom
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { userScrolledAway, scrollToBottom } = useScrollTracker(containerRef);

    expect(userScrolledAway.value).toBe(false);

    // Programmatic scroll to bottom
    scrollToBottom(false);

    // The scroll event fires after scrollTo - simulate it
    // But because scrollTo is programmatic, the flag should guard against flipping
    const scrollHandler = el.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll'
    )?.[1] as () => void;

    // Simulate that the element is now NOT at bottom temporarily (content grew)
    Object.defineProperty(el, 'scrollTop', { value: 200, configurable: true });
    scrollHandler();
    vi.advanceTimersByTime(16);

    // userScrolledAway should still be false because the scroll was programmatic
    expect(userScrolledAway.value).toBe(false);
  });

  it('captureScrollPosition uses userScrolledAway for auto-scroll decision', async () => {
    const el = createMockElement({
      scrollHeight: 1000,
      scrollTop: 200,
      clientHeight: 500,
    });
    const containerRef = ref<HTMLElement | null>(el);

    const { useScrollTracker } = await getModule();
    const { userScrolledAway, captureScrollPosition } = useScrollTracker(containerRef);

    // userScrolledAway is false by default, so captureScrollPosition should auto-scroll
    const restore = captureScrollPosition();
    Object.defineProperty(el, 'scrollHeight', { value: 1200, configurable: true });
    restore!();

    // Should auto-scroll to bottom since userScrolledAway is false
    expect(el.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'instant' });
  });
});
