// @ts-check
import { test, expect } from "@playwright/test";

test("admin reviews a message report and applies the pictured suspension", async ({ page }) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  await page.addInitScript(
    (token) => localStorage.setItem("token", token),
    `test.${payload}.signature`,
  );
  await page.route("**/api/v1/users/me", (route) =>
    route.fulfill({ json: { capabilities: ["VIEW_MEMBER_DIRECTORY"] } }),
  );

  const report = {
    id: "message-report-1",
    conversationId: "conversation-1",
    listingId: "listing-1",
    listingTitle: "Sony headphones",
    messageId: "message-1",
    messageContent: "Please pay a deposit before pickup.",
    messageSentAt: new Date().toISOString(),
    senderName: "Alex Morgan",
    senderEmail: "alex@example.edu",
    reporterName: "Jamie Lee",
    reporterEmail: "jamie@example.edu",
    reason: "Scam or fraud",
    details: "The sender requested money before an inspection.",
    conversationContext: [
      {
        messageId: "message-1",
        senderName: "Alex Morgan",
        content: "Please pay a deposit before pickup.",
        sentAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    status: "OPEN",
    internalNotes: [],
  };
  await page.route("**/api/v1/admin/message-reports", (route) =>
    route.fulfill({ json: [report] }),
  );

  let submittedRequest;
  await page.route(
    "**/api/v1/admin/message-reports/message-report-1/suspensions",
    async (route) => {
      submittedRequest = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: {
          reportId: report.id,
          status: "SUSPENDED",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          hiddenListings: 3,
        },
      });
    },
  );

  await page.goto("/admin/message-reports/message-report-1");
  await expect(page.getByRole("heading", { name: "Review message report" })).toBeVisible();
  await expect(page.locator(".admin-message-reports__reported-message p")).toContainText(report.messageContent);
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter a decision note before saving.");
  await page.getByRole("button", { name: "Suspend account" }).first().click();

  const dialog = page.getByRole("dialog");
  const formBounds = await dialog.boundingBox();
  expect(formBounds?.width).toBeLessThanOrEqual(560);
  await expect(dialog.getByRole("heading", { name: "Suspend Alex Morgan?" })).toBeVisible();
  await expect(dialog.getByRole("combobox").first()).toHaveValue("7");
  await expect(dialog.getByLabel("Message to the member *")).toHaveValue("");
  await dialog.getByRole("button", { name: "Suspend account" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Complete all required fields before submitting.",
  );
  expect(submittedRequest).toBeUndefined();
  await dialog.getByLabel("Reason *").selectOption("Repeated marketplace policy violations");
  await dialog.getByLabel("Message to the member *").fill(
    "Your account is suspended for 7 days following repeated policy violations. New listings and messages are blocked during this period.",
  );
  await dialog.getByRole("button", { name: "Suspend account" }).click();

  await expect(page.getByText("Account suspended for 7 days. 3 active listings hidden.")).toBeVisible();
  const confirmation = await page.getByRole("dialog").boundingBox();
  expect(confirmation?.width).toBeLessThanOrEqual(460);
  expect(submittedRequest).toMatchObject({
    durationDays: 7,
    policyReason: "Repeated marketplace policy violations",
  });
  expect(submittedRequest.message).toContain("New listings and messages are blocked");
});
