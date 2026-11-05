<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, useId, watch } from "vue";
import { plainText, richTextHtml, sanitizeRichText } from "../presentation";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    minHeight?: string;
  }>(),
  { placeholder: "", required: false, minHeight: "96px" },
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const labelId = useId();
const editor = ref<HTMLElement | null>(null);
const invalid = ref(false);
const empty = ref(!plainText(props.modelValue));
const pressed = reactive({ bold: false, italic: false, underline: false });
const commands = [
  { command: "bold", label: "Bold", text: "B" },
  { command: "italic", label: "Italic", text: "I" },
  { command: "underline", label: "Underline", text: "U" },
  { command: "insertUnorderedList", label: "Bulleted list", text: "•" },
  { command: "insertOrderedList", label: "Numbered list", text: "1." },
] as const;
let form: HTMLFormElement | null = null;

function focused() {
  const root = editor.value?.getRootNode();
  return root instanceof ShadowRoot
    ? root.activeElement === editor.value
    : document.activeElement === editor.value;
}
function sync() {
  const html = sanitizeRichText(editor.value?.innerHTML || "");
  const next = plainText(html) ? html : "";
  empty.value = !next;
  if (next !== props.modelValue) emit("update:modelValue", next);
  if (next) invalid.value = false;
  refreshState();
}
function refreshState() {
  try {
    pressed.bold = document.queryCommandState("bold");
    pressed.italic = document.queryCommandState("italic");
    pressed.underline = document.queryCommandState("underline");
  } catch {
    pressed.bold = pressed.italic = pressed.underline = false;
  }
}
function format(command: string) {
  editor.value?.focus();
  document.execCommand(command);
  sync();
}
function onSubmit(event: Event) {
  if (!props.required || plainText(props.modelValue)) {
    invalid.value = false;
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  invalid.value = true;
  editor.value?.focus();
}
watch(
  () => props.modelValue,
  (value) => {
    const next = richTextHtml(value);
    empty.value = !plainText(value);
    if (!editor.value || editor.value.innerHTML === next) return;
    if (focused() && plainText(editor.value.innerHTML) === plainText(value))
      return;
    editor.value.innerHTML = next;
  },
);
onMounted(() => {
  if (editor.value) editor.value.innerHTML = richTextHtml(props.modelValue);
  form = editor.value?.closest("form") ?? null;
  form?.addEventListener("submit", onSubmit, true);
});
onBeforeUnmount(() => form?.removeEventListener("submit", onSubmit, true));
</script>

<template>
  <div class="rich-field">
    <span
      :id="labelId"
      class="rich-label"
    >{{ label }}</span>
    <div
      class="rich-box"
      :class="{ invalid }"
    >
      <div
        class="rich-toolbar"
        role="toolbar"
        :aria-label="`${label} formatting`"
      >
        <button
          v-for="item in commands"
          :key="item.command"
          type="button"
          class="rich-tool"
          :class="item.command"
          :aria-label="item.label"
          :aria-pressed="
            item.command === 'bold'
              ? pressed.bold
              : item.command === 'italic'
                ? pressed.italic
                : item.command === 'underline'
                  ? pressed.underline
                  : undefined
          "
          @mousedown.prevent
          @click="format(item.command)"
        >
          {{ item.text }}
        </button>
      </div>
      <div
        ref="editor"
        class="rich-text"
        :class="{ 'is-empty': empty }"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        :aria-labelledby="labelId"
        :aria-required="required || undefined"
        :aria-invalid="invalid || undefined"
        :data-placeholder="placeholder"
        :style="{ minHeight }"
        @input="sync"
        @blur="sync"
        @keyup="refreshState"
        @mouseup="refreshState"
      />
    </div>
    <p
      v-if="invalid"
      class="rich-error"
    >
      {{ label }} is required.
    </p>
  </div>
</template>
