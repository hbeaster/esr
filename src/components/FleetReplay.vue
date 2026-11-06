<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  date,
  replayDuration,
  replaySpeedLength,
  replaySpeeds,
} from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, replayAt, replaySpeed } = useWorkspaceContext();
const HOUR_MS = 3_600_000;
const playing = ref(false);
const end = ref(Date.now());
const start = computed(() => {
  const times = state.records.map((r) => Date.parse(r.createdAt));
  const earliest = times.length ? Math.min(...times) : end.value;
  // Start a little before the first request so the hull begins empty.
  return Math.floor((earliest - 12 * HOUR_MS) / HOUR_MS) * HOUR_MS;
});
let frame = 0;
let last = 0;
let exitTimer: ReturnType<typeof setTimeout> | undefined;
function stopLoop() {
  cancelAnimationFrame(frame);
  playing.value = false;
}
function tick(stamp: number) {
  const dt = last ? stamp - last : 0;
  last = stamp;
  // Read the speed every frame, so a change mid-replay applies at once.
  const step =
    ((end.value - start.value) / replayDuration(replaySpeed.value)) * dt;
  const next = Math.min(end.value, (replayAt.value ?? start.value) + step);
  replayAt.value = next;
  if (next >= end.value) {
    stopLoop();
    // Hold the final frame briefly, then hand back to live data.
    exitTimer = setTimeout(() => (replayAt.value = null), 1500);
    return;
  }
  frame = requestAnimationFrame(tick);
}
function play() {
  clearTimeout(exitTimer);
  end.value = Date.now();
  if (replayAt.value === null || replayAt.value >= end.value)
    replayAt.value = start.value;
  playing.value = true;
  last = 0;
  frame = requestAnimationFrame(tick);
}
function pause() {
  stopLoop();
}
function live() {
  stopLoop();
  clearTimeout(exitTimer);
  replayAt.value = null;
}
function scrub(event: Event) {
  stopLoop();
  clearTimeout(exitTimer);
  replayAt.value = Number((event.target as HTMLInputElement).value);
}
onBeforeUnmount(() => {
  stopLoop();
  clearTimeout(exitTimer);
  replayAt.value = null;
});
defineExpose({ play, playing });
</script>

<template>
  <div
    class="replay"
    :class="{ active: replayAt !== null }"
  >
    <button
      v-if="replayAt === null"
      class="replay-start"
      :disabled="!state.records.length"
      @click="play"
    >
      <span aria-hidden="true">▶</span> Replay history
    </button>
    <template v-else>
      <button
        class="icon-button"
        :aria-label="playing ? 'Pause replay' : 'Resume replay'"
        @click="playing ? pause() : play()"
      >
        {{ playing ? "❚❚" : "▶" }}
      </button>
      <input
        type="range"
        aria-label="Replay date"
        :min="start"
        :max="end"
        :step="HOUR_MS"
        :value="replayAt"
        :aria-valuetext="date(new Date(replayAt).toISOString())"
        @input="scrub"
      >
      <strong class="replay-date">{{
        date(new Date(replayAt).toISOString())
      }}</strong>
      <button
        class="text-button"
        @click="live"
      >
        Back to live
      </button>
    </template>
    <select
      v-model="replaySpeed"
      class="replay-speed"
      aria-label="Replay speed"
      title="How long a full replay takes"
    >
      <option
        v-for="s in replaySpeeds"
        :key="s.id"
        :value="s.id"
      >
        {{ s.label }} · {{ replaySpeedLength(s.durationMs) }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.replay {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.replay-start {
  font-size: var(--fs-sm);
  padding: 4px 12px;
  border-radius: 999px;
}
.replay-start span {
  color: var(--esr-accent);
}
.replay.active {
  padding: 2px 4px 2px 2px;
  border: 1px solid var(--esr-accent);
  border-radius: 999px;
  background: var(--esr-accent-soft);
}
.replay .icon-button {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  background: var(--esr-accent);
  color: #fff;
  font-size: 10px;
}
.replay input[type="range"] {
  width: 180px;
  accent-color: var(--esr-accent);
}
.replay-speed {
  /* The shared form styles make selects fill their row; this one sits inline. */
  width: auto;
  min-width: 0;
  flex: none;
  height: 28px;
  padding: 0 var(--sp-2);
  border-radius: 999px;
  font-size: var(--fs-xs);
}
.replay-date {
  min-width: 96px;
  font-size: var(--fs-sm);
  color: var(--esr-accent-text);
  font-variant-numeric: tabular-nums;
}
@container (max-width: 560px) {
  .replay input[type="range"] {
    width: 110px;
  }
}
</style>
