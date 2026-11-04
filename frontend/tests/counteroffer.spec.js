// @ts-check
import { expect, test } from "@playwright/test";

const initialConversation = (currentUserId, offer) => ({
  id: "conversation-1",
  currentUserId,
  participant: {
    id: currentUserId === "seller-1" ? "buyer-1" : "seller-1",
    name: currentUserId === "seller-1" ? "Jamie" : "Alex",
    emailVerified: true,
  },
  listing: {
    id: "listing-1",
    ownerId: "seller-1",
    title: "Compact Mini Fridge",
    price: 80,
    listingType: "For Sale",
    status: "ACTIVE",
    imageUrl: "",
  },
  offer,
});

const pendingOffer = (overrides = {}) => ({
  id: "offer-1",
  buyerId: "buyer-1",
  amount: 60,
  status: "PENDING",
  version: 0,
  proposerId: "buyer-1",
  proposerRole: "BUYER",
  history: [
    {
      id: "proposal-0",
      amount: 60,
      version: 0,
      proposerId: "buyer-1",
      proposerRole: "BUYER",
    },
  ],
  ...overrides,
});

async function openConversation(page, currentUserId, getConversation) {
  await page.addInitScript(() => {
    const payload = btoa(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    );
    localStorage.setItem("token", `header.${payload}.signature`);
  });
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/conversations/conversation-1/messages", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/conversations/conversation-1", (route) =>
    route.fulfill({
      json: initialConversation(currentUserId, getConversation()),
    }),
  );
  await page.goto("/messages/conversation-1");
  await expect(page.getByRole("heading", { name: "Offer negotiation" })).toBeVisible();
}

test("seller counters the buyer proposal and cannot act on their own counter", async ({
  page,
}) => {
  let offer = pendingOffer();
  let counterRequestBody;
  await page.route("**/api/v1/offers/offer-1/counteroffers", async (route) => {
    counterRequestBody = route.request().postDataJSON();
    offer = {
      ...offer,
      amount: 70,
      version: 1,
      proposerId: "seller-1",
      proposerRole: "SELLER",
      history: [
        ...offer.history,
        {
          id: "proposal-1",
          amount: 70,
          version: 1,
          proposerId: "seller-1",
          proposerRole: "SELLER",
        },
      ],
    };
    await route.fulfill({ json: offer });
  });
  await openConversation(page, "seller-1", () => offer);

  await expect(page.getByRole("list", { name: "Offer price history" }).getByText("$60.00")).toBeVisible();
  await page.getByRole("button", { name: "Counter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send a counteroffer" });
  const input = dialog.getByLabel("Your offer");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("70.00");
  const closeButton = dialog.getByRole("button", {
    name: "Close counteroffer",
  });
  const submitButton = dialog.getByRole("button", {
    name: "Send counteroffer",
  });
  await closeButton.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(submitButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();

  await input.fill("80.01");
  await expect(dialog.getByRole("button", { name: "Send counteroffer" })).toBeDisabled();
  await input.fill("60");
  await expect(dialog.getByRole("button", { name: "Send counteroffer" })).toBeDisabled();
  await input.fill("70");

  const request = page.waitForRequest(
    (candidate) =>
      candidate.url().endsWith("/api/v1/offers/offer-1/counteroffers") &&
      candidate.method() === "POST",
  );
  await dialog.getByRole("button", { name: "Send counteroffer" }).click();
  const submitted = await request;
  expect(submitted.postDataJSON()).toMatchObject({
    amount: 70,
    expectedVersion: 0,
  });
  expect(submitted.postDataJSON().idempotencyKey).toBeTruthy();
  expect(counterRequestBody).toMatchObject({ amount: 70, expectedVersion: 0 });

  await expect(dialog).toBeHidden();
  const proposalSummary = page.locator(".offer-negotiation__header p");
  await expect(proposalSummary).toHaveText("Current proposal: $70.00");
  await expect(proposalSummary).toBeFocused();
  await expect(page.getByText("Current proposal: $70.00")).toBeVisible();
  await expect(page.getByText("Waiting for the other person to respond to your proposal.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Counter", exact: true })).toHaveCount(0);
});

test("buyer counters a seller proposal and gets the updated ordered history", async ({
  page,
}) => {
  let offer = pendingOffer({
    amount: 70,
    version: 1,
    proposerId: "seller-1",
    proposerRole: "SELLER",
    history: [
      ...pendingOffer().history,
      {
        id: "proposal-1",
        amount: 70,
        version: 1,
        proposerId: "seller-1",
        proposerRole: "SELLER",
      },
    ],
  });
  let counterRequestBody;
  await page.route("**/api/v1/offers/offer-1/counteroffers", async (route) => {
    counterRequestBody = route.request().postDataJSON();
    offer = {
      ...offer,
      amount: 65,
      version: 2,
      proposerId: "buyer-1",
      proposerRole: "BUYER",
      history: [
        ...offer.history,
        {
          id: "proposal-2",
          amount: 65,
          version: 2,
          proposerId: "buyer-1",
          proposerRole: "BUYER",
        },
      ],
    };
    await route.fulfill({ json: offer });
  });
  await openConversation(page, "buyer-1", () => offer);

  await page.getByRole("button", { name: "Counter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send a counteroffer" });
  await dialog.getByLabel("Your offer").fill("65");
  await dialog.getByRole("button", { name: "Send counteroffer" }).click();

  await expect(page.getByText("Current proposal: $65.00")).toBeVisible();
  const history = page.getByRole("list", { name: "Offer price history" });
  await expect(history.locator("li")).toHaveCount(3);
  await expect(history.locator("li").nth(0)).toContainText("$60.00");
  await expect(history.locator("li").nth(1)).toContainText("$70.00");
  await expect(history.locator("li").nth(2)).toContainText("$65.00");
  expect(counterRequestBody).toMatchObject({
    amount: 65,
    expectedVersion: 1,
  });
  expect(counterRequestBody.idempotencyKey).toBeTruthy();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
});

test("buyer accepts a seller counteroffer and sees the agreed price", async ({
  page,
}) => {
  let offer = pendingOffer({
    amount: 70,
    version: 1,
    proposerId: "seller-1",
    proposerRole: "SELLER",
    history: [
      ...pendingOffer().history,
      {
        id: "proposal-1",
        amount: 70,
        version: 1,
        proposerId: "seller-1",
        proposerRole: "SELLER",
      },
    ],
  });
  let decisionBody;
  await page.route("**/api/v1/offers/offer-1/decisions", async (route) => {
    decisionBody = route.request().postDataJSON();
    offer = { ...offer, status: "ACCEPTED" };
    await route.fulfill({ json: offer });
  });
  await openConversation(page, "buyer-1", () => offer);

  await expect(page.getByRole("list", { name: "Offer price history" }).getByText("$60.00")).toBeVisible();
  await expect(page.getByRole("list", { name: "Offer price history" }).getByText("$70.00")).toBeVisible();
  await page.getByRole("button", { name: "Accept", exact: true }).click();

  await expect.poll(() => decisionBody).toMatchObject({
    decision: "ACCEPT",
    expectedVersion: 1,
  });
  expect(decisionBody.idempotencyKey).toBeTruthy();
  await expect(page.getByText("Agreed price: $70.00", { exact: true })).toBeVisible();
  await expect(page.getByText(/No payment is taken in DormDrop/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
});

test("buyer can reject a seller proposal and sees its final price", async ({
  page,
}) => {
  let offer = pendingOffer({
    amount: 75,
    version: 2,
    proposerId: "seller-1",
    proposerRole: "SELLER",
  });
  let decisionBody;
  await page.route("**/api/v1/offers/offer-1/decisions", async (route) => {
    decisionBody = route.request().postDataJSON();
    offer = { ...offer, status: "REJECTED" };
    await route.fulfill({ json: offer });
  });
  await openConversation(page, "buyer-1", () => offer);

  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect.poll(() => decisionBody?.decision).toBe("REJECT");
  await expect(page.getByText("Offer rejected at $75.00", { exact: true })).toBeVisible();
});

test("recipient refreshes the offer and sees a conflict instead of overwriting it", async ({
  page,
}) => {
  let offer = pendingOffer({
    amount: 70,
    version: 1,
    proposerId: "seller-1",
    proposerRole: "SELLER",
  });
  let conversationFetches = 0;
  await page.route("**/api/v1/offers/offer-1/decisions", async (route) => {
    offer = {
      ...offer,
      amount: 75,
      version: 2,
      proposerId: "seller-1",
      proposerRole: "SELLER",
      history: [
        ...offer.history,
        {
          id: "proposal-2",
          amount: 75,
          version: 2,
          proposerId: "seller-1",
          proposerRole: "SELLER",
        },
      ],
    };
    await route.fulfill({
      status: 409,
      json: { message: "Offer version is stale." },
    });
  });
  await openConversation(page, "buyer-1", () => {
    conversationFetches += 1;
    return offer;
  });

  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "This offer changed while you were responding. The latest version has been refreshed.",
  );
  await expect(page.getByText("Current proposal: $75.00")).toBeVisible();
  expect(conversationFetches).toBeGreaterThan(1);
});

test("a participant cannot accept, reject, or counter their own current proposal", async ({
  page,
}) => {
  const offer = pendingOffer();
  await openConversation(page, "buyer-1", () => offer);

  await expect(
    page.getByText("Waiting for the other person to respond to your proposal."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Counter", exact: true })).toHaveCount(0);
});
