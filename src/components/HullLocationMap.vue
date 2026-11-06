<script setup lang="ts">
import { computed, useId } from "vue";
import HullOutline from "./HullOutline.vue";
import {
  describeLocation,
  levelLabels,
  levelsOf,
  parseLocation,
} from "../presentation";
import {
  HULL_BOTTOM,
  HULL_CENTER_Y,
  HULL_TOP,
  HULL_VIEWBOX,
  compartmentBands,
  compartmentCenter,
  frameX,
  levelBand,
} from "../hullGeometry";
const props = defineProps<{ location: string }>();
const place = computed(() => props.location.trim());
const loc = computed(() => parseLocation(place.value));
const described = computed(() => (loc.value ? describeLocation(loc.value) : ""));
const title = computed(() =>
  !place.value
    ? "Mock hull map: location not provided"
    : loc.value
      ? `Mock hull map: ${described.value}`
      : `Mock hull map: ${place.value} (compartment not recognized)`,
);

// ---- Side view: compartment, level row, and frame ----
const band = computed(() => (loc.value ? compartmentBands[loc.value.compartment] : null));
const levelRow = computed(() =>
  loc.value?.level ? levelBand(loc.value.compartment, loc.value.level) : null,
);
const pin = computed(() => {
  if (!loc.value) return null;
  const x =
    loc.value.frame !== null
      ? frameX(loc.value.frame)
      : compartmentCenter(loc.value.compartment);
  const y = levelRow.value
    ? (levelRow.value[0] + levelRow.value[1]) / 2
    : HULL_CENTER_Y;
  return { x, y };
});

// ---- Cross-section, looking forward: port on the left, starboard on the right ----
const SECTION = { cx: 60, cy: 58, r: 46 };
const sectionClip = `esr-section-${useId()}`;
const sectionDecks = computed(() => {
  if (!loc.value) return [];
  const levels = levelsOf(loc.value.compartment);
  const top = SECTION.cy - SECTION.r;
  const h = (2 * SECTION.r) / levels.length;
  return levels.map((level, i) => ({ level, top: top + i * h, bottom: top + (i + 1) * h }));
});
const chordHalf = (y: number) =>
  Math.sqrt(Math.max(0, SECTION.r ** 2 - (y - SECTION.cy) ** 2));
const sectionPin = computed(() => {
  const l = loc.value;
  if (!l?.side) return null;
  const deck = sectionDecks.value.find((d) => d.level === l.level);
  const y = deck ? (deck.top + deck.bottom) / 2 : SECTION.cy;
  if (l.side === "centerline") return { x: SECTION.cx, y };
  const reach = Math.max(10, chordHalf(y) - 9);
  const offset = l.board === "outboard" ? reach : Math.min(12, reach);
  return { x: SECTION.cx + (l.side === "port" ? -offset : offset), y };
});
const sectionTitle = computed(() => {
  const l = loc.value;
  if (!l) return "";
  const lateral = l.side
    ? l.side === "centerline"
      ? "on the centerline"
      : `${l.side}${l.board ? `, ${l.board}` : ""}`
    : "side not recorded";
  return `Cross-section looking forward: ${l.level ? levelLabels[l.level].toLowerCase() : "level not recorded"}, ${lateral}`;
});
</script>

<template>
  <figure :class="['hull-map', { muted: !loc }]">
    <div class="views">
      <svg
        class="side"
        :viewBox="HULL_VIEWBOX"
        role="img"
      >
        <title>{{ title }}</title>
        <HullOutline
          :active="loc?.compartment ?? null"
          :muted="!loc"
        >
          <rect
            v-if="band"
            :key="`band-${place}`"
            class="band"
            :x="band[0]"
            :y="HULL_TOP"
            :width="band[1] - band[0]"
            :height="HULL_BOTTOM - HULL_TOP"
          />
          <rect
            v-if="band && levelRow"
            :key="`level-${place}`"
            class="band active"
            :x="band[0]"
            :y="levelRow[0]"
            :width="band[1] - band[0]"
            :height="levelRow[1] - levelRow[0]"
          />
          <template #overlay>
            <g
              v-if="pin"
              :key="`pin-${place}`"
              :transform="`translate(${pin.x} ${pin.y})`"
            >
              <circle
                class="pulse"
                r="5"
              />
              <g class="pin">
                <!-- Sized for the slim hull: a level row is 15 units tall. -->
                <g transform="scale(0.72)">
                  <path d="M0 0C-5-8-10-12-10-19A10 10 0 1 1 10-19C10-12 5-8 0 0Z" />
                  <circle
                    cy="-19"
                    r="3.6"
                  />
                </g>
              </g>
            </g>
          </template>
        </HullOutline>
      </svg>
      <svg
        v-if="loc"
        class="section"
        viewBox="0 0 120 124"
        role="img"
      >
        <title>{{ sectionTitle }}</title>
        <defs>
          <clipPath :id="sectionClip">
            <circle
              :cx="SECTION.cx"
              :cy="SECTION.cy"
              :r="SECTION.r"
            />
          </clipPath>
        </defs>
        <circle
          class="pressure-hull-fill"
          :cx="SECTION.cx"
          :cy="SECTION.cy"
          :r="SECTION.r"
        />
        <g :clip-path="`url(#${sectionClip})`">
          <rect
            v-for="d in sectionDecks"
            :key="d.level"
            :class="['deck-band', { active: d.level === loc.level }]"
            :x="SECTION.cx - SECTION.r"
            :y="d.top"
            :width="SECTION.r * 2"
            :height="d.bottom - d.top"
          />
          <line
            v-for="d in sectionDecks.slice(1)"
            :key="`line-${d.level}`"
            class="deck-line"
            :x1="SECTION.cx - SECTION.r"
            :x2="SECTION.cx + SECTION.r"
            :y1="d.top"
            :y2="d.top"
          />
          <line
            class="centerline"
            :x1="SECTION.cx"
            :x2="SECTION.cx"
            :y1="SECTION.cy - SECTION.r"
            :y2="SECTION.cy + SECTION.r"
          />
        </g>
        <circle
          class="pressure-hull"
          :cx="SECTION.cx"
          :cy="SECTION.cy"
          :r="SECTION.r"
        />
        <g
          v-if="sectionPin"
          class="section-pin"
          :transform="`translate(${sectionPin.x} ${sectionPin.y})`"
        >
          <circle r="5.5" />
          <circle
            class="dot"
            r="2"
          />
        </g>
        <text
          class="side-label"
          x="6"
          y="120"
        >PORT</text>
        <text
          class="side-label"
          x="114"
          y="120"
          text-anchor="end"
        >STBD</text>
      </svg>
    </div>
    <figcaption>
      <span
        v-if="!place"
        class="muted"
      >Location not provided</span>
      <span v-else-if="!loc"><strong>{{ place }}</strong> · compartment not recognized</span>
      <span v-else><strong>{{ described }}</strong><span
        v-if="!loc.level || loc.frame === null || !loc.side"
        class="partial"
      >
        · partly recorded: “{{ place }}”</span></span>
      <span class="tag">Mock hull map · not to scale · section looking forward</span>
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
.views {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}
.side {
  display: block;
  flex: 1;
  min-width: 0;
  height: auto;
  overflow: visible;
}
.section {
  flex: none;
  width: 132px;
  height: auto;
}
.band {
  fill: var(--esr-accent-soft);
  fill-opacity: 0.55;
}
.band.active {
  fill: var(--esr-accent);
  fill-opacity: 0.28;
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
.pressure-hull-fill {
  fill: var(--surface);
}
.pressure-hull {
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 2;
}
.deck-band {
  fill: transparent;
}
.deck-band.active {
  fill: var(--esr-accent);
  fill-opacity: 0.28;
}
.deck-line {
  stroke: var(--line);
  stroke-width: 1;
}
.centerline {
  stroke: var(--ink-4);
  stroke-width: 1;
  stroke-opacity: 0.5;
}
.section-pin circle {
  fill: var(--esr-accent);
  stroke: var(--surface);
  stroke-width: 2;
}
.section-pin .dot {
  fill: var(--surface);
  stroke: none;
}
.side-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  fill: var(--ink-4);
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
.partial {
  color: var(--ink-4);
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
  .views {
    flex-direction: column;
    align-items: stretch;
  }
  .section {
    align-self: center;
    width: 112px;
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
