---
description: Authoritative workflow and API conventions
alwaysApply: false
globs: backend/**/*.cs,src/types.ts,src/api.ts,docs/api.md
applyTo: "backend/**/*.cs,src/types.ts,src/api.ts,docs/api.md"
paths:
  - "backend/**/*.cs"
  - "src/types.ts"
  - "src/api.ts"
  - "docs/api.md"
---

# Workflow and API

- Add or change an action in the `Execute` switch in `backend/Esr.Api/Workflow.cs`. Run `Execute`, `Create`, and `SetPermission` under `workflow.Sync`. Validate a deep copy, then replace the stored record. A failed check leaves the stored record unchanged.
- Role and state checks throw `RuleException`. Error JSON is `{ "error": "..." }` with 400 validation, 401 identity, 403 permission, 404 missing, 409 workflow or stale version, or 502 when CRACN (`backend/Esr.Api/Lds.cs`) is unreachable or failing.
- The deferred status string is `ESR Issued – Deferred` (en dash). Reject keeps `Unassigned` and sets `Rejected`.
- Signatures use the authenticated actor. The action body supplies the comment, not the signer's name or user id.
- `Workflow.Public` clears attachment `Base64` on the record and on each revision snapshot. Downloads go through the authenticated file route.
- Cross-facility access is `none`, `read`, or `review`. Review may comment. Dual-sign delegation stays inside the record's facility and requires a comment.
- Keep the `WorkflowStatus` and `WorkflowAction` unions in `src/types.ts` aligned with the server. Update the action table in `docs/api.md` in the same change.
