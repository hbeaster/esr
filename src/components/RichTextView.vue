<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { richTextHtml } from "../presentation";

const props = defineProps<{ value?: string | null; empty?: string }>();
const host = ref<HTMLElement | null>(null);
function render() {
  if (!host.value) return;
  host.value.innerHTML = richTextHtml(props.value) || props.empty || "";
}
onMounted(render);
watch(() => props.value, render);
</script>

<template>
  <div
    ref="host"
    class="prose rich-content"
  />
</template>

<style scoped>
.rich-content {
  white-space: normal;
}
/* Rendered through innerHTML, so the inner elements carry no scope id. */
.rich-content :deep(p),
.rich-content :deep(ul),
.rich-content :deep(ol) {
  margin: 0 0 0.6em;
}
.rich-content :deep(ul),
.rich-content :deep(ol) {
  padding-left: 1.2em;
}
.rich-content :deep(:last-child) {
  margin-bottom: 0;
}
</style>
