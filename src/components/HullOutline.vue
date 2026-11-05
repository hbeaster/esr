<script setup lang="ts">
import { useId } from "vue";
import { hullZones } from "../presentation";
import type { HullZone } from "../presentation";
import {
  HULL_HEIGHT,
  HULL_PATH,
  HULL_TOP,
  zoneBands,
  zoneCenter,
} from "../hullGeometry";
defineProps<{ active?: HullZone | null; muted?: boolean }>();
// Two maps can share one shadow root, so each needs its own clip id.
const clipId = `esr-hull-clip-${useId()}`;
</script>

<template>
  <g :class="['hull-outline', { muted }]">
    <defs>
      <clipPath :id="clipId">
        <path :d="HULL_PATH" />
      </clipPath>
    </defs>
    <text
      class="heading"
      x="42"
      y="20"
    >
      ◀ FWD
    </text>
    <text
      class="heading"
      x="600"
      y="20"
      text-anchor="end"
    >
      AFT ▶
    </text>
    <path
      class="fin"
      d="M570 82L592 56H602L594 84M570 98L592 124H602L594 96"
    />
    <path
      class="sail"
      d="M178 62L186 34H226L234 62M170 46H186M226 46H242"
    />
    <path
      class="hull-fill"
      :d="HULL_PATH"
    />
    <g :clip-path="`url(#${clipId})`">
      <line
        v-for="z in hullZones.slice(1)"
        :key="z.id"
        class="bulkhead"
        :x1="zoneBands[z.id][0]"
        :x2="zoneBands[z.id][0]"
        :y1="HULL_TOP"
        :y2="HULL_TOP + HULL_HEIGHT"
      />
      <slot />
    </g>
    <path
      class="hull-line"
      :d="HULL_PATH"
    />
    <text
      v-for="z in hullZones"
      :key="z.id"
      :class="['zone-label', { active: z.id === active }]"
      :x="zoneCenter(z.id)"
      y="144"
      text-anchor="middle"
    >
      {{ z.label }}
    </text>
    <slot name="overlay" />
  </g>
</template>

<style scoped>
.heading {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  fill: var(--ink-4);
}
.hull-fill {
  fill: var(--surface);
}
.hull-line,
.sail,
.fin {
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.sail,
.fin {
  fill: var(--surface);
}
.bulkhead {
  stroke: var(--line);
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
}
.zone-label {
  font-size: 11px;
  fill: var(--ink-4);
}
.zone-label.active {
  font-weight: 800;
  fill: var(--esr-accent-text);
}
.muted .hull-line,
.muted .sail,
.muted .fin {
  stroke: var(--ink-4);
  stroke-dasharray: 5 4;
}
@container (max-width: 560px) {
  .zone-label:not(.active),
  .heading {
    display: none;
  }
  .zone-label.active {
    font-size: 18px;
  }
}
</style>
