# API contract

Base URL defaults to `/api`. All endpoints except `/demo/*` and `/health/*` require `Authorization: Bearer <token>`. Requests and errors use JSON; errors are `{ "error": "Human readable reason" }` with HTTP 400 (validation), 401 (identity), 403 (permission), 404 (missing), 409 (workflow/stale version), or 502 (the CRACN API behind `GET /lds` and `POST /records`, or the chat provider behind `POST /assistant/chat`, is unreachable or failing).

| Method / path | Request | Response |
| --- | --- | --- |
| `GET /demo/users` | None | Synthetic actors |
| `POST /demo/session` | `{userId}` | `{user,token}`; demo only |
| `GET /demo/simulated`, `POST /demo/simulated` | None; `{records,templates}` | `{accepts,loaded}`; `{records,sequence}`. Dev sandbox only: mapped only in Development or Testing with `Demo:AcceptSimulatedData` set, so hosts never implement it |
| `GET /bootstrap` | None | `{user,users,templates,permissions,records}` |
| `GET /lds?jcn=21036WX010184` | None | `{workStatement,refit,component,location,swbs}` |
| `POST /history/search` | `{condition}` | `{summary,matches:[{id,serial,title,resolution,rationale,similarity}]}` |
| `POST /assistant/chat` | `{recordId,messages:[{role,content}]}` | `{reply,model,mock}` |
| `POST /records` | `{name,shop,phone,references,condition,jcn}` | Created record |
| `GET /records/:id` | None | Accessible record |
| `POST /records/:id/:action` | See below, plus current `version` | Updated record or `{deleted:true}` |
| `GET /records/:id/pdf` | Optional `?revision=0` | Approved `application/pdf` snapshot |
| `GET /records/:id/files/:fileId` | Optional `?revision=0` | Original file bytes |
| `POST /permissions` | `{userId,crossSite,dualSign}` | Permission map; admin only |
| `GET /events` | None | Optional. `text/event-stream` of live changes and presence (below) |
| `POST /presence` | `{connectionId,view,recordId?}` | Optional. `{ok:true}`; reports what this workspace shows |

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

`references`, `condition`, `resolution`, and `rationale` may contain paragraphs, bold, italic, underline, and lists. The workspace shows a sanitized subset of that markup. `dfs` and `tvd` are `yes` or `no`, with references mandatory for `yes`. `attributes` accepts `Level 1`, `Requires Rev`, `SOC`, `SUBSAFE`. Completion accepts `Completed`, `Deferred`, `Other`, `Canceled`. All but Completed require an explanation. `section` accepts `Condition`, `Reference`, `Continuation`. Files are PNG, JPEG, WebP, PDF or TXT, maximum 15 MB per file and 20 files per record.

An assigned ESR number is a two-digit UTC year, a sequence from `0001` to `9999`, and a revision suffix from `A` to `ZZ`. Assignment issues revision `A`. Each later `revise` advances the suffix, so the last revision of the first 2026 number is `260001ZZ`. The sequence resets every UTC year and the 9999th number of that year is the last. Unassigned requests have no number. The `serial` field is the full number. `serialBase` is the year and sequence without the suffix.

`GET /lds` and `POST /records` resolve the JCN through the CRACN API (`cracn_openapi.json`, at the backend's `Cracn:BaseUrl`): `workStatement` comes from the job's `csmpSummary`, `refit` from its refit number, and `component`/`location` from its configuration item (`equipmentName / equipmentSerialNumber`). `swbs` is that item's hierarchical structure code, which CRACN maps from the LDS function group code. A JCN is 13 characters: five digits, four letters or digits, then a sequence from `0001` to `9999` (for example `12345WX019999`). The backend trims and upper-cases it, and a malformed JCN returns 400 before any CRACN call. An unknown JCN returns 404; an unreachable or failing CRACN returns 502. `jcn: "N/A"` skips the lookup.

`POST /assistant/chat` is stateless. The client sends the whole transcript, oldest first, with roles `user` or `assistant` and the last turn from `user`. A conversation holds at most 20 messages of up to 4000 characters each. The server prepends its own system prompt built from the record and its closest closed matches, so clients cannot send a `system` turn. Access follows the draft editor rule: the assigned engineer or a supervisor, local facility, `In Process` only. The call never changes the record. `mock` is `true` when the backend has no provider key configured, and the reply is then a labeled placeholder. Provider errors return 502 without the provider's error body.

Records carry a monotonically increasing `version`. The component submits it on actions; a stale version fails with 409. Mutations are validated on a deep copy and committed under a store lock. Record DTOs omit the binary attachment payload; downloads require authenticated access. Snapshots preserve attachment bytes and all signature evidence.

Cross-facility access is `none`, `read`, or `review`. Review permits comments only. Dual-sign delegation does not override facility boundaries and requires a comment. The API derives every signature identity from the validated JWT, never the action body. The demo JWT is HS256, issuer `esr-demo`, audience `esr-workspace`, with a one-hour expiry and a process-local random key.

## Live updates (optional)

`GET /events` is a [server-sent event](https://html.spec.whatwg.org/multipage/server-sent-events.html) stream authenticated with the same bearer token as every other call. The component reads it with `fetch`, because `EventSource` cannot send an `Authorization` header and a token in the URL would leak into logs. An API that answers 404, 405, or 501, or a non-`text/event-stream` body, is treated as having no live updates: the component keeps working and does not retry until the identity, token provider, or `apiBase` changes. Other failures retry with backoff from 1 to 30 seconds.

| Event | Data | Sent |
| --- | --- | --- |
| `hello` | `{connectionId}` | First, once per stream |
| `record-changed` | `{id,version,status,serial,action,actor,actorId,deleted,time}` | After each committed create or record action, in commit order, only to identities that can see the record. A failed action sends nothing |
| `presence` | `{viewers:[{connectionId,userId,name,role,site,view,recordId}]}` | When any stream opens, closes, or reports presence |

A comment line (`: ping`) every 15 seconds keeps proxies from closing an idle stream. The events carry no record content: on `record-changed` the component fetches `GET /records/:id` when its copy is older than `version`, and removes the record when `deleted` is true.

`POST /presence` accepts `view` of `workspace`, `record`, `watch-floor`, or `other`, and a `recordId` the caller can open (404 otherwise). Only the identity that opened a connection may report for it (403). Everyone sees who is online, but a viewer's `recordId` is null for identities that cannot open that record. Closing the stream removes the connection from presence.

The demo keeps connections in process, like its record store, which is one reason it runs a single replica. A multi-instance deployment needs a shared channel (for example Redis pub/sub) behind these endpoints.
