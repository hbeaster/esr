# ESR Workspace

An embeddable **Vue 3 + TypeScript web component** backed by a thin **ASP.NET Core / .NET 10** demo API. The component uses Shadow DOM, a bundled Vue runtime, and a light theme. The host application is separate from the npm package.

All records, LDS responses, historical matches, identities, signatures and approvals are **synthetic**. The backend keeps data in memory; restarting it resets the demo. The public role selector is a demonstration tool, not an authentication system.

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

The npm allowlist includes only `dist/component/`, this README, the API and host communication contracts, and the license. It excludes the demo host, C# backend, synthetic seed records, deployment files, tests, and source tree. `npm pack` also builds the component through `prepack`. No registry publishing is performed.

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
  --esr-bg: #f5f7f8;
}
```

See [API contract](docs/api.md) for the endpoints an embedding host must provide. Vue's [custom element guidance](https://vuejs.org/guide/extras/web-components) describes the underlying embedding model.

## Run the demo locally

Requires the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0).

```sh
npm ci
npm run dev:api  # terminal 1: ASP.NET on http://127.0.0.1:5080
npm run dev      # terminal 2: Vue host on http://127.0.0.1:5173
```

Use the identity selector above the workspace to follow each role. Start with **Requestor**, create a request, switch to **Supervisor** to assign it, then **Engineer**, **Supervisor**, **Shop**, and **Division Head** for the full workflow. Administrator can grant cross-TRF review and delegated signatures. Demo JCNs are `JCN-260184` and `JCN-260207`; `N/A` is supported.

A host-only build is available with `npm run build:host`, producing `dist/host/`. The Docker build copies this into ASP.NET's `wwwroot` so one server serves both the host and API.

## Docker

```sh
docker build -t esr-demo:local .
docker run --rm -p 127.0.0.1:8080:8080 esr-demo:local
# Or:
docker compose up --build
```

Open `http://localhost:8080`. The multi-stage image builds Vue with Node and the backend with .NET, then runs only the ASP.NET runtime as a non-root user. Health endpoints are `/health/live` and `/health/ready`.

## Esra AI

Esra stays off until the deployment sets an OpenAI-compatible chat endpoint. The browser never receives the API key. The same settings work for a commercial provider or a local agent such as Ollama.

| Setting | Purpose | Example |
| --- | --- | --- |
| `EsrAi__BaseUrl` | API root, with no trailing path | `https://api.openai.com/v1` or `http://127.0.0.1:11434/v1` |
| `EsrAi__Model` | Model or local agent name | `gpt-4o-mini` |
| `EsrAi__ApiKey` | Credential. Omit it when the local agent does not require one | |
| `EsrAi__CompletionsPath` | Path appended to the base URL | `chat/completions` |
| `EsrAi__AuthHeader` | Header that carries the credential | `Authorization` |
| `EsrAi__AuthScheme` | Scheme before the key. Empty sends the key as the whole header value | `Bearer` |

```sh
EsrAi__BaseUrl=http://127.0.0.1:11434/v1 EsrAi__Model=llama3.1 docker compose up --build
```

In Kubernetes, create a secret named `esr-ai` with `baseUrl`, `apiKey`, and `model`. The deployment reads those keys only when the secret exists. See [the API contract](docs/api.md) for the review response.

## Kubernetes

Build and load `esr-demo:local` into your local cluster, or push it to your own registry and update the image:

```sh
# Local kind example:
kind load docker-image esr-demo:local
kubectl apply -k deploy/k8s
kubectl rollout status deployment/esr-demo
kubectl port-forward service/esr-demo 8080:80
```

For a registry, use a kustomize overlay or `kubectl set image deployment/esr-demo esr=YOUR_REGISTRY/esr-demo:TAG`. Add your ingress/TLS policy in the deployment environment. No cluster changes or remote publication are performed by the build commands.

The manifest includes startup/readiness/liveness probes, CPU/memory requests and limits, a read-only root filesystem, dropped capabilities, and a temporary volume. **Keep one replica**: demo records and JWT signing keys are process-local. Production scaling requires shared persistence and a real identity provider. `Recreate` avoids concurrent mock stores during rollout.

## Validate

```sh
npm run lint                   # ESLint recommended JavaScript / TypeScript / Vue rules
npm run typecheck              # Strict TypeScript and Vue template checks
npm test                       # Vitest + Vue Test Utils component/controller unit tests
npm run test:component          # browser integration with isolated API fixtures
npm run test:backend            # xUnit domain and ASP.NET HTTP integration tests
npx playwright install chromium
npm run test:e2e                # actual Vue host + actual .NET backend in Chromium
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

UI sections share a typed, instance-local Vue injection context. No state is shared across custom-element instances. Small presentation components, such as the signature record, use typed props. Styles remain inside the outer custom element’s shadow root so ordinary child Vue components inherit the same theme.

## Design and decisions

- The reusable component is independent of the demo host and .NET server.
- Workflow rules and permissions are enforced by the API, not only hidden buttons.
- Signatures derive name and user ID from a server-verified demo JWT, ignoring submitted signature identities.
- Supervisor-approved templates only, per the agreed policy. Templates are maintained in the synthetic catalog.
- New revisions copy prior content, retain frozen prior versions, and require fresh signatures.
- Rejected initiation requests stay `Unassigned` with a returned flag/comment, preserving the five-state primary workflow. The requestor can update and resubmit.
- Base serials are `YYNNNN`; revisions append `A`–`ZZ`. This resolves the PRD's ambiguous initial suffix using the explicit revision requirement.
- Shop deferral sets `ESR Issued – Deferred`. Division Head must explicitly acknowledge that disposition before closing.
- PDF export is a paginated engineering record with references, attributes, signatures, comments, audit trail, and embedded original attachments. JPEG and standard non-interlaced 8-bit PNG images are rendered on printable continuation pages. All original files are also embedded; WebP and other PNG variants are retained as originals with UI previews. The PDF is a demonstration layout, not a certified facility form.
- Historical “AI” results use deterministic term overlap and a synthetic summary. They are not real generative or semantic search results and are labeled accordingly.
- Esra AI is separate. A reviewer opens it from an **Esra AI** button on a request row. The API summarizes that ESR and returns similarity scores for other visible ESRs. The provider is whatever OpenAI-compatible endpoint the deployment configures.

## Source map

| Location | Responsibility |
| --- | --- |
| `src/Workspace.ce.vue` | Custom-element shell and instance-local context provider |
| `src/components/` | Request workspace, record tabs, dialogs, forms, signatures, and permissions |
| `src/composables/useWorkspace.ts` | Typed state, API actions, draft and workflow coordination |
| `src/composables/useDialogFocus.ts` | Modal focus trapping and keyboard lifecycle |
| `src/styles/workspace.css` | Shared theme, injected once into the custom element shadow root |
| `src/api.ts` | Typed host-token API adapter |
| `src/presentation.ts` | Search filtering, status tones, and display helpers |
| `src/types.ts` | Shared domain DTOs and public component types |
| `src/index.ts` | Custom element registration and package exports |
| `host/main.ts` | Demo-only identity selector and host initialization |
| `backend/Esr.Api/Workflow.cs` | Authorization, transitions, revisions, validation |
| `backend/Esr.Api/DemoIdentity.cs` | Ephemeral signed demo JWTs |
| `backend/Esr.Api/PdfExport.cs` | Paginated PDF and embedded attachments |
| `backend/Esr.Tests/` | Domain and HTTP integration tests |
| `tests/unit/` | Vitest and Vue Test Utils unit tests |
| `tests/component/` | Isolated component browser tests and bundle smoke test |
| `tests/e2e/` | Full browser workflow against ASP.NET |
| `deploy/k8s/` | Deployment, service and kustomization |

## Production integration boundary

Replace the in-memory store, demo session endpoints, deterministic history service and LDS fixtures with production adapters. A production rollout also needs the facility-approved PDF layout, actual signature/compliance requirements, durable attachment storage and malware scanning, a persistent append-only audit store, server-side session/permission administration, operational monitoring, and a defined retention policy. None of those services are represented as production-ready in this synthetic build.
