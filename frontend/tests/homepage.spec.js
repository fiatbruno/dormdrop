// @ts-check
import { test, expect } from "@playwright/test";

const listings = [
  { id: "cow-1", title: "Cow poster", category: "Decor", description: "A poster", price: 5, condition: "Good", listingType: "For sale", status: "AVAILABLE" },
  { id: "desk-1", title: "Desk", category: "Furniture", description: "A desk", price: 20, condition: "Good", listingType: "For sale", status: "AVAILABLE" },
];

test.beforeEach(async ({ page }) => {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600,
    id: "buyer-1",
  })).toString("base64url");
  await page.addInitScript((token) => localStorage.setItem("token", token), `test.${payload}.signature`);
  await page.route("**/api/v1/admin/users**", (route) => route.fulfill({ status: 403 }));
  await page.route("**/api/v1/me/notifications/unread-count", (route) => route.fulfill({ json: { count: 0 } }));
  await page.route("**/api/v1/conversations", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/favorites", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/home**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase();
    return route.fulfill({
      json: query ? listings.filter((item) => item.title.toLowerCase().includes(query)) : listings,
    });
  });
  await page.goto("/home");
});

test("homepage has the DormDrop title", async ({ page }) => {
  await expect(page).toHaveTitle(/DormDrop/);
});

test("search shows matching marketplace products", async ({ page }) => {
  await expect(page.getByRole("link", { name: "Desk", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search the marketplace" }).fill("Cow");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Cow poster", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Desk", exact: true })).toHaveCount(0);
});
