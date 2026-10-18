// @ts-check
import { test, expect } from "@playwright/test";

/**
 * @param {import('@playwright/test').Page} page
 */
const fillSignupForm = async (page) => {
  await page.getByLabel("Display name").fill("Sample User");
  await page.getByLabel("email").fill("sample@augustana.edu");
  await page.getByLabel("Password", { exact: true }).fill("passwordsample");
  await page.getByLabel("Confirm password").fill("passwordsample");
};

test.describe("Authentication", () => {
  test("has title", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/DormDrop/);
  });

  test("signup link opens the registration page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL("/signup");
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
  });

  test("login rejects an non-campus email", async ({ page }) => {
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

  test("empty signup form shows required field errors", async ({ page }) => {
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

  test("successful signup sends the right data", async ({ page }) => {
    await page.route("**/api/v1/auth/register", async (route) => {
      await route.fulfill({ status: 201 });
    });

    await page.goto("/signup");

    await fillSignupForm(page);

    const requestPromise = page.waitForRequest("**/api/v1/auth/register");

    await page.getByRole("button", { name: "Create Account" }).click();

    const request = await requestPromise;
    const data = request.postDataJSON();

    expect(request.method()).toEqual("POST");
    expect(data.email).toEqual("sample@augustana.edu");
    expect(data.name).toEqual("Sample User");
    expect(data.password).toEqual("passwordsample");
    expect(data).not.toHaveProperty("confirmPassword");
    await expect(page).toHaveURL("/verify-email");
  });

  test("an existing email shows a helpful error", async ({ page }) => {
    await page.route("**/api/v1/auth/register", async (route) => {
      await route.fulfill({ status: 409 });
    });

    await page.goto("/signup");

    await fillSignupForm(page);

    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page.getByRole("alert")).toHaveText(
      "An account with this email already exists. Please log in.",
    );
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL("/signup");
    await expect(
      page.getByRole("button", { name: "Create Account" }),
    ).toBeEnabled();
    await expect(page.getByLabel("email")).toHaveValue("sample@augustana.edu");
    await expect(page.getByLabel("Display name")).toHaveValue("Sample User");
  });

  test("login prevents another submission while waiting", async ({ page }) => {
    /** @type {() => void} */
    let releaseResponse = () => {};

    /** @type {Promise<void>} */
    const responseGate = new Promise((resolve) => {
      releaseResponse = () => resolve();
    });

    await page.route("**/api/v1/auth/login", async (route) => {
      await responseGate;
      await route.fulfill({ status: 401 });
    });
    await page.goto("/login");

    await page.getByLabel("email").fill("sample@augustana.edu");
    await page.getByLabel("Password").fill("passwordsample");

    await page.getByRole("button", { name: "Log In" }).click();

    await expect(page.getByRole("button", { name: "Logging in..." })).toHaveText(
      "Logging in...",
    );
    await expect(page.getByRole("button", { name: "Logging in..." })).toBeDisabled();

    releaseResponse();

    const error = page.getByRole("alert");

    await expect(error).toBeVisible();
    await expect(error).toHaveText("Invalid email or password.");
    await expect(page.getByRole("button", { name: "Log In" })).toBeEnabled();
  });
});
