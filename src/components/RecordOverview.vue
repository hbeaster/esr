<script setup lang="ts">
import RecordFiles from "./RecordFiles.vue";
import RichTextView from "./RichTextView.vue";
import { date } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, current, record } = useWorkspaceContext();
</script>

<template>
  <template v-if="record && current && state.user">
    <div class="card padded">
      <div class="section-heading">
        <h2>Condition & finding</h2>
        <span class="small-tag">REQUEST DETAILS</span>
      </div>
      <RichTextView :value="record.condition" />
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
          <span>REFIT</span><strong>{{ record.refit || "Not provided" }}</strong>
        </div>
        <div>
          <span>COMPONENT / TSN</span><strong>{{ record.component || "Not provided" }}</strong>
        </div>
        <div>
          <span>SWBS</span><strong>{{ record.swbs || "Not provided" }}</strong>
        </div>
        <div>
          <span>LOCATION</span><strong>{{ record.location || "Not provided" }}</strong>
        </div>
      </div>
      <label class="read-label">WORK STATEMENT</label>
      <p>{{ record.workStatement || "No LDS work statement linked." }}</p>
      <label class="read-label">REFERENCES</label>
      <RichTextView :value="record.references" />
    </div>
    <RecordFiles />
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
