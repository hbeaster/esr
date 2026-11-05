<script setup lang="ts">
import { computed, provide } from "vue";
import { useWorkspace } from "./composables/useWorkspace";
import { workspaceKey } from "./composables/workspaceContext";
import type { WorkspaceProps, WorkspaceEvents } from "./types";
import WorkspaceSidebar from "./components/WorkspaceSidebar.vue";
import RequestWorkspace from "./components/RequestWorkspace.vue";
import RecordDetail from "./components/RecordDetail.vue";
import TemplateLibrary from "./components/TemplateLibrary.vue";
import PermissionSettings from "./components/PermissionSettings.vue";
import WorkspaceDialogs from "./components/WorkspaceDialogs.vue";
defineOptions({ name: "EsrWorkspace" });
const props = withDefaults(defineProps<WorkspaceProps>(), {
  apiBase: "/api",
  tokenProvider: null,
});
const emit = defineEmits<WorkspaceEvents>();
const workspace = useWorkspace(props, emit);
provide(workspaceKey, workspace);
const {
  state,
  busy,
  error,
  notice,
  view,
  scope,
  dialog,
  record,
  run,
  reload,
} = workspace;
/** Changes when the visible page changes, not when the same page re-renders. */
const pageKey = computed(() =>
  !state.user
    ? "connecting"
    : view.value === "workspace"
      ? `workspace:${scope.value}`
      : view.value === "record"
        ? `record:${record.value?.id ?? ""}`
        : view.value,
);
</script>
<template>
  <div
    class="app"
    :aria-busy="busy"
  >
    <WorkspaceSidebar />
    <div
      class="main-shell"
      :inert="!!dialog"
    >
      <header class="topbar">
        <div class="crumbs">
          Engineering <span>/</span>
          {{
            view === "record"
              ? record?.serial || "New request"
              : view === "templates"
                ? "Template library"
                : view === "admin"
                  ? "Permissions"
                  : "Service requests"
          }}
        </div>
        <div class="topbar-right">
          <span class="live-dot" />
          <span>TRF <strong>{{ state.user?.site || "—" }}</strong></span>
          <button
            class="icon-button"
            aria-label="Refresh workspace"
            :disabled="busy"
            @click="run(reload)"
          >
            ↻
          </button>
        </div>
      </header>
      <main>
        <div
          v-if="error && !dialog"
          class="alert error"
          role="alert"
        >
          {{ error }}
          <button
            aria-label="Dismiss error"
            @click="error = ''"
          >
            ×
          </button>
        </div>
        <div
          v-if="notice"
          class="alert success"
          role="status"
        >
          {{ notice }}
          <button
            aria-label="Dismiss notice"
            @click="notice = ''"
          >
            ×
          </button>
        </div>
        <Transition
          name="page"
          mode="out-in"
        >
          <div
            :key="pageKey"
            class="page"
          >
            <div
              v-if="!state.user"
              class="empty"
            >
              <div class="empty-icon">
                ▦
              </div>
              <h1>Engineering service requests</h1>
              <p>
                {{
                  props.tokenProvider
                    ? "Connecting to the workspace…"
                    : "Provide a tokenProvider to connect the component to your API."
                }}
              </p>
            </div>
            <RequestWorkspace v-else-if="view === 'workspace'" />
            <RecordDetail v-else-if="view === 'record' && record" />
            <TemplateLibrary v-else-if="view === 'templates'" />
            <PermissionSettings v-else-if="view === 'admin'" />
          </div>
        </Transition>
      </main>
    </div>
    <WorkspaceDialogs />
  </div>
</template>

<style src="./styles/workspace.css"></style>

<style scoped>
.app {
  display: flex;
  min-height: calc(100vh - 47px);
  background: var(--esr-bg);
}
.main-shell {
  flex: 1;
  min-width: 0;
}
.topbar {
  height: 56px;
  border-bottom: 1px solid var(--line);
  background: #ffffffd9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--sp-8);
  font-size: var(--fs-sm);
  color: var(--ink-3);
}
.crumbs > span {
  padding: 0 var(--sp-2);
  color: var(--ink-4);
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.topbar-right strong {
  color: var(--ink);
}
.live-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green-dot);
  box-shadow: 0 0 0 3px var(--green-bg);
  flex-shrink: 0;
}
main {
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--sp-8);
}
/*
 * Page change: the old page fades quickly, the new one rises 6px into place.
 * The base sheet's reduced-motion rule shortens both to an instant swap.
 */
.page-leave-active {
  transition: opacity 0.12s ease-in;
  pointer-events: none;
}
.page-enter-active {
  transition:
    opacity 0.24s var(--ease),
    transform 0.24s var(--ease);
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
}
.empty-icon {
  font-size: 40px;
  margin-bottom: var(--sp-3);
  color: var(--ink-4);
}
@media (max-width: 1150px) {
  main {
    padding: var(--sp-6);
  }
  .topbar {
    padding-inline: var(--sp-6);
  }
}
@media (max-width: 560px) {
  .app {
    display: block;
  }
  .topbar {
    height: 48px;
    padding: 0 var(--sp-4);
    font-size: var(--fs-xs);
  }
  .topbar-right > span:not(.live-dot) {
    display: none;
  }
  main {
    padding: var(--sp-5) var(--sp-4);
  }
}
</style>
