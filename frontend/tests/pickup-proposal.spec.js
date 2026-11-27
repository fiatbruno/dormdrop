import { test, expect } from "@playwright/test";

const campusDateTime = (offsetMs) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(Date.now() + offsetMs)).replace(" ", "T");

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/conversations/*/message-reports/mine", (route) =>
    route.fulfill({ json: [] }),
  );
});

test("validates and sends a pickup proposal, then loads it after a reload", async ({ page }) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  await page.addInitScript((token) => localStorage.setItem("token", token), `test.${payload}.signature`);
  await page.route("**/api/v1/users/me", route => route.fulfill({ json: { id: "buyer", name: "Test User" } }));
  let proposals = [];
  let submitted;
  await page.route("**/api/v1/me/notifications/unread-count", route => route.fulfill({ json: { count: 0 } }));
  await page.route("**/api/v1/conversations", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/conversations/c1", route => route.fulfill({ json: {
    id: "c1", currentUserId: "buyer", participant: { name: "Alex", emailVerified: true }, listing: null,
  } }));
  await page.route("**/api/v1/conversations/c1/messages", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/conversations/c1/pickup-proposals", async route => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      proposals = [{ id: "p1", idSuggester: "buyer", meetingPlace: submitted.meetingPlace, meetingNote: submitted.note,
        timePickUp: submitted.timePickup, timeCreated: new Date().toISOString(), status: "PENDING" }];
      await route.fulfill({ status: 201, json: proposals[0] });
    } else await route.fulfill({ json: proposals });
  });
  await page.goto("/messages/c1");
  await page.getByRole("button", { name: "Propose pickup", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Arrange pickup" });
  await expect(dialog.getByText(/A new proposal will become the latest arrangement/)).toBeVisible();
  await dialog.getByRole("button", { name: "Propose pickup" }).click();
  await expect(dialog.getByText("Meeting place is required")).toBeVisible();
  await dialog.getByLabel("Meeting place").fill("Gerber Center · Main entrance");
  const pickupDateTime = dialog.getByLabel("Pickup date and time (Central Time)");
  await pickupDateTime.fill(campusDateTime(-60 * 60 * 1000).slice(0, 16));
  await dialog.getByRole("button", { name: "Propose pickup" }).click();
  await expect(dialog.getByText("Choose a future pickup time in Central Time.")).toBeVisible();
  expect(submitted).toBeUndefined();

  const futurePickup = campusDateTime(24 * 60 * 60 * 1000).slice(0, 16);
  await pickupDateTime.fill(futurePickup);
  await dialog.getByLabel("Note (optional)").fill("  Meet by the library doors.  ");
  await dialog.getByRole("button", { name: "Propose pickup" }).click();
  await expect(page.getByRole("dialog", { name: "Proposal sent" })).toBeVisible();
  expect(submitted).toEqual({ meetingPlace: "Gerber Center · Main entrance", timePickup: `${futurePickup}:00`,
    note: "Meet by the library doors." });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const card = page.getByRole("article", { name: "Pickup proposal" });
  await expect(card).toContainText("Gerber Center · Main entrance");
  await expect(card).toContainText("Sent by you");
  await page.reload();
  await card.getByText("View pickup details").click();
  await expect(card.getByText("Meet by the library doors.")).toBeVisible();
});

for (const [decision, expectedStatus, label] of [["ACCEPTED", "Pickup time accepted", "Accept"], ["REJECTED", "Declined", "Decline"]]) {
  test(`recipient can ${label.toLowerCase()} and the status survives reload`, async ({ page }) => {
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await page.addInitScript(token => localStorage.setItem("token", token), `test.${payload}.signature`);
    let currentUserId = "recipient";
    let proposal = { id: "proposal-1", idSuggester: "sender", meetingPlace: "Gerber Center", timePickUp: "2099-11-12T16:00:00", timeCreated: "2026-11-12T20:00:00Z", status: "PENDING" };
    await page.route("**/api/v1/users/me", route => route.fulfill({ json: { id: currentUserId, name: "Test User" } }));
    await page.route("**/api/v1/me/notifications/unread-count", route => route.fulfill({ json: { count: 0 } }));
    await page.route("**/api/v1/conversations", route => route.fulfill({ json: [] }));
    await page.route("**/api/v1/conversations/c1", route => route.fulfill({ json: { id: "c1", currentUserId, participant: { name: "Alex", emailVerified: true }, listing: null } }));
    await page.route("**/api/v1/conversations/c1/messages", route => route.fulfill({ json: [] }));
    await page.route("**/api/v1/conversations/c1/pickup-proposals", route => route.fulfill({ json: [proposal] }));
    await page.route("**/api/v1/conversations/c1/pickup-proposals/proposal-1/respond?*", route => {
      expect(route.request().method()).toBe("PATCH");
      expect(new URL(route.request().url()).searchParams.get("decision")).toBe(decision);
      proposal = { ...proposal, status: decision };
      return route.fulfill({ json: proposal });
    });
    await page.goto("/messages/c1");
    const card = page.getByRole("article", { name: "Pickup proposal" });
    await expect(card).toContainText("Pending");
    await card.getByText("View pickup details").click();
    await card.getByRole("button", { name: label, exact: true }).click();
    if (decision === "REJECTED") {
      await page.getByRole("dialog", { name: "Decline this pickup?" })
        .getByRole("button", { name: "Decline proposal" }).click();
    } else {
      const confirmation = page.getByRole("dialog", { name: "Pickup time accepted" });
      await expect(confirmation).toContainText("Gerber Center");
      await page.keyboard.press("Escape");
    }
    await expect(card).toContainText(expectedStatus);
    await expect(card.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    await page.reload();
    await expect(card).toContainText(expectedStatus);
    currentUserId = "sender";
    proposal = { ...proposal, status: "PENDING" };
    await page.reload();
    await expect(card).toContainText("Sent by you");
    await card.getByText("View pickup details").click();
    await expect(card.getByRole("button", { name: "Accept" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Decline" })).toHaveCount(0);
  });
}

test("keeps older proposals when an initial load finishes after sending", async ({ page }) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  await page.addInitScript(token => localStorage.setItem("token", token), `test.${payload}.signature`);
  await page.route("**/api/v1/users/me", route => route.fulfill({ json: { id: "buyer", name: "Test User" } }));
  await page.route("**/api/v1/me/notifications/unread-count", route => route.fulfill({ json: { count: 0 } }));
  await page.route("**/api/v1/conversations", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/conversations/c1", route => route.fulfill({ json: { id: "c1", currentUserId: "buyer", participant: { name: "Alex" }, listing: null } }));
  await page.route("**/api/v1/conversations/c1/messages", route => route.fulfill({ json: [] }));
  const old = { id: "old", idSuggester: "buyer", meetingPlace: "Old location", timePickUp: "2099-11-12T16:00:00", timeCreated: "2026-11-12T20:00:00Z", status: "PENDING" };
  let proposals = [old];
  let releaseFirst;
  const waitForFirst = new Promise(resolve => { releaseFirst = resolve; });
  let getCount = 0;
  await page.route("**/api/v1/conversations/c1/pickup-proposals", async route => {
    if (route.request().method() === "POST") {
      const created = { ...old, id: "new", meetingPlace: "New location", timeCreated: "2026-11-13T20:00:00Z" };
      proposals = [old, created];
      return route.fulfill({ status: 201, json: created });
    }
    if (++getCount === 1) {
      await waitForFirst;
      return route.fulfill({ json: [old] });
    }
    return route.fulfill({ json: proposals });
  });
  await page.goto("/messages/c1");
  await page.getByRole("button", { name: "Propose pickup", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Arrange pickup" });
  await form.getByLabel("Meeting place").fill("New location");
  await form.getByLabel("Pickup date and time (Central Time)").fill("2099-11-12T16:00");
  await form.getByRole("button", { name: "Propose pickup" }).click();
  await expect(page.getByRole("dialog", { name: "Proposal sent" })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("Old location")).toBeVisible();
  releaseFirst();
  await expect(page.getByRole("article", { name: "Pickup proposal" })).toHaveCount(2);
});

test("shows server errors and recovers an already answered proposal", async ({ page }) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  await page.addInitScript(token => localStorage.setItem("token", token), `test.${payload}.signature`);
  let proposal = { id: "p1", idSuggester: "other", meetingPlace: "Gerber", timePickUp: "2099-11-12T16:00:00", timeCreated: "2026-11-12T20:00:00Z", status: "PENDING" };
  await page.route("**/api/v1/users/me", route => route.fulfill({ json: { id: "buyer", name: "Test" } }));
  await page.route("**/api/v1/me/notifications/unread-count", route => route.fulfill({ json: { count: 0 } }));
  await page.route("**/api/v1/conversations", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/conversations/c1", route => route.fulfill({ json: { id: "c1", currentUserId: "buyer", participant: { name: "Alex" }, listing: null } }));
  await page.route("**/api/v1/conversations/c1/messages", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/conversations/c1/pickup-proposals", route => route.request().method() === "POST"
    ? route.fulfill({ status: 400, json: { detail: "Pickup time must be in the future." } })
    : route.fulfill({ json: [proposal] }));
  await page.route("**/api/v1/conversations/c1/pickup-proposals/p1/respond?*", route => {
    proposal = { ...proposal, status: "ACCEPTED" };
    return route.fulfill({ status: 409, json: { message: "Already answered" } });
  });
  await page.goto("/messages/c1");
  await page.getByRole("button", { name: "Propose pickup", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Arrange pickup" });
  await dialog.getByLabel("Meeting place").fill("Gerber");
  await dialog.getByLabel("Pickup date and time (Central Time)").fill("2099-11-12T16:00");
  await dialog.getByRole("button", { name: "Propose pickup" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Pickup time must be in the future.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  const card = page.getByRole("article", { name: "Pickup proposal" });
  await card.getByText("View pickup details").click();
  await card.getByRole("button", { name: "Accept" }).click();
  await expect(card).toContainText("Pickup time accepted");
  await expect(card.getByRole("button", { name: "Accept" })).toHaveCount(0);
});

test("shows buyer-only receipt confirmation directly in Messages after pickup", async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ colorScheme: "dark" });
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  await page.addInitScript(token => localStorage.setItem("token", token), `test.${payload}.signature`);
  let currentUserId = "buyer";
  let completed = null;
  let receiptRequests = 0;
  const futurePickup = {
    id: "proposal-1", idSuggester: "buyer", status: "PENDING", meetingPlace: "Gerber Center",
    timePickUp: campusDateTime(60 * 60 * 1000), timeCreated: new Date().toISOString(),
  };
  let proposal = null;
  let pickupPassed = false;
  await page.route("**/api/v1/users/me", route => route.fulfill({ json: { id: currentUserId, capabilities: [] } }));
  await page.route("**/api/v1/me/notifications/unread-count", route => route.fulfill({ json: { count: 0 } }));
  await page.route("**/api/v1/conversations", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/conversations/c1", route => route.fulfill({ json: {
    id: "c1", currentUserId, participant: { name: "Alex", emailVerified: true },
    listing: {
      id: "l1", title: "Sony Headphones", price: 110, listingType: "For sale",
      status: completed ? "SOLD" : "RESERVED", reservedOfferId: "offer-1",
    },
    offer: { id: "offer-1", buyerId: "buyer", sellerId: "seller", amount: 110, status: "ACCEPTED" },
  } }));
  await page.route("**/api/v1/conversations/c1/messages", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/conversations/c1/message-reports/mine", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/conversations/c1/pickup-proposals", route => route.fulfill({ json: proposal ? [proposal] : [] }));
  await page.route("**/api/v1/conversations/c1/pickup-proposals/proposal-1/respond?*", route => {
    expect(route.request().method()).toBe("PATCH");
    expect(currentUserId).toBe("seller");
    expect(new URL(route.request().url()).searchParams.get("decision")).toBe("ACCEPTED");
    proposal = { ...proposal, status: "ACCEPTED" };
    return route.fulfill({ json: proposal });
  });
  await page.route("**/api/v1/offers/offer-1/transaction/status", route => {
    const buyer = currentUserId === "buyer";
    const sellerAccepted = proposal?.status === "ACCEPTED" && proposal.idSuggester === "buyer";
    return route.fulfill({ json: {
      buyer, canConfirm: buyer && sellerAccepted && pickupPassed && !completed,
      waitingForPickupTime: buyer && sellerAccepted && !pickupPassed,
      transaction: completed,
    } });
  });
  await page.route("**/api/v1/offers/offer-1/transaction/confirm-receipt", route => {
    receiptRequests++;
    expect(route.request().method()).toBe("POST");
    expect(currentUserId).toBe("buyer");
    expect(pickupPassed).toBe(true);
    completed = { id: "transaction-1", status: "COMPLETED" };
    return route.fulfill({ json: completed });
  });
  await page.route("**/api/v1/offers/offer-1/transaction/review", route => {
    const review = route.request().postDataJSON();
    expect(review).toEqual({ rating: 5, comment: "Easy pickup" });
    completed = { ...completed, sellerReview: { ...review, submittedAt: "2025-11-12T21:00:00Z" } };
    return route.fulfill({ json: completed });
  });
  await page.route("**/api/v1/offers/offer-1/transaction/seller-reviews", route => route.fulfill({ json: [completed.sellerReview] }));

  await page.goto("/messages/c1");
  await page.getByRole("button", { name: "Propose pickup", exact: true }).click();
  const pickupForm = page.getByRole("dialog", { name: "Arrange pickup" });
  await expect(pickupForm).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(pickupForm).toHaveCSS("color-scheme", "light");
  await pickupForm.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Your exchange" }).click();
  await expect(page.getByRole("heading", { name: "Your exchange", exact: true })).toBeVisible();
  const exchangeSummary = page.getByRole("region", { name: "Complete your exchange" });
  await expect(exchangeSummary.getByText("Checking exchange status…")).toHaveCount(0);
  await expect(exchangeSummary.getByRole("button", { name: "Confirm item received" })).toHaveCount(0);
  await page.getByRole("button", { name: "View conversation" }).click();

  proposal = futurePickup;
  currentUserId = "seller";
  await page.reload();
  await page.getByRole("button", { name: "Your exchange" }).click();
  const pickupDetails = page.getByRole("region", { name: "Pickup details" });
  await expect(pickupDetails.getByText("Awaiting response")).toBeVisible();
  await expect(exchangeSummary.getByRole("button", { name: "Confirm item received" })).toHaveCount(0);
  await pickupDetails.getByRole("button", { name: "Accept pickup time" }).click();
  const pickupAccepted = page.getByRole("dialog", { name: "Pickup time accepted" });
  await expect(pickupAccepted).toContainText("The exchange stays open until the buyer confirms they received the item.");
  await pickupAccepted.getByRole("button", { name: "Back to exchange" }).click();
  await expect(pickupDetails.getByText("Time accepted", { exact: true })).toBeVisible();

  currentUserId = "buyer";
  await page.reload();
  await expect(exchangeSummary.getByRole("button", { name: "Confirm item received" })).toHaveCount(0);
  await expect(exchangeSummary).toContainText("You can confirm receipt after the scheduled pickup time.");

  const receiptStatusUrl = "**/api/v1/offers/offer-1/transaction/status";
  const loadedBeforePickup = page.waitForResponse(receiptStatusUrl);
  await page.getByRole("button", { name: "View conversation" }).click();
  await loadedBeforePickup;
  const receiptButton = page.getByRole("button", { name: "Confirm item received" });
  await expect(receiptButton).toHaveCount(0);

  proposal = { ...proposal, timePickUp: campusDateTime(-60_000) };
  pickupPassed = true;
  await page.clock.runFor(12_100);
  await expect(receiptButton).toBeVisible();
  expect(receiptRequests).toBe(0);

  currentUserId = "seller";
  const loadedForSeller = page.waitForResponse(receiptStatusUrl);
  await page.reload();
  await loadedForSeller;
  await expect(page.getByText("Completed", { exact: true })).toHaveCount(0);
  await expect(receiptButton).toHaveCount(0);
  expect(receiptRequests).toBe(0);

  currentUserId = "buyer";
  await page.reload();
  await receiptButton.click();
  const receipt = page.getByRole("dialog", { name: "Did you receive the item?" });
  await expect(receipt.getByText("Sony Headphones · Agreed price $110.00", { exact: true })).toBeVisible();
  const confirmReceipt = receipt.getByRole("button", { name: "Yes, received" });
  await expect(confirmReceipt).toHaveCSS("background-color", "rgb(23, 62, 111)");
  expect(receiptRequests).toBe(0);
  await confirmReceipt.click();
  await expect(page.getByRole("dialog", { name: "Exchange completed" })).toBeVisible();
  expect(receiptRequests).toBe(1);
  await page.getByRole("dialog", { name: "Exchange completed" }).getByRole("button", { name: "Rate the seller" }).click();
  const review = page.getByRole("dialog", { name: "How was your exchange?" });
  await review.getByRole("button", { name: "Submit review" }).click();
  await expect(review.getByRole("alert")).toContainText("Choose a star rating");
  await review.getByRole("radio", { name: "5 stars" }).check();
  await review.getByLabel("Your review").fill("Easy pickup");
  await review.getByRole("button", { name: "Submit review" }).click();
  await page.getByRole("dialog", { name: "Thanks for your review" }).getByRole("button", { name: "View seller reviews" }).click();
  await expect(page.getByRole("dialog", { name: "Reviews for Alex" })).toContainText("Easy pickup");
  await page.reload();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(receiptButton).toHaveCount(0);
  await page.getByRole("button", { name: "Your exchange" }).click();
  await expect(exchangeSummary.getByText("Completed", { exact: true })).toBeVisible();
  await expect(exchangeSummary).toContainText("Review submitted");
  await expect(page.getByRole("button", { name: "Rate the seller" })).toHaveCount(0);

  currentUserId = "seller";
  await page.reload();
  await expect(exchangeSummary.getByText("Completed", { exact: true })).toBeVisible();
  await expect(exchangeSummary.getByRole("button", { name: "Confirm item received" })).toHaveCount(0);
});
