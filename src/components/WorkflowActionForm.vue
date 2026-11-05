<script setup lang="ts">
import { initials } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const {
  state,
  busy,
  dialog,
  actionData,
  record,
  delegated,
  confirmAction,
  closeDialog,
} = useWorkspaceContext();
</script>

<template>
  <template v-if="record && state.user && dialog">
    <form @submit.prevent="confirmAction">
      <div
        v-if="['resolve', 'approve', 'complete', 'close'].includes(dialog)"
        class="signing-identity"
      >
        <span class="avatar">{{ initials(state.user.name) }}</span>
        <div>
          <strong>{{ state.user.name }}</strong><span>{{ state.user.role }} · Verified demo JWT identity</span>
        </div>
      </div>
      <label v-if="dialog === 'assign'">Primary engineer<select
        v-model="actionData.engineerId"
        required
      >
        <option
          v-for="u in state.users.filter(
            (u) => u.role === 'Engineer' && u.site === record?.site,
          )"
          :key="u.id"
          :value="u.id"
        >
          {{ u.name }}
        </option>
      </select></label>
      <label v-if="dialog === 'revise'">Reason for revision<textarea
        v-model="actionData.reason"
        required
        rows="4"
        placeholder="Explain why the issued ESR needs to change."
      />
      </label>
      <p
        v-if="dialog === 'revise'"
        class="muted"
      >
        The issued content, files, and signatures will be preserved in revision
        history. The new draft copies the prior content and requires fresh
        engineering signatures.
      </p>
      <label v-if="dialog === 'resubmit'">Updated condition / finding<textarea
        v-model="actionData.condition"
        required
        rows="5"
      />
      </label>
      <p v-if="dialog === 'delete'">
        Delete this unassigned request and its attachments? This action cannot
        be undone.
      </p>
      <template v-if="dialog === 'complete'">
        <label>Completion status<select v-model="actionData.status">
          <option>Completed</option>
          <option>Deferred</option>
          <option>Other</option>
          <option>Canceled</option>
        </select></label><label>Shop / code<input
          v-model="actionData.shop"
          required
        ></label><label>Block 26 explanation
          {{ actionData.status === "Completed" ? "(optional)" : "(required)"
          }}<textarea
            v-model="actionData.explanation"
            :required="actionData.status !== 'Completed'"
            rows="4"
          />
        </label>
        <p class="muted">
          Name and completion date are recorded by the server from your identity
          and sign-off time.
        </p>
      </template>
      <template v-if="dialog === 'close' && record.completion">
        <div class="lds-box">
          <strong>Shop disposition: {{ record.completion.status }}</strong>
          <p>{{ record.completion.explanation || "Completed as directed." }}</p>
        </div>
        <label
          v-if="record.completion.status === 'Deferred'"
          class="check"
        ><input
          v-model="actionData.acknowledgeDeferred"
          type="checkbox"
          required
        >I acknowledge the deferred disposition and concur with
          closure.</label>
      </template>
      <label
        v-if="
          ['reject', 'return', 'resolve', 'approve', 'close'].includes(dialog)
        "
      >{{
        ["reject", "return"].includes(dialog) || delegated
          ? "Comment (required)"
          : "Signature comment (optional)"
      }}<textarea
        v-model="actionData.comment"
        :required="
          ['reject', 'return'].includes(dialog) ||
            (delegated && ['resolve', 'approve'].includes(dialog))
        "
        rows="3"
      />
      </label>
      <p
        v-if="dialog === 'resolve'"
        class="muted"
      >
        Your saved resolution, rationale, DFS and TVD answers will be validated
        before the request moves to approval.
      </p>
      <p
        v-if="dialog === 'approve'"
        class="muted"
      >
        Approval locks the technical content and makes the issued PDF available
        to the shop.
      </p>
      <div class="form-footer">
        <button
          type="button"
          @click="closeDialog"
        >
          Cancel
        </button><button
          :class="dialog === 'delete' ? 'danger' : 'primary'"
          :disabled="busy"
        >
          {{
            dialog === "delete"
              ? "Delete request"
              : ["resolve", "approve", "complete", "close"].includes(dialog)
                ? "Confirm & sign"
                : dialog === "revise"
                  ? "Create revision"
                  : "Confirm"
          }}
        </button>
      </div>
    </form>
  </template>
</template>

<style scoped>
.signing-identity {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  background: var(--esr-accent-soft);
  border: 1px solid var(--blue-line);
  border-radius: var(--radius);
  padding: var(--sp-4);
  margin-bottom: var(--sp-5);
}
.signing-identity strong {
  display: block;
  font-size: var(--fs-md);
}
.signing-identity div > span {
  display: block;
  font-size: var(--fs-xs);
  color: var(--ink-3);
}
</style>
