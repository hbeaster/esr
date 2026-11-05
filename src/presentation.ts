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
/** Resolution and rationale are plain text that also prints to the PDF, so drop Markdown syntax on insert. */
export function markdownToPlainText(text: string): string {
  return text
    .replace(/^```.*$/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^(\s*)[*+]\s+/gm, "$1- ")
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
