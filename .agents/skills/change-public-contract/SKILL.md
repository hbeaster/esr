---
name: change-public-contract
description: Updates the public esr-workspace host contract and the API contract that embedding hosts must implement. Use when changing custom element properties, events, exported types, tokenProvider, apiBase, record-change, workspace-error, or endpoints documented for hosts.
---

# Change the public contract

`docs/host-component-contract.md` and `docs/api.md` ship inside the npm package. A behavior change that a host can observe includes the matching doc in the same edit.

## Host component

- Record properties and attributes in `docs/host-component-contract.md`. `apiBase` maps to the `api-base` attribute. `tokenProvider` is a function property and has no attribute.
- Replacing `tokenProvider` with a new function reloads bootstrap. Changing `apiBase` alone leaves the current records on screen.
- The events are `record-change` and `workspace-error`. They do not bubble, compose, or cancel. Listeners read `event.detail[0]` because Vue wraps custom-element payloads in a one-element array.
- Exported types come from `src/types.ts` through `src/index.ts`. The package entry is `dist/component/esr-workspace.js` and `dist/component/index.d.ts`.
- The demo identity selector in `host/` stays out of the public component surface.

## API

- Endpoint and action changes update the tables in `docs/api.md`.
- Errors stay `{ "error": "..." }` with 400, 401, 403, 404, or 409.
- Record DTOs omit attachment bytes. Authenticated download routes return the original bytes.

## Package boundary

The `files` list in `package.json` stays limited to `dist/component`, `README.md`, `LICENSE`, `docs/api.md`, and `docs/host-component-contract.md`.

## Verify

Run `npm run test:component` after a host-surface or bundle change. Run `npm run typecheck` when exported types change. Run `npm run test:backend` when an endpoint changes.
