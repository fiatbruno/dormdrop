// @ts-check
import { expect, test } from "@playwright/test";

const listing = {
  id: "listing-1",
  ownerId: "seller-1",
  title: "Used desk",
  price: 90,
  status: "AVAILABLE",
  listingType: "For sale",
};

const offer = {
  id: "offer-1",
  listingId: listing.id,
  buyerId: "buyer-1",
  sellerId: "seller-1",
  currentProposerId: "buyer-1",
  amount: 73.5,
  listingPrice: listing.price,
  status: "PENDING",
  version: 0,
  createdAt: "2026-11-04T20:00:00Z",
  expiresAt: "2026-11-18T20:00:00Z",
};

async function preparePage(page) {
  const tokenPayload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      id: "buyer-1",
    }),
  ).toString("base64url");
  await page.addInitScript(
    (token) => localStorage.setItem("token", token),
    `test.${tokenPayload}.signature`,
  );
  await page.route("**/api/v1/admin/users**", (route) =>
    route.fulfill({ status: 403, json: { message: "Not an administrator" } }),
  );
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/v1/me/notifications**", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/api/v1/home**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/listing-1")) {
      return route.fulfill({ json: listing });
    }
    return route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/favorites", (route) =>
    route.fulfill({ json: [] }),
  );
}

async function mockConversation(page, onStart) {
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() === "POST") {
      await onStart(route);
      return;
    }
    return route.fulfill({
      json: [
        {
          id: "conversation-1",
          participant: {
            id: "seller-1",
            name: "Sam Seller",
            emailVerified: true,
          },
          listing,
          unreadCount: 0,
        },
      ],
    });
  });
  await page.route("**/api/v1/conversations/conversation-1", (route) =>
    route.fulfill({
      json: {
        id: "conversation-1",
        currentUserId: "buyer-1",
        participant: {
          id: "seller-1",
          name: "Sam Seller",
          emailVerified: true,
        },
        listing,
        offer,
      },
    }),
  );
  await page.route("**/api/v1/conversations/conversation-1/messages", (route) =>
    route.fulfill({ json: [] }),
  );
}

test("submitting a listing offer opens its conversation with the offer in the message thread", async ({
  page,
}) => {
  await preparePage(page);
  let offerRequests = 0;
  let idempotencyKey;
  await page.route("**/api/v1/home/listing-1/offers", async (route) => {
    offerRequests += 1;
    idempotencyKey = route.request().headers()["idempotency-key"];
    expect(route.request().postDataJSON()).toEqual({ amount: 73.5 });
    await route.fulfill({ status: 201, json: offer });
  });

  let startRequestBody;
  await mockConversation(page, async (route) => {
    startRequestBody = route.request().postDataJSON();
    await route.fulfill({
      json: { id: "conversation-1", listing, offer },
    });
  });

  await page.goto("/items/listing-1");
  await page.getByRole("button", { name: "Make an offer" }).click();
  await page.getByLabel("Your offer price").fill("73.50");
  await page.getByRole("button", { name: "Submit offer" }).click();

  await expect(page).toHaveURL("/messages/conversation-1");
  const thread = page.getByLabel("Message history");
  await expect(thread.getByText("PENDING", { exact: true })).toBeVisible();
  await expect(thread.getByText("Current proposal: $73.50")).toBeVisible();
  await expect(
    thread.getByText("Waiting for the other participant to respond to your proposal."),
  ).toBeVisible();
  expect(offerRequests).toBe(1);
  expect(idempotencyKey).toBeTruthy();
  expect(startRequestBody).toEqual({ listingId: "listing-1" });
});

test("a conversation retry after offer submission does not submit the offer twice", async ({
  page,
}) => {
  await preparePage(page);
  let offerRequests = 0;
  await page.route("**/api/v1/home/listing-1/offers", async (route) => {
    offerRequests += 1;
    await route.fulfill({ status: 201, json: offer });
  });

  let conversationAttempts = 0;
  await mockConversation(page, async (route) => {
    conversationAttempts += 1;
    if (conversationAttempts === 1) {
      await route.fulfill({
        status: 503,
        json: { message: "Conversation service unavailable" },
      });
      return;
    }
    await route.fulfill({
      json: { id: "conversation-1", listing, offer },
    });
  });

  await page.goto("/items/listing-1");
  await page.getByRole("button", { name: "Make an offer" }).click();
  await page.getByLabel("Your offer price").fill("73.50");
  await page.getByRole("button", { name: "Submit offer" }).click();
  await expect(
    page.getByRole("alert"),
  ).toHaveText(/offer is saved, but its conversation could not be opened/i);
  await page.getByRole("button", { name: "Open conversation" }).click();

  await expect(page).toHaveURL("/messages/conversation-1");
  await expect(
    page.getByLabel("Message history").getByText("PENDING", { exact: true }),
  ).toBeVisible();
  expect(offerRequests).toBe(1);
  expect(conversationAttempts).toBe(2);
});

test("the seller cannot offer on their own listing", async ({ page }) => {
  await preparePage(page);
  await page.route("**/api/v1/home/listing-1", (route) =>
    route.fulfill({ json: { ...listing, ownerId: "buyer-1" } }),
  );
  await page.goto("/items/listing-1");
  await expect(page.getByRole("button", { name: "Make an offer" })).toHaveCount(0);
  await expect(page.getByText("Other users can make an offer on this listing.")).toBeVisible();
});

test("offers are not available for free listings", async ({ page }) => {
  await preparePage(page);
  await page.route("**/api/v1/home/listing-1", (route) =>
    route.fulfill({ json: { ...listing, listingType: "Free / Donate", price: 0 } }),
  );
  await page.goto("/items/listing-1");
  await expect(page.getByRole("heading", { name: listing.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Make an offer" })).toHaveCount(0);
});
