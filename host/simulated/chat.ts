/**
 * Dev-only assistant chat for simulated data. The real API owns the chat for
 * real records (backend/Esr.Api/Chat.cs); simulated records exist only in the
 * dev server, so the dev server grounds and forwards their chat itself. This
 * mirrors Chat.cs so answers behave alike, and it never reaches a build: the
 * plugin that calls it only runs under `vite serve`.
 */
import type { EsrRecord } from "../../src/types";

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface ChatProvider {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}
export interface SimulatedMatch {
  serial: string | null;
  title: string;
  resolution: string;
  rationale: string;
  similarity: number;
}
/** Thrown with a message that is safe to show the user. */
export class ChatFailure extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

/** Same limits as AssistantChat.MaxTurns and MaxLength. */
export const MAX_TURNS = 20;
export const MAX_LENGTH = 4000;

/** Plain text from stored rich text, like Workflow.VisibleText. */
export function visibleText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
const tokens = (text: string) =>
  new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);

/** Closest closed records by term overlap, like Workflow.Matches. */
export function closestMatches(
  record: EsrRecord,
  candidates: EsrRecord[],
): SimulatedMatch[] {
  const terms = tokens(visibleText(record.condition));
  return candidates
    .filter((r) => r.status === "ESR Closed" && r.id !== record.id)
    .map((r) => {
      const other = tokens(visibleText(r.condition));
      const shared = [...terms].filter((t) => other.has(t)).length;
      return {
        serial: r.serial,
        title: r.title,
        resolution: r.resolution,
        rationale: r.rationale,
        similarity: Math.round((100 * shared) / Math.max(terms.size, 1)),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

/** Validates the client transcript like AssistantChat.Parse. */
export function parseTurns(messages: unknown): ChatTurn[] {
  if (!Array.isArray(messages) || !messages.length)
    throw new ChatFailure("messages is required.", 400);
  if (messages.length > MAX_TURNS)
    throw new ChatFailure(
      `A conversation is limited to ${MAX_TURNS} messages. Clear the chat to continue.`,
      400,
    );
  const turns = messages.map((m: unknown) => {
    const role = (m as { role?: unknown })?.role;
    const content = (m as { content?: unknown })?.content;
    if (role !== "user" && role !== "assistant")
      throw new ChatFailure("Message role must be user or assistant.", 400);
    if (typeof content !== "string" || !content.trim())
      throw new ChatFailure("Message content is required.", 400);
    if (content.length > MAX_LENGTH)
      throw new ChatFailure(
        `Each message is limited to ${MAX_LENGTH} characters.`,
        400,
      );
    return { role, content: content.trim() } as ChatTurn;
  });
  if (turns.at(-1)!.role !== "user")
    throw new ChatFailure("The last message must come from the user.", 400);
  return turns;
}

/** Grounds the model in the record, like AssistantChat.SystemPrompt. */
export function systemPrompt(r: EsrRecord, matches: SimulatedMatch[]): string {
  const lines = [
    "You are an engineering assistant for a Trident Refit Facility engineer drafting the resolution and rationale of an Engineering Service Request (ESR).",
    "Give concise, technically careful suggestions. Say when information is missing. Never invent specification, drawing, DFS, or TVD numbers. The engineer verifies and signs everything; your output is a draft.",
    "Format replies in Markdown: short paragraphs, numbered lists for steps, bullet lists for options, bold for key terms, and tables only for comparisons. Do not include images or HTML.",
    "",
    "Active ESR:",
  ];
  const line = (label: string, value: string | null | undefined) => {
    const text = visibleText(value);
    if (text) lines.push(`- ${label}: ${text}`);
  };
  line("Title", r.title);
  line("Condition / finding", r.condition);
  line("References", r.references);
  line("JCN", r.jcn);
  line("Work statement", r.workStatement);
  line("Component", r.component);
  line("Location", r.location);
  line("Current draft resolution", r.resolution);
  line("Current draft rationale", r.rationale);
  const similar = matches.filter((m) => m.similarity > 0);
  if (similar.length) {
    lines.push("", "Similar closed ESRs (term-overlap search):");
    for (const m of similar)
      lines.push(
        `- ${m.serial} "${m.title}" (${m.similarity}% similar). Resolution: ${visibleText(m.resolution)} Rationale: ${visibleText(m.rationale)}`,
      );
  }
  return lines.join("\n") + "\n";
}

/** POST {baseUrl}/chat/completions, like OpenAiCompatibleChat. */
export async function completeChat(
  provider: ChatProvider,
  messages: ChatTurn[],
  request: typeof fetch = fetch,
): Promise<{ reply: string; model: string }> {
  let response: Response;
  try {
    response = await request(
      `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey.trim()}`,
        },
        body: JSON.stringify({ model: provider.model, messages }),
        signal: AbortSignal.timeout(provider.timeoutMs),
      },
    );
  } catch {
    throw new ChatFailure(
      "The chat provider is unreachable. Try again shortly.",
    );
  }
  // Provider error bodies can echo key fragments, so only the status is reported.
  if (!response.ok)
    throw new ChatFailure(
      response.status === 401 || response.status === 403
        ? "The chat provider rejected the configured API key."
        : response.status === 429
          ? "The chat provider is rate limited or out of quota."
          : response.status === 404
            ? "The chat provider does not recognize the configured model or base URL."
            : `The chat provider failed (${response.status}).`,
    );
  const json = (await response.json().catch(() => null)) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
  } | null;
  const reply = json?.choices?.[0]?.message?.content?.trim();
  if (!reply)
    throw new ChatFailure("The chat provider returned an empty reply.");
  return { reply, model: json?.model ?? provider.model };
}
