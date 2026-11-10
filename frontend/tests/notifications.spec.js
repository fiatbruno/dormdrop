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
const counteredOffer = {
  ...acceptedOffer,
  id: "notification-3",
  type: "OFFER_COUNTERED",
  offerId: "offer-3",
  payload: {
    message: "A new counteroffer is waiting.",
    status: "PENDING",
    price: 27,
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((token) => {
    localStorage.setItem("token", token);
  }, makeSessionToken());
  // The bell combines notification and message unread counts.
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({ json: [] }),
  );
});

test("unread filter loads older unread notifications from the server", async ({ page }) => {
  const olderUnread = { ...counteredOffer, id: "older-unread" };
  const readItems = Array.from({ length: 20 }, (_, index) => ({
    ...acceptedOffer,
    id: `read-${index}`,
    readAt: "2026-11-03T00:00:00Z",
  }));
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 1 } }),
  );
  const requests = [];
  await page.route("**/api/v1/me/notifications?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params.get("unreadOnly"));
    const unreadOnly = params.get("unreadOnly") === "true";
    return route.fulfill({
      json: {
        items: unreadOnly ? [olderUnread] : readItems,
        total: unreadOnly ? 1 : 21,
        unreadCount: 1,
        page: 0,
        size: 20,
      },
    });
  });
  await page.goto("/notifications");
  await expect(page.getByRole("button", { name: "Load older notifications" })).toBeVisible();
  await page.getByRole("button", { name: "Unread (1)" }).click();
  await expect(page.getByRole("heading", { name: "New counteroffer" })).toBeVisible();
  await expect(page.getByText("You’re all caught up")).toHaveCount(0);
  expect(requests).toContain("true");
});

test("buyers see distinct accepted, rejected, and counteroffer notifications", async ({
  page,
}) => {
  let notifications = [acceptedOffer, rejectedOffer, counteredOffer];
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
  await page.route("**/api/v1/me/notifications/notification-3/read", async (route) => {
    notifications = notifications.map((notification) =>
      notification.id === "notification-3"
        ? { ...notification, readAt: "2026-11-02T18:03:00Z" }
        : notification,
    );
    await route.fulfill({ json: notifications[2] });
  });

  await page.goto("/notifications");

  await expect(
    page.getByRole("heading", { name: "Offer accepted — agreement only" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Agreement recorded at \$25\.00\. Payment and pickup are arranged separately/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Offer declined" }),
  ).toBeVisible();
  await expect(page.getByText("Your offer was declined at $25.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "New counteroffer" })).toBeVisible();
  await expect(page.getByText(/new proposal for \$27/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open current offer" }).first(),
  ).toHaveAttribute("href", "/offers/offer-1");
  await page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Offer accepted — agreement only" }) })
    .getByRole("button", { name: "Mark as read" })
    .click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "Offer accepted — agreement only" }) })
      .getByText("Unread", { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Notifications, 2 unread" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Notifications, 2 unread" }).click();
  const dropdown = page.getByRole("region", { name: "Notifications" });
  await expect(dropdown).toBeVisible();
  await dropdown.getByRole("button", { name: "Unread (2)" }).click();
  await expect(
    dropdown.getByRole("link", { name: /Offer declined/ }),
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

test("an older counteroffer notice opens the authoritative current offer", async ({
  page,
}) => {
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 1 } }),
  );
  await page.route("**/api/v1/me/notifications?*", (route) =>
    route.fulfill({
      json: {
        items: [counteredOffer],
        total: 1,
        unreadCount: 1,
        page: 0,
        size: 20,
      },
    }),
  );
  await page.route("**/api/v1/me/notifications/notification-3/read", (route) =>
    route.fulfill({ json: { ...counteredOffer, readAt: "2026-11-03T00:00:00Z" } }),
  );
  let offerReads = 0;
  await page.route("**/api/v1/offers/offer-3", (route) => {
    offerReads += 1;
    return route.fulfill({
      json: {
        id: "offer-3",
        listingId: "listing-1",
        buyerId: "buyer-1",
        sellerId: "seller-1",
        currentProposerId: "seller-1",
        amount: 29,
        status: "ACCEPTED",
        version: 3,
        history: [
          { action: "PROPOSED", actorId: "buyer-1", amount: 25 },
          { action: "COUNTERED", actorId: "seller-1", amount: 27 },
          { action: "ACCEPTED", actorId: "buyer-1", amount: 29 },
        ],
      },
    });
  });
  await page.route("**/api/v1/home/listing-1", (route) =>
    route.fulfill({
      json: {
        id: "listing-1",
        title: "Desk",
        ownerId: "seller-1",
        price: 30,
        status: "AVAILABLE",
      },
    }),
  );

  await page.goto("/notifications");
  await page.getByRole("link", { name: "Open current offer" }).click();
  await expect(page).toHaveURL("/offers/offer-3");
  await expect(page.getByText("Agreed price: $29.00", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Counter", exact: true })).toHaveCount(0);
  expect(offerReads).toBeGreaterThan(0);
});

test("the inbox does not request desktop notification permission", async ({
  page,
}) => {
  await page.addInitScript(() => {
    globalThis.__notificationPermissionRequests = 0;
    let permission = "default";
    class MockNotification {
      static get permission() {
        return permission;
      }

      static async requestPermission() {
        globalThis.__notificationPermissionRequests += 1;
        permission = "denied";
        return permission;
      }
    }
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: MockNotification,
    });
  });
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/v1/me/notifications?*", (route) =>
    route.fulfill({
      json: { items: [], total: 0, unreadCount: 0, page: 0, size: 5 },
    }),
  );

  await page.goto("/notifications");
  expect(await page.evaluate(() => globalThis.__notificationPermissionRequests)).toBe(0);
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  expect(await page.evaluate(() => globalThis.__notificationPermissionRequests)).toBe(0);
  await expect(page.getByRole("button", { name: "Enable desktop alerts" })).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__notificationPermissionRequests)).toBe(0);
  await expect(page.getByText("No notifications yet")).toBeVisible();
});

test("live notification events update the inbox and ignore duplicate event IDs", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class DeniedNotification {
      static permission = "denied";

      static async requestPermission() {
        throw new Error("Permission requests are disabled in this test.");
      }
    }
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: DeniedNotification,
    });
  });
  let unread = 0;
  const liveNotification = {
    ...counteredOffer,
    id: "notification-live-1",
    eventId: "event-live-1",
  };
  await page.routeWebSocket("**/api/v1/ws", (socket) => {
    socket.onMessage((data) => {
      const frame = String(data);
      if (frame.startsWith("CONNECT\n")) {
        socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
      }
      if (
        frame.startsWith("SUBSCRIBE\n") &&
        frame.includes("/user/queue/notifications")
      ) {
        unread = 1;
        const body = JSON.stringify(liveNotification);
        const message = `MESSAGE\nsubscription:sub-0\nmessage-id:m-1\ncontent-type:application/json\n\n${body}\0`;
        socket.send(message);
        socket.send(message);
      }
    });
  });
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: unread } }),
  );
  await page.route("**/api/v1/me/notifications?*", (route) =>
    route.fulfill({
      json: {
        items: unread ? [liveNotification] : [],
        total: unread,
        unreadCount: unread,
        page: 0,
        size: 20,
      },
    }),
  );

  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: "New counteroffer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Notifications, 1 unread" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
  await expect(page.getByRole("region", { name: "Notifications" })
    .getByRole("link", { name: /New counteroffer/ }))
    .toHaveAttribute("href", "/offers/offer-3");
  await expect(page.getByRole("listitem")).toHaveCount(1);
});

test("a background tab receives live updates without native popups", async ({
  page,
}) => {
  await page.addInitScript(() => {
    globalThis.__nativePopupCount = 0;
    class MockNotification {
      static permission = "granted";

      constructor(title, options) {
        globalThis.__nativePopupCount += 1;
        this.title = title;
        this.options = options;
      }

      close() {}
    }
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: MockNotification,
    });
    Object.defineProperty(globalThis.document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
  });
  const event = {
    ...counteredOffer,
    id: "notification-native-1",
    eventId: "event-native-1",
  };
  await page.routeWebSocket("**/api/v1/ws", (socket) => {
    socket.onMessage((data) => {
      const frame = String(data);
      if (frame.startsWith("CONNECT\n")) {
        socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
      }
      if (
        frame.startsWith("SUBSCRIBE\n") &&
        frame.includes("/user/queue/notifications")
      ) {
        const body = JSON.stringify(event);
        socket.send(
          `MESSAGE\nsubscription:sub-0\nmessage-id:m-native\ncontent-type:application/json\n\n${body}\0`,
        );
      }
    });
  });
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 1 } }),
  );
  await page.route("**/api/v1/me/notifications?*", (route) =>
    route.fulfill({
      json: { items: [event], total: 1, unreadCount: 1, page: 0, size: 20 },
    }),
  );

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "New counteroffer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
  expect(await page.evaluate(() => globalThis.__nativePopupCount)).toBe(0);
});

test("a reconnect refetches persisted notifications and deduplicates replayed events", async ({
  page,
}) => {
  test.setTimeout(20000);
  let connection = 0;
  let inboxReads = 0;
  const event = {
    ...counteredOffer,
    id: "notification-reconnect-1",
    eventId: "event-reconnect-1",
  };
  await page.routeWebSocket("**/api/v1/ws", (socket) => {
    socket.onMessage((data) => {
      const frame = String(data);
      if (frame.startsWith("CONNECT\n")) {
        connection += 1;
        socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
      }
      if (
        frame.startsWith("SUBSCRIBE\n") &&
        frame.includes("/user/queue/notifications")
      ) {
        const body = JSON.stringify(event);
        const message = `MESSAGE\nsubscription:sub-0\nmessage-id:m-reconnect\ncontent-type:application/json\n\n${body}\0`;
        socket.send(message);
        if (connection === 1) {
          setTimeout(() => socket.close({ code: 1000, reason: "test reconnect" }), 50);
        }
      }
    });
  });
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 1 } }),
  );
  await page.route("**/api/v1/me/notifications?*", (route) => {
    inboxReads += 1;
    return route.fulfill({
      json: {
        items: [event],
        total: 1,
        unreadCount: 1,
        page: 0,
        size: 20,
      },
    });
  });

  await page.goto("/notifications");
  await expect.poll(() => connection, { timeout: 15000 }).toBeGreaterThan(1);
  await expect.poll(() => inboxReads, { timeout: 15000 }).toBeGreaterThan(2);
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "New counteroffer" })).toBeVisible();
});

test("unsupported desktop notifications leave the in-app inbox available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: undefined,
    });
  });
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/v1/me/notifications?*", (route) =>
    route.fulfill({
      json: { items: [], total: 0, unreadCount: 0, page: 0, size: 5 },
    }),
  );

  await page.goto("/notifications");
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enable desktop alerts" })).toHaveCount(0);
  await expect(page.getByText("You’re all caught up.")).toBeVisible();
});

test("switching accounts clears the previous inbox and unread badge", async ({
  page,
}) => {
  const otherToken = makeSessionToken();
  await page.route("**/api/v1/me/notifications/unread-count", (route) => {
    const isNewAccount = route.request().headers().authorization?.includes("new-account");
    return route.fulfill({ json: { count: isNewAccount ? 0 : 1 } });
  });
  await page.route("**/api/v1/me/notifications?*", (route) => {
    const isNewAccount = route.request().headers().authorization?.includes("new-account");
    const items = isNewAccount ? [] : [rejectedOffer];
    return route.fulfill({
      json: {
        items,
        total: items.length,
        unreadCount: items.length,
        page: 0,
        size: 20,
      },
    });
  });

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Offer declined" })).toBeVisible();
  const freshToken = otherToken.replace("test.", "new-account.");
  await page.evaluate((token) => {
    localStorage.setItem("token", token);
    globalThis.dispatchEvent(new globalThis.StorageEvent("storage", { key: "token" }));
  }, freshToken);

  await expect(page.getByText("No notifications yet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Offer declined" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toBeVisible();
});

test("logout clears the private notification view", async ({ page }) => {
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 1 } }),
  );
  await page.route("**/api/v1/me/notifications?*", (route) =>
    route.fulfill({
      json: {
        items: [rejectedOffer],
        total: 1,
        unreadCount: 1,
        page: 0,
        size: 20,
      },
    }),
  );
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Offer declined" })).toBeVisible();
  await page.evaluate(() => {
    localStorage.removeItem("token");
    globalThis.dispatchEvent(new globalThis.StorageEvent("storage", { key: "token" }));
  });
  await expect(page).toHaveURL("/login");
  await expect(page.locator(".notification-bell")).toHaveCount(0);
});

test("inbox pagination deduplicates overlapping page records", async ({
  page,
}) => {
  const notices = Array.from({ length: 24 }, (_, index) => ({
    ...acceptedOffer,
    id: `page-${index + 1}`,
    offerId: `offer-${index + 1}`,
    createdAt: new Date(Date.UTC(2026, 10, 3, 0, index)).toISOString(),
  }));
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/v1/me/notifications?*", (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page"));
    const items =
      pageNumber === 0
        ? notices.slice(0, 20)
        : [notices[19], ...notices.slice(20)];
    return route.fulfill({
      json: { items, total: 24, unreadCount: 0, page: pageNumber, size: 20 },
    });
  });

  await page.goto("/notifications");
  await expect(page.getByRole("listitem")).toHaveCount(20);
  await page.getByRole("button", { name: "Load older notifications" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(24);
});

test("inbox retries a failed request and keeps read state after reload", async ({
  page,
}) => {
  let notice = { ...rejectedOffer };
  let listRequests = 0;
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: notice.readAt ? 0 : 1 } }),
  );
  await page.route("**/api/v1/me/notifications?*", (route) => {
    listRequests += 1;
    if (listRequests < 3) return route.fulfill({ status: 503 });
    return route.fulfill({
      json: {
        items: [notice],
        total: 1,
        unreadCount: notice.readAt ? 0 : 1,
        page: 0,
        size: 20,
      },
    });
  });
  await page.route("**/api/v1/me/notifications/notification-2/read", async (route) => {
    notice = { ...notice, readAt: "2026-11-03T00:00:00Z" };
    await route.fulfill({ json: notice });
  });

  await page.goto("/notifications");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Offer declined" })).toBeVisible();
  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(page.getByText("Unread", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Offer declined" })).toBeVisible();
  await expect(page.getByText("Unread", { exact: true })).toHaveCount(0);
});
