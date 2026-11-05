# PRD implementation and validation matrix

This is a synthetic, end-to-end demonstration. “Implemented” describes demo behavior, not production certification.

| PRD requirement | Implementation | Verification |
| --- | --- | --- |
| Thin host, reusable npm component | Vue custom element, separate host build, strict npm files allowlist | Vite builds; npm package inspection |
| Vue / TypeScript frontend / .NET backend | Strict TypeScript Vue 3 components and ASP.NET Core 10 API | vue-tsc, Vite component/host builds, backend tests |
| UI component boundaries | 17 focused child components, typed instance context, dialog focus composable | Vue Test Utils unit tests and browser regressions |
| ESLint defaults | Recommended ESLint, typescript-eslint, and Vue presets without rule overrides | Lint passes with zero warnings |
| Docker / Kubernetes | Multi-stage image, Compose, Kustomize deployment/service | Passed Docker build and hardened-container smoke test; Kustomize rendering (no cluster rollout) |
| Initiation required fields / JCN optional | Required form fields; two synthetic LDS JCNs or N/A | Browser creation/import; HTTP LDS test |
| Assignment / serial | Supervisor assigns local engineer, generates YYNNNN | Workflow tests; full browser flow |
| Reject/delete | Commented return with requestor resubmit; confirmed deletion of unassigned request | Domain resubmission test; role validation |
| Manual resolution / rationale | Draft editor with saved technical text | Workflow tests; browser editor |
| Assisted summary / matches / copying | Labeled deterministic mock summary, ranked historical matches, clipboard and insertion | HTTP search; browser search/insertion |
| Approved templates | Three synthetic supervisor-approved templates | Browser library test |
| High-resolution attachments / preview | Original file bytes, authenticated previews, section classification | HTTP byte roundtrip; browser upload |
| DFS / TVD sequential questions | Conditional prompts and references, server validation | Missing DFS reference unit test; browser entry |
| Attributes / document labels | Table, record header and PDF metadata | Browser SUBSAFE/DFS; PDF unit test |
| JWT identity signatures | Server-verified demo JWT supplies identity | Tampering and spoofed payload tests |
| Engineer / supervisor approvals | State changes, role checks, locked issued text | Domain workflow / immutability tests; browser handoff |
| Delegated dual signing | Admin permission and mandatory comment | Dual signature unit test |
| Comments throughout review | Actor/time captured; cross-facility review comments | Browser comment flow; domain permission tests |
| Blocks 25 / 26 | Completion status, signed identity, server date, explanation validation | Parameterized domain tests; browser deferral |
| Division closeout / deferred | Final signature; explicit deferred acknowledgement | Domain tests; full browser flow |
| Revisions A–ZZ / history | Copy prior content, frozen snapshots, fresh signatures | Boundary/immutability tests; browser historical view |
| Historical records | Filterable closed records and revision snapshots | Frontend filter tests; browser history |
| Esra AI review | Row action opens a summary and similarity scores from a deployment-configured OpenAI-compatible provider | Unconfigured HTTP test; provider client test |
| Cross-TRF permissions | Admin assigns none/read/review; no cross-facility editing | Domain permission tests; browser cross-facility review |
| Printable PDF | Paginated metadata, resolution, rationale, audit, signatures, embedded originals | PDF structure/content unit test; HTTP download; browser download |
| Light responsive UI | Scoped styles, mobile navigation, keyboard-visible focus, modal focus management | Browser mobile overflow assertion; visual review |

## Explicit decisions and remaining production work

- User selected supervisor-approved templates and copy-forward revisions with retained history.
- Serial ambiguity resolved as six-digit base `YYNNNN`, with revision suffix `A` through `ZZ`.
- The MLP demonstrated here is the complete synthetic role handoff. Production rollout scope still requires stakeholder agreement.
- Live LDS, semantic/AI infrastructure, production identity/digital signing, persistence, certified PDF blocks/layout and durable audit storage are intentionally mocked or deferred.
- The generated PDF prints JPEG and standard non-interlaced 8-bit PNG continuation images and embeds every original. WebP and other PNG variants retain UI preview and original-download support.
- Mock state is process-local and reset at restart; Kubernetes deployment deliberately uses one replica.

All 54 automated tests passed. Actual executed results, PDF visual QA, and deployment limits are recorded in `docs/validation-results.md`.
