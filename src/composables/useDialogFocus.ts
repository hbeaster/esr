import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Ref } from "vue";
import type { Dialog } from "../types";

/** Trap focus inside the active shadow-root dialog and restore it on close. */
export function useDialogFocus(dialog: Ref<Dialog | null>, close: () => void) {
  const modalElement = ref<HTMLElement | null>(null);
  let returnFocus: HTMLElement | null = null;
  watch(dialog, async (value, old) => {
    if (value) {
      if (!old) {
        const active =
          document.activeElement?.shadowRoot?.activeElement ||
          document.activeElement;
        returnFocus = active instanceof HTMLElement ? active : null;
      }
      await nextTick();
      modalElement.value
        ?.querySelector<HTMLElement>(
          "input:not([type=checkbox]), select, textarea, [contenteditable='true'], button",
        )
        ?.focus();
    } else returnFocus?.focus();
  });
  function trapFocus(event: KeyboardEvent) {
    if (event.key !== "Tab" || !modalElement.value) return;
    const items = [
      ...modalElement.value.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [contenteditable='true'], a[href]",
      ),
    ].filter((e) => e.getClientRects().length);
    const root = modalElement.value.getRootNode() as Document | ShadowRoot;
    if (event.shiftKey && root.activeElement === items[0]) {
      event.preventDefault();
      items.at(-1)?.focus();
    } else if (!event.shiftKey && root.activeElement === items.at(-1)) {
      event.preventDefault();
      items[0]?.focus();
    }
  }
  function handleEscape(event: KeyboardEvent) {
    if (event.key === "Escape" && dialog.value) {
      event.preventDefault();
      close();
    }
  }
  onMounted(() => document.addEventListener("keydown", handleEscape));
  onBeforeUnmount(() => document.removeEventListener("keydown", handleEscape));
  return { modalElement, trapFocus };
}
