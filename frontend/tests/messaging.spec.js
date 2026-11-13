// @ts-check
import { test, expect } from "@playwright/test";

test("navigation shows unread messages separately from offer notifications", async ({ page }) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  await page.addInitScript((token) => localStorage.setItem("token", token), `test.${payload}.signature`);
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  let unread = 3;
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({ json: [{ id: "conversation-1", unreadCount: unread }] }),
  );
  await page.route("**/api/v1/home", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/favorites", (route) => route.fulfill({ json: [] }));
  await page.goto("/home");
  const messages = page.getByRole("link", { name: /Messages/ });
  await expect(messages.getByLabel("3 unread messages")).toBeVisible();
  unread = 0;
  await page.evaluate(() => globalThis.dispatchEvent(new Event("dormdrop:messages-updated")));
  await expect(messages.getByLabel("3 unread messages")).toHaveCount(0);
});

test("accepted offer appears as a pickup card in the conversation", async ({
  page,
}) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  await page.addInitScript((token) => {
    localStorage.setItem("token", token);
  }, `test.${payload}.signature`);

  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({
      json: [
        {
          id: "conversation-1",
          participant: { name: "Alex Morgan", emailVerified: true },
          listing: {
            id: "listing-1",
            title: "Sony WH-1000XM4 Headphones",
            price: 120,
            listingType: "For sale",
            status: "AVAILABLE",
          },
          lastMessagePreview: "Offer accepted",
          unreadCount: 0,
        },
      ],
    }),
  );
  await page.route("**/api/v1/conversations/conversation-1", (route) =>
    route.fulfill({
      json: {
        id: "conversation-1",
        currentUserId: "buyer-1",
        participant: { name: "Alex Morgan", emailVerified: true },
        listing: {
          id: "listing-1",
          title: "Sony WH-1000XM4 Headphones",
          price: 120,
          listingType: "For sale",
          status: "AVAILABLE",
        },
        offer: { id: "offer-1", amount: 110, status: "ACCEPTED" },
      },
    }),
  );
  await page.route("**/api/v1/conversations/conversation-1/messages", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.goto("/messages/conversation-1");

  const acceptedCard = page.getByRole("article", { name: "Offer accepted" });
  await expect(acceptedCard).toBeVisible();
  await expect(acceptedCard.getByText("$110.00", { exact: true })).toBeVisible();
  await expect(acceptedCard.getByText(/Listing price \$120/)).toBeVisible();
  await expect(acceptedCard.getByText(/You and Alex Morgan agreed/)).toBeVisible();

  await acceptedCard.getByRole("button", { name: "Arrange pickup" }).click();
  await expect(page.getByPlaceholder("Write a message…")).toBeFocused();
});

test("a message report requires a reason and shows submission confirmation", async ({
  page,
}) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  await page.addInitScript((token) => localStorage.setItem("token", token), `test.${payload}.signature`);
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({
      json: [{
        id: "conversation-1",
        participant: { name: "Alex Morgan", emailVerified: true },
        listing: { id: "listing-1", title: "Headphones", price: 120, listingType: "For sale", status: "AVAILABLE" },
        lastMessagePreview: "Please pay outside the app",
        unreadCount: 0,
      }],
    }),
  );
  await page.route("**/api/v1/conversations/conversation-1", (route) =>
    route.fulfill({
      json: {
        id: "conversation-1",
        currentUserId: "buyer-1",
        participant: { name: "Alex Morgan", emailVerified: true },
        listing: { id: "listing-1", title: "Headphones", price: 120, listingType: "For sale", status: "AVAILABLE" },
      },
    }),
  );
  await page.route("**/api/v1/conversations/conversation-1/messages", (route) =>
    route.fulfill({
      json: [{
        id: "message-1",
        senderId: "seller-1",
        content: "Please pay outside the app",
        sentAt: new Date().toISOString(),
      }],
    }),
  );
  let submittedReport;
  await page.route(
    "**/api/v1/conversations/conversation-1/messages/message-1/reports",
    async (route) => {
      submittedReport = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { id: "report-1", status: "OPEN", createdAt: new Date().toISOString() },
      });
    },
  );

  await page.goto("/messages/conversation-1");
  await page.getByRole("button", { name: "Report message from Alex Morgan" }).click();
  const dialog = page.getByRole("dialog", { name: "Report a message" });
  const submit = dialog.getByRole("button", { name: "Submit report" });
  await expect(submit).toBeDisabled();
  await expect(dialog.getByLabel("Reason")).toBeVisible();
  await dialog.getByLabel("Reason").selectOption("Scam or fraud");
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole("dialog", { name: "Report submitted" })).toBeVisible();
  expect(submittedReport).toEqual({ reason: "Scam or fraud" });
});

test("an administrator can review message report context", async ({ page }) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  await page.addInitScript((token) => localStorage.setItem("token", token), `test.${payload}.signature`);
  await page.route("**/api/v1/users/me", (route) =>
    route.fulfill({ json: { id: "admin-1", capabilities: ["VIEW_MEMBER_DIRECTORY"] } }),
  );
  await page.route("**/api/v1/admin/message-reports", (route) =>
    route.fulfill({
      json: [{
        id: "report-1",
        conversationId: "conversation-1",
        listingId: "listing-1",
        listingTitle: "Headphones",
        messageId: "message-1",
        messageContent: "Please pay outside the app",
        messageSentAt: "2026-11-12T20:00:00Z",
        senderName: "Alex Morgan",
        senderEmail: "alex@example.edu",
        reporterName: "Jamie Lee",
        reporterEmail: "jamie@example.edu",
        reason: "Scam or fraud",
        details: "They requested payment off platform.",
        createdAt: "2026-11-12T20:01:00Z",
        status: "OPEN",
        conversationContext: [
          { messageId: "message-0", senderName: "Jamie Lee", content: "Is the item available?", sentAt: "2026-11-12T19:59:00Z" },
          { messageId: "message-1", senderName: "Alex Morgan", content: "Please pay outside the app", sentAt: "2026-11-12T20:00:00Z" },
        ],
      }],
    }),
  );

  await page.goto("/admin/message-reports");
  await expect(page.getByRole("heading", { name: "Review message reports" })).toBeVisible();
  await expect(page.getByText("Please pay outside the app", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Is the item available?", { exact: true })).toBeVisible();
  await expect(page.getByText("Jamie Lee", { exact: true }).first()).toBeVisible();
});

test("non-administrators cannot view message reports", async ({ page }) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  await page.addInitScript((token) => localStorage.setItem("token", token), `test.${payload}.signature`);
  await page.route("**/api/v1/users/me", (route) =>
    route.fulfill({ json: { id: "student-1", capabilities: ["MARKETPLACE"] } }),
  );
  let queueRequested = false;
  await page.route("**/api/v1/admin/message-reports", (route) => {
    queueRequested = true;
    return route.fulfill({ json: [] });
  });

  await page.goto("/admin/message-reports");
  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  expect(queueRequested).toBe(false);
});
