<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { date, filterRecords, flowSeries } from "../presentation";
import type { FlowPoint } from "../presentation";
import { useNow } from "../composables/useNow";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, query, scope, place, replayAt } = useWorkspaceContext();
const now = useNow();

/**
 * Follows search, scope, and place (compartment or level). Not the status filter: "the history of
 * records that are In Process today" is not a meaningful flow.
 */
const series = computed(() =>
  flowSeries(
    filterRecords(
      state.records,
      query.value,
      "",
      scope.value,
      state.user?.id,
      place.value,
    ),
    now.value,
  ),
);
const last = computed(() => series.value.at(-1) ?? null);
/** Backlog change over the last 30 days. */
const trend = computed(() => {
  const points = series.value;
  if (!last.value || points.length < 2) return null;
  const cutoff = last.value.time - 30 * 86_400_000;
  const before = [...points].reverse().find((p) => p.time <= cutoff);
  return last.value.open - (before?.open ?? 0);
});

// ---- Layout (pixels, so text and 2px lines stay crisp at any width) ----
const frame = ref<HTMLElement | null>(null);
const width = ref(720);
let observer: ResizeObserver | null = null;
onMounted(() => {
  if (!frame.value || typeof ResizeObserver === "undefined") return;
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.max(280, Math.round(entry.contentRect.width));
  });
  observer.observe(frame.value);
});
onBeforeUnmount(() => observer?.disconnect());
const compact = computed(() => width.value < 520);
const height = computed(() => (compact.value ? 170 : 220));
const margin = computed(() => ({
  top: 12,
  right: compact.value ? 64 : 92,
  bottom: 26,
  left: 36,
}));
const plotW = computed(() => width.value - margin.value.left - margin.value.right);
const plotH = computed(() => height.value - margin.value.top - margin.value.bottom);

/** Series with a zero origin one bucket before the first point. */
const plotted = computed<FlowPoint[]>(() => {
  const points = series.value;
  if (!points.length) return [];
  const step =
    points.length > 1 ? points[1].time - points[0].time : 86_400_000;
  return [
    { time: points[0].time - step, opened: 0, closed: 0, open: 0, reopened: 0 },
    ...points,
  ];
});
const domain = computed(() => {
  const p = plotted.value;
  return p.length ? [p[0].time, p.at(-1)!.time] : [0, 1];
});
/** A "nice" axis maximum with 4–5 ticks. */
const yTicks = computed(() => {
  const max = Math.max(1, ...series.value.map((p) => p.opened));
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
});
const x = (time: number) => {
  const [a, b] = domain.value;
  return margin.value.left + ((time - a) / Math.max(b - a, 1)) * plotW.value;
};
const y = (value: number) =>
  margin.value.top + plotH.value - (value / yTicks.value.at(-1)!) * plotH.value;
const line = (key: "opened" | "closed") =>
  plotted.value
    .map((p, i) => `${i ? "L" : "M"}${x(p.time).toFixed(1)} ${y(p[key]).toFixed(1)}`)
    .join("");
const band = computed(() => {
  const p = plotted.value;
  if (!p.length) return "";
  const top = p.map((d) => `${x(d.time).toFixed(1)} ${y(d.opened).toFixed(1)}`);
  const bottom = [...p]
    .reverse()
    .map((d) => `${x(d.time).toFixed(1)} ${y(d.closed).toFixed(1)}`);
  return `M${top.join("L")}L${bottom.join("L")}Z`;
});
const yearSpan = computed(
  () => new Date(domain.value[0]).getFullYear() !== new Date(domain.value[1]).getFullYear(),
);
const tickLabel = (time: number) =>
  new Date(time).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(yearSpan.value ? { year: "2-digit" } : {}),
  });
const xTicks = computed(() => {
  const [a, b] = domain.value;
  const count = Math.max(2, Math.floor(plotW.value / 110));
  return Array.from({ length: count + 1 }, (_, i) => a + ((b - a) * i) / count);
});
/** End-of-line labels, nudged apart when the lines finish close together. */
const endLabels = computed(() => {
  const end = last.value;
  if (!end) return [];
  let opened = y(end.opened);
  let closed = y(end.closed);
  if (closed - opened < 16) {
    const mid = (opened + closed) / 2;
    opened = mid - 8;
    closed = mid + 8;
  }
  return [
    { key: "opened", label: "Opened", value: end.opened, y: opened },
    { key: "closed", label: "Closed", value: end.closed, y: closed },
  ];
});

// ---- Hover, keyboard, and replay ----
const focus = ref<number | null>(null);
const tableOpen = ref(false);
const focused = computed(() =>
  focus.value === null ? null : series.value[focus.value] ?? null,
);
function nearest(clientX: number) {
  const rect = frame.value?.getBoundingClientRect();
  if (!rect || !series.value.length) return null;
  const [a, b] = domain.value;
  const time = a + ((clientX - rect.left - margin.value.left) / plotW.value) * (b - a);
  let best = 0;
  series.value.forEach((p, i) => {
    if (Math.abs(p.time - time) < Math.abs(series.value[best].time - time)) best = i;
  });
  return best;
}
function onMove(event: PointerEvent) {
  focus.value = nearest(event.clientX);
}
function onKey(event: KeyboardEvent) {
  const n = series.value.length;
  if (!n) return;
  const moves: Record<string, number> = {
    ArrowRight: (focus.value ?? -1) + 1,
    ArrowLeft: (focus.value ?? n) - 1,
    Home: 0,
    End: n - 1,
  };
  if (event.key in moves) {
    event.preventDefault();
    focus.value = Math.min(n - 1, Math.max(0, moves[event.key]));
  } else if ((event.key === "Enter" || event.key === " ") && focused.value) {
    event.preventDefault();
    replayFrom(focused.value);
  }
}
/** Pause the fleet replay at this date; the hull, counts, and ticker follow. */
function replayFrom(point: FlowPoint) {
  replayAt.value = point === last.value ? null : point.time;
}
function onClick(event: MouseEvent) {
  const i = nearest(event.clientX);
  if (i !== null) replayFrom(series.value[i]);
}
watch(series, () => (focus.value = null));
/** A point holds counts at the end of its bucket; name the day it covers. */
const pointLabel = (p: FlowPoint) =>
  p === last.value
    ? `Now, ${date(new Date(p.time).toISOString())}`
    : date(new Date(p.time - 1).toISOString());
const describe = (p: FlowPoint) =>
  `${pointLabel(p)}: ${p.opened} opened, ${p.closed} closed, ${p.open} open${p.reopened ? `, including ${p.reopened} reopened by revision` : ""}`;
const summary = computed(() =>
  last.value
    ? `Opened vs closed ESRs from ${date(new Date(domain.value[0]).toISOString())} to now: ${last.value.opened} opened, ${last.value.closed} closed, ${last.value.open} open`
    : "No ESRs yet",
);
const tip = computed(() => {
  if (!focused.value) return null;
  const left = Math.min(Math.max(x(focused.value.time), 90), width.value - 90);
  return { left, point: focused.value };
});
const cursor = computed(() =>
  replayAt.value !== null && series.value.length
    ? Math.min(Math.max(x(replayAt.value), margin.value.left), margin.value.left + plotW.value)
    : null,
);
</script>

<template>
  <section
    class="card flow"
    aria-labelledby="flow-title"
  >
    <div class="flow-head">
      <div>
        <h2 id="flow-title">
          Opened vs closed
        </h2>
        <p class="muted">
          <template v-if="series.length">
            {{ date(new Date(domain[0]).toISOString()) }} – now ·
          </template>
          Follows search, tab, and compartment; not the status filter.
        </p>
      </div>
      <div
        v-if="last"
        class="flow-stats"
      >
        <span><strong>{{ last.open }}</strong> open now</span>
        <span><strong>{{ last.opened }}</strong> opened</span>
        <span><strong>{{ last.closed }}</strong> closed</span>
        <span
          v-if="trend !== null"
          :class="['trend', trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat']"
          :title="`Open backlog change over the last 30 days`"
        >{{
          trend > 0 ? `▲ ${trend}` : trend < 0 ? `▼ ${-trend}` : "No change"
        }}
          in 30 days</span>
      </div>
    </div>

    <div
      ref="frame"
      class="flow-frame"
      :tabindex="series.length ? 0 : -1"
      @pointermove="onMove"
      @pointerleave="focus = null"
      @click="onClick"
      @keydown="onKey"
      @blur="focus = null"
    >
      <p
        v-if="!series.length"
        class="flow-empty"
      >
        No ESRs yet.
      </p>
      <svg
        v-else
        :width="width"
        :height="height"
        role="img"
        :aria-label="summary"
      >
        <g class="grid">
          <line
            v-for="t in yTicks"
            :key="t"
            :x1="margin.left"
            :x2="margin.left + plotW"
            :y1="y(t)"
            :y2="y(t)"
          />
        </g>
        <g class="axis">
          <text
            v-for="t in yTicks"
            :key="t"
            :x="margin.left - 8"
            :y="y(t) + 4"
            text-anchor="end"
          >{{ t }}</text>
          <text
            v-for="(t, i) in xTicks"
            :key="i"
            :x="x(t)"
            :y="height - 6"
            :text-anchor="i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'"
          >{{ tickLabel(t) }}</text>
        </g>
        <path
          class="band"
          :d="band"
        />
        <path
          class="series opened"
          :d="line('opened')"
          pathLength="1"
        />
        <path
          class="series closed"
          :d="line('closed')"
          pathLength="1"
        />
        <g class="end-labels">
          <g
            v-for="l in endLabels"
            :key="l.key"
            :transform="`translate(${margin.left + plotW + 8} ${l.y})`"
          >
            <line
              :class="['key', l.key]"
              x1="0"
              x2="12"
              y1="0"
              y2="0"
            />
            <text
              x="16"
              y="4"
            ><tspan class="value">{{ l.value }}</tspan> {{ l.label }}</text>
          </g>
        </g>
        <g
          v-if="cursor !== null"
          class="replay-cursor"
        >
          <rect
            :x="cursor"
            :y="margin.top"
            :width="margin.left + plotW - cursor"
            :height="plotH"
          />
          <line
            :x1="cursor"
            :x2="cursor"
            :y1="margin.top - 4"
            :y2="margin.top + plotH"
          />
          <text
            :x="cursor + 4"
            :y="margin.top + 10"
          >Replay</text>
        </g>
        <g
          v-if="focused"
          class="crosshair"
        >
          <line
            :x1="x(focused.time)"
            :x2="x(focused.time)"
            :y1="margin.top"
            :y2="margin.top + plotH"
          />
          <circle
            class="opened"
            :cx="x(focused.time)"
            :cy="y(focused.opened)"
            r="4"
          />
          <circle
            class="closed"
            :cx="x(focused.time)"
            :cy="y(focused.closed)"
            r="4"
          />
        </g>
      </svg>
      <div
        v-if="tip"
        class="flow-tip"
        :style="{ left: `${tip.left}px` }"
        aria-hidden="true"
      >
        <div class="tip-date">
          {{ pointLabel(tip.point) }}
        </div>
        <div class="tip-row">
          <span class="tip-key opened" /><strong>{{ tip.point.opened }}</strong> opened
        </div>
        <div class="tip-row">
          <span class="tip-key closed" /><strong>{{ tip.point.closed }}</strong> closed
        </div>
        <div class="tip-row">
          <span class="tip-key band" /><strong>{{ tip.point.open }}</strong> open
        </div>
        <div
          v-if="tip.point.reopened"
          class="tip-note"
        >
          Includes {{ tip.point.reopened }} reopened by revision
        </div>
        <div class="tip-hint">
          {{ tip.point === last ? "Now" : "Click to replay from this date" }}
        </div>
      </div>
      <span
        class="sr-only"
        aria-live="polite"
      >{{ focused ? describe(focused) : "" }}</span>
    </div>

    <details
      v-if="series.length"
      class="flow-table"
      @toggle="tableOpen = ($event.target as HTMLDetailsElement).open"
    >
      <summary>View as table</summary>
      <!-- Rendered only while open: up to ~200 rows, and the page's other tables stay unambiguous. -->
      <table v-if="tableOpen">
        <thead>
          <tr>
            <th scope="col">
              Date
            </th>
            <th scope="col">
              Opened
            </th>
            <th scope="col">
              Closed
            </th>
            <th scope="col">
              Open
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in [...series].reverse()"
            :key="p.time"
          >
            <td>{{ pointLabel(p) }}</td>
            <td>{{ p.opened }}</td>
            <td>{{ p.closed }}</td>
            <td>{{ p.open }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </section>
</template>

<style scoped>
.flow {
  padding: var(--sp-4) var(--sp-5);
  margin-bottom: var(--sp-5);
}
.flow-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.flow-head h2 {
  margin: 0;
  font-size: var(--fs-md);
}
.flow-head p {
  margin: 2px 0 0;
  font-size: var(--fs-xs);
}
.flow-stats {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2) var(--sp-4);
  flex-wrap: wrap;
  font-size: var(--fs-sm);
  color: var(--ink-3);
}
.flow-stats strong {
  font-size: var(--fs-xl);
  color: var(--ink);
}
.trend {
  padding: 1px 8px;
  border-radius: 999px;
  font-weight: 700;
  border: 1px solid var(--gray-line);
  background: var(--gray-bg);
  color: var(--gray-text);
}
.trend.up {
  border-color: var(--amber-line);
  background: var(--amber-bg);
  color: var(--amber-text);
}
.trend.down {
  border-color: var(--green-line);
  background: var(--green-bg);
  color: var(--green-text);
}
.flow-frame {
  position: relative;
  margin-top: var(--sp-3);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: crosshair;
  touch-action: pan-y;
}
.flow-frame:focus-visible {
  box-shadow: 0 0 0 3px var(--esr-accent-soft);
}
.flow-frame svg {
  display: block;
  overflow: visible;
}
.flow-empty {
  margin: var(--sp-6) 0;
  text-align: center;
  color: var(--ink-3);
}
.grid line {
  stroke: var(--line-soft);
  stroke-width: 1;
}
.axis text {
  font-size: 10px;
  fill: var(--ink-4);
  font-variant-numeric: tabular-nums;
}
.band {
  fill: var(--esr-accent);
  fill-opacity: 0.1;
  animation: fade-in 0.6s ease-out 0.3s both;
}
.series {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  stroke-dasharray: 1;
  animation: draw 0.9s var(--ease) both;
}
.series.opened,
.key.opened,
.crosshair .opened {
  stroke: var(--esr-accent);
}
.series.closed,
.key.closed,
.crosshair .closed {
  stroke: var(--green-dot);
}
.key {
  stroke-width: 2;
  stroke-linecap: round;
}
.end-labels text {
  font-size: 11px;
  fill: var(--ink-3);
}
.end-labels .value {
  font-weight: 800;
  fill: var(--ink);
}
.crosshair line {
  stroke: var(--ink-4);
  stroke-width: 1;
}
.crosshair circle {
  fill: var(--surface);
  stroke-width: 2;
}
.replay-cursor rect {
  fill: var(--surface);
  fill-opacity: 0.65;
}
.replay-cursor line {
  stroke: var(--esr-accent);
  stroke-width: 2;
}
.replay-cursor text {
  font-size: 10px;
  font-weight: 800;
  fill: var(--esr-accent-text);
}
.flow-tip {
  position: absolute;
  top: 0;
  z-index: 3;
  min-width: 150px;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 8px 24px #0f1a2a26;
  font-size: var(--fs-sm);
  color: var(--ink-3);
  pointer-events: none;
  transform: translateX(-50%);
}
.tip-date {
  margin-bottom: var(--sp-1);
  font-weight: 700;
  color: var(--ink-2);
}
.tip-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.tip-row strong {
  min-width: 2.5em;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.tip-key {
  width: 12px;
  height: 2px;
  border-radius: 1px;
  background: var(--ink-4);
}
.tip-key.opened {
  background: var(--esr-accent);
}
.tip-key.closed {
  background: var(--green-dot);
}
.tip-key.band {
  height: 8px;
  background: var(--esr-accent-soft);
}
.tip-note,
.tip-hint {
  margin-top: var(--sp-1);
  font-size: var(--fs-xs);
}
.tip-hint {
  color: var(--ink-4);
}
.flow-table {
  margin-top: var(--sp-2);
  font-size: var(--fs-sm);
}
.flow-table summary {
  cursor: pointer;
  color: var(--esr-accent-text);
}
.flow-table table {
  margin-top: var(--sp-2);
  width: 100%;
  max-width: 480px;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.flow-table th,
.flow-table td {
  padding: 3px var(--sp-2);
  border-bottom: 1px solid var(--line-soft);
  text-align: right;
}
.flow-table th:first-child,
.flow-table td:first-child {
  text-align: left;
}
@keyframes draw {
  from {
    stroke-dashoffset: 1;
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .series,
  .band {
    animation: none;
  }
}
</style>
