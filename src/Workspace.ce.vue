<script setup lang="ts">
import { provide } from "vue";
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
const { state, busy, error, notice, view, dialog, record, run, reload } =
  workspace;
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
      </main>
    </div>
    <WorkspaceDialogs />
  </div>
</template>
