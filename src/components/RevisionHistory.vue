<script setup lang="ts">
import { date } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, tab, historySnapshot, current, record } = useWorkspaceContext();
</script>

<template>
  <template v-if="record && current && state.user">
    <div class="card padded">
      <h2>Revision history</h2>
      <p class="muted">
        Prior issued versions are retained as immutable snapshots, including
        signatures and attachments.
      </p>
      <article class="revision-row">
        <span class="revision-mark">{{ current.revision || "0" }}</span>
        <div>
          <h3>{{ current.serial }} <span class="badge blue">Current</span></h3>
          <p>{{ current.revisionReason || "Original engineering request" }}</p>
        </div>
        <button
          @click="
            historySnapshot = null;
            tab = 'overview';
          "
        >
          View current
        </button>
      </article>
      <article
        v-for="revision in [...current.revisions].reverse()"
        :key="revision.revision"
        class="revision-row"
      >
        <span class="revision-mark">{{ revision.revision }}</span>
        <div>
          <h3>{{ revision.serial }}</h3>
          <p>{{ revision.revisionReason || "Original issued version" }}</p>
          <span class="muted">{{ revision.status }} · {{ date(revision.updatedAt) }}</span>
        </div>
        <button
          @click="
            historySnapshot = revision;
            tab = 'overview';
          "
        >
          View snapshot
        </button>
      </article>
      <p
        v-if="!current.revisions.length"
        class="empty"
      >
        No prior revisions. Issued versions are preserved when a new revision
        begins.
      </p>
    </div>
  </template>
</template>
