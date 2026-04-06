import { ref, readonly, watch, type Ref, onUnmounted } from 'vue';

const THRESHOLD = 100;

export function useScrollTracker(containerRef: Ref<HTMLElement | null>) {
  const isAtBottom = ref(true);
  const userScrolledAway = ref(false);
  let rafId: number | null = null;
  let programmaticScroll = false;

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

      // If this scroll was triggered programmatically, don't update userScrolledAway
      if (programmaticScroll) {
        programmaticScroll = false;
        return;
      }

      // User-initiated scroll: update intent flag based on position
      if (isAtBottom.value) {
        userScrolledAway.value = false;
      } else {
        userScrolledAway.value = true;
      }
    });
  }

  function scrollToBottom(smooth: boolean = false): void {
    const el = containerRef.value;
    if (!el) return;
    programmaticScroll = true;
    userScrolledAway.value = false;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  }

  /**
   * Call BEFORE data update. Returns a restore function to call after the DOM updates (nextTick).
   * If user has not scrolled away, the restore function auto-scrolls to bottom.
   * If user has scrolled away, it preserves their position by adjusting for height delta.
   */
  function captureScrollPosition(): (() => void) | null {
    const el = containerRef.value;
    if (!el) return null;

    const wasFollowingBottom = !userScrolledAway.value;
    const prevScrollHeight = el.scrollHeight;
    const prevScrollTop = el.scrollTop;

    return () => {
      const el = containerRef.value;
      if (!el) return;

      if (wasFollowingBottom) {
        // Auto-scroll to bottom
        programmaticScroll = true;
        el.scrollTo({ top: el.scrollHeight, behavior: 'instant' });
      } else {
        // Preserve scroll position by adjusting for height change
        const delta = el.scrollHeight - prevScrollHeight;
        el.scrollTop = prevScrollTop + delta;
      }
    };
  }

  watch(containerRef, (newEl, oldEl) => {
    oldEl?.removeEventListener('scroll', onScroll);
    newEl?.addEventListener('scroll', onScroll, { passive: true });
    if (newEl) checkBottom();
  }, { immediate: true });

  onUnmounted(() => {
    containerRef.value?.removeEventListener('scroll', onScroll);
    if (rafId !== null) cancelAnimationFrame(rafId);
  });

  return {
    isAtBottom,
    userScrolledAway: readonly(userScrolledAway),
    scrollToBottom,
    checkBottom,
    captureScrollPosition,
  };
}
