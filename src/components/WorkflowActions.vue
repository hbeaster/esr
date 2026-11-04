<script setup lang="ts">
import { initials } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, historySnapshot, record, local, delegated, owner, action } =
  useWorkspaceContext();
</script>

<template>
  <template v-if="record && state.user">
    <div class="card padded">
      <span class="eyebrow">NEXT STEP</span>
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
      <p class="muted">
        Assigned engineer
      </p>
      <div class="person">
        <span class="avatar">{{ initials(owner(record.engineerId)) }}</span><strong>{{ owner(record.engineerId) }}</strong>
      </div>
      <div
        v-if="!historySnapshot && local"
        class="workflow-actions"
      >
        <template
          v-if="
            record.status === 'Unassigned' && state.user.role === 'Supervisor'
          "
        >
          <button
            class="primary"
            @click="action('assign')"
          >
            Assign engineer →
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
          v-if="
            record.status === 'Unassigned' &&
              record.rejected &&
              record.requestorId === state.user.id
          "
          class="primary"
          @click="action('resubmit')"
        >
          Update & resubmit
        </button>
        <button
          v-if="
            record.status === 'In Process' &&
              (record.engineerId === state.user.id || delegated)
          "
          class="primary"
          @click="action('resolve')"
        >
          Sign & submit for approval
        </button>
        <template
          v-if="
            record.status === 'Awaiting Approval' &&
              (state.user.role === 'Supervisor' || delegated)
          "
        >
          <button
            class="primary"
            @click="action('approve')"
          >
            Approve & issue ESR
          </button><button
            v-if="state.user.role === 'Supervisor'"
            @click="action('return')"
          >
            Request changes
          </button>
        </template>
        <button
          v-if="
            record.status === 'ESR Issued' &&
              !record.completion &&
              state.user.role === 'Shop'
          "
          class="primary"
          @click="action('complete')"
        >
          Record shop completion
        </button>
        <button
          v-if="
            record.status.startsWith('ESR Issued') &&
              record.completion &&
              state.user.role === 'Division Head'
          "
          class="primary"
          @click="action('close')"
        >
          Review & close ESR
        </button>
      </div>
      <p class="footnote">
        Actions are available to the responsible role. Use the demo identity
        selector to explore each handoff.
      </p>
    </div>
  </template>
</template>
