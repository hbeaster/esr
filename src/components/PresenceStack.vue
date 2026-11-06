<script setup lang="ts">
import { computed } from "vue";
import { initials } from "../presentation";
import type { LiveViewer } from "../types";
/** Overlapping avatars for people with the workspace open, one per person. */
const props = withDefaults(
  defineProps<{ viewers: LiveViewer[]; max?: number; label: string }>(),
  { max: 4 },
);
const where: Record<LiveViewer["view"], string> = {
  workspace: "on the request list",
  record: "on a record",
  "watch-floor": "on the watch floor",
  other: "in the workspace",
};
const people = computed(() => {
  const seen = new Map<string, LiveViewer>();
  for (const v of props.viewers) if (!seen.has(v.userId)) seen.set(v.userId, v);
  return [...seen.values()];
});
const describe = (v: LiveViewer) =>
  `${v.name} · ${v.role}, ${v.site} · ${where[v.view]}`;
const summary = computed(
  () =>
    `${props.label}: ${people.value.map((v) => v.name).join(", ") || "nobody else"}`,
);
</script>

<template>
  <span
    v-if="people.length"
    class="presence"
    role="img"
    :aria-label="summary"
    :title="summary"
  >
    <span
      v-for="v in people.slice(0, max)"
      :key="v.userId"
      class="presence-avatar"
      :title="describe(v)"
    >{{ initials(v.name) }}</span>
    <span
      v-if="people.length > max"
      class="presence-avatar more"
    >+{{ people.length - max }}</span>
  </span>
</template>

<style scoped>
.presence {
  display: inline-flex;
  align-items: center;
}
.presence-avatar {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin-left: -6px;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: var(--esr-accent-soft);
  color: var(--esr-accent-text);
  font-size: 10px;
  font-weight: 800;
  animation: arrive 0.3s var(--ease);
}
.presence-avatar:first-child {
  margin-left: 0;
}
.presence-avatar.more {
  background: var(--surface-2);
  color: var(--ink-3);
}
@keyframes arrive {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}
@media (prefers-reduced-motion: reduce) {
  .presence-avatar {
    animation: none;
  }
}
</style>
