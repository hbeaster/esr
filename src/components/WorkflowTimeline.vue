<script setup lang="ts">
import { computed } from "vue";
import {
  agingThresholdsDays,
  date,
  formatDuration,
  initials,
  statusAge,
  time,
  workflowTimeline,
} from "../presentation";
import type { TimelineStep } from "../presentation";
import { useNow } from "../composables/useNow";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { record } = useWorkspaceContext();
const now = useNow();
const timeline = computed(() =>
  record.value ? workflowTimeline(record.value, now.value) : [],
);
const age = computed(() =>
  record.value ? statusAge(record.value, now.value) : null,
);
const deferred = computed(
  () => record.value?.status === "ESR Issued – Deferred",
);
function describe(s: TimelineStep): string {
  const parts: string[] = [s.step];
  if (s.state === "upcoming") return `${s.step}, not reached`;
  parts.push(
    s.enteredAt
      ? `entered ${time(s.enteredAt)}${s.actor ? ` by ${s.actor}` : ""}`
      : "entry time not recorded",
  );
  if (s.durationMs !== null) {
    const span = formatDuration(s.durationMs);
    parts.push(s.state === "current" ? `${span} so far` : `took ${span}`);
  }
  const limits = record.value && agingThresholdsDays[record.value.status];
  if (s.state === "current" && age.value && limits)
    parts.push(
      age.value.tone === "stale"
        ? `stale, past ${limits[1]} days`
        : age.value.tone === "warn"
          ? `aging, stale after ${limits[1]} days`
          : `on track, warns after ${limits[0]} days`,
    );
  return parts.join(", ");
}
</script>

<template>
  <ol
    v-if="record"
    :key="`${record.id}-${record.status}`"
    class="timeline"
    aria-label="Workflow progress"
  >
    <li
      v-for="(s, i) in timeline"
      :key="s.step"
      :class="[
        'step',
        s.state,
        s.state === 'current' && age ? `tone-${age.tone}` : '',
      ]"
      :style="{ '--i': i }"
      :title="describe(s)"
      :aria-current="s.state === 'current' ? 'step' : undefined"
    >
      <div class="rail">
        <span
          class="dot"
          aria-hidden="true"
        >{{
          s.state === "done" ? "✓" : i + 1
        }}</span>
        <span
          v-if="i < timeline.length - 1"
          class="bar"
          aria-hidden="true"
        ><span
          v-if="s.state === 'done'"
          class="fill"
        /></span>
      </div>
      <div
        class="body"
        aria-hidden="true"
      >
        <strong>{{ s.step }}</strong><span
          v-if="deferred && s.step === 'ESR Issued'"
          class="tag special"
        >Deferred</span>
        <span
          v-if="s.enteredAt"
          class="meta"
        >{{ date(s.enteredAt)
        }}<template v-if="s.actor"> · {{ initials(s.actor) }}</template></span>
        <span
          v-else-if="s.state !== 'upcoming'"
          class="meta muted"
        >Date not recorded</span>
        <span
          v-if="s.durationMs !== null"
          class="duration"
        >{{ s.state === "current" ? "for" : "took" }}
          {{ formatDuration(s.durationMs) }}</span>
      </div>
      <span class="sr-only">{{ describe(s) }}</span>
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  list-style: none;
  margin: 0 0 var(--sp-6);
  padding: var(--sp-4) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}
.step {
  min-width: 0;
  color: var(--ink-4);
  font-size: var(--fs-sm);
}
.rail {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}
.dot {
  position: relative;
  width: 26px;
  height: 26px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.bar {
  position: relative;
  flex: 1;
  height: 3px;
  margin-right: var(--sp-2);
  border-radius: 2px;
  background: var(--line-soft);
  overflow: hidden;
}
.fill {
  position: absolute;
  inset: 0;
  background: var(--green-dot);
  transform-origin: left;
  animation: fill 0.5s var(--ease) both;
  animation-delay: calc(var(--i) * 0.12s);
}
.body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-right: var(--sp-3);
}
.body strong {
  font-weight: 600;
  white-space: nowrap;
}
.body .tag {
  align-self: flex-start;
  margin: 2px 0;
}
.meta,
.duration {
  font-size: var(--fs-xs);
  white-space: nowrap;
}
.meta.muted {
  font-style: italic;
}
.done {
  color: var(--ink-2);
}
.done .dot {
  background: var(--green-bg);
  border-color: var(--green-line);
  color: var(--green-text);
}
.done .duration {
  color: var(--ink-3);
}
.current {
  color: var(--esr-accent-text);
}
.current .body strong {
  font-weight: 800;
}
.current .dot {
  background: var(--esr-accent);
  border-color: var(--esr-accent);
  color: #fff;
}
.current .dot::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 50%;
  border: 2px solid var(--esr-accent);
  animation: ring 2s ease-out infinite;
}
.current .duration {
  font-weight: 700;
}
.tone-warn .dot {
  background: var(--amber-dot);
  border-color: var(--amber-dot);
}
.tone-warn .dot::after {
  border-color: var(--amber-dot);
}
.tone-warn .duration {
  color: var(--amber-text);
}
.tone-stale .dot {
  background: var(--red-solid);
  border-color: var(--red-solid);
}
.tone-stale .dot::after {
  border-color: var(--red-solid);
}
.tone-stale .duration {
  color: var(--red-text);
}
.tone-stale .duration::after {
  content: " · stale";
}
@keyframes fill {
  from {
    transform: scaleX(0);
  }
}
@keyframes ring {
  0% {
    opacity: 0.7;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.8);
  }
}
@container (max-width: 850px) {
  .timeline {
    overflow-x: auto;
    padding: var(--sp-3);
    grid-template-columns: repeat(5, minmax(128px, 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .fill,
  .current .dot::after {
    animation: none;
  }
}
</style>
