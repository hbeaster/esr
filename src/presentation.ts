import type { EsrRecord, Scope, WorkflowStatus } from "./types";
export const steps: WorkflowStatus[] = [
  "Unassigned",
  "In Process",
  "Awaiting Approval",
  "ESR Issued",
  "ESR Closed",
];
/** JCN: 5 digits, 4 letters or digits, then a 0001–9999 sequence (12345WX019999). */
export const JCN_PATTERN = "[0-9]{5}[A-Z0-9]{4}(?!0000)[0-9]{4}";
const jcnFormat = new RegExp(`^${JCN_PATTERN}$`);
export const normalizeJcn = (value: string): string =>
  value.trim().toUpperCase();
export const isJcn = (value: string): boolean =>
  jcnFormat.test(normalizeJcn(value));
export const statusTone = (status: string): string =>
  ({
    Unassigned: "gray",
    "In Process": "blue",
    "Awaiting Approval": "amber",
    "ESR Issued": "green",
    "ESR Issued – Deferred": "amber",
    "ESR Closed": "gray",
  })[status] || "gray";
export type EquipmentClass =
  | "pump"
  | "valve"
  | "heat-exchanger"
  | "electrical"
  | "sensor"
  | "ventilation"
  | "tank"
  | "engine"
  | "generic";
/** Ordered: the first class whose pattern matches wins. */
const equipmentPatterns: [EquipmentClass, RegExp][] = [
  ["pump", /\bpumps?\b|-p-/],
  ["valve", /\bvalves?\b|\bvlv\b|vlv-|\bactuators?\b/],
  [
    "heat-exchanger",
    /\bcoolers?\b|\bchill(?:er|ed water)\b|\bexchangers?\b|\bcondensers?\b/,
  ],
  [
    "electrical",
    /\bbreakers?\b|\bshore power\b|\bswitchboards?\b|\binsulation\b/,
  ],
  ["sensor", /\bsensors?\b|\bgauges?\b|\btransmitters?\b|\bcalibration\b/],
  ["ventilation", /\bdampers?\b|\bfans?\b|\bventilation\b/],
  ["tank", /\baccumulators?\b|\btanks?\b|\bheaders?\b/],
  ["engine", /\bdiesel\b|\bgears?\b|\bstarters?\b|\bmotors?\b/],
];
/**
 * Mock equipment class for the record's illustration, from keywords only.
 * Fields are checked in order, so the LDS component outranks the title.
 */
export function equipmentClass(
  record: Pick<
    EsrRecord,
    "component" | "title" | "workStatement" | "condition"
  >,
): EquipmentClass {
  const fields = [
    record.component,
    record.title,
    record.workStatement,
    plainText(record.condition),
  ];
  for (const field of fields) {
    const text = (field || "").toLowerCase();
    if (!text) continue;
    const hit = equipmentPatterns.find(([, pattern]) => pattern.test(text));
    if (hit) return hit[0];
  }
  return "generic";
}
export const equipmentClassLabel = (value: EquipmentClass): string =>
  ({
    pump: "Pump",
    valve: "Valve",
    "heat-exchanger": "Heat exchanger",
    electrical: "Electrical",
    sensor: "Sensor",
    ventilation: "Ventilation",
    tank: "Tank",
    engine: "Engine",
    generic: "Equipment",
  })[value];
/** Mock hull compartments, bow to stern. */
export const hullZones = [
  { id: "forward", label: "Forward" },
  { id: "operations", label: "Operations" },
  { id: "midships", label: "Midships" },
  { id: "auxiliary", label: "Auxiliary" },
  { id: "engineering", label: "Engineering" },
  { id: "aft", label: "Aft" },
] as const;
export type HullZone = (typeof hullZones)[number]["id"];
/** Ordered: auxiliary first so "Auxiliary machinery space" stays auxiliary. */
const hullZonePatterns: [HullZone, RegExp][] = [
  ["auxiliary", /\baux(?:iliary)?\b/],
  [
    "engineering",
    /\bengine room\b|\bpropulsion\b|\bturbines?\b|\bmotor room\b|\bmaneuvering\b/,
  ],
  ["aft", /\baft\b|\bstern\b|\bshafts?\b/],
  [
    "operations",
    /\bcontrol\b|\bsail\b|\boperations\b|\battack center\b|\bnavigation\b/,
  ],
  ["midships", /\bmidships?\b|\bberthing\b|\bmess\b|\bgalley\b/],
  ["forward", /\bforward\b|\bfwd\b|\bbow\b|\btorpedo\b/],
];
/** Mock hull zone for an LDS location, or null when blank or unrecognized. */
export function hullZone(location?: string | null): HullZone | null {
  const text = (location || "").trim().toLowerCase();
  if (!text) return null;
  return (
    hullZonePatterns.find(([, pattern]) => pattern.test(text))?.[0] ?? null
  );
}
export const hullZoneLabel = (zone: HullZone): string =>
  hullZones.find((z) => z.id === zone)!.label;
export const initials = (name?: string | null): string =>
  (name || "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
export const date = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const time = (value?: string): string =>
  value ? new Date(value).toLocaleString() : "";
/** Revision letters of a YYNNNN + A–ZZ number. Empty until a record is assigned. */
export const esrRevision = (serial?: string | null): string =>
  serial?.match(/^[0-9]{6}([A-Z]{1,2})$/)?.[1] ?? "";
export const esrTableColumns = [
  { id: "serial", label: "Serial" },
  { id: "jcn", label: "JCN" },
  { id: "refit", label: "Refit" },
  { id: "requester", label: "Requester" },
  { id: "shop", label: "Shop Code" },
  { id: "condition", label: "Condition" },
  { id: "resolution", label: "Resolution" },
  { id: "swbs", label: "SWBS" },
  { id: "status", label: "Status" },
  { id: "age", label: "Time in Status" },
  { id: "engineer", label: "Assigned Engineer" },
  { id: "initiated", label: "Date Initiated" },
] as const;
/** The stepper step a status belongs to. Deferred is a kind of issued. */
export const stepOf = (status: WorkflowStatus): WorkflowStatus =>
  status.startsWith("ESR Issued") ? "ESR Issued" : status;
type TimelineRecord = Pick<
  EsrRecord,
  "status" | "createdAt" | "name" | "audit" | "signatures"
>;
export interface TimelineStep {
  step: WorkflowStatus;
  state: "done" | "current" | "upcoming";
  /** When the record last entered this step, or null when no event records it. */
  enteredAt: string | null;
  actor: string | null;
  /** Time spent in the step: until it was left, or until now for the current step. */
  durationMs: number | null;
}
interface StepEvent {
  time: string;
  actor: string;
}
const latest = (events: StepEvent[]): StepEvent | null =>
  events.reduce<StepEvent | null>(
    (best, e) =>
      !best || Date.parse(e.time) > Date.parse(best.time) ? e : best,
    null,
  );
const inProcessAction = (action: string) =>
  ["assign", "return"].includes(action) || action.startsWith("Revision ");
/**
 * When each workflow step was last entered, by whom, and for how long.
 * Signed steps use signature times, because the API logs the action name
 * while signatures are uniform. Return and revise clear signatures, so only
 * the current cycle is shown.
 */
export function workflowTimeline(
  record: TimelineRecord,
  now = Date.now(),
): TimelineStep[] {
  const signed = (block: string) =>
    latest(
      record.signatures
        .filter((s) => s.block === block)
        .map((s) => ({ time: s.time, actor: s.name })),
    );
  const audited = (match: (action: string) => boolean) =>
    latest(
      record.audit
        .filter((a) => match(a.action))
        .map((a) => ({ time: a.time, actor: a.actor })),
    );
  const resubmitted = audited((a) => a === "resubmit");
  const submitted = latest([
    { time: record.createdAt, actor: record.name },
    ...(resubmitted ? [resubmitted] : []),
  ]);
  const entries: Record<string, StepEvent | null> = {
    Unassigned: submitted,
    "In Process": audited(inProcessAction),
    "Awaiting Approval": signed("Resolved By"),
    "ESR Issued": signed("Approved By"),
    "ESR Closed": signed("Division Head"),
  };
  // Unassigned ends at the first assignment after submission, not a later revision.
  const firstAssign = record.audit
    .filter(
      (a) =>
        a.action === "assign" &&
        submitted &&
        Date.parse(a.time) >= Date.parse(submitted.time),
    )
    .map((a) => Date.parse(a.time))
    .sort((a, b) => a - b)[0];
  const currentIndex = steps.indexOf(stepOf(record.status));
  return steps.map((step, index) => {
    const state =
      index < currentIndex
        ? "done"
        : index === currentIndex
          ? "current"
          : "upcoming";
    const entry = state === "upcoming" ? null : entries[step];
    let end: number | null = null;
    if (state === "current" && step !== "ESR Closed") end = now;
    else if (state === "done")
      end =
        step === "Unassigned" && firstAssign !== undefined
          ? firstAssign
          : entries[steps[index + 1]]
            ? Date.parse(entries[steps[index + 1]]!.time)
            : null;
    const start = entry ? Date.parse(entry.time) : NaN;
    return {
      step,
      state,
      enteredAt: entry?.time ?? null,
      actor: entry?.actor ?? null,
      durationMs:
        end !== null && !Number.isNaN(start) ? Math.max(0, end - start) : null,
    };
  });
}
/** Default warn and stale thresholds, in calendar days, for the time a record sits in a status. */
export const agingThresholdsDays: Partial<
  Record<WorkflowStatus, [warn: number, stale: number]>
> = {
  Unassigned: [3, 7],
  "In Process": [14, 30],
  "Awaiting Approval": [3, 7],
  "ESR Issued": [30, 60],
};
export type AgingTone = "ok" | "warn" | "stale";
/** How long the record has been in its current status. Null for statuses that do not age or have no entry time. */
export function statusAge(
  record: TimelineRecord,
  now = Date.now(),
): { since: string; ms: number; tone: AgingTone } | null {
  const thresholds = agingThresholdsDays[record.status];
  if (!thresholds) return null;
  const current = workflowTimeline(record, now).find(
    (s) => s.state === "current",
  );
  if (!current?.enteredAt || current.durationMs === null) return null;
  const days = current.durationMs / DAY_MS;
  return {
    since: current.enteredAt,
    ms: current.durationMs,
    tone:
      days >= thresholds[1] ? "stale" : days >= thresholds[0] ? "warn" : "ok",
  };
}
const DAY_MS = 86_400_000;
/** Compact duration: 45m, 6h, 3d 4h, 5w. */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 0)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14)
    return hours % 24 && days < 7 ? `${days}d ${hours % 24}h` : `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** Sentence for titles and screen readers, e.g. "In Process for 18 days, stale after 14". */
export function agingDescription(
  record: TimelineRecord,
  now = Date.now(),
): string {
  const age = statusAge(record, now);
  const thresholds = agingThresholdsDays[record.status];
  if (!age || !thresholds)
    return `${record.status}; time in status not tracked`;
  const days = Math.floor(age.ms / DAY_MS);
  const span = days >= 1 ? plural(days, "day") : formatDuration(age.ms);
  const limit =
    age.tone === "stale"
      ? `past the ${thresholds[1]}-day stale limit`
      : age.tone === "warn"
        ? `stale after ${thresholds[1]} days`
        : `warns after ${thresholds[0]} days`;
  return `${record.status} for ${span}, ${limit}`;
}
export type EsrTableColumnId = (typeof esrTableColumns)[number]["id"];
export type SortDirection = "asc" | "desc";
const statusSortOrder: WorkflowStatus[] = [
  "Unassigned",
  "In Process",
  "Awaiting Approval",
  "ESR Issued",
  "ESR Issued – Deferred",
  "ESR Closed",
];
type SortableRecord = Pick<
  EsrRecord,
  | "serial"
  | "jcn"
  | "refit"
  | "name"
  | "shop"
  | "condition"
  | "resolution"
  | "swbs"
  | "status"
  | "engineerId"
  | "createdAt"
  | "name"
  | "audit"
  | "signatures"
>;
/** Sort a copy. Blank values stay last in either direction, and equal values keep their current order. */
export function sortRecords<T extends SortableRecord>(
  records: T[],
  column: EsrTableColumnId | null,
  direction: SortDirection,
  engineerName: (id: string) => string = () => "",
): T[] {
  if (!column) return records;
  const sign = direction === "asc" ? 1 : -1;
  const key = (record: T): string | number | null => {
    const text = (value?: string | null) => value?.trim() || null;
    switch (column) {
      case "serial":
        return text(record.serial);
      case "jcn":
        return text(record.jcn);
      case "refit":
        return text(record.refit);
      case "requester":
        return text(record.name);
      case "shop":
        return text(record.shop);
      case "condition":
        return text(plainText(record.condition));
      case "resolution":
        return text(plainText(record.resolution));
      case "swbs":
        return text(record.swbs);
      case "status": {
        const index = statusSortOrder.indexOf(record.status);
        return index === -1 ? null : index;
      }
      case "engineer":
        return record.engineerId
          ? text(engineerName(record.engineerId))
          : "Unassigned";
      case "initiated": {
        const time = Date.parse(record.createdAt);
        return Number.isNaN(time) ? null : time;
      }
      case "age": {
        // Oldest first when ascending, so the most urgent rows lead.
        const since = statusAge(record)?.since;
        return since ? Date.parse(since) : null;
      }
    }
  };
  return records
    .map((record, index) => ({ record, index, value: key(record) }))
    .sort((left, right) => {
      if (left.value === null && right.value === null)
        return left.index - right.index;
      if (left.value === null) return 1;
      if (right.value === null) return -1;
      const compared =
        typeof left.value === "number" && typeof right.value === "number"
          ? left.value - right.value
          : String(left.value).localeCompare(String(right.value), undefined, {
              numeric: true,
              sensitivity: "base",
            });
      return compared === 0 ? left.index - right.index : compared * sign;
    })
    .map(({ record }) => record);
}
type SearchableRecord = Pick<
  EsrRecord,
  | "title"
  | "serial"
  | "jcn"
  | "refit"
  | "name"
  | "shop"
  | "condition"
  | "resolution"
  | "swbs"
  | "attributes"
  | "engineerId"
  | "status"
> &
  Partial<Pick<EsrRecord, "requestorId" | "location">>;
export function filterRecords<T extends SearchableRecord>(
  records: T[],
  query: string,
  status: string,
  scope: Scope,
  userId?: string,
  zone: HullZone | "" = "",
): T[] {
  const search = query.trim().toLowerCase();
  return records.filter(
    (r) =>
      (!search ||
        [
          r.title,
          r.serial,
          r.jcn,
          r.refit,
          r.name,
          r.shop,
          plainText(r.condition),
          plainText(r.resolution),
          r.swbs,
          ...r.attributes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)) &&
      (!status || r.status === status) &&
      (scope !== "mine" ||
        r.engineerId === userId ||
        r.requestorId === userId) &&
      (scope !== "history" || r.status === "ESR Closed") &&
      (!zone || hullZone(r.location) === zone),
  );
}
const richTags = new Set([
  "P",
  "BR",
  "DIV",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "UL",
  "OL",
  "LI",
]);
const droppedTags = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "NOSCRIPT",
  "TEMPLATE",
]);
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
/** Keep paragraphs, line breaks, emphasis, and lists. Drop every other tag and its unsafe contents. */
export function sanitizeRichText(value: string): string {
  if (!value) return "";
  const doc = new DOMParser().parseFromString(
    `<div>${value}</div>`,
    "text/html",
  );
  const root = doc.body.firstElementChild;
  if (!root) return "";
  const clean = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE)
      return doc.createTextNode(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const element = node as HTMLElement;
    if (droppedTags.has(element.tagName)) return null;
    if (!richTags.has(element.tagName)) {
      const fragment = doc.createDocumentFragment();
      element.childNodes.forEach((child) => {
        const next = clean(child);
        if (next) fragment.append(next);
      });
      return fragment;
    }
    const copy = doc.createElement(element.tagName.toLowerCase());
    element.childNodes.forEach((child) => {
      const next = clean(child);
      if (next) copy.append(next);
    });
    return copy;
  };
  const out = doc.createElement("div");
  root.childNodes.forEach((child) => {
    const next = clean(child);
    if (next) out.append(next);
  });
  return out.innerHTML;
}
export function plainText(value?: string | null): string {
  return sanitizeRichText(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
/** Show stored plain text or sanitized formatting. Plain text keeps its line breaks. */
export function richTextHtml(value?: string | null): string {
  const source = value ?? "";
  if (!source.trim()) return "";
  if (/<\/?[a-z][^>]*>/i.test(source)) return sanitizeRichText(source);
  return escapeHtml(source).replace(/\n/g, "<br>");
}
export function appendRichText(current: string, addition: string): string {
  const base = richTextHtml(current);
  const next = richTextHtml(addition);
  if (!plainText(base)) return next;
  if (!plainText(next)) return base;
  return `${base}<br><br>${next}`;
}
