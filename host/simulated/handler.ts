import type { Actor, EsrRecord } from "../../src/types";
import {
  createSimulatedRecords,
  SIMULATED_PNG_BASE64,
  simulatedLds,
  simulatedTemplates,
  simulatedTextFile,
} from "./data";
import type { SimulatedSeed } from "./data";

export interface SimulatedRequest {
  method: string;
  /** Path below the API base, for example `/records/sim-1`. */
  path: string;
  query: URLSearchParams;
  authorization?: string;
  body?: unknown;
}
export type SimulatedResponse =
  | { status: number; json: unknown }
  | { status: number; bytes: Uint8Array; type: string };

export const READ_ONLY_MESSAGE =
  "Simulated data is read-only. Switch to API data to run workflow actions.";
const TOKEN_PREFIX = "simulated.";

const failure = (status: number, error: string): SimulatedResponse => ({
  status,
  json: { error },
});
const ok = (json: unknown): SimulatedResponse => ({ status: 200, json });
const field = (body: unknown, key: string): string => {
  const value = (body as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "string" ? value : "";
};
const tokens = (text: string) =>
  new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);

/**
 * Read-only stand-in for the API in docs/api.md. Workflow rules deliberately
 * stay in backend/Esr.Api/Workflow.cs rather than being copied here.
 */
export function createSimulatedApi(seed: SimulatedSeed) {
  const records = createSimulatedRecords(seed);

  const visibleTo = (actor: Actor) =>
    records.filter(
      (record) =>
        record.site === actor.site ||
        (seed.permissions[actor.id]?.crossSite ?? "none") !== "none",
    );

  function fileResponse(
    record: EsrRecord,
    fileId: string,
    revision: string | null,
  ): SimulatedResponse {
    const source =
      revision === null
        ? record
        : record.revisions.find((r) => String(r.revision) === revision);
    if (!source) return failure(404, "Revision not found.");
    const file = source.attachments.find((a) => a.id === fileId);
    if (!file) return failure(404, "File not found.");
    return {
      status: 200,
      type: file.type,
      bytes:
        file.type === "image/png"
          ? Uint8Array.from(atob(SIMULATED_PNG_BASE64), (c) => c.charCodeAt(0))
          : new TextEncoder().encode(simulatedTextFile(file.name)),
    };
  }

  return function handle(request: SimulatedRequest): SimulatedResponse {
    const { method, path, query, body } = request;
    if (method === "GET" && path === "/demo/users") return ok(seed.users);
    if (method === "POST" && path === "/demo/session") {
      const user = seed.users.find((u) => u.id === field(body, "userId"));
      return user
        ? ok({ user, token: `${TOKEN_PREFIX}${user.id}` })
        : failure(400, "Unknown demo identity.");
    }

    const token = request.authorization?.replace(/^Bearer /, "") ?? "";
    const actor = token.startsWith(TOKEN_PREFIX)
      ? seed.users.find((u) => u.id === token.slice(TOKEN_PREFIX.length))
      : undefined;
    if (!actor) return failure(401, "A valid demo identity is required.");

    if (method === "GET" && path === "/bootstrap")
      return ok({
        user: actor,
        users: seed.users,
        templates: simulatedTemplates,
        permissions: seed.permissions,
        records: visibleTo(actor),
      });
    if (method === "GET" && path === "/lds") {
      const found = simulatedLds[query.get("jcn") ?? ""];
      return found
        ? ok(found)
        : failure(
            404,
            `JCN not found. Try ${Object.keys(simulatedLds).join(" or ")}, or select N/A.`,
          );
    }
    if (method === "POST" && path === "/history/search") {
      const condition = field(body, "condition").trim();
      if (!condition) return failure(400, "condition is required.");
      const terms = tokens(condition);
      const matches = visibleTo(actor)
        .filter((record) => record.status === "ESR Closed")
        .map((record) => {
          const other = tokens(record.condition);
          const shared = [...terms].filter((term) => other.has(term)).length;
          return {
            id: record.id,
            serial: record.serial,
            title: record.title,
            resolution: record.resolution,
            rationale: record.rationale,
            similarity: Math.round((100 * shared) / Math.max(terms.size, 1)),
          };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);
      return ok({
        summary: `Inspection finding: ${condition.slice(0, 210)}`,
        matches,
      });
    }
    if (
      method === "POST" &&
      (path === "/records" ||
        path === "/permissions" ||
        /^\/records\/[^/]+\/[^/]+$/.test(path))
    )
      return failure(403, READ_ONLY_MESSAGE);

    const match =
      method === "GET"
        ? /^\/records\/([^/]+)(?:\/(pdf)|\/files\/([^/]+))?$/.exec(path)
        : null;
    if (!match) return failure(404, "Not part of the simulated API.");
    const record = visibleTo(actor).find((r) => r.id === match[1]);
    if (!record) return failure(404, "ESR not found.");
    if (match[2])
      return failure(
        501,
        "PDF export is not available for simulated data. Switch to API data to export a PDF.",
      );
    return match[3]
      ? fileResponse(record, match[3], query.get("revision"))
      : ok(record);
  };
}
