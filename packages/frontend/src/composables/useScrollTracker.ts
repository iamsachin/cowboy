import { ref, type Ref, onMounted, onUnmounted } from 'vue';

const THRESHOLD = 100;

export function useScrollTracker(containerRef: Ref<HTMLElement | null>) {
  const isAtBottom = ref(true);
  let rafId: number | null = null;

  function checkBottom(): void {
    const el = containerRef.value;
    if (!el) return;
    isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight <= THRESHOLD;
  }

  function onScroll(): void {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      checkBottom();
    });
  }

  function scrollToBottom(smooth: boolean = false): void {
    const el = containerRef.value;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  }

  /**
   * Call BEFORE data update. Returns a restore function to call after the DOM updates (nextTick).
   * If user was at bottom, the restore function auto-scrolls to bottom.
   * If user was scrolled up, it preserves their position by adjusting for height delta.
   */
  function captureScrollPosition(): (() => void) | null {
    const el = containerRef.value;
    if (!el) return null;

    const wasAtBottom = isAtBottom.value;
    const prevScrollHeight = el.scrollHeight;
    const prevScrollTop = el.scrollTop;

    return () => {
      const el = containerRef.value;
      if (!el) return;

      if (wasAtBottom) {
        // Auto-scroll to bottom
        el.scrollTo({ top: el.scrollHeight, behavior: 'instant' });
      } else {
        // Preserve scroll position by adjusting for height change
        const delta = el.scrollHeight - prevScrollHeight;
        el.scrollTop = prevScrollTop + delta;
      }
    };
  }

  onMounted(() => {
    containerRef.value?.addEventListener('scroll', onScroll, { passive: true });
  });

  onUnmounted(() => {
    containerRef.value?.removeEventListener('scroll', onScroll);
    if (rafId !== null) cancelAnimationFrame(rafId);
  });

  return { isAtBottom, scrollToBottom, checkBottom, captureScrollPosition };
}
