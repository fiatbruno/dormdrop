// @ts-check
import { test, expect } from "@playwright/test";

const makeSessionToken = () => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  return `test.${payload}.signature`;
};

const acceptedOffer = {
  id: "notification-1",
  type: "OFFER_ACCEPTED",
  offerId: "offer-1",
  listingId: "listing-1",
  payload: {
    message: "The seller accepted your offer.",
    status: "ACCEPTED",
    price: 25,
  },
  createdAt: "2026-11-02T18:00:00Z",
  readAt: null,
};
const rejectedOffer = {
  ...acceptedOffer,
  id: "notification-2",
  type: "OFFER_REJECTED",
  offerId: "offer-2",
  payload: {
    message: "The seller declined your offer.",
    status: "REJECTED",
    price: 25,
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((token) => {
    localStorage.setItem("token", token);
  }, makeSessionToken());
});

test("buyers can read accepted and rejected offer notifications", async ({
  page,
}) => {
  let notifications = [acceptedOffer, rejectedOffer];
  const unreadCount = () =>
    notifications.filter((notification) => !notification.readAt).length;
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: unreadCount() } }),
  );
  await page.route("**/api/v1/me/notifications?*", (route) =>
    route.fulfill({
      json: {
        items: notifications,
        total: notifications.length,
        unreadCount: unreadCount(),
        page: 0,
        size: 100,
      },
    }),
  );
  await page.route("**/api/v1/me/notifications/notification-1/read", async (route) => {
    expect(route.request().method()).toBe("PATCH");
    notifications = notifications.map((notification) =>
      notification.id === "notification-1"
        ? { ...notification, readAt: "2026-11-02T18:01:00Z" }
        : notification,
    );
    await route.fulfill({
      json: notifications[0],
    });
  });
  await page.route("**/api/v1/me/notifications/notification-2/read", async (route) => {
    expect(route.request().method()).toBe("PATCH");
    notifications = notifications.map((notification) =>
      notification.id === "notification-2"
        ? { ...notification, readAt: "2026-11-02T18:02:00Z" }
        : notification,
    );
    await route.fulfill({
      json: notifications[1],
    });
  });

  await page.goto("/notifications");

  await expect(
    page.getByRole("heading", { name: "Your offer was accepted" }),
  ).toBeVisible();
  await expect(page.getByText("The seller accepted your offer.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your offer was declined" }),
  ).toBeVisible();
  await expect(page.getByText("The seller declined your offer.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View listing" }).first(),
  ).toHaveAttribute("href", "/items/listing-1");
  await page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Your offer was accepted" }) })
    .getByRole("button", { name: "Mark as read" })
    .click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "Your offer was accepted" }) })
      .getByText("Unread", { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Notifications, 1 unread" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
  const dropdown = page.getByRole("region", { name: "Notifications" });
  await expect(dropdown).toBeVisible();
  await dropdown.getByRole("button", { name: "Unread (1)" }).click();
  await expect(
    dropdown.getByRole("link", { name: "Seller declined your offer" }),
  ).toBeVisible();
  await dropdown.getByRole("button", { name: "Mark all as read" }).click();
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(dropdown.getByText("Unread (0)")).toBeVisible();
});
