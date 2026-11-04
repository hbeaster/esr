import { inject } from "vue";
import type { InjectionKey } from "vue";
import type { useWorkspace } from "./useWorkspace";
export type WorkspaceContext = ReturnType<typeof useWorkspace>;
export const workspaceKey: InjectionKey<WorkspaceContext> =
  Symbol("esr-workspace");
/** Typed instance-local context prevents prop chains through every record section. */
export function useWorkspaceContext(): WorkspaceContext {
  const context = inject(workspaceKey);
  if (!context)
    throw new Error(
      "Workspace components must be rendered inside EsrWorkspace.",
    );
  return context;
}
