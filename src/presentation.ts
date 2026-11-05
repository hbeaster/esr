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
type SearchableRecord = Pick<
  EsrRecord,
  | "title"
  | "serial"
  | "jcn"
  | "condition"
  | "attributes"
  | "engineerId"
  | "status"
> &
  Partial<Pick<EsrRecord, "requestorId">>;
export function filterRecords<T extends SearchableRecord>(
  records: T[],
  query: string,
  status: string,
  scope: Scope,
  userId?: string,
): T[] {
  const search = query.trim().toLowerCase();
  return records.filter(
    (r) =>
      (!search ||
        [r.title, r.serial, r.jcn, r.condition, ...r.attributes]
          .join(" ")
          .toLowerCase()
          .includes(search)) &&
      (!status || r.status === status) &&
      (scope !== "mine" ||
        r.engineerId === userId ||
        r.requestorId === userId) &&
      (scope !== "history" || r.status === "ESR Closed"),
  );
}
