<script setup lang="ts">
import { useWorkspaceContext } from "../composables/workspaceContext";
const { preview, saveBlob } = useWorkspaceContext();
</script>

<template>
  <div v-if="preview">
    <img
      v-if="preview.type.startsWith('image/')"
      :src="preview.url"
      :alt="preview.name"
      class="file-preview"
    ><iframe
      v-else
      :src="preview.url"
      :title="preview.name"
      class="file-preview"
      sandbox=""
    />
    <div class="form-footer">
      <span class="muted">Original uploaded file</span><button @click="saveBlob(preview.blob, preview.name)">
        Download original
      </button>
    </div>
  </div>
</template>

<style scoped>
.file-preview {
  width: 100%;
  max-height: 65vh;
  object-fit: contain;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}
iframe.file-preview {
  height: 60vh;
}
</style>
