<script setup lang="ts">
import RichTextField from "./RichTextField.vue";
import RichTextView from "./RichTextView.vue";
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
      <RichTextField
        v-if="editable"
        v-model="draft.resolution"
        label="Resolution"
        min-height="180px"
        placeholder="Document the steps required to resolve the finding…"
      />
      <div
        v-else
        class="read-block"
      >
        <span class="rich-label">Resolution</span>
        <RichTextView
          class="readonly-text"
          :value="record.resolution"
          empty="Not yet drafted."
        />
      </div>
      <RichTextField
        v-if="editable"
        v-model="draft.rationale"
        label="Engineering rationale"
        min-height="120px"
        placeholder="Explain the technical basis for this resolution…"
      />
      <div
        v-else
        class="read-block"
      >
        <span class="rich-label">Engineering rationale</span>
        <RichTextView
          class="readonly-text"
          :value="record.rationale"
          empty="Not yet drafted."
        />
      </div>
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

<style scoped>
.read-block {
  margin: var(--sp-4) 0;
}
.readonly-text {
  padding: var(--sp-2) 0;
  font-weight: 400;
  color: var(--ink);
}
.ai-panel {
  background: linear-gradient(135deg, #eef3fd, #f6f8fc);
  border: 1px solid var(--blue-line);
  border-radius: var(--radius);
  padding: var(--sp-5);
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3) var(--sp-4);
  align-items: center;
}
.ai-panel .eyebrow {
  color: var(--blue-text);
}
.ai-panel h2 {
  margin: var(--sp-1) 0;
}
.ai-panel p {
  font-size: var(--fs-sm);
  color: var(--ink-3);
  margin: 0;
}
.ai-panel button {
  margin-left: auto;
}
.ai-panel small {
  flex-basis: 100%;
  font-size: var(--fs-xs);
  font-style: italic;
  color: var(--amber-text);
}
.match {
  border-top: 1px solid var(--line-soft);
  padding: var(--sp-4) 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
}
.match h3 {
  margin: var(--sp-1) 0 var(--sp-2);
}
.reference-prompts {
  background: var(--surface-2);
  border: 1px solid var(--line-soft);
  padding: var(--sp-5);
  border-radius: var(--radius);
  margin-top: var(--sp-6);
}
.reference-prompts h3 {
  margin-bottom: 0;
}
@media (max-width: 560px) {
  .match {
    flex-wrap: wrap;
  }
}
</style>
