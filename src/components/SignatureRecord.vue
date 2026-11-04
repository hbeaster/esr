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
        <span v-else>Awaiting signature</span>
      </div>
    </div>
    <p class="footnote">
      Demo signatures are bound to the active JWT identity.
    </p>
  </div>
</template>
