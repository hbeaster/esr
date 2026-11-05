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
- Component-specific CSS goes in that SFC's `<style scoped>` block. `src/styles/workspace.css` is the shared base: tokens, element defaults, and primitives used by more than one component (buttons, cards, badges, tags, forms, alerts). `Workspace.ce.vue` loads it with `<style src>`.
- All SFCs compile in custom-element mode, so Vue injects each child's styles into the `<esr-workspace>` shadow root when it first mounts. `tests/component/workspace.spec.ts` asserts no `data-v-` rule reaches the host document.
- A child component's root element also receives its parent's scope. Style a child's inner elements in the child, not with `:deep()` from the parent.
- `host/` is the demo identity selector. Demo session and role switching stay in `host/` and out of the component bundle.
- `apiBase` is a string property and the `api-base` attribute. `tokenProvider` is a function property. Assign it on the element.
