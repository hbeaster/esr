import { describe, it, expect, vi, afterEach } from "vitest";
import { createApi } from "../../src/api";
import { filterRecords, statusTone } from "../../src/presentation";
import { makeRecord } from "../fixtures";
afterEach(() => vi.unstubAllGlobals());
describe("component API boundary", () => {
  it("uses the host token and serializes actions", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "In Process" }),
    });
    vi.stubGlobal("fetch", fetch);
    await createApi("/api/", async () => "host-token")("/records/42/assign", {
      engineerId: "engineer",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/records/42/assign",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer host-token",
          "Content-Type": "application/json",
        },
        body: '{"engineerId":"engineer"}',
      }),
    );
  });
  it("surfaces domain validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: "Record is locked." }),
      }),
    );
    await expect(createApi("/api", () => "t")("/records/42")).rejects.toThrow(
      "Record is locked.",
    );
  });
  it("handles non-JSON failures and binary responses", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw Error();
        },
      })
      .mockResolvedValueOnce({ ok: true, blob: async () => "pdf" });
    vi.stubGlobal("fetch", fetch);
    await expect(createApi("/api")("/records")).rejects.toThrow("502");
    expect(await createApi("/api")("/pdf", undefined, true)).toBe("pdf");
  });
});
describe("workspace search", () => {
  const records = [
    makeRecord({
      id: "1",
      title: "Pump coupling",
      serial: "260001",
      jcn: "JCN-1",
      condition: "Wear",
      attributes: ["SUBSAFE"],
      engineerId: "e",
      status: "In Process",
    }),
    makeRecord({
      id: "2",
      title: "Valve",
      serial: "260002",
      jcn: "N/A",
      condition: "Restored",
      attributes: [],
      engineerId: "other",
      status: "ESR Closed",
    }),
  ];
  it("combines text, status and ownership", () => {
    expect(
      filterRecords(records, " subsafe ", "In Process", "mine", "e").map(
        (r) => r.id,
      ),
    ).toEqual(["1"]);
    expect(
      filterRecords(records, "", "", "history", "e").map((r) => r.id),
    ).toEqual(["2"]);
  });
  it("returns no matches for inconsistent filters", () =>
    expect(filterRecords(records, "pump", "ESR Closed", "all")).toEqual([]));
  it("distinguishes deferred records", () =>
    expect(statusTone("ESR Issued – Deferred")).toBe("amber"));
});
