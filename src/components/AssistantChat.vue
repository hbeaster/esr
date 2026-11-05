<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useWorkspaceContext } from "../composables/workspaceContext";
import { renderMarkdown } from "../presentation";
const { chat, sendChat, clearChat, insertChat } = useWorkspaceContext();
/** Mirrors the server limit in AssistantChat.MaxTurns: the next send adds one user turn. */
const full = computed(() => chat.messages.length >= 19);
const log = ref<HTMLElement | null>(null);
/** Parsed once per message, not on every keystroke in the composer. */
const rendered = computed(() =>
  chat.messages.map((m) =>
    m.role === "assistant" ? renderMarkdown(m.content) : "",
  ),
);
watch(
  () => chat.messages.length,
  async () => {
    await nextTick();
    log.value?.scrollTo({ top: log.value.scrollHeight });
  },
);
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void sendChat();
  }
}
</script>

<template>
  <section
    class="card padded chat"
    aria-labelledby="assistant-chat-title"
  >
    <div class="section-heading">
      <div>
        <span class="eyebrow">ASSISTANT</span>
        <h2 id="assistant-chat-title">
          Ask about this finding
        </h2>
        <p class="muted">
          The assistant sees this ESR and its closest closed matches. Its
          answers are drafts. Engineer verification is always required.
        </p>
      </div>
      <button
        v-if="chat.messages.length"
        type="button"
        :disabled="chat.sending"
        @click="clearChat"
      >
        Clear chat
      </button>
    </div>
    <div
      ref="log"
      class="chat-log"
      role="log"
      aria-live="polite"
    >
      <p
        v-if="!chat.messages.length"
        class="muted chat-empty"
      >
        Try “What could cause this condition?” or “Draft a rationale for
        replacing the part.”
      </p>
      <div
        v-for="(message, index) in chat.messages"
        :key="index"
        class="chat-message"
        :class="message.role"
      >
        <span class="chat-role">{{
          message.role === "user" ? "You" : "Assistant"
        }}</span>
        <!-- Sanitized by renderMarkdown: fixed tag allowlist, no images, http(s)/mailto links only. -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          v-if="message.role === 'assistant'"
          class="chat-bubble rich"
          v-html="rendered[index]"
        />
        <!-- eslint-enable vue/no-v-html -->
        <div
          v-else
          class="chat-bubble"
        >
          {{ message.content }}
        </div>
        <div
          v-if="message.role === 'assistant'"
          class="action-row"
        >
          <button
            type="button"
            @click="insertChat(message.content, 'resolution')"
          >
            Add to resolution
          </button><button
            type="button"
            @click="insertChat(message.content, 'rationale')"
          >
            Add to rationale
          </button>
        </div>
      </div>
      <p
        v-if="chat.sending"
        class="muted chat-pending"
      >
        Assistant is thinking…
      </p>
    </div>
    <form
      class="chat-compose"
      @submit.prevent="sendChat"
    >
      <label>Message<textarea
        v-model="chat.input"
        rows="2"
        maxlength="4000"
        :disabled="full"
        placeholder="Ask a question. Enter sends, Shift+Enter adds a line."
        @keydown="onKeydown"
      />
      </label>
      <button
        class="primary"
        :disabled="chat.sending || full || !chat.input.trim()"
      >
        Send
      </button>
    </form>
    <small
      v-if="full"
      class="muted"
    >This conversation reached its message limit. Clear the chat to start
      again.</small>
    <small
      v-else-if="chat.model"
      class="muted"
    >{{
      chat.mock
        ? "Mock assistant: no API key is configured on the server."
        : `Model: ${chat.model}`
    }}</small>
  </section>
</template>

<style scoped>
.chat-log {
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  margin: var(--sp-4) 0;
  padding: var(--sp-3);
  background: var(--esr-bg);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius);
}
.chat-empty,
.chat-pending {
  font-size: var(--fs-xs);
  margin: 0;
}
.chat-message {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  max-width: 85%;
}
.chat-message.user {
  align-self: flex-end;
  align-items: flex-end;
}
.chat-role {
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.chat-bubble {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--fs-sm);
  line-height: 1.5;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--line);
}
.chat-message.user .chat-bubble {
  background: var(--esr-accent-soft);
  border-color: transparent;
  color: var(--esr-accent-text);
}
/* Assistant replies are v-html, so their elements need :deep() to receive scoped rules. */
.chat-bubble.rich {
  white-space: normal;
}
.chat-bubble.rich :deep(> :first-child) {
  margin-top: 0;
}
.chat-bubble.rich :deep(> :last-child) {
  margin-bottom: 0;
}
.chat-bubble.rich :deep(:is(p, ul, ol, pre, blockquote, table)) {
  margin: 0 0 var(--sp-2);
}
.chat-bubble.rich :deep(:is(h1, h2, h3, h4, h5, h6)) {
  font-size: var(--fs-sm);
  font-weight: 700;
  margin: var(--sp-3) 0 var(--sp-1);
}
.chat-bubble.rich :deep(:is(h1, h2)) {
  font-size: var(--fs-base);
}
.chat-bubble.rich :deep(:is(ul, ol)) {
  padding-left: var(--sp-5);
}
.chat-bubble.rich :deep(li + li) {
  margin-top: 3px;
}
.chat-bubble.rich :deep(code) {
  font-size: var(--fs-xs);
  background: var(--gray-bg);
  border-radius: var(--radius-sm);
  padding: 1px var(--sp-1);
}
.chat-bubble.rich :deep(pre) {
  background: var(--gray-bg);
  border-radius: var(--radius-sm);
  padding: var(--sp-2) var(--sp-3);
  overflow-x: auto;
}
.chat-bubble.rich :deep(pre code) {
  background: none;
  padding: 0;
  white-space: pre;
}
.chat-bubble.rich :deep(blockquote) {
  border-left: 3px solid var(--line);
  padding-left: var(--sp-3);
  color: var(--ink-3);
}
.chat-bubble.rich :deep(hr) {
  border: 0;
  border-top: 1px solid var(--line);
  margin: var(--sp-3) 0;
}
.chat-bubble.rich :deep(a) {
  color: var(--esr-accent-text);
}
.chat-bubble.rich :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: var(--fs-xs);
}
.chat-bubble.rich :deep(:is(th, td)) {
  border: 1px solid var(--line);
  padding: var(--sp-1) var(--sp-2);
  text-align: left;
  overflow-wrap: normal;
  word-break: normal;
}
.chat-bubble.rich :deep(th) {
  background: var(--surface-2);
  color: inherit;
  font-weight: 700;
  letter-spacing: normal;
  text-transform: none;
}
.chat-compose {
  display: flex;
  gap: var(--sp-3);
  align-items: flex-end;
}
.chat-compose label {
  flex: 1;
  min-width: 0;
}
</style>
