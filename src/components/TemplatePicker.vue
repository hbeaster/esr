<script setup lang="ts">
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, applyTemplate } = useWorkspaceContext();
</script>

<template>
  <div>
    <article
      v-for="t in state.templates"
      :key="t.id"
      class="template-choice"
    >
      <span class="small-tag">{{ t.category }}</span>
      <h3>{{ t.title }}</h3>
      <p class="prose">
        {{ t.resolution }}
      </p>
      <button
        class="primary"
        @click="applyTemplate(t)"
      >
        Insert template
      </button>
    </article>
  </div>
</template>
