/** Public API DTOs and UI state shared by the embeddable Vue workspace. */
export type TokenProvider = () => string | Promise<string>;
export type WorkflowStatus =
  | "Unassigned"
  | "In Process"
  | "Awaiting Approval"
  | "ESR Issued"
  | "ESR Issued – Deferred"
  | "ESR Closed";
export type Role =
  | "Requestor"
  | "Engineer"
  | "Supervisor"
  | "Shop"
  | "Division Head"
  | "Administrator"
  | "Planner";
export type Scope = "all" | "mine" | "history";
export type View = "workspace" | "record" | "templates" | "admin";
export type RecordTab =
  "overview" | "resolution" | "files" | "history" | "activity";
export type WorkflowAction =
  | "assign"
  | "reject"
  | "resubmit"
  | "delete"
  | "resolve"
  | "approve"
  | "return"
  | "complete"
  | "close"
  | "revise";
export type Dialog = WorkflowAction | "create" | "templates" | "preview";
export type ReferenceAnswer = "" | "yes" | "no";
export type CompletionStatus = "Completed" | "Deferred" | "Other" | "Canceled";
export type AttachmentSection = "Condition" | "Reference" | "Continuation";
export type EsrAttribute = "Level 1" | "Requires Rev" | "SOC" | "SUBSAFE";
export interface Actor {
  id: string;
  name: string;
  role: Role;
  site: string;
  shop: string;
  phone: string;
}
export interface Permission {
  crossSite: "none" | "read" | "review";
  dualSign: boolean;
  updatedBy?: string;
  updatedAt?: string;
}
export interface Signature {
  id: string;
  userId: string;
  name: string;
  block: string;
  time: string;
  comment: string;
  text?: string;
}
export interface AuditEntry {
  id: string;
  actor: string;
  time: string;
  action: string;
}
export interface Attachment {
  id: string;
  name: string;
  type: string;
  section: AttachmentSection;
  size: number;
  uploadedBy: string;
  time: string;
}
export interface Completion {
  status: CompletionStatus;
  explanation: string;
  name: string;
  shop: string;
  date: string;
}
export interface EngineeringTemplate {
  id: string;
  title: string;
  category: string;
  resolution: string;
  rationale: string;
}
export interface LdsData {
  workStatement: string;
  refit: string;
  component: string;
  location: string;
}
export interface Draft {
  resolution: string;
  rationale: string;
  dfs: ReferenceAnswer;
  dfsReference: string;
  tvd: ReferenceAnswer;
  tvdReference: string;
  attributes: EsrAttribute[];
}
export interface EsrRecord extends Draft, LdsData {
  id: string;
  title: string;
  name: string;
  shop: string;
  phone: string;
  references: string;
  condition: string;
  jcn: string;
  site: string;
  requestorId: string;
  status: WorkflowStatus;
  serial: string | null;
  serialBase: string | null;
  revision: number;
  revisionReason?: string;
  engineerId: string | null;
  attachments: Attachment[];
  comments: Signature[];
  signatures: Signature[];
  audit: AuditEntry[];
  revisions: EsrRecord[];
  completion: Completion | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  rejected: boolean;
}
export interface Bootstrap {
  user: Actor;
  users: Actor[];
  records: EsrRecord[];
  templates: EngineeringTemplate[];
  permissions: Record<string, Permission>;
}
export interface WorkspaceState extends Omit<Bootstrap, "user"> {
  user: Actor | null;
}
export interface RequestForm {
  title: string;
  jcn: string;
  noJcn: boolean;
  name: string;
  shop: string;
  phone: string;
  references: string;
  condition: string;
}
export interface ActionForm {
  engineerId: string;
  comment: string;
  reason: string;
  condition: string;
  status: CompletionStatus;
  explanation: string;
  shop: string;
  acknowledgeDeferred: boolean;
}
export interface HistoricalMatch {
  id: string;
  serial: string | null;
  title: string;
  resolution: string;
  rationale: string;
  similarity: number;
}
export interface HistorySearch {
  summary: string;
  matches: HistoricalMatch[];
}
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
/** Response of POST /assistant/chat. `mock` is true when the API has no provider key configured. */
export interface ChatReply {
  reply: string;
  model: string;
  mock: boolean;
}
export interface FilePreview {
  name: string;
  type: string;
  url: string;
  blob: Blob;
}
export interface RecordChange {
  id: string;
  action: string;
  status?: WorkflowStatus;
}
export interface WorkspaceError {
  message: string;
}
export interface WorkspaceProps {
  apiBase?: string;
  tokenProvider?: TokenProvider | null;
}
export interface WorkspaceEvents {
  (event: "record-change", payload: RecordChange): void;
  (event: "workspace-error", payload: WorkspaceError): void;
}
export interface EsrWorkspaceElement extends HTMLElement {
  apiBase?: string;
  tokenProvider?: TokenProvider | null;
}
