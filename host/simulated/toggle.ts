import { SIMULATED_API_BASE } from "./base";

const STORAGE_KEY = "esr.dev.simulatedData";

function readStoredMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}
function storeMode(simulated: boolean): void {
  try {
    if (simulated) localStorage.setItem(STORAGE_KEY, "on");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; the mode then simply does not survive a reload.
  }
}

interface ToggleOptions {
  /** Top-right group that receives the button. */
  controls: Element;
  /** Status area that receives the badge. */
  status: Element;
  apiBase: string;
  connect: (apiBase: string) => Promise<void>;
  onError: (error: unknown) => void;
}

/** Dev-only control. It connects first, so a failed switch never changes the mode. */
export async function mountSimulatedDataToggle(
  options: ToggleOptions,
): Promise<void> {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "simulated-toggle";

  const badge = document.createElement("span");
  badge.className = "simulated-badge";
  badge.setAttribute("role", "status");
  badge.textContent = "SIMULATED DATA";

  options.controls.prepend(button);
  options.status.append(badge);

  let simulated = readStoredMode();
  const render = () => {
    button.textContent = simulated ? "Use API data" : "Use fake data";
    button.setAttribute("aria-pressed", String(simulated));
    badge.hidden = !simulated;
  };

  async function apply(next: boolean): Promise<void> {
    button.disabled = true;
    try {
      await options.connect(next ? SIMULATED_API_BASE : options.apiBase);
      simulated = next;
      storeMode(next);
      render();
    } catch (error) {
      options.onError(error);
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener("click", () => void apply(!simulated));
  render();
  await apply(simulated);
}
