<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import HullHeatmap from "./HullHeatmap.vue";
import FleetReplay from "./FleetReplay.vue";
import CountUp from "./CountUp.vue";
import EquipmentGlyph from "./EquipmentGlyph.vue";
import PresenceStack from "./PresenceStack.vue";
import {
  agingThresholdsDays,
  date,
  equipmentClass,
  equipmentClassLabel,
  formatDuration,
  describeLocation,
  parseLocation,
  liveVerb,
  plainText,
  rankByCriticality,
  statusAge,
  statusTone,
  stepOf,
  steps,
} from "../presentation";
import { useNow } from "../composables/useNow";
import { useWorkspaceContext } from "../composables/workspaceContext";
const {
  state,
  counts,
  fleet,
  fleetNow,
  activity,
  replayAt,
  watchFloor,
  openRecord,
  liveStatus,
  viewers,
  lastChange,
} = useWorkspaceContext();

// ---- Live pushes: a toast for each change as it is committed anywhere ----
interface Toast {
  key: number;
  text: string;
  tone: string;
}
const toasts = ref<Toast[]>([]);
let toastKey = 0;
const toastTimers = new Set<ReturnType<typeof setTimeout>>();
watch(lastChange, (change) => {
  if (!change) return;
  const toast = {
    key: ++toastKey,
    text: `${change.actor} ${liveVerb(change.action)} ${change.serial || "a new request"}`,
    tone: change.deleted ? "gray" : statusTone(change.status),
  };
  toasts.value = [toast, ...toasts.value].slice(0, 3);
  const timer = setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.key !== toast.key);
    toastTimers.delete(timer);
  }, 6000);
  toastTimers.add(timer);
});

const root = ref<HTMLElement | null>(null);
const replay = ref<InstanceType<typeof FleetReplay> | null>(null);
const clock = useNow(1000);
const clockText = computed(() =>
  new Date(clock.value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }),
);
const reducedMotion =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---- Stat tiles (follow the replay like the list page) ----
const staleCounts = computed(() => {
  const result: Record<string, number> = {};
  for (const r of fleet.value)
    if (statusAge(r, fleetNow.value)?.tone === "stale")
      result[stepOf(r.status)] = (result[stepOf(r.status)] || 0) + 1;
  return result;
});

// ---- Spotlight: the most critical live ESRs, one at a time ----
const SPOTLIGHT_MS = 8000;
const SPOTLIGHT_SIZE = 5;
const spotlightPool = computed(() =>
  rankByCriticality(state.records, clock.value)
    .filter((c) => c.age)
    .slice(0, SPOTLIGHT_SIZE),
);
const spotlightIndex = ref(0);
const spotlight = computed(() => {
  const pool = spotlightPool.value;
  if (!pool.length) return null;
  const { record, age } = pool[spotlightIndex.value % pool.length];
  const kind = equipmentClass(record);
  const loc = parseLocation(record.location);
  const limits = agingThresholdsDays[record.status];
  return {
    record,
    kind,
    kindLabel: equipmentClassLabel(kind),
    title: record.title || plainText(record.condition),
    tone: statusTone(record.status),
    age: age ? formatDuration(age.ms) : "",
    stale: age?.tone === "stale",
    limit: limits ? `stale after ${limits[1]} days` : "",
    place: record.location
      ? loc
        ? describeLocation(loc)
        : record.location
      : "Location not provided",
    subsafe: record.attributes.includes("SUBSAFE"),
  };
});
const spotlightTimer = setInterval(
  () => (spotlightIndex.value += 1),
  SPOTLIGHT_MS,
);
function open(id: string) {
  const record = state.records.find((r) => r.id === id);
  if (!record) return;
  close();
  openRecord(record);
}

// ---- Ticker: latest activity, live or at the replay position ----
const ticker = computed(() => {
  const until = replayAt.value ?? clock.value;
  return activity.value
    .filter((e) => Date.parse(e.time) <= until)
    .slice(-12)
    .reverse();
});

// ---- Attract mode: replay history on a loop while the floor is idle ----
const IDLE_BEFORE_REPLAY_MS = 45_000;
const FIRST_REPLAY_MS = 12_000;
const autoReplay = ref(true);
let attractTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleReplay(delay = IDLE_BEFORE_REPLAY_MS) {
  clearTimeout(attractTimer);
  if (!autoReplay.value || reducedMotion) return;
  attractTimer = setTimeout(() => {
    if (replayAt.value === null) replay.value?.play();
  }, delay);
}
watch(replayAt, (now, before) => {
  if (now === null && before !== null) scheduleReplay();
});
watch(autoReplay, (on) =>
  on ? scheduleReplay(FIRST_REPLAY_MS) : clearTimeout(attractTimer),
);

// ---- Fullscreen, focus, and exit ----
let returnFocus: HTMLElement | null = null;
let wasFullscreen = false;
function close() {
  watchFloor.value = false;
}
function onFullscreenChange() {
  if (document.fullscreenElement) wasFullscreen = true;
  // Leaving fullscreen (Esc in most browsers) also leaves the watch floor.
  else if (wasFullscreen) close();
}
onMounted(() => {
  const active =
    document.activeElement?.shadowRoot?.activeElement ||
    document.activeElement;
  returnFocus = active instanceof HTMLElement ? active : null;
  root.value?.focus();
  document.addEventListener("fullscreenchange", onFullscreenChange);
  root.value?.requestFullscreen?.().catch(() => {
    // Fullscreen can be refused (iframes, settings); the overlay still fills the page.
  });
  scheduleReplay(FIRST_REPLAY_MS);
});
onBeforeUnmount(() => {
  toastTimers.forEach(clearTimeout);
  clearInterval(spotlightTimer);
  clearTimeout(attractTimer);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  if (document.fullscreenElement) void document.exitFullscreen?.();
  returnFocus?.focus();
});
</script>

<template>
  <div
    ref="root"
    class="watch-floor"
    role="dialog"
    aria-modal="true"
    aria-label="ESR watch floor"
    tabindex="-1"
    @keydown.esc="close"
  >
    <header class="wf-bar">
      <div class="wf-brand">
        <span
          :class="['wf-live', { off: liveStatus !== 'live' }]"
          aria-hidden="true"
        />
        <strong>ESR Watch Floor</strong>
        <span class="wf-site">TRF {{ state.user?.site }}</span>
        <span
          :class="['wf-link', liveStatus]"
          :title="
            liveStatus === 'live'
              ? 'Changes appear here as they are committed'
              : 'Live updates are not available; showing the last load'
          "
        >{{ liveStatus === "live" ? "Live" : "Not live" }}</span>
        <PresenceStack
          :viewers="viewers"
          :max="5"
          label="Online now"
        />
        <span
          v-if="replayAt !== null"
          class="wf-mode"
        >Replay · {{ date(new Date(replayAt).toISOString()) }}</span>
      </div>
      <time
        class="wf-clock"
        aria-label="Local time"
      >{{ clockText }}</time>
      <div class="wf-controls">
        <FleetReplay ref="replay" />
        <label class="wf-toggle">
          <input
            v-model="autoReplay"
            type="checkbox"
          >
          Auto replay
        </label>
        <button
          class="wf-exit"
          @click="close"
        >
          Exit <kbd>Esc</kbd>
        </button>
      </div>
    </header>

    <TransitionGroup
      tag="ol"
      name="toast"
      class="wf-toasts"
      aria-live="polite"
      aria-label="Live changes"
    >
      <li
        v-for="t in toasts"
        :key="t.key"
        :class="['wf-toast', t.tone]"
      >
        <span
          class="wf-bolt"
          aria-hidden="true"
        >⚡</span>{{ t.text }}
      </li>
    </TransitionGroup>
    <section
      class="wf-stats"
      aria-label="Workflow counts"
    >
      <div
        v-for="step in steps"
        :key="step"
        :class="['wf-stat', statusTone(step)]"
      >
        <span class="wf-stat-label">{{ step }}</span>
        <strong><CountUp :value="counts[step]" /></strong>
        <span
          v-if="staleCounts[step]"
          class="wf-stale"
        ><CountUp :value="staleCounts[step]" /> stale</span>
        <span
          v-else
          class="wf-stale ok"
        >None stale</span>
      </div>
    </section>

    <div class="wf-main">
      <HullHeatmap
        class="wf-hull"
        variant="wallboard"
      />
      <article
        class="wf-spotlight"
        aria-live="off"
      >
        <header>
          <span>Most critical</span>
          <span v-if="spotlightPool.length">{{ (spotlightIndex % spotlightPool.length) + 1 }} of
            {{ spotlightPool.length }}</span>
        </header>
        <template v-if="spotlight">
          <div
            :key="`${spotlightIndex}-${spotlight.record.id}`"
            class="wf-card"
          >
            <div class="wf-card-head">
              <svg
                class="wf-glyph"
                viewBox="0 0 64 64"
                aria-hidden="true"
              >
                <EquipmentGlyph :kind="spotlight.kind" />
              </svg>
              <div>
                <div class="wf-serial">
                  {{ spotlight.record.serial || "Unassigned request" }}
                </div>
                <div class="wf-kind">
                  {{ spotlight.kindLabel }}
                </div>
              </div>
            </div>
            <p class="wf-title">
              {{ spotlight.title }}
            </p>
            <div class="wf-tags">
              <span :class="['badge', spotlight.tone]"><span class="status-dot" />{{
                spotlight.record.status
              }}</span>
              <span
                v-if="spotlight.stale"
                class="tag critical"
              >Stale</span>
              <span
                v-if="spotlight.subsafe"
                class="tag critical"
              >SUBSAFE</span>
            </div>
            <p class="wf-age">
              <strong>{{ spotlight.age }}</strong> in status<template v-if="spotlight.limit">
                · {{ spotlight.limit }}
              </template>
            </p>
            <p class="wf-place">
              {{ spotlight.place }}
            </p>
            <button
              class="wf-open"
              @click="open(spotlight.record.id)"
            >
              Open record →
            </button>
            <div
              class="wf-progress"
              aria-hidden="true"
            >
              <span :style="{ animationDuration: `${SPOTLIGHT_MS}ms` }" />
            </div>
          </div>
        </template>
        <p
          v-else
          class="wf-empty"
        >
          Nothing is aging right now.
        </p>
      </article>
    </div>

    <footer
      class="wf-ticker"
      aria-label="Latest activity"
    >
      <span class="wf-ticker-label">{{
        replayAt === null ? "Live" : "Replay"
      }}</span>
      <div class="wf-ticker-track">
        <div
          v-if="ticker.length"
          class="wf-ticker-run"
          :style="{ animationDuration: `${Math.max(ticker.length, 4) * 6}s` }"
        >
          <span
            v-for="copy in [0, 1]"
            :key="copy"
            :aria-hidden="copy === 1"
          >
            <span
              v-for="e in ticker"
              :key="e.id"
              class="wf-event"
            ><time>{{ date(e.time) }}</time> {{ e.text }}</span>
          </span>
        </div>
        <span
          v-else
          class="wf-event"
        >No activity yet.</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.watch-floor {
  /* An "ops floor" palette; the shared components read these tokens. */
  --esr-bg: #07111c;
  --surface: #0d1b2a;
  --surface-2: #10243a;
  --ink: #e7f1fa;
  --ink-2: #c4d4e3;
  --ink-3: #8fa6bb;
  --ink-4: #5f7a92;
  --line: #1e3a54;
  --line-soft: #16304a;
  --esr-accent: #3d8bff;
  --esr-accent-hover: #5d9dff;
  --esr-accent-soft: #12345e;
  --esr-accent-text: #8cc0ff;
  --gray-text: #b5c3d1;
  --gray-bg: #1a2836;
  --gray-line: #2b3d4f;
  --gray-dot: #7f93a7;
  --blue-text: #9cc3ff;
  --blue-bg: #112d55;
  --blue-line: #24508f;
  --blue-dot: #4a90ff;
  --amber-text: #ffcd75;
  --amber-bg: #3a2a0c;
  --amber-line: #6b4d14;
  --amber-dot: #f0a92a;
  --green-text: #7fe0b0;
  --green-bg: #0d3324;
  --green-line: #1d6145;
  --green-dot: #2fd28a;
  --red-text: #ff9a92;
  --red-bg: #3d1414;
  --red-line: #6d2323;
  --red-solid: #e5484d;
  color-scheme: dark;

  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: var(--sp-4);
  padding: var(--sp-5) var(--sp-6);
  overflow: auto;
  color: var(--ink);
  background:
    radial-gradient(ellipse at 50% 35%, #12304d 0%, transparent 60%),
    var(--esr-bg);
  outline: none;
}
.wf-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-4);
}
.wf-brand {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: var(--fs-md);
}
.wf-live {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--green-dot);
  box-shadow: 0 0 0 0 var(--green-dot);
  animation: live 2s ease-out infinite;
}
.wf-site {
  color: var(--ink-3);
}
.wf-live.off {
  background: var(--ink-4);
  animation: none;
}
.wf-link {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: var(--fs-xs);
  font-weight: 800;
  background: var(--green-bg);
  color: var(--green-text);
}
.wf-link:not(.live) {
  background: var(--gray-bg);
  color: var(--gray-text);
}
.wf-toasts {
  position: fixed;
  top: 84px;
  right: var(--sp-6);
  z-index: 2;
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
  pointer-events: none;
}
.wf-toast {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  max-width: 420px;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--line);
  border-left: 4px solid var(--gray-dot);
  border-radius: var(--radius);
  background: var(--surface-2);
  box-shadow: 0 12px 32px #0008;
  font-size: var(--fs-md);
  font-weight: 700;
}
.wf-toast.blue {
  border-left-color: var(--blue-dot);
}
.wf-toast.amber {
  border-left-color: var(--amber-dot);
}
.wf-toast.green {
  border-left-color: var(--green-dot);
}
.wf-bolt {
  color: var(--amber-dot);
}
.toast-enter-active,
.toast-leave-active {
  transition:
    transform 0.35s var(--ease),
    opacity 0.35s;
}
.toast-enter-from {
  transform: translateX(40px);
  opacity: 0;
}
.toast-leave-to {
  opacity: 0;
}
.wf-mode {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--esr-accent-soft);
  color: var(--esr-accent-text);
  font-size: var(--fs-sm);
  letter-spacing: 0.06em;
}
.wf-clock {
  flex: none;
  font-size: clamp(22px, 2.6vw, 40px);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
}
.wf-controls {
  flex: none;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--sp-3);
}
.wf-controls button,
.wf-open {
  background: var(--surface-2);
  border-color: var(--line);
  color: var(--ink);
}
.wf-toggle {
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-sm);
  color: var(--ink-3);
}
.wf-exit kbd {
  margin-left: var(--sp-1);
  padding: 0 5px;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: var(--fs-xs);
  color: var(--ink-3);
}
.wf-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--sp-3);
}
.wf-stat {
  display: grid;
  gap: 2px;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--line);
  border-top: 4px solid var(--gray-dot);
  border-radius: var(--radius);
  background: #0d1b2acc;
}
.wf-stat.blue {
  border-top-color: var(--blue-dot);
}
.wf-stat.amber {
  border-top-color: var(--amber-dot);
}
.wf-stat.green {
  border-top-color: var(--green-dot);
}
.wf-stat-label {
  font-size: var(--fs-sm);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.wf-stat strong {
  font-size: clamp(36px, 5vw, 84px);
  line-height: 1;
}
.wf-stale {
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--red-text);
}
.wf-stale.ok {
  font-weight: 500;
  color: var(--ink-4);
}
.wf-main {
  display: grid;
  grid-template-columns: minmax(0, 2.2fr) minmax(280px, 1fr);
  gap: var(--sp-4);
  align-items: center;
  min-height: 0;
}
.wf-spotlight {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  padding: var(--sp-4) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: #0d1b2acc;
}
.wf-spotlight > header {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-sm);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--red-text);
}
.wf-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
  flex: 1;
  animation: card-in 0.5s var(--ease);
}
.wf-card-head {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}
.wf-glyph {
  width: 72px;
  height: 72px;
  padding: var(--sp-2);
  flex: none;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  fill: none;
  stroke: var(--esr-accent-text);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.wf-serial {
  font-size: clamp(24px, 2.4vw, 38px);
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--esr-accent-text);
}
.wf-kind {
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: var(--fs-sm);
}
.wf-title {
  margin: 0;
  font-size: clamp(15px, 1.3vw, 20px);
  font-weight: 700;
}
.wf-tags {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.wf-age,
.wf-place {
  margin: 0;
  color: var(--ink-2);
}
.wf-age strong {
  font-size: 1.4em;
  color: var(--red-text);
}
.wf-place {
  color: var(--ink-3);
}
.wf-open {
  align-self: flex-start;
  margin-top: auto;
}
.wf-progress {
  height: 3px;
  margin-top: var(--sp-3);
  border-radius: 2px;
  background: var(--line-soft);
  overflow: hidden;
}
.wf-progress span {
  display: block;
  height: 100%;
  background: var(--red-solid);
  transform-origin: left;
  animation: progress linear both;
}
.wf-empty {
  margin: auto;
  color: var(--ink-3);
}
.wf-ticker {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: #0d1b2acc;
  font-size: var(--fs-md);
}
.wf-ticker-label {
  flex: none;
  padding: 2px 10px;
  border-radius: 4px;
  background: var(--red-solid);
  color: #fff;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: var(--fs-xs);
}
.wf-ticker-track {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
}
.wf-ticker-run {
  display: inline-flex;
  animation: marquee linear infinite;
}
.wf-event {
  margin-right: var(--sp-8);
  color: var(--ink-2);
}
.wf-event time {
  margin-right: var(--sp-2);
  font-weight: 700;
  color: var(--esr-accent-text);
}
@keyframes live {
  70% {
    box-shadow: 0 0 0 8px transparent;
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}
@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@keyframes progress {
  from {
    transform: scaleX(0);
  }
}
@keyframes marquee {
  to {
    transform: translateX(-50%);
  }
}
/* Narrow or short screens: stack the sections and let the floor scroll. */
@media (max-width: 1100px), (max-height: 700px) {
  .watch-floor {
    grid-template-rows: none;
    grid-auto-rows: max-content;
    align-content: start;
  }
  .wf-main {
    min-height: auto;
  }
}
@media (max-width: 1100px) {
  .wf-main {
    grid-template-columns: 1fr;
  }
  .wf-bar,
  .wf-controls {
    flex-wrap: wrap;
  }
  .wf-controls {
    flex: 1 1 100%;
    min-width: 0;
    justify-content: flex-start;
  }
}
@media (max-width: 700px) {
  .watch-floor {
    padding: var(--sp-3);
  }
  .wf-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .wf-live,
  .wf-card,
  .wf-progress span,
  .wf-ticker-run {
    animation: none;
  }
  .wf-ticker-run > span:last-child {
    display: none;
  }
}
</style>
