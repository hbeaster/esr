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
