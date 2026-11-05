---
description: Where ESR tests live and how to run the matching suite
alwaysApply: false
globs: tests/**/*.ts,backend/Esr.Tests/**/*.cs
applyTo: "tests/**/*.ts,backend/Esr.Tests/**/*.cs"
paths:
  - "tests/**/*.ts"
  - "backend/Esr.Tests/**/*.cs"
---

# Tests

- Domain rules belong in `backend/Esr.Tests/WorkflowTests.cs`. HTTP status, auth, PDF, and file bytes belong in `backend/Esr.Tests/ApiTests.cs`. Run `npm run test:backend`.
- Vue component and controller behavior belongs in `tests/unit/*.test.ts` (Vitest, happy-dom). Run `npm test`.
- The built custom element against isolated API fixtures belongs in `tests/component/workspace.spec.ts`. Run `npm run test:component`, which rebuilds the component first.
- A full role handoff against the real API belongs in `tests/e2e/workflow.spec.ts`. Run `npm run test:e2e`.
- End-to-end tests use one worker. The in-memory store is process-local, so parallel browsers would share it.
- A new workflow rule needs a `WorkflowTests` fact even when a browser test also covers the same path.
