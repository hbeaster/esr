<script setup lang="ts">
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state } = useWorkspaceContext();
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>Template library</h1>
      <p>Consistent starting points for clear engineering direction.</p>
    </div>
    <span class="badge green">Supervisor-approved only</span>
  </div>
  <div class="template-grid">
    <article
      v-for="t in state.templates"
      :key="t.id"
      class="card padded template-card"
    >
      <span class="small-tag">{{ t.category }}</span>
      <h2>{{ t.title }}</h2>
      <p class="prose">
        {{ t.resolution }}
      </p>
      <details>
        <summary>Engineering rationale</summary>
        <p>{{ t.rationale }}</p>
      </details>
      <p class="footnote">
        Insert this template from an editable ESR resolution.
      </p>
    </article>
  </div>
</template>

<style scoped>
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--sp-5);
}
.template-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.template-card h2 {
  margin-top: var(--sp-3);
}
.template-card .prose {
  font-size: var(--fs-sm);
}
.template-card details {
  font-size: var(--fs-sm);
  margin-top: auto;
}
.template-card summary {
  cursor: pointer;
  color: var(--esr-accent);
  font-weight: 600;
}
.template-card summary:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
@media (max-width: 560px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>
