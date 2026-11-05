import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import { defineComponent, h, provide } from "vue";
import type { Component } from "vue";
import { useWorkspace } from "../../src/composables/useWorkspace";
import { workspaceKey } from "../../src/composables/workspaceContext";
import type { WorkspaceContext } from "../../src/composables/workspaceContext";
import type { Bootstrap } from "../../src/types";
import { makeBootstrap, makeRecord, engineer } from "../fixtures";
import ResolutionEditor from "../../src/components/ResolutionEditor.vue";
import AssistantChat from "../../src/components/AssistantChat.vue";
import TemplatePicker from "../../src/components/TemplatePicker.vue";
import SignatureRecord from "../../src/components/SignatureRecord.vue";
import WorkflowActions from "../../src/components/WorkflowActions.vue";
import WorkflowActionForm from "../../src/components/WorkflowActionForm.vue";
import RevisionHistory from "../../src/components/RevisionHistory.vue";
import RecordFiles from "../../src/components/RecordFiles.vue";
import RequestForm from "../../src/components/RequestForm.vue";
import Workspace from "../../src/Workspace.ce.vue";
import WorkspaceDialogs from "../../src/components/WorkspaceDialogs.vue";

const wrappers: VueWrapper[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function mountSection(component: Component, data = makeBootstrap()) {
  let context: WorkspaceContext;
  const emit = vi.fn();
  const wrapper = mount(
    defineComponent({
      setup() {
        context = useWorkspace({ apiBase: "/api" }, emit);
        Object.assign(context.state, data);
        context.openRecord(data.records[0]);
        provide(workspaceKey, context);
        return () => h(component);
      },
    }),
  );
  wrappers.push(wrapper);
  return { wrapper, context: context!, emit };
}
function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
}
function bootstrapFetch(data: Bootstrap) {
  const fetch = vi.fn().mockResolvedValue(jsonResponse(data));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("resolution components", () => {
  it("reveals DFS then TVD reference prompts in sequence", async () => {
    const { wrapper, context } = mountSection(
      ResolutionEditor,
      makeBootstrap({ records: [makeRecord({ dfs: "", tvd: "" })] }),
    );
    expect(wrapper.findAll("select")).toHaveLength(1);
    await wrapper.find("select").setValue("yes");
    expect(wrapper.text()).toContain("DFS reference / document number");
    expect(wrapper.findAll("select")).toHaveLength(2);
    await wrapper.findAll("select")[1].setValue("yes");
    expect(wrapper.text()).toContain("TVD reference / document number");
    expect(context.draft.dfs).toBe("yes");
    expect(context.draft.tvd).toBe("yes");
  });
  it("keeps issued resolutions read-only", () => {
    const { wrapper } = mountSection(
      ResolutionEditor,
      makeBootstrap({ records: [makeRecord({ status: "ESR Issued" })] }),
    );
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.text()).toContain("Inspect the coupling.");
    expect(wrapper.text()).not.toContain("Save draft");
  });
  it("inserts approved template text without losing existing draft text", async () => {
    const { wrapper, context } = mountSection(TemplatePicker);
    await wrapper.find("button").trigger("click");
    expect(context.draft.resolution).toBe(
      "Inspect the coupling.\n\nUse the approved inspection steps.",
    );
    expect(context.draft.rationale).toContain("Document applicable criteria.");
    expect(context.current.value?.resolution).toBe("Inspect the coupling.");
  });
});

describe("assistant chat", () => {
  it("sends the transcript for the open record and inserts a reply into the draft", async () => {
    const { wrapper, context } = mountSection(AssistantChat);
    const fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          reply: "Check coupling alignment.",
          model: "gpt-test",
          mock: false,
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await wrapper.get("textarea").setValue("What should I inspect?");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/assistant/chat");
    expect(JSON.parse(String(init.body))).toEqual({
      recordId: context.selectedId.value,
      messages: [{ role: "user", content: "What should I inspect?" }],
    });
    expect(wrapper.findAll(".chat-bubble").map((b) => b.text())).toEqual([
      "What should I inspect?",
      "Check coupling alignment.",
    ]);
    expect(wrapper.text()).toContain("Model: gpt-test");
    const add = wrapper
      .findAll("button")
      .find((b) => b.text() === "Add to rationale");
    await add!.trigger("click");
    expect(context.draft.rationale).toContain("Check coupling alignment.");
  });
  it("labels the mock and restores the message when the provider fails", async () => {
    const { wrapper, context, emit } = mountSection(AssistantChat);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: "The chat provider rejected the configured API key.",
            }),
            { status: 502 },
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse({ reply: "Mock reply", model: "mock", mock: true }),
        ),
    );
    await wrapper.get("textarea").setValue("Hello");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(context.chat.messages).toEqual([]);
    expect(context.chat.input).toBe("Hello");
    expect(emit).toHaveBeenCalledWith("workspace-error", {
      message: "The chat provider rejected the configured API key.",
    });
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain(
      "Mock assistant: no API key is configured",
    );
  });
  it("is only offered while the draft is editable", () => {
    const editable = mountSection(ResolutionEditor);
    expect(editable.wrapper.find(".chat").exists()).toBe(true);
    const issued = mountSection(
      ResolutionEditor,
      makeBootstrap({ records: [makeRecord({ status: "ESR Issued" })] }),
    );
    expect(issued.wrapper.find(".chat").exists()).toBe(false);
  });
});

describe("workflow components", () => {
  it("shows the assigned engineer signature action", () => {
    const { wrapper } = mountSection(WorkflowActions);
    expect(wrapper.text()).toContain("Sign & submit for approval");
    expect(wrapper.text()).not.toContain("Approve & issue ESR");
  });
  it("withholds engineering actions from a cross-facility delegated reviewer", () => {
    const { wrapper, context } = mountSection(
      WorkflowActions,
      makeBootstrap({
        user: { ...engineer, id: "remote", site: "Kings Bay" },
        permissions: { remote: { crossSite: "review", dualSign: true } },
      }),
    );
    expect(context.canComment.value).toBe(true);
    expect(context.editable.value).toBe(false);
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
  it("requires an explanation for deferred shop completion", async () => {
    const { wrapper, context } = mountSection(WorkflowActionForm);
    context.action("complete");
    await flushPromises();
    expect(wrapper.get("textarea").attributes("required")).toBeUndefined();
    await wrapper.get("select").setValue("Deferred");
    expect(wrapper.get("textarea").attributes("required")).toBeDefined();
    expect(wrapper.text()).toContain("Jordan Lee");
    expect(context.actionData.status).toBe("Deferred");
  });
  it("opens a frozen historical snapshot without replacing the active draft", async () => {
    const snapshot = makeRecord({
      revision: 0,
      status: "ESR Issued",
      resolution: "Original issued instructions.",
    });
    const { wrapper, context } = mountSection(
      RevisionHistory,
      makeBootstrap({
        records: [
          makeRecord({ revision: 1, serial: "260043A", revisions: [snapshot] }),
        ],
      }),
    );
    await wrapper.findAll("button")[1].trigger("click");
    expect(context.record.value?.resolution).toBe(
      "Original issued instructions.",
    );
    expect(context.current.value?.serial).toBe("260043A");
    expect(context.editable.value).toBe(false);
    expect(context.tab.value).toBe("overview");
  });
  it("renders signer evidence and pending blocks", () => {
    const wrapper = mount(SignatureRecord, {
      props: {
        signatures: [
          {
            id: "sig-1",
            userId: "engineer",
            name: "Jordan Lee",
            block: "Resolved By",
            time: "2026-11-04T12:00:00Z",
            comment: "",
          },
        ],
      },
    });
    wrappers.push(wrapper);
    expect(wrapper.findAll(".signature")).toHaveLength(4);
    expect(wrapper.findAll(".signed")).toHaveLength(1);
    expect(wrapper.text()).toContain("Jordan Lee");
    expect(wrapper.text().match(/Awaiting signature/g)).toHaveLength(3);
  });
});

describe("typed workspace controller", () => {
  it("saves the active version and refreshes from the server", async () => {
    const data = makeBootstrap();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ...data.records[0], version: 2 }))
      .mockResolvedValueOnce(
        jsonResponse({
          ...data,
          records: [makeRecord({ version: 2, resolution: "Updated steps." })],
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const { context, emit } = mountSection(ResolutionEditor, data);
    context.draft.resolution = "Updated steps.";
    await context.saveDraft();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      version: 1,
      resolution: "Updated steps.",
    });
    expect(context.current.value?.version).toBe(2);
    expect(context.busy.value).toBe(false);
    expect(emit).toHaveBeenCalledWith("record-change", {
      id: "record-1",
      action: "draft",
      status: "In Process",
    });
  });
  it("preserves local edits when the API rejects a stale version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "This record changed." }), {
          status: 409,
        }),
      ),
    );
    const { context, emit } = mountSection(ResolutionEditor);
    context.draft.resolution = "Unsaved text";
    await context.saveDraft();
    expect(context.draft.resolution).toBe("Unsaved text");
    expect(context.error.value).toBe("This record changed.");
    expect(emit).toHaveBeenCalledWith("workspace-error", {
      message: "This record changed.",
    });
    expect(context.busy.value).toBe(false);
  });
  it("does not allow duplicate actions while a request is in flight", async () => {
    let complete: () => void = () => {};
    const { context } = mountSection(ResolutionEditor);
    const operation = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const first = context.run(operation);
    await context.run(operation);
    expect(operation).toHaveBeenCalledTimes(1);
    complete();
    await first;
    expect(context.busy.value).toBe(false);
  });
  it("rejects oversized files before reading or uploading them", async () => {
    const fetch = bootstrapFetch(makeBootstrap());
    const { context } = mountSection(RecordFiles);
    const input = document.createElement("input");
    Object.defineProperty(input, "files", {
      value: [{ size: 16 * 1024 * 1024 }],
    });
    const event = new Event("change");
    Object.defineProperty(event, "target", { value: input });
    await context.upload(event);
    expect(context.error.value).toContain("15 MB");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("supports a request without a JCN and keeps instance state isolated", async () => {
    const first = mountSection(RequestForm),
      second = mountSection(RequestForm);
    first.context.newRequest();
    first.context.form.noJcn = true;
    first.context.form.title = "Independent request";
    expect(second.context.form.title).toBe("");
    expect(second.context.dialog.value).toBeNull();
    const data = makeBootstrap();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(data.records[0]))
      .mockResolvedValueOnce(jsonResponse(data));
    vi.stubGlobal("fetch", fetch);
    await first.context.createRequest();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      jcn: "N/A",
      title: "Independent request",
    });
  });
  it("connects the dialog element to the shared keyboard focus trap", async () => {
    const { wrapper, context } = mountSection(WorkspaceDialogs);
    document.body.append(wrapper.element);
    context.newRequest();
    await flushPromises();
    const modal = wrapper.get('[role="dialog"]').element;
    expect(context.modalElement.value).toBe(modal);
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      new DOMRect(),
    ] as unknown as DOMRectList);
    const buttons = wrapper.findAll("button");
    const last = buttons.at(-1)!;
    (last.element as HTMLElement).focus();
    await last.trigger("keydown", { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0].element);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(context.dialog.value).toBeNull();
  });
  it("loads a new identity even when its provider changes during bootstrap", async () => {
    let resolveFirst: (response: Response) => void = () => {};
    const requestor = {
      ...engineer,
      id: "requestor",
      name: "Alex Morgan",
      role: "Requestor" as const,
    };
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(jsonResponse(makeBootstrap({ user: requestor })));
    vi.stubGlobal("fetch", fetch);
    const wrapper = mount(Workspace, {
      props: { tokenProvider: () => "engineer-token" },
    });
    wrappers.push(wrapper);
    await wrapper.setProps({ tokenProvider: () => "requestor-token" });
    resolveFirst(jsonResponse(makeBootstrap()));
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(wrapper.get(".profile").text()).toContain("Alex Morgan");
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer requestor-token",
    );
  });
  it("loads the root workspace through the embedding host token provider", async () => {
    const fetch = bootstrapFetch(makeBootstrap());
    const wrapper = mount(Workspace, {
      props: { tokenProvider: () => "host-token" },
    });
    wrappers.push(wrapper);
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("Service requests.");
    expect(fetch).toHaveBeenCalledWith(
      "/api/bootstrap",
      expect.objectContaining({
        headers: { Authorization: "Bearer host-token" },
      }),
    );
  });
});
