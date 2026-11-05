# PRD implementation and validation matrix

This is a synthetic, end-to-end demonstration. “Implemented” describes demo behavior, not production certification. The source PRD is split per section in `docs/prd/`.

| PRD requirement | Implementation | Verification |
| --- | --- | --- |
| Thin host, reusable npm component | Vue custom element, separate host build, strict npm files allowlist | Vite builds; npm package inspection |
| Vue / TypeScript frontend / .NET backend | Strict TypeScript Vue 3 components and ASP.NET Core 10 API | vue-tsc, Vite component/host builds, backend tests |
| UI component boundaries | 17 focused child components, typed instance context, dialog focus composable | Vue Test Utils unit tests and browser regressions |
| ESLint defaults | Recommended ESLint, typescript-eslint, and Vue presets without rule overrides | Lint passes with zero warnings |
| Docker / Kubernetes | Multi-stage image, Compose, Kustomize deployment/service | Passed Docker build and hardened-container smoke test; Kustomize rendering (no cluster rollout) |
| Initiation required fields / JCN optional | Name, shop, phone, references, and condition. References and condition use a rich text editor. Supporting files can be chosen in the request form and on the record. A request title is not collected. A JCN is 13 characters (`12345WX019999`: 5 digits, 4 alphanumerics, `0001`–`9999`), validated, then resolved from the mock CRACN API (`cracn_openapi.json`), or N/A | Browser creation/import; CRACN mapping and record-creation HTTP tests |
| Assignment / serial | Supervisor assigns a local engineer and issues `YY` + `0001`–`9999` + revision `A` | Workflow tests; full browser flow |
| Reject/delete | Commented return with requestor resubmit; confirmed deletion of unassigned request | Domain resubmission test; role validation |
| Manual resolution / rationale | Draft editor with saved technical text. Resolution and rationale use a rich text editor | Workflow tests; browser editor |
| Assisted summary / matches / copying | Labeled deterministic mock summary, ranked historical matches, clipboard and insertion | HTTP search; browser search/insertion |
| Approved templates | Library and insert flow; the API ships none, and the dev-only simulated data has three synthetic templates | Component browser insert test; browser library and insert test in simulated mode |
| High-resolution attachments / preview | Original file bytes, authenticated previews, section classification | HTTP byte roundtrip; browser upload |
| DFS / TVD sequential questions | Conditional prompts and references, server validation | Missing DFS reference unit test; browser entry |
| Mock equipment visual | The record header shows a labeled mock SVG for the equipment class (pump, valve, heat exchanger, electrical, sensor, ventilation, tank, engine, or generic). The class comes from keywords in the LDS component, then the title, work statement, and condition, so the component takes precedence | Classifier unit tests; component browser check |
| Mock hull location map | The Overview equipment card shows a labeled, not-to-scale mock hull silhouette with the LDS location's zone (forward, operations, midships, auxiliary, engineering, aft) highlighted and pinned. A blank or unrecognized location renders a muted hull with no pin | Zone classifier unit tests; component browser check |
| Mock fleet hull heatmap | The request list shows the mock hull shaded by how many records sit in each zone, under the current search, status, and scope. Zone chips (and clicks on the hull) filter the table, and Clear filters resets the zone. Simulated data spreads records across all six zones | Zone filter and count unit tests; component browser filter check |
| Workflow timeline / status aging | The record stepper is a timeline. Each reached step shows when it was last entered, by whom, and how long it took, or how long so far for the current step. Entry times come from the audit trail (`assign`, `return`, `resubmit`, `Revision …`) and signature times (Resolved By, Approved By, Division Head). The table's Time in Status chip and the stat cards' stale counts use default thresholds in days (warn/stale): Unassigned 3/7, In Process 14/30, Awaiting Approval 3/7, ESR Issued 30/60. Deferred and closed records do not age | Timeline and aging unit tests; component browser check |
| Fleet replay / sonar sweep | "Replay history" plays the fleet from its first request to now in about 15 seconds, with a date scrubber. Stat cards, stale counts, and the hull heatmap show records as rebuilt from audit and signature times, compartments pulse as events happen, and a ticker narrates them. The table stays live. In live view a sonar sweep crosses the hull and pings compartments holding stale records, which also carry a red count badge listing their serials. The sound is off until the viewer turns it on, and reduced motion hides the sweep and pings | `recordAsOf` and activity feed unit tests; replay controller test |
| Milestone ceremony | When a record on screen is issued, deferred, or closed, an ink stamp lands on the header with a short shake and an announcement for screen readers. A newly assigned or revised ESR number settles like a split-flap board. Records opened already in that state do not stamp, and reduced motion keeps the stamp but drops the motion | Stamp unit test; full browser handoff |
| Attributes / document labels | Record header and PDF metadata | Browser SUBSAFE/DFS; PDF unit test |
| ESR table | Serial, JCN, Refit, Requester, Shop Code, Condition, Resolution, SWBS, Status, Time in Status, Assigned Engineer, and Date Initiated. Each column can be shown or hidden, and clicking its header sorts the visible rows | Column toggle and sort unit tests; browser layout |
| JWT identity signatures | Server-verified demo JWT supplies identity | Tampering and spoofed payload tests |
| Engineer / supervisor approvals | State changes, role checks, locked issued text | Domain workflow / immutability tests; browser handoff |
| Delegated dual signing | Admin permission and mandatory comment | Dual signature unit test |
| Comments throughout review | Actor/time captured; cross-facility review comments | Browser comment flow; domain permission tests |
| Blocks 25 / 26 | Completion status, signed identity, server date, explanation validation | Parameterized domain tests; browser deferral |
| Division closeout / deferred | Final signature; explicit deferred acknowledgement | Domain tests; full browser flow |
| Revisions A–ZZ / history | Copy prior content, frozen snapshots, fresh signatures | Boundary/immutability tests; browser historical view |
| Historical records | Filterable closed records and revision snapshots | Frontend filter tests; browser history |
| Cross-TRF permissions | Admin assigns none/read/review; no cross-facility editing | Domain permission tests; browser cross-facility review |
| Printable PDF | Paginated metadata, resolution, rationale, audit, signatures, embedded originals | PDF structure/content unit test; HTTP download; browser download |
| Light responsive UI | Scoped styles, mobile navigation, keyboard-visible focus, modal focus management | Browser mobile overflow assertion; visual review |

## Explicit decisions and remaining production work

- User selected supervisor-approved templates and copy-forward revisions with retained history.
- ESR numbers are `[2-digit year][0001-9999][A-ZZ]`. Assignment issues revision `A`. `260001ZZ` is the last revision of the first 2026 number.
- The MLP demonstrated here is the complete synthetic role handoff. Production rollout scope still requires stakeholder agreement.
- Live LDS, semantic/AI infrastructure, production identity/digital signing, persistence, certified PDF blocks/layout and durable audit storage are intentionally mocked or deferred.
- The generated PDF prints JPEG and standard non-interlaced 8-bit PNG continuation images and embeds every original. WebP and other PNG variants retain UI preview and original-download support.
- Mock state is process-local and reset at restart; Kubernetes deployment deliberately uses one replica.

All 54 automated tests passed. Actual executed results, PDF visual QA, and deployment limits are recorded in `docs/validation-results.md`.
