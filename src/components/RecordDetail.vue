<script setup lang="ts">
import RecordOverview from "./RecordOverview.vue";
import ResolutionEditor from "./ResolutionEditor.vue";
import RecordFiles from "./RecordFiles.vue";
import RevisionHistory from "./RevisionHistory.vue";
import RecordActivity from "./RecordActivity.vue";
import WorkflowActions from "./WorkflowActions.vue";
import SignatureRecord from "./SignatureRecord.vue";
import EquipmentVisual from "./EquipmentVisual.vue";
import { esrRevision, plainText, steps, statusTone } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const {
  state,
  busy,
  tab,
  historySnapshot,
  current,
  record,
  local,
  resetDraft,
  navigate,
  action,
  downloadPdf,
} = useWorkspaceContext();
</script>

<template>
  <template v-if="record && current && state.user">
    <button
      class="back-link"
      @click="navigate('workspace')"
    >
      ← Back to requests
    </button>
    <div class="page-heading detail-heading">
      <div class="detail-identity">
        <EquipmentVisual :record="record" />
        <div class="detail-text">
          <div :class="['detail-serial', { pending: !record.serial }]">
            {{ record.serial || "Awaiting ESR number" }}
            <span
              v-if="
                esrRevision(record.serial) && esrRevision(record.serial) !== 'A'
              "
              class="rev"
            >Revision {{ esrRevision(record.serial) }}</span>
          </div>
          <h1>{{ record.title || plainText(record.condition) }}</h1>
          <div class="detail-meta">
            <span :class="['badge', statusTone(record.status)]">{{
              record.status
            }}</span><span>{{ record.site }} · Shop {{ record.shop }}</span><span
              v-for="a in [
                ...record.attributes,
                ...(record.dfs === 'yes' ? ['DFS'] : []),
                ...(record.tvd === 'yes' ? ['TVD'] : []),
              ]"
              :key="a"
              :class="[
                'tag',
                {
                  critical: a === 'SUBSAFE',
                  special: a === 'DFS' || a === 'TVD',
                },
              ]"
            >{{ a }}</span>
          </div>
        </div>
      </div>
      <div class="action-row">
        <button
          v-if="record.signatures.some((s) => s.block === 'Approved By')"
          :disabled="busy"
          @click="downloadPdf"
        >
          ↓ Export PDF
        </button><button
          v-if="
            !historySnapshot &&
              local &&
              ['Engineer', 'Supervisor'].includes(state.user.role) &&
              (record.status.startsWith('ESR Issued') ||
                record.status === 'ESR Closed')
          "
          @click="action('revise')"
        >
          ↗ New revision
        </button>
      </div>
    </div>
    <div
      v-if="historySnapshot"
      class="alert info"
    >
      <span>Viewing immutable revision
        <strong>{{ historySnapshot.serial }}</strong>.</span>
      <button
        @click="
          historySnapshot = null;
          resetDraft();
        "
      >
        Return to current revision →
      </button>
    </div>
    <div
      v-if="!local"
      class="alert info"
    >
      Cross-facility
      {{
        state.permissions[state.user.id]?.crossSite === "review"
          ? "review access — comments are enabled"
          : "read-only access"
      }}.
    </div>
    <div
      v-if="record.rejected"
      class="alert error"
    >
      <span><strong>Returned to the requestor.</strong> See the review comments
        before resubmitting.</span>
    </div>
    <div
      class="stepper"
      aria-label="Workflow progress"
    >
      <div
        v-for="(step, i) in steps"
        :key="step"
        :class="{
          done:
            i <
            steps.indexOf(
              record.status.startsWith('ESR Issued')
                ? 'ESR Issued'
                : record.status,
            ),
          current:
            step ===
            (record.status.startsWith('ESR Issued')
              ? 'ESR Issued'
              : record.status),
        }"
      >
        <span>{{ i + 1 }}</span><strong>{{ step }}</strong>
      </div>
    </div>
    <div
      class="tabs"
      role="tablist"
      aria-label="Record sections"
    >
      <button
        v-for="t in ['overview', 'resolution', 'files', 'history', 'activity']"
        :key="t"
        role="tab"
        :aria-selected="tab === t"
        :class="{ active: tab === t }"
        @click="tab = t"
      >
        {{
          t === "files"
            ? `Files (${record.attachments.length})`
            : t === "history"
              ? `Revisions (${current.revisions.length})`
              : t[0].toUpperCase() + t.slice(1)
        }}
      </button>
    </div>
    <div class="detail-grid">
      <Transition
        name="tab"
        mode="out-in"
      >
        <section
          :key="`${tab}:${historySnapshot?.serial ?? 'current'}`"
          class="detail-content"
        >
          <RecordOverview v-if="tab === 'overview'" />
          <ResolutionEditor v-if="tab === 'resolution'" />
          <RecordFiles v-if="tab === 'files'" />
          <RevisionHistory v-if="tab === 'history'" />
          <RecordActivity v-if="tab === 'activity'" />
        </section>
      </Transition>
      <aside class="record-aside">
        <WorkflowActions /><SignatureRecord :signatures="record.signatures" />
      </aside>
    </div>
  </template>
</template>

<style scoped>
.back-link {
  border-color: transparent;
  background: transparent;
  padding: 0;
  margin: 0 0 var(--sp-5);
  font-size: var(--fs-sm);
  color: var(--ink-3);
}
.back-link:hover {
  background: transparent;
  border-color: transparent;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.detail-heading {
  align-items: flex-start;
  margin-bottom: var(--sp-5);
}
.detail-identity {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-4);
  min-width: 0;
}
.detail-text {
  min-width: 0;
}
.detail-serial {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-lg);
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--esr-accent-text);
  margin-bottom: var(--sp-1);
}
.detail-serial.pending {
  font-size: var(--fs-sm);
  font-weight: 500;
  font-style: italic;
  color: var(--ink-3);
}
.rev {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 7px;
  border-radius: 4px;
  background: var(--amber-bg);
  color: var(--amber-text);
  border: 1px solid var(--amber-line);
}
.detail-heading h1 {
  font-size: 24px;
  max-width: 760px;
}
.detail-meta {
  display: flex;
  gap: var(--sp-2) var(--sp-3);
  align-items: center;
  font-size: var(--fs-sm);
  color: var(--ink-3);
  flex-wrap: wrap;
}
.stepper {
  display: flex;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  padding: var(--sp-4) var(--sp-5);
  margin-bottom: var(--sp-6);
  gap: var(--sp-3);
}
.stepper > div {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--ink-4);
  font-size: var(--fs-sm);
  min-width: 0;
}
.stepper > div:not(:last-child)::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--line);
  min-width: var(--sp-3);
}
.stepper > div > span {
  width: 24px;
  height: 24px;
  border: 1px solid var(--line);
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-xs);
  font-weight: 700;
  flex-shrink: 0;
}
.stepper strong {
  font-weight: 500;
  white-space: nowrap;
}
.stepper .done {
  color: var(--ink-2);
}
.stepper .done > span {
  background: var(--green-bg);
  border-color: var(--green-line);
  color: var(--green-text);
}
.stepper .done:not(:last-child)::after {
  background: var(--green-line);
}
.stepper .current {
  color: var(--esr-accent-text);
}
.stepper .current strong {
  font-weight: 800;
}
.stepper .current > span {
  background: var(--esr-accent);
  color: #fff;
  border-color: var(--esr-accent);
  box-shadow: 0 0 0 3px var(--esr-accent-soft);
}
.tabs {
  display: flex;
  gap: var(--sp-6);
  border-bottom: 1px solid var(--line);
  margin-bottom: var(--sp-6);
  overflow: auto;
}
.tabs button {
  border: 0;
  background: transparent;
  border-radius: 0;
  padding: 0 2px var(--sp-3);
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--ink-3);
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tabs button:hover {
  background: transparent;
  color: var(--ink);
}
.tabs button.active {
  color: var(--esr-accent-text);
  font-weight: 700;
  border-bottom-color: var(--esr-accent);
}
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: var(--sp-6);
}
.detail-content,
.record-aside {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}
/* Tab change: a short cross-fade only, so the page frame stays still. */
.tab-enter-active {
  transition: opacity 0.18s var(--ease);
}
.tab-leave-active {
  transition: opacity 0.08s ease-in;
  pointer-events: none;
}
.tab-enter-from,
.tab-leave-to {
  opacity: 0;
}
/* Child component roots carry this component's scope, so these apply. */
.record-aside > .padded {
  padding: var(--sp-5);
}
@container (max-width: 1150px) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr) 260px;
  }
  .stepper > div:not(:last-child)::after {
    display: none;
  }
}
@container (max-width: 850px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .record-aside {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .detail-heading {
    flex-wrap: wrap;
  }
  .stepper {
    overflow: auto;
    padding: var(--sp-3);
  }
  .stepper > div {
    min-width: max-content;
    font-size: var(--fs-xs);
  }
}
@container (max-width: 560px) {
  .record-aside {
    display: flex;
  }
  .record-aside > .padded {
    padding: var(--sp-5) var(--sp-4);
  }
  .detail-heading h1 {
    font-size: 20px;
  }
  .detail-identity {
    gap: var(--sp-3);
  }
  .tabs {
    gap: var(--sp-5);
  }
}
</style>
