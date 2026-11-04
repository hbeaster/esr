<script setup lang="ts">
import { initials, date, steps, statusTone } from "../presentation";
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
</script>

<template>
  <template v-if="state.user">
    <div class="page-heading">
      <div>
        <div class="eyebrow">
          ENGINEERING OPERATIONS
        </div>
        <h1>
          {{
            scope === "history"
              ? "Historical ESRs"
              : scope === "mine"
                ? "My work"
                : "Service requests"
          }}<span class="heading-dot">.</span>
        </h1>
        <p>
          {{
            scope === "history"
              ? "Find prior resolutions and explore the complete engineering record."
              : "A clear path from finding to resolution."
          }}
        </p>
      </div>
      <button
        v-if="
          ['Requestor', 'Shop', 'Engineer', 'Supervisor'].includes(
            state.user.role,
          )
        "
        class="primary"
        @click="newRequest"
      >
        <span>＋</span> New request
      </button>
    </div>
    <section
      class="stats"
      aria-label="Workflow counts"
    >
      <button
        v-for="(step, i) in steps"
        :key="step"
        :class="['stat', { selected: status === step }]"
        @click="status = status === step ? '' : step"
      >
        <span class="stat-label"><span :class="['status-dot', statusTone(step)]" />{{ step }}</span><strong>{{ counts[step] }}</strong><span class="stat-foot">{{
                                                                                                                                                                 [
                                                                                                                                                                   "Ready for assignment",
                                                                                                                                                                   "Engineering in progress",
                                                                                                                                                                   "Ready for technical review",
                                                                                                                                                                   "Released to the shop",
                                                                                                                                                                   "Work fully dispositioned",
                                                                                                                                                                 ][i]
                                                                                                                                                               }}
          <span>↗</span></span>
      </button>
    </section>
    <section
      v-if="scope !== 'history'"
      class="focus-banner"
    >
      <div class="focus-symbol">
        ⌁
      </div>
      <div>
        <span class="eyebrow">KEEP WORK MOVING</span>
        <h2>
          {{
            counts["Awaiting Approval"]
              ? `${counts["Awaiting Approval"]} request${counts["Awaiting Approval"] === 1 ? "" : "s"} ready for technical review`
              : "Every detail, in one engineering record"
          }}
        </h2>
        <p>
          Review the resolution, verify references, and sign with confidence.
        </p>
      </div>
      <button
        class="text-button"
        @click="status = 'Awaiting Approval'"
      >
        View approval queue <span>→</span>
      </button>
    </section>
    <section class="card workspace-card">
      <div class="table-title">
        <div>
          <h2>
            {{
              scope === "history"
                ? "Resolved engineering records"
                : scope === "mine"
                  ? "Assigned to you & your requests"
                  : "Request workspace"
            }}
          </h2>
          <span>{{ filtered.length }} records
            <span class="muted">· Live demo data</span></span>
        </div>
        <span class="small-tag">{{ state.user.site.toUpperCase() }}</span>
      </div>
      <div class="filters">
        <label class="search"><span>⌕</span><input
          v-model="query"
          aria-label="Search requests"
          placeholder="Search serial, title, JCN, or attribute…"
        ><kbd>⌕</kbd></label><select
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
          Clear
        </button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>REQUEST / SERIAL</th>
              <th>STATUS</th>
              <th>ENGINEER</th>
              <th>ATTRIBUTES</th>
              <th>UPDATED</th>
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
                  <span class="serial">{{ r.serial || "PENDING ASSIGNMENT" }}
                    <span v-if="r.revision">· REV {{ r.serial?.slice(6) }}</span></span><strong>{{ r.title }}</strong><span class="muted">{{ r.jcn }}
                    <span v-if="r.rejected">· Returned to requestor</span></span>
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
                <span
                  v-else
                  class="muted"
                >— Unassigned</span>
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
                    class="tag"
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
                  class="icon-button"
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
        <span>Showing {{ filtered.length }} of
          {{ state.records.length }} accessible requests</span><span><span class="live-dot" /> All changes are recorded</span>
      </footer>
    </section>
    <div class="workspace-footer">
      <span>TRIDENT REFIT FACILITY <span> / </span> ENGINEERING SERVICES</span><span>Synthetic demonstration · v0.1</span>
    </div>
  </template>
</template>
