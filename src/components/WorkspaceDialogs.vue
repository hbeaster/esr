<script setup lang="ts">
import RequestForm from "./RequestForm.vue";
import TemplatePicker from "./TemplatePicker.vue";
import FilePreview from "./FilePreview.vue";
import WorkflowActionForm from "./WorkflowActionForm.vue";
import { useWorkspaceContext } from "../composables/workspaceContext";
const {
  error,
  dialog,
  preview,
  closeDialog,
  dialogTitle,
  modalElement,
  trapFocus,
} = useWorkspaceContext();
</script>

<template>
  <div
    v-if="dialog"
    class="modal-backdrop"
    @click.self="closeDialog"
    @keydown.esc="closeDialog"
  >
    <section
      ref="modalElement"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      :class="{ wide: ['create', 'templates', 'preview'].includes(dialog) }"
      @keydown="trapFocus"
    >
      <div class="modal-heading">
        <div>
          <div class="eyebrow">
            ENGINEERING SERVICE REQUEST
          </div>
          <h2 id="dialog-title">
            {{
              dialog === "create"
                ? "Start a new request"
                : dialog === "templates"
                  ? "Approved engineering templates"
                  : dialog === "preview"
                    ? preview?.name
                    : dialogTitle
            }}
          </h2>
        </div>
        <button
          class="icon-button"
          aria-label="Close dialog"
          @click="closeDialog"
        >
          ×
        </button>
      </div>
      <div
        v-if="error"
        class="alert error"
        role="alert"
      >
        {{ error }}
      </div>
      <RequestForm v-if="dialog === 'create'" />
      <TemplatePicker v-else-if="dialog === 'templates'" />
      <FilePreview v-else-if="dialog === 'preview' && preview" />
      <WorkflowActionForm v-else />
    </section>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: #0f1a2a66;
  backdrop-filter: blur(3px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-6);
}
.modal {
  width: min(100%, 560px);
  max-height: 90vh;
  overflow: auto;
  background: var(--surface);
  border-radius: 12px;
  padding: var(--sp-6) var(--sp-8);
  box-shadow: 0 24px 64px #0f1a2a40;
}
.modal.wide {
  width: min(100%, 760px);
}
.modal-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  margin-bottom: var(--sp-5);
}
.modal-heading h2 {
  font-size: var(--fs-xl);
  margin: var(--sp-1) 0 0;
}
.modal-heading > .icon-button {
  margin: -6px -10px 0 0;
  font-size: 22px;
}
@media (max-width: 560px) {
  .modal-backdrop {
    padding: var(--sp-2);
  }
  .modal {
    padding: var(--sp-5);
    max-height: 94vh;
  }
}
</style>
