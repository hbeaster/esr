<script setup lang="ts">
import { computed } from "vue";
import type { Signature } from "../types";
import { time } from "../presentation";
const props = defineProps<{ signatures: Signature[] }>();
const blocks = computed(() =>
  ["Resolved By", "Approved By", "Shop Representative", "Division Head"].map(
    (label) => ({
      label,
      signature: props.signatures.find((s) => s.block === label),
    }),
  ),
);
</script>
<template>
  <div class="card padded">
    <h2>Signature record</h2>
    <div
      v-for="block in blocks"
      :key="block.label"
      class="signature"
    >
      <span :class="['signature-icon', { signed: !!block.signature }]">{{
        block.signature ? "✓" : "○"
      }}</span>
      <div>
        <strong>{{ block.label }}</strong>
        <template v-if="block.signature">
          <span>{{ block.signature.name }}</span>
          <small>{{ time(block.signature.time) }}</small>
        </template>
        <em v-else>Awaiting signature</em>
      </div>
    </div>
    <p class="footnote">
      Demo signatures are bound to the active JWT identity.
    </p>
  </div>
</template>

<style scoped>
h2 {
  margin: var(--sp-1) 0 var(--sp-4);
}
.signature {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
  border-top: 1px solid var(--line-soft);
}
.signature:first-of-type {
  border-top: 0;
  padding-top: 0;
}
.signature-icon {
  width: 22px;
  height: 22px;
  border: 1px dashed var(--line);
  border-radius: 50%;
  color: var(--ink-4);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-xs);
  flex-shrink: 0;
}
.signature-icon.signed {
  background: var(--green-bg);
  color: var(--green-text);
  border: 1px solid var(--green-line);
  font-weight: 800;
}
.signature strong {
  display: block;
  font-size: var(--fs-sm);
  font-weight: 700;
}
.signature div > span,
.signature div > em,
.signature small {
  display: block;
  color: var(--ink-3);
  font-size: var(--fs-xs);
  margin-top: 2px;
}
.signature div > span {
  color: var(--ink);
  font-weight: 600;
}
</style>
