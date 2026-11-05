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
import RecordOverview from "../../src/components/RecordOverview.vue";
import RequestForm from "../../src/components/RequestForm.vue";
import RequestWorkspace from "../../src/components/RequestWorkspace.vue";
import RecordDetail from "../../src/components/RecordDetail.vue";
import WatchFloor from "../../src/components/WatchFloor.vue";
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
    expect(wrapper.find("[role=textbox]").exists()).toBe(false);
    expect(wrapper.text()).toContain("Inspect the coupling.");
    expect(wrapper.text()).not.toContain("Save draft");
  });
  it("inserts approved template text without losing existing draft text", async () => {
    const { wrapper, context } = mountSection(TemplatePicker);
    await wrapper.find("button").trigger("click");
    expect(context.draft.resolution).toBe(
      "Inspect the coupling.<br><br>Use the approved inspection steps.",
    );
    expect(context.draft.rationale).toContain("Document applicable criteria.");
    expect(context.current.value?.resolution).toBe("Inspect the coupling.");
  });
});

describe("assistant chat", () => {
  it("sends the transcript for the open record and inserts a reply into the draft", async () => {
    const { wrapper, context } = mountSection(AssistantChat);
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        reply: "Check **coupling** alignment.",
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
    expect(wrapper.get(".chat-message.assistant strong").text()).toBe(
      "coupling",
    );
    expect(wrapper.text()).toContain("Model: gpt-test");
    const add = wrapper
      .findAll("button")
      .find((b) => b.text() === "Add to rationale");
    await add!.trigger("click");
    expect(context.draft.rationale).toContain(
      "Check <strong>coupling</strong> alignment.",
    );
    expect(context.draft.rationale).not.toContain("**");
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
    first.context.form.condition = "Independent request";
    expect(second.context.form.condition).toBe("");
    expect(second.context.dialog.value).toBeNull();
    const data = makeBootstrap();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(data.records[0]))
      .mockResolvedValueOnce(jsonResponse(data));
    vi.stubGlobal("fetch", fetch);
    await first.context.createRequest();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      jcn: "N/A",
      condition: "Independent request",
    });
    expect(body.title).toBeUndefined();
  });
  it("uploads supporting files chosen before the request is submitted", async () => {
    class FakeReader {
      result = "data:text/plain;base64,U3ludGhldGlj";
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", FakeReader);
    const created = makeRecord({ id: "created-1", version: 2 });
    const attached = makeRecord({ id: "created-1", version: 3 });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(created))
      .mockResolvedValueOnce(jsonResponse(attached))
      .mockResolvedValueOnce(jsonResponse(makeBootstrap()));
    vi.stubGlobal("fetch", fetch);
    const { wrapper, context, emit } = mountSection(RequestForm);
    context.newRequest();
    context.form.noJcn = true;
    context.form.references = "DEMO-42";
    context.form.condition = "Wear";
    const input = document.createElement("input");
    const file = new File(["Synthetic"], "inspection.txt", {
      type: "text/plain",
    });
    Object.defineProperty(input, "files", { value: [file] });
    const event = new Event("change");
    Object.defineProperty(event, "target", { value: input });
    await context.queueFiles(event);
    expect(context.pendingFiles.value[0]?.section).toBe("Condition");
    await context.createRequest();
    const createdBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(createdBody.base64).toBeUndefined();
    expect(fetch.mock.calls[1][0]).toBe("/api/records/created-1/attach");
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      name: "inspection.txt",
      type: "text/plain",
      section: "Condition",
      base64: "U3ludGhldGlj",
      version: 2,
    });
    expect(context.notice.value).toBe(
      "Request submitted with supporting files.",
    );
    expect(emit).toHaveBeenCalledWith("record-change", {
      id: "created-1",
      action: "attach",
      status: "In Process",
    });
    expect(
      wrapper.find('[aria-label="Upload supporting files"]').exists(),
    ).toBe(true);
  });
  it("offers a browser upload on the open record", () => {
    const { wrapper } = mountSection(RecordOverview);
    expect(wrapper.find('[aria-label="Upload supporting file"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("Supporting files");
  });
  it("stores formatted request text and drops scripts", async () => {
    const { wrapper, context } = mountSection(RequestForm);
    const boxes = wrapper.findAll("[role=textbox]");
    expect(boxes).toHaveLength(2);
    expect(wrapper.find('[aria-label="Bold"]').exists()).toBe(true);
    boxes[1].element.innerHTML =
      "<strong>Wear</strong><script>alert(1)</script>";
    await boxes[1].trigger("input");
    expect(context.form.condition).toBe("<strong>Wear</strong>");
    expect(context.form.condition).not.toContain("script");
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
    const bootstraps: (() => Promise<Response>)[] = [
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      () => Promise.resolve(jsonResponse(makeBootstrap({ user: requestor }))),
    ];
    // Route by URL: the optional live stream answers 404, like a host without it.
    const fetch = vi.fn((url: string) =>
      url.endsWith("/events")
        ? Promise.resolve(new Response("", { status: 404 }))
        : bootstraps.shift()!(),
    );
    vi.stubGlobal("fetch", fetch);
    const wrapper = mount(Workspace, {
      props: { tokenProvider: () => "engineer-token" },
    });
    wrappers.push(wrapper);
    await wrapper.setProps({ tokenProvider: () => "requestor-token" });
    resolveFirst(jsonResponse(makeBootstrap()));
    await flushPromises();
    // Two bootstraps; the optional live stream may add its own call.
    expect(
      fetch.mock.calls.filter(([url]) => String(url).endsWith("/bootstrap")),
    ).toHaveLength(2);
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("New request"))!
      .trigger("click");
    await flushPromises();
    expect(
      (
        wrapper
          .findAll("label")
          .find((label) => label.text() === "Name")!
          .get("input").element as HTMLInputElement
      ).value,
    ).toBe("Alex Morgan");
    const bootstrapCalls = fetch.mock.calls.filter(([url]) =>
      String(url).endsWith("/bootstrap"),
    ) as unknown as [string, RequestInit][];
    expect(
      (bootstrapCalls[1][1].headers as Record<string, string>).Authorization,
    ).toBe("Bearer requestor-token");
  });
  it("loads the root workspace through the embedding host token provider", async () => {
    const fetch = bootstrapFetch(makeBootstrap());
    const wrapper = mount(Workspace, {
      props: { tokenProvider: () => "host-token" },
    });
    wrappers.push(wrapper);
    await flushPromises();
    expect(wrapper.find("h1").text()).toBe("Service requests");
    expect(fetch).toHaveBeenCalledWith(
      "/api/bootstrap",
      expect.objectContaining({
        headers: { Authorization: "Bearer host-token" },
      }),
    );
  });
});
describe("ESR table columns", () => {
  it("shows the requested columns and hides one without removing the row", async () => {
    const { wrapper } = mountSection(
      RequestWorkspace,
      makeBootstrap({
        records: [
          makeRecord({
            serial: "260037A",
            jcn: "21036WX010184",
            refit: "A014",
            name: "Alex Morgan",
            shop: "31",
            swbs: "6286FCA00000",
            createdAt: "2026-11-04T15:00:00Z",
          }),
        ],
      }),
    );
    const headers = () =>
      wrapper.findAll("thead th").map((header) => header.text());
    expect(headers()).toEqual([
      "Serial",
      "JCN",
      "Refit",
      "Requester",
      "Shop Code",
      "Condition",
      "Resolution",
      "SWBS",
      "Status",
      "Time in Status",
      "Assigned Engineer",
      "Date Initiated",
      "Open",
    ]);
    expect(wrapper.text()).toContain("6286FCA00000");
    expect(wrapper.text()).toContain("Alex Morgan");
    await wrapper.get('[aria-label="Show SWBS"]').setValue(false);
    expect(headers()).not.toContain("SWBS");
    expect(wrapper.text()).not.toContain("6286FCA00000");
    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    await wrapper.get('[aria-label="Show SWBS"]').setValue(true);
    expect(headers()).toContain("SWBS");
  });
  it("sorts the visible rows from a column header", async () => {
    const { wrapper } = mountSection(
      RequestWorkspace,
      makeBootstrap({
        records: [
          makeRecord({ id: "later", serial: "260040A", name: "Casey Rivera" }),
          makeRecord({ id: "earlier", serial: "260037A", name: "Alex Morgan" }),
        ],
      }),
    );
    const serials = () =>
      wrapper.findAll("tbody .serial").map((cell) => cell.text());
    expect(serials()[0]).toContain("260040A");
    await wrapper.get('[aria-label="Sort by Serial"]').trigger("click");
    expect(wrapper.get("th").attributes("aria-sort")).toBe("ascending");
    expect(serials()[0]).toContain("260037A");
    await wrapper.get('[aria-label="Sort by Serial"]').trigger("click");
    expect(wrapper.get("th").attributes("aria-sort")).toBe("descending");
    expect(serials()[0]).toContain("260040A");
  });
});

describe("hull zone filter", () => {
  const located = () =>
    makeBootstrap({
      records: [
        makeRecord({ id: "aux-1", location: "Auxiliary machinery space" }),
        makeRecord({
          id: "aux-2",
          location: "Auxiliary machinery space",
          status: "ESR Closed",
        }),
        makeRecord({ id: "fwd", location: "Forward equipment space" }),
        makeRecord({ id: "none" }),
      ],
    });
  it("counts zones under every filter except the zone itself", () => {
    const { context } = mountSection(RequestWorkspace, located());
    expect(context.zoneCounts.value).toMatchObject({
      auxiliary: 2,
      forward: 1,
      aft: 0,
      unlocated: 1,
    });
    context.zone.value = "auxiliary";
    expect(context.filtered.value.map((r) => r.id)).toEqual(["aux-1", "aux-2"]);
    expect(context.zoneCounts.value.forward).toBe(1);
    context.status.value = "ESR Closed";
    expect(context.zoneCounts.value).toMatchObject({
      auxiliary: 1,
      forward: 0,
    });
    context.navigate("workspace");
    expect(context.zone.value).toBe("");
  });
  it("filters the table from a zone chip and clears it", async () => {
    const { wrapper, context } = mountSection(RequestWorkspace, located());
    await wrapper
      .get('[aria-label="Filter by hull zone"] button')
      .trigger("click");
    expect(context.zone.value).toBe("forward");
    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    await wrapper
      .get('[aria-label="Remove zone filter Forward"]')
      .trigger("click");
    expect(wrapper.findAll("tbody tr")).toHaveLength(4);
    context.zone.value = "auxiliary";
    await wrapper.vm.$nextTick();
    const clear = wrapper
      .findAll("button")
      .find((b) => b.text() === "Clear filters")!;
    await clear.trigger("click");
    expect(context.zone.value).toBe("");
  });
});

describe("status aging in the table", () => {
  afterEach(() => vi.useRealTimers());
  it("marks a stale record and describes it", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
    const { wrapper } = mountSection(
      RequestWorkspace,
      makeBootstrap({
        records: [
          makeRecord({
            status: "Unassigned",
            serial: null,
            engineerId: null,
            createdAt: "2026-11-10T12:00:00Z",
          }),
        ],
      }),
    );
    const chip = wrapper.get(".age");
    expect(chip.classes()).toContain("stale");
    expect(chip.text()).toContain("10d");
    expect(chip.attributes("title")).toBe(
      "Unassigned for 10 days, past the 7-day stale limit",
    );
    expect(wrapper.get(".stat-foot.stale").text()).toBe("1 stale");
  });
});

describe("milestone ceremony", () => {
  it("stamps a record issued on screen, not one opened already issued", async () => {
    const { wrapper, context } = mountSection(
      RecordDetail,
      makeBootstrap({
        records: [makeRecord({ status: "Awaiting Approval" })],
      }),
    );
    await flushPromises();
    expect(wrapper.find(".record-stamp").exists()).toBe(false);
    context.state.records[0] = {
      ...context.state.records[0],
      status: "ESR Issued",
    };
    await flushPromises();
    expect(wrapper.get(".record-stamp").text()).toContain("ESR Issued");
    expect(wrapper.get("[aria-live]").text()).toContain("ESR Issued: 260043A");
  });
});

describe("fleet replay", () => {
  it("rewinds the stat counts and returns to live", async () => {
    const { wrapper, context } = mountSection(
      RequestWorkspace,
      makeBootstrap({
        records: [
          makeRecord({
            id: "early",
            status: "In Process",
            createdAt: "2026-10-01T00:00:00Z",
          }),
          makeRecord({
            id: "late",
            status: "In Process",
            createdAt: "2026-10-20T00:00:00Z",
          }),
        ],
      }),
    );
    expect(context.counts.value["In Process"]).toBe(2);
    context.replayAt.value = Date.parse("2026-10-10T00:00:00Z");
    await flushPromises();
    // Neither has an assignment on record, so as of Oct 10 only one exists, unassigned.
    expect(context.fleet.value.map((r) => r.id)).toEqual(["early"]);
    expect(context.counts.value).toMatchObject({
      Unassigned: 1,
      "In Process": 0,
    });
    expect(wrapper.find('[aria-label="Replay date"]').exists()).toBe(true);
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Back to live")!
      .trigger("click");
    expect(context.replayAt.value).toBeNull();
  });
});

describe("compartment dive", () => {
  const reduceMotion = () =>
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
  const located = () =>
    makeBootstrap({
      records: [
        makeRecord({
          id: "aux-1",
          serial: "260061A",
          location: "Auxiliary machinery space",
          component: "ASW-P-02 / TSN-10482",
        }),
        makeRecord({
          id: "aux-2",
          serial: "260062A",
          location: "Auxiliary machinery space",
        }),
        makeRecord({ id: "fwd", location: "Forward equipment space" }),
      ],
    });
  const band = (wrapper: VueWrapper, index: number) =>
    wrapper.findAll(".heat")[index];
  it("dives into a compartment, opens a contact, and surfaces", async () => {
    reduceMotion();
    const { wrapper, context } = mountSection(RequestWorkspace, located());
    await band(wrapper, 3).trigger("click");
    expect(context.zone.value).toBe("auxiliary");
    const contacts = wrapper.findAll(".contact");
    expect(contacts.map((c) => c.attributes("aria-label"))).toEqual([
      "Contact 260061A: Pump, In Process",
      "Contact 260062A: Pump, In Process",
    ]);
    expect(wrapper.text()).toContain("2 contacts");
    await wrapper.get(".hull-heatmap").trigger("keydown", { key: "Escape" });
    expect(context.zone.value).toBe("");
    expect(wrapper.findAll(".contact")).toHaveLength(0);
    await band(wrapper, 3).trigger("click");
    await wrapper.findAll(".contact")[1].trigger("keydown", { key: "Enter" });
    expect(context.view.value).toBe("record");
    expect(context.selectedId.value).toBe("aux-2");
  });
  it("surfaces when the zone filter is cleared elsewhere", async () => {
    reduceMotion();
    const { wrapper } = mountSection(RequestWorkspace, located());
    await band(wrapper, 0).trigger("click");
    expect(wrapper.findAll(".contact")).toHaveLength(1);
    const clear = wrapper
      .findAll("button")
      .find((b) => b.text() === "Clear filters")!;
    await clear.trigger("click");
    expect(wrapper.findAll(".contact")).toHaveLength(0);
    expect(wrapper.find(".surface").exists()).toBe(false);
  });
});

describe("capped compartment dive", () => {
  const crowded = (n: number) =>
    makeBootstrap({
      records: Array.from({ length: n }, (_, i) =>
        makeRecord({
          id: `aux-${i}`,
          serial: `26${String(1000 + i).padStart(4, "0")}A`,
          location: "Auxiliary machinery space",
          component: "ASW-P-02 / TSN-10482",
          status: "Unassigned",
          // Older records first, so the oldest are the most critical.
          createdAt: new Date(Date.UTC(2026, 8, 1 + (i % 28))).toISOString(),
        }),
      ),
    });
  it("shows the most critical contacts and folds the rest into one marker", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    const { wrapper } = mountSection(RequestWorkspace, crowded(30));
    await wrapper.findAll(".heat")[3].trigger("click");
    expect(wrapper.findAll(".contact:not(.overflow)")).toHaveLength(24);
    const overflow = wrapper.get(".contact.overflow");
    expect(overflow.text()).toBe("+6");
    expect(overflow.attributes("aria-label")).toBe(
      "Show all 30 Auxiliary records in the table",
    );
    expect(wrapper.text()).toContain("24 most critical of 30");
    expect(wrapper.text()).toContain("6 more in the table");
    const scroll = vi.fn();
    (wrapper.get(".workspace-card").element as HTMLElement).scrollIntoView =
      scroll;
    await overflow.trigger("click");
    expect(scroll).toHaveBeenCalled();
  });
  it("describes a contact on hover and focus without opening it", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    const { wrapper, context } = mountSection(RequestWorkspace, crowded(2));
    await wrapper.findAll(".heat")[3].trigger("click");
    const before = context.selectedId.value;
    const contact = wrapper.findAll(".contact")[0];
    await contact.trigger("mouseenter");
    const tip = wrapper.get(".contact-tip");
    expect(tip.text()).toContain("Pump");
    expect(tip.text()).toContain("Unassigned");
    expect(tip.text()).toContain("Click to open");
    expect(context.selectedId.value).toBe(before);
    await contact.trigger("mouseleave");
    expect(wrapper.find(".contact-tip").exists()).toBe(false);
    await contact.trigger("focus");
    expect(wrapper.find(".contact-tip").exists()).toBe(true);
  });
});

describe("watch floor", () => {
  it("opens from the list page", async () => {
    const { wrapper, context } = mountSection(RequestWorkspace);
    const open = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Watch floor"))!;
    await open.trigger("click");
    expect(context.watchFloor.value).toBe(true);
  });
  it("spotlights the most critical ESR and exits on Escape", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
    const { wrapper, context } = mountSection(
      WatchFloor,
      makeBootstrap({
        records: [
          makeRecord({
            id: "fresh",
            serial: "260071A",
            status: "Unassigned",
            createdAt: "2026-11-19T12:00:00Z",
          }),
          makeRecord({
            id: "old",
            serial: "260072A",
            status: "Unassigned",
            attributes: ["SUBSAFE"],
            createdAt: "2026-10-01T12:00:00Z",
          }),
        ],
      }),
    );
    context.watchFloor.value = true;
    await flushPromises();
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes("aria-label")).toBe("ESR watch floor");
    const card = wrapper.get(".wf-card");
    expect(card.text()).toContain("260072A");
    expect(card.text()).toContain("SUBSAFE");
    expect(card.text()).toContain("Stale");
    expect(wrapper.get(".wf-spotlight header").text()).toContain("1 of 2");
    expect(wrapper.findAll(".wf-stat")).toHaveLength(5);
    await dialog.trigger("keydown", { key: "Escape" });
    expect(context.watchFloor.value).toBe(false);
    vi.useRealTimers();
  });
});
