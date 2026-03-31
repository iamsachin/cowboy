import { ref, watch, type Ref } from 'vue';

export function useAnimatedNumber(source: Ref<number>, duration = 600): Ref<number> {
  const output = ref(source.value);
  let animationFrame: number | null = null;

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  watch(source, (newVal) => {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
    }

    const startVal = output.value;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      output.value = startVal + (newVal - startVal) * easedProgress;

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        output.value = newVal;
        animationFrame = null;
      }
    }

    animationFrame = requestAnimationFrame(animate);
  });

  return output;
}
