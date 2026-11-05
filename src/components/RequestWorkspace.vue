<script setup lang="ts">
import { computed, ref } from "vue";
import {
  agingDescription,
  esrRevision,
  formatDuration,
  statusAge,
  stepOf,
  esrTableColumns,
  hullZoneLabel,
  initials,
  date,
  plainText,
  sortRecords,
  steps,
  statusTone,
} from "../presentation";
import type { EsrTableColumnId, SortDirection } from "../presentation";
import { useWorkspaceContext } from "../composables/workspaceContext";
import HullHeatmap from "./HullHeatmap.vue";
import { useNow } from "../composables/useNow";
const {
  state,
  scope,
  query,
  status,
  zone,
  watchFloor,
  fleet,
  fleetNow,
  filtered,
  counts,
  owner,
  openRecord,
  newRequest,
} = useWorkspaceContext();
const now = useNow();
const ages = computed(
  () =>
    new Map(state.records.map((r) => [r.id, statusAge(r, now.value)])),
);
/** Stale records per stepper step, for the stat card triage line. Follows the fleet replay. */
const staleCounts = computed(() => {
  const result: Record<string, number> = {};
  for (const r of fleet.value)
    if (statusAge(r, fleetNow.value)?.tone === "stale")
      result[stepOf(r.status)] = (result[stepOf(r.status)] || 0) + 1;
  return result;
});
const tableCard = ref<HTMLElement | null>(null);
/** From a capped compartment dive: bring the zone-filtered table into view. */
function showAllInTable() {
  tableCard.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  tableCard.value?.focus({ preventScroll: true });
}
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
      <div class="heading-actions">
        <button
          class="watch-floor-open"
          @click="watchFloor = true"
        >
          <span aria-hidden="true">⛶</span> Watch floor
        </button>
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
        <span class="stat-label"><span :class="['status-dot', statusTone(step)]" />{{ step }}</span><strong>{{ counts[step] }}</strong><span
          v-if="staleCounts[step]"
          class="stat-foot stale"
        >{{ staleCounts[step] }} stale</span><span
          v-else
          class="stat-foot"
        >{{ stepHint[step] }}</span>
      </button>
    </section>
    <HullHeatmap @show-all="showAllInTable" />
    <section
      ref="tableCard"
      class="card workspace-card"
      tabindex="-1"
    >
      <div class="filters">
        <label class="search"><span aria-hidden="true">⌕</span><input
          v-model="query"
          aria-label="Search requests"
          placeholder="Search serial, JCN, requester, shop, or condition…"
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
          v-if="zone"
          class="zone-filter"
          :aria-label="`Remove zone filter ${hullZoneLabel(zone)}`"
          @click="zone = ''"
        >
          Zone: {{ hullZoneLabel(zone) }} <span aria-hidden="true">×</span>
        </button><button
          v-if="status || query || zone"
          class="text-button"
          @click="
            status = '';
            query = '';
            zone = '';
          "
        >
          Clear filters
        </button>
        <span class="result-count"><strong>{{ filtered.length }}</strong> of
          {{ state.records.length }}</span>
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
                  <span :class="['serial', { pending: !r.serial }]">{{ r.serial || "Pending assignment" }}
                    <span v-if="esrRevision(r.serial) && esrRevision(r.serial) !== 'A'">· Rev {{ esrRevision(r.serial) }}</span></span>
                  <em
                    v-if="r.rejected"
                    class="returned"
                  >Returned to requestor</em>
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
              <td
                v-if="visible('age')"
                class="nowrap"
              >
                <span
                  v-if="ages.get(r.id)"
                  :class="['age', ages.get(r.id)!.tone]"
                  :title="agingDescription(r, now)"
                ><span
                  v-if="ages.get(r.id)!.tone === 'stale'"
                  aria-hidden="true"
                >!</span>{{ formatDuration(ages.get(r.id)!.ms)
                }}<span class="sr-only">, {{ agingDescription(r, now) }}</span></span>
                <span
                  v-else
                  class="muted"
                >—</span>
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
                <em
                  v-else
                  class="muted"
                >Unassigned</em>
              </td>
              <td
                v-if="visible('initiated')"
                class="nowrap"
              >
                {{ date(r.createdAt) }}
              </td>
              <td>
                <button
                  class="icon-button row-open"
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
.stat-foot.stale {
  color: var(--red-text);
  font-style: normal;
  font-weight: 700;
}
.age {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--gray-line);
  background: var(--gray-bg);
  color: var(--gray-text);
  font-size: var(--fs-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.age.warn {
  border-color: var(--amber-line);
  background: var(--amber-bg);
  color: var(--amber-text);
}
.age.stale {
  border-color: var(--red-line);
  background: var(--red-bg);
  color: var(--red-text);
}
.age.stale > span[aria-hidden] {
  font-weight: 800;
}
.workspace-card {
  min-width: 0;
  outline: none;
  max-width: 100%;
}
.heading-actions {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
  flex-wrap: wrap;
}
.zone-filter {
  padding: 3px 10px;
  border-radius: 999px;
  border-color: var(--esr-accent);
  background: var(--esr-accent-soft);
  color: var(--esr-accent-text);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.filters {
  display: flex;
  flex-wrap: wrap;
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
/* Column picker: a native <details> popover of column toggles. */
.column-picker {
  position: relative;
  z-index: 4;
}
.column-picker summary {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  list-style: none;
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 8px var(--sp-3);
  background: var(--surface);
  color: var(--ink-2);
  font-size: var(--fs-sm);
  font-weight: 600;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.column-picker summary:hover {
  background: var(--surface-2);
  border-color: #b9c2ce;
}
.column-picker summary::-webkit-details-marker {
  display: none;
}
.column-picker summary::after {
  content: "";
  width: 6px;
  height: 6px;
  margin-left: 2px;
  border-right: 1.5px solid var(--ink-4);
  border-bottom: 1.5px solid var(--ink-4);
  transform: translateY(-2px) rotate(45deg);
  transition: transform 0.2s var(--ease);
}
.column-picker[open] summary::after {
  transform: translateY(1px) rotate(225deg);
}
.column-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--gray-bg);
  color: var(--ink-3);
  font-size: var(--fs-xs);
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}
.column-count.partial {
  background: var(--esr-accent-soft);
  color: var(--esr-accent-text);
}
.column-picker fieldset {
  position: absolute;
  z-index: 3;
  right: 0;
  top: calc(100% + 6px);
  width: 340px;
  margin: 0;
  padding: var(--sp-2);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 12px 32px #0f1a2a1f;
}
.column-picker legend {
  grid-column: 1 / -1;
  margin: var(--sp-1) var(--sp-2) 6px;
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.column-picker label {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0;
  padding: 7px var(--sp-2);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--ink-2);
  cursor: pointer;
}
.column-picker label:hover {
  background: var(--surface-2);
}
.column-picker input {
  width: 15px;
  height: 15px;
  margin: 0;
  padding: 0;
  flex: none;
  accent-color: var(--esr-accent);
  box-shadow: none;
}
.column-picker input:focus-visible {
  outline: 2px solid var(--esr-accent);
  outline-offset: 2px;
}
.cell-clip {
  display: block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  min-width: 0;
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
.sort-button {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  gap: var(--sp-1);
}
.sort-button:hover,
th[aria-sort="ascending"] .sort-button,
th[aria-sort="descending"] .sort-button {
  background: transparent;
  border-color: transparent;
  color: var(--ink);
}
.sort-button:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.sort-mark {
  color: var(--esr-accent);
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
  min-width: 150px;
  font-weight: 400;
}
.record-link:hover {
  background: transparent;
}
.record-link:hover .serial:not(.pending) {
  color: var(--esr-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.serial.pending {
  font-weight: 500;
  font-style: italic;
  color: var(--ink-4);
}
.returned {
  color: var(--red-text);
  font-size: var(--fs-xs);
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
@container (max-width: 1150px) {
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
@container (max-width: 850px) {
  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@container (max-width: 560px) {
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
  .column-picker fieldset {
    left: 0;
    right: auto;
    width: min(340px, calc(100vw - 32px));
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
