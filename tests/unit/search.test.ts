import { describe, expect, it, vi } from "vitest";
import { filterRecords, warmSearchIndex } from "../../src/presentation";
import { makeRecord } from "../fixtures";

const names: Record<string, string> = {
  engineer: "Jordan Lee",
  engineer2: "Priya Shah",
};
const nameOf = (id: string) => names[id] ?? "";
const records = [
  makeRecord({
    id: "a",
    serial: "260091A",
    jcn: "21036WX010184",
    refit: "A014",
    name: "Alex Morgan",
    shop: "31",
    condition: "<p>Uneven <b>coupling</b> wear on the Résumé valve</p>",
    resolution: "<p>Restore the coupling face.</p>",
    swbs: "6286FCA00000",
    status: "Awaiting Approval",
    engineerId: "engineer",
    createdAt: "2026-11-04T12:00:00Z",
    location: "Missile Compartment, second level, frame 64, port, outboard",
    attributes: ["SUBSAFE"],
  }),
  makeRecord({
    id: "b",
    serial: "260092A",
    jcn: "21036WX020207",
    name: "Jordan Lee",
    condition: "Hydraulic accumulator seal weep",
    resolution: "",
    status: "In Process",
    engineerId: "engineer2",
    createdAt: "2026-09-12T12:00:00Z",
    location: "FWD Compartment, lower level, frame 38, starboard, outboard",
  }),
  makeRecord({
    id: "c",
    serial: null,
    name: "Alex Morgan",
    condition: "Breaker insulation breakdown",
    resolution: "",
    status: "Unassigned",
    engineerId: null,
    createdAt: "2026-10-01T12:00:00Z",
    location: "",
  }),
];
const ids = (query: string) =>
  filterRecords(records, query, "", "all", undefined, "", nameOf).map(
    (r) => r.id,
  );

describe("all-column search", () => {
  it("searches every table column", () => {
    expect(ids("260091A")).toEqual(["a"]); // Serial
    expect(ids("21036WX020207")).toEqual(["b"]); // JCN
    expect(ids("A014")).toEqual(["a"]); // Refit
    expect(ids("coupling")).toEqual(["a"]); // Condition and resolution (rich text)
    expect(ids("6286FCA")).toEqual(["a"]); // SWBS
    expect(ids("awaiting")).toEqual(["a"]); // Status
    expect(ids("unassigned")).toEqual(["c"]); // Status and engineer column
    expect(ids("Priya")).toEqual(["b"]); // Assigned engineer
    expect(ids("Nov 4")).toEqual(["a"]); // Date initiated, as shown
    expect(ids("2026-09-12")).toEqual(["b"]); // Date initiated, ISO
    expect(ids("subsafe")).toEqual(["a"]); // Attributes
  });
  it("finds a person in any role", () => {
    // Jordan is the engineer on "a" and the requester on "b".
    expect(ids("Jordan")).toEqual(["a", "b"]);
    expect(ids("alex")).toEqual(["a", "c"]);
  });
  it("needs every word to match, in any column", () => {
    expect(ids("jordan missile")).toEqual(["a"]);
    expect(ids("alex breaker")).toEqual(["c"]);
    expect(ids("jordan breaker")).toEqual([]);
  });
  it("tolerates typos in words, but not in identifiers", () => {
    expect(ids("jordn")).toEqual(["a", "b"]);
    expect(ids("alx")).toEqual(["a", "c"]);
    expect(ids("awaitng aproval")).toEqual(["a"]);
    expect(ids("hydralic")).toEqual(["b"]);
    // One digit off is a different record, not a typo.
    expect(ids("260093A")).toEqual([]);
    expect(ids("frame 65")).toEqual([]);
    // Too short for typos: substring only.
    expect(ids("zz")).toEqual([]);
  });
  it("ignores case and accents", () => {
    expect(ids("RESUME")).toEqual(["a"]);
    expect(ids("résumé")).toEqual(["a"]);
  });
  it("re-indexes a record once it changes", () => {
    const record = makeRecord({
      id: "edit",
      version: 1,
      condition: "Old text",
    });
    const search = (r: typeof record, q: string) =>
      filterRecords([r], q, "", "all").length;
    expect(search(record, "old")).toBe(1);
    const edited = { ...record, version: 2, condition: "Fresh text" };
    expect(search(edited, "fresh")).toBe(1);
    expect(search(edited, "old")).toBe(0);
  });
  it("stays fast over thousands of records once indexed", () => {
    const many = Array.from({ length: 5000 }, (_, i) =>
      makeRecord({
        id: `bulk-${i}`,
        serial: `26${String(1000 + i).padStart(4, "0")}A`,
        name: ["Alex Morgan", "Jordan Lee", "Priya Shah"][i % 3],
        condition: `<p>Finding ${i} on the hydraulic accumulator</p>`,
        engineerId: i % 2 ? "engineer" : "engineer2",
        location: "Missile Compartment, second level, frame 64, port, outboard",
      }),
    );
    const search = (q: string) =>
      filterRecords(many, q, "", "all", undefined, "", nameOf).length;
    search("warm"); // builds the index once
    const started = performance.now();
    for (const q of ["j", "jo", "jor", "jord", "jordn", "jordan missile"])
      search(q);
    const perKeystroke = (performance.now() - started) / 6;
    expect(search("jordan")).toBeGreaterThan(0);
    // Generous for CI; typically a few milliseconds.
    expect(perKeystroke).toBeLessThan(150);
  });
  it("builds the index in the background without changing results", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    try {
      const cancel = warmSearchIndex(records, nameOf, 1);
      vi.runAllTimers();
      expect(ids("Jordan")).toEqual(["a", "b"]);
      // Cancelling early stops further slices.
      const stop = warmSearchIndex(records, nameOf, 1);
      stop();
      vi.runAllTimers();
      cancel();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
