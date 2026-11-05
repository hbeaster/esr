<script setup lang="ts">
import { computed } from "vue";
import { hullZone, hullZoneLabel, hullZones } from "../presentation";
const props = defineProps<{ location: string }>();
/** Bow-to-stern x ranges inside the hull outline (viewBox 0 0 640 160). */
const bands: Record<string, [number, number]> = {
  forward: [42, 150],
  operations: [150, 250],
  midships: [250, 340],
  auxiliary: [340, 430],
  engineering: [430, 530],
  aft: [530, 610],
};
const place = computed(() => props.location.trim());
const zone = computed(() => hullZone(place.value));
const pinX = computed(() => {
  if (!zone.value) return 0;
  const [start, end] = bands[zone.value];
  // The aft band tapers to a point, so pull its pin toward the wider end.
  return zone.value === "aft" ? start + 22 : (start + end) / 2;
});
const title = computed(() =>
  !place.value
    ? "Mock hull map: location not provided"
    : `Mock hull map: ${place.value} (${zone.value ? hullZoneLabel(zone.value) : "zone unknown"})`,
);
const hull =
  "M70 62H470C540 62 580 78 600 90C580 102 540 118 470 118H70A28 28 0 0 1 70 62Z";
</script>

<template>
  <figure :class="['hull-map', { muted: !zone }]">
    <svg
      viewBox="0 0 640 160"
      role="img"
    >
      <title>{{ title }}</title>
      <defs>
        <clipPath id="esr-hull-clip">
          <path :d="hull" />
        </clipPath>
      </defs>
      <text
        class="heading"
        x="42"
        y="20"
      >◀ FWD</text>
      <text
        class="heading"
        x="600"
        y="20"
        text-anchor="end"
      >AFT ▶</text>
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
        :d="hull"
      />
      <g clip-path="url(#esr-hull-clip)">
        <line
          v-for="z in hullZones.slice(1)"
          :key="z.id"
          class="bulkhead"
          :x1="bands[z.id][0]"
          :x2="bands[z.id][0]"
          y1="62"
          y2="118"
        />
        <rect
          v-if="zone"
          :key="`band-${place}`"
          class="band active"
          :x="bands[zone][0]"
          y="62"
          :width="bands[zone][1] - bands[zone][0]"
          height="56"
        />
      </g>
      <path
        class="hull-line"
        :d="hull"
      />
      <text
        v-for="z in hullZones"
        :key="z.id"
        :class="['zone-label', { active: z.id === zone }]"
        :x="
          z.id === 'aft'
            ? bands.aft[0] + 22
            : (bands[z.id][0] + bands[z.id][1]) / 2
        "
        y="144"
        text-anchor="middle"
      >
        {{ z.label }}
      </text>
      <g
        v-if="zone"
        :key="`pin-${place}`"
        :transform="`translate(${pinX} 90)`"
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
.band.active {
  fill: var(--esr-accent-soft);
  stroke: var(--esr-accent);
  stroke-width: 2;
  animation: band-in 0.5s var(--ease) both;
}
.zone-label {
  font-size: 11px;
  fill: var(--ink-4);
}
.zone-label.active {
  font-weight: 800;
  fill: var(--esr-accent-text);
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
.muted .hull-line,
.muted .sail,
.muted .fin {
  stroke: var(--ink-4);
  stroke-dasharray: 5 4;
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
@container (max-width: 560px) {
  .zone-label:not(.active),
  .heading {
    display: none;
  }
  .zone-label.active {
    font-size: 18px;
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
