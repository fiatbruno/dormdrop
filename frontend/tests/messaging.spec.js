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
