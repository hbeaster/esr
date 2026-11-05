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
