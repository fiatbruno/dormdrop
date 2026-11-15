// @ts-check
import { expect, test } from "@playwright/test";

const makeToken = (userId) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, id: userId }),
  ).toString("base64url");
  return `test.${payload}.signature`;
};

const listing = {
  id: "listing-1",
  ownerId: "seller-1",
  title: "Used desk",
  price: 90,
  status: "AVAILABLE",
  listingType: "For Sale",
};

const makeOffer = (overrides = {}) => ({
  id: "offer-1",
  listingId: listing.id,
  buyerId: "buyer-1",
  sellerId: "seller-1",
  currentProposerId: "buyer-1",
  amount: 60,
  status: "PENDING",
  version: 0,
  expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  history: [
    {
      action: "PROPOSED",
      actorId: "buyer-1",
      amount: 60,
      createdAt: "2026-11-02T18:00:00Z",
    },
  ],
  ...overrides,
});

async function openMessageOffer(page, userId, offer) {
  await page.addInitScript((token) => localStorage.setItem("token", token), makeToken(userId));
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({
      json: [
        {
          id: "conversation-1",
          participant: {
            id: userId === "buyer-1" ? "seller-1" : "buyer-1",
            name: userId === "buyer-1" ? "Sam Seller" : "Bailey Buyer",
            emailVerified: true,
          },
          listing,
          unreadCount: 0,
        },
      ],
    }),
  );
  await page.route("**/api/v1/conversations/conversation-1", (route) =>
    route.fulfill({
      json: {
        id: "conversation-1",
        currentUserId: userId,
        participant: {
          id: userId === "buyer-1" ? "seller-1" : "buyer-1",
          name: userId === "buyer-1" ? "Sam Seller" : "Bailey Buyer",
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
  await page.goto("/messages/conversation-1");
  await expect(page.getByRole("heading", { name: "Offer negotiation" })).toBeVisible();
}

test("seller accepts buyer offer without implying payment or sale", async ({
  page,
}) => {
  const offer = makeOffer();
  let requestBody;
  await page.route("**/api/v1/offers/offer-1/decisions", async (route) => {
    requestBody = route.request().postDataJSON();
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({
      json: {
        ...offer,
        status: "ACCEPTED",
        version: 1,
        history: [
          ...offer.history,
          {
            action: "ACCEPTED",
            actorId: "seller-1",
            amount: 60,
            createdAt: "2026-11-02T18:05:00Z",
          },
        ],
      },
    });
  });
  await openMessageOffer(page, "seller-1", offer);
  await expect(page.getByRole("list", { name: "Offer price history" }).getByText("$60.00")).toBeVisible();
  await page.getByRole("button", { name: "Accept", exact: true }).click();

  await expect(page.getByText("Agreed price: $60.00", { exact: true })).toBeVisible();
  await expect(page.getByText(/agreement only; no payment is taken/i)).toBeVisible();
  const acceptedCard = page.getByRole("article", { name: "Offer accepted" });
  await acceptedCard.getByRole("button", { name: "Proposed pickup" }).click();
  await expect(page.getByPlaceholder("Write a message…")).toBeFocused();
  expect(requestBody).toEqual({ action: "ACCEPT", expectedVersion: 0 });
});

test("an offer notification refreshes an already open conversation", async ({ page }) => {
  const offer = makeOffer();
  await openMessageOffer(page, "buyer-1", offer);
  Object.assign(offer, { amount: 75, currentProposerId: "seller-1", version: 1 });
  await page.evaluate(() => {
    globalThis.dispatchEvent(new CustomEvent("dormdrop:notification-received", {
      detail: { offerId: "offer-1", type: "OFFER_COUNTERED" },
    }));
  });
  await expect(page.getByText("Current proposal: $75.00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toBeEnabled();
});

test("an offer notification refreshes the open offer details page", async ({ page }) => {
  await page.addInitScript((token) => localStorage.setItem("token", token), makeToken("buyer-1"));
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  const offer = makeOffer();
  await page.route("**/api/v1/offers/offer-1", (route) => route.fulfill({ json: offer }));
  await page.route("**/api/v1/home/listing-1", (route) => route.fulfill({ json: listing }));
  await page.goto("/offers/offer-1");
  await expect(page.getByText("Current proposal: $60.00")).toBeVisible();
  Object.assign(offer, { amount: 70, currentProposerId: "seller-1", version: 1 });
  await page.evaluate(() => {
    globalThis.dispatchEvent(new CustomEvent("dormdrop:notification-received", {
      detail: { offerId: "offer-1", type: "OFFER_COUNTERED" },
    }));
  });
  await expect(page.getByText("Current proposal: $70.00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toBeEnabled();
});

test("buyer counters seller proposal with version and idempotency header", async ({
  page,
}) => {
  const offer = makeOffer({
    amount: 70,
    currentProposerId: "seller-1",
    version: 1,
    history: [
      ...makeOffer().history,
      {
        action: "COUNTERED",
        actorId: "seller-1",
        amount: 70,
        createdAt: "2026-11-02T18:02:00Z",
      },
    ],
  });
  let requestBody;
  await page.route("**/api/v1/offers/offer-1/counteroffers", async (route) => {
    requestBody = route.request().postDataJSON();
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({
      json: {
        ...offer,
        amount: 65.5,
        currentProposerId: "buyer-1",
        version: 2,
        history: [
          ...offer.history,
          {
            action: "COUNTERED",
            actorId: "buyer-1",
            amount: 65.5,
            createdAt: "2026-11-02T18:03:00Z",
          },
        ],
      },
    });
  });
  await openMessageOffer(page, "buyer-1", offer);
  const history = page.getByRole("list", { name: "Offer price history" });
  await expect(history.locator("li")).toHaveCount(2);
  await page.getByRole("button", { name: "Counter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send a counteroffer" });
  const amount = dialog.getByLabel("Your counter price");
  await amount.fill("65.25");
  await expect(amount).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Send counteroffer" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(amount).toBeFocused();
  await amount.fill("70.001");
  await expect(dialog.getByRole("button", { name: "Send counteroffer" })).toBeDisabled();
  await amount.fill("70");
  await expect(dialog.getByRole("button", { name: "Send counteroffer" })).toBeDisabled();
  await amount.fill("65.50");
  await dialog.getByRole("button", { name: "Send counteroffer" }).click();

  expect(requestBody).toEqual({ amount: 65.5, expectedVersion: 1 });
  await expect(page.getByText("Current proposal: $65.50")).toBeVisible();
  await expect(page.locator(".offer-negotiation__header p")).toBeFocused();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
});

test("seller and buyer can alternate counters without either responding to their own proposal", async ({
  page,
}) => {
  let offer = makeOffer();
  await page.route("**/api/v1/offers/offer-1/counteroffers", async (route) => {
    const request = route.request().postDataJSON();
    const actorId = offer.currentProposerId === "buyer-1" ? "seller-1" : "buyer-1";
    offer = {
      ...offer,
      amount: request.amount,
      currentProposerId: actorId,
      version: request.expectedVersion + 1,
      history: [
        ...offer.history,
        {
          action: "COUNTERED",
          actorId,
          amount: request.amount,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    await route.fulfill({ json: offer });
  });

  await openMessageOffer(page, "seller-1", offer);
  await page.getByRole("button", { name: "Counter", exact: true }).click();
  const sellerDialog = page.getByRole("dialog", { name: "Send a counteroffer" });
  await sellerDialog.getByLabel("Your counter price").fill("65");
  await sellerDialog.getByRole("button", { name: "Send counteroffer" }).click();
  await expect(page.getByText("Current proposal: $65.00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Counter", exact: true })).toHaveCount(0);

  const buyerPage = await page.context().newPage();
  await buyerPage.route("**/api/v1/offers/offer-1/counteroffers", async (route) => {
    const request = route.request().postDataJSON();
    const actorId =
      offer.currentProposerId === "buyer-1" ? "seller-1" : "buyer-1";
    offer = {
      ...offer,
      amount: request.amount,
      currentProposerId: actorId,
      version: request.expectedVersion + 1,
      history: [
        ...offer.history,
        {
          action: "COUNTERED",
          actorId,
          amount: request.amount,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    await route.fulfill({ json: offer });
  });
  await openMessageOffer(buyerPage, "buyer-1", offer);
  await buyerPage.getByRole("button", { name: "Counter", exact: true }).click();
  const buyerDialog = buyerPage.getByRole("dialog", { name: "Send a counteroffer" });
  await buyerDialog.getByLabel("Your counter price").fill("62");
  await buyerDialog.getByRole("button", { name: "Send counteroffer" }).click();
  await expect(buyerPage.getByText("Current proposal: $62.00")).toBeVisible();
  await expect(
    buyerPage.getByRole("list", { name: "Offer price history" }).locator("li"),
  ).toHaveCount(3);
  await expect(
    buyerPage.getByRole("button", { name: "Accept", exact: true }),
  ).toHaveCount(0);
  await buyerPage.close();
});

test("the responder can reject the latest counteroffer", async ({ page }) => {
  const offer = makeOffer({
    amount: 72,
    currentProposerId: "seller-1",
    version: 2,
    history: [
      ...makeOffer().history,
      { action: "COUNTERED", actorId: "seller-1", amount: 75 },
      { action: "COUNTERED", actorId: "seller-1", amount: 72 },
    ],
  });
  let decision;
  await page.route("**/api/v1/offers/offer-1/decisions", async (route) => {
    decision = route.request().postDataJSON();
    await route.fulfill({
      json: {
        ...offer,
        status: "REJECTED",
        version: 3,
        history: [
          ...offer.history,
          { action: "REJECTED", actorId: "buyer-1", amount: offer.amount },
        ],
      },
    });
  });
  await openMessageOffer(page, "buyer-1", offer);
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByText("Offer rejected at $72.00", { exact: true })).toBeVisible();
  expect(decision).toEqual({ action: "REJECT", expectedVersion: 2 });
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
});

test("recipient refreshes current offer after a stale decision", async ({
  page,
}) => {
  let detailReads = 0;
  const offer = makeOffer({
    amount: 70,
    currentProposerId: "seller-1",
    version: 1,
    history: [
      ...makeOffer().history,
      {
        action: "COUNTERED",
        actorId: "seller-1",
        amount: 70,
        createdAt: "2026-11-02T18:02:00Z",
      },
    ],
  });
  await page.route("**/api/v1/offers/offer-1/decisions", (route) =>
    route.fulfill({ status: 409, json: { message: "Stale version." } }),
  );
  await page.route("**/api/v1/offers/offer-1", (route) => {
    detailReads += 1;
    return route.fulfill({
      json: {
        ...offer,
        amount: 75,
        version: 2,
        history: [
          ...offer.history,
          {
            action: "COUNTERED",
            actorId: "seller-1",
            amount: 75,
            createdAt: "2026-11-02T18:04:00Z",
          },
        ],
      },
    });
  });
  await openMessageOffer(page, "buyer-1", offer);
  await page.getByRole("button", { name: "Accept", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("latest version has been refreshed");
  await expect(page.getByText("Current proposal: $75.00")).toBeVisible();
  expect(detailReads).toBe(1);
});

test("a participant cannot respond to their own current proposal", async ({
  page,
}) => {
  await openMessageOffer(
    page,
    "buyer-1",
    makeOffer({ currentProposerId: "buyer-1" }),
  );
  await expect(
    page.getByText("Waiting for the other participant to respond to your proposal."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Counter", exact: true })).toHaveCount(0);
});

test("expired offers show the backend status and cannot be answered", async ({
  page,
}) => {
  await openMessageOffer(
    page,
    "seller-1",
    makeOffer({
      status: "EXPIRED",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    }),
  );
  await expect(page.getByText("Offer expired at $60.00")).toBeVisible();
  await expect(page.getByText("This offer has expired. No further responses are available.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Counter", exact: true })).toHaveCount(0);
});

test("a pending offer past expiresAt is treated as expired before the next refresh", async ({
  page,
}) => {
  await openMessageOffer(
    page,
    "seller-1",
    makeOffer({ expiresAt: new Date(Date.now() - 60_000).toISOString() }),
  );
  await expect(page.getByText("Offer expired at $60.00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
});

test("a buyer can submit an offer from a listing and land in that listing's conversation", async ({
  page,
}) => {
  await page.addInitScript((token) => localStorage.setItem("token", token), makeToken("buyer-1"));
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/v1/home**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/listing-1")) {
      return route.fulfill({
        json: {
          ...listing,
          listingType: "For sale",
          sellerName: "Sam Seller",
        },
      });
    }
    return route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/favorites", (route) =>
    route.fulfill({ json: [] }),
  );
  let submitRequest;
  await page.route("**/api/v1/home/listing-1/offers", (route) => {
    submitRequest = route.request();
    return route.fulfill({ status: 201, json: makeOffer() });
  });
  let conversationRequest;
  await page.route("**/api/v1/conversations", (route) => {
    if (route.request().method() === "POST") {
      conversationRequest = route.request();
      return route.fulfill({
        json: {
          id: "conversation-1",
          currentUserId: "buyer-1",
          participant: { id: "seller-1", name: "Sam Seller", emailVerified: true },
          listing,
          offer: makeOffer(),
        },
      });
    }
    return route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/conversations/conversation-1", (route) =>
    route.fulfill({
      json: {
        id: "conversation-1",
        currentUserId: "buyer-1",
        participant: { id: "seller-1", name: "Sam Seller", emailVerified: true },
        listing,
        offer: makeOffer(),
      },
    }),
  );
  await page.route("**/api/v1/conversations/conversation-1/messages", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.goto("/items/listing-1");
  await page.getByRole("button", { name: "Make an offer" }).click();
  await page.getByLabel("Your offer price").fill("73.50");
  await page.getByRole("button", { name: "Submit offer" }).click();

  await expect(page).toHaveURL("/messages/conversation-1");
  await expect(page.getByRole("heading", { name: "Offer negotiation" })).toBeVisible();
  expect(submitRequest.postDataJSON()).toEqual({ amount: 73.5 });
  expect(submitRequest.headers()["idempotency-key"]).toBeTruthy();
  expect(conversationRequest.postDataJSON()).toEqual({ listingId: "listing-1" });
});
