<script setup lang="ts">
import { useWorkspaceContext } from "../composables/workspaceContext";
const {
  state,
  busy,
  dialog,
  draft,
  searchResult,
  current,
  record,
  editable,
  saveDraft,
  findHistory,
  copyMatch,
  useMatch,
} = useWorkspaceContext();
</script>

<template>
  <template v-if="record && current && state.user">
    <div
      v-if="editable"
      class="ai-panel"
    >
      <div>
        <span class="eyebrow">ASSISTED RESOLUTION</span>
        <h2>A useful starting point, grounded in history.</h2>
        <p>Summarize this finding and find similar closed ESRs.</p>
      </div>
      <button
        :disabled="busy"
        @click="findHistory"
      >
        ✧ Summarize & search
      </button><small>Synthetic similarity results. Engineer verification is always
        required.</small>
    </div>
    <div
      v-if="searchResult"
      class="card padded"
    >
      <h2>Conceptual summary</h2>
      <p>{{ searchResult.summary }}</p>
      <h3>Similar resolved ESRs</h3>
      <article
        v-for="match in searchResult.matches"
        :key="match.id"
        class="match"
      >
        <div>
          <span class="serial">{{ match.serial }}</span>
          <h3>{{ match.title }}</h3>
          <span class="badge green">{{ match.similarity }}% similarity</span>
        </div>
        <div class="action-row">
          <button @click="copyMatch(match)">
            Copy text
          </button><button
            class="primary small"
            @click="useMatch(match)"
          >
            Use in draft
          </button>
        </div>
      </article>
      <p v-if="!searchResult.matches.length">
        No historical matches are available.
      </p>
    </div>
    <form
      class="card padded"
      @submit.prevent="saveDraft"
    >
      <div class="section-heading">
        <div>
          <h2>Engineering resolution</h2>
          <p class="muted">
            {{
              editable
                ? "Prepare the technical direction and supporting rationale."
                : "Read-only engineering record"
            }}
          </p>
        </div>
        <button
          v-if="editable"
          type="button"
          @click="dialog = 'templates'"
        >
          ▤ Insert template
        </button>
      </div>
      <label>Resolution<textarea
        v-if="editable"
        v-model="draft.resolution"
        rows="10"
        placeholder="Document the steps required to resolve the finding…"
      />
        <div
          v-else
          class="prose readonly-text"
        >
          {{ record.resolution || "Not yet drafted." }}
        </div></label><label>Engineering rationale<textarea
        v-if="editable"
        v-model="draft.rationale"
        rows="5"
        placeholder="Explain the technical basis for this resolution…"
      />
        <div
          v-else
          class="prose readonly-text"
        >
          {{ record.rationale || "Not yet drafted." }}
        </div></label>
      <div
        v-if="editable"
        class="reference-prompts"
      >
        <h3>References & attributes</h3>
        <label>1. DFS Required?<select
          v-model="draft.dfs"
          required
        >
          <option value="">Select an answer</option>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select></label><label v-if="draft.dfs === 'yes'">DFS reference / document number<input
          v-model="draft.dfsReference"
          required
        ></label><template v-if="draft.dfs">
          <label>2. TVD Required?<select
            v-model="draft.tvd"
            required
          >
            <option value="">Select an answer</option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select></label><label v-if="draft.tvd === 'yes'">TVD reference / document number<input
            v-model="draft.tvdReference"
            required
          ></label>
        </template>
        <fieldset>
          <legend>Applicable attributes</legend>
          <label
            v-for="a in ['Level 1', 'Requires Rev', 'SOC', 'SUBSAFE']"
            :key="a"
            class="check"
          ><input
            v-model="draft.attributes"
            type="checkbox"
            :value="a"
          >{{
            a
          }}</label>
        </fieldset>
      </div>
      <div
        v-else
        class="fields-grid read-fields"
      >
        <div>
          <span>DFS REQUIRED</span><strong>{{ record.dfs || "Not answered" }}
            {{ record.dfsReference }}</strong>
        </div>
        <div>
          <span>TVD REQUIRED</span><strong>{{ record.tvd || "Not answered" }}
            {{ record.tvdReference }}</strong>
        </div>
      </div>
      <div
        v-if="editable"
        class="form-footer"
      >
        <span class="muted">Save your changes before signing.</span><button
          class="primary"
          :disabled="busy"
        >
          Save draft
        </button>
      </div>
    </form>
  </template>
</template>
