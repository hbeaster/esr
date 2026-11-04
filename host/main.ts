import "../src/index";
import { createDemoSignIn } from "./demoSession";
import type { Actor } from "../src/types";
const component = document.querySelector("esr-workspace");
const selector = document.querySelector<HTMLSelectElement>("#identity");
if (!component || !selector)
  throw new Error("The demo host markup is missing.");
const workspace = component;
const identitySelector = selector;
try {
  const response = await fetch("/api/demo/users");
  if (!response.ok) throw Error("Start the ASP.NET API on port 5080.");
  const users: Actor[] = await response.json();
  for (const user of users) {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = `${user.name} · ${user.role} · ${user.site}`;
    identitySelector.append(option);
  }
  const signIn = createDemoSignIn((token) => {
    workspace.tokenProvider = () => token;
  });
  async function selectUser(): Promise<void> {
    await signIn(identitySelector.value);
  }
  identitySelector.value = "engineer";
  identitySelector.addEventListener("change", () => {
    void selectUser().catch(showError);
  });
  await selectUser();
} catch (error) {
  showError(error);
}
function showError(error: unknown): void {
  const message = document.createElement("p");
  message.textContent = `Unable to connect to demo API. ${error instanceof Error ? error.message : String(error)}`;
  document.body.prepend(message);
}
