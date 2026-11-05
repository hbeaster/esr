<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
/**
 * Text that settles like a departures board when `value` changes while
 * `animate` is true. Screen readers get the final value only.
 */
const props = defineProps<{ value: string; animate?: boolean }>();
const GLYPHS = "0123456789ABCDEFGHJKLMNPRSTUVWXYZ";
const shown = ref(props.value);
const flipping = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;
const reducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function settle(target: string) {
  clearInterval(timer);
  if (!props.animate || reducedMotion()) {
    flipping.value = false;
    shown.value = target;
    return;
  }
  const started = performance.now();
  flipping.value = true;
  timer = setInterval(() => {
    const elapsed = performance.now() - started;
    let done = true;
    shown.value = [...target]
      .map((char, i) => {
        // Each character settles a beat after the one before it.
        if (elapsed >= 260 + i * 90 || char === " ") return char;
        done = false;
        return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      })
      .join("");
    if (done) {
      clearInterval(timer);
      flipping.value = false;
    }
  }, 45);
}
watch(() => props.value, settle);
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <span :class="['split-flap', { flipping }]"><span aria-hidden="true">
    <span
      v-for="(char, i) in shown"
      :key="i"
      class="flap"
    >{{ char }}</span>
  </span><span class="sr-only">{{ value }}</span></span>
</template>

<style scoped>
.split-flap {
  display: inline-flex;
}
.flipping .flap {
  display: inline-block;
  min-width: 0.62em;
  text-align: center;
  border-radius: 3px;
  background: var(--ink);
  color: var(--surface);
  margin-right: 1px;
  animation: flap 0.09s linear infinite;
}
@keyframes flap {
  50% {
    transform: scaleY(0.82);
  }
}
</style>
