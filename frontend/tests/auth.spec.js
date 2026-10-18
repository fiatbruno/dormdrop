// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
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

  test("empty signup form shows required filed errors", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.getByText("Display name is required")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(
      page.getByText("Password must be at least 8 characters long"),
    ).toBeVisible();
    await expect(page.getByText("Please confirm your password")).toBeVisible();
    await expect(page).toHaveURL("/signup");
  });

  test("fixing mismatched passwords clears the error", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Display name").fill("Sample User");
    await page.getByLabel("email").fill("sample@augustana.edu");
    await page.getByLabel("Password", { exact: true }).fill("passwordsample");
    await page.getByLabel("Confirm password").fill("passwordsample2");

    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await page.getByLabel("confirm password").fill("passwordsample");
    await page.keyboard.press("Tab");
    await expect(page.getByText("Passwords do not match")).toBeHidden();
    await expect(page).toHaveURL("/signup");
  });

  test("rejected login shows the server error message", async ({ page }) => {
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({ status: 401 });
    });

    await page.goto("/login");
    await page.getByLabel("email").fill("sample@augustana.edu");
    await page.getByLabel("password").fill("passwordsample");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("button", { name: "Log In" })).toBeEnabled();
  });
});
