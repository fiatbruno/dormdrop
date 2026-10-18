// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("has title", async ({ page }) => {
    await page.goto("/");

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/DormDrop/);
  });

  test("create an account", async ({page}) => {
    await page.goto("/signup");
    page.locator('#email').fill('sample@augustana.edu');
    page.locator('#password').fill('samplepassword');
    page.locator('text=Create an account').click();

    await expect(page).toHaveURL(/.*verify-email/);
  });

  test("get started link", async ({ page }) => {
    await page.goto("localhost:5173");

    // Click the get started link.
    await page.getByRole("link", { name: "Get started" }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(
      page.getByRole("heading", { name: "Installation" }),
    ).toBeVisible();
  });
});
