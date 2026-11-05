<script setup lang="ts">
import RecordOverview from "./RecordOverview.vue";
import ResolutionEditor from "./ResolutionEditor.vue";
import RecordFiles from "./RecordFiles.vue";
import RevisionHistory from "./RevisionHistory.vue";
import RecordActivity from "./RecordActivity.vue";
import WorkflowActions from "./WorkflowActions.vue";
import SignatureRecord from "./SignatureRecord.vue";
import EquipmentVisual from "./EquipmentVisual.vue";
import WorkflowTimeline from "./WorkflowTimeline.vue";
import SplitFlap from "./SplitFlap.vue";
import RecordStamp from "./RecordStamp.vue";
import { ref, watch } from "vue";
import { date, esrRevision, plainText, statusTone } from "../presentation";
import type { WorkflowStatus } from "../types";
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

// Ceremony for milestones reached while this record is on screen: a stamp
// when it is issued or closed, and a flip when its ESR number changes.
interface Stamp {
  key: number;
  label: string;
  tone: "issued" | "deferred" | "closed";
  serial: string | null;
  stampedAt: string;
}
const stamp = ref<Stamp | null>(null);
const shaking = ref(false);
const flipSerial = ref(false);
let stampKey = 0;
const milestone = (
  status: WorkflowStatus,
  before: WorkflowStatus,
): Pick<Stamp, "label" | "tone"> | null => {
  if (status === "ESR Closed" && before !== "ESR Closed")
    return { label: "ESR Closed", tone: "closed" };
  if (status === "ESR Issued – Deferred" && before !== status)
    return { label: "Deferred", tone: "deferred" };
  if (status === "ESR Issued" && before === "Awaiting Approval")
    return { label: "ESR Issued", tone: "issued" };
  return null;
};
watch(
  () =>
    record.value && !historySnapshot.value
      ? ([record.value.id, record.value.status, record.value.serial] as const)
      : null,
  (now, before) => {
    flipSerial.value = false;
    if (!now || !before || now[0] !== before[0]) return;
    flipSerial.value = !!now[2] && now[2] !== before[2];
    const reached = milestone(now[1], before[1]);
    if (!reached) return;
    stamp.value = {
      key: ++stampKey,
      ...reached,
      serial: now[2],
      stampedAt: date(new Date().toISOString()),
    };
    shaking.value = false;
    requestAnimationFrame(() => (shaking.value = true));
  },
);
</script>

<template>
  <template v-if="record && current && state.user">
    <button
      class="back-link"
      @click="navigate('workspace')"
    >
      ← Back to requests
    </button>
    <div :class="['page-heading', 'detail-heading', { shaking }]">
      <RecordStamp
        v-if="stamp"
        :key="stamp.key"
        :label="stamp.label"
        :tone="stamp.tone"
        :serial="stamp.serial"
        :stamped-at="stamp.stampedAt"
        @done="stamp = null"
      />
      <div
        v-if="stamp"
        class="sr-only"
        aria-live="polite"
      >
        {{ stamp.label }}: {{ stamp.serial }}
      </div>
      <div class="detail-identity">
        <EquipmentVisual :record="record" />
        <div class="detail-text">
          <div :class="['detail-serial', { pending: !record.serial }]">
            <SplitFlap
              :value="record.serial || 'Awaiting ESR number'"
              :animate="flipSerial"
            />
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
    <WorkflowTimeline />
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
  position: relative;
  align-items: flex-start;
  margin-bottom: var(--sp-5);
}
.detail-heading.shaking {
  animation: shake 0.32s ease-out 0.24s;
}
@keyframes shake {
  20% {
    transform: translate(-3px, 2px);
  }
  45% {
    transform: translate(3px, -2px);
  }
  70% {
    transform: translate(-2px, 1px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .detail-heading.shaking {
    animation: none;
  }
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
