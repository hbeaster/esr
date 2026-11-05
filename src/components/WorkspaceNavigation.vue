<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useWorkspaceContext } from "../composables/workspaceContext";
const props = defineProps<{
  activeTab: string;
  panelId: string;
  idPrefix: string;
}>();
const { state, navigate } = useWorkspaceContext();
const tabs = computed(() => [
  { key: "all", label: "All requests" },
  { key: "mine", label: "My work" },
  ...(state.user?.role === "Administrator"
    ? [{ key: "admin", label: "Permissions" }]
    : []),
]);
const focusedTab = ref(props.activeTab);
watch(
  () => props.activeTab,
  (value) => {
    focusedTab.value = value;
  },
);
watch(tabs, (items) => {
  if (!items.some((item) => item.key === focusedTab.value))
    focusedTab.value = props.activeTab;
});
function activate(key: string) {
  if (key === "admin") navigate("admin");
  else navigate("workspace", key === "mine" ? "mine" : "all");
}
function onKeydown(event: KeyboardEvent, index: number) {
  let next: number;
  if (event.key === "ArrowRight") next = (index + 1) % tabs.value.length;
  else if (event.key === "ArrowLeft")
    next = (index - 1 + tabs.value.length) % tabs.value.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.value.length - 1;
  else return;
  event.preventDefault();
  focusedTab.value = tabs.value[next]!.key;
  const button = event.currentTarget as HTMLButtonElement;
  const buttons =
    button.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  buttons?.item(next)?.focus();
}
</script>

<template>
  <div
    class="workspace-tabs"
    role="tablist"
    aria-label="Workspace views"
  >
    <button
      v-for="(item, index) in tabs"
      :id="`${idPrefix}-${item.key}`"
      :key="item.key"
      role="tab"
      :aria-selected="activeTab === item.key"
      :aria-controls="panelId"
      :tabindex="focusedTab === item.key ? 0 : -1"
      @focus="focusedTab = item.key"
      @keydown="onKeydown($event, index)"
      @click="activate(item.key)"
    >
      {{ item.label }}
      <small v-if="item.key === 'all'">{{ state.records.length }}</small>
    </button>
  </div>
</template>
