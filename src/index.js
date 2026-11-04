import { defineCustomElement } from 'vue';
import Workspace from './Workspace.ce.vue';
/** Vue runtime and styles are bundled; embedding applications need no Vue dependency. */
export const EsrWorkspace = defineCustomElement(Workspace);
/** Register with a custom tag to avoid collisions in a host application. */
export function registerEsrWorkspace(tagName = 'esr-workspace') {
  if (!customElements.get(tagName)) customElements.define(tagName, EsrWorkspace);
}
registerEsrWorkspace();
