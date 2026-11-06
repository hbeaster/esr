// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, request } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { createSandbox, simulatedStore } from "../../host/simulated/sandbox";
import type { SimulatedSeed } from "../../host/simulated/data";
import seedJson from "../../backend/Esr.Api/seed.json";

const seed = seedJson as unknown as SimulatedSeed;
const servers: Server[] = [];
afterEach(() => {
  servers.splice(0).forEach((s) => s.close());
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
async function listen(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("simulatedStore", () => {
  it("carries every simulated record and attachment bytes for downloads", () => {
    const store = simulatedStore(seed);
    expect(store.records).toHaveLength(60);
    expect(store.templates.length).toBeGreaterThan(0);
    const attachments = store.records.flatMap((r) => [
      ...r.attachments,
      ...r.revisions.flatMap((v) => v.attachments),
    ]);
    expect(attachments.length).toBeGreaterThan(0);
    for (const a of attachments) expect(a.base64.length).toBeGreaterThan(0);
    const png = attachments.find((a) => a.type === "image/png")!;
    expect(Buffer.from(png.base64, "base64").subarray(1, 4).toString()).toBe(
      "PNG",
    );
  });
});

describe("sandbox readiness", () => {
  it("loads the simulated store once, then forwards", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ accepts: true, loaded: false }))
      .mockResolvedValueOnce(json({ records: 60 }));
    const sandbox = createSandbox("http://sandbox.test", seed, fetch);
    expect(await sandbox.ready()).toBe(true);
    const [url, init] = fetch.mock.calls[1];
    expect(url).toBe("http://sandbox.test/api/demo/simulated");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).records).toHaveLength(60);
    // Cached: no second probe within the trust window.
    expect(await sandbox.ready()).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("keeps edits when the sandbox already holds simulated data", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json({ accepts: true, loaded: true }));
    expect(
      await createSandbox("http://sandbox.test", seed, fetch).ready(),
    ).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("falls back to read-only data when no sandbox answers", async () => {
    for (const fetch of [
      vi.fn().mockRejectedValue(new TypeError("connect ECONNREFUSED")),
      vi.fn().mockResolvedValue(json({ error: "Route not found." }, 404)),
      vi.fn().mockResolvedValue(json({ accepts: false })),
    ])
      expect(
        await createSandbox("http://sandbox.test", seed, fetch).ready(),
      ).toBe(false);
  });
});

describe("sandbox forwarding", () => {
  it("passes method, path, auth, body, and status through to /api", async () => {
    let seen: { method?: string; url?: string; auth?: string; body?: string } =
      {};
    const sandboxUrl = await listen((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen = {
          method: req.method,
          url: req.url,
          auth: req.headers.authorization,
          body,
        };
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "This record changed." }));
      });
    });
    const sandbox = createSandbox(sandboxUrl, seed);
    const devUrl = await listen((req, res) =>
      sandbox.forward(req, res, req.url ?? "/"),
    );
    const reply = await new Promise<{ status?: number; body: string }>(
      (resolve) => {
        const req = request(
          `${devUrl}/records/sim-1/resolve?x=1`,
          {
            method: "POST",
            headers: {
              Authorization: "Bearer jwt",
              "Content-Type": "application/json",
            },
          },
          (res) => {
            let body = "";
            res.on("data", (c) => (body += c));
            res.on("end", () => resolve({ status: res.statusCode, body }));
          },
        );
        req.end(JSON.stringify({ version: 3 }));
      },
    );
    expect(seen).toEqual({
      method: "POST",
      url: "/api/records/sim-1/resolve?x=1",
      auth: "Bearer jwt",
      body: '{"version":3}',
    });
    expect(reply).toEqual({
      status: 409,
      body: '{"error":"This record changed."}',
    });
  });
  it("answers 502 when the sandbox is gone", async () => {
    const sandbox = createSandbox("http://127.0.0.1:9", seed);
    const devUrl = await listen((req, res) =>
      sandbox.forward(req, res, req.url ?? "/"),
    );
    const status = await new Promise<number | undefined>((resolve) =>
      request(`${devUrl}/bootstrap`, (res) => {
        res.resume();
        resolve(res.statusCode);
      }).end(),
    );
    expect(status).toBe(502);
  });
});
