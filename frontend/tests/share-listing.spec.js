// @ts-check
import { expect, test } from "@playwright/test";

const makeToken = () => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, id: "buyer-1" }),
  ).toString("base64url");
  return `test.${payload}.signature`;
};

async function mockListingPage(page, listingId = "shared-listing") {
  await page.addInitScript((token) => localStorage.setItem("token", token), makeToken());
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route(`**/api/v1/home/${listingId}`, (route) =>
    route.fulfill({
      json: {
        id: listingId,
        title: "Shared desk",
        description: "A useful desk",
        category: "Furniture",
        ownerId: "seller-1",
        price: 35,
        status: "AVAILABLE",
        condition: "Good",
        listingType: "For Sale",
      },
    }),
  );
  await page.route("**/api/v1/home", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/favorites", (route) => route.fulfill({ json: [] }));
}

test("copies the canonical listing URL and confirms success accessibly", async ({
  page,
}) => {
  await mockListingPage(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          globalThis.__copiedListingUrl = value;
        },
      },
    });
  });
  await page.goto("/items/shared-listing?campaign=ignored#details");

  await page.getByRole("button", { name: /share listing/i }).click();
  await expect(
    page.getByText(/Listing link copied|Copied a local-only link/),
  ).toBeVisible();
  const copied = await page.evaluate(() => globalThis.__copiedListingUrl);
  const url = new URL(copied);
  expect(url.pathname).toBe("/items/shared-listing");
  expect(url.search).toBe("");
  expect(url.hash).toBe("");
});

test("clipboard failure is announced without claiming the link was copied", async ({
  page,
}) => {
  await mockListingPage(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/items/shared-listing");

  await page.getByRole("button", { name: /share listing/i }).click();
  await expect(page.getByText(/Couldn't copy the link/)).toBeVisible();
  await expect(page.getByText(/Listing link copied|Copied a local-only link/)).toHaveCount(0);
});

test("a missing shared listing shows a safe unavailable state", async ({
  page,
}) => {
  await mockListingPage(page);
  await page.route("**/api/v1/home/missing-listing", (route) =>
    route.fulfill({ status: 404, json: { message: "Not found" } }),
  );
  await page.goto("/items/missing-listing");

  await expect(page.getByText(/no longer available or the link is invalid/i)).toBeVisible();
  await expect(page.getByText("A useful desk")).toHaveCount(0);
});
