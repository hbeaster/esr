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
  const simulated = page.getByRole("button", {
    name: `Open ${unassigned.title}`,
    exact: true,
  });

  await page.goto("/");
  await expect(useFakeData).toHaveAttribute("aria-pressed", "false");
  await expect(badge).toBeHidden();
  await expect(page.locator(".profile")).toContainText("Jordan Lee");
  await expect(simulated).toHaveCount(0);
  await page.getByRole("button", { name: "Template library" }).click();
  await expect(page.locator(".template-card")).toHaveCount(0);

  await useFakeData.click();
  await expect(badge).toHaveText("SIMULATED DATA");
  await expect(useApiData).toHaveAttribute("aria-pressed", "true");
  await expect(simulated.first()).toBeVisible();
  await page.getByRole("button", { name: "Template library" }).click();
  await expect(page.locator(".template-card")).toHaveCount(3);

  await page.reload();
  await expect(badge).toBeVisible();
  await expect(simulated.first()).toBeVisible();

  await page.getByLabel("Demo identity").selectOption("supervisor");
  await expect(page.locator(".profile")).toContainText("Casey Rivera");
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
  await expect(page.locator(".profile")).toContainText("Casey Rivera");
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
  await expect(page.locator(".profile")).toContainText("Jordan Lee");

  await page.getByRole("button", { name: "Use API data" }).click();
  await expect(page.getByText("Unable to connect to demo API.")).toBeVisible();
  await expect(page.locator(".simulated-badge")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use API data" }),
  ).toBeEnabled();
});
