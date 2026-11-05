<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import HullOutline from "./HullOutline.vue";
import FleetReplay from "./FleetReplay.vue";
import {
  agingThresholdsDays,
  date,
  hullZone,
  hullZones,
  statusAge,
} from "../presentation";
import type { HullZone } from "../presentation";
import {
  HULL_CENTER_Y,
  HULL_HEIGHT,
  HULL_TOP,
  HULL_VIEWBOX,
  zoneBands,
  zoneCenter,
} from "../hullGeometry";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { zone, zoneCounts, fleet, fleetNow, replayAt, activity } =
  useWorkspaceContext();
const max = computed(() =>
  Math.max(1, ...hullZones.map((z) => zoneCounts.value[z.id])),
);
const shade = (id: HullZone) => {
  const count = zoneCounts.value[id];
  return count ? 0.1 + (0.6 * count) / max.value : 0;
};
const title = computed(
  () =>
    `Mock fleet hull heatmap: ${hullZones
      .map((z) => `${z.label} ${zoneCounts.value[z.id]}`)
      .join(", ")}; ${zoneCounts.value.unlocated} without a location`,
);
/** Stale limits for the legend, e.g. "Unassigned 7 days · In Process 30 days". */
const staleLimits = Object.entries(agingThresholdsDays)
  .map(([status, [, stale]]) => `${status} ${stale} days`)
  .join(" · ");
function toggle(id: HullZone) {
  zone.value = zone.value === id ? "" : id;
}

/** Serials of stale records per zone, at the fleet time. */
const staleByZone = computed(() => {
  const result: Partial<Record<HullZone, string[]>> = {};
  for (const r of fleet.value) {
    const z = hullZone(r.location);
    if (z && statusAge(r, fleetNow.value)?.tone === "stale")
      (result[z] ??= []).push(r.serial || "unassigned request");
  }
  return result;
});
const staleTitle = (id: HullZone) => {
  const serials = staleByZone.value[id] ?? [];
  const shown = serials.slice(0, 6).join(", ");
  return `${hullZones.find((z) => z.id === id)!.label}: ${serials.length} stale (past the time limit for their status) — ${shown}${serials.length > 6 ? ", …" : ""}`;
};

// ---- Pings: sonar contacts (stale) and replay events ----
interface Ping {
  id: number;
  zone: HullZone;
  kind: "stale" | "event";
}
const pings = ref<Ping[]>([]);
let pingId = 0;
const timers = new Set<ReturnType<typeof setTimeout>>();
function addPing(z: HullZone, kind: Ping["kind"]) {
  if (pings.value.length > 24) return;
  const ping = { id: ++pingId, zone: z, kind };
  pings.value = [...pings.value, ping];
  const timer = setTimeout(() => {
    pings.value = pings.value.filter((p) => p.id !== ping.id);
    timers.delete(timer);
  }, 1100);
  timers.add(timer);
}

// ---- Sonar sweep (live view only, skipped for reduced motion) ----
const SWEEP_PERIOD_MS = 6000;
const SWEEP_MS = 2600;
const SWEEP_START = zoneBands.forward[0];
const SWEEP_END = zoneBands.aft[1];
const sweepX = ref<number | null>(null);
const gradientId = `esr-sonar-${useId()}`;
const reducedMotion =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
let frame = 0;
let pinged = new Set<HullZone>();
function sweep(stamp: number) {
  const phase = (stamp % SWEEP_PERIOD_MS) / SWEEP_MS;
  if (replayAt.value !== null || phase > 1) {
    sweepX.value = null;
    pinged = new Set();
  } else {
    const x = SWEEP_START + phase * (SWEEP_END - SWEEP_START);
    sweepX.value = x;
    for (const z of hullZones)
      if (!pinged.has(z.id) && x >= zoneCenter(z.id) && staleByZone.value[z.id]) {
        pinged.add(z.id);
        addPing(z.id, "stale");
        sonarSound();
      }
  }
  frame = requestAnimationFrame(sweep);
}
onMounted(() => {
  if (!reducedMotion) frame = requestAnimationFrame(sweep);
});

// ---- Optional sonar sound (off until the viewer turns it on) ----
const soundOn = ref(false);
let audio: AudioContext | null = null;
function toggleSound() {
  soundOn.value = !soundOn.value;
  if (soundOn.value && !audio && typeof AudioContext !== "undefined")
    audio = new AudioContext();
}
function sonarSound() {
  if (!soundOn.value || !audio) return;
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1320, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.7);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + 0.95);
}

// ---- Replay: ping zones as events happen, and a running ticker ----
watch(replayAt, (now, before) => {
  if (now === null || before === null || now <= before) return;
  for (const e of activity.value) {
    const t = Date.parse(e.time);
    if (t <= before) continue;
    if (t > now) break;
    const z = hullZone(e.location);
    if (z) addPing(z, "event");
  }
});
const ticker = computed(() => {
  const t = replayAt.value;
  if (t === null) return [];
  const seen = activity.value.filter((e) => Date.parse(e.time) <= t);
  return seen.slice(-3).reverse();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  timers.forEach(clearTimeout);
  void audio?.close();
});
</script>

<template>
  <section
    :class="['card', 'hull-heatmap', { replaying: replayAt !== null }]"
    aria-labelledby="hull-heatmap-title"
  >
    <div class="heatmap-head">
      <div class="heading-group">
        <h2 id="hull-heatmap-title">
          Where the work is
        </h2>
        <span class="tag">Mock hull map · not to scale</span>
      </div>
      <div class="head-controls">
        <FleetReplay />
        <button
          class="sound-toggle"
          :aria-pressed="soundOn"
          :title="soundOn ? 'Mute sonar' : 'Sonar sound'"
          :aria-label="soundOn ? 'Mute sonar sound' : 'Turn on sonar sound'"
          @click="toggleSound"
        >
          {{ soundOn ? "🔊" : "🔈" }}
        </button>
      </div>
    </div>
    <svg
      :viewBox="HULL_VIEWBOX"
      role="img"
      :class="{ selecting: zone }"
    >
      <title>{{ title }}</title>
      <defs>
        <linearGradient
          :id="gradientId"
          x1="0"
          x2="1"
          y1="0"
          y2="0"
        >
          <stop
            offset="0"
            stop-color="var(--green-dot)"
            stop-opacity="0"
          />
          <stop
            offset="1"
            stop-color="var(--green-dot)"
            stop-opacity="0.35"
          />
        </linearGradient>
      </defs>
      <HullOutline :active="zone || null">
        <rect
          v-for="z in hullZones"
          :key="z.id"
          :class="['heat', { selected: zone === z.id }]"
          :x="zoneBands[z.id][0]"
          :y="HULL_TOP"
          :width="zoneBands[z.id][1] - zoneBands[z.id][0]"
          :height="HULL_HEIGHT"
          :style="{ fillOpacity: shade(z.id) }"
          @click="toggle(z.id)"
        />
        <g
          v-if="sweepX !== null"
          class="sweep"
          aria-hidden="true"
        >
          <rect
            :x="sweepX - 90"
            :y="HULL_TOP"
            width="90"
            :height="HULL_HEIGHT"
            :fill="`url(#${gradientId})`"
          />
          <line
            :x1="sweepX"
            :x2="sweepX"
            :y1="HULL_TOP"
            :y2="HULL_TOP + HULL_HEIGHT"
          />
        </g>
        <template #overlay>
          <circle
            v-for="p in pings"
            :key="p.id"
            :class="['ping', p.kind]"
            :cx="zoneCenter(p.zone)"
            :cy="HULL_CENTER_Y"
            r="10"
          />
          <template
            v-for="z in hullZones"
            :key="z.id"
          >
            <text
              v-if="zoneCounts[z.id]"
              :class="['count', { selected: zone === z.id }]"
              :x="zoneCenter(z.id)"
              :y="HULL_CENTER_Y + 7"
              text-anchor="middle"
              @click="toggle(z.id)"
            >
              {{ zoneCounts[z.id] }}
            </text>
            <g
              v-if="staleByZone[z.id]"
              class="stale-marker"
              :transform="`translate(${zoneBands[z.id][1] - (z.id === 'aft' ? 36 : 14)} ${HULL_TOP + 12})`"
            >
              <title>{{ staleTitle(z.id) }}</title>
              <circle r="9" />
              <text
                y="4"
                text-anchor="middle"
              >{{ staleByZone[z.id]!.length }}</text>
            </g>
          </template>
        </template>
      </HullOutline>
    </svg>
    <TransitionGroup
      v-if="replayAt !== null"
      tag="ol"
      name="tick"
      class="ticker"
      aria-label="Replay activity"
    >
      <li
        v-for="e in ticker"
        :key="e.id"
      >
        <time>{{ date(e.time) }}</time> {{ e.text }}
      </li>
      <li
        v-if="!ticker.length"
        key="empty"
        class="muted"
      >
        Waiting for the first request…
      </li>
    </TransitionGroup>
    <div
      class="zone-chips"
      role="group"
      aria-label="Filter by hull zone"
    >
      <button
        v-for="z in hullZones"
        :key="z.id"
        :class="['zone-chip', { selected: zone === z.id }]"
        :aria-pressed="zone === z.id"
        :disabled="!zoneCounts[z.id] && zone !== z.id"
        @click="toggle(z.id)"
      >
        {{ z.label }} <strong>{{ zoneCounts[z.id] }}</strong>
      </button>
      <span class="unlocated">No location
        <strong>{{ zoneCounts.unlocated }}</strong></span>
    </div>
    <p
      class="legend"
      :title="`Stale after: ${staleLimits}`"
    >
      <span
        class="legend-badge"
        aria-hidden="true"
      >3</span>
      <span><strong>Stale records</strong> in that compartment, past the time limit
        for their status. Stale after: {{ staleLimits }}.</span>
    </p>
  </section>
</template>

<style scoped>
.hull-heatmap {
  padding: var(--sp-4) var(--sp-5);
  margin-bottom: var(--sp-5);
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
}
.hull-heatmap.replaying {
  border-color: var(--esr-accent);
  box-shadow: 0 0 0 3px var(--esr-accent-soft);
}
.heatmap-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.heading-group,
.head-controls {
  display: flex;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
  flex-wrap: wrap;
}
.heatmap-head h2 {
  margin: 0;
  font-size: var(--fs-md);
}
.sound-toggle {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 50%;
  font-size: 13px;
}
.sound-toggle[aria-pressed="true"] {
  border-color: var(--esr-accent);
  background: var(--esr-accent-soft);
}
.hull-heatmap svg {
  display: block;
  width: 100%;
  max-width: 760px;
  height: auto;
  margin: 0 auto;
  overflow: visible;
}
.heat {
  fill: var(--esr-accent);
  cursor: pointer;
  transition:
    fill-opacity 0.4s var(--ease),
    opacity 0.2s;
}
.replaying .heat {
  transition: fill-opacity 0.15s linear;
}
.selecting .heat:not(.selected) {
  opacity: 0.45;
}
.heat.selected {
  stroke: var(--esr-accent);
  stroke-width: 5;
}
.sweep line {
  stroke: var(--green-dot);
  stroke-width: 2;
}
.sweep {
  pointer-events: none;
}
.count {
  font-size: 22px;
  font-weight: 800;
  fill: var(--esr-accent-text);
  paint-order: stroke;
  stroke: var(--surface);
  stroke-width: 4px;
  stroke-linejoin: round;
  cursor: pointer;
}
.selecting .count:not(.selected) {
  opacity: 0.5;
}
.stale-marker circle {
  fill: var(--red-solid);
  stroke: var(--surface);
  stroke-width: 2;
}
.stale-marker text {
  font-size: 11px;
  font-weight: 800;
  fill: #fff;
}
.ping {
  fill: none;
  stroke-width: 2;
  pointer-events: none;
  transform-box: fill-box;
  transform-origin: center;
  animation: ping 1.1s ease-out forwards;
}
.ping.stale {
  stroke: var(--red-solid);
}
.ping.event {
  stroke: var(--esr-accent);
}
.ticker {
  list-style: none;
  margin: var(--sp-2) auto 0;
  padding: 0;
  max-width: 760px;
  min-height: 3.9em;
  font-size: var(--fs-sm);
  color: var(--ink-2);
}
.ticker li {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ticker li:not(:first-child) {
  opacity: 0.55;
}
.ticker time {
  display: inline-block;
  min-width: 96px;
  font-weight: 700;
  color: var(--esr-accent-text);
  font-variant-numeric: tabular-nums;
}
.tick-enter-active {
  transition:
    transform 0.25s var(--ease),
    opacity 0.25s;
}
.tick-enter-from {
  transform: translateY(-8px);
  opacity: 0;
}
.tick-leave-active {
  display: none;
}
.zone-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: center;
  justify-content: center;
  margin-top: var(--sp-2);
  font-size: var(--fs-sm);
}
.zone-chip {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: var(--fs-sm);
}
.zone-chip.selected {
  background: var(--esr-accent-soft);
  border-color: var(--esr-accent);
  color: var(--esr-accent-text);
}
.unlocated {
  color: var(--ink-3);
  padding: 0 var(--sp-2);
}
.legend {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: var(--sp-2);
  margin: var(--sp-2) auto 0;
  max-width: 760px;
  font-size: var(--fs-xs);
  color: var(--ink-3);
  text-align: left;
}
.legend strong {
  color: var(--ink-2);
}
.legend-badge {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--red-solid);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
}
@keyframes ping {
  0% {
    opacity: 0.9;
    transform: scale(0.6);
  }
  100% {
    opacity: 0;
    transform: scale(4);
  }
}
@media (prefers-reduced-motion: reduce) {
  .heat,
  .tick-enter-active {
    transition: none;
  }
  .ping {
    display: none;
  }
}
</style>
