import type {
  Actor,
  Attachment,
  AuditEntry,
  EngineeringTemplate,
  EsrAttribute,
  EsrRecord,
  LdsData,
  Permission,
  Signature,
} from "../../src/types";

/** Reference data shared with the mock API so identities do not drift. */
export interface SimulatedSeed {
  users: Actor[];
  permissions: Record<string, Permission>;
}

export const SIMULATED_RECORD_COUNT = 60;

/**
 * The first two JCNs match the CRACN mock's demo jobs, so the New Request form
 * behaves alike. The rest exist only in simulated data. Together they cover
 * every compartment level. Locations use the standard nautical format that
 * parseLocation reads: compartment, level, frame, side, inboard/outboard.
 */
export const simulatedLds: Record<string, LdsData> = {
  "21036WX010184": {
    workStatement: "Inspect auxiliary seawater pump coupling",
    refit: "A014",
    component: "ASW-P-02 / TSN-10482",
    location: "FWD Compartment, lower level, frame 38, starboard, outboard",
    swbs: "6286FCA00000",
  },
  "21036WX020207": {
    workStatement: "Restore valve actuator mounting hardware",
    refit: "A018",
    component: "VLV-214 / TSN-20871",
    location: "Missile Compartment, third level, frame 72, port, inboard",
    swbs: "4521VLV21400",
  },
  "21036WX030311": {
    workStatement: "Inspect propulsion motor mounting and cooling",
    refit: "A021",
    component: "MTR-01 / TSN-30115",
    location: "Engine Room, lower level, frame 148, centerline",
    swbs: "2351MTR01000",
  },
  "21036WX040422": {
    workStatement: "Recalibrate depth gauge transmitter",
    refit: "A021",
    component: "PT-118 / TSN-40233",
    location: "FWD Compartment, upper level, frame 22, port, inboard",
    swbs: "4365PT118000",
  },
  "21036WX050533": {
    workStatement: "Repair galley exhaust damper linkage",
    refit: "A018",
    component: "DMP-07 / TSN-50344",
    location: "FWD Compartment, second level, frame 30, starboard, inboard",
    swbs: "5121DMP07000",
  },
  "21036WX060644": {
    workStatement: "Inspect shaft seal cooling line",
    refit: "A014",
    component: "SS-02 / TSN-60455",
    location: "Engine Room, lower level, frame 157, port, outboard",
    swbs: "2441SS020000",
  },
  "21036WX070755": {
    workStatement: "Clean chilled water cooler tube bundle",
    refit: "A021",
    component: "HX-12 / TSN-70566",
    location: "Missile Compartment, lower level, frame 95, starboard, outboard",
    swbs: "5141HX120000",
  },
  "21036WX080866": {
    workStatement: "Inspect hydraulic accumulator precharge",
    refit: "A018",
    component: "ACC-31 / TSN-80677",
    location: "Missile Compartment, second level, frame 64, port, outboard",
    swbs: "5561ACC31000",
  },
  "21036WX090977": {
    workStatement: "Test shore power breaker trip settings",
    refit: "A014",
    component: "BKR-4A / TSN-90788",
    location: "Engine Room, middle level, frame 126, starboard, inboard",
    swbs: "3241BKR4A000",
  },
  "21036WX101088": {
    workStatement: "Rebalance ventilation supply fan",
    refit: "A021",
    component: "FAN-03 / TSN-10899",
    location: "Missile Compartment, upper level, frame 81, starboard, inboard",
    swbs: "5121FAN03000",
  },
  "21036WX111199": {
    workStatement: "Replace trim tank level sensor",
    refit: "A018",
    component: "LT-05 / TSN-11910",
    location: "FWD Compartment, third level, frame 41, port, outboard",
    swbs: "5291LT050000",
  },
  "21036WX121210": {
    workStatement: "Inspect motor generator brush rigging",
    refit: "A014",
    component: "MG-2 / TSN-12021",
    location: "Engine Room, upper level, frame 118, port, outboard",
    swbs: "3111MG020000",
  },
};
/** The system each simulated job concerns, used in its record titles so the equipment icon matches. */
const simulatedSystems: Record<string, string> = {
  "21036WX010184": "Auxiliary seawater pump",
  "21036WX020207": "Hydraulic valve actuator",
  "21036WX030311": "Propulsion motor",
  "21036WX040422": "Depth gauge transmitter",
  "21036WX050533": "Galley exhaust damper",
  "21036WX060644": "Shaft seal cooling line",
  "21036WX070755": "Chilled water cooler",
  "21036WX080866": "Hydraulic accumulator",
  "21036WX090977": "Shore power breaker",
  "21036WX101088": "Ventilation supply fan",
  "21036WX111199": "Trim tank level sensor",
  "21036WX121210": "Motor generator",
};

export const simulatedTemplates: EngineeringTemplate[] = [
  {
    id: "inspect",
    title: "Inspection & restoration",
    category: "Mechanical",
    resolution:
      "1. Isolate the affected component in accordance with the approved work package.\n2. Inspect the identified area and document as-found condition.\n3. Restore using the applicable approved technical procedure.\n4. Perform required verification and record as-left condition.",
    rationale:
      "Restoration and verification establish that the component meets the acceptance criteria in the cited technical reference.",
  },
  {
    id: "replace",
    title: "Component replacement",
    category: "Maintenance",
    resolution:
      "1. Verify replacement component identification and traceability.\n2. Remove and replace the affected component using the referenced procedure.\n3. Complete inspection and functional verification before return to service.",
    rationale:
      "Replacement restores the intended configuration. Required inspections verify installation and functional performance.",
  },
  {
    id: "evaluate",
    title: "Engineering evaluation",
    category: "Assessment",
    resolution:
      "1. Record measurements and inspection evidence.\n2. Compare findings against the referenced acceptance criteria.\n3. Document the engineering disposition and required follow-up actions.",
    rationale:
      "Disposition is based on documented evidence and applicable acceptance criteria.",
  },
];

type Stage =
  | "unassigned"
  | "returned"
  | "inProcess"
  | "awaiting"
  | "issued"
  | "shopSigned"
  | "deferred"
  | "closed";

/**
 * Most Bangor records are closed out. These 14 stay open (two of them are
 * closed records reopened by revision), chosen so the backlog mixes fresh,
 * aging, and stale work: see the age notes. Ages are days in the current
 * status, against the limits in agingThresholdsDays.
 */
const openBangorStages: Partial<Record<number, Stage>> = {
  0: "unassigned", // ~1 day: on track
  26: "unassigned", // ~53 days: stale
  2: "returned", // ~5 days: aging
  1: "inProcess", // ~2 days: on track
  31: "inProcess", // ~59 days: stale
  3: "awaiting", // ~5 days: aging
  28: "awaiting", // ~55 days: stale
  9: "issued", // ~13 days: on track
  40: "issued", // ~78 days: stale
  12: "shopSigned", // ~22 days: on track
  16: "deferred", // deferred work does not age
  36: "deferred",
};
/** Closed records reopened as revision B: one fresh (~3 days), one stale (~83 days). */
const revisedBangorIndexes = new Set([4, 44]);
/** The other TRF only has an engineer identity, so its records stop before approval. */
const kingsBayStages: Stage[] = ["unassigned", "inProcess", "awaiting"];

const systems = [
  "Main condensate pump",
  "Hydraulic accumulator",
  "Chilled water header",
  "Emergency diesel starter",
  "Ventilation damper",
  "Trim tank level sensor",
  "Shore power breaker",
  "Reduction gear lube oil cooler",
];
const findings = [
  "corrosion at flange face",
  "seal weep during pressure test",
  "bracket fatigue crack",
  "fastener torque discrepancy",
  "insulation breakdown",
  "misaligned mounting feet",
  "calibration drift",
];
const conditions = [
  "Surface corrosion observed around the flange during scheduled inspection. Pitting depth has not been measured.",
  "A slow seal weep appeared during the hydrostatic pressure test and stopped once pressure was released.",
  "Dye penetrant inspection found a linear crack indication on the support bracket weld toe.",
  "Fastener torque readings fall below the referenced drawing values on several locations.",
];
const resolution =
  "1. Isolate the component in accordance with the approved work package.\n2. Document the as-found condition.\n3. Restore using the applicable technical procedure.\n4. Verify and record the as-left condition.";
const rationale =
  "Restoration and verification show that the component meets the acceptance criteria in the cited technical reference.";
const attributeSets: EsrAttribute[][] = [
  [],
  ["Level 1"],
  ["SUBSAFE", "Level 1"],
  ["SOC"],
  ["Requires Rev"],
];
const longTitle =
  "Simulated long title to exercise wrapping and truncation across the request table, the record header, and printed record navigation on narrow screens";
const longCondition = `${conditions[0]} `.repeat(14).trim();

const DAY_MS = 86_400_000;
/**
 * The newest record is anchored to yesterday 15:00 UTC, so the mix of fresh,
 * aging, and stale work looks the same whenever the data is generated.
 * Deterministic within a UTC day.
 */
function latestRecordMs(): number {
  const now = new Date();
  return (
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
    DAY_MS +
    15 * 3_600_000
  );
}

function textBytes(name: string): number {
  return new TextEncoder().encode(simulatedTextFile(name)).length;
}

export function simulatedTextFile(name: string): string {
  return `Simulated attachment: ${name}\nThis file contains no real engineering data.\n`;
}

/** Smallest valid PNG, so image previews render without storing real bytes. */
export const SIMULATED_PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  ),
  (char) => char.charCodeAt(0),
);

/** Deterministic: the same seed always produces the same records. */
export function createSimulatedRecords(seed: SimulatedSeed): EsrRecord[] {
  const actor = (id: string): Actor => {
    const found = seed.users.find((user) => user.id === id);
    if (!found) throw new Error(`Simulated data needs the "${id}" identity.`);
    return found;
  };
  // Weighted so the mock hull heatmap shows hot spots: the FWD lower level
  // (auxiliary machinery), Missile second level, and Engine Room carry the most
  // work. Nineteen slots never line up with the every-sixth Kings Bay record.
  const jcns = [
    "21036WX010184", // FWD lower: seawater pump
    "21036WX080866", // Missile second: accumulator
    "21036WX030311", // ER lower: propulsion motor
    "21036WX040422", // FWD upper: depth gauge
    "21036WX010184",
    "21036WX090977", // ER middle: shore power breaker
    "21036WX070755", // Missile lower: chilled water cooler
    "N/A",
    "21036WX050533", // FWD second: galley damper
    "21036WX080866",
    "21036WX020207", // Missile third: valve actuator
    "21036WX121210", // ER upper: motor generator
    "21036WX010184",
    "21036WX101088", // Missile upper: ventilation fan
    "21036WX030311",
    "21036WX111199", // FWD third: trim tank sensor
    "21036WX090977",
    "N/A",
    "21036WX060644", // ER lower: shaft seal line
  ];

  const latest = latestRecordMs();
  return Array.from({ length: SIMULATED_RECORD_COUNT }, (_, index) => {
    const kingsBay = index % 6 === 5;
    const stage: Stage = kingsBay
      ? kingsBayStages[index % kingsBayStages.length]
      : (openBangorStages[index] ?? "closed");
    const id = `sim-${index + 1}`;
    // Created every two days, newest first: about four months of history.
    const createdDaysAgo = 1 + 2 * index;
    // Workflow steps are `pace` days apart (1 to 4), but always finish before
    // now: six steps fit between creation and the newest record.
    const pace = Math.max(
      1,
      Math.min(1 + (index % 4), Math.floor((createdDaysAgo - 1) / 6)),
    );
    const time = (step: number) =>
      new Date(
        latest - createdDaysAgo * DAY_MS + step * pace * DAY_MS,
      ).toISOString();

    const requestor = actor(kingsBay ? "remote" : "requestor");
    const engineer = actor(kingsBay ? "remote" : "engineer");
    const supervisor = actor("supervisor");
    const shop = actor("shop");
    const division = actor("division");

    const sign = (
      who: Actor,
      block: string,
      day: number,
      comment = "Simulated signature",
    ): Signature => ({
      id: `${id}-sign-${block.replaceAll(" ", "-").toLowerCase()}`,
      userId: who.id,
      name: who.name,
      block,
      time: time(day),
      comment,
    });
    const remark = (who: Actor, text: string, day: number): Signature => ({
      id: `${id}-comment-${day}`,
      userId: who.id,
      name: who.name,
      block: "",
      time: time(day),
      comment: "",
      text,
    });

    const assigned = stage !== "unassigned" && stage !== "returned";
    // Assignment issues revision A, as in EsrNumber.cs.
    const serialBase = assigned ? `26${String(5000 + index)}` : null;
    // Some In Process drafts stay blank so the unfinished form is also visible.
    const drafted = assigned && !(stage === "inProcess" && index % 2 === 0);
    const usesDfs = drafted && index % 3 === 0;
    const usesTvd = drafted && index % 4 === 0;

    const signatures: Signature[] = [];
    const reached = (...stages: Stage[]) => stages.includes(stage);
    if (reached("awaiting", "issued", "shopSigned", "deferred", "closed"))
      signatures.push(sign(engineer, "Resolved By", 2));
    if (reached("issued", "shopSigned", "deferred", "closed"))
      signatures.push(sign(supervisor, "Approved By", 3));
    if (reached("shopSigned", "deferred", "closed"))
      signatures.push(
        sign(
          shop,
          "Shop Representative",
          4,
          stage === "deferred" ? "Awaiting parts availability." : "",
        ),
      );
    if (stage === "closed") signatures.push(sign(division, "Division Head", 5));

    const comments: Signature[] = [];
    if (stage === "returned")
      comments.push(
        remark(supervisor, "Add the drawing reference and resubmit.", 1),
      );
    if (assigned && index % 4 === 1)
      comments.push(
        remark(engineer, "Confirmed the finding with the shop lead.", 2),
      );

    const attachments: Attachment[] = [];
    if (index % 3 === 0) {
      const name = `inspection-${index + 1}.txt`;
      attachments.push({
        id: `${id}-file-text`,
        name,
        type: "text/plain",
        section: "Condition",
        size: textBytes(name),
        uploadedBy: requestor.name,
        time: time(0),
      });
    }
    if (index % 9 === 0)
      attachments.push({
        id: `${id}-file-image`,
        name: `photo-${index + 1}.png`,
        type: "image/png",
        section: "Reference",
        size: SIMULATED_PNG_BYTES.length,
        uploadedBy: requestor.name,
        time: time(0),
      });

    const audit: AuditEntry[] = [
      {
        id: `${id}-audit-0`,
        actor: requestor.name,
        time: time(0),
        action: "Request submitted",
      },
    ];
    if (assigned)
      audit.push({
        id: `${id}-audit-1`,
        actor: supervisor.name,
        time: time(1),
        action: "assign",
      });
    signatures.forEach((signature, position) =>
      audit.push({
        id: `${id}-audit-${position + 2}`,
        actor: signature.name,
        time: signature.time,
        action: signature.block,
      }),
    );

    const jcn = jcns[index % jcns.length];
    const lds = simulatedLds[jcn];
    const status: EsrRecord["status"] = {
      unassigned: "Unassigned",
      returned: "Unassigned",
      inProcess: "In Process",
      awaiting: "Awaiting Approval",
      issued: "ESR Issued",
      shopSigned: "ESR Issued",
      deferred: "ESR Issued – Deferred",
      closed: "ESR Closed",
    }[stage] as EsrRecord["status"];

    const record: EsrRecord = {
      id,
      title:
        index === 3
          ? longTitle
          : `${simulatedSystems[jcn] ?? systems[index % systems.length]} — ${findings[index % findings.length]}`,
      name: requestor.name,
      shop: requestor.shop,
      phone: requestor.phone,
      references: `SIM-REF-${100 + index}, drawing SIM-${index + 1}`,
      condition:
        index === 7 ? longCondition : conditions[index % conditions.length],
      jcn,
      workStatement: lds?.workStatement ?? "",
      refit: lds?.refit ?? "",
      component: lds?.component ?? "",
      location: lds?.location ?? "",
      swbs: lds?.swbs ?? "",
      site: requestor.site,
      requestorId: requestor.id,
      status,
      serial: serialBase && `${serialBase}A`,
      serialBase,
      revision: assigned ? 1 : 0,
      engineerId: assigned ? engineer.id : null,
      resolution: drafted ? resolution : "",
      rationale: drafted ? rationale : "",
      dfs: drafted ? (usesDfs ? "yes" : "no") : "",
      dfsReference: usesDfs ? `DFS-SIM-${index + 1}` : "",
      tvd: drafted ? (usesTvd ? "yes" : "no") : "",
      tvdReference: usesTvd ? `TVD-SIM-${index + 1}` : "",
      attributes: drafted
        ? [...attributeSets[index % attributeSets.length]]
        : [],
      attachments,
      comments,
      signatures,
      audit,
      revisions: [],
      completion: reached("shopSigned", "deferred", "closed")
        ? {
            status: stage === "deferred" ? "Deferred" : "Completed",
            explanation:
              stage === "deferred" ? "Awaiting parts availability." : "",
            name: shop.name,
            shop: shop.shop,
            date: time(4).slice(0, 10),
          }
        : null,
      createdAt: time(0),
      updatedAt: signatures.at(-1)?.time ?? time(assigned ? 1 : 0),
      version: audit.length,
      rejected: stage === "returned",
    };

    // A couple of closed records reopen as revision B, keeping a frozen snapshot.
    return stage === "closed" && revisedBangorIndexes.has(index)
      ? reviseRecord(record, time(6))
      : record;
  });
}

function reviseRecord(record: EsrRecord, time: string): EsrRecord {
  return {
    ...record,
    status: "In Process",
    serial: `${record.serialBase}B`,
    revision: 2,
    revisionReason: "Simulated correction to the referenced drawing.",
    signatures: [],
    completion: null,
    revisions: [structuredClone(record)],
    audit: [
      ...record.audit,
      {
        id: `${record.id}-audit-revision`,
        actor: record.name,
        time,
        action: "Revision B: Simulated correction to the referenced drawing.",
      },
    ],
    updatedAt: time,
    version: record.version + 1,
  };
}
