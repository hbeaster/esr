import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import { LiveUnavailable, readEventStream } from "../../src/api";
import Workspace from "../../src/Workspace.ce.vue";
import type { EsrRecord } from "../../src/types";
import { makeBootstrap, makeRecord } from "../fixtures";

const wrappers: VueWrapper[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.unstubAllGlobals();
});
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
/** An event stream the test pushes frames into. */
function stream() {
  let push: (text: string) => void = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      push = (text) => controller.enqueue(encoder.encode(text));
    },
  });
  const response = new Response(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
  return { response, push: (text: string) => push(text) };
}
const frame = (name: string, data: unknown) =>
  `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

describe("readEventStream", () => {
  it("parses named frames split across chunks and skips pings", async () => {
    const live = stream();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(live.response));
    const events: [string, unknown][] = [];
    const controller = new AbortController();
    const done = readEventStream(
      "/api",
      () => "token",
      (name, data) => events.push([name, data]),
      controller.signal,
    );
    const hello = frame("hello", { connectionId: "c1" });
    live.push(hello.slice(0, 10));
    live.push(hello.slice(10) + ": ping\n\n");
    live.push(frame("presence", { viewers: [] }));
    await flushPromises();
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events).toEqual([
      ["hello", { connectionId: "c1" }],
      ["presence", { viewers: [] }],
    ]);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init!.headers as Record<string, string>).Authorization).toBe(
      "Bearer token",
    );
    controller.abort();
    await done.catch(() => undefined);
  });
  it("reports a host API without the stream as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: "Route not found." })),
    );
    await expect(
      readEventStream("/api", null, () => {}, new AbortController().signal),
    ).rejects.toBeInstanceOf(LiveUnavailable);
  });
});

describe("live workspace", () => {
  const record = makeRecord({ id: "r1", serial: "260081A", version: 3 });
  function mountLive(onFetch?: (url: string, init?: RequestInit) => void) {
    const live = stream();
    let current: EsrRecord = record;
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      onFetch?.(url, init);
      if (url.endsWith("/events")) return Promise.resolve(live.response);
      if (url.endsWith("/bootstrap"))
        return Promise.resolve(json(makeBootstrap({ records: [record] })));
      if (url.endsWith("/records/r1")) return Promise.resolve(json(current));
      return Promise.resolve(json({ ok: true, ...current }));
    });
    vi.stubGlobal("fetch", fetch);
    const wrapper = mount(Workspace, {
      props: { tokenProvider: () => "token" },
    });
    wrappers.push(wrapper);
    return {
      wrapper,
      fetch,
      live,
      serve: (next: EsrRecord) => (current = next),
    };
  }
  const openRecord = async (wrapper: VueWrapper) => {
    await flushPromises();
    await wrapper.get('[aria-label="Open 260081A"]').trigger("click");
    await flushPromises();
  };
  it("shows the live link, reports presence, and applies a pushed change", async () => {
    const presence: unknown[] = [];
    const { wrapper, live, serve } = mountLive((url, init) => {
      if (url.endsWith("/presence"))
        presence.push(JSON.parse(String(init!.body)));
    });
    await openRecord(wrapper);
    live.push(frame("hello", { connectionId: "c1" }));
    await vi.waitFor(() =>
      expect(wrapper.get(".live-dot").classes()).toContain("live"),
    );
    await vi.waitFor(() =>
      expect(presence.at(-1)).toEqual({
        connectionId: "c1",
        view: "record",
        recordId: "r1",
      }),
    );
    live.push(
      frame("presence", {
        viewers: [
          {
            connectionId: "c1",
            userId: "engineer",
            name: "Jordan Lee",
            role: "Engineer",
            site: "Bangor",
            view: "record",
            recordId: "r1",
          },
          {
            connectionId: "c2",
            userId: "supervisor",
            name: "Casey Rivera",
            role: "Supervisor",
            site: "Bangor",
            view: "record",
            recordId: "r1",
          },
        ],
      }),
    );
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain("Casey Rivera is viewing"),
    );
    serve({
      ...record,
      version: 4,
      status: "Awaiting Approval",
      resolution: "Remote text",
    });
    live.push(
      frame("record-changed", {
        id: "r1",
        version: 4,
        status: "Awaiting Approval",
        serial: "260081A",
        action: "resolve",
        actor: "Casey Rivera",
        actorId: "supervisor",
        deleted: false,
        time: "2026-11-05T00:00:00Z",
      }),
    );
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain("Casey Rivera resolved this record."),
    );
    expect(wrapper.get(".detail-meta").text()).toContain("Awaiting Approval");
  });
  it("keeps an unsaved draft on the version it started from", async () => {
    const posts: Record<string, unknown>[] = [];
    const { wrapper, live, serve } = mountLive((url, init) => {
      if (url.endsWith("/records/r1/draft"))
        posts.push(JSON.parse(String(init!.body)));
    });
    await openRecord(wrapper);
    live.push(frame("hello", { connectionId: "c1" }));
    // Edit the draft through the shared workspace state, as the editor does.
    const context = (
      wrapper.vm.$ as unknown as {
        provides: Record<
          symbol,
          { draft: { resolution: string }; saveDraft: () => Promise<void> }
        >;
      }
    ).provides;
    const workspace = Object.getOwnPropertySymbols(context)
      .map((k) => context[k])
      .find((v) => v && "draft" in v)!;
    workspace.draft.resolution = "My unsaved edit";
    serve({ ...record, version: 4, resolution: "Someone else's text" });
    live.push(
      frame("record-changed", {
        id: "r1",
        version: 4,
        status: "In Process",
        serial: "260081A",
        action: "draft",
        actor: "Casey Rivera",
        actorId: "supervisor",
        deleted: false,
        time: "2026-11-05T00:00:00Z",
      }),
    );
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain(
        "Your unsaved draft is based on the earlier version",
      ),
    );
    expect(workspace.draft.resolution).toBe("My unsaved edit");
    await workspace.saveDraft();
    // The save carries the version the edit started from, so the API answers 409.
    expect(posts.at(-1)?.version).toBe(3);
  });
});
