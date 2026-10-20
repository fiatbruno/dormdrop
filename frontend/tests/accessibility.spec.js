import { test, expect } from "@playwright/test";



test.describe("Accessibility", () => {
  test.beforeAll(async ({ page }) => {
    await page.goto("/");
  });

  test("all images should have alt text", async ({ page }) => {
    const images = await page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const src = await img.getAttribute("src");

      expect(alt, `Image with src "${src}" should have alt text`).toBeTruthy();
    }
  });

});