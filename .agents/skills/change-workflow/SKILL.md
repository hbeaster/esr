---
name: change-workflow
description: Adds or changes an ESR workflow status, role check, or record action across the API, Vue workspace, contract doc, and tests. Use when editing workflow transitions, roles, record actions, assignment, approval, shop completion, closeout, revision, or POST /records/:id/:action.
---

# Change a workflow action

Authority is `backend/Esr.Api/Workflow.cs`. The UI may hide a control the API still rejects. Update both, and treat the API as the rule.

## Before editing

Read the current `Execute` switch and the action table in `docs/api.md`. Match existing status strings. The deferred status is `ESR Issued – Deferred` (en dash, U+2013).

## Update these together

- `backend/Esr.Api/Workflow.cs` for the role, status, required fields, signature block, and audit entry.
- `src/types.ts` when `WorkflowStatus` or `WorkflowAction` changes.
- `src/api.ts` for the action request body.
- `src/components/WorkflowActions.vue` and `src/components/WorkflowActionForm.vue` for when the control is offered and what it submits.
- `src/composables/useWorkspace.ts` for draft and action coordination.
- `docs/api.md` for the method, body, role, and state.
- `backend/Esr.Tests/WorkflowTests.cs` with one fact for the allowed path and one for a forbidden path.
- `docs/requirements.md` only when a decision recorded there changes.

## Checks that belong in the API

- Clone, validate, then commit under `workflow.Sync`. A thrown `RuleException` leaves the stored record unchanged.
- Compare `version` on the action body. A stale write returns 409.
- Build each signature from the authenticated actor. The body may carry a comment.
- Rejecting an unassigned request sets `Rejected` and leaves the status `Unassigned`.
- Dual-sign requires the administrator permission and a comment, and it stays inside the record's facility.
- Cross-facility review may comment. It cannot edit, attach, or sign.
- Shop `complete` happens once per revision. A deferred completion requires Division Head `acknowledgeDeferred` before `close`.
- `revise` snapshots the prior record, clears signatures and completion, and returns the record to `In Process`.

## Verify

Run `npm run test:backend`. When a Vue control or form changed, also run `npm test`. When the handoff a person sees changed, also run `npm run test:e2e`.
