import { test, expect } from "@playwright/test";

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
      proposals = [{ id: "p1", idSuggester: "buyer", meetingPlace: submitted.meetingPlace, timePickUp: submitted.timePickup, timeCreated: new Date().toISOString(), status: "PENDING" }];
      await route.fulfill({ status: 201, json: proposals[0] });
    } else await route.fulfill({ json: proposals });
  });
  await page.goto("/messages/c1");
  await page.getByRole("button", { name: "Propose pickup", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Propose a pickup" });
  await dialog.getByRole("button", { name: "Send proposal" }).click();
  await expect(dialog.getByText("Location is required")).toBeVisible();
  await dialog.getByLabel("Location").fill("Gerber Center · Main entrance");
  await dialog.getByLabel("Date").fill("2099-11-12");
  await dialog.getByLabel("Time").fill("16:00");
  await dialog.getByRole("button", { name: "Send proposal" }).click();
  await expect(page.getByRole("dialog", { name: "Proposal sent" })).toBeVisible();
  expect(submitted).toEqual({ meetingPlace: "Gerber Center · Main entrance", timePickup: "2099-11-12T16:00:00" });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const card = page.getByRole("article", { name: "Pickup proposal" });
  await expect(card).toContainText("Gerber Center · Main entrance");
  await expect(card).toContainText("Sent by you");
  await page.reload();
  await expect(page.getByRole("article", { name: "Pickup proposal" })).toContainText("Gerber Center · Main entrance");
});

for (const [decision, expectedStatus, label] of [["ACCEPTED", "Accepted", "Accept"], ["REJECTED", "Declined", "Decline"]]) {
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
  const form = page.getByRole("dialog", { name: "Propose a pickup" });
  await form.getByLabel("Location").fill("New location");
  await form.getByLabel("Date").fill("2099-11-12");
  await form.getByLabel("Time").fill("16:00");
  await form.getByRole("button", { name: "Send proposal" }).click();
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
  const dialog = page.getByRole("dialog", { name: "Propose a pickup" });
  await dialog.getByLabel("Location").fill("Gerber");
  await dialog.getByLabel("Date").fill("2099-11-12");
  await dialog.getByLabel("Time").fill("16:00");
  await dialog.getByRole("button", { name: "Send proposal" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Pickup time must be in the future.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  const card = page.getByRole("article", { name: "Pickup proposal" });
  await card.getByText("View pickup details").click();
  await card.getByRole("button", { name: "Accept" }).click();
  await expect(card).toContainText("Accepted");
  await expect(card.getByRole("button", { name: "Accept" })).toHaveCount(0);
});
