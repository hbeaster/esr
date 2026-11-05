import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { createSimulatedRecords } from "../../host/simulated/data";
import type { SimulatedSeed } from "../../host/simulated/data";
import { READ_ONLY_MESSAGE } from "../../host/simulated/handler";

const seed: SimulatedSeed = JSON.parse(
  readFileSync(
    new URL("../../backend/Esr.Api/seed.json", import.meta.url),
    "utf8",
  ),
);
const records = createSimulatedRecords(seed);
const unassigned = records.find(
  (r) => r.status === "Unassigned" && r.site === "Bangor" && !r.rejected,
)!;

// A production target must not offer this control, and it is tested only in dev.
test.skip(
  !!process.env.ESR_BASE_URL,
  "The toggle only exists on the dev server.",
);

test("switches between API data and read-only simulated data", async ({
  page,
}) => {
  const useFakeData = page.getByRole("button", { name: "Use fake data" });
  const useApiData = page.getByRole("button", { name: "Use API data" });
  const badge = page.locator(".simulated-badge");
  // Unassigned rows share an "Open" label, so find one by its simulated condition.
  const simulated = page
    .locator("tbody tr")
    .filter({ hasText: unassigned.condition })
    .filter({ hasText: "PENDING ASSIGNMENT" })
    .filter({ hasNotText: "Returned to requestor" })
    .getByRole("button", { name: "Open unassigned request" });

  await page.goto("/");
  await expect(useFakeData).toHaveAttribute("aria-pressed", "false");
  await expect(badge).toBeHidden();
  await expect(page.locator("#identity option:checked")).toHaveText(
    /Jordan Lee/,
  );
  await expect(simulated).toHaveCount(0);

  await useFakeData.click();
  await expect(badge).toHaveText("SIMULATED DATA");
  await expect(useApiData).toHaveAttribute("aria-pressed", "true");
  await expect(simulated.first()).toBeVisible();

  await page.reload();
  await expect(badge).toBeVisible();
  await expect(simulated.first()).toBeVisible();

  await page.getByLabel("Demo identity").selectOption("supervisor");
  await expect(page.locator("#identity option:checked")).toHaveText(
    /Casey Rivera/,
  );
  await expect(badge).toBeVisible();
  await simulated.first().click();
  await page.getByRole("button", { name: "Delete request" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete request" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(READ_ONLY_MESSAGE);
  await page.keyboard.press("Escape");

  await useApiData.click();
  await expect(badge).toBeHidden();
  await expect(useFakeData).toBeVisible();
  await expect(simulated).toHaveCount(0);
  await expect(page.locator("#identity option:checked")).toHaveText(
    /Casey Rivera/,
  );
});

test("inserts templates and historical matches into a simulated draft", async ({
  page,
}) => {
  const draft = records.find(
    (r) =>
      r.status === "In Process" &&
      r.site === "Bangor" &&
      r.engineerId === "engineer",
  )!;

  await page.goto("/");
  await page.getByRole("button", { name: "Use fake data" }).click();
  await expect(page.locator(".simulated-badge")).toBeVisible();
  await page.getByLabel("Search requests").fill(draft.serial!);
  await page.getByRole("button", { name: `Open ${draft.serial}` }).click();
  await page.getByRole("tab", { name: "Resolution", exact: true }).click();

  await page.getByRole("button", { name: "Insert template" }).click();
  const templates = page
    .getByRole("dialog")
    .getByRole("button", { name: "Insert template" });
  await expect(templates).toHaveCount(3);
  await templates.first().click();
  await expect(page.getByLabel("Resolution", { exact: true })).toContainText(
    "Isolate the affected component",
  );

  await page.getByRole("button", { name: "Summarize & search" }).click();
  await page.getByRole("button", { name: "Use in draft" }).first().click();
  await expect(
    page.getByRole("status").filter({ hasText: "Historical text inserted" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(READ_ONLY_MESSAGE);
});

test("stays on simulated data when the API cannot be reached", async ({
  page,
}) => {
  await page.route("**/api/demo/users", async (route) => {
    if (new URL(route.request().url()).pathname.startsWith("/__simulated"))
      return route.fallback();
    await route.fulfill({ status: 503, json: { error: "unavailable" } });
  });

  await page.goto("/");
  await expect(page.getByText("Unable to connect to demo API.")).toBeVisible();
  await page.getByRole("button", { name: "Use fake data" }).click();
  await expect(page.locator(".simulated-badge")).toBeVisible();
  await expect(page.getByText("Unable to connect to demo API.")).toBeHidden();
  await expect(page.locator("#identity option:checked")).toHaveText(
    /Jordan Lee/,
  );

  await page.getByRole("button", { name: "Use API data" }).click();
  await expect(page.getByText("Unable to connect to demo API.")).toBeVisible();
  await expect(page.locator(".simulated-badge")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use API data" }),
  ).toBeEnabled();
});

test("answers the assistant chat on simulated data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use fake data" }).click();
  await page.getByLabel("Filter by status").selectOption("In Process");
  await page.locator("tbody tr button.record-link").first().click();
  await page.getByRole("tab", { name: "Resolution", exact: true }).click();
  const message = page.locator(".chat textarea");
  await message.fill("What should I check first?");
  await message.press("Enter");
  // The dev-server plugin must pass the chat body through to the handler.
  await expect(page.locator(".chat")).toContainText("Simulated assistant");
  await expect(page.locator(".chat")).toContainText(
    "What should I check first?",
  );
  await expect(page.locator(".alert.error")).toHaveCount(0);
});
