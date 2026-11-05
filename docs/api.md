# API contract

Base URL defaults to `/api`. All endpoints except `/demo/*` and `/health/*` require `Authorization: Bearer <token>`. Requests and errors use JSON; errors are `{ "error": "Human readable reason" }` with HTTP 400 (validation), 401 (identity), 403 (permission), 404 (missing), 409 (workflow/stale version), or 502 (the CRACN API behind `GET /lds` and `POST /records` is unreachable or failing).

| Method / path | Request | Response |
| --- | --- | --- |
| `GET /demo/users` | None | Synthetic actors |
| `POST /demo/session` | `{userId}` | `{user,token}`; demo only |
| `GET /bootstrap` | None | `{user,users,templates,permissions,records}` |
| `GET /lds?jcn=21036WX010184` | None | `{workStatement,refit,component,location}` |
| `POST /history/search` | `{condition}` | `{summary,matches:[{id,serial,title,resolution,rationale,similarity}]}` |
| `POST /records` | `{title,name,shop,phone,references,condition,jcn}` | Created record |
| `GET /records/:id` | None | Accessible record |
| `POST /records/:id/:action` | See below, plus current `version` | Updated record or `{deleted:true}` |
| `GET /records/:id/pdf` | Optional `?revision=0` | Approved `application/pdf` snapshot |
| `GET /records/:id/files/:fileId` | Optional `?revision=0` | Original file bytes |
| `POST /permissions` | `{userId,crossSite,dualSign}` | Permission map; admin only |

Action bodies:

| Action | Body | Authorized role / state |
| --- | --- | --- |
| `assign` | `{engineerId}` | Supervisor / Unassigned |
| `reject` | `{comment}` | Supervisor / Unassigned |
| `resubmit` | `{condition}` | Original requestor / returned Unassigned |
| `delete` | `{}` | Supervisor / Unassigned |
| `draft` | `{resolution,rationale,dfs,dfsReference,tvd,tvdReference,attributes}` | Assigned engineer or supervisor / In Process |
| `resolve` | `{comment?}` | Assigned engineer or delegated signer / In Process |
| `approve` | `{comment?}` | Supervisor or delegated signer / Awaiting Approval |
| `return` | `{comment}` | Supervisor / Awaiting Approval |
| `complete` | `{status,shop,explanation}` | Shop / ESR Issued, once per revision |
| `close` | `{comment?,acknowledgeDeferred?}` | Division Head / shop signed |
| `revise` | `{reason}` | Engineer or supervisor / issued or closed |
| `comment` | `{text}` | Local actors or cross-facility review permission |
| `attach` | `{name,type,section,base64}` | Requestor on initiation or draft editor |

`dfs` and `tvd` are `yes` or `no`, with references mandatory for `yes`. `attributes` accepts `Level 1`, `Requires Rev`, `SOC`, `SUBSAFE`. Completion accepts `Completed`, `Deferred`, `Other`, `Canceled`. All but Completed require an explanation. `section` accepts `Condition`, `Reference`, `Continuation`. Files are PNG, JPEG, WebP, PDF or TXT, maximum 15 MB per file and 20 files per record.

An assigned ESR number is a two-digit UTC year, a sequence from `0001` to `9999`, and a revision suffix from `A` to `ZZ`. Assignment issues revision `A`. Each later `revise` advances the suffix, so the last revision of the first 2026 number is `260001ZZ`. The sequence resets every UTC year and the 9999th number of that year is the last. Unassigned requests have no number. The `serial` field is the full number. `serialBase` is the year and sequence without the suffix.

`GET /lds` and `POST /records` resolve the JCN through the CRACN API (`cracn_openapi.json`, at the backend's `Cracn:BaseUrl`): `workStatement` comes from the job's `csmpSummary`, `refit` from its refit number, and `component`/`location` from its configuration item (`equipmentName / equipmentSerialNumber`). A JCN is 13 characters: five digits, four letters or digits, then a sequence from `0001` to `9999` (for example `12345WX019999`). The backend trims and upper-cases it, and a malformed JCN returns 400 before any CRACN call. An unknown JCN returns 404; an unreachable or failing CRACN returns 502. `jcn: "N/A"` skips the lookup.

Records carry a monotonically increasing `version`. The component submits it on actions; a stale version fails with 409. Mutations are validated on a deep copy and committed under a store lock. Record DTOs omit the binary attachment payload; downloads require authenticated access. Snapshots preserve attachment bytes and all signature evidence.

Cross-facility access is `none`, `read`, or `review`. Review permits comments only. Dual-sign delegation does not override facility boundaries and requires a comment. The API derives every signature identity from the validated JWT, never the action body. The demo JWT is HS256, issuer `esr-demo`, audience `esr-workspace`, with a one-hour expiry and a process-local random key.
