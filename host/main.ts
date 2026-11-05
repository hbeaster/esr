import "../src/index";
import { createDemoSignIn } from "./demoSession";
import type { Actor } from "../src/types";

const API_BASE = "/api";
const DEFAULT_USER = "engineer";

const component = document.querySelector("esr-workspace");
const selector = document.querySelector<HTMLSelectElement>("#identity");
const controls = document.querySelector(".demo-controls");
const status = document.querySelector(".demo-status");
if (!component || !selector || !controls || !status)
  throw new Error("The demo host markup is missing.");
const identitySelector = selector;

let workspace = component;
let activeBase = API_BASE;
let errorMessage: HTMLParagraphElement | null = null;

const signIn = createDemoSignIn((token, apiBase) => {
  if (apiBase === activeBase) {
    workspace.tokenProvider = () => token;
    return;
  }
  // The host contract requires a new element per backend so no old records stay visible.
  const next = document.createElement("esr-workspace");
  next.apiBase = apiBase;
  next.tokenProvider = () => token;
  workspace.replaceWith(next);
  workspace = next;
  activeBase = apiBase;
});

function renderUsers(users: Actor[], selected: string): void {
  identitySelector.replaceChildren(
    ...users.map((user) => {
      const option = document.createElement("option");
      option.value = user.id;
      option.textContent = `${user.name} · ${user.role} · ${user.site}`;
      return option;
    }),
  );
  identitySelector.value = selected;
}

/** Commits the UI to a data source only after its users and session both load. */
async function connect(apiBase: string): Promise<void> {
  identitySelector.disabled = true;
  try {
    const response = await fetch(`${apiBase}/demo/users`);
    if (!response.ok)
      throw Error(
        apiBase === API_BASE
          ? "Start the ASP.NET API on port 5080."
          : "The simulated data source did not respond. Restart the dev server.",
      );
    const users: Actor[] = await response.json();
    if (!users.length) throw Error("No demo users are available.");
    const current = identitySelector.value || DEFAULT_USER;
    const selected = users.some((user) => user.id === current)
      ? current
      : users[0].id;
    await signIn(selected, apiBase);
    renderUsers(users, selected);
    clearError();
  } finally {
    identitySelector.disabled = false;
  }
}

identitySelector.addEventListener("change", () => {
  signIn(identitySelector.value, activeBase).then(clearError, showError);
});

if (import.meta.env.DEV) {
  const { mountSimulatedDataToggle } = await import("./simulated/toggle");
  await mountSimulatedDataToggle({
    controls,
    status,
    apiBase: API_BASE,
    connect,
    onError: showError,
  });
} else {
  await connect(API_BASE).catch(showError);
}

function showError(error: unknown): void {
  errorMessage ??= document.createElement("p");
  errorMessage.textContent = `Unable to connect to demo API. ${error instanceof Error ? error.message : String(error)}`;
  document.body.prepend(errorMessage);
}
function clearError(): void {
  errorMessage?.remove();
}
