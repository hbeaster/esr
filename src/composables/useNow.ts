import { onBeforeUnmount, ref } from "vue";
import type { Ref } from "vue";

/** Current time that ticks while the component is mounted, so ages stay fresh. */
export function useNow(intervalMs = 60_000): Ref<number> {
  const now = ref(Date.now());
  const timer = setInterval(() => (now.value = Date.now()), intervalMs);
  onBeforeUnmount(() => clearInterval(timer));
  return now;
}
