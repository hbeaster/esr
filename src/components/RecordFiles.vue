<script setup lang="ts">
import { useWorkspaceContext } from "../composables/workspaceContext";
const {
  state,
  busy,
  attachmentSection,
  current,
  record,
  canAttach,
  upload,
  previewFile,
} = useWorkspaceContext();
</script>

<template>
  <template v-if="record && current && state.user">
    <div class="card padded">
      <div class="section-heading">
        <div>
          <h2>Supporting files</h2>
          <p class="muted">
            Drawings, inspection photos, and continuation sheets.
          </p>
        </div>
        <span class="small-tag">{{ record.attachments.length }} / 20 FILES</span>
      </div>
      <div
        v-if="canAttach"
        class="upload-box"
      >
        <span class="upload-icon">↑</span>
        <h3>Add evidence to the engineering record</h3>
        <p>PNG, JPEG, WebP, PDF or TXT · Original quality · Up to 15 MB each</p>
        <div class="action-row">
          <label class="inline-label">Section<select v-model="attachmentSection">
            <option>Condition</option>
            <option>Reference</option>
            <option>Continuation</option>
          </select></label><label class="button primary upload-button">Choose file<input
            type="file"
            aria-label="Upload supporting file"
            accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
            :disabled="busy"
            @change="upload"
          ></label>
        </div>
      </div>
      <div
        v-for="file in record.attachments"
        :key="file.id"
        class="file-row"
      >
        <span class="file-icon">▤</span>
        <div>
          <strong>{{ file.name }}</strong><span>{{ file.section }} · {{ Math.ceil(file.size / 1024) }} KB ·
            {{ file.uploadedBy }}</span>
        </div>
        <button
          :disabled="busy"
          @click="previewFile(file)"
        >
          Preview
        </button>
      </div>
      <p
        v-if="!record.attachments.length"
        class="empty"
      >
        No supporting files attached yet.
      </p>
    </div>
  </template>
</template>

<style scoped>
.upload-box {
  border: 1px dashed #b7c3d3;
  background: var(--surface-2);
  border-radius: var(--radius);
  text-align: center;
  padding: var(--sp-6) var(--sp-5);
  margin-bottom: var(--sp-2);
}
.upload-icon {
  font-size: 26px;
  color: var(--esr-accent);
}
.upload-box h3 {
  margin: var(--sp-2) 0;
}
.upload-box p {
  font-size: var(--fs-xs);
  color: var(--ink-3);
}
.upload-box .action-row {
  justify-content: center;
}
.inline-label {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
  margin: 0;
}
.inline-label select {
  margin: 0;
  width: auto;
}
.upload-button {
  position: relative;
  overflow: hidden;
  margin: 0;
}
.upload-button input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
  margin: 0;
}
.file-row {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  border-bottom: 1px solid var(--line-soft);
  padding: var(--sp-4) 0;
}
.file-icon {
  font-size: var(--fs-xl);
  color: var(--ink-3);
}
.file-row div {
  flex: 1;
  min-width: 0;
}
.file-row strong {
  font-size: var(--fs-base);
  display: block;
  overflow-wrap: anywhere;
}
.file-row div > span {
  font-size: var(--fs-xs);
  color: var(--ink-3);
}
</style>
