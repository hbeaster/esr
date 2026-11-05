import { test, expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

/** Pick a demo identity in the host and wait for its bootstrap. */
const selectRole = async (page: Page, id: string, name: string) => {
  const loaded = page.waitForResponse(
    async (response) =>
      response.url().endsWith("/api/bootstrap") &&
      response.ok() &&
      (await response.json()).user.name === name,
  );
  await page.getByLabel("Demo identity").selectOption(id);
  await loaded;
  await expect(page.locator("esr-workspace .app")).toHaveAttribute(
    "aria-busy",
    "false",
  );
};
const apiAs = async (request: APIRequestContext, userId: string) => {
  const session = await request.post("/api/demo/session", {
    data: { userId },
  });
  const { token } = await session.json();
  return async (path: string, data: object = {}) => {
    const response = await request.post(`/api${path}`, {
      data,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok(), `POST ${path}`).toBe(true);
    return response.json();
  };
};

test("a change in one window reaches another live, with presence", async ({
  browser,
  request,
}) => {
  // Set up a record awaiting approval through the API.
  const asRequestor = await apiAs(request, "requestor");
  const { id } = await asRequestor("/records", {
    name: "Alex Morgan",
    shop: "31",
    phone: "555-0131",
    references: "SYNTHETIC-LIVE-1",
    condition: "Live push demo coupling wear.",
    jcn: "N/A",
  });
  const asSupervisor = await apiAs(request, "supervisor");
  const { serial } = await asSupervisor(`/records/${id}/assign`, {
    engineerId: "engineer",
  });
  const asEngineer = await apiAs(request, "engineer");
  await asEngineer(`/records/${id}/draft`, {
    resolution: "Restore the coupling face.",
    rationale: "Meets acceptance criteria.",
    dfs: "no",
    dfsReference: "",
    tvd: "no",
    tvdReference: "",
    attributes: [],
  });
  await asEngineer(`/records/${id}/resolve`, {});

  const engineerWindow = await (await browser.newContext()).newPage();
  const supervisorWindow = await (await browser.newContext()).newPage();
  for (const page of [engineerWindow, supervisorWindow]) await page.goto("/");
  await selectRole(engineerWindow, "engineer", "Jordan Lee");
  await selectRole(supervisorWindow, "supervisor", "Casey Rivera");
  for (const page of [engineerWindow, supervisorWindow]) {
    await expect(page.locator("esr-workspace .live-dot")).toHaveClass(/live/);
    await page.getByRole("button", { name: `Open ${serial}` }).click();
  }

  // Each window sees the other person on the record.
  await expect(
    engineerWindow.getByText("Casey Rivera is viewing"),
  ).toBeVisible();
  await expect(
    supervisorWindow.getByText("Jordan Lee is viewing"),
  ).toBeVisible();

  // The supervisor approves; the engineer's window updates without a reload.
  await supervisorWindow
    .getByRole("button", { name: "Approve & issue ESR" })
    .click();
  await supervisorWindow
    .getByRole("button", { name: "Confirm & sign", exact: true })
    .click();
  await expect(engineerWindow.locator(".record-stamp")).toContainText(
    "ESR Issued",
  );
  await expect(engineerWindow.locator(".detail-meta")).toContainText(
    "ESR Issued",
  );
  await expect(engineerWindow.getByRole("status")).toContainText(
    "Casey Rivera approved this record.",
  );

  // On the watch floor, a pushed change arrives as a toast.
  await engineerWindow
    .getByRole("button", { name: /Back to requests/ })
    .click();
  await engineerWindow.getByRole("button", { name: "Watch floor" }).click();
  const floor = engineerWindow.getByRole("dialog", { name: "ESR watch floor" });
  await expect(floor.locator(".wf-link.live")).toHaveText("Live");
  await asSupervisor(`/records/${id}/comment`, { text: "Shop notified." });
  await expect(floor.locator(".wf-toast")).toContainText(
    `Casey Rivera commented on ${serial}`,
  );
});
