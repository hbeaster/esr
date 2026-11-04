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
