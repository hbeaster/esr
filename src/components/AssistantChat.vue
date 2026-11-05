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
