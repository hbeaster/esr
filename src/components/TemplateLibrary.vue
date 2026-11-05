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
