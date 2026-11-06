import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { createApi } from "../api";
import {
  activityFeed,
  appendRichText,
  filterRecords,
  parseLocation,
  placeKey,
  liveVerb,
  recordAsOf,
  replaySpeeds,
  normalizeJcn,
  plainText,
  markdownToRichText,
  steps,
} from "../presentation";
import type { PlaceKey, ReplaySpeed } from "../presentation";
import { useDialogFocus } from "./useDialogFocus";
import { useNow } from "./useNow";
import { useLive } from "./useLive";
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
  ChatMessage,
  ChatReply,
  LdsData,
  LiveRecordChange,
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
export interface PendingFile {
  key: string;
  name: string;
  type: string;
  size: number;
  section: AttachmentSection;
  base64: string;
}

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
    status = ref(""),
    /** Compartment ("missile") or compartment and level ("missile/second") filter. */
    place = ref<PlaceKey>("");
  /** Full-screen watch-floor wallboard. */
  const watchFloor = ref(false);
  /**
   * Fleet replay speed, shared by this workspace's players (list page and
   * watch floor). Remembered per browser; storage can be blocked, so it falls
   * back to the fastest.
   */
  const REPLAY_SPEED_KEY = "esr.replaySpeed";
  const replaySpeed = ref<ReplaySpeed>(
    (() => {
      try {
        const saved = localStorage.getItem(REPLAY_SPEED_KEY);
        return replaySpeeds.some((s) => s.id === saved)
          ? (saved as ReplaySpeed)
          : "fast";
      } catch {
        return "fast";
      }
    })(),
  );
  watch(replaySpeed, (speed) => {
    try {
      localStorage.setItem(REPLAY_SPEED_KEY, speed);
    } catch {
      // Storage blocked: the choice lasts until the page reloads.
    }
  });
  /** Fleet replay position (epoch ms). Null shows live data. */
  const replayAt = ref<number | null>(null);
  const clock = useNow();
  /** The time the fleet views describe: the replay position, or now. */
  const fleetNow = computed(() => replayAt.value ?? clock.value);
  /** Workflow events across all records, oldest first, for the replay ticker. */
  const activity = computed(() => activityFeed(state.records));
  /** Records as they stood at the replay position, or live records. */
  const fleet = computed(() => {
    const t = replayAt.value;
    if (t === null) return state.records;
    return state.records
      .map((r) => recordAsOf(r, t))
      .filter((r): r is EsrRecord => r !== null);
  });
  const selectedId = ref<string | null>(null),
    tab = ref<RecordTab>("overview"),
    dialog = ref<Dialog | null>(null);
  const actionData = reactive<ActionForm>(emptyAction()),
    draft = reactive<Draft>(emptyDraft()),
    form = reactive<RequestForm>(emptyRequest());
  const searchResult = ref<HistorySearch | null>(null),
    preview = ref<FilePreview | null>(null),
    historySnapshot = ref<EsrRecord | null>(null);
  const chat = reactive({
    messages: [] as ChatMessage[],
    input: "",
    sending: false,
    model: "",
    mock: false,
  });
  const comment = ref(""),
    attachmentSection = ref<AttachmentSection>("Continuation"),
    requestSection = ref<AttachmentSection>("Condition"),
    ldsResult = ref<LdsData | null>(null);
  const pendingFiles = ref<PendingFile[]>([]);
  let pendingKey = 0;
  const fileTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
    "text/plain",
  ];
  function fileType(file: File) {
    if (file.type && fileTypes.includes(file.type)) return file.type;
    return file.name.toLowerCase().endsWith(".txt") ? "text/plain" : file.type;
  }
  function assertFile(file: File) {
    if (file.size <= 0 || file.size > 15 * 1024 * 1024)
      throw new Error("File must be between 1 byte and 15 MB.");
    if (!fileTypes.includes(fileType(file)))
      throw new Error("Supported files: PNG, JPEG, WebP, PDF, TXT.");
  }
  function readBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(Error("Unable to read file."));
      reader.readAsDataURL(file);
    });
  }
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
      place.value,
    ),
  );
  /**
   * Records per compartment and per compartment level, under every filter
   * except the place itself. Keys are place keys plus "unlocated".
   */
  const placeCounts = computed(() => {
    const result: Partial<Record<PlaceKey | "unlocated", number>> = {
      unlocated: 0,
    };
    const bump = (key: PlaceKey | "unlocated") =>
      (result[key] = (result[key] ?? 0) + 1);
    for (const r of filterRecords(
      fleet.value,
      query.value,
      status.value,
      scope.value,
      state.user?.id,
    )) {
      const loc = parseLocation(r.location);
      if (!loc) bump("unlocated");
      else {
        bump(loc.compartment);
        if (loc.level) bump(placeKey(loc.compartment, loc.level));
      }
    }
    return result;
  });
  const counts = computed(() =>
    Object.fromEntries(
      steps.map((s) => [
        s,
        fleet.value.filter(
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

  /** The record version the draft was loaded from. Saves send it, so edits made on an older version get a 409. */
  const draftVersion = ref<number | null>(null);
  const draftFields = (d: Draft) =>
    JSON.stringify([
      d.resolution,
      d.rationale,
      d.dfs,
      d.dfsReference,
      d.tvd,
      d.tvdReference,
      [...d.attributes],
    ]);
  /** True when the draft has edits the open record does not have yet. */
  const draftDirty = () =>
    !!current.value && draftFields(draft) !== draftFields(current.value);
  function resetDraft() {
    const r = current.value;
    draftVersion.value = r?.version ?? null;
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
    clearChat();
    error.value = "";
    notice.value = "";
    resetDraft();
  }
  function navigate(target: View, nextScope: Scope = "all") {
    view.value = target;
    scope.value = nextScope;
    selectedId.value = null;
    replayAt.value = null;
    status.value = "";
    query.value = "";
    place.value = "";
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
    pendingFiles.value = [];
    requestSection.value = "Condition";
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
      const queued = [...pendingFiles.value];
      const r = await api()<EsrRecord>("/records", {
        ...form,
        jcn: form.noJcn ? "N/A" : normalizeJcn(form.jcn),
      });
      let version = r.version;
      let failed = "";
      for (const file of queued) {
        try {
          const updated = await api()<EsrRecord>(`/records/${r.id}/attach`, {
            name: file.name,
            type: file.type,
            base64: file.base64,
            section: file.section,
            version,
          });
          version = updated.version;
          pendingFiles.value = pendingFiles.value.filter(
            (item) => item.key !== file.key,
          );
          emit("record-change", {
            id: r.id,
            action: "attach",
            status: updated.status,
          });
        } catch (cause) {
          failed =
            cause instanceof Error
              ? cause.message
              : "Unable to attach a supporting file.";
          break;
        }
      }
      await reload();
      dialog.value = null;
      openRecord(r);
      emit("record-change", { id: r.id, action: "create", status: r.status });
      if (failed)
        throw new Error(
          `Request submitted. A supporting file was not attached. ${failed}`,
        );
      notice.value = queued.length
        ? "Request submitted with supporting files."
        : "Request submitted.";
    });
  }
  async function queueFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = "";
    if (!files.length) return;
    await run(async () => {
      for (const file of files) {
        assertFile(file);
        if (pendingFiles.value.length >= 20)
          throw new Error("Maximum 20 files per record.");
        pendingFiles.value = [
          ...pendingFiles.value,
          {
            key: `pending-${pendingKey++}`,
            name: file.name,
            type: fileType(file),
            size: file.size,
            section: requestSection.value,
            base64: await readBase64(file),
          },
        ];
      }
    });
  }
  function removePending(key: string) {
    pendingFiles.value = pendingFiles.value.filter((file) => file.key !== key);
  }
  async function mutate(action: string, data: object = {}) {
    const r = selectedRecord();
    const result = await api()<EsrRecord | { deleted: true }>(
      `/records/${r.id}/${action}`,
      { ...data, version: draftVersion.value ?? r.version },
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
        condition: plainText(selectedRecord().condition),
      });
    });
  }
  function clearChat() {
    chat.messages = [];
    chat.input = "";
    chat.model = "";
    chat.mock = false;
  }
  /** Chat has its own pending flag so a slow model reply does not lock the rest of the workspace. */
  async function sendChat() {
    const content = chat.input.trim();
    const recordId = selectedId.value;
    if (!content || chat.sending || !recordId) return;
    chat.messages.push({ role: "user", content });
    chat.input = "";
    chat.sending = true;
    error.value = "";
    try {
      const result = await api()<ChatReply>("/assistant/chat", {
        recordId,
        messages: chat.messages,
      });
      if (selectedId.value !== recordId) return;
      chat.messages.push({ role: "assistant", content: result.reply });
      chat.model = result.model;
      chat.mock = result.mock;
    } catch (e) {
      if (selectedId.value !== recordId) return;
      chat.messages.pop();
      chat.input = content;
      error.value =
        e instanceof Error ? e.message : "An unexpected error occurred.";
      emit("workspace-error", { message: error.value });
    } finally {
      chat.sending = false;
    }
  }
  function insertChat(content: string, field: "resolution" | "rationale") {
    draft[field] = appendRichText(draft[field], markdownToRichText(content));
    notice.value = `Assistant text added to the ${field}. Review and save the draft before signing.`;
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
    draft.resolution = appendRichText(draft.resolution, template.resolution);
    draft.rationale = appendRichText(draft.rationale, template.rationale);
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
    const files = [...(input.files ?? [])];
    input.value = "";
    if (!files.length) return;
    await run(async () => {
      for (const file of files) {
        assertFile(file);
        await mutate("attach", {
          name: file.name,
          type: fileType(file),
          base64: await readBase64(file),
          section: attachmentSection.value,
        });
      }
    });
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

  // ---- Optional live updates and presence (GET /events, POST /presence) ----
  async function applyRemoteChange(change: LiveRecordChange) {
    const local = state.records.find((r) => r.id === change.id);
    const others = change.actorId !== state.user?.id;
    const onScreen = current.value?.id === change.id && view.value === "record";
    if (change.deleted) {
      state.records = state.records.filter((r) => r.id !== change.id);
      if (onScreen) {
        navigate("workspace");
        if (others) notice.value = `${change.actor} deleted that request.`;
      }
      return;
    }
    if (local && local.version >= change.version) return;
    const wasDirty = onScreen && draftDirty();
    let fresh: EsrRecord;
    try {
      fresh = await api()<EsrRecord>(`/records/${change.id}`);
    } catch {
      return;
    }
    // A slower fetch must not replace a newer copy that already arrived.
    const index = state.records.findIndex((r) => r.id === fresh.id);
    if (index === -1) state.records.unshift(fresh);
    else if (state.records[index].version < fresh.version)
      state.records[index] = fresh;
    else return;
    if (!onScreen || !others) return;
    if (wasDirty)
      notice.value = `${change.actor} ${liveVerb(change.action)} this record. Your unsaved draft is based on the earlier version.`;
    else {
      resetDraft();
      notice.value = `${change.actor} ${liveVerb(change.action)} this record.`;
    }
  }
  const live = useLive({
    identity: () => [state.user?.id, props.tokenProvider, props.apiBase],
    enabled: () => !!state.user && !!props.tokenProvider,
    base: () => props.apiBase || "/api",
    tokenProvider: () => props.tokenProvider,
    presence: () =>
      watchFloor.value
        ? { view: "watch-floor", recordId: null }
        : view.value === "record"
          ? { view: "record", recordId: selectedId.value }
          : view.value === "workspace"
            ? { view: "workspace", recordId: null }
            : { view: "other", recordId: null },
    onChange: (change) => void applyRemoteChange(change),
  });
  /** Everyone else with a workspace open, one entry per open window. */
  const viewers = computed(() =>
    live.viewers.value.filter(
      (v) => v.connectionId !== live.connectionId.value,
    ),
  );
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
    place,
    replayAt,
    replaySpeed,
    watchFloor,
    fleet,
    fleetNow,
    activity,
    liveStatus: live.status,
    lastChange: live.lastChange,
    viewers,
    selectedId,
    tab,
    dialog,
    actionData,
    draft,
    form,
    searchResult,
    chat,
    preview,
    historySnapshot,
    comment,
    attachmentSection,
    requestSection,
    pendingFiles,
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
    placeCounts,
    owner,
    run,
    reload,
    resetDraft,
    openRecord,
    navigate,
    newRequest,
    importLds,
    createRequest,
    queueFiles,
    removePending,
    saveDraft,
    action,
    confirmAction,
    findHistory,
    sendChat,
    clearChat,
    insertChat,
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
