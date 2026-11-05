<script setup lang="ts">
import RichTextField from "./RichTextField.vue";
import { useWorkspaceContext } from "../composables/workspaceContext";
import { isJcn, JCN_PATTERN, normalizeJcn } from "../presentation";
const {
  busy,
  form,
  ldsResult,
  requestSection,
  pendingFiles,
  importLds,
  createRequest,
  queueFiles,
  removePending,
  closeDialog,
} = useWorkspaceContext();
function onJcnInput(event: Event) {
  form.jcn = normalizeJcn((event.target as HTMLInputElement).value);
  ldsResult.value = null;
}
</script>

<template>
  <form @submit.prevent="createRequest">
    <div class="lds-box">
      <div class="section-heading">
        <h3>Link a work package</h3>
        <span class="small-tag">CRACN</span>
      </div>
      <label class="check"><input
        v-model="form.noJcn"
        type="checkbox"
        @change="ldsResult = null"
      >JCN not applicable (N/A)</label>
      <div
        v-if="!form.noJcn"
        class="input-action"
      >
        <label>Job Control Number<input
          :value="form.jcn"
          required
          placeholder="12345WX019999"
          maxlength="13"
          :pattern="JCN_PATTERN"
          title="13 characters: 5 digits, 4 letters or digits, then 0001–9999"
          autocapitalize="characters"
          spellcheck="false"
          autofocus
          @input="onJcnInput"
        ></label><button
          type="button"
          :disabled="busy || !isJcn(form.jcn)"
          @click="importLds"
        >
          Import LDS
        </button>
      </div>
      <small v-if="!form.noJcn">Format 12345WX019999 (5 digits, 4 letters or digits, 0001–9999). Demo JCNs: 21036WX010184 · 21036WX020207</small>
      <div
        v-if="ldsResult"
        class="lds-result"
      >
        <strong>{{ ldsResult.workStatement }}</strong><span>{{ ldsResult.refit }} · {{ ldsResult.component }}</span><span>{{ ldsResult.location }}</span>
      </div>
    </div>
    <div class="fields-grid">
      <label>Name<input
        v-model="form.name"
        required
      ></label><label>Shop / code<input
        v-model="form.shop"
        required
      ></label><label>Phone number<input
        v-model="form.phone"
        required
        type="tel"
      ></label>
    </div>
    <RichTextField
      v-model="form.references"
      label="References"
      required
      min-height="64px"
      placeholder="Reference numbers, drawings, or applicable procedures"
    />
    <RichTextField
      v-model="form.condition"
      label="Condition / finding"
      required
      min-height="120px"
      placeholder="Describe the observed issue and the engineering support needed."
    />
    <div class="request-files">
      <div class="upload-box">
        <span class="upload-icon">↑</span>
        <h3>Add supporting files</h3>
        <p>PNG, JPEG, WebP, PDF or TXT · Up to 15 MB each · 20 files</p>
        <div class="action-row">
          <label class="inline-label">Section<select v-model="requestSection">
            <option>Condition</option>
            <option>Reference</option>
            <option>Continuation</option>
          </select></label><label class="button primary upload-button">Choose files<input
            type="file"
            multiple
            aria-label="Upload supporting files"
            accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,.txt"
            :disabled="busy"
            @change="queueFiles"
          ></label>
        </div>
      </div>
      <div
        v-for="file in pendingFiles"
        :key="file.key"
        class="file-row"
      >
        <span class="file-icon">▤</span>
        <div>
          <strong>{{ file.name }}</strong><span>{{ file.section }} · {{ Math.ceil(file.size / 1024) }} KB</span>
        </div>
        <button
          type="button"
          :disabled="busy"
          @click="removePending(file.key)"
        >
          Remove
        </button>
      </div>
    </div>
    <div class="form-footer">
      <button
        type="button"
        @click="closeDialog"
      >
        Cancel
      </button><button
        class="primary"
        :disabled="busy"
      >
        Submit request →
      </button>
    </div>
  </form>
</template>
