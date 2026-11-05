import { describe, it, expect, vi, afterEach } from "vitest";
import { createApi } from "../../src/api";
import {
  esrRevision,
  filterRecords,
  isJcn,
  normalizeJcn,
  plainText,
  richTextHtml,
  sanitizeRichText,
  sortRecords,
  statusTone,
} from "../../src/presentation";
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
describe("ESR numbers", () => {
  it("reads the revision suffix", () => {
    expect(esrRevision("260001A")).toBe("A");
    expect(esrRevision("260001ZZ")).toBe("ZZ");
    expect(esrRevision(null)).toBe("");
  });
});
describe("workspace search", () => {
  const records = [
    makeRecord({
      id: "1",
      title: "Pump coupling",
      serial: "260001A",
      jcn: "12345WX019999",
      condition: "Wear",
      attributes: ["SUBSAFE"],
      engineerId: "e",
      status: "In Process",
    }),
    makeRecord({
      id: "2",
      title: "Valve",
      serial: "260002A",
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
  it("sorts table columns and keeps blanks last", () => {
    const rows = [
      makeRecord({
        id: "issued",
        serial: "260040A",
        status: "ESR Issued",
        createdAt: "2026-11-02T00:00:00Z",
        shop: "9",
      }),
      makeRecord({
        id: "pending",
        serial: null,
        status: "Unassigned",
        createdAt: "2026-11-06T00:00:00Z",
        shop: "31",
      }),
      makeRecord({
        id: "closed",
        serial: "260037A",
        status: "ESR Closed",
        createdAt: "2026-11-01T00:00:00Z",
        shop: "100",
      }),
    ];
    expect(sortRecords(rows, "serial", "asc").map((row) => row.id)).toEqual([
      "closed",
      "issued",
      "pending",
    ]);
    expect(sortRecords(rows, "serial", "desc").map((row) => row.id)).toEqual([
      "issued",
      "closed",
      "pending",
    ]);
    expect(sortRecords(rows, "status", "asc").map((row) => row.id)).toEqual([
      "pending",
      "issued",
      "closed",
    ]);
    expect(sortRecords(rows, "initiated", "asc").map((row) => row.id)).toEqual([
      "closed",
      "issued",
      "pending",
    ]);
    expect(sortRecords(rows, "shop", "asc").map((row) => row.id)).toEqual([
      "issued",
      "pending",
      "closed",
    ]);
    expect(sortRecords(rows, null, "asc")).toBe(rows);
  });
  it("keeps rich text formatting and drops scripts", () => {
    expect(sanitizeRichText("<strong>Wear</strong><script>alert(1)</script>")).toBe(
      "<strong>Wear</strong>",
    );
    expect(richTextHtml("Line one\nLine two")).toBe("Line one<br>Line two");
    expect(plainText("<p>Coupling</p><br><b>wear</b>")).toBe("Coupling\n\nwear");
    expect(plainText("<p><br></p>")).toBe("");
  });
});

describe("JCN format", () => {
  it("accepts 5 digits, 4 alphanumerics, and a 0001–9999 sequence", () => {
    for (const jcn of ["12345WX019999", "1234512980001", "21036wx010184"])
      expect(isJcn(jcn)).toBe(true);
    for (const jcn of [
      "JCN-260184",
      "1234WX019999",
      "12345WX0199999",
      "A2345WX019999",
      "12345WX01999A",
      "12345WX010000",
      "12345W-019999",
    ])
      expect(isJcn(jcn)).toBe(false);
    expect(normalizeJcn(" 21036wx010184 ")).toBe("21036WX010184");
  });
});
