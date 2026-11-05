import { describe, expect, it } from "vitest";
import { markdownToPlainText } from "../../src/presentation";
// renderMarkdown is verified in tests/component/workspace.spec.ts: DOMPurify does not sanitize under happy-dom.

describe("assistant markdown to plain text", () => {
  it("converts to plain text for the resolution and rationale", () => {
    expect(
      markdownToPlainText(
        "### Plan\n\n* **Replace** the `insert`\n* See [spec](https://x.test)\n\n| A | B |\n| --- | --- |\n| 1 | 2 |",
      ),
    ).toBe(
      "Plan\n\n- Replace the insert\n- See spec (https://x.test)\n\n| A | B |\n\n| 1 | 2 |",
    );
    expect(markdownToPlainText("Use *care* and keep 2 * 3 intact")).toBe(
      "Use care and keep 2 * 3 intact",
    );
  });
});
