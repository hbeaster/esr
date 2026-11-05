# Host and ESR web component communication specification

Status: implemented contract for `@trf/esr-workspace` 0.1.0. Updated November 4, 2026.

The host embeds `<esr-workspace>`, supplies an API base URL and a token-provider function, and listens for DOM events. The component calls the ESR API directly. The host does not relay record data or workflow commands. This specification is for developers integrating the component into an application; the separate [API contract](api.md) defines the backend endpoints.

## Responsibilities

| Party | Responsibility |
| --- | --- |
| Host application | Register and mount the element, acquire and renew credentials, configure the API URL, handle sign-out and identity changes, and optionally react to events. |
| ESR component | Render the workspace, obtain a token before each request, load accessible data, submit workflow actions, display errors, and notify the host of record changes. |
| ESR API | Validate credentials, enforce permissions and workflow rules, persist records, resolve version conflicts, and supply downloads. |

Communication uses JavaScript properties, HTML attributes, DOM `CustomEvent`s, and HTTP. There is no iframe, `postMessage` protocol, shared application store, or dependency on the host's Vue runtime. Vue and component styles are bundled; the UI renders in a shadow root. Shadow DOM provides style isolation, not a security boundary.

## Host inputs

| Property | HTML attribute | Type | Default | Behavior |
| --- | --- | --- | --- | --- |
| `apiBase` | `api-base` | `string` | `/api` | API prefix used for subsequent requests. One trailing slash is removed before endpoint paths are appended. |
| `tokenProvider` | None supported | `() => string \| Promise<string>` or `null` | `null` | Called before every API request, including downloads. A new non-null function identity triggers a bootstrap reload. |

Assign `tokenProvider` as a JavaScript property. Do not put credentials or executable function text in HTML attributes. Return the raw access token without the `Bearer ` prefix. The component adds that prefix to the `Authorization` header. An empty token results in no Authorization header; the API decides whether to reject the request.

Configure `apiBase` before supplying the provider. Changing `apiBase` alone does not reload existing data. To change backend environments, replace the element so records from the old environment are not left on screen.

The host cannot set the current actor, role, site, permissions, or records through public properties. The API returns those values in `/bootstrap` and authorizes each operation independently.

## Registration and initialization

Importing the package automatically registers `esr-workspace` if that tag is not already registered. The package also exports the `EsrWorkspace` constructor and `registerEsrWorkspace(tagName?)`. Use the standard tag for integrations; load one package version per page. Registration does not replace an already registered element.

Initialization order:

1. Import the package in a browser environment.
2. Create the element and attach event listeners.
3. Set `apiBase` and `tokenProvider`.
4. Append it to the host's container.
5. The component obtains a token and requests `GET /bootstrap`.
6. On success, it renders the returned actor's accessible workspace. On failure, it displays an error and emits `workspace-error`.

There is currently no ready event or public loading-state property. `customElements.whenDefined('esr-workspace')` means registration is complete; it does not mean bootstrap has succeeded.

## TypeScript integration example

The following host adapter accepts the host's existing authentication and notification functions. It mounts one instance and returns a cleanup function.

```ts
import '@trf/esr-workspace';
import type {
  RecordChange,
  TokenProvider,
  WorkspaceError,
} from '@trf/esr-workspace';

export function mountEsr(
  container: HTMLElement,
  getAccessToken: TokenProvider,
  onRecordChange: (change: RecordChange) => void,
  onWorkspaceError: (error: WorkspaceError) => void,
): () => void {
  const workspace = document.createElement('esr-workspace');
  const listeners = new AbortController();

  workspace.addEventListener('record-change', (event: Event) => {
    const [change] = (event as CustomEvent<[RecordChange]>).detail;
    onRecordChange(change);
  }, { signal: listeners.signal });

  workspace.addEventListener('workspace-error', (event: Event) => {
    const [error] = (event as CustomEvent<[WorkspaceError]>).detail;
    onWorkspaceError(error);
  }, { signal: listeners.signal });

  workspace.apiBase = '/api';
  workspace.tokenProvider = getAccessToken;
  container.append(workspace);

  return () => {
    listeners.abort();
    workspace.remove();
  };
}
```

The package exports payload types, but does not supply typed `addEventListener` overloads for these custom events; the example casts each event explicitly. Vue hosts must configure their template compiler to recognize `esr-workspace` as a custom element. Framework hosts should assign the function through a DOM reference. Mount and remove the element within the framework's browser lifecycle; do not import its browser entry during server rendering.

## Component events

Attach listeners directly to the element. Both events are non-bubbling, non-composed, and non-cancelable in the current implementation. Calling `preventDefault()` cannot stop an API operation.

Vue custom-element events wrap emitted arguments in an array. The payload is `event.detail[0]`, not `event.detail` itself.

### record-change

```ts
type RecordChange = {
  id: string;
  action: string;
  status?: WorkflowStatus;
};
// CustomEvent<[RecordChange]>
```

| Field | Meaning |
| --- | --- |
| `id` | API record identifier; not the human-readable serial number. |
| `action` | `create`, `draft`, `assign`, `reject`, `resubmit`, `delete`, `resolve`, `approve`, `return`, `complete`, `close`, `revise`, `comment`, or `attach`. The exported type is `string`. |
| `status` | Resulting workflow status, when the API returns a record. Undefined for deletion. |

Statuses are `Unassigned`, `In Process`, `Awaiting Approval`, `ESR Issued`, `ESR Issued – Deferred`, and `ESR Closed`.

For existing-record mutations, the event fires after the mutation response succeeds and before the component reloads bootstrap data. Creation fires after both the create response and bootstrap reload succeed. Consequently:

- A mutation can emit `record-change` followed by `workspace-error` if its subsequent refresh fails. The mutation may already be saved.
- A create operation can succeed on the server without emitting `record-change` if its subsequent refresh fails.
- The host must treat the event as a local notification, not a durable audit record or guaranteed delivery mechanism.

A host may invalidate its own record cache or refresh a related summary when this event arrives. Do not submit the same mutation again in response. Events do not contain the full record, version, signature, or attachment. Obtain authoritative data from the API when needed.

Reading, navigation, downloads, and permission-map updates do not emit `record-change`. Changes made by other users or other component instances never emit `record-change`, including changes that arrive over the optional live stream below.

### Live updates and presence

When the API implements the optional `GET /events` and `POST /presence` endpoints ([API contract](api.md#live-updates-optional)), the component subscribes once it has an identity and a `tokenProvider`. Changes committed elsewhere then update the open list and record without a reload, the record header shows who else is viewing it, and the top bar shows who is online. If the endpoints are absent (404, 405, or 501), the component works as before and the status dot stays gray.

- A remote change to the record on screen replaces it only when the user has no unsaved draft edits. With unsaved edits the draft is kept, a notice says the record changed, and the next save carries the version the edit started from, so the API answers 409 instead of overwriting the other change.
- The stream reconnects when `tokenProvider`, `apiBase`, or the identity changes, and closes when the element is removed.
- The exported types `LiveViewer`, `LiveRecordChange`, and `LiveStatus` describe the payloads.
- A same-origin proxy must not buffer `text/event-stream` responses. The API sends `X-Accel-Buffering: no` for nginx.

### workspace-error

```ts
type WorkspaceError = { message: string };
// CustomEvent<[WorkspaceError]>
```

Emitted when a guarded workspace operation fails, including token-provider rejection, network failure, or a non-success API response. The component also displays the error. The event is not a catch-all for every browser or rendering exception.

The payload has no HTTP status, error code, record ID, retry flag, or correlation ID. Hosts must not parse message text to make authentication or retry decisions. Avoid duplicate error notifications if the component's existing message is sufficient, and do not log credentials or sensitive response text.

## Authentication and session lifecycle

The host owns sign-in, credential storage, renewal, and sign-out. A stable provider can return a fresh token on every call without being reassigned. Refresh before returning the token; the component has no automatic 401 refresh or request retry. If the provider rejects, no fetch is made for that request and the error is handled by the workspace operation.

Assigning a different provider function triggers a bootstrap reload. If an operation is already busy, the reload waits for it to settle. This does not cancel the in-flight operation, immediately clear old data, or guarantee that every request in a multi-request operation uses the same identity. A failed bootstrap is not automatically retried with that same provider; the user can use Refresh, or the host can remount.

For an account or facility switch, the host should finish or abandon the current editing session, remove the old element, and mount a new element with the new identity. On sign-out, remove the element immediately. Setting `tokenProvider = null` alone does not clear previously loaded records. The component has no public dirty-state or unsaved-change event, so the host must choose its own navigation-confirmation policy.

Removal releases the mounted UI and preview resources, but does not abort an already dispatched HTTP request or undo a server mutation. Detach host listeners during cleanup as shown above. Do not treat removing the element as cancellation of an operation.

The demo host uses `/api/demo/users` and `/api/demo/session` to obtain synthetic JWTs. Those endpoints are demonstration infrastructure, not the production authentication protocol. The current .NET demo validates its own tokens; accepting a host's production identity requires configuring the backend's JWT/OIDC validation and actor mapping.

## HTTP boundary and deployment

The component uses `fetch` directly against `apiBase` and follows the [API contract](api.md). Calls use GET when there is no body and POST with JSON otherwise. Authenticated file and PDF downloads return blobs. The API adapter has no configurable headers, fetch override, timeout, automatic retry, or cancellation input.

Prefer a same-origin `/api` reverse proxy in the host deployment. A separate API origin must allow the host origin and the required methods and headers through CORS, including `Authorization` and `Content-Type`. The component does not set `credentials: 'include'`; cross-origin cookie sessions are not its authentication contract. The host's content security policy must allow the API connection and the component's required style and blob preview behavior.

Record mutations include the record's current `version`. A 409 conflict is shown as an error; the host must not automatically replay a failed write. Refresh and review the current record before resubmitting. Error responses use `{ "error": "Human readable reason" }`; when that is unavailable, the adapter uses `Request failed (<status>).` Network and provider exceptions can have different messages.

## Appearance and layout

The host supplies the mounting container and surrounding application layout, including any application sidebar, branding, and user profile. ESR has no left navigation pane: its header contains All requests, My work, and administrator-only Permissions tabs, plus workspace status and refresh. At narrow component widths, the tabs scroll horizontally and status/refresh move below them. Historical ESRs and Template library navigation are hidden; resolution-editor template insertion and historical search remain available. The component supplies its navigation, dialogs, and responsive workspace. Host CSS selectors do not reach its shadow-root content; internal selectors and Vue refs are not a supported integration surface.

The current theme defines these CSS custom properties:

| Property | Default |
| --- | --- |
| `--esr-accent` | `#1f5fd6` |
| `--esr-accent-hover` | `#174bb0` |
| `--esr-accent-soft` | `#eaf1fd` |
| `--esr-accent-text` | `#163f8f` |
| `--esr-bg` | `#f4f6f8` |
| `--esr-font` | `"ESR JetBrains Mono", "JetBrains Mono", ui-monospace, …, monospace` |

The component bundles JetBrains Mono (SIL Open Font License 1.1, Latin subset, variable weight, upright and italic). Browsers ignore `@font-face` rules inside a shadow root, so registering the element also adds the family `ESR JetBrains Mono` to `document.fonts`, once per document. The family name is specific to the component and does not replace host fonts. A host that sets `--esr-font` to another stack still loads the bundled faces but does not use them.

Override them on the element, for example `esr-workspace { --esr-accent: #1d4ed8; }`. They affect selected surfaces and controls, not every color in the theme. There are no public slots or CSS parts. Component state is independent per instance; instances do not synchronize automatically.

## Future extensions requiring implementation

The following are potential additions, not supported interfaces in version 0.1.0:

| Addition | Purpose |
| --- | --- |
| Ready and loading events | Let the host coordinate loading indicators and initialization failures. |
| Structured error codes and auth-required events | Support reliable host recovery without parsing messages. |
| Refresh and open-record methods | Support host-controlled navigation and external data invalidation. |
| Dirty-state and navigation guards | Coordinate unsaved edits with host routing or account switching. |
| Explicit session reset and request cancellation | Clear identity-bound data and manage in-flight work during sign-out. |

Do not call internal Vue methods or synthesize button clicks to emulate these interfaces. Any additions should define payloads, ordering, cancellation behavior, compatibility, and browser integration tests before being adopted by a host.

## Integration acceptance checklist

- Register the element once and attach listeners before supplying credentials.
- Verify successful bootstrap with the host's real API and identity mapping.
- Verify a renewed token is used on the next request.
- Verify record events use array-wrapped payloads and refresh host-owned summaries without duplicate writes.
- Verify errors remain visible when the API or token provider fails.
- Verify sign-out removes loaded records from the page and detaches listeners.
- Verify identity changes do not reuse an old element's data or unsaved edits.
- Verify deployed API routing, authorization, CORS where applicable, and file downloads.
- If the API offers live updates, verify a change in one window reaches another through the deployed proxy, and that the status dot is green.
- Verify the workspace fits the host's desktop and mobile layouts.

Implementation references: [public types](../src/types.ts), [registration](../src/index.ts), [workspace controller](../src/composables/useWorkspace.ts), [HTTP adapter](../src/api.ts), and [demo host](../host/main.ts).
