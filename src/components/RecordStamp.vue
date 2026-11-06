<script setup lang="ts">
/** A rubber stamp that slams onto the record header, then fades away. */
defineProps<{
  label: string;
  serial: string | null;
  tone: "issued" | "deferred" | "closed";
  stampedAt: string;
}>();
defineEmits<{ done: [] }>();
</script>

<template>
  <div
    :class="['record-stamp', tone]"
    aria-hidden="true"
    @animationend.self="(e) => e.animationName.includes('out') && $emit('done')"
  >
    <span class="stamp-label">{{ label }}</span>
    <span class="stamp-line">{{ serial }} · {{ stampedAt }}</span>
  </div>
</template>

<style scoped>
.record-stamp {
  --ink-color: var(--green-text);
  position: absolute;
  inset: 0;
  width: fit-content;
  height: fit-content;
  margin: auto;
  z-index: 5;
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 10px 26px 8px;
  border: 5px double var(--ink-color);
  border-radius: 10px;
  color: var(--ink-color);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  pointer-events: none;
  transform: rotate(-8deg);
  /* Grain so it reads as ink, not a box. */
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 1.7'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mask-size: 240px 120px;
  animation:
    stamp-in 0.42s cubic-bezier(0.2, 0.9, 0.3, 1.2) both,
    stamp-out 0.6s ease-in 2.4s forwards;
}
.record-stamp.deferred {
  --ink-color: var(--amber-text);
}
.record-stamp.closed {
  --ink-color: var(--esr-accent-text);
}
.stamp-label {
  font-size: 34px;
  line-height: 1.05;
}
.stamp-line {
  font-size: 12px;
  letter-spacing: 0.2em;
}
@keyframes stamp-in {
  0% {
    opacity: 0;
    transform: rotate(-16deg) scale(2.6);
  }
  60% {
    opacity: 1;
    transform: rotate(-7deg) scale(0.94);
  }
  100% {
    opacity: 1;
    transform: rotate(-8deg) scale(1);
  }
}
@keyframes stamp-out {
  to {
    opacity: 0;
    transform: rotate(-8deg) scale(1.04);
  }
}
@container (max-width: 560px) {
  .stamp-label {
    font-size: 22px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .record-stamp {
    animation: stamp-out 0.6s ease-in 2.4s forwards;
  }
}
</style>
