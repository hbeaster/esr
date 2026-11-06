import type { TokenProvider } from "./types";

/** Tokens are requested on every call; credentials remain owned by the embedding host. */
export function createApi(base: string, tokenProvider?: TokenProvider | null) {
  async function request<T>(
    path: string,
    data?: unknown,
    binary?: false,
  ): Promise<T>;
  async function request(
    path: string,
    data: unknown,
    binary: true,
  ): Promise<Blob>;
  async function request<T>(
    path: string,
    data?: unknown,
    binary = false,
  ): Promise<T | Blob> {
    const token = await tokenProvider?.();
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const message =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : `Request failed (${response.status}).`;
      throw new Error(message);
    }
    return binary ? response.blob() : (response.json() as Promise<T>);
  }
  return request;
}

/** The host's API does not offer the optional live stream (or answered with something else). */
export class LiveUnavailable extends Error {}

/**
 * Reads a server-sent event stream with `fetch`, so it carries the same
 * bearer token as every other call (EventSource cannot set headers, and a
 * token in the URL would leak into logs). Resolves when the server closes.
 */
export async function readEventStream(
  base: string,
  tokenProvider: TokenProvider | null | undefined,
  onEvent: (name: string, data: unknown) => void,
  signal: AbortSignal,
): Promise<void> {
  const token = await tokenProvider?.();
  const response = await fetch(`${base.replace(/\/$/, "")}/events`, {
    headers: {
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });
  const type = response.headers.get("Content-Type") ?? "";
  if (
    [404, 405, 501].includes(response.status) ||
    (response.ok && !type.includes("text/event-stream"))
  )
    throw new LiveUnavailable(`Live updates unavailable (${response.status}).`);
  if (!response.ok || !response.body)
    throw new Error(`Live stream failed (${response.status}).`);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  // Stop reading as soon as the caller aborts, whatever the transport does.
  signal.addEventListener("abort", () => void reader.cancel().catch(() => {}), {
    once: true,
  });
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value.replace(/\r\n/g, "\n");
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let name = "message";
      const data: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      // Comment-only frames (": ping") carry no data.
      if (!data.length) continue;
      try {
        onEvent(name, JSON.parse(data.join("\n")));
      } catch {
        // Ignore a malformed frame rather than dropping the connection.
      }
    }
  }
}
