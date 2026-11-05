import { describe, expect, it } from "vitest";
import {
  agingDescription,
  formatDuration,
  sortRecords,
  statusAge,
  workflowTimeline,
  equipmentClass,
  filterRecords,
  equipmentClassLabel,
  hullZone,
  hullZoneLabel,
} from "../../src/presentation";
import { makeRecord } from "../fixtures";

const blank = { component: "", title: "", workStatement: "", condition: "" };

describe("equipmentClass", () => {
  it("reads the CRACN component codes", () => {
    expect(
      equipmentClass({ ...blank, component: "ASW-P-02 / TSN-10482" }),
    ).toBe("pump");
    expect(equipmentClass({ ...blank, component: "VLV-214 / TSN-20871" })).toBe(
      "valve",
    );
  });

  it("falls back to the title, work statement, then condition", () => {
    expect(
      equipmentClass({ ...blank, title: "Shore power breaker — seal weep" }),
    ).toBe("electrical");
    expect(
      equipmentClass({ ...blank, workStatement: "Verify damper travel" }),
    ).toBe("ventilation");
    expect(
      equipmentClass({
        ...blank,
        condition: "<p>Lube oil <b>cooler</b> leak</p>",
      }),
    ).toBe("heat-exchanger");
  });

  it("lets the component outrank a conflicting title", () => {
    expect(
      equipmentClass({
        ...blank,
        component: "ASW-P-02 / TSN-10482",
        title: "Hydraulic accumulator — corrosion",
      }),
    ).toBe("pump");
  });

  it("matches whole words and defaults to generic", () => {
    expect(equipmentClass({ ...blank, title: "Fanout bracket crack" })).toBe(
      "generic",
    );
    expect(equipmentClass(blank)).toBe("generic");
    expect(equipmentClassLabel("generic")).toBe("Equipment");
  });
});

describe("hullZone", () => {
  it("maps LDS locations to mock hull zones", () => {
    expect(hullZone("Auxiliary machinery space")).toBe("auxiliary");
    expect(hullZone("Forward equipment space")).toBe("forward");
    expect(hullZone("Engine room lower level")).toBe("engineering");
    expect(hullZone("Control room")).toBe("operations");
    expect(hullZoneLabel("auxiliary")).toBe("Auxiliary");
  });

  it("returns null for blank or unrecognized locations", () => {
    expect(hullZone("")).toBeNull();
    expect(hullZone(null)).toBeNull();
    expect(hullZone("Pier 4")).toBeNull();
  });
});

describe("filterRecords zone", () => {
  const records = [
    makeRecord({ id: "aux", location: "Auxiliary machinery space" }),
    makeRecord({ id: "fwd", location: "Forward equipment space" }),
    makeRecord({ id: "none", location: "" }),
  ];
  it("keeps only records in the selected hull zone", () => {
    const ids = (zone: Parameters<typeof filterRecords>[5]) =>
      filterRecords(records, "", "", "all", undefined, zone).map((r) => r.id);
    expect(ids("auxiliary")).toEqual(["aux"]);
    expect(ids("aft")).toEqual([]);
    expect(ids("")).toEqual(["aux", "fwd", "none"]);
  });
});

const DAY = 86_400_000;
const at = (day: number, hour = 0) =>
  new Date(Date.UTC(2026, 10, day, hour)).toISOString();
const signature = (block: string, day: number, name = "Jordan Lee") => ({
  id: block,
  userId: "u",
  name,
  block,
  time: at(day),
  comment: "",
});
const audit = (action: string, day: number, actor = "Sam Ortiz") => ({
  id: action + day,
  actor,
  time: at(day),
  action,
});

describe("workflowTimeline", () => {
  it("fills done steps with entry, actor, and duration", () => {
    const record = makeRecord({
      status: "Awaiting Approval",
      name: "Alex Morgan",
      createdAt: at(1),
      audit: [audit("Request submitted", 1), audit("assign", 2)],
      signatures: [signature("Resolved By", 5)],
    });
    const timeline = workflowTimeline(record, Date.parse(at(6, 12)));
    expect(timeline.map((s) => s.state)).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
    ]);
    expect(timeline[0]).toMatchObject({
      actor: "Alex Morgan",
      durationMs: DAY,
    });
    expect(timeline[1]).toMatchObject({
      enteredAt: at(2),
      actor: "Sam Ortiz",
      durationMs: 3 * DAY,
    });
    expect(timeline[2]).toMatchObject({
      actor: "Jordan Lee",
      durationMs: 1.5 * DAY,
    });
    expect(timeline[3]).toMatchObject({ enteredAt: null, durationMs: null });
  });

  it("re-enters In Process after a return", () => {
    const record = makeRecord({
      status: "In Process",
      createdAt: at(1),
      audit: [audit("assign", 2), audit("resolve", 4), audit("return", 6)],
      signatures: [],
    });
    const timeline = workflowTimeline(record, Date.parse(at(8)));
    expect(timeline[1]).toMatchObject({
      state: "current",
      enteredAt: at(6),
      durationMs: 2 * DAY,
    });
    expect(timeline[0].durationMs).toBe(DAY);
    expect(timeline[2].state).toBe("upcoming");
  });

  it("starts a new cycle on revision and keeps Unassigned's first assignment", () => {
    const record = makeRecord({
      status: "In Process",
      createdAt: at(1),
      audit: [
        audit("assign", 3),
        audit("Revision B: Drawing update", 10, "Jordan Lee"),
      ],
      signatures: [],
    });
    const timeline = workflowTimeline(record, Date.parse(at(11)));
    expect(timeline[0].durationMs).toBe(2 * DAY);
    expect(timeline[1]).toMatchObject({
      enteredAt: at(10),
      actor: "Jordan Lee",
    });
  });

  it("maps deferred to the issued step and ends at closeout", () => {
    const deferred = workflowTimeline(
      makeRecord({
        status: "ESR Issued – Deferred",
        signatures: [signature("Approved By", 3)],
      }),
    );
    expect(deferred[3].state).toBe("current");
    const closed = workflowTimeline(
      makeRecord({
        status: "ESR Closed",
        signatures: [
          signature("Approved By", 3),
          signature("Division Head", 9),
        ],
      }),
    );
    expect(closed[3].durationMs).toBe(6 * DAY);
    expect(closed[4]).toMatchObject({ state: "current", durationMs: null });
  });
});

describe("status aging", () => {
  const unassigned = makeRecord({ status: "Unassigned", createdAt: at(1) });
  it("tones by threshold", () => {
    expect(statusAge(unassigned, Date.parse(at(3)))?.tone).toBe("ok");
    expect(statusAge(unassigned, Date.parse(at(4)))?.tone).toBe("warn");
    expect(statusAge(unassigned, Date.parse(at(8)))?.tone).toBe("stale");
    expect(agingDescription(unassigned, Date.parse(at(5)))).toBe(
      "Unassigned for 4 days, stale after 7 days",
    );
  });
  it("does not age deferred or closed records", () => {
    expect(
      statusAge(makeRecord({ status: "ESR Issued – Deferred" })),
    ).toBeNull();
    expect(statusAge(makeRecord({ status: "ESR Closed" }))).toBeNull();
  });
  it("formats compact durations", () => {
    expect(formatDuration(45 * 60_000)).toBe("45m");
    expect(formatDuration(6 * 3_600_000)).toBe("6h");
    expect(formatDuration(3 * DAY + 4 * 3_600_000)).toBe("3d 4h");
    expect(formatDuration(10 * DAY)).toBe("10d");
    expect(formatDuration(35 * DAY)).toBe("5w");
  });
  it("sorts the oldest first and keeps untracked rows last", () => {
    const rows = [
      makeRecord({ id: "closed", status: "ESR Closed" }),
      makeRecord({ id: "new", status: "Unassigned", createdAt: at(9) }),
      makeRecord({ id: "old", status: "Unassigned", createdAt: at(2) }),
    ];
    expect(sortRecords(rows, "age", "asc").map((r) => r.id)).toEqual([
      "old",
      "new",
      "closed",
    ]);
    expect(sortRecords(rows, "age", "desc").map((r) => r.id)).toEqual([
      "new",
      "old",
      "closed",
    ]);
  });
});
