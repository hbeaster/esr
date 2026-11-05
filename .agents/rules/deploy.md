---
description: Demo container and Kubernetes constraints
alwaysApply: false
globs: Dockerfile,compose.yaml,deploy/k8s/**
applyTo: "Dockerfile,compose.yaml,deploy/k8s/**"
paths:
  - "Dockerfile"
  - "compose.yaml"
  - "deploy/k8s/**"
---

# Demo deploy

- The image builds the Vue host and the API, then runs only the ASP.NET runtime as a non-root user. Keep the read-only root filesystem, dropped capabilities, and the temporary volume.
- Health endpoints are `/health/live` and `/health/ready`. Keep the startup, readiness, and liveness probes.
- `replicas` stays 1 and the strategy stays `Recreate`. Records and the JWT signing key live in the process. A second replica would split the demo store.
- Esra credentials belong in the optional `esr-ai` secret (`baseUrl`, `model`, `apiKey`), not in the image or the manifest. Local demo credentials belong in the gitignored `.env`.
- Shared persistence, a real identity provider, and ingress or TLS belong to a production rollout. They are outside this demo.
