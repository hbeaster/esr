import { onBeforeUnmount, ref, watch } from "vue";
import type { Ref } from "vue";
import { LiveUnavailable, readEventStream } from "../api";
import type {
  LiveRecordChange,
  LiveStatus,
  LiveViewer,
  TokenProvider,
} from "../types";

export interface LivePresence {
  view: LiveViewer["view"];
  recordId: string | null;
}
interface LiveOptions {
  /** Changes reconnect: the identity, token provider, and API base. */
  identity: () => readonly unknown[];
  enabled: () => boolean;
  base: () => string;
  tokenProvider: () => TokenProvider | null | undefined;
  presence: () => LivePresence;
  onChange: (change: LiveRecordChange) => void;
}
const MAX_BACKOFF_MS = 30_000;

/**
 * Optional live updates: subscribes to `GET /events`, reports what this
 * workspace shows with `POST /presence`, and reconnects with backoff. A host
 * API without the stream gets status "unavailable" and no retries.
 */
export function useLive(options: LiveOptions): {
  status: Ref<LiveStatus>;
  viewers: Ref<LiveViewer[]>;
  connectionId: Ref<string | null>;
  lastChange: Ref<LiveRecordChange | null>;
} {
  const status = ref<LiveStatus>("off");
  const viewers = ref<LiveViewer[]>([]);
  const connectionId = ref<string | null>(null);
  const lastChange = ref<LiveRecordChange | null>(null);
  let controller: AbortController | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let backoff = 1000;

  function stop() {
    controller?.abort();
    controller = null;
    clearTimeout(retry);
    connectionId.value = null;
    viewers.value = [];
  }
  async function connect() {
    stop();
    if (!options.enabled()) {
      status.value = "off";
      return;
    }
    const current = new AbortController();
    controller = current;
    status.value = "connecting";
    try {
      await readEventStream(
        options.base(),
        options.tokenProvider(),
        (name, data) => {
          if (controller !== current) return;
          if (name === "hello") {
            connectionId.value = (
              data as { connectionId: string }
            ).connectionId;
            status.value = "live";
            backoff = 1000;
            void sendPresence();
          } else if (name === "presence")
            viewers.value = (data as { viewers: LiveViewer[] }).viewers;
          else if (name === "record-changed") {
            lastChange.value = data as LiveRecordChange;
            options.onChange(lastChange.value);
          }
        },
        current.signal,
      );
    } catch (cause) {
      if (current.signal.aborted || controller !== current) return;
      if (cause instanceof LiveUnavailable) {
        status.value = "unavailable";
        controller = null;
        return;
      }
    }
    if (current.signal.aborted || controller !== current) return;
    // The stream ended or failed: try again, waiting longer each time.
    status.value = "connecting";
    connectionId.value = null;
    viewers.value = [];
    retry = setTimeout(() => void connect(), backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  }

  let presenceTimer: ReturnType<typeof setTimeout> | undefined;
  async function sendPresence() {
    const id = connectionId.value;
    if (!id) return;
    try {
      const token = await options.tokenProvider()?.();
      await fetch(`${options.base().replace(/\/$/, "")}/presence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ connectionId: id, ...options.presence() }),
      });
    } catch {
      // Presence is best effort; the stream itself reports failures.
    }
  }
  watch(options.identity, () => void connect(), { immediate: true });
  watch(
    () => JSON.stringify(options.presence()),
    () => {
      clearTimeout(presenceTimer);
      presenceTimer = setTimeout(() => void sendPresence(), 250);
    },
  );
  onBeforeUnmount(() => {
    stop();
    clearTimeout(presenceTimer);
    status.value = "off";
  });
  return { status, viewers, connectionId, lastChange };
}
