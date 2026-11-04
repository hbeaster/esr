import { defineCustomElement } from "vue";
import Workspace from "./Workspace.ce.vue";
import workspaceStyles from "./styles/workspace.css?inline";
import type { EsrWorkspaceElement } from "./types";
export type * from "./types";
/** Vue and all descendant styles are bundled into the custom element's shadow root. */
export const EsrWorkspace: { new (): EsrWorkspaceElement } =
  defineCustomElement(Workspace, { styles: [workspaceStyles] });
export function registerEsrWorkspace(tagName = "esr-workspace"): void {
  if (!customElements.get(tagName))
    customElements.define(tagName, EsrWorkspace);
}
registerEsrWorkspace();
declare global {
  interface HTMLElementTagNameMap {
    "esr-workspace": EsrWorkspaceElement;
  }
}
