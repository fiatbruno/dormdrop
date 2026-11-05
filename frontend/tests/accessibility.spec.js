import { test, expect } from "@playwright/test";

test("login page images have an alt attribute", async ({ page }) => {
  await page.goto("/login");
  const images = page.locator("img");
  const count = await images.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    const src = await image.getAttribute("src");
    // Empty alt text is valid for decorative images; the attribute must exist.
    expect(await image.getAttribute("alt"), `Image ${src} needs an alt attribute`).not.toBeNull();
  }
});
