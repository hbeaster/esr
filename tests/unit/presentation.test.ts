import { describe, expect, it } from "vitest";
import {
  flowSeries,
  rankByCriticality,
  activityFeed,
  recordAsOf,
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

describe("recordAsOf", () => {
  const issued = makeRecord({
    status: "ESR Issued",
    serial: "260050A",
    createdAt: at(1),
    audit: [audit("Request submitted", 1, "Alex Morgan"), audit("assign", 2)],
    signatures: [signature("Resolved By", 4), signature("Approved By", 6)],
  });
  const asOf = (day: number) => recordAsOf(issued, Date.parse(at(day, 12)));
  it("rebuilds the status and serial at each point in time", () => {
    expect(recordAsOf(issued, Date.parse(at(0)))).toBeNull();
    expect(asOf(1)).toMatchObject({ status: "Unassigned", serial: null });
    expect(asOf(3)).toMatchObject({ status: "In Process", serial: "260050A" });
    expect(asOf(5)?.status).toBe("Awaiting Approval");
    expect(asOf(7)?.status).toBe("ESR Issued");
    expect(asOf(5)?.signatures.map((s) => s.block)).toEqual(["Resolved By"]);
  });
  it("uses the prior revision's snapshot before a revision", () => {
    const prior = makeRecord({
      status: "ESR Closed",
      serial: "260050A",
      createdAt: at(1),
      signatures: [signature("Approved By", 3), signature("Division Head", 5)],
    });
    const revised = makeRecord({
      status: "In Process",
      serial: "260050B",
      createdAt: at(1),
      audit: [audit("assign", 2), audit("Revision B: Update", 9)],
      revisions: [prior],
    });
    expect(recordAsOf(revised, Date.parse(at(6)))).toMatchObject({
      status: "ESR Closed",
      serial: "260050A",
    });
    expect(recordAsOf(revised, Date.parse(at(10)))?.status).toBe("In Process");
  });
});

describe("activityFeed", () => {
  it("narrates routing and signatures once each, oldest first", () => {
    const record = makeRecord({
      serial: "260051A",
      location: "Control room",
      createdAt: at(1),
      audit: [
        audit("Request submitted", 1, "Alex Morgan"),
        audit("assign", 2, "Casey Rivera"),
        // Simulated data also logs signature blocks in the audit trail.
        audit("Resolved By", 4, "Jordan Lee"),
        audit("comment", 4),
      ],
      signatures: [signature("Resolved By", 4)],
    });
    expect(activityFeed([record]).map((e) => e.text)).toEqual([
      "Alex Morgan submitted a request",
      "Casey Rivera assigned 260051A",
      "Jordan Lee resolved 260051A",
    ]);
    expect(activityFeed([record])[0].location).toBe("Control room");
  });
});

describe("rankByCriticality", () => {
  it("puts stale first, then aging, SUBSAFE ties, then the oldest", () => {
    const now = Date.parse(at(30));
    const rows = [
      makeRecord({ id: "closed", status: "ESR Closed" }),
      makeRecord({ id: "ok", status: "Unassigned", createdAt: at(29) }),
      makeRecord({ id: "warn", status: "Unassigned", createdAt: at(25) }),
      makeRecord({ id: "stale-old", status: "Unassigned", createdAt: at(2) }),
      makeRecord({ id: "stale-new", status: "Unassigned", createdAt: at(20) }),
      makeRecord({
        id: "stale-subsafe",
        status: "Unassigned",
        createdAt: at(21),
        attributes: ["SUBSAFE"],
      }),
    ];
    expect(rankByCriticality(rows, now).map((r) => r.record.id)).toEqual([
      "stale-subsafe",
      "stale-old",
      "stale-new",
      "warn",
      "ok",
      "closed",
    ]);
  });
});

describe("flowSeries", () => {
  const now = Date.parse(at(20, 12));
  const records = [
    // Open since day 1.
    makeRecord({ id: "a", createdAt: at(1), signatures: [], audit: [] }),
    // Closed on day 5.
    makeRecord({
      id: "b",
      createdAt: at(2),
      status: "ESR Closed",
      signatures: [
        signature("Approved By", 3),
        { ...signature("Division Head", 5), id: "b-close" },
      ],
      audit: [],
    }),
    // Closed day 3, revised day 4, closed again day 6: two closures, one reopening.
    makeRecord({
      id: "c",
      createdAt: at(1),
      status: "ESR Closed",
      revisions: [
        makeRecord({
          id: "c",
          signatures: [{ ...signature("Division Head", 3), id: "c-close-a" }],
        }),
      ],
      audit: [audit("Revision B: Drawing update", 4)],
      signatures: [{ ...signature("Division Head", 6), id: "c-close-b" }],
    }),
    // Issued but not closed: still open.
    makeRecord({
      id: "d",
      createdAt: at(3),
      status: "ESR Issued",
      signatures: [signature("Approved By", 7)],
      audit: [],
    }),
  ];
  it("counts opened, closed, and the open backlog over time", () => {
    const series = flowSeries(records, now);
    expect(series.at(-1)).toMatchObject({
      time: now,
      opened: 5,
      closed: 3,
      open: 2,
      reopened: 1,
    });
    for (let i = 1; i < series.length; i++) {
      expect(series[i].opened).toBeGreaterThanOrEqual(series[i - 1].opened);
      expect(series[i].closed).toBeGreaterThanOrEqual(series[i - 1].closed);
      expect(series[i].open).toBe(series[i].opened - series[i].closed);
    }
    // Day buckets from the first event to now.
    expect(series.length).toBeGreaterThanOrEqual(19);
    expect(series.length).toBeLessThanOrEqual(21);
  });
  it("switches to weekly buckets past 180 days, and is empty without data", () => {
    const old = [
      makeRecord({ createdAt: new Date(now - 200 * DAY).toISOString() }),
    ];
    const series = flowSeries(old, now);
    expect(series.length).toBeLessThanOrEqual(31);
    expect(series.at(-1)).toMatchObject({ opened: 1, closed: 0, open: 1 });
    expect(flowSeries([], now)).toEqual([]);
  });
});
