import { describe, expect, it } from "vitest";
import {
  createSimulatedRecords,
  SIMULATED_RECORD_COUNT,
} from "../../host/simulated/data";
import type { SimulatedSeed } from "../../host/simulated/data";
import {
  createSimulatedApi,
  READ_ONLY_MESSAGE,
} from "../../host/simulated/handler";
import type { SimulatedRequest } from "../../host/simulated/handler";
import type { Bootstrap, EsrRecord } from "../../src/types";
import {
  compartments,
  filterRecords,
  parseLocation,
  placeKey,
} from "../../src/presentation";
import { simulatedLds } from "../../host/simulated/data";
import seedJson from "../../backend/Esr.Api/seed.json";

const seed = seedJson as unknown as SimulatedSeed;
const records = createSimulatedRecords(seed);
const handle = createSimulatedApi(seed);
const call = (
  path: string,
  options: Partial<SimulatedRequest> & { as?: string } = {},
) =>
  handle({
    method: "GET",
    path,
    query: new URLSearchParams(),
    authorization: `Bearer simulated.${options.as ?? "engineer"}`,
    ...options,
  });
const json = <T>(response: ReturnType<typeof handle>) => {
  if (!("json" in response)) throw new Error("Expected a JSON response.");
  return response.json as T;
};
const blocks = (record: EsrRecord) => record.signatures.map((s) => s.block);

describe("simulated records", () => {
  it("place records on every level of every compartment", () => {
    const cells = new Set(
      records.map((r) => {
        const loc = parseLocation(r.location);
        return loc ? placeKey(loc.compartment, loc.level) : "unlocated";
      }),
    );
    for (const c of compartments)
      for (const level of c.levels)
        expect(cells).toContain(placeKey(c.id, level));
    expect(cells).toContain("unlocated");
  });
  it("describe each simulated job's location fully, in nautical terms", () => {
    for (const lds of Object.values(simulatedLds)) {
      const loc = parseLocation(lds.location);
      expect(loc, lds.location).not.toBeNull();
      expect(loc!.level, lds.location).not.toBeNull();
      expect(loc!.frame, lds.location).not.toBeNull();
      expect(loc!.side, lds.location).not.toBeNull();
      // Frames fall inside their compartment's range.
      const [first, last] = compartments.find(
        (c) => c.id === loc!.compartment,
      )!.frames;
      expect(loc!.frame!).toBeGreaterThanOrEqual(first);
      expect(loc!.frame!).toBeLessThanOrEqual(last);
      if (loc!.side !== "centerline")
        expect(loc!.board, lds.location).not.toBeNull();
    }
  });
  it("share Bangor work, so each person's My work is a real subset", () => {
    const local = records.filter((r) => r.site === "Bangor");
    const mine = (id: string) =>
      filterRecords(local, "", "", "mine", id).length;
    // Jordan is assigned some and files some; Priya takes the rest of the assignments.
    expect(local.some((r) => r.requestorId === "engineer")).toBe(true);
    expect(local.some((r) => r.engineerId === "engineer2")).toBe(true);
    for (const id of ["requestor", "engineer", "engineer2"]) {
      expect(mine(id)).toBeGreaterThan(0);
      expect(mine(id)).toBeLessThan(local.length);
    }
  });
  it("keep 14 open records at Bangor", () => {
    const local = records.filter((r) => r.site === "Bangor");
    expect(local.filter((r) => r.status !== "ESR Closed")).toHaveLength(14);
  });

  it("are deterministic and use unique, recognisable IDs", () => {
    expect(createSimulatedRecords(seed)).toEqual(records);
    expect(records).toHaveLength(SIMULATED_RECORD_COUNT);
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
    expect(records.every((r) => r.id.startsWith("sim-"))).toBe(true);
  });

  it("cover every workflow status and the edge cases at the local site", () => {
    const local = records.filter((r) => r.site === "Bangor");
    expect(new Set(local.map((r) => r.status))).toEqual(
      new Set([
        "Unassigned",
        "In Process",
        "Awaiting Approval",
        "ESR Issued",
        "ESR Issued – Deferred",
        "ESR Closed",
      ]),
    );
    expect(local.some((r) => r.rejected)).toBe(true);
    expect(local.some((r) => r.revisions.length > 0)).toBe(true);
    expect(local.some((r) => r.attachments.length > 0)).toBe(true);
    expect(local.some((r) => r.title.length > 100)).toBe(true);
    expect(records.some((r) => r.site === "Kings Bay")).toBe(true);
  });

  it("keep signatures and fields consistent with each status", () => {
    for (const record of records) {
      if (record.status === "Unassigned") {
        expect(record.serial).toBeNull();
        expect(record.engineerId).toBeNull();
      } else expect(record.serial).toBeTruthy();
      if (record.status === "Awaiting Approval")
        expect(blocks(record)).toEqual(["Resolved By"]);
      if (record.status === "ESR Closed") {
        expect(blocks(record)).toContain("Division Head");
        expect(record.completion).not.toBeNull();
      }
      if (record.status === "ESR Issued – Deferred")
        expect(record.completion?.status).toBe("Deferred");
      if (record.dfs === "yes") expect(record.dfsReference).toBeTruthy();
      if (record.tvd === "yes") expect(record.tvdReference).toBeTruthy();
      if (record.status !== "Unassigned") {
        expect(record.serial).toMatch(/^[0-9]{6}[A-Z]{1,2}$/);
        expect(record.revision).toBeGreaterThanOrEqual(1);
      } else expect(record.revision).toBe(0);
      if (record.revisions.length) {
        expect(record.serial).toBe(`${record.serialBase}B`);
        expect(record.revisions[0].serial).toBe(`${record.serialBase}A`);
        expect(record.revisions[0].status).toBe("ESR Closed");
      }
    }
  });
});

describe("simulated API", () => {
  it("answers the assistant chat with a labeled simulated reply", () => {
    const record = records.find(
      (r) => r.status === "In Process" && r.site === "Bangor",
    )!;
    const reply = json<{ reply: string; model: string; mock: boolean }>(
      call("/assistant/chat", {
        method: "POST",
        body: {
          recordId: record.id,
          messages: [{ role: "user", content: "What should I check first?" }],
        },
      }),
    );
    expect(reply.mock).toBe(true);
    expect(reply.model).toBe("simulated");
    expect(reply.reply).toContain("Simulated assistant");
    expect(reply.reply).toContain(record.serial!);
    expect(reply.reply).toContain("What should I check first?");
    const missing = call("/assistant/chat", {
      method: "POST",
      body: { recordId: "nope", messages: [{ role: "user", content: "Hi" }] },
    });
    expect(missing.status).toBe(404);
    const noQuestion = call("/assistant/chat", {
      method: "POST",
      body: { recordId: record.id, messages: [] },
    });
    expect(noQuestion.status).toBe(400);
  });
  it("signs in known identities without requiring a token", () => {
    const session = call("/demo/session", {
      method: "POST",
      authorization: undefined,
      body: { userId: "supervisor" },
    });
    expect(json<{ token: string }>(session).token).toBe("simulated.supervisor");
    expect(
      call("/demo/session", {
        method: "POST",
        authorization: undefined,
        body: { userId: "nobody" },
      }).status,
    ).toBe(400);
  });

  it("rejects missing or foreign tokens", () => {
    expect(call("/bootstrap", { authorization: undefined }).status).toBe(401);
    expect(
      call("/bootstrap", { authorization: "Bearer demo-jwt" }).status,
    ).toBe(401);
  });

  it("provides its own templates because the API ships none", () => {
    expect(seed).toMatchObject({ records: [], templates: [], sequence: 0 });
    expect(json<Bootstrap>(call("/bootstrap")).templates).toHaveLength(3);
  });

  it("limits records to the signed-in user's site", () => {
    const bangor = json<Bootstrap>(call("/bootstrap")).records;
    const kingsBay = json<Bootstrap>(call("/bootstrap", { as: "remote" }));
    expect(bangor.length).toBeGreaterThan(0);
    expect(bangor.every((r) => r.site === "Bangor")).toBe(true);
    expect(kingsBay.user.id).toBe("remote");
    expect(kingsBay.records.length).toBeGreaterThan(0);
    expect(kingsBay.records.every((r) => r.site === "Kings Bay")).toBe(true);
    expect(call(`/records/${bangor[0].id}`, { as: "remote" }).status).toBe(404);
  });

  it("honours cross-facility permissions", () => {
    const shared = createSimulatedApi({
      ...seed,
      permissions: { remote: { crossSite: "read", dualSign: false } },
    });
    const response = shared({
      method: "GET",
      path: "/bootstrap",
      query: new URLSearchParams(),
      authorization: "Bearer simulated.remote",
    });
    expect(json<Bootstrap>(response).records).toHaveLength(records.length);
  });

  it.each(["/records", "/permissions", "/records/sim-1/assign"])(
    "rejects the write to %s as read-only",
    (path) => {
      const response = call(path, { method: "POST", body: {} });
      expect(response.status).toBe(403);
      expect(json<{ error: string }>(response).error).toBe(READ_ONLY_MESSAGE);
    },
  );

  it("explains that PDF export is unavailable", () => {
    const local = records.find((r) => r.site === "Bangor")!;
    const response = call(`/records/${local.id}/pdf`);
    expect(response.status).toBe(501);
    expect(json<{ error: string }>(response).error).toContain("PDF export");
  });

  it("serves attachment bytes with their stored type and size", () => {
    const record = records.find(
      (r) => r.site === "Bangor" && r.attachments.length > 1,
    )!;
    for (const file of record.attachments) {
      const response = call(`/records/${record.id}/files/${file.id}`);
      if (!("bytes" in response)) throw new Error("Expected file bytes.");
      expect(response.type).toBe(file.type);
      expect(response.bytes.length).toBe(file.size);
    }
    expect(call(`/records/${record.id}/files/missing`).status).toBe(404);
  });

  it("searches only closed records the user can see", () => {
    const result = json<{ matches: { id: string; similarity: number }[] }>(
      call("/history/search", {
        method: "POST",
        body: { condition: "Surface corrosion around the flange" },
      }),
    );
    expect(result.matches.map((match) => match.similarity)).toEqual([
      90, 75, 60,
    ]);
    for (const match of result.matches) {
      const source = records.find((r) => r.id === match.id)!;
      expect(source.status).toBe("ESR Closed");
      expect(source.site).toBe("Bangor");
    }
    expect(call("/history/search", { method: "POST", body: {} }).status).toBe(
      400,
    );
  });

  it("returns known LDS data and a helpful miss", () => {
    const query = new URLSearchParams({ jcn: "21036WX010184" });
    expect(call("/lds", { query }).status).toBe(200);
    expect(call("/lds").status).toBe(404);
  });
});
