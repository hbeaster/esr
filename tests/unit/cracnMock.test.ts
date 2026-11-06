// @vitest-environment node
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isJcn } from "../../src/presentation";

let server: ChildProcess;
let base = "";
const auth = { Authorization: "Bearer test-token" };

beforeAll(async () => {
  server = spawn(process.execPath, ["mocks/cracn/server.mjs", "--port", "0"]);
  base = await new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.stdout?.on("data", (chunk: Buffer) => {
      const match = /listening on (http:\/\/\S+)/.exec(chunk.toString());
      if (match) resolve(match[1]);
    });
  });
});
afterAll(() => {
  server.kill();
});

const get = (path: string, headers: Record<string, string> = auth) =>
  fetch(`${base}/api/v1${path}`, { headers });
const send = (method: string, path: string, body?: unknown) =>
  fetch(`${base}/api/v1${path}`, {
    method,
    headers: { ...auth, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("CRACN mock data", () => {
  it("uses 13-character JCNs for every job", () => {
    const data = JSON.parse(
      readFileSync("mocks/cracn/data.json", "utf8"),
    ) as { resources: Record<string, unknown> };
    const jobs = data.resources["/api/v1/jobs"] as { jcnOrMjfcn: string }[];
    expect(jobs.length).toBeGreaterThan(2);
    for (const { jcnOrMjfcn } of jobs) expect(isJcn(jcnOrMjfcn)).toBe(true);
  });
});

describe("CRACN mock server", () => {
  it("requires a bearer token", async () => {
    expect((await get("/jobs", {})).status).toBe(401);
  });

  it("serves the demo JCNs with resolvable refs", async () => {
    const job = await (await get("/jobs/21036WX010184")).json();
    expect(job.metadata).toEqual({
      name: "jobs/21036WX010184",
      resourceType: "cracn.projectblue.mil/Job",
    });
    const item = await (
      await get(`/${job.noncanonicalRefs.configurationItem.ref}`)
    ).json();
    expect(item).toMatchObject({
      equipmentName: "ASW-P-02",
      location: "FWD Compartment, lower level, frame 38, starboard, outboard",
    });
    expect((await get(`/${job.noncanonicalRefs.refit.ref}`)).status).toBe(200);
  });

  it("pages and filters lists", async () => {
    const page = await (await get("/jobs?limit=2&offset=1")).json();
    expect(page).toMatchObject({ startItem: 1, endItem: 3 });
    expect(page.items).toHaveLength(2);
    const filters = JSON.stringify([
      { field: "csmpSummary", operation: "like", value: "%valve%" },
    ]);
    const filtered = await (
      await get(`/jobs?filters=${encodeURIComponent(filters)}`)
    ).json();
    expect(
      filtered.items.map((j: { jcnOrMjfcn: string }) => j.jcnOrMjfcn),
    ).toEqual(["21036WX020207"]);
  });

  it("supports create, update and cascading delete", async () => {
    expect((await send("POST", "/boats", { uic: "ZZZZZ" })).status).toBe(422);
    const patched = await (
      await send("PATCH", "/jobs/21036WX020207", { priority: "1" })
    ).json();
    expect(patched).toMatchObject({ priority: "1", jcnOrMjfcn: "21036WX020207" });
    expect((await send("DELETE", "/jobs/21036WX020207")).status).toBe(204);
    expect((await get("/jobs/21036WX020207/planningForm")).status).toBe(404);
    await fetch(`${base}/__mock/reset`, { method: "POST" });
    expect((await get("/jobs/21036WX020207")).status).toBe(200);
  });

  it("allows auth checks and returns 404 for unknown resources", async () => {
    expect(
      await (await send("DELETE", "/auth/abac/boats/21036")).json(),
    ).toEqual({
      allowed: true,
    });
    expect((await get("/jobs/00000ZZZZ0001")).status).toBe(404);
  });
});
