// @ts-check
import { test, expect } from "@playwright/test";

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
