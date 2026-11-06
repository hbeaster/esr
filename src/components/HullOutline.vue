<script setup lang="ts">
import { useId } from "vue";
import { compartments } from "../presentation";
import type { CompartmentId } from "../presentation";
import {
  BULKHEADS,
  DECK_PATH,
  FIN_PATH,
  HATCHES,
  HULL_X,
  LABEL_Y,
  HULL_BOTTOM,
  HULL_PATH,
  HULL_TOP,
  SAIL_PATH,
  compartmentBands,
  compartmentCenter,
  deckLines,
} from "../hullGeometry";
defineProps<{
  active?: CompartmentId | null;
  muted?: boolean;
  /** Hide labels and headings, e.g. while zoomed into one compartment. */
  bare?: boolean;
  /** Optional count shown after each compartment label. */
  counts?: Partial<Record<CompartmentId, number>>;
}>();
// Two maps can share one shadow root, so each needs its own clip id.
const clipId = `esr-hull-clip-${useId()}`;
</script>

<template>
  <g :class="['hull-outline', { muted, bare }]">
    <defs>
      <clipPath :id="clipId">
        <path :d="HULL_PATH" />
      </clipPath>
    </defs>
    <text
      class="heading"
      :x="HULL_X[0]"
      y="14"
    >
      ◀ AFT
    </text>
    <text
      class="heading"
      :x="HULL_X[1]"
      y="14"
      text-anchor="end"
    >
      FWD ▶
    </text>
    <path
      class="fin"
      vector-effect="non-scaling-stroke"
      :d="FIN_PATH"
    />
    <path
      class="sail"
      vector-effect="non-scaling-stroke"
      :d="SAIL_PATH"
    />
    <path
      class="deck-hump"
      vector-effect="non-scaling-stroke"
      :d="DECK_PATH"
    />
    <line
      v-for="x in HATCHES"
      :key="`hatch-${x}`"
      class="hatch"
      vector-effect="non-scaling-stroke"
      :x1="x"
      :x2="x"
      y1="45.5"
      y2="49"
    />
    <path
      class="hull-fill"
      :d="HULL_PATH"
    />
    <g :clip-path="`url(#${clipId})`">
      <slot />
      <template
        v-for="c in compartments"
        :key="c.id"
      >
        <line
          v-for="y in deckLines(c.id)"
          :key="`${c.id}-${y}`"
          class="deck"
          vector-effect="non-scaling-stroke"
          :x1="compartmentBands[c.id][0]"
          :x2="compartmentBands[c.id][1]"
          :y1="y"
          :y2="y"
        />
      </template>
      <line
        v-for="x in BULKHEADS"
        :key="x"
        class="bulkhead"
        vector-effect="non-scaling-stroke"
        :x1="x"
        :x2="x"
        :y1="HULL_TOP"
        :y2="HULL_BOTTOM"
      />
    </g>
    <path
      class="hull-line"
      vector-effect="non-scaling-stroke"
      :d="HULL_PATH"
    />
    <text
      v-for="c in compartments"
      :key="c.id"
      :class="['zone-label', { active: c.id === active }]"
      :x="compartmentCenter(c.id)"
      :y="LABEL_Y"
      text-anchor="middle"
    >
      <tspan class="long">
        {{ c.label }}
      </tspan><tspan class="short">
        {{ c.short }}
      </tspan><tspan
        v-if="counts && counts[c.id] !== undefined"
        class="zone-count"
        dx="6"
      >
        {{ counts[c.id] }}
      </tspan>
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
.fin,
.deck-hump {
  fill: var(--surface);
}
.deck-hump {
  stroke: var(--ink-3);
  stroke-width: 2;
  stroke-linejoin: round;
}
.hatch {
  stroke: var(--ink-4);
  stroke-width: 2;
  stroke-linecap: round;
}
.bulkhead {
  stroke: var(--ink-4);
  stroke-width: 1.5;
}
.deck {
  stroke: var(--line);
  stroke-width: 1;
}
.zone-label {
  font-size: 11px;
  fill: var(--ink-4);
}
.zone-label.active {
  font-weight: 800;
  fill: var(--esr-accent-text);
}
.zone-count {
  font-weight: 800;
  fill: var(--ink-2);
}
.short {
  display: none;
}
.bare .heading,
.bare .zone-label {
  display: none;
}
.muted .hull-line,
.muted .sail,
.muted .deck-hump,
.muted .fin {
  stroke: var(--ink-4);
  stroke-dasharray: 5 4;
}
@container (max-width: 560px) {
  .heading {
    display: none;
  }
  .zone-label {
    font-size: 16px;
  }
  .long {
    display: none;
  }
  .short {
    display: inline;
  }
}
</style>
