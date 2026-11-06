<script setup lang="ts">
import { computed, provide, useId } from "vue";
import { useWorkspace } from "./composables/useWorkspace";
import { workspaceKey } from "./composables/workspaceContext";
import type { WorkspaceProps, WorkspaceEvents } from "./types";
import WorkspaceNavigation from "./components/WorkspaceNavigation.vue";
import RequestWorkspace from "./components/RequestWorkspace.vue";
import RecordDetail from "./components/RecordDetail.vue";
import TemplateLibrary from "./components/TemplateLibrary.vue";
import PermissionSettings from "./components/PermissionSettings.vue";
import WorkspaceDialogs from "./components/WorkspaceDialogs.vue";
import WatchFloor from "./components/WatchFloor.vue";
import PresenceStack from "./components/PresenceStack.vue";
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
  watchFloor,
  liveStatus,
  viewers,
} = workspace;
const liveTitle = computed(
  () =>
    ({
      live: "Live: changes by others appear as they happen",
      connecting: "Connecting to live updates…",
      unavailable: "Live updates are not available from this API",
      off: "Live updates off",
    })[liveStatus.value],
);
const navigationId = useId();
const panelId = `${navigationId}-panel`;
const activeTab = computed(() =>
  view.value === "admin"
    ? "admin"
    : view.value === "workspace" && scope.value === "mine"
      ? "mine"
      : "all",
);
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
    <div
      class="main-shell"
      :inert="!!dialog || watchFloor"
    >
      <header class="topbar">
        <WorkspaceNavigation
          :active-tab="activeTab"
          :panel-id="panelId"
          :id-prefix="navigationId"
        />
        <div class="topbar-right">
          <PresenceStack
            :viewers="viewers"
            label="Also online"
          />
          <span
            :class="['live-dot', liveStatus]"
            role="img"
            :aria-label="liveTitle"
            :title="liveTitle"
          />
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
          :id="panelId"
          role="tabpanel"
          :aria-labelledby="`${navigationId}-${activeTab}`"
          tabindex="0"
          class="workspace-panel"
        >
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
        </div>
      </main>
    </div>
    <WorkspaceDialogs />
    <WatchFloor v-if="watchFloor && state.user" />
  </div>
</template>

<style src="./styles/workspace.css"></style>

<style scoped>
.app {
  min-height: calc(100vh - 47px);
  background: var(--esr-bg);
}
/* Layout responds to the embedding container, not the host viewport. */
.main-shell {
  min-width: 0;
  container-type: inline-size;
}
.topbar {
  min-height: 56px;
  border-bottom: 1px solid var(--line);
  background: #ffffffd9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-5);
  padding: 0 var(--sp-8);
  font-size: var(--fs-sm);
  color: var(--ink-3);
}
.topbar-right {
  flex-shrink: 0;
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
  background: var(--gray-dot);
  box-shadow: 0 0 0 3px var(--gray-bg);
  flex-shrink: 0;
}
.live-dot.live {
  background: var(--green-dot);
  box-shadow: 0 0 0 3px var(--green-bg);
  animation: live-pulse 2.4s ease-out infinite;
}
.live-dot.connecting {
  background: var(--amber-dot);
  box-shadow: 0 0 0 3px var(--amber-bg);
}
@keyframes live-pulse {
  0% {
    box-shadow:
      0 0 0 3px var(--green-bg),
      0 0 0 3px var(--green-dot);
  }
  100% {
    box-shadow:
      0 0 0 3px var(--green-bg),
      0 0 0 9px transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .live-dot.live {
    animation: none;
  }
}
main {
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--sp-8);
}
.workspace-panel:focus-visible {
  outline: 2px solid var(--esr-accent);
  outline-offset: 4px;
  border-radius: var(--radius-sm);
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
@container (max-width: 1150px) {
  main {
    padding: var(--sp-6);
  }
  .topbar {
    padding-inline: var(--sp-6);
  }
}
/* Tabs take a full row; status and refresh drop below them. */
@container (max-width: 620px) {
  .topbar {
    flex-wrap: wrap;
    gap: 0;
    padding: 0 var(--sp-4) var(--sp-2);
  }
  .topbar-right {
    margin-left: auto;
    font-size: var(--fs-xs);
  }
  main {
    padding: var(--sp-5) var(--sp-4);
  }
}
</style>
