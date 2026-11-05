# ESR workspace

Embeddable Vue 3 + TypeScript custom element (`src/`), demo-only host (`host/`), and an in-memory ASP.NET Core / .NET 10 demo API (`backend/Esr.Api`). Records, JWTs, historical matches, identities, signatures, and approvals are synthetic. JCN (LDS) context comes from the CRACN API in `cracn_openapi.json`, served locally by the mock in `mocks/cracn/` on `http://127.0.0.1:4010`. Restarting the API resets the store.

Human docs, which these instructions do not restate:

- Product and commands: `README.md`
- Endpoints and actions: `docs/api.md`
- Host embedding contract: `docs/host-component-contract.md`
- Implemented decisions: `docs/requirements.md`

## Invariants

- `backend/Esr.Api/seed.json` ships no records or templates, so the workspace starts empty. Pre-populated data comes only from the dev-only **Use fake data** toggle (`host/simulated/`). Backend and component tests use `backend/Esr.Tests/test-data.json`.
- Workflow authority is `backend/Esr.Api/Workflow.cs`. Hiding a button in `src/components/WorkflowActions.vue` does not authorize or forbid an action.
- Signature name and user id come from the validated demo JWT in `backend/Esr.Api/DemoIdentity.cs`. Ignore identity fields in the action body.
- The deferred status is exactly `ESR Issued – Deferred` (en dash, U+2013).
- An assigned ESR number is `[2-digit year][0001-9999][A-ZZ]`. Assignment issues revision `A`. `260001ZZ` is year 26, sequence 0001, revision ZZ. The sequence resets each UTC year.
- A supervisor reject leaves the status `Unassigned` and sets `Rejected`. The original requestor resubmits. Statuses are `Unassigned`, `In Process`, `Awaiting Approval`, `ESR Issued`, `ESR Issued – Deferred`, and `ESR Closed`.
- Mutations clone the record, validate the copy, then commit under `workflow.Sync`. Clients send the current `version`. A mismatch is HTTP 409.
- `Workflow.Public` strips attachment bytes from record DTOs. Downloads use the authenticated file route.
- The npm `files` allowlist is `dist/component/`, `README.md`, `LICENSE`, `docs/api.md`, and `docs/host-component-contract.md`. Leave the host, backend, seed data, tests, and these agent files out of the package. Publishing to a registry is out of scope.
- Kubernetes stays at one replica. Demo records and the JWT signing key are process-local.
- Historical search is deterministic term overlap. Keep it labeled as a mock.
- Component styles enter the shadow root only through `src/index.ts` and `src/styles/workspace.css`. Workspace state is instance-local via `useWorkspaceContext`. Each `<esr-workspace>` has its own state.
- Vue custom-element listeners receive `event.detail` as a one-element array. The payload is `event.detail[0]`.
- `tokenProvider` is a JavaScript property, not an HTML attribute. Assigning a new function reloads bootstrap. Changing `apiBase` alone does not.
- ESLint uses the unmodified recommended presets. `npm run lint` fails on any warning. Leave those presets unchanged.
- Frontend tooling needs Node `^22.13.0` or `>=24`. The API, backend tests, and end-to-end tests need the .NET 10 SDK.

## Commands

Match the check to the files you changed.

- UI or composable logic: `npm test` and `npm run typecheck`
- Component bundle or host contract: `npm run test:component`
- Domain rule or HTTP API: `npm run test:backend`
- Role handoff in the browser: `npm run test:e2e`
- Full validation, when asked or before a pull request that crosses layers: `npm run validate`

`npm run test:component` rebuilds the component first. Playwright end-to-end tests start the CRACN mock at `http://127.0.0.1:4010`, the API at `http://127.0.0.1:5080`, and Vite at `http://127.0.0.1:5173` unless `ESR_BASE_URL` is set. After changing `cracn_openapi.json` or `mocks/cracn/curated.mjs`, run `npm run mock:generate`. Set `DOTNET_BIN` when `dotnet` is not on `PATH`. End-to-end tests use one worker because the store is process-local. Outside CI, Playwright reuses an API or Vite server that is already running.

## Playbooks

Read the matching playbook before a change that spans layers:

- Workflow status, role check, or `POST /records/:id/:action`: `.agents/skills/change-workflow/SKILL.md`
- `<esr-workspace>` properties, events, exported types, or host-facing endpoints: `.agents/skills/change-public-contract/SKILL.md`
- Choosing tests, or claiming a change is done: `.agents/skills/verify-change/SKILL.md`

Path-scoped conventions live in `.agents/rules/`. Open the matching file when editing those paths: `vue-workspace.md`, `workflow-api.md`, `tests.md`, `deploy.md`.
