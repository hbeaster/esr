<script setup lang="ts">
import type { EquipmentClass } from "../presentation";
/** Line drawing for an equipment class in a 64 × 64 box. Stroke comes from the parent. */
defineProps<{ kind: EquipmentClass }>();
</script>

<template>
  <g class="equipment-glyph">
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
  </g>
</template>
