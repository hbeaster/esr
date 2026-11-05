<script setup lang="ts">
import { computed, ref } from "vue";
import {
  esrRevision,
  esrTableColumns,
  initials,
  date,
  plainText,
  sortRecords,
  steps,
  statusTone,
} from "../presentation";
import type { EsrTableColumnId, SortDirection } from "../presentation";
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
const hiddenColumns = ref<EsrTableColumnId[]>([]);
function visible(id: EsrTableColumnId) {
  return !hiddenColumns.value.includes(id);
}
function toggleColumn(id: EsrTableColumnId) {
  hiddenColumns.value = visible(id)
    ? [...hiddenColumns.value, id]
    : hiddenColumns.value.filter((column) => column !== id);
}
function text(value?: string | null) {
  const trimmed = plainText(value);
  return trimmed || "—";
}
const visibleCount = computed(
  () => esrTableColumns.length - hiddenColumns.value.length,
);
const sortColumn = ref<EsrTableColumnId | null>(null);
const sortDirection = ref<SortDirection>("asc");
const rows = computed(() =>
  sortRecords(filtered.value, sortColumn.value, sortDirection.value, (id) =>
    owner(id),
  ),
);
function toggleSort(id: EsrTableColumnId) {
  if (sortColumn.value === id) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortColumn.value = id;
  sortDirection.value = "asc";
}
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
      v-if="scope === 'mine'"
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
          placeholder="Search serial, JCN, requester, shop, or condition…"
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
        <details class="column-picker">
          <summary>
            <span>Columns</span><span
              class="column-count"
              :class="{ partial: visibleCount < esrTableColumns.length }"
            >{{ visibleCount }}</span>
          </summary>
          <fieldset>
            <legend>Visible columns</legend>
            <label
              v-for="column in esrTableColumns"
              :key="column.id"
            >
              <input
                type="checkbox"
                :checked="visible(column.id)"
                :aria-label="`Show ${column.label}`"
                @change="toggleColumn(column.id)"
              ><span>{{ column.label }}</span>
            </label>
          </fieldset>
        </details>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <template
                v-for="column in esrTableColumns"
                :key="column.id"
              >
                <th
                  v-if="visible(column.id)"
                  :aria-sort="
                    sortColumn === column.id
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  "
                >
                  <button
                    type="button"
                    class="sort-button"
                    :aria-label="`Sort by ${column.label}`"
                    @click="toggleSort(column.id)"
                  >
                    {{ column.label
                    }}<span
                      v-if="sortColumn === column.id"
                      class="sort-mark"
                      aria-hidden="true"
                    >{{ sortDirection === "asc" ? "↑" : "↓" }}</span>
                  </button>
                </th>
              </template>
              <th><span class="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in rows"
              :key="r.id"
            >
              <td v-if="visible('serial')">
                <button
                  class="record-link"
                  @click="openRecord(r)"
                >
                  <span class="serial">{{ r.serial || "PENDING ASSIGNMENT" }}
                    <span v-if="esrRevision(r.serial) && esrRevision(r.serial) !== 'A'">· REV {{ esrRevision(r.serial) }}</span></span>
                  <span
                    v-if="r.rejected"
                    class="muted"
                  >Returned to requestor</span>
                </button>
              </td>
              <td v-if="visible('jcn')">
                {{ text(r.jcn) }}
              </td>
              <td v-if="visible('refit')">
                {{ text(r.refit) }}
              </td>
              <td v-if="visible('requester')">
                {{ text(r.name) }}
              </td>
              <td v-if="visible('shop')">
                {{ text(r.shop) }}
              </td>
              <td v-if="visible('condition')">
                <span
                  class="cell-clip"
                  :title="r.condition"
                >{{ text(r.condition) }}</span>
              </td>
              <td v-if="visible('resolution')">
                <span
                  class="cell-clip"
                  :title="r.resolution"
                >{{ text(r.resolution) }}</span>
              </td>
              <td v-if="visible('swbs')">
                {{ text(r.swbs) }}
              </td>
              <td v-if="visible('status')">
                <span :class="['badge', statusTone(r.status)]"><span class="status-dot" />{{ r.status }}</span>
              </td>
              <td v-if="visible('engineer')">
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
                >Unassigned</span>
              </td>
              <td
                v-if="visible('initiated')"
                class="nowrap"
              >
                {{ date(r.createdAt) }}
              </td>
              <td>
                <button
                  class="icon-button"
                  :aria-label="`Open ${r.serial || 'unassigned request'}`"
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
