<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
/** A number that rolls to its new value instead of jumping. */
const props = defineProps<{ value: number; duration?: number }>();
const shown = ref(props.value);
let frame = 0;
const reducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
watch(
  () => props.value,
  (to) => {
    cancelAnimationFrame(frame);
    if (reducedMotion()) {
      shown.value = to;
      return;
    }
    const from = shown.value;
    const started = performance.now();
    const length = props.duration ?? 600;
    const step = (now: number) => {
      const p = Math.min(1, (now - started) / length);
      shown.value = Math.round(from + (to - from) * (1 - (1 - p) ** 3));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  },
);
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <span class="count-up">{{ shown.toLocaleString() }}</span>
</template>

<style scoped>
.count-up {
  font-variant-numeric: tabular-nums;
}
</style>
