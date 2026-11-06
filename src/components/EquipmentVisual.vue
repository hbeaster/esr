<script setup lang="ts">
import { computed } from "vue";
import type { EsrRecord } from "../types";
import { equipmentClass, equipmentClassLabel } from "../presentation";
import EquipmentGlyph from "./EquipmentGlyph.vue";
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
      <EquipmentGlyph :kind="kind" />
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
