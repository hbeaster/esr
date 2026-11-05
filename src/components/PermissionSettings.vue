<script setup lang="ts">
import { time } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const { state, busy, permissionUser, permissionForm, savePermission } =
  useWorkspaceContext();
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>User permissions</h1>
      <p>Manage cross-facility visibility and signature delegation.</p>
    </div>
  </div>
  <form
    class="card padded admin-form"
    @submit.prevent="savePermission"
  >
    <h2>Access & delegation</h2>
    <label>User<select v-model="permissionUser">
      <option
        v-for="u in state.users"
        :key="u.id"
        :value="u.id"
      >
        {{ u.name }} · {{ u.site }} · {{ u.role }}
      </option>
    </select></label><label>Access to the other TRF<select v-model="permissionForm.crossSite">
      <option value="none">No cross-facility access</option>
      <option value="read">Read-only</option>
      <option value="review">Review — read and comment</option>
    </select></label><label class="check"><input
      v-model="permissionForm.dualSign"
      type="checkbox"
    >May sign both
      engineering signature blocks</label>
    <p class="muted">
      Delegated signatures require a comment. Cross-facility access never
      permits editing or signing the other facility’s records.
    </p>
    <button
      class="primary"
      :disabled="busy"
    >
      Save permissions
    </button>
    <div
      v-if="state.permissions[permissionUser]?.updatedAt"
      class="footnote"
    >
      Last changed by {{ state.permissions[permissionUser].updatedBy }} ·
      {{ time(state.permissions[permissionUser].updatedAt) }}
    </div>
  </form>
</template>

<style scoped>
.admin-form {
  max-width: 640px;
}
.admin-form > .muted {
  font-size: var(--fs-sm);
  font-style: italic;
}
</style>
