---
name: verify-change
description: Chooses the narrowest ESR lint and test commands for a change and runs them before calling the work done. Use when asked to test, lint, typecheck, validate, or verify, and before claiming a frontend, API, workflow, contract, or deploy change is complete.
---

# Verify a change

Run the narrowest command that covers the files you touched. Use `npm run validate` when asked for full validation, or when one change crosses the component, the API, and the browser handoff.

| You changed | Run |
| --- | --- |
| `src/` or `host/` behavior | `npm test` and `npm run typecheck` |
| Formatting or lint only | `npm run lint` |
| Custom element bundle, `src/index.ts`, or the host contract | `npm run test:component` |
| `backend/` or API behavior documented in `docs/api.md` | `npm run test:backend` |
| A role handoff visible in the browser | `npm run test:e2e` |
| `cracn_openapi.json` or `mocks/cracn/` | `npm run mock:check` and `npm test` |
| `Dockerfile`, `compose.yaml`, or `deploy/k8s/` | `docker build -t esr-demo:local .` (and `docker build -f mocks/cracn/Dockerfile -t cracn-mock:local .`) |

## Conditions

- `npm run test:component` builds the component before Playwright starts.
- `npm run test:e2e` starts the CRACN mock on `http://127.0.0.1:4010`, the API on `http://127.0.0.1:5080`, and Vite on `http://127.0.0.1:5173` unless `ESR_BASE_URL` is already set. Set `DOTNET_BIN` when `dotnet` is not on `PATH`. Outside CI, a server already bound to those ports is reused.
- End-to-end tests stay at one worker. The demo store is process-local.
- `npm run lint` uses `--max-warnings 0`.
- Frontend commands need Node `^22.13.0` or `>=24`. Backend tests need the .NET 10 SDK.
- `npm run validate` runs lint, typecheck, `mock:check`, unit tests, component browser tests, the host build, backend tests, and end-to-end tests. It needs both Node and .NET.

Report the commands you ran and any suite you could not run.
