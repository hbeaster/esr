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

<style scoped>
/* Tabs fill the topbar height so the active underline sits on its border. */
.workspace-tabs {
  display: flex;
  align-self: stretch;
  min-width: 0;
  gap: var(--sp-5);
  margin-bottom: -1px;
  overflow-x: auto;
  scrollbar-width: none;
}
[role="tab"] {
  flex-shrink: 0;
  gap: var(--sp-2);
  padding: 0 var(--sp-1);
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--ink-3);
  font-size: var(--fs-sm);
  font-weight: 500;
  white-space: nowrap;
  transition:
    color 0.15s,
    border-color 0.2s var(--ease);
}
[role="tab"]:hover {
  background: transparent;
  color: var(--ink);
}
[role="tab"]:focus-visible {
  outline: 2px solid var(--esr-accent);
  outline-offset: -2px;
}
[aria-selected="true"] {
  color: var(--esr-accent-text);
  font-weight: 700;
  border-bottom-color: var(--esr-accent);
}
small {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 0 6px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--ink-3);
}
[aria-selected="true"] small {
  border-color: var(--esr-accent);
  background: var(--esr-accent-soft);
  color: var(--esr-accent-text);
}
/* Full-width row under 620px: a fixed height keeps the underline aligned. */
@container (max-width: 620px) {
  .workspace-tabs {
    flex-basis: 100%;
    height: 48px;
    margin-bottom: var(--sp-2);
    border-bottom: 1px solid var(--line-soft);
  }
  [role="tab"] {
    margin-bottom: -1px;
  }
}
</style>
