<script setup lang="ts">
import { computed } from "vue";
import HullOutline from "./HullOutline.vue";
import { hullZones } from "../presentation";
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
const { zone, zoneCounts } = useWorkspaceContext();
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
function toggle(id: HullZone) {
  zone.value = zone.value === id ? "" : id;
}
</script>

<template>
  <section
    class="card hull-heatmap"
    aria-labelledby="hull-heatmap-title"
  >
    <div class="heatmap-head">
      <h2 id="hull-heatmap-title">
        Where the work is
      </h2>
      <span class="tag">Mock hull map · not to scale</span>
    </div>
    <svg
      :viewBox="HULL_VIEWBOX"
      role="img"
      :class="{ selecting: zone }"
    >
      <title>{{ title }}</title>
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
        <template #overlay>
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
          </template>
        </template>
      </HullOutline>
    </svg>
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
  </section>
</template>

<style scoped>
.hull-heatmap {
  padding: var(--sp-4) var(--sp-5);
  margin-bottom: var(--sp-5);
}
.heatmap-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.heatmap-head h2 {
  margin: 0;
  font-size: var(--fs-md);
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
.selecting .heat:not(.selected) {
  opacity: 0.45;
}
.heat.selected {
  stroke: var(--esr-accent);
  stroke-width: 5;
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
@media (prefers-reduced-motion: reduce) {
  .heat {
    transition: none;
  }
}
</style>
