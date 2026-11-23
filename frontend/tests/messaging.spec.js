// @ts-check
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/users/me", (route) =>
    route.fulfill({ json: { capabilities: [] } }),
  );
});

async function openReportableConversation(
  page,
  { reportedMessageIds = [], submitStatus = 201 } = {},
) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  await page.addInitScript(
    (token) => localStorage.setItem("token", token),
    `test.${payload}.signature`,
  );
  const sentAt = new Date().toISOString();
  const message = {
    id: "incoming-message",
    senderId: "seller-1",
    content: "Message from the other participant",
    sentAt,
    readAt: sentAt,
  };
  const ownMessage = {
    id: "own-message",
    senderId: "buyer-1",
    content: "Message written by me",
    sentAt,
    readAt: sentAt,
  };
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
            title: "Test listing",
            price: 20,
            listingType: "For sale",
            status: "AVAILABLE",
          },
          lastMessagePreview: message.content,
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
          title: "Test listing",
          price: 20,
          listingType: "For sale",
          status: "AVAILABLE",
        },
      },
    }),
  );
  await page.route("**/api/v1/conversations/conversation-1/messages", (route) =>
    route.fulfill({ json: [message, ownMessage] }),
  );
  await page.route(
    "**/api/v1/conversations/conversation-1/message-reports/mine",
    (route) => route.fulfill({ json: reportedMessageIds }),
  );
  await page.route(
    "**/api/v1/conversations/conversation-1/messages/incoming-message/reports",
    (route) =>
      route.fulfill({
        status: submitStatus,
        json:
          submitStatus === 201
            ? { id: "report-1", status: "OPEN", createdAt: sentAt }
            : { message: "You have already reported this message." },
      }),
  );
  await page.goto("/messages/conversation-1");
  await expect(
    page.locator(".messages-thread").getByText(message.content),
  ).toBeVisible();
  await expect(
    page.locator(".messages-thread").getByText(ownMessage.content),
  ).toBeVisible();
}

test("notification bell combines unread messages with offer notifications", async ({ page }) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  await page.addInitScript((token) => localStorage.setItem("token", token), `test.${payload}.signature`);
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 1 } }),
  );
  let unread = 3;
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({ json: [{ id: "conversation-1", unreadCount: unread }] }),
  );
  await page.route("**/api/v1/home", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/favorites", (route) => route.fulfill({ json: [] }));
  await page.goto("/home");
  await expect(page.getByRole("button", { name: "Notifications, 4 unread" })).toBeVisible();
  unread = 0;
  await page.evaluate(() => globalThis.dispatchEvent(new Event("dormdrop:messages-updated")));
  await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
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
  await page.route(
    "**/api/v1/conversations/conversation-1/message-reports/mine",
    (route) => route.fulfill({ json: [] }),
  );

  await page.goto("/messages/conversation-1");

  const acceptedCard = page.getByRole("article", { name: "Offer accepted" });
  await expect(acceptedCard).toBeVisible();
  await expect(acceptedCard.getByText("$110.00", { exact: true })).toBeVisible();
  await expect(acceptedCard.getByText(/Listing price \$120/)).toBeVisible();
  await expect(acceptedCard.getByText(/You and Alex Morgan agreed/)).toBeVisible();

  await acceptedCard.getByRole("button", { name: "Proposed pickup" }).click();
  await expect(page.getByPlaceholder("Write a message…")).toBeFocused();
});

test("a participant cannot report their own message", async ({
  page,
}) => {
  await openReportableConversation(page);
  await expect(
    page.locator(".messages-message-row.incoming").getByRole("button", {
      name: "Report message",
    }),
  ).toBeVisible();
  await expect(
    page.locator(".messages-message-row.outgoing").getByRole("button"),
  ).toHaveCount(0);
});

test("the report action is hidden for a message already reported by this user", async ({
  page,
}) => {
  await openReportableConversation(page, {
    reportedMessageIds: ["incoming-message"],
  });
  await expect(
    page.getByRole("button", { name: "Report message" }),
  ).toHaveCount(0);
});

test("a report needs a reason and displays duplicate-submission errors", async ({
  page,
}) => {
  await openReportableConversation(page, { submitStatus: 409 });
  await page.getByRole("button", { name: "Report message" }).click();

  const dialog = page.getByRole("dialog", { name: "Report a message" });
  const formBounds = await dialog.boundingBox();
  expect(formBounds?.width).toBeLessThanOrEqual(640);
  const submit = dialog.getByRole("button", { name: "Submit report" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Select a reason and explain what happened",
  );
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("combobox").selectOption("Scam or fraud");
  await submit.click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Enter what happened before submitting.",
  );
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByLabel("What happened? *").fill("The message requests money before pickup.");
  await submit.click();

  await expect(
    dialog.getByRole("alert").getByText("You have already reported this message."),
  ).toBeVisible();
});

test("a successful message report shows a compact confirmation", async ({
  page,
}) => {
  await openReportableConversation(page);
  await page.getByRole("button", { name: "Report message" }).click();

  const dialog = page.getByRole("dialog", { name: "Report a message" });
  await dialog.getByRole("combobox").selectOption("Spam");
  await dialog.getByLabel("What happened? *").fill("Repeated unsolicited messages.");
  await dialog.getByRole("button", { name: "Submit report" }).click();

  const confirmation = page.getByRole("dialog", { name: "Report submitted" });
  await expect(confirmation).toBeVisible();
  const bounds = await confirmation.boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(560);
});
