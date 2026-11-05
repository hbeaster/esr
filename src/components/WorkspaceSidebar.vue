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
    ><span class="brand-mark">E</span><span>ESR<span class="brand-sub">Engineering service requests</span></span></a>
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
    <div class="profile">
      <span class="avatar">{{ initials(state.user?.name) }}</span>
      <div>
        <strong>{{ state.user?.name || "Waiting for session" }}</strong><span>{{
          state.user
            ? `${state.user.role} · TRF ${state.user.site}`
            : "Connect your host identity"
        }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 232px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
  padding: var(--sp-6) var(--sp-3) var(--sp-5);
  position: sticky;
  top: 0;
  height: 100vh;
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 0 var(--sp-2);
  font-size: var(--fs-xl);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.brand-mark {
  background: var(--ink);
  color: #fff;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  font-size: var(--fs-lg);
  font-weight: 800;
  box-shadow: inset 0 -3px 0 var(--esr-accent);
}
.brand-sub {
  display: block;
  font-size: var(--fs-xs);
  letter-spacing: 0;
  font-weight: 500;
  color: var(--ink-3);
  margin-top: 3px;
}
nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
nav button {
  justify-content: flex-start;
  padding: 9px var(--sp-3);
  border: 0;
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  color: var(--ink-3);
  font-weight: 500;
  background: transparent;
}
nav button > span {
  font-size: var(--fs-lg);
  width: 20px;
  line-height: 1;
  color: var(--ink-4);
}
nav button.active {
  background: var(--esr-accent-soft);
  color: var(--esr-accent-text);
  font-weight: 700;
}
nav button.active > span {
  color: var(--esr-accent);
}
nav small {
  margin-left: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 0 6px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--ink-3);
}
.profile {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  border-top: 1px solid var(--line-soft);
  padding: var(--sp-4) var(--sp-2) 0;
  margin-top: auto;
}
.profile strong {
  display: block;
  font-size: var(--fs-sm);
}
.profile div > span {
  display: block;
  font-size: var(--fs-xs);
  color: var(--ink-3);
}
@media (max-width: 1150px) {
  .sidebar {
    width: 204px;
  }
}
@media (max-width: 850px) {
  .sidebar {
    width: 68px;
    padding: var(--sp-5) var(--sp-2);
    align-items: center;
  }
  .brand {
    padding: 0;
    justify-content: center;
  }
  .brand > span:last-child,
  .profile div,
  nav button > small {
    display: none;
  }
  nav button {
    font-size: 0;
    justify-content: center;
    padding: var(--sp-3) 0;
    width: 44px;
  }
  nav button > span {
    font-size: 20px;
  }
  .profile {
    padding: var(--sp-4) 0 0;
    justify-content: center;
  }
}
@media (max-width: 560px) {
  .sidebar {
    position: static;
    width: 100%;
    height: auto;
    padding: var(--sp-3) var(--sp-4);
    flex-direction: row;
    align-items: center;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    gap: var(--sp-3);
  }
  .brand {
    flex-shrink: 0;
  }
  .brand-mark {
    height: 32px;
    width: 32px;
  }
  nav {
    flex-direction: row;
    flex: 1;
    justify-content: flex-end;
    gap: 2px;
  }
  nav button {
    width: 38px;
    padding: 6px 0;
  }
  .profile {
    display: none;
  }
}
</style>
