<script setup lang="ts">
import { esrRevision, initials, date, steps, statusTone } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
const {
  state,
  scope,
  query,
  status,
  filtered,
  counts,
  owner,
  openRecord,
  newRequest,
} = useWorkspaceContext();
const stepHint: Record<string, string> = {
  Unassigned: "Needs an engineer",
  "In Process": "Resolution in progress",
  "Awaiting Approval": "Needs supervisor review",
  "ESR Issued": "Released to the shop",
  "ESR Closed": "Fully dispositioned",
};
</script>

<template>
  <template v-if="state.user">
    <div class="page-heading">
      <div>
        <h1>
          {{
            scope === "history"
              ? "Historical ESRs"
              : scope === "mine"
                ? "My work"
                : "Service requests"
          }}
        </h1>
        <p>
          {{
            scope === "history"
              ? "Closed records and their resolutions, for reference."
              : scope === "mine"
                ? "Requests assigned to you or submitted by you."
                : "Every request at your facility, from finding to closeout."
          }}
        </p>
      </div>
      <button
        v-if="
          ['Requestor', 'Shop', 'Engineer', 'Supervisor'].includes(
            state.user.role,
          )
        "
        class="primary new-request"
        @click="newRequest"
      >
        <span class="plus">＋</span> New request
      </button>
    </div>
    <section
      class="stats"
      aria-label="Workflow counts"
    >
      <button
        v-for="step in steps"
        :key="step"
        :class="['stat', statusTone(step), { selected: status === step }]"
        :aria-pressed="status === step"
        @click="status = status === step ? '' : step"
      >
        <span class="stat-label"><span :class="['status-dot', statusTone(step)]" />{{ step }}</span><strong>{{ counts[step] }}</strong><span class="stat-foot">{{ stepHint[step] }}</span>
      </button>
    </section>
    <section class="card workspace-card">
      <div class="filters">
        <label class="search"><span aria-hidden="true">⌕</span><input
          v-model="query"
          aria-label="Search requests"
          placeholder="Search serial, title, JCN, or attribute…"
        ></label><select
          v-model="status"
          aria-label="Filter by status"
        >
          <option value="">
            All statuses
          </option>
          <option
            v-for="step in [
              ...steps.slice(0, 4),
              'ESR Issued – Deferred',
              'ESR Closed',
            ]"
            :key="step"
          >
            {{ step }}
          </option>
        </select><button
          v-if="status || query"
          class="text-button"
          @click="
            status = '';
            query = '';
          "
        >
          Clear filters
        </button>
        <span class="result-count"><strong>{{ filtered.length }}</strong> of
          {{ state.records.length }}</span>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Status</th>
              <th>Engineer</th>
              <th>Attributes</th>
              <th>Updated</th>
              <th><span class="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in filtered"
              :key="r.id"
            >
              <td>
                <button
                  class="record-link"
                  @click="openRecord(r)"
                >
                  <span :class="['serial', { pending: !r.serial }]">{{ r.serial || "Pending assignment" }}
                    <span v-if="esrRevision(r.serial) && esrRevision(r.serial) !== 'A'">· Rev {{ esrRevision(r.serial) }}</span></span><strong>{{ r.title }}</strong><span class="muted">{{ r.jcn }}
                    <em
                      v-if="r.rejected"
                      class="returned"
                    >· Returned to requestor</em></span>
                </button>
              </td>
              <td>
                <span :class="['badge', statusTone(r.status)]"><span class="status-dot" />{{ r.status }}</span>
              </td>
              <td>
                <div
                  v-if="r.engineerId"
                  class="person"
                >
                  <span class="avatar mini">{{
                    initials(owner(r.engineerId))
                  }}</span><span>{{ owner(r.engineerId) }}</span>
                </div>
                <em
                  v-else
                  class="muted"
                >Unassigned</em>
              </td>
              <td>
                <div class="tags">
                  <span
                    v-if="r.dfs === 'yes'"
                    class="tag special"
                  >DFS</span><span
                    v-if="r.tvd === 'yes'"
                    class="tag special"
                  >TVD</span><span
                    v-for="a in r.attributes"
                    :key="a"
                    :class="['tag', { critical: a === 'SUBSAFE' }]"
                  >{{
                    a
                  }}</span><span
                    v-if="
                      !r.attributes.length && r.dfs !== 'yes' && r.tvd !== 'yes'
                    "
                    class="muted"
                  >—</span>
                </div>
              </td>
              <td class="nowrap muted">
                {{ date(r.updatedAt) }}
              </td>
              <td>
                <button
                  class="icon-button row-open"
                  :aria-label="`Open ${r.title}`"
                  @click="openRecord(r)"
                >
                  →
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="!filtered.length"
        class="empty"
      >
        <h3>No requests found</h3>
        <p>Adjust your filters or create a new request.</p>
      </div>
      <footer class="table-footer">
        <span>Synthetic demo data · every change is recorded in the audit
          trail</span>
      </footer>
    </section>
  </template>
</template>
