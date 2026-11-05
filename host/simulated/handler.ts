import type { Actor, EsrRecord } from "../../src/types";
import { ChatFailure, closestMatches, parseTurns, systemPrompt } from "./chat";
import type { ChatTurn } from "./chat";
import {
  createSimulatedRecords,
  SIMULATED_PNG_BYTES,
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
const CANNED_SIMILARITY = [90, 75, 60];

const failure = (status: number, error: string): SimulatedResponse => ({
  status,
  json: { error },
});
const ok = (json: unknown): SimulatedResponse => ({ status: 200, json });
const field = (body: unknown, key: string): string => {
  const value = (body as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "string" ? value : "";
};

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
          ? SIMULATED_PNG_BYTES
          : new TextEncoder().encode(simulatedTextFile(file.name)),
    };
  }

  const actorFor = (authorization: string | undefined) => {
    const token = authorization?.replace(/^Bearer /, "") ?? "";
    return token.startsWith(TOKEN_PREFIX)
      ? seed.users.find((u) => u.id === token.slice(TOKEN_PREFIX.length))
      : undefined;
  };

  /**
   * Checks a chat request and grounds it in the simulated record, for the
   * dev server to forward to a real model. The system turn comes first.
   */
  function prepareChat(
    request: Pick<SimulatedRequest, "authorization" | "body">,
  ): { turns: ChatTurn[] } | { failure: SimulatedResponse } {
    const actor = actorFor(request.authorization);
    if (!actor)
      return { failure: failure(401, "A valid demo identity is required.") };
    const visible = visibleTo(actor);
    const record = visible.find(
      (r) => r.id === field(request.body, "recordId"),
    );
    if (!record) return { failure: failure(404, "ESR not found.") };
    try {
      const turns = parseTurns(
        (request.body as { messages?: unknown } | null)?.messages,
      );
      const prompt = systemPrompt(record, closestMatches(record, visible));
      return { turns: [{ role: "system", content: prompt }, ...turns] };
    } catch (cause) {
      if (cause instanceof ChatFailure)
        return { failure: failure(cause.status, cause.message) };
      throw cause;
    }
  }

  const handle = function handle(request: SimulatedRequest): SimulatedResponse {
    const { method, path, query, body } = request;
    if (method === "GET" && path === "/demo/users") return ok(seed.users);
    if (method === "POST" && path === "/demo/session") {
      const user = seed.users.find((u) => u.id === field(body, "userId"));
      return user
        ? ok({ user, token: `${TOKEN_PREFIX}${user.id}` })
        : failure(400, "Unknown demo identity.");
    }

    const actor = actorFor(request.authorization);
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
      // Canned scores: ranking rules belong to Workflow.cs and are not copied here.
      const matches = visibleTo(actor)
        .filter((record) => record.status === "ESR Closed")
        .slice(0, CANNED_SIMILARITY.length)
        .map((record, position) => ({
          id: record.id,
          serial: record.serial,
          title: record.title,
          resolution: record.resolution,
          rationale: record.rationale,
          similarity: CANNED_SIMILARITY[position],
        }));
      return ok({
        summary: `Inspection finding: ${condition.slice(0, 210)}`,
        matches,
      });
    }
    if (method === "POST" && path === "/assistant/chat") {
      const record = visibleTo(actor).find(
        (r) => r.id === field(body, "recordId"),
      );
      if (!record) return failure(404, "ESR not found.");
      const messages = (body as { messages?: unknown } | null)?.messages;
      const last = Array.isArray(messages) ? messages.at(-1) : null;
      const question = field(last, "content").trim();
      if (field(last, "role") !== "user" || !question)
        return failure(400, "The last message must be a user question.");
      // A labeled stand-in: the real prompt and provider live in backend/Esr.Api/Chat.cs.
      const related = visibleTo(actor)
        .filter((r) => r.status === "ESR Closed" && r.id !== record.id)
        .slice(0, 2)
        .map((r) => `- **${r.serial}** · ${r.title}`);
      return ok({
        reply: [
          `**Simulated assistant.** You asked about **${record.serial ?? "this request"}**: "${question.slice(0, 160)}"`,
          "",
          "Closed ESRs worth comparing:",
          ...(related.length ? related : ["- None in the simulated data."]),
          "",
          "Switch to API data for the real assistant. Verify any suggestion against the referenced specifications before using it.",
        ].join("\n"),
        model: "simulated",
        mock: true,
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
  return Object.assign(handle, { prepareChat });
}
