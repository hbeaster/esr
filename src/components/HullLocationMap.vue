<script setup lang="ts">
import { computed } from "vue";
import HullOutline from "./HullOutline.vue";
import { hullZone, hullZoneLabel } from "../presentation";
import {
  HULL_CENTER_Y,
  HULL_HEIGHT,
  HULL_TOP,
  HULL_VIEWBOX,
  zoneBands,
  zoneCenter,
} from "../hullGeometry";
const props = defineProps<{ location: string }>();
const place = computed(() => props.location.trim());
const zone = computed(() => hullZone(place.value));
const title = computed(() =>
  !place.value
    ? "Mock hull map: location not provided"
    : `Mock hull map: ${place.value} (${zone.value ? hullZoneLabel(zone.value) : "zone unknown"})`,
);
</script>

<template>
  <figure class="hull-map">
    <svg
      :viewBox="HULL_VIEWBOX"
      role="img"
    >
      <title>{{ title }}</title>
      <HullOutline
        :active="zone"
        :muted="!zone"
      >
        <rect
          v-if="zone"
          :key="`band-${place}`"
          class="band active"
          :x="zoneBands[zone][0]"
          :y="HULL_TOP"
          :width="zoneBands[zone][1] - zoneBands[zone][0]"
          :height="HULL_HEIGHT"
        />
        <template #overlay>
          <g
            v-if="zone"
            :key="`pin-${place}`"
            :transform="`translate(${zoneCenter(zone)} ${HULL_CENTER_Y})`"
          >
            <circle
              class="pulse"
              r="8"
            />
            <g class="pin">
              <path d="M0 0C-6-9-11-14-11-21A11 11 0 1 1 11-21C11-14 6-9 0 0Z" />
              <circle
                cy="-21"
                r="4"
              />
            </g>
          </g>
        </template>
      </HullOutline>
    </svg>
    <figcaption>
      <span
        v-if="!place"
        class="muted"
      >Location not provided</span>
      <span v-else-if="!zone"><strong>{{ place }}</strong> · zone not recognized</span>
      <span v-else><strong>{{ place }}</strong> · {{ hullZoneLabel(zone) }}</span>
      <span class="tag">Mock hull map · not to scale</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.hull-map {
  margin: 0 0 var(--sp-5);
  padding: var(--sp-3) var(--sp-4) var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-2);
}
.hull-map svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.band.active {
  fill: var(--esr-accent-soft);
  stroke: var(--esr-accent);
  stroke-width: 2;
  animation: band-in 0.5s var(--ease) both;
}
.pin path {
  fill: var(--esr-accent);
}
.pin circle {
  fill: var(--surface);
}
.pin {
  animation: pin-drop 0.6s var(--ease) 0.15s both;
}
.pulse {
  fill: var(--esr-accent);
  transform-box: fill-box;
  transform-origin: center;
  animation: pulse 1.8s ease-out 0.6s infinite;
}
figcaption {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--ink-3);
}
figcaption strong {
  color: var(--ink);
}
figcaption .muted {
  font-style: italic;
}
@keyframes band-in {
  from {
    opacity: 0;
  }
}
@keyframes pin-drop {
  0% {
    opacity: 0;
    transform: translateY(-26px);
  }
  70% {
    opacity: 1;
    transform: translateY(2px);
  }
  100% {
    transform: translateY(0);
  }
}
@keyframes pulse {
  0% {
    opacity: 0.45;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(3.2);
  }
}
@media (prefers-reduced-motion: reduce) {
  .band.active,
  .pin,
  .pulse {
    animation: none;
  }
  .pulse {
    opacity: 0.2;
  }
}
</style>
