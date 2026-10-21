// @ts-check
import { test, expect } from "@playwright/test";

/**
 * @param {import('@playwright/test').Page} page
 */

test.describe("Homepage", () => {

  test.beforeAll(async ({ page }) => {
    await page.goto("/");
    /// should be logged in with a sample user
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/home");
  });

  test("has title", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/DormDrop/);
  });

  test("should filter products when searching", async ({ page }) => {
    const searchInput = page.locator("search"); //supposed to pick up input with type search

    await searchInput.fill("Cow");
    await expect(page.locator('.product-card')).toHaveCount(1);
    await expect(page.locator('.product-card__body h3')).toHaveText("cow");
  });

  
});
