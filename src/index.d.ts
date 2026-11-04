export interface EsrWorkspaceElement extends HTMLElement {
  apiBase: string;
  tokenProvider: () => string | Promise<string>;
}
export declare const EsrWorkspace: { new(): EsrWorkspaceElement };
export declare function registerEsrWorkspace(tagName?: string): void;
declare global { interface HTMLElementTagNameMap { 'esr-workspace': EsrWorkspaceElement; } }
