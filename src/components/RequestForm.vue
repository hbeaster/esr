<script setup lang="ts">
import { useWorkspaceContext } from "../composables/workspaceContext";
import { isJcn, JCN_PATTERN, normalizeJcn } from "../presentation";
const { busy, form, ldsResult, importLds, createRequest, closeDialog } =
  useWorkspaceContext();
function onJcnInput(event: Event) {
  form.jcn = normalizeJcn((event.target as HTMLInputElement).value);
  ldsResult.value = null;
}
</script>

<template>
  <form @submit.prevent="createRequest">
    <label>Request title<input
      v-model="form.title"
      required
      placeholder="A concise description of the engineering issue"
      autofocus
      maxlength="180"
    ></label>
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
    <label>References<textarea
      v-model="form.references"
      rows="2"
      required
      placeholder="Reference numbers, drawings, or applicable procedures"
    /></label><label>Condition / finding<textarea
      v-model="form.condition"
      rows="4"
      required
      placeholder="Describe the observed issue and the engineering support needed."
    />
    </label>
    <p class="footnote">
      Submit the request, then attach photos and documents in the Files tab.
    </p>
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
        Submit request <span class="arrow">→</span>
      </button>
    </div>
  </form>
</template>

<style scoped>
.fields-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
}
.input-action {
  display: flex;
  align-items: flex-end;
  gap: var(--sp-3);
  margin-bottom: var(--sp-2);
}
.input-action label {
  margin: 0;
  flex: 1;
}
.input-action button {
  height: 40px;
}
.lds-result {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  background: var(--green-bg);
  border: 1px solid var(--green-line);
  padding: var(--sp-3);
  border-radius: var(--radius-sm);
  margin-top: var(--sp-3);
  font-size: var(--fs-sm);
  color: var(--ink-2);
}
.lds-result strong {
  color: var(--green-text);
}
@media (max-width: 560px) {
  .fields-grid {
    grid-template-columns: 1fr;
  }
  .fields-grid label {
    margin: var(--sp-1) 0;
  }
}
</style>
