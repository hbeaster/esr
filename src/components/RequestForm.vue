<script setup lang="ts">
import { useWorkspaceContext } from "../composables/workspaceContext";
const { busy, form, ldsResult, importLds, createRequest, closeDialog } =
  useWorkspaceContext();
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
          v-model="form.jcn"
          required
          placeholder="JCN-260184"
          @input="ldsResult = null"
        ></label><button
          type="button"
          :disabled="busy || !form.jcn"
          @click="importLds"
        >
          Import LDS
        </button>
      </div>
      <small v-if="!form.noJcn">Demo JCNs: JCN-260184 · JCN-260207</small>
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
        Submit request →
      </button>
    </div>
  </form>
</template>
