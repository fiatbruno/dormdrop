// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("has title", async ({ page }) => {
    await page.goto("/");

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/DormDrop/);
  });

  test("create an account", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL("/signup");
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
  });

  test("login reject an non-campus email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("email").fill("sample@gmail.com");
    await page.getByLabel("password").fill("samplepassword");
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(
      page.getByText("Campus email must end with .edu"),
    ).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("logged out user can't open marketplace", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });
});
