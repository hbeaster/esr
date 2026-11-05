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

<style scoped>
.plus {
  display: inline-block;
  font-size: var(--fs-lg);
  line-height: 1;
  transition: transform 0.25s var(--ease);
}
.new-request:hover .plus {
  transform: rotate(90deg);
}
.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--sp-3);
  margin-bottom: var(--sp-6);
}
.stat {
  --tone: var(--gray-dot);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--sp-1);
  padding: var(--sp-4);
  border: 1px solid var(--line);
  border-top: 3px solid var(--tone);
  border-radius: var(--radius);
  text-align: left;
  font-weight: 400;
  min-width: 0;
}
.stat.blue {
  --tone: var(--blue-dot);
}
.stat.amber {
  --tone: var(--amber-dot);
}
.stat.green {
  --tone: var(--green-dot);
}
.stat.selected {
  border-color: var(--esr-accent);
  border-top-color: var(--tone);
  background: var(--esr-accent-soft);
  box-shadow: 0 0 0 1px var(--esr-accent);
}
.stat-label {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-2);
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stat strong {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.15;
  color: var(--ink);
}
.stat-foot {
  font-size: var(--fs-xs);
  color: var(--ink-3);
  font-style: italic;
}
.filters {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.search {
  display: flex;
  align-items: center;
  position: relative;
  flex: 1;
  max-width: 520px;
  margin: 0;
}
.search > span {
  position: absolute;
  left: 11px;
  font-size: var(--fs-lg);
  color: var(--ink-4);
  pointer-events: none;
}
.search input {
  margin: 0;
  padding-left: 34px;
}
.filters select {
  width: 210px;
  margin: 0;
}
.result-count {
  margin-left: auto;
  font-size: var(--fs-sm);
  color: var(--ink-3);
  white-space: nowrap;
}
.result-count strong {
  color: var(--ink);
}
.table-scroll {
  overflow-x: auto;
  /* Contains the absolutely positioned .sr-only header inside the scroller. */
  position: relative;
  max-width: 100%;
}
table {
  border-collapse: collapse;
  width: 100%;
  text-align: left;
  font-size: var(--fs-sm);
}
thead {
  background: var(--surface-2);
  border-bottom: 1px solid var(--line);
}
th {
  padding: 10px var(--sp-4);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: var(--ink-3);
  white-space: nowrap;
}
th:first-child,
td:first-child {
  padding-left: var(--sp-5);
}
td {
  padding: 14px var(--sp-4);
  border-bottom: 1px solid var(--line-soft);
  vertical-align: middle;
}
tbody tr {
  transition: background 0.12s;
}
tbody tr:hover {
  background: #f6f9fe;
}
tbody tr:last-child td {
  border-bottom: none;
}
.record-link {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border: 0;
  padding: 0;
  background: none;
  text-align: left;
  gap: 2px;
  min-width: 260px;
  max-width: 420px;
  font-weight: 400;
}
.record-link:hover {
  background: transparent;
}
.record-link:hover strong {
  color: var(--esr-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.serial.pending {
  font-weight: 500;
  font-style: italic;
  color: var(--ink-4);
}
.record-link strong {
  font-weight: 600;
  font-size: var(--fs-base);
  color: var(--ink);
}
.record-link > .muted {
  font-size: var(--fs-xs);
}
.returned {
  color: var(--red-text);
  font-weight: 700;
}
.tags {
  display: flex;
  gap: var(--sp-1);
  flex-wrap: wrap;
  min-width: 100px;
}
.nowrap {
  white-space: nowrap;
  font-size: var(--fs-xs);
}
.row-open {
  transition:
    transform 0.2s var(--ease),
    color 0.15s,
    background 0.15s;
}
tbody tr:hover .row-open {
  color: var(--esr-accent);
  transform: translateX(2px);
}
.table-footer {
  padding: var(--sp-3) var(--sp-5);
  border-top: 1px solid var(--line);
  color: var(--ink-3);
  font-size: var(--fs-xs);
  font-style: italic;
}
@media (max-width: 1150px) {
  .stats {
    gap: var(--sp-2);
  }
  .stat {
    padding: var(--sp-3);
  }
  .stat-foot {
    display: none;
  }
}
@media (max-width: 850px) {
  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .filters {
    flex-wrap: wrap;
  }
}
@media (max-width: 560px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .stat:last-child {
    grid-column: span 2;
  }
  .filters {
    padding: var(--sp-3) var(--sp-4);
  }
  .search {
    flex-basis: 100%;
    max-width: none;
  }
  .filters select {
    flex: 1;
    width: auto;
  }
  th:first-child,
  td:first-child {
    padding-left: var(--sp-4);
  }
  .table-footer {
    padding: var(--sp-3) var(--sp-4);
  }
}
</style>
