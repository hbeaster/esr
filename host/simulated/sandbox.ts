/**
 * Writable simulated data. `npm run dev:api` also starts a sandbox copy of the
 * real API (port 5081) that accepts simulated records. When it is reachable,
 * the dev server loads the simulated records into it once and forwards every
 * simulated-data request there, so signing and every other action run through
 * backend/Esr.Api/Workflow.cs. Data lives in that process and resets when it
 * restarts. Without the sandbox, the read-only stand-in in handler.ts answers.
 */
import { request as httpRequest } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createSimulatedRecords,
  SIMULATED_PNG_BYTES,
  simulatedTemplates,
  simulatedTextFile,
} from "./data";
import type { SimulatedSeed } from "./data";
import type { EsrRecord } from "../../src/types";

/** Attachment bytes travel as Base64 in the API's store (record DTOs omit them). */
type StoredRecord = Omit<EsrRecord, "attachments" | "revisions"> & {
  attachments: (EsrRecord["attachments"][number] & { base64: string })[];
  revisions: StoredRecord[];
};
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
function withBytes(record: EsrRecord): StoredRecord {
  return {
    ...record,
    attachments: record.attachments.map((a) => ({
      ...a,
      base64:
        a.type === "image/png"
          ? base64(SIMULATED_PNG_BYTES)
          : base64(new TextEncoder().encode(simulatedTextFile(a.name))),
    })),
    revisions: record.revisions.map(withBytes),
  };
}
/** The simulated store as the API's POST /demo/simulated expects it. */
export function simulatedStore(seed: SimulatedSeed) {
  return {
    records: createSimulatedRecords(seed).map(withBytes),
    templates: simulatedTemplates,
  };
}

const PROBE_TIMEOUT_MS = 600;
/** How long a probe result is trusted. Short, so a restarted sandbox is reloaded quickly. */
const PROBE_TTL_MS = 2000;

export function createSandbox(
  baseUrl: string,
  seed: SimulatedSeed,
  request: typeof fetch = fetch,
) {
  const base = baseUrl.replace(/\/+$/, "");
  let checked = 0;
  let available = false;
  let inFlight: Promise<boolean> | null = null;

  async function probe(): Promise<boolean> {
    try {
      const status = await request(`${base}/api/demo/simulated`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!status.ok) return false;
      const { accepts, loaded } = (await status.json()) as {
        accepts?: boolean;
        loaded?: boolean;
      };
      if (!accepts) return false;
      if (!loaded) {
        const load = await request(`${base}/api/demo/simulated`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(simulatedStore(seed)),
          signal: AbortSignal.timeout(10_000),
        });
        if (!load.ok) return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  /** True when requests should go to the sandbox. Loads simulated data on first use. */
  async function ready(): Promise<boolean> {
    if (Date.now() - checked < PROBE_TTL_MS) return available;
    inFlight ??= probe().then((ok) => {
      available = ok;
      checked = Date.now();
      inFlight = null;
      return ok;
    });
    return inFlight;
  }
  /** Streams one request to the sandbox's /api, including event streams. */
  function forward(
    req: IncomingMessage,
    res: ServerResponse,
    pathAndQuery: string,
  ) {
    const target = new URL(`/api${pathAndQuery}`, `${base}/`);
    const upstream = httpRequest(
      target,
      { method: req.method, headers: { ...req.headers, host: target.host } },
      (reply) => {
        res.writeHead(reply.statusCode ?? 502, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on("error", () => {
      checked = 0; // Probe again on the next request.
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error:
              "The simulated-data API stopped responding. Restart npm run dev:api.",
          }),
        );
      } else res.end();
    });
    // A closed page (for example an event stream) ends the upstream request too.
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  }
  return { ready, forward };
}
