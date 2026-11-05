// Hand-written CRACN records merged over generated data. They keep the demo
// JCNs that ESR documents (21036WX010184, 21036WX020207) resolvable end to end:
// job → refit + configuration item on the same boat. All values are synthetic.
export const DEMO_UIC = "21036";

export const curated = {
  "/api/v1/boats": [
    {
      uic: DEMO_UIC,
      name: "USS OHIO",
      shipType: "SSGN",
      shipClass: "USS OHIO",
      hullNumber: "726",
      tycom: "SP",
      level: "1",
      isRovFunded: false,
    },
  ],
  [`/api/v1/boats/${DEMO_UIC}/refits`]: [
    {
      refitNumber: "A014",
      refitType: "Selected restricted availability",
      startDate: "2026-01-12T00:00:00.000Z",
      completeDate: "2026-05-29T00:00:00.000Z",
      isDrydock: false,
    },
    {
      refitNumber: "A018",
      refitType: "Incremental refit",
      startDate: "2026-06-15T00:00:00.000Z",
      completeDate: "2026-09-30T00:00:00.000Z",
      isDrydock: true,
    },
  ],
  [`/api/v1/boats/${DEMO_UIC}/configurationItems`]: [
    {
      hsc: "6286FCA00000",
      equipmentName: "ASW-P-02",
      equipmentSerialNumber: "TSN-10482",
      eic: "AF5A000",
      location: "Auxiliary machinery space",
    },
    {
      hsc: "4521VLV21400",
      equipmentName: "VLV-214",
      equipmentSerialNumber: "TSN-20871",
      eic: "VA21400",
      location: "Forward equipment space",
    },
  ],
  "/api/v1/jobs": [
    {
      jcnOrMjfcn: "21036WX010184",
      kind: "ActiveJob",
      priority: "2",
      csmpSummary: "Inspect auxiliary seawater pump coupling",
      narrative:
        "Coupling face shows uneven wear during scheduled inspection. Evaluate and restore alignment.",
      noncanonicalRefs: {
        copiedFromJob: null,
        refit: ref(`boats/${DEMO_UIC}/refits/A014`, {
          uic: DEMO_UIC,
          refitNumber: "A014",
        }),
        configurationItem: ref(
          `boats/${DEMO_UIC}/configurationItems/6286FCA00000`,
          { uic: DEMO_UIC, hsc: "6286FCA00000" },
        ),
      },
    },
    {
      jcnOrMjfcn: "21036WX020207",
      kind: "ActiveJob",
      priority: "3",
      csmpSummary: "Restore valve actuator mounting hardware",
      narrative:
        "Actuator mounting bolts found loose; restore hardware to drawing torque values.",
      noncanonicalRefs: {
        copiedFromJob: null,
        refit: ref(`boats/${DEMO_UIC}/refits/A018`, {
          uic: DEMO_UIC,
          refitNumber: "A018",
        }),
        configurationItem: ref(
          `boats/${DEMO_UIC}/configurationItems/4521VLV21400`,
          { uic: DEMO_UIC, hsc: "4521VLV21400" },
        ),
      },
    },
  ],
};

/** Response of GET /api/v1/auth/user for any bearer token. */
export const mockUser = {
  firstName: "ESR",
  lastName: "Service",
  userName: "esr-demo-service",
  claims: [],
  appSpecificRoles: [],
};

function ref(path, uniqueness) {
  return { ref: path, uniqueness };
}
