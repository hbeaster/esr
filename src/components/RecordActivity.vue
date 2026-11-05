<script setup lang="ts">
import { initials, time } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, busy, comment, current, record, canComment, postComment } =
  useWorkspaceContext();
</script>

<template>
  <template v-if="record && current && state.user">
    <div class="card padded">
      <h2>Comments & review</h2>
      <form
        v-if="canComment"
        @submit.prevent="postComment"
      >
        <label
          class="sr-only"
          for="comment"
        >Add a comment</label><textarea
          id="comment"
          v-model="comment"
          rows="3"
          placeholder="Add a comment to the engineering record…"
          required
        />
        <div class="form-footer">
          <span class="muted">Recorded as {{ state.user.name }}</span><button
            class="primary"
            :disabled="busy"
          >
            Post comment
          </button>
        </div>
      </form>
      <article
        v-for="c in [...record.comments].reverse()"
        :key="c.id"
        class="comment"
      >
        <span class="avatar mini">{{ initials(c.name) }}</span>
        <div>
          <strong>{{ c.name }}</strong><time>{{ time(c.time) }}</time>
          <p class="prose">
            {{ c.text }}
          </p>
        </div>
      </article>
      <p
        v-if="!record.comments.length"
        class="muted"
      >
        No comments yet.
      </p>
    </div>
    <div class="card padded">
      <h2>Audit trail</h2>
      <div
        v-for="entry in [...record.audit].reverse()"
        :key="entry.id"
        class="audit-entry"
      >
        <span class="status-dot green" />
        <div>
          <strong>{{ entry.action }}</strong>
          <p>{{ entry.actor }} · {{ time(entry.time) }}</p>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.comment {
  display: flex;
  gap: var(--sp-3);
  border-top: 1px solid var(--line-soft);
  padding-top: var(--sp-4);
  margin-top: var(--sp-4);
}
.comment strong {
  font-size: var(--fs-sm);
}
.comment time {
  font-size: var(--fs-xs);
  color: var(--ink-3);
  margin-left: var(--sp-2);
}
.comment p {
  margin: var(--sp-1) 0 0;
}
.audit-entry {
  display: flex;
  gap: var(--sp-3);
  margin-top: var(--sp-4);
  align-items: baseline;
}
.audit-entry strong {
  font-size: var(--fs-sm);
  font-weight: 600;
}
.audit-entry p {
  font-size: var(--fs-xs);
  color: var(--ink-3);
  margin: 2px 0 0;
}
</style>
