---
description: Vue workspace conventions for the embeddable component and demo host
alwaysApply: false
globs: src/**/*.vue,src/**/*.ts,host/**/*.ts
applyTo: "src/**/*.vue,src/**/*.ts,host/**/*.ts"
paths:
  - "src/**/*.vue"
  - "src/**/*.ts"
  - "host/**/*.ts"
---

# Vue workspace

- Vue SFCs use `<script setup lang="ts">`. Domain DTOs and public component types live in `src/types.ts`. Search, status tones, and display helpers live in `src/presentation.ts`.
- Child sections read workspace state with `useWorkspaceContext()`. Pass a section only the props it renders. Keep state inside the custom element that provided it.
- Dialogs use `useDialogFocus` for focus trapping and keyboard dismissal.
- Styles stay in `src/styles/workspace.css` and are injected once into the custom-element shadow root from `src/index.ts`.
- `host/` is the demo identity selector. Demo session and role switching stay in `host/` and out of the component bundle.
- `apiBase` is a string property and the `api-base` attribute. `tokenProvider` is a function property. Assign it on the element.
