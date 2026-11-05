# API contract

Base URL defaults to `/api`. All endpoints except `/demo/*` and `/health/*` require `Authorization: Bearer <token>`. Requests and errors use JSON; errors are `{ "error": "Human readable reason" }` with HTTP 400 (validation), 401 (identity), 403 (permission), 404 (missing), or 409 (workflow/stale version).

| Method / path | Request | Response |
| --- | --- | --- |
| `GET /demo/users` | None | Synthetic actors |
| `POST /demo/session` | `{userId}` | `{user,token}`; demo only |
| `GET /bootstrap` | None | `{user,users,templates,permissions,records}` |
| `GET /lds?jcn=JCN-260184` | None | `{workStatement,refit,component,location}` |
| `POST /history/search` | `{condition}` | `{summary,matches:[{id,serial,title,resolution,rationale,similarity}]}` |
| `POST /records/:id/esra` | `{}` | `{summary,matches:[{id,serial,title,status,similarity,reason}]}` |
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

Records carry a monotonically increasing `version`. The component submits it on actions; a stale version fails with 409. Mutations are validated on a deep copy and committed under a store lock. Record DTOs omit the binary attachment payload; downloads require authenticated access. Snapshots preserve attachment bytes and all signature evidence.

`POST /records/:id/esra` asks the deployment's configured model to summarize that ESR and score its similarity to other ESRs the caller can already see. The request body is ignored. The provider credential stays on the server. Without `EsrAi:BaseUrl` and `EsrAi:Model` the endpoint returns 503. A provider failure returns 502. The historical search above remains a deterministic term-overlap mock.

Esra uses an OpenAI-compatible `POST {BaseUrl}/{CompletionsPath}` chat completion. `CompletionsPath` defaults to `chat/completions`. `AuthHeader` defaults to `Authorization` and `AuthScheme` defaults to `Bearer`; set `AuthScheme` to an empty string to send `ApiKey` as the raw header value. Point `BaseUrl` at a commercial API such as `https://api.openai.com/v1` or at a local agent such as `http://127.0.0.1:11434/v1`. The local demo reads these values from a gitignored `.env`. Do not commit the credential.

Cross-facility access is `none`, `read`, or `review`. Review permits comments only. Dual-sign delegation does not override facility boundaries and requires a comment. The API derives every signature identity from the validated JWT, never the action body. The demo JWT is HS256, issuer `esr-demo`, audience `esr-workspace`, with a one-hour expiry and a process-local random key.
