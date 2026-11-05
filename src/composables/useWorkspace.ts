import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { createApi } from "../api";
import { filterRecords, normalizeJcn, steps } from "../presentation";
import { useDialogFocus } from "./useDialogFocus";
import type {
  ActionForm,
  Attachment,
  AttachmentSection,
  Bootstrap,
  Dialog,
  Draft,
  EngineeringTemplate,
  EsrRecord,
  FilePreview,
  HistoricalMatch,
  HistorySearch,
  LdsData,
  Permission,
  RecordTab,
  RequestForm,
  Scope,
  View,
  WorkflowAction,
  WorkspaceEvents,
  WorkspaceProps,
  WorkspaceState,
} from "../types";

const emptyDraft = (): Draft => ({
  resolution: "",
  rationale: "",
  dfs: "",
  dfsReference: "",
  tvd: "",
  tvdReference: "",
  attributes: [],
});
const emptyRequest = (): RequestForm => ({
  title: "",
  jcn: "",
  noJcn: false,
  name: "",
  shop: "",
  phone: "",
  references: "",
  condition: "",
});
const emptyAction = (): ActionForm => ({
  engineerId: "engineer",
  comment: "",
  reason: "",
  condition: "",
  status: "Completed",
  explanation: "",
  shop: "",
  acknowledgeDeferred: false,
});

/** One controller per custom-element instance; no module-global state or credentials. */
export function useWorkspace(
  props: Readonly<WorkspaceProps>,
  emit: WorkspaceEvents,
) {
  const state = reactive<WorkspaceState>({
    user: null,
    users: [],
    records: [],
    templates: [],
    permissions: {},
  });
  const busy = ref(false),
    error = ref(""),
    notice = ref("");
  const view = ref<View>("workspace"),
    scope = ref<Scope>("all"),
    query = ref(""),
    status = ref("");
  const selectedId = ref<string | null>(null),
    tab = ref<RecordTab>("overview"),
    dialog = ref<Dialog | null>(null);
  const actionData = reactive<ActionForm>(emptyAction()),
    draft = reactive<Draft>(emptyDraft()),
    form = reactive<RequestForm>(emptyRequest());
  const searchResult = ref<HistorySearch | null>(null),
    preview = ref<FilePreview | null>(null),
    historySnapshot = ref<EsrRecord | null>(null);
  const comment = ref(""),
    attachmentSection = ref<AttachmentSection>("Continuation"),
    ldsResult = ref<LdsData | null>(null);
  const permissionUser = ref("remote"),
    permissionForm = reactive<Permission>({
      crossSite: "none",
      dualSign: false,
    });
  const current = computed(() =>
    state.records.find((r) => r.id === selectedId.value),
  );
  const record = computed(() => historySnapshot.value || current.value);
  const local = computed(
    () =>
      !!state.user && !!record.value && record.value.site === state.user.site,
  );
  const delegated = computed(
    () => !!state.permissions[state.user?.id || ""]?.dualSign,
  );
  const editable = computed(
    () =>
      !historySnapshot.value &&
      local.value &&
      record.value?.status === "In Process" &&
      (record.value.engineerId === state.user?.id ||
        state.user?.role === "Supervisor"),
  );
  const canAttach = computed(
    () =>
      editable.value ||
      (!historySnapshot.value &&
        local.value &&
        record.value?.status === "Unassigned" &&
        (record.value.requestorId === state.user?.id ||
          state.user?.role === "Supervisor")),
  );
  const canComment = computed(
    () =>
      !historySnapshot.value &&
      (local.value ||
        state.permissions[state.user?.id || ""]?.crossSite === "review"),
  );
  const filtered = computed(() =>
    filterRecords(
      state.records,
      query.value,
      status.value,
      scope.value,
      state.user?.id,
    ),
  );
  const counts = computed(() =>
    Object.fromEntries(
      steps.map((s) => [
        s,
        state.records.filter(
          (r) =>
            r.status === s ||
            (s === "ESR Issued" && r.status.startsWith("ESR Issued")),
        ).length,
      ]),
    ),
  );
  const owner = (id?: string | null) =>
    state.users.find((u) => u.id === id)?.name || "Not assigned";
  const api = () => createApi(props.apiBase || "/api", props.tokenProvider);
  const selectedRecord = () => {
    if (!current.value) throw new Error("Select an engineering record first.");
    return current.value;
  };

  async function run(fn: () => Promise<unknown>) {
    if (busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      await fn();
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "An unexpected error occurred.";
      emit("workspace-error", { message: error.value });
    } finally {
      busy.value = false;
    }
  }

  async function reload() {
    const data = await api()<Bootstrap>("/bootstrap");
    Object.assign(state, data);
    if (view.value === "admin" && data.user.role !== "Administrator")
      navigate("workspace");
    if (selectedId.value && !current.value) {
      selectedId.value = null;
      view.value = "workspace";
    }
    if (current.value) resetDraft();
  }
  // A provider change during an in-flight request must be loaded once that
  // request settles; the action guard must not silently drop identity changes.
  let loadedProvider: WorkspaceProps["tokenProvider"];
  watch(
    [() => props.tokenProvider, busy] as const,
    async ([value, isBusy]) => {
      if (isBusy || !value || value === loadedProvider) return;
      loadedProvider = value;
      await run(async () => {
        historySnapshot.value = null;
        dialog.value = null;
        await reload();
      });
    },
    { immediate: true },
  );

  function resetDraft() {
    const r = current.value;
    if (r)
      Object.assign(draft, {
        resolution: r.resolution,
        rationale: r.rationale,
        dfs: r.dfs,
        dfsReference: r.dfsReference,
        tvd: r.tvd,
        tvdReference: r.tvdReference,
        attributes: [...r.attributes],
      });
  }
  function openRecord(r: EsrRecord) {
    selectedId.value = r.id;
    view.value = "record";
    tab.value = "overview";
    historySnapshot.value = null;
    searchResult.value = null;
    error.value = "";
    notice.value = "";
    resetDraft();
  }
  function navigate(target: View, nextScope: Scope = "all") {
    view.value = target;
    scope.value = nextScope;
    selectedId.value = null;
    status.value = "";
    query.value = "";
    historySnapshot.value = null;
    error.value = "";
    notice.value = "";
  }
  function newRequest() {
    if (!state.user) return;
    Object.assign(form, emptyRequest(), {
      name: state.user.name,
      shop: state.user.shop,
      phone: state.user.phone,
    });
    ldsResult.value = null;
    dialog.value = "create";
    error.value = "";
  }
  async function importLds() {
    await run(async () => {
      ldsResult.value = await api()<LdsData>(
        `/lds?jcn=${encodeURIComponent(normalizeJcn(form.jcn))}`,
      );
    });
  }
  async function createRequest() {
    await run(async () => {
      const r = await api()<EsrRecord>("/records", {
        ...form,
        jcn: form.noJcn ? "N/A" : normalizeJcn(form.jcn),
      });
      await reload();
      dialog.value = null;
      openRecord(r);
      notice.value =
        "Request submitted. Attach supporting files in the Files tab.";
      emit("record-change", { id: r.id, action: "create", status: r.status });
    });
  }
  async function mutate(action: string, data: object = {}) {
    const r = selectedRecord();
    const result = await api()<EsrRecord | { deleted: true }>(
      `/records/${r.id}/${action}`,
      { ...data, version: r.version },
    );
    emit("record-change", {
      id: r.id,
      action,
      status: "status" in result ? result.status : undefined,
    });
    await reload();
    notice.value = "Changes saved.";
    return result;
  }
  async function saveDraft() {
    await run(() => mutate("draft", { ...draft }));
  }
  function action(name: WorkflowAction) {
    error.value = "";
    dialog.value = name;
    Object.assign(actionData, emptyAction(), {
      condition: record.value?.condition || "",
      shop: state.user?.shop || "",
    });
  }
  async function confirmAction() {
    await run(async () => {
      const name = dialog.value;
      if (!name) return;
      await mutate(name, { ...actionData });
      dialog.value = null;
      if (name === "delete") navigate("workspace");
    });
  }
  async function findHistory() {
    await run(async () => {
      searchResult.value = await api()<HistorySearch>("/history/search", {
        condition: selectedRecord().condition,
      });
    });
  }
  async function copyMatch(match: HistoricalMatch) {
    await run(async () => {
      await navigator.clipboard.writeText(
        `Resolution\n${match.resolution}\n\nRationale\n${match.rationale}`,
      );
      notice.value = "Resolution and rationale copied to clipboard.";
    });
  }
  function useMatch(match: HistoricalMatch) {
    draft.resolution = match.resolution;
    draft.rationale = match.rationale;
    notice.value =
      "Historical text inserted. Review and save the draft before signing.";
  }
  function applyTemplate(template: EngineeringTemplate) {
    draft.resolution += `${draft.resolution ? "\n\n" : ""}${template.resolution}`;
    draft.rationale += `${draft.rationale ? "\n\n" : ""}${template.rationale}`;
    dialog.value = null;
    notice.value = "Approved template inserted. Review and save your draft.";
  }
  async function postComment() {
    await run(async () => {
      await mutate("comment", { text: comment.value });
      comment.value = "";
    });
  }
  async function upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await run(async () => {
      if (file.size > 15 * 1024 * 1024)
        throw new Error("File must be 15 MB or smaller.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(Error("Unable to read file."));
        reader.readAsDataURL(file);
      });
      await mutate("attach", {
        name: file.name,
        type: file.type || (file.name.endsWith(".txt") ? "text/plain" : ""),
        base64,
        section: attachmentSection.value,
      });
    });
    input.value = "";
  }
  async function downloadPdf() {
    await run(async () => {
      const suffix = historySnapshot.value
        ? `?revision=${historySnapshot.value.revision}`
        : "";
      const blob = await api()(
        `/records/${selectedRecord().id}/pdf${suffix}`,
        undefined,
        true,
      );
      saveBlob(blob, `ESR-${record.value?.serial}.pdf`);
    });
  }
  function saveBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function previewFile(file: Attachment) {
    await run(async () => {
      const suffix = historySnapshot.value
        ? `?revision=${historySnapshot.value.revision}`
        : "";
      const blob = await api()(
        `/records/${selectedRecord().id}/files/${file.id}${suffix}`,
        undefined,
        true,
      );
      closePreview();
      preview.value = {
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(blob),
        blob,
      };
      dialog.value = "preview";
    });
  }
  function closePreview() {
    if (preview.value) URL.revokeObjectURL(preview.value.url);
    preview.value = null;
  }
  function closeDialog() {
    dialog.value = null;
    closePreview();
    error.value = "";
  }
  onBeforeUnmount(closePreview);
  const { modalElement, trapFocus } = useDialogFocus(dialog, closeDialog);
  watch(permissionUser, (id) =>
    Object.assign(
      permissionForm,
      state.permissions[id] || { crossSite: "none", dualSign: false },
    ),
  );
  async function savePermission() {
    await run(async () => {
      await api()("/permissions", {
        userId: permissionUser.value,
        ...permissionForm,
      });
      await reload();
      notice.value = "Permissions updated.";
    });
  }
  const titles: Record<WorkflowAction, string> = {
    assign: "Assign an engineer",
    reject: "Return request to shop",
    resubmit: "Resubmit request",
    delete: "Delete unassigned request",
    resolve: "Sign · Resolved By",
    approve: "Sign · Approved By",
    return: "Request changes",
    complete: "Shop execution · Blocks 25 / 26",
    close: "Division review & closeout",
    revise: "Create a new revision",
  };
  const dialogTitle = computed(() =>
    dialog.value && dialog.value in titles
      ? titles[dialog.value as WorkflowAction]
      : "",
  );
  return {
    state,
    busy,
    error,
    notice,
    view,
    scope,
    query,
    status,
    selectedId,
    tab,
    dialog,
    actionData,
    draft,
    form,
    searchResult,
    preview,
    historySnapshot,
    comment,
    attachmentSection,
    ldsResult,
    permissionUser,
    permissionForm,
    current,
    record,
    local,
    delegated,
    editable,
    canAttach,
    canComment,
    filtered,
    counts,
    owner,
    run,
    reload,
    resetDraft,
    openRecord,
    navigate,
    newRequest,
    importLds,
    createRequest,
    saveDraft,
    action,
    confirmAction,
    findHistory,
    copyMatch,
    useMatch,
    applyTemplate,
    postComment,
    upload,
    downloadPdf,
    saveBlob,
    previewFile,
    closeDialog,
    savePermission,
    dialogTitle,
    modalElement,
    trapFocus,
  };
}
