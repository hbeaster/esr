<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import HullOutline from "./HullOutline.vue";
import FleetReplay from "./FleetReplay.vue";
import EquipmentGlyph from "./EquipmentGlyph.vue";
import {
  agingThresholdsDays,
  date,
  equipmentClass,
  equipmentClassLabel,
  filterRecords,
  formatDuration,
  plainText,
  rankByCriticality,
  hullZone,
  hullZoneLabel,
  hullZones,
  statusAge,
  statusTone,
} from "../presentation";
import type { HullZone } from "../presentation";
import {
  FULL_VIEW,
  HULL_CENTER_Y,
  HULL_HEIGHT,
  HULL_TOP,
  contactCap,
  contactLayout,
  diveViewBox,
  zoneBands,
  zoneCenter,
} from "../hullGeometry";
import type { ViewBox } from "../hullGeometry";
import { useWorkspaceContext } from "../composables/workspaceContext";
const {
  state,
  query,
  status,
  scope,
  zone,
  zoneCounts,
  fleet,
  fleetNow,
  replayAt,
  activity,
  openRecord,
} = useWorkspaceContext();
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

// ---- Compartment dive: zoom into one zone and show its records as contacts ----
const DIVE_MS = 650;
const dive = ref<HullZone | null>(null);
/** True once the zoom has landed, so contacts appear after the camera stops. */
const landed = ref(false);
const view = ref<ViewBox>({ ...FULL_VIEW });
const viewBox = computed(
  () => `${view.value.x} ${view.value.y} ${view.value.w} ${view.value.h}`,
);
let tweenFrame = 0;
function tweenTo(target: ViewBox, done?: () => void) {
  cancelAnimationFrame(tweenFrame);
  if (reducedMotion) {
    view.value = { ...target };
    done?.();
    return;
  }
  const from = { ...view.value };
  const started = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - started) / DIVE_MS);
    const e = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
    const mix = (a: number, b: number) => a + (b - a) * e;
    view.value = {
      x: mix(from.x, target.x),
      y: mix(from.y, target.y),
      w: mix(from.w, target.w),
      h: mix(from.h, target.h),
    };
    if (p < 1) tweenFrame = requestAnimationFrame(step);
    else done?.();
  };
  tweenFrame = requestAnimationFrame(step);
}
function diveInto(z: HullZone) {
  dive.value = z;
  landed.value = false;
  if (zone.value !== z) zone.value = z;
  tweenTo(diveViewBox(z), () => (landed.value = true));
}
function surface() {
  if (!dive.value) return;
  dive.value = null;
  landed.value = false;
  if (zone.value) zone.value = "";
  tweenTo(FULL_VIEW);
}
function onBand(z: HullZone) {
  if (dive.value === z) surface();
  else diveInto(z);
}
// Keep the dive in step with the zone filter changed elsewhere.
watch(zone, (z) => {
  if (!dive.value) return;
  if (!z) surface();
  else if (z !== dive.value) diveInto(z);
});
const emit = defineEmits<{ "show-all": [] }>();
const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);
/**
 * The dived compartment's records, most critical first, capped so a boat with
 * thousands of ESRs stays readable. The rest fold into one overflow marker
 * that leads to the (already zone-filtered) table.
 */
const diveContacts = computed(() => {
  const z = dive.value;
  if (!z) return { contacts: [], overflow: null, total: 0 };
  const ranked = rankByCriticality(
    filterRecords(
      fleet.value,
      query.value,
      status.value,
      scope.value,
      state.user?.id,
    ).filter((r) => hullZone(r.location) === z),
    fleetNow.value,
  );
  const shown = ranked.slice(0, contactCap(z));
  const hidden = ranked.length - shown.length;
  const layout = contactLayout(
    [...shown.map((c) => c.record.id), ...(hidden ? ["overflow"] : [])],
    z,
  );
  const contacts = shown.map(({ record: r, age }, i) => {
    const kind = equipmentClass(r);
    const stale = age?.tone === "stale";
    const subsafe = r.attributes.includes("SUBSAFE");
    const serial = r.serial || "Unassigned request";
    const heading = r.title || plainText(r.condition);
    return {
      ...layout[i],
      record: r,
      kind,
      kindLabel: equipmentClassLabel(kind),
      serial,
      heading: heading.length > 90 ? `${heading.slice(0, 88)}…` : heading,
      status: r.status,
      tone: statusTone(r.status),
      age: age ? formatDuration(age.ms) : "",
      stale,
      subsafe,
      label: `Contact ${r.serial || "unassigned request"}: ${equipmentClassLabel(kind)}, ${r.status}${stale ? ", stale" : ""}${subsafe ? ", SUBSAFE" : ""}`,
    };
  });
  return {
    contacts,
    overflow: hidden
      ? {
          ...layout[layout.length - 1],
          count: hidden,
          text: `+${compact(hidden)}`,
        }
      : null,
    total: ranked.length,
  };
});
const contacts = computed(() => diveContacts.value.contacts);
type DiveContact = (typeof diveContacts.value.contacts)[number];

// ---- Contact tooltip: what a contact is, without opening it ----
interface Tip {
  x: number;
  y: number;
  below: boolean;
  contact: DiveContact | null;
}
const card = ref<HTMLElement | null>(null);
const tip = ref<Tip | null>(null);
function showTip(event: Event, contact: DiveContact | null) {
  const target = event.currentTarget as Element | null;
  if (!target || !card.value) return;
  const box = target.getBoundingClientRect();
  const frame = card.value.getBoundingClientRect();
  const top = box.top - frame.top;
  // Keep the tip inside the card, and drop it below contacts near the top.
  const x = Math.min(
    Math.max(box.left + box.width / 2 - frame.left, 140),
    frame.width - 140,
  );
  // Room for the tip (about 140px) above the contact, else drop it below.
  const below = top < 160;
  tip.value = { x, y: below ? box.bottom - frame.top : top, below, contact };
}
function hideTip() {
  tip.value = null;
}
watch(dive, hideTip);

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
/** The sweep's fading trail, about 14% of the visible width. */
const trailWidth = computed(() => view.value.w * 0.14);
/** Sweep the whole hull, or only the dived compartment. */
const sweepRange = (): [number, number] =>
  dive.value ? zoneBands[dive.value] : [zoneBands.forward[0], zoneBands.aft[1]];
const sweepX = ref<number | null>(null);
const gradientId = `esr-sonar-${useId()}`;
const reducedMotion =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
let frame = 0;
let pinged = new Set<HullZone>();
function sweep(stamp: number) {
  const phase = (stamp % SWEEP_PERIOD_MS) / SWEEP_MS;
  if (replayAt.value !== null || phase > 1 || (dive.value && !landed.value)) {
    sweepX.value = null;
    pinged = new Set();
  } else {
    const [from, to] = sweepRange();
    const x = from + phase * (to - from);
    sweepX.value = x;
    if (!dive.value)
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
  cancelAnimationFrame(tweenFrame);
  timers.forEach(clearTimeout);
  void audio?.close();
});
</script>

<template>
  <section
    ref="card"
    :class="[
      'card',
      'hull-heatmap',
      { replaying: replayAt !== null, diving: dive },
    ]"
    aria-labelledby="hull-heatmap-title"
    @keydown.esc="surface"
  >
    <div class="heatmap-head">
      <div class="heading-group">
        <h2 id="hull-heatmap-title">
          Where the work is<template v-if="dive">
            <span
              class="crumb"
              aria-hidden="true"
            >›</span>
            <strong class="dive-zone">{{ hullZoneLabel(dive) }}</strong>
            <span
              v-if="diveContacts.overflow"
              class="dive-count"
            >· {{ contacts.length }} most critical of
              {{ diveContacts.total.toLocaleString() }}</span>
            <span
              v-else
              class="dive-count"
            >· {{ contacts.length }}
              {{ contacts.length === 1 ? "contact" : "contacts" }}</span>
          </template>
        </h2>
        <span class="tag">Mock hull map · not to scale</span>
        <button
          v-if="dive"
          class="surface"
          @click="surface"
        >
          <span aria-hidden="true">▲</span> Surface
        </button>
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
      :viewBox="viewBox"
      :role="dive ? 'group' : 'img'"
      :aria-label="
        dive ? `${hullZoneLabel(dive)} compartment contacts` : undefined
      "
      :class="{ selecting: zone && !dive }"
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
      <HullOutline
        :active="zone || null"
        :bare="!!dive"
      >
        <rect
          v-for="z in hullZones"
          :key="z.id"
          :class="['heat', { selected: zone === z.id }]"
          :x="zoneBands[z.id][0]"
          :y="HULL_TOP"
          :width="zoneBands[z.id][1] - zoneBands[z.id][0]"
          :height="HULL_HEIGHT"
          :style="{ fillOpacity: dive ? 0.07 : shade(z.id) }"
          vector-effect="non-scaling-stroke"
          @click="onBand(z.id)"
        />
        <g
          v-if="sweepX !== null"
          class="sweep"
          aria-hidden="true"
        >
          <rect
            :x="sweepX - trailWidth"
            :y="HULL_TOP"
            :width="trailWidth"
            :height="HULL_HEIGHT"
            :fill="`url(#${gradientId})`"
          />
          <line
            vector-effect="non-scaling-stroke"
            :x1="sweepX"
            :x2="sweepX"
            :y1="HULL_TOP"
            :y2="HULL_TOP + HULL_HEIGHT"
          />
        </g>
        <template #overlay>
          <circle
            v-for="p in dive ? [] : pings"
            :key="p.id"
            :class="['ping', p.kind]"
            :cx="zoneCenter(p.zone)"
            :cy="HULL_CENTER_Y"
            r="10"
          />
          <template
            v-for="z in dive ? [] : hullZones"
            :key="z.id"
          >
            <text
              v-if="zoneCounts[z.id]"
              :class="['count', { selected: zone === z.id }]"
              :x="zoneCenter(z.id)"
              :y="HULL_CENTER_Y + 7"
              text-anchor="middle"
              @click="onBand(z.id)"
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
          <g
            v-if="dive && landed"
            class="contacts"
          >
            <g
              v-for="(c, i) in contacts"
              :key="c.id"
              :class="['contact', c.tone, { stale: c.stale, lit: sweepX !== null && c.x <= sweepX && sweepX - c.x < 24 }]"
              :transform="`translate(${c.x} ${c.y})`"
              role="button"
              tabindex="0"
              :aria-label="c.label"
              @click="openRecord(c.record)"
              @keydown.enter.prevent="openRecord(c.record)"
              @keydown.space.prevent="openRecord(c.record)"
              @mouseenter="showTip($event, c)"
              @mouseleave="hideTip"
              @focus="showTip($event, c)"
              @blur="hideTip"
            >
              <g
                class="contact-body"
                :style="{ '--i': i }"
              >
                <circle
                  v-if="c.stale"
                  class="stale-ring"
                  :r="c.r"
                  vector-effect="non-scaling-stroke"
                />
                <circle
                  class="disc"
                  :r="c.r"
                  vector-effect="non-scaling-stroke"
                />
                <g
                  class="glyph"
                  :transform="`scale(${(c.r * 0.68) / 32}) translate(-32 -32)`"
                >
                  <EquipmentGlyph :kind="c.kind" />
                </g>
              </g>
            </g>
            <g
              v-if="diveContacts.overflow"
              class="contact overflow"
              :transform="`translate(${diveContacts.overflow.x} ${diveContacts.overflow.y})`"
              role="button"
              tabindex="0"
              :aria-label="`Show all ${diveContacts.total} ${hullZoneLabel(dive!)} records in the table`"
              @click="emit('show-all')"
              @keydown.enter.prevent="emit('show-all')"
              @keydown.space.prevent="emit('show-all')"
              @mouseenter="showTip($event, null)"
              @mouseleave="hideTip"
              @focus="showTip($event, null)"
              @blur="hideTip"
            >
              <g
                class="contact-body"
                :style="{ '--i': contacts.length }"
              >
                <circle
                  class="disc"
                  :r="diveContacts.overflow.r"
                  vector-effect="non-scaling-stroke"
                />
                <text
                  text-anchor="middle"
                  :y="diveContacts.overflow.r * 0.3"
                  :style="{
                    fontSize: `${diveContacts.overflow.r * (diveContacts.overflow.text.length >= 5 ? 0.5 : diveContacts.overflow.text.length === 4 ? 0.62 : 0.8)}px`,
                  }"
                >
                  {{ diveContacts.overflow.text }}
                </text>
              </g>
            </g>
          </g>
        </template>
      </HullOutline>
    </svg>
    <div
      v-if="tip && dive"
      :class="['contact-tip', { below: tip.below }]"
      :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
      aria-hidden="true"
    >
      <template v-if="tip.contact">
        <div class="tip-head">
          <svg
            class="tip-icon"
            viewBox="0 0 64 64"
          >
            <EquipmentGlyph :kind="tip.contact.kind" />
          </svg>
          <strong>{{ tip.contact.kindLabel }}</strong>
          <span class="tip-serial">{{ tip.contact.serial }}</span>
        </div>
        <p class="tip-title">
          {{ tip.contact.heading }}
        </p>
        <div class="tip-meta">
          <span :class="['badge', tip.contact.tone]"><span class="status-dot" />{{ tip.contact.status }}</span>
          <span v-if="tip.contact.age">for {{ tip.contact.age }}</span>
          <span
            v-if="tip.contact.stale"
            class="tag critical"
          >Stale</span>
          <span
            v-if="tip.contact.subsafe"
            class="tag critical"
          >SUBSAFE</span>
        </div>
        <span class="tip-hint">Click to open</span>
      </template>
      <template v-else-if="diveContacts.overflow">
        <strong>{{ diveContacts.overflow.count.toLocaleString() }} more
          ESRs</strong>
        <p class="tip-title">
          Less critical than the ones shown.
        </p>
        <span class="tip-hint">Click to show them in the table</span>
      </template>
    </div>
    <p
      v-if="diveContacts.overflow"
      class="dive-note"
    >
      Showing the {{ contacts.length }} most critical: stale first, then aging,
      SUBSAFE, and longest in status.
      {{ diveContacts.overflow.count.toLocaleString() }} more in the table.
      <button
        class="text-button"
        @click="emit('show-all')"
      >
        Show all {{ diveContacts.total.toLocaleString() }}
      </button>
    </p>
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
  position: relative;
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
.crumb {
  margin: 0 var(--sp-2);
  color: var(--ink-4);
}
.dive-zone {
  color: var(--esr-accent-text);
}
.dive-count {
  margin-left: var(--sp-1);
  font-weight: 500;
  color: var(--ink-3);
}
.surface {
  padding: 3px 12px;
  border-radius: 999px;
  font-size: var(--fs-sm);
  border-color: var(--esr-accent);
  color: var(--esr-accent-text);
}
.diving svg {
  max-height: 360px;
}
.contact {
  cursor: pointer;
  outline: none;
}
.contact-body {
  transform-box: fill-box;
  transform-origin: center;
  animation: contact-in 0.35s var(--ease) both;
  animation-delay: calc(var(--i) * 30ms);
}
.disc {
  stroke-width: 1.5px;
  transition: filter 0.3s;
}
.glyph {
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.contact.gray {
  color: var(--gray-text);
}
.contact.gray .disc {
  fill: var(--gray-bg);
  stroke: var(--gray-dot);
}
.contact.blue {
  color: var(--blue-text);
}
.contact.blue .disc {
  fill: var(--blue-bg);
  stroke: var(--blue-dot);
}
.contact.amber {
  color: var(--amber-text);
}
.contact.amber .disc {
  fill: var(--amber-bg);
  stroke: var(--amber-dot);
}
.contact.green {
  color: var(--green-text);
}
.contact.green .disc {
  fill: var(--green-bg);
  stroke: var(--green-dot);
}
.contact.lit .disc {
  filter: drop-shadow(0 0 2px var(--green-dot));
}
.contact:hover .disc,
.contact:focus-visible .disc {
  stroke: var(--esr-accent);
  stroke-width: 3px;
}
.contact.overflow {
  color: var(--ink-2);
}
.contact.overflow .disc {
  fill: var(--surface);
  stroke: var(--ink-4);
  stroke-dasharray: 3 2;
}
.contact.overflow text {
  fill: currentColor;
  font-weight: 800;
}
.dive-note {
  margin: var(--sp-2) auto 0;
  max-width: 760px;
  font-size: var(--fs-sm);
  color: var(--ink-3);
  text-align: center;
}
.dive-note .text-button {
  padding: 0 var(--sp-1);
  font-size: var(--fs-sm);
}
.contact-tip {
  position: absolute;
  z-index: 10;
  width: max-content;
  max-width: 260px;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 8px 24px #0f1a2a26;
  font-size: var(--fs-sm);
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 10px));
  animation: tip-in 0.12s ease-out;
}
.contact-tip.below {
  transform: translate(-50%, 10px);
}
.tip-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
/* Outranks the ".hull-heatmap svg" sizing for the hull itself. */
.contact-tip svg.tip-icon {
  width: 22px;
  height: 22px;
  max-width: none;
  margin: 0;
  flex: none;
  fill: none;
  stroke: var(--esr-accent-text);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tip-serial {
  margin-left: auto;
  font-weight: 700;
  color: var(--esr-accent-text);
}
.tip-title {
  margin: var(--sp-1) 0;
  color: var(--ink-2);
  white-space: normal;
}
.tip-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1) var(--sp-2);
  color: var(--ink-3);
  font-size: var(--fs-xs);
}
.tip-hint {
  display: block;
  margin-top: var(--sp-1);
  font-size: var(--fs-xs);
  color: var(--ink-4);
}
@keyframes tip-in {
  from {
    opacity: 0;
  }
}
.stale-ring {
  fill: none;
  stroke: var(--red-solid);
  stroke-width: 2px;
  transform-box: fill-box;
  transform-origin: center;
  animation: stale-ring 1.6s ease-out infinite;
}
@keyframes contact-in {
  from {
    opacity: 0;
    transform: scale(0.2);
  }
}
@keyframes stale-ring {
  0% {
    opacity: 0.9;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.9);
  }
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
  stroke-width: 5px;
}
.diving .heat.selected {
  stroke-width: 2px;
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
  .contact-body,
  .stale-ring {
    animation: none;
  }
}
</style>
