<script setup lang="ts">
import { initials } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, view, scope, dialog, navigate } = useWorkspaceContext();
</script>

<template>
  <aside
    class="sidebar"
    :inert="!!dialog"
  >
    <a
      class="brand"
      href="#"
      @click.prevent="navigate('workspace')"
    ><span class="brand-mark">E<span>↗</span></span><span>ESR<span class="brand-sub">ENGINEERING WORKSPACE</span></span></a>
    <div class="facility">
      <span class="facility-icon">⌖</span>
      <div>
        <strong>TRF {{ state.user?.site || "Bangor" }}</strong><span>Engineering services</span>
      </div>
      <span class="live-dot" />
    </div>
    <div class="nav-label">
      WORKSPACE
    </div>
    <nav aria-label="Primary navigation">
      <button
        :class="{
          active:
            (view === 'workspace' && scope === 'all') || view === 'record',
        }"
        @click="navigate('workspace')"
      >
        <span>▦</span> All requests <small>{{ state.records.length }}</small>
      </button>
      <button
        :class="{ active: scope === 'mine' && view === 'workspace' }"
        @click="navigate('workspace', 'mine')"
      >
        <span>◉</span> My work
      </button>
      <button
        :class="{ active: scope === 'history' && view === 'workspace' }"
        @click="navigate('workspace', 'history')"
      >
        <span>◷</span> Historical ESRs
      </button>
      <button
        :class="{ active: view === 'templates' }"
        @click="navigate('templates')"
      >
        <span>▤</span> Template library
      </button>
      <button
        v-if="state.user?.role === 'Administrator'"
        :class="{ active: view === 'admin' }"
        @click="navigate('admin')"
      >
        <span>⚙</span> Permissions
      </button>
    </nav>
    <div class="sidebar-note">
      <span class="small-icon">↗</span><strong>One request. Full traceability.</strong>
      <p>From the deckplate to engineering approval and closeout.</p>
      <span class="small-tag">DIGITAL WORKFLOW</span>
    </div>
    <div class="profile">
      <span class="avatar">{{ initials(state.user?.name) }}</span>
      <div>
        <strong>{{ state.user?.name || "Waiting for session" }}</strong><span>{{ state.user?.role || "Connect your host identity" }}</span>
      </div>
    </div>
  </aside>
</template>
