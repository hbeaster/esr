<script setup lang="ts">
import RecordOverview from "./RecordOverview.vue";
import ResolutionEditor from "./ResolutionEditor.vue";
import RecordFiles from "./RecordFiles.vue";
import RevisionHistory from "./RevisionHistory.vue";
import RecordActivity from "./RecordActivity.vue";
import WorkflowActions from "./WorkflowActions.vue";
import SignatureRecord from "./SignatureRecord.vue";
import { esrRevision, steps, statusTone } from "../presentation";
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
      <div>
        <div class="eyebrow">
          {{ record.serial || "AWAITING SERIAL NUMBER" }}
          <span v-if="esrRevision(record.serial) && esrRevision(record.serial) !== 'A'">· REVISION {{ esrRevision(record.serial) }}</span>
        </div>
        <h1>{{ record.title }}</h1>
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
            class="tag"
          >{{ a }}</span>
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
      Viewing immutable revision {{ historySnapshot.serial }}.
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
      Returned to the requestor. See the review comments before resubmitting.
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
      <section class="detail-content">
        <RecordOverview v-if="tab === 'overview'" />
        <ResolutionEditor v-if="tab === 'resolution'" />
        <RecordFiles v-if="tab === 'files'" />
        <RevisionHistory v-if="tab === 'history'" />
        <RecordActivity v-if="tab === 'activity'" />
      </section>
      <aside class="record-aside">
        <WorkflowActions /><SignatureRecord :signatures="record.signatures" />
      </aside>
    </div>
  </template>
</template>
