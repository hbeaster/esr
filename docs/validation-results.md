# Validation results — 2026-11-04

The earlier .NET and Docker blockers were resolved after Docker Desktop was started. The .NET SDK runs in a container; a native SDK installation is not required for these results.

## Passed locally

| Check | Result |
| --- | --- |
| Vue component production build | Passed; self-contained ESM bundle and TypeScript declarations |
| Separate demo-host production build | Passed locally and in Docker |
| Vitest unit tests | 6 passed |
| Chrome component integration tests | 4 passed, including standalone compiled-bundle loading |
| .NET domain and HTTP integration tests | 24 passed using `mcr.microsoft.com/dotnet/sdk:10.0` |
| Full Chrome end-to-end tests | 3 passed against the actual ASP.NET Docker image |
| Docker multi-stage image build | Passed; image `esr-demo:local` |
| Hardened container startup | Passed with UID 1654, read-only root filesystem, dropped capabilities, and no-new-privileges |
| Container health probes | `/health/live` and `/health/ready` return HTTP 200 |
| Component npm package | Created, allowlist inspected, installed into a clean consumer directory |
| Dependency audit | Zero known npm vulnerabilities reported |
| Kubernetes manifests | `kubectl kustomize deploy/k8s` renders successfully |
| PDF export | Downloaded through browser; parsed with pypdf and rendered with Poppler |
| Image continuation PDF | PNG rendered on a continuation page; original attachment retained and verified |

Total automated tests: **37 passed** (6 frontend unit + 4 component browser + 24 backend + 3 full-workflow browser).

The full workflow test covers request creation and LDS import, attachment upload, assignment, historical-resolution insertion, DFS/TVD and attributes, engineer/supervisor signatures, issued PDF download, deferred shop sign-off, Division Head acknowledgement/closure, and immutable revision history. Additional browser coverage verifies cross-facility comments without engineering actions and mobile layout.

Visual QA covered desktop/mobile screenshots and exported PDF pages. Validation caught and fixed the PDF builder's C# initializer syntax, static-host routing order, mobile overflow from a visually hidden table header, and Escape handling after a disabled action button loses focus.

## Reproduce without a native .NET SDK

```sh
docker build -t esr-demo:local .
docker run --rm -v "$PWD:/source" -w /source mcr.microsoft.com/dotnet/sdk:10.0 dotnet test backend/Esr.Tests --configuration Release
# In another terminal:
docker run --rm -p 127.0.0.1:8080:8080 esr-demo:local
ESR_BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

## Limits

- No Kubernetes cluster rollout was requested or performed; manifest rendering is not live cluster validation.
- The verified Docker build used the local ARM64 platform. Other architectures were not run here.
- Data, identities, signatures, LDS, and historical AI results remain synthetic. These tests do not establish production security or engineering compliance.
- The PDF uses the demonstration layout; a facility-approved standard form still requires stakeholder approval.

The temporary validation container is stopped after checks. Start the demo with `docker compose up --build`.
