import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Bootstrap, LdsData } from "../../src/types";
const fixture: Bootstrap = JSON.parse(
  readFileSync(
    new URL("../../backend/Esr.Tests/test-data.json", import.meta.url),
    "utf8",
  ),
);
/** What the backend returns from CRACN for the demo JCN (see mocks/cracn). */
const lds: Record<string, LdsData> = {
  "21036WX010184": {
    workStatement: "Inspect auxiliary seawater pump coupling",
    refit: "A014",
    component: "ASW-P-02 / TSN-10482",
    location: "Auxiliary machinery space",
    swbs: "6286FCA00000",
  },
};
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
  await expect(
    page.getByRole("columnheader", { name: /Time in Status/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Mock fleet hull heatmap: .*Auxiliary 1/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Auxiliary 1" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Remove zone filter Auxiliary" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.screenshot({
    path: "artifacts/desktop-workspace.png",
    fullPage: true,
  });
  await page.getByLabel("Search requests").fill("SUBSAFE");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("tab", { name: "My work", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My work" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "All requests" }).click();
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
    .getByRole("button", { name: "Open 260037A" })
    .click();
  await expect(
    page.locator(".detail-heading").getByRole("img", {
      name: "Mock illustration: Pump",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Mock hull map: Auxiliary machinery space (Auxiliary)",
    }),
  ).toBeVisible();
  const progress = page.getByRole("list", { name: "Workflow progress" });
  await expect(progress.getByRole("listitem")).toHaveCount(5);
  await expect(progress.locator('[aria-current="step"]')).toContainText(
    "In Process",
  );
  await page.getByRole("tab", { name: "Resolution", exact: true }).click();
  await page.getByRole("button", { name: "Insert template" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Insert template" })
    .first()
    .click();
  await expect(page.getByLabel("Resolution", { exact: true })).toContainText(
    "Isolate the affected component",
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
  await page.getByLabel("Job Control Number").fill("21036WX010184");
  await page.getByRole("button", { name: "Import LDS" }).click();
  await expect(page.locator(".lds-result")).toContainText("ASW-P-02");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "Open 260037A" })
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
  // Child SFC <style scoped> blocks land in the shadow root, never the host page.
  const styles = await page.evaluate(() => {
    const root = document.querySelector("esr-workspace")!.shadowRoot!;
    const text = (nodes: Iterable<Element>) =>
      [...nodes].map((n) => n.textContent ?? "").join("\n");
    return {
      shadow: text(root.querySelectorAll("style")),
      document: text(document.querySelectorAll("style")),
      statBorder: getComputedStyle(root.querySelector(".stat")!)
        .borderTopWidth,
    };
  });
  expect(styles.shadow).toMatch(/\.stat\[data-v-[0-9a-f]{8}\]/);
  expect(styles.shadow).toMatch(/\.workspace-tabs\[data-v-[0-9a-f]{8}\]/);
  expect(styles.document).not.toMatch(/data-v-/);
  expect(styles.statBorder).toBe("3px");
});

test("top tabs expose permitted views and support keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  const tabs = page.getByRole("tablist", { name: "Workspace views" });
  const all = tabs.getByRole("tab", { name: "All requests" });
  const mine = tabs.getByRole("tab", { name: "My work" });
  await expect(all).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tab")).toHaveCount(2);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.locator(".topbar")).not.toContainText("Engineering /");
  await expect(
    page.getByRole("button", { name: "Template library" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: /Historical ESRs|Template library/ }),
  ).toHaveCount(0);
  await all.focus();
  await page.keyboard.press("ArrowRight");
  await expect(mine).toBeFocused();
  await expect(all).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(mine).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("tbody tr")).toHaveCount(
    fixture.records.filter(
      (record) =>
        record.engineerId === "engineer" || record.requestorId === "engineer",
    ).length,
  );
  await page
    .getByRole("button", { name: "Open 260037A" })
    .click();
  await expect(all).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Back to requests" }).click();
  await all.focus();
  await page.keyboard.press("End");
  await expect(mine).toBeFocused();
  await page.keyboard.press("Home");
  await expect(all).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(mine).toBeFocused();
  await page.keyboard.press("Space");
  await expect(mine).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Demo identity").selectOption("admin");
  const permissions = tabs.getByRole("tab", {
    name: "Permissions",
    exact: true,
  });
  await expect(permissions).toBeVisible();
  await permissions.click();
  await expect(
    page.getByRole("heading", { name: "User permissions" }),
  ).toBeVisible();
  await page.getByLabel("Demo identity").selectOption("engineer");
  await expect(permissions).toHaveCount(0);
  await expect(all).toHaveAttribute("aria-selected", "true");
});

test("header fits a narrow container inside a desktop host", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByLabel("Demo identity").selectOption("admin");
  await expect(
    page.getByRole("tab", { name: "Permissions", exact: true }),
  ).toBeVisible();
  await page.locator("esr-workspace").evaluate((element) => {
    (element as HTMLElement).style.width = "360px";
  });
  const tabs = page.getByRole("tablist", { name: "Workspace views" });
  const refresh = page.getByRole("button", { name: "Refresh workspace" });
  const tabsBox = (await tabs.boundingBox())!;
  const refreshBox = (await refresh.boundingBox())!;
  expect(refreshBox.y).toBeGreaterThanOrEqual(tabsBox.y + tabsBox.height);
  expect(
    await page
      .locator("esr-workspace .app")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/narrow-embedded-workspace.png",
    fullPage: true,
  });
  await refresh.click();
  await expect(page.locator("esr-workspace .app")).toHaveAttribute(
    "aria-busy",
    "false",
  );
});
