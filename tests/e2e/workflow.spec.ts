import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const selectRole = async (page: Page, id: string, name: string) => {
  await page.getByLabel("Demo identity").selectOption(id);
  await expect(page.locator(".profile")).toContainText(name);
};
/** The API ships without records, so each test creates what it uses. */
const createRequest = async (page: Page, title: string) => {
  await selectRole(page, "requestor", "Alex Morgan");
  await page.getByRole("button", { name: "New request", exact: false }).click();
  await page.getByLabel("Request title").fill(title);
  await page.getByLabel("Job Control Number").fill("JCN-260184");
  await page.getByRole("button", { name: "Import LDS" }).click();
  await expect(page.locator(".lds-result")).toContainText("ASW-P-02");
  await page.getByLabel("References", { exact: true }).fill("SYNTHETIC-REF-1");
  await page
    .getByLabel("Condition / finding", { exact: true })
    .fill("Uneven wear on seawater pump coupling face during inspection.");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
};
/** Runs record actions directly against the API to set up state for a UI test. */
const apiAs = async (page: Page, userId: string) => {
  const session = await page.request.post("/api/demo/session", {
    data: { userId },
  });
  const { token } = await session.json();
  return async (path: string, data: object = {}) => {
    const response = await page.request.post(`/api${path}`, {
      data,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok(), `POST ${path}`).toBe(true);
    return response.json();
  };
};
const submitRequest = async (page: Page, title: string, condition: string) => {
  const asRequestor = await apiAs(page, "requestor");
  const { id } = await asRequestor("/records", {
    title,
    name: "Alex Morgan",
    shop: "31",
    phone: "555-0131",
    references: "SYNTHETIC-REF-2",
    condition,
    jcn: "N/A",
  });
  const asSupervisor = await apiAs(page, "supervisor");
  await asSupervisor(`/records/${id}/assign`, { engineerId: "engineer" });
  return { id, asSupervisor };
};
const confirm = async (page: Page) => {
  await page
    .getByRole("button", { name: "Confirm & sign", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
};
test("request → assignment → resolution → approval → shop → division → revision", async ({
  page,
}) => {
  await page.goto("/");
  await selectRole(page, "requestor", "Alex Morgan");
  await page.getByRole("button", { name: "New request", exact: false }).click();
  await page.getByLabel("Request title").fill("E2E coupling inspection");
  await page.getByLabel("Job Control Number").fill("JCN-260184");
  await page.getByRole("button", { name: "Import LDS" }).click();
  await expect(page.locator(".lds-result")).toContainText("ASW-P-02");
  await page
    .getByLabel("References", { exact: true })
    .fill("SYNTHETIC-DRAWING-42");
  await page
    .getByLabel("Condition / finding", { exact: true })
    .fill("Uneven wear on seawater pump coupling face during inspection.");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(
    page.getByRole("heading", { name: "E2E coupling inspection" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Files" }).click();
  await page.getByLabel("Upload supporting file").setInputFiles({
    name: "inspection.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Synthetic inspection record"),
  });
  await expect(page.locator(".file-row")).toContainText("inspection.txt");
  await selectRole(page, "supervisor", "Casey Rivera");
  await page.getByRole("button", { name: "Assign engineer" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".detail-meta")).toContainText("In Process");
  await selectRole(page, "engineer", "Jordan Lee");
  await page.getByRole("tab", { name: "Resolution", exact: true }).click();
  await page.getByRole("button", { name: "Summarize & search" }).click();
  await expect(
    page.getByRole("heading", { name: "Conceptual summary" }),
  ).toBeVisible();
  await page
    .getByLabel("Resolution", { exact: true })
    .fill("Inspect and restore the coupling face.");
  await page
    .getByLabel("Engineering rationale", { exact: true })
    .fill("Restoration meets the cited acceptance criteria.");
  await page.getByLabel("1. DFS Required?").selectOption("yes");
  await page.getByLabel("DFS reference / document number").fill("DFS-E2E-001");
  await page.getByLabel("2. TVD Required?").selectOption("no");
  await page.getByLabel("SUBSAFE", { exact: true }).check();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Changes saved");
  await page
    .getByRole("button", { name: "Sign & submit for approval" })
    .click();
  await confirm(page);
  await expect(page.locator(".detail-meta")).toContainText("Awaiting Approval");
  await selectRole(page, "supervisor", "Casey Rivera");
  await page.getByRole("button", { name: "Approve & issue ESR" }).click();
  await confirm(page);
  await expect(page.locator(".detail-meta")).toContainText("ESR Issued");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const download = await downloadPromise;
  await download.saveAs("artifacts/e2e-approved.pdf");
  expect(download.suggestedFilename()).toMatch(/ESR-\d{6}[A-Z]{1,2}\.pdf/);
  await selectRole(page, "shop", "Taylor Brooks");
  await page.getByRole("button", { name: "Record shop completion" }).click();
  await page.getByLabel("Completion status").selectOption("Deferred");
  await page
    .getByLabel("Block 26 explanation")
    .fill("Awaiting replacement component.");
  await confirm(page);
  await expect(page.locator(".detail-meta")).toContainText(
    "ESR Issued – Deferred",
  );
  await selectRole(page, "division", "Sam Chen");
  await page.getByRole("button", { name: "Review & close ESR" }).click();
  await page.getByLabel("I acknowledge the deferred disposition").check();
  await confirm(page);
  await expect(page.locator(".detail-meta")).toContainText("ESR Closed");
  await selectRole(page, "engineer", "Jordan Lee");
  await page.getByRole("button", { name: "New revision" }).click();
  await page
    .getByLabel("Reason for revision")
    .fill("Update restoration sequence");
  await page
    .getByRole("button", { name: "Create revision", exact: true })
    .click();
  await expect(page.locator(".detail-meta")).toContainText("In Process");
  await page.getByRole("tab", { name: "Revisions" }).click();
  await page.getByRole("button", { name: "View snapshot" }).click();
  await expect(page.getByText("Viewing immutable revision")).toBeVisible();
  await expect(page.locator(".detail-meta")).toContainText("ESR Closed");
});
test("workspace search, template library and mobile layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Service requests" }),
  ).toBeVisible();
  const title = `E2E searchable request ${Date.now()}`;
  await createRequest(page, title);
  await page.getByRole("button", { name: "All requests" }).click();
  await page.getByLabel("Search requests").fill(title);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Template library" }).click();
  await expect(page.locator(".template-card")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "All requests" }).click();
  await expect(
    page.getByRole("heading", { name: "Service requests" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("cross-facility review allows comments but no engineering actions", async ({
  page,
}) => {
  await page.goto("/");
  const title = `E2E cross-facility request ${Date.now()}`;
  await createRequest(page, title);
  await selectRole(page, "admin", "Drew Ellis");
  await page.getByRole("button", { name: "Permissions", exact: false }).click();
  await page.getByLabel("Access to the other TRF").selectOption("review");
  await page.getByRole("button", { name: "Save permissions" }).click();
  await expect(page.getByRole("status")).toContainText("Permissions updated");
  await selectRole(page, "remote", "Riley Parker");
  await page.getByRole("button", { name: "All requests" }).click();
  await page.getByRole("button", { name: `Open ${title}` }).click();
  await expect(page.getByText("Cross-facility review access")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign & submit for approval" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Activity" }).click();
  await page
    .getByLabel("Add a comment")
    .fill("Cross-facility technical review complete.");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.locator(".comment")).toContainText("Riley Parker");
});
test("a closed record's resolution can be inserted into a new draft", async ({
  page,
}) => {
  const condition = "Bearing housing vibration exceeded acceptance limits.";
  const resolution = "Replace the bearing housing per the approved procedure.";
  const stamp = Date.now();
  const title = `E2E open bearing request ${stamp}`;

  await page.goto("/");
  const closed = await submitRequest(
    page,
    `E2E closed bearing request ${stamp}`,
    condition,
  );
  const asEngineer = await apiAs(page, "engineer");
  await asEngineer(`/records/${closed.id}/draft`, {
    resolution,
    rationale: "The replacement restores the design tolerance.",
    dfs: "no",
    tvd: "no",
    attributes: [],
  });
  await asEngineer(`/records/${closed.id}/resolve`);
  await closed.asSupervisor(`/records/${closed.id}/approve`);
  const asShop = await apiAs(page, "shop");
  await asShop(`/records/${closed.id}/complete`, {
    status: "Completed",
    shop: "31",
  });
  const asDivision = await apiAs(page, "division");
  await asDivision(`/records/${closed.id}/close`);
  await submitRequest(page, title, condition);

  await page.reload();
  await page.getByRole("button", { name: `Open ${title}` }).click();
  await page.getByRole("tab", { name: "Resolution", exact: true }).click();
  await page.getByRole("button", { name: "Summarize & search" }).click();
  await page.getByRole("button", { name: "Use in draft" }).first().click();
  await expect(page.getByRole("status")).toContainText(
    "Historical text inserted",
  );
  await expect(page.getByLabel("Resolution", { exact: true })).toHaveValue(
    resolution,
  );
});
