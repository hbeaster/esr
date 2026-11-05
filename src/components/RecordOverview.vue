<script setup lang="ts">
import { date } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, current, record } = useWorkspaceContext();
</script>

<template>
  <template v-if="record && current && state.user">
    <div class="card padded">
      <h2>Condition & finding</h2>
      <p class="prose">
        {{ record.condition }}
      </p>
      <div class="fields-grid read-fields">
        <div>
          <span>REQUESTOR</span><strong>{{ record.name }}</strong>
        </div>
        <div>
          <span>SHOP / CODE</span><strong>{{ record.shop }}</strong>
        </div>
        <div>
          <span>CONTACT</span><strong>{{ record.phone }}</strong>
        </div>
        <div>
          <span>SUBMITTED</span><strong>{{ date(record.createdAt) }}</strong>
        </div>
      </div>
    </div>
    <div class="card padded">
      <h2>Equipment & work context</h2>
      <div class="fields-grid read-fields">
        <div>
          <span>JOB CONTROL NUMBER</span><strong>{{ record.jcn }}</strong>
        </div>
        <div>
          <span>REFIT</span><strong v-if="record.refit">{{ record.refit }}</strong><em
            v-else
            class="muted"
          >Not provided</em>
        </div>
        <div>
          <span>COMPONENT / TSN</span><strong v-if="record.component">{{ record.component }}</strong><em
            v-else
            class="muted"
          >Not provided</em>
        </div>
        <div>
          <span>LOCATION</span><strong v-if="record.location">{{ record.location }}</strong><em
            v-else
            class="muted"
          >Not provided</em>
        </div>
      </div>
      <label class="read-label">WORK STATEMENT</label>
      <p v-if="record.workStatement">
        {{ record.workStatement }}
      </p>
      <p v-else>
        <em class="muted">No LDS work statement linked.</em>
      </p>
      <label class="read-label">REFERENCES</label>
      <p class="prose">
        {{ record.references }}
      </p>
    </div>
    <div
      v-if="record.revisionReason"
      class="card padded"
    >
      <h2>Reason for revision</h2>
      <p class="prose">
        {{ record.revisionReason }}
      </p>
    </div>
    <div
      v-if="record.completion"
      class="card padded"
    >
      <h2>Shop completion · Blocks 25 / 26</h2>
      <p>
        <span class="badge green">{{ record.completion.status }}</span>
        {{ record.completion.name }} · {{ record.completion.shop }} ·
        {{ record.completion.date }}
      </p>
      <p class="prose">
        {{ record.completion.explanation || "Work completed as directed." }}
      </p>
    </div>
  </template>
</template>

<style scoped>
.read-label {
  display: block;
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin: var(--sp-6) 0 var(--sp-1);
}
.read-label + p {
  margin-bottom: 0;
}
</style>
