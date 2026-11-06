# ESR Workspace

An embeddable **Vue 3 + TypeScript web component** backed by a thin **ASP.NET Core / .NET 10** demo API. The component uses Shadow DOM, a bundled Vue runtime, and a light theme. The host application is separate from the npm package.

All records, LDS responses, historical matches, identities, signatures and approvals are **synthetic**. The backend keeps data in memory and starts with no records or templates; it only ships demo identities. JCN lookups go to the CRACN mock. Restarting it resets the demo. The public role selector is a demonstration tool, not an authentication system.

## Build and package only the component

Requires Node.js 22.13+ (22.x) or 24+ and npm. **No .NET SDK, Docker, or backend build is needed.**

```sh
npm ci
npm run build:component
npm run package:component
```

`npm run build` is an alias for the component-only build.

- Bundle: `dist/component/esr-workspace.js`
- Type declarations: `dist/component/index.d.ts`
- Installable npm tarball: `artifacts/trf-esr-workspace-0.1.0.tgz`

The npm allowlist includes only `dist/component/`, this README, the API and host communication contracts, and the license. It excludes the demo host, C# backend, synthetic data, deployment files, tests, and source tree. `npm pack` also builds the component through `prepack`. No registry publishing is performed.

### Embed in another application

See the [host and component communication specification](docs/host-component-contract.md) for the input properties, event payloads, authentication lifecycle, and integration checklist.

```sh
npm install ./artifacts/trf-esr-workspace-0.1.0.tgz
```

```html
<esr-workspace api-base="/api"></esr-workspace>
```

```js
import '@trf/esr-workspace';

const workspace = document.querySelector('esr-workspace');
workspace.tokenProvider = async () => getAccessTokenFromYourHost();
workspace.addEventListener('record-change', event => {
  // Vue custom-element events provide emitted arguments in an array.
  const [{ id, action, status }] = event.detail;
  console.log(id, action, status);
});
workspace.addEventListener('workspace-error', event => {
  const [{ message }] = event.detail;
  console.error(message);
});
```

The host owns token acquisition and renewal. `tokenProvider` is invoked for every API call; assigning a new provider reloads the workspace. The mock API accepts its own demo JWTs; a production host token requires replacing the demo identity adapter with real JWT/OIDC validation. Use a same-origin reverse proxy for `/api`; cross-origin deployments must explicitly configure CORS on their API.

For Vue hosts, configure `compilerOptions.isCustomElement` for `esr-workspace`. For React/Angular hosts, assign the function property through a DOM reference. You can import `registerEsrWorkspace` and register an additional custom tag when needed.

```css
esr-workspace {
  --esr-accent: #196b57;
  --esr-bg: #f4f6f8;
}
```

See [API contract](docs/api.md) for the endpoints an embedding host must provide. Vue's [custom element guidance](https://vuejs.org/guide/extras/web-components) describes the underlying embedding model.

## Run the demo locally

Requires the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0).

```sh
npm ci
npm run dev:cracn  # terminal 1: mock CRACN API on http://127.0.0.1:4010
npm run dev:api    # terminal 2: ASP.NET on http://127.0.0.1:5080
npm run dev        # terminal 3: Vue host on http://127.0.0.1:5173
```

### CRACN API and mock data

JCN context (work statement, refit, component, location) comes from the **CRACN API** described by `cracn_openapi.json`. The backend reads `GET /api/v1/jobs/{jcn}` for the work statement and refit, then the job's configuration item for the component and location. It does this both for **Import LDS** and when a request is submitted, so saved records and PDFs carry the CRACN values.

`Cracn:BaseUrl` (environment variable `Cracn__BaseUrl`) defaults to the local mock at `http://127.0.0.1:4010`. Point it at a real CRACN deployment and set `Cracn:Token` to its service bearer token. If CRACN is unreachable, lookups fail with 502 and requests can still be submitted with `N/A`.

`mocks/cracn/` turns the spec into a stateful mock server. It routes every operation in the spec. It serves list, get, create, update and delete from in-memory state seeded with `mocks/cracn/data.json`, supports `limit`, `offset`, `filters` and `orderBy` (as JSON query values), allows every `auth/*` check, and generates responses for other operations from their schemas. It accepts any non-empty bearer token, and `POST /__mock/reset` restores the seed data. The data is generated deterministically from the spec, with the demo records in `mocks/cracn/curated.mjs` merged in. After changing either the spec or that file, run `npm run mock:generate`; `npm run mock:check` (part of `validate`) fails when `data.json` is stale.

### Assistant chat and API keys

The **Resolution** tab has an assistant chat for the engineer drafting an `In Process` ESR. The browser never sees a provider key. The component calls `POST /api/assistant/chat`, and the backend adds the record context and forwards the conversation to any OpenAI-compatible Chat Completions endpoint.

| Setting | Environment variable | Default |
| --- | --- | --- |
| `Chat:ApiKey` | `Chat__ApiKey` | empty, which serves a labeled mock reply |
| `Chat:BaseUrl` | `Chat__BaseUrl` | `https://api.openai.com/v1` |
| `Chat:Model` | `Chat__Model` | `gpt-4o-mini` |
| `Chat:TimeoutSeconds` | `Chat__TimeoutSeconds` | `60` |

To try it with an OpenAI key, put it in `.env` (copy `.env.example`, set `CHAT_API_KEY`). `npm run dev:api` loads `.env` through `scripts/dev-api.mjs`, the same file Docker Compose reads, and logs whether the chat uses a real model or the mock without printing the key. A key in the shell still wins:

```sh
Chat__ApiKey=sk-proj-... npm run dev:api
```

`npm run dev` reads the same `.env`, so with **Use fake data** on, the chat also uses the real model. Simulated records live only in the dev server, so the dev server grounds the chat in the simulated record and calls the provider itself (`host/simulated/chat.ts`, mirroring `backend/Esr.Api/Chat.cs`). The key stays in the dev server process, and builds never include it. Without a key, the fake-data chat gives a labeled simulated reply. Both servers log which mode they use at startup, without printing the key.

The end-to-end tests force an empty key on the API and dev server they start, so they always use the mock. Outside CI, Playwright reuses servers already listening on ports 5080 and 5173, and those keep whatever key they started with. Stop a keyed `dev:api` or `dev` before `npm run test:e2e` to avoid real model calls.

Another provider only needs a different base URL and model, for example `Chat__BaseUrl=https://api.anthropic.com/v1/` with an Anthropic key, or `Chat__BaseUrl=http://localhost:11434/v1` for a local Ollama. Keep keys in the environment or a secret store, never in committed files. Backend tests always use the mock, even when `Chat__ApiKey` is set. In Kubernetes, put the key in a Secret and reference it from the `esr` container's `env`.

The workspace starts empty. Use the identity selector above the workspace to follow each role. Start with **Requestor**, create a request, switch to **Supervisor** to assign it, then **Engineer**, **Supervisor**, **Shop**, and **Division Head** for the full workflow. Administrator can grant cross-TRF review and delegated signatures. Demo JCNs are `21036WX010184` and `21036WX020207`; every other job in the mock data (for example `71204POAH7469`) also resolves, and `N/A` is supported.

A host-only build is available with `npm run build:host`, producing `dist/host/`. The Docker build copies this into ASP.NET's `wwwroot` so one server serves both the host and API.

### Simulated data (dev only)

With `npm run dev`, the top-right **Use fake data** button is the only way to see pre-populated data. It switches the workspace to a generated dataset of 60 records and 3 templates, covering every workflow status, returned requests, deferrals, revisions, attachments and long text. Each simulated job has a location in the standard nautical format (compartment, level, frame, port or starboard, inboard or outboard; see `docs/api.md`), and together they cover every level of the FWD Compartment, Missile Compartment, and Engine Room. About four months of history ends yesterday: most Bangor ESRs are closed out, and 14 stay open with a mix of on-track, aging, and stale work (`openBangorStages` in `host/simulated/data.ts`). Dates are relative to the current day, so that mix stays the same whenever you look. An amber **SIMULATED DATA** badge shows while it is on, and the choice survives a reload. Select **Use API data** to switch back.

The dataset comes from the Vite dev server. What fake mode can do depends on whether `npm run dev:api` is running:

| | `npm run dev` only | With `npm run dev:api` |
| --- | --- | --- |
| Browse, filter, replay, dive, watch floor | Yes | Yes |
| Sign, submit, approve, close, revise, new requests | No: actions show a read-only error | Yes, through the real workflow |
| PDF export, live push and presence | No | Yes |

`npm run dev:api` also starts a sandbox copy of the API on port 5081 (Development, with `Demo:AcceptSimulatedData`). The first fake-data request loads the 60 simulated records into it, and the dev server then forwards every fake-data request there. Every rule runs in `Workflow.cs`, so nothing is duplicated in the browser or dev server. New ESR numbers continue after the highest simulated one. The sandbox keeps data in memory: changes survive a dev-server restart but reset when `npm run dev:api` restarts. Set `ESR_SIMULATED_API=off` to skip the sandbox, or point it elsewhere with `ESR_SIMULATED_API=<url>`. New requests on fake data can use the CRACN mock's JCNs or N/A; the simulated-only JCNs are not in the mock.

The button, badge, dataset, and sandbox are not included in production host builds or the npm package. The sandbox endpoint only exists in Development or Testing with the flag set, so Compose and Kubernetes never expose it. The end-to-end tests keep fake mode read-only (`ESR_SIMULATED_API=off`).

## Docker

```sh
docker build -t esr-demo:local .
docker run --rm -p 127.0.0.1:8080:8080 esr-demo:local
# Or:
docker compose up --build
```

To enable the assistant chat under Compose, copy `.env.example` to `.env` and set `CHAT_API_KEY`. Compose reads `.env` and passes the chat settings to the API container. `.env` is git-ignored. Without a key, the chat answers with the labeled mock.

Open `http://localhost:8080`. Compose also builds and starts the CRACN mock (`mocks/cracn/Dockerfile`) and points the backend at it. With plain `docker run`, pass `-e Cracn__BaseUrl=…` for a reachable CRACN, otherwise JCN lookups fail and only `N/A` requests can be submitted. The multi-stage image builds Vue with Node and the backend with .NET, then runs only the ASP.NET runtime as a non-root user. Health endpoints are `/health/live` and `/health/ready`.

## Kubernetes

Build and load `esr-demo:local` into your local cluster, or push it to your own registry and update the image:

```sh
# Local kind example:
docker build -f mocks/cracn/Dockerfile -t cracn-mock:local .
kind load docker-image esr-demo:local cracn-mock:local
kubectl apply -k deploy/k8s
kubectl rollout status deployment/esr-demo
kubectl port-forward service/esr-demo 8080:80
```

The pod runs the CRACN mock as a sidecar on `localhost:4010`. For a real CRACN, remove the sidecar and set `Cracn__BaseUrl` on the `esr` container. For a registry, use a kustomize overlay or `kubectl set image deployment/esr-demo esr=YOUR_REGISTRY/esr-demo:TAG`. Add your ingress/TLS policy in the deployment environment. No cluster changes or remote publication are performed by the build commands.

The manifest includes startup/readiness/liveness probes, CPU/memory requests and limits, a read-only root filesystem, dropped capabilities, and a temporary volume. **Keep one replica**: demo records and JWT signing keys are process-local. Production scaling requires shared persistence and a real identity provider. `Recreate` avoids concurrent mock stores during rollout.

## Validate

```sh
npm run lint                   # ESLint recommended JavaScript / TypeScript / Vue rules
npm run typecheck              # Strict TypeScript and Vue template checks
npm test                       # Vitest + Vue Test Utils component/controller unit tests
npm run test:component          # browser integration with isolated API fixtures
npm run test:backend            # xUnit domain and ASP.NET HTTP integration tests
npx playwright install chromium
npm run test:e2e                # actual Vue host + actual .NET backend + CRACN mock in Chromium
npm run validate               # unit tests, component browser tests, both builds, backend tests, full-flow browser tests
```

To validate entirely through Docker without a local .NET SDK:

```sh
docker run --rm -v "$PWD:/source" -w /source mcr.microsoft.com/dotnet/sdk:10.0 dotnet test backend/Esr.Tests --configuration Release
# With the built application running at localhost:8080:
ESR_BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

If .NET is installed outside PATH, `DOTNET_BIN=/path/to/dotnet npm run test:e2e` configures Playwright's backend command. xUnit can be run with `/path/to/dotnet test backend/Esr.Tests`.

CI runs these checks, creates the component tarball, and builds the Docker image. In the source checkout, see `docs/requirements.md` for the implemented PRD coverage and deliberate mock boundaries.

## Frontend development

All frontend application code, browser tests, and Vite/Playwright configurations use TypeScript. Vue SFCs use `<script setup lang="ts">`; `vue-tsc` checks both scripts and templates in strict mode. Vite builds the component and host independently, and `vue-tsc` generates package declarations from the source rather than copying a handwritten declaration.

ESLint uses the unmodified recommended configurations from ESLint, typescript-eslint, and eslint-plugin-vue. `npm run lint` rejects warnings; `npm run lint:fix` applies available fixes. `npm run format` formats the frontend with Prettier and then applies ESLint’s Vue formatting defaults.

UI sections share a typed, instance-local Vue injection context. No state is shared across custom-element instances. Small presentation components, such as the signature record, use typed props. Each SFC carries its own `<style scoped>` block on top of a shared base sheet of tokens and primitives. Every SFC compiles in custom-element mode, so all of these styles land inside the element's shadow root and none reach the host page.

## Design and decisions

- The reusable component is independent of the demo host and .NET server.
- Workflow rules and permissions are enforced by the API, not only hidden buttons.
- Signatures derive name and user ID from a server-verified demo JWT, ignoring submitted signature identities.
- Supervisor-approved templates only, per the agreed policy. The API ships no templates; the catalog needs a production source, and the dev-only simulated data includes samples.
- New revisions copy prior content, retain frozen prior versions, and require fresh signatures.
- Rejected initiation requests stay `Unassigned` with a returned flag/comment, preserving the five-state primary workflow. The requestor can update and resubmit.
- ESR numbers are a two-digit year, a sequence from `0001` to `9999`, and a revision from `A` to `ZZ`. Assignment issues revision `A`. `260001ZZ` is the last revision of the first number in 2026.
- Shop deferral sets `ESR Issued – Deferred`. Division Head must explicitly acknowledge that disposition before closing.
- PDF export is a paginated engineering record with references, attributes, signatures, comments, audit trail, and embedded original attachments. JPEG and standard non-interlaced 8-bit PNG images are rendered on printable continuation pages. All original files are also embedded; WebP and other PNG variants are retained as originals with UI previews. The PDF is a demonstration layout, not a certified facility form.
- Historical “AI” results use deterministic term overlap and a synthetic summary. They are not real generative or semantic search results and are labeled accordingly.
- Assistant chat is real generative AI only when the API has a provider key. The key stays server-side, the server owns the system prompt, and chat replies enter the draft only when the engineer clicks to add them.

## Source map

| Location | Responsibility |
| --- | --- |
| `src/Workspace.ce.vue` | Custom-element shell and instance-local context provider |
| `src/components/` | Request workspace, record tabs, dialogs, forms, signatures, and permissions |
| `src/composables/useWorkspace.ts` | Typed state, API actions, draft and workflow coordination |
| `src/composables/useDialogFocus.ts` | Modal focus trapping and keyboard lifecycle |
| `src/styles/workspace.css` | Shared base (tokens, element defaults, primitives), loaded by `Workspace.ce.vue`; component rules live in each SFC's `<style scoped>` |
| `src/api.ts` | Typed host-token API adapter |
| `src/presentation.ts` | Search filtering, status tones, and display helpers |
| `src/types.ts` | Shared domain DTOs and public component types |
| `src/index.ts` | Custom element registration and package exports |
| `host/main.ts` | Demo-only identity selector and host initialization |
| `host/simulated/` | Dev-only fake dataset, read-only stand-in API, writable sandbox proxy, Vite plugin, and toggle |
| `backend/Esr.Api/Workflow.cs` | Authorization, transitions, revisions, validation |
| `backend/Esr.Api/DemoIdentity.cs` | Ephemeral signed demo JWTs |
| `backend/Esr.Api/Chat.cs` | Assistant chat prompt, provider adapter, and mock |
| `backend/Esr.Api/PdfExport.cs` | Paginated PDF and embedded attachments |
| `backend/Esr.Tests/` | Domain and HTTP integration tests, with sample data in `test-data.json` |
| `tests/unit/` | Vitest and Vue Test Utils unit tests |
| `tests/component/` | Isolated component browser tests and bundle smoke test |
| `tests/e2e/` | Full browser workflow against ASP.NET |
| `deploy/k8s/` | Deployment, service and kustomization |

## Production integration boundary

Replace the in-memory store, demo session endpoints, deterministic history service and LDS fixtures with production adapters. A production rollout also needs the facility-approved PDF layout, actual signature/compliance requirements, durable attachment storage and malware scanning, a persistent append-only audit store, server-side session/permission administration, operational monitoring, and a defined retention policy. None of those services are represented as production-ready in this synthetic build.
