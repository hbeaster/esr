<script setup lang="ts">
import { computed } from "vue";
import type { EsrRecord } from "../types";
import { equipmentClass, equipmentClassLabel } from "../presentation";
const props = defineProps<{
  record: Pick<
    EsrRecord,
    "component" | "title" | "workStatement" | "condition"
  >;
}>();
const kind = computed(() => equipmentClass(props.record));
const label = computed(() => equipmentClassLabel(kind.value));
</script>

<template>
  <figure
    class="equipment-visual"
    :data-equipment="kind"
  >
    <svg
      viewBox="0 0 64 64"
      role="img"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <title>Mock illustration: {{ label }}</title>
      <g v-if="kind === 'pump'">
        <circle
          cx="28"
          cy="36"
          r="14"
        />
        <circle
          cx="28"
          cy="36"
          r="4"
        />
        <path d="M28 22h22v10H40M14 50h28M50 22v-6M46 16h8" />
      </g>
      <g v-else-if="kind === 'valve'">
        <path d="M8 30v16l20-8zM56 30v16l-20-8z" />
        <path d="M32 38V18M22 14h20" />
        <circle
          cx="32"
          cy="14"
          r="2"
        />
      </g>
      <g v-else-if="kind === 'heat-exchanger'">
        <rect
          x="8"
          y="20"
          width="48"
          height="24"
          rx="12"
        />
        <path d="M18 28h28M18 36h28M14 20v-8M50 44v8" />
      </g>
      <g v-else-if="kind === 'electrical'">
        <rect
          x="14"
          y="8"
          width="36"
          height="48"
          rx="4"
        />
        <path d="M35 16l-9 17h12l-9 17" />
      </g>
      <g v-else-if="kind === 'sensor'">
        <circle
          cx="32"
          cy="28"
          r="18"
        />
        <path d="M32 28l9-9M20 34h2M42 34h2M32 46v10M24 56h16" />
        <circle
          cx="32"
          cy="28"
          r="2"
        />
      </g>
      <g v-else-if="kind === 'ventilation'">
        <rect
          x="8"
          y="14"
          width="48"
          height="36"
          rx="3"
        />
        <path
          d="M14 22l8 6M14 32l8 6M30 22l8 6M30 32l8 6M46 22l4 3M46 32l4 3M14 42h36"
        />
      </g>
      <g v-else-if="kind === 'tank'">
        <rect
          x="18"
          y="6"
          width="28"
          height="52"
          rx="14"
        />
        <path d="M18 26h28M26 38v8M32 4v2" />
      </g>
      <g v-else-if="kind === 'engine'">
        <rect
          x="8"
          y="22"
          width="32"
          height="26"
          rx="3"
        />
        <path d="M14 22v-6h20v6M40 30h6v10h-6M8 48v6M40 48v6" />
        <circle
          cx="52"
          cy="18"
          r="6"
        />
        <path d="M52 8v4M52 24v4M42 18h4M58 18h4" />
      </g>
      <g v-else>
        <path d="M32 8l20.8 12v24L32 56 11.2 44V20z" />
        <circle
          cx="32"
          cy="32"
          r="9"
        />
      </g>
    </svg>
    <figcaption>
      {{ label }}<span class="mock">Mock</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.equipment-visual {
  flex: none;
  display: grid;
  justify-items: center;
  gap: var(--sp-1);
  width: 72px;
  margin: 0;
}
.equipment-visual svg {
  width: 72px;
  height: 72px;
  padding: var(--sp-2);
  box-sizing: border-box;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--esr-accent-text);
}
.equipment-visual figcaption {
  font-size: var(--fs-xs);
  color: var(--ink-3);
  text-align: center;
  line-height: 1.2;
}
.mock {
  display: block;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-4);
}
@container (max-width: 560px) {
  .equipment-visual,
  .equipment-visual svg {
    width: 48px;
  }
  .equipment-visual svg {
    height: 48px;
    padding: var(--sp-1);
  }
  .equipment-visual figcaption {
    display: none;
  }
}
</style>
