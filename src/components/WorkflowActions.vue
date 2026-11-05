<script setup lang="ts">
import { computed } from "vue";
import { initials } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, historySnapshot, record, local, delegated, owner, action } =
  useWorkspaceContext();
/** Display only. `backend/Esr.Api/Workflow.cs` authorizes every action. */
const can = computed(() => {
  const r = record.value;
  const u = state.user;
  const open = !historySnapshot.value && local.value && !!r && !!u;
  if (!open || !r || !u) return null;
  return {
    triage: r.status === "Unassigned" && u.role === "Supervisor",
    resubmit:
      r.status === "Unassigned" && r.rejected && r.requestorId === u.id,
    resolve:
      r.status === "In Process" &&
      (r.engineerId === u.id || delegated.value),
    approve:
      r.status === "Awaiting Approval" &&
      (u.role === "Supervisor" || delegated.value),
    returnChanges:
      r.status === "Awaiting Approval" && u.role === "Supervisor",
    complete:
      r.status === "ESR Issued" && !r.completion && u.role === "Shop",
    close:
      r.status.startsWith("ESR Issued") &&
      !!r.completion &&
      u.role === "Division Head",
  };
});
const hasAction = computed(
  () => !!can.value && Object.values(can.value).some(Boolean),
);
const waitingOn = computed(() => {
  const r = record.value;
  if (!r || historySnapshot.value) return "";
  if (r.status === "Unassigned")
    return r.rejected ? "the original requestor" : "an engineering supervisor";
  if (r.status === "In Process") return owner(r.engineerId);
  if (r.status === "Awaiting Approval") return "an engineering supervisor";
  if (r.status === "ESR Closed") return "";
  return r.completion ? "the division head" : "shop personnel";
});
</script>

<template>
  <template v-if="record && state.user">
    <div :class="['card', 'padded', 'next-step', { actionable: hasAction }]">
      <span class="eyebrow">{{ hasAction ? "Your action" : "Next step" }}</span>
      <h2>
        {{
          historySnapshot
            ? "Historical snapshot"
            : record.status === "Unassigned"
              ? "Engineering assignment"
              : record.status === "In Process"
                ? "Prepare the resolution"
                : record.status === "Awaiting Approval"
                  ? "Technical review"
                  : record.status === "ESR Closed"
                    ? "Record closed"
                    : record.completion
                      ? "Division review"
                      : "Shop execution"
        }}
      </h2>
      <div class="person">
        <span class="avatar">{{ initials(owner(record.engineerId)) }}</span>
        <div>
          <span class="muted">Assigned engineer</span>
          <strong>{{ owner(record.engineerId) }}</strong>
        </div>
      </div>
      <div
        v-if="can && hasAction"
        class="workflow-actions"
      >
        <template v-if="can.triage">
          <button
            class="primary"
            @click="action('assign')"
          >
            Assign engineer <span class="arrow">→</span>
          </button><button @click="action('reject')">
            Return to shop
          </button><button
            class="danger-text"
            @click="action('delete')"
          >
            Delete request
          </button>
        </template>
        <button
          v-if="can.resubmit"
          class="primary"
          @click="action('resubmit')"
        >
          Update & resubmit <span class="arrow">→</span>
        </button>
        <button
          v-if="can.resolve"
          class="primary"
          @click="action('resolve')"
        >
          Sign & submit for approval
        </button>
        <template v-if="can.approve">
          <button
            class="primary"
            @click="action('approve')"
          >
            Approve & issue ESR
          </button><button
            v-if="can.returnChanges"
            @click="action('return')"
          >
            Request changes
          </button>
        </template>
        <button
          v-if="can.complete"
          class="primary"
          @click="action('complete')"
        >
          Record shop completion
        </button>
        <button
          v-if="can.close"
          class="primary"
          @click="action('close')"
        >
          Review & close ESR
        </button>
      </div>
      <p
        v-else-if="waitingOn"
        class="waiting"
      >
        Waiting on <strong>{{ waitingOn }}</strong>.
      </p>
    </div>
  </template>
</template>
