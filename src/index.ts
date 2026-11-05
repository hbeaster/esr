import { defineCustomElement } from "vue";
import Workspace from "./Workspace.ce.vue";
import workspaceStyles from "./styles/workspace.css?inline";
import monoUpright from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
import monoItalic from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-italic.woff2?url";
import type { EsrWorkspaceElement } from "./types";
export type * from "./types";
/** Vue and all descendant styles are bundled into the custom element's shadow root. */
export const EsrWorkspace: { new (): EsrWorkspaceElement } =
  defineCustomElement(Workspace, { styles: [workspaceStyles] });
/**
 * `@font-face` rules inside a shadow root are ignored, so the bundled
 * JetBrains Mono (SIL OFL 1.1) is registered on the document font set under a
 * component-specific family name that cannot collide with host fonts.
 */
function registerFonts(): void {
  if (
    typeof document === "undefined" ||
    typeof FontFace === "undefined" ||
    !document.fonts
  )
    return;
  if ([...document.fonts].some((f) => f.family === "ESR JetBrains Mono"))
    return;
  for (const [url, style] of [
    [monoUpright, "normal"],
    [monoItalic, "italic"],
  ] as const)
    document.fonts.add(
      new FontFace("ESR JetBrains Mono", `url(${url}) format("woff2")`, {
        style,
        weight: "100 800",
        display: "swap",
      }),
    );
}
export function registerEsrWorkspace(tagName = "esr-workspace"): void {
  registerFonts();
  if (!customElements.get(tagName))
    customElements.define(tagName, EsrWorkspace);
}
registerEsrWorkspace();
declare global {
  interface HTMLElementTagNameMap {
    "esr-workspace": EsrWorkspaceElement;
  }
}
