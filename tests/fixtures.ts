import type { Actor, Bootstrap, EsrRecord } from "../src/types";
export const engineer: Actor = {
  id: "engineer",
  name: "Jordan Lee",
  role: "Engineer",
  site: "Bangor",
  shop: "Engineering",
  phone: "555-0142",
};
export function makeRecord(overrides: Partial<EsrRecord> = {}): EsrRecord {
  return {
    id: "record-1",
    title: "Pump inspection",
    name: "Alex Morgan",
    shop: "31",
    phone: "555-0131",
    references: "DEMO-REF",
    condition: "Uneven coupling wear",
    jcn: "N/A",
    workStatement: "",
    refit: "",
    component: "",
    location: "",
    swbs: "",
    site: "Bangor",
    requestorId: "requestor",
    status: "In Process",
    serial: "260043A",
    serialBase: "260043",
    revision: 1,
    engineerId: "engineer",
    resolution: "Inspect the coupling.",
    rationale: "Verify acceptance criteria.",
    dfs: "no",
    dfsReference: "",
    tvd: "no",
    tvdReference: "",
    attributes: [],
    attachments: [],
    comments: [],
    signatures: [],
    audit: [],
    revisions: [],
    completion: null,
    createdAt: "2026-11-04T12:00:00Z",
    updatedAt: "2026-11-04T12:00:00Z",
    version: 1,
    rejected: false,
    ...overrides,
  };
}
export function makeBootstrap(overrides: Partial<Bootstrap> = {}): Bootstrap {
  return {
    user: engineer,
    users: [engineer],
    records: [makeRecord()],
    permissions: {},
    templates: [
      {
        id: "inspect",
        title: "Inspection & restoration",
        category: "Mechanical",
        resolution: "Use the approved inspection steps.",
        rationale: "Document applicable criteria.",
      },
    ],
    ...overrides,
  };
}
