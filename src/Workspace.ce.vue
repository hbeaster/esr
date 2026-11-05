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
defineOptions({ name: "EsrWorkspace" });
const props = withDefaults(defineProps<WorkspaceProps>(), {
  apiBase: "/api",
  tokenProvider: null,
});
const emit = defineEmits<WorkspaceEvents>();
const workspace = useWorkspace(props, emit);
provide(workspaceKey, workspace);
const { state, busy, error, notice, view, scope, dialog, record, run, reload } =
  workspace;
const navigationId = useId();
const panelId = `${navigationId}-panel`;
const activeTab = computed(() =>
  view.value === "admin"
    ? "admin"
    : view.value === "workspace" && scope.value === "mine"
      ? "mine"
      : "all",
);
</script>
<template>
  <div
    class="app"
    :aria-busy="busy"
  >
    <div
      class="main-shell"
      :inert="!!dialog"
    >
      <header class="topbar">
        <WorkspaceNavigation
          :active-tab="activeTab"
          :panel-id="panelId"
          :id-prefix="navigationId"
        />
        <div class="topbar-right">
          <span class="live-dot" />
          {{ state.user?.site || "TRF" }} workspace
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
      </main>
    </div>
    <WorkspaceDialogs />
  </div>
</template>
