import DOMPurify from "dompurify";
import { marked } from "marked";
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
    // The earliest match wins, so the subject ("Galley exhaust damper —
    // calibration drift") outranks words in the finding that follows it.
    let best: { kind: EquipmentClass; at: number } | null = null;
    for (const [kind, pattern] of equipmentPatterns) {
      const at = text.search(pattern);
      if (at !== -1 && (!best || at < best.at)) best = { kind, at };
    }
    if (best) return best.kind;
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
/**
 * The boat's three compartments, bow to stern, and their levels top to
 * bottom. Frame ranges are mock and not to scale.
 */
export const compartments = [
  {
    id: "forward",
    label: "FWD Compartment",
    short: "FWD",
    frames: [1, 45],
    levels: ["upper", "second", "third", "lower"],
  },
  {
    id: "missile",
    label: "Missile Compartment",
    short: "Missile",
    frames: [46, 110],
    levels: ["upper", "second", "third", "lower"],
  },
  {
    id: "engine",
    label: "Engine Room",
    short: "Engine Room",
    frames: [111, 160],
    levels: ["upper", "middle", "lower"],
  },
] as const;
export type CompartmentId = (typeof compartments)[number]["id"];
export type Level = "upper" | "second" | "third" | "middle" | "lower";
export type Side = "port" | "starboard" | "centerline";
export type Board = "inboard" | "outboard";
export interface ShipLocation {
  compartment: CompartmentId;
  level: Level | null;
  frame: number | null;
  side: Side | null;
  board: Board | null;
}
export const levelLabels: Record<Level, string> = {
  upper: "Upper level",
  second: "Second level",
  third: "Third level",
  middle: "Middle level",
  lower: "Lower level",
};
export const compartmentOf = (id: CompartmentId) =>
  compartments.find((c) => c.id === id)!;
export const levelsOf = (id: CompartmentId): readonly Level[] =>
  compartmentOf(id).levels;

const compartmentPatterns: [CompartmentId, RegExp][] = [
  ["missile", /\bmissile\b|\bmc\b/],
  ["engine", /\bengine room\b|\ber\b|\bengineroom\b/],
  ["forward", /\bfwd\b|\bforward\b/],
];
const levelPatterns: [Level, RegExp][] = [
  ["upper", /\bupper\b|\b1st\b|\bfirst\b/],
  ["second", /\bsecond\b|\b2nd\b/],
  ["third", /\bthird\b|\b3rd\b/],
  ["middle", /\bmiddle\b|\bmid\b/],
  ["lower", /\blower\b|\bbottom\b/],
];
/**
 * Reads a location written as "<Compartment>, <level> level, frame <n>,
 * <port|starboard|centerline>, <inboard|outboard>", for example
 * "Missile Compartment, second level, frame 64, port, outboard". Tolerates
 * abbreviations (FWD, ER, 2nd, stbd, fr 64), any order, and any case. A level
 * the compartment does not have is dropped. Null when no compartment is named.
 */
export function parseLocation(text?: string | null): ShipLocation | null {
  const t = (text ?? "").toLowerCase();
  const compartment = compartmentPatterns.find(([, p]) => p.test(t))?.[0];
  if (!compartment) return null;
  const level = levelPatterns.find(([, p]) => p.test(t))?.[0] ?? null;
  const frame = /\b(?:frame|fr)\.?\s*(\d{1,3})\b/.exec(t);
  const side = /\bport\b/.test(t)
    ? "port"
    : /\bstarboard\b|\bstbd\b/.test(t)
      ? "starboard"
      : /\bcenter\s*line\b|\bcentreline\b/.test(t)
        ? "centerline"
        : null;
  const board = /\binboard\b/.test(t)
    ? "inboard"
    : /\boutboard\b/.test(t)
      ? "outboard"
      : null;
  return {
    compartment,
    level: level && levelsOf(compartment).includes(level) ? level : null,
    frame: frame ? Number(frame[1]) : null,
    side,
    board,
  };
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Nautical description, e.g. "Missile Compartment · Second level · Frame 64 · Port, outboard". */
export function describeLocation(loc: ShipLocation): string {
  const parts: string[] = [compartmentOf(loc.compartment).label];
  if (loc.level) parts.push(levelLabels[loc.level]);
  if (loc.frame !== null) parts.push(`Frame ${loc.frame}`);
  const lateral = [loc.side && capital(loc.side), loc.board].filter(Boolean);
  if (loc.side === "centerline") lateral.splice(1);
  if (lateral.length)
    parts.push(
      lateral.length === 2
        ? `${lateral[0]}, ${lateral[1]}`
        : capital(String(lateral[0])),
    );
  return parts.join(" · ");
}
/**
 * A place filter is a compartment ("missile") or a compartment and level
 * ("missile/second"). Empty matches everything.
 */
export type PlaceKey = "" | CompartmentId | `${CompartmentId}/${Level}`;
export const placeKey = (
  compartment: CompartmentId,
  level?: Level | null,
): PlaceKey => (level ? `${compartment}/${level}` : compartment);
export function splitPlace(key: PlaceKey): {
  compartment: CompartmentId | null;
  level: Level | null;
} {
  const [compartment, level] = key.split("/") as [CompartmentId?, Level?];
  return { compartment: compartment || null, level: level ?? null };
}
export function inPlace(
  location: string | null | undefined,
  key: PlaceKey,
): boolean {
  if (!key) return true;
  const loc = parseLocation(location);
  const { compartment, level } = splitPlace(key);
  return (
    !!loc && loc.compartment === compartment && (!level || loc.level === level)
  );
}
export function placeLabel(key: PlaceKey): string {
  const { compartment, level } = splitPlace(key);
  if (!compartment) return "";
  const name = compartmentOf(compartment).label;
  return level ? `${name} · ${levelLabels[level]}` : name;
}
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
const liveVerbs: Record<string, string> = {
  create: "created",
  assign: "assigned",
  reject: "rejected",
  resubmit: "resubmitted",
  delete: "deleted",
  draft: "updated the draft of",
  resolve: "resolved",
  approve: "approved",
  return: "returned",
  complete: "signed shop work on",
  close: "closed",
  revise: "revised",
  comment: "commented on",
  attach: "attached a file to",
};
/** Past-tense phrase for a pushed action, e.g. "approved" in "Casey Rivera approved this record". */
export const liveVerb = (action: string): string =>
  liveVerbs[action] ?? "updated";
const toneRank: Record<AgingTone, number> = { stale: 0, warn: 1, ok: 2 };
/**
 * Records ordered most critical first: stale, then aging, then on track, then
 * statuses that do not age (deferred, closed). SUBSAFE breaks ties within a
 * tone, then the longest time in status. Each record's age is computed once.
 */
export function rankByCriticality<T extends EsrRecord>(
  records: T[],
  now = Date.now(),
): { record: T; age: ReturnType<typeof statusAge> }[] {
  return records
    .map((record) => ({ record, age: statusAge(record, now) }))
    .sort(
      (a, b) =>
        (a.age ? toneRank[a.age.tone] : 3) -
          (b.age ? toneRank[b.age.tone] : 3) ||
        Number(b.record.attributes.includes("SUBSAFE")) -
          Number(a.record.attributes.includes("SUBSAFE")) ||
        (b.age?.ms ?? 0) - (a.age?.ms ?? 0),
    );
}
const at = (value: string) => Date.parse(value);
/**
 * The record as it stood at `time`, rebuilt from its audit trail and
 * signatures, or null if it did not exist yet. Before a revision it is the
 * prior revision's snapshot. Approximate where history was cleared: a
 * returned record's earlier resolve is no longer signed, so it reads as
 * In Process.
 */
export function recordAsOf(record: EsrRecord, time: number): EsrRecord | null {
  if (at(record.createdAt) > time) return null;
  const revised = record.audit.filter((a) => a.action.startsWith("Revision "));
  const prior = record.revisions[record.revisions.length - 1];
  if (prior && revised.length && at(revised[revised.length - 1].time) > time)
    return recordAsOf(prior, time);
  const audit = record.audit.filter((a) => at(a.time) <= time);
  const signatures = record.signatures.filter((s) => at(s.time) <= time);
  const signed = new Set(signatures.map((s) => s.block));
  const lastOf = (match: (action: string) => boolean) =>
    Math.max(
      -Infinity,
      ...audit.filter((a) => match(a.action)).map((a) => at(a.time)),
    );
  let status: WorkflowStatus;
  if (signed.has("Division Head")) status = "ESR Closed";
  else if (signed.has("Approved By"))
    status =
      record.status === "ESR Issued – Deferred" &&
      signed.has("Shop Representative")
        ? "ESR Issued – Deferred"
        : "ESR Issued";
  else if (signed.has("Resolved By")) status = "Awaiting Approval";
  else
    status =
      lastOf(inProcessAction) > lastOf((a) => a === "reject")
        ? "In Process"
        : "Unassigned";
  const assigned = audit.some((a) => a.action === "assign");
  return {
    ...record,
    status,
    audit,
    signatures,
    serial: assigned || status !== "Unassigned" ? record.serial : null,
    engineerId: status === "Unassigned" ? null : record.engineerId,
  };
}
export interface ActivityEvent {
  id: string;
  time: string;
  actor: string;
  text: string;
  recordId: string;
  location: string;
}
const auditVerbs: Record<string, string> = {
  "Request submitted": "submitted",
  assign: "assigned",
  return: "returned",
  reject: "rejected",
  resubmit: "resubmitted",
};
const signatureVerbs: Record<string, string> = {
  "Resolved By": "resolved",
  "Approved By": "approved",
  "Shop Representative": "signed shop work on",
  "Division Head": "closed",
};
/**
 * Workflow events across records, oldest first. Audit covers routing and
 * signatures cover signed steps, so neither double-counts the other.
 */
export function activityFeed(records: EsrRecord[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const r of records) {
    const label = r.serial || "a new request";
    const event = (id: string, time: string, actor: string, text: string) =>
      events.push({
        id,
        time,
        actor,
        text,
        recordId: r.id,
        location: r.location,
      });
    if (!r.audit.some((a) => a.action === "Request submitted"))
      event(
        `${r.id}-created`,
        r.createdAt,
        r.name,
        `${r.name} submitted a request`,
      );
    for (const a of r.audit) {
      const verb = a.action.startsWith("Revision ")
        ? "opened a revision of"
        : auditVerbs[a.action];
      if (!verb) continue;
      event(
        a.id,
        a.time,
        a.actor,
        a.action === "Request submitted"
          ? `${a.actor} submitted a request`
          : `${a.actor} ${verb} ${label}`,
      );
    }
    const seen = new Set<string>();
    for (const s of [
      ...r.revisions.flatMap((v) => v.signatures),
      ...r.signatures,
    ]) {
      const verb = signatureVerbs[s.block];
      if (!verb || seen.has(s.id)) continue;
      seen.add(s.id);
      event(s.id, s.time, s.name, `${s.name} ${verb} ${label}`);
    }
  }
  return events.sort((a, b) => at(a.time) - at(b.time));
}
export interface FlowPoint {
  /** End of this bucket (epoch ms); the last point is "now". */
  time: number;
  /** Requests opened so far, including ESRs reopened by a revision. */
  opened: number;
  /** Closures so far (Division Head signatures, across revisions). */
  closed: number;
  /** Open backlog: opened minus closed. */
  open: number;
  /** How many of `opened` were reopenings by revision. */
  reopened: number;
}
const FLOW_WEEKLY_AFTER_DAYS = 180;
/**
 * Cumulative opened and closed ESRs over time, from the first event to `now`.
 * Daily buckets, or weekly past 180 days. A revision reopens a closed ESR, so
 * it counts as opened again and the backlog stays right without a dip.
 */
export function flowSeries(
  records: Pick<
    EsrRecord,
    "createdAt" | "signatures" | "audit" | "revisions"
  >[],
  now = Date.now(),
): FlowPoint[] {
  const events: { time: number; kind: "open" | "close" | "reopen" }[] = [];
  for (const r of records) {
    events.push({ time: at(r.createdAt), kind: "open" });
    const signatures = [
      ...r.revisions.flatMap((v) => v.signatures),
      ...r.signatures,
    ];
    const seen = new Set<string>();
    for (const s of signatures)
      if (s.block === "Division Head" && !seen.has(s.id)) {
        seen.add(s.id);
        events.push({ time: at(s.time), kind: "close" });
      }
    for (const a of r.audit)
      if (a.action.startsWith("Revision "))
        events.push({ time: at(a.time), kind: "reopen" });
  }
  const valid = events.filter((e) => !Number.isNaN(e.time) && e.time <= now);
  if (!valid.length) return [];
  valid.sort((a, b) => a.time - b.time);
  // Local midnight, so each bucket is the calendar day the viewer reads.
  const first = new Date(valid[0].time);
  const start = new Date(
    first.getFullYear(),
    first.getMonth(),
    first.getDate(),
  ).getTime();
  const step =
    (now - start) / DAY_MS > FLOW_WEEKLY_AFTER_DAYS ? 7 * DAY_MS : DAY_MS;
  const points: FlowPoint[] = [];
  let opened = 0;
  let closed = 0;
  let reopened = 0;
  let i = 0;
  for (let end = start + step; ; end += step) {
    const until = Math.min(end, now);
    while (i < valid.length && valid[i].time <= until) {
      const e = valid[i++];
      if (e.kind === "close") closed++;
      else {
        opened++;
        if (e.kind === "reopen") reopened++;
      }
    }
    points.push({
      time: until,
      opened,
      closed,
      open: opened - closed,
      reopened,
    });
    if (until >= now) break;
  }
  return points;
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
  place: PlaceKey = "",
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
      inPlace(r.location, place),
  );
}

let purifier: ReturnType<typeof DOMPurify> | null = null;
/** Assistant replies are model output grounded in user-written records, so treat them as untrusted HTML. */
function sanitizer() {
  if (!purifier) {
    purifier = DOMPurify(window);
    purifier.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }
  return purifier;
}
/** Markdown to sanitized HTML. No images, styles, or scripts: an image URL could exfiltrate record text. */
export function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false, gfm: true, breaks: true });
  return sanitizer().sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "del",
      "code",
      "pre",
      "blockquote",
      "hr",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
    ],
    ALLOWED_ATTR: ["href", "title", "align", "start", "target", "rel"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  });
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
/**
 * Resolution and rationale are rich text, so keep the reply's paragraphs, emphasis, and lists.
 * Headings become bold paragraphs, table rows become lines, and every other tag is unwrapped.
 */
export function markdownToRichText(text: string): string {
  const html = renderMarkdown(text)
    .replace(/<h[1-6]>/g, "<p><strong>")
    .replace(/<\/h[1-6]>/g, "</strong></p>")
    .replace(/<\/t[dh]>(?=\s*<t[dh])/g, " | ")
    .replace(/<\/tr>/g, "<br>")
    .replace(/<pre>/g, "<p>")
    .replace(/<\/pre>/g, "</p>");
  return sanitizeRichText(html);
}
