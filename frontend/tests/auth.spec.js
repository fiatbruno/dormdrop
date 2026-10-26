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
/** @param {number} expiresAt */
const makeSessionToken = (expiresAt) => {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString(
    "base64url",
  );
  return `test.${payload}.signature`;
};

/** @param {import('@playwright/test').Page} page */
const mockMarketplace = async (page) => {
  await page.route("**/api/v1/home", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/favorites", (route) =>
    route.fulfill({ json: [] }),
  );
};

/** @param {import('@playwright/test').Page} page */
const openVerificationAfterSignup = async (page) => {
  await page.route("**/api/v1/auth/register", (route) =>
    route.fulfill({ status: 201 }),
  );
  await page.goto("/signup");
  await fillSignupForm(page);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL("/verify-email");
};

test.describe("Authentication", () => {
  test.describe("Login", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/login");
    });

    test("signup link opens the registration page", async ({ page }) => {
      await page.getByRole("link", { name: "Create an account" }).click();
      await expect(page).toHaveURL("/signup");
      await expect(
        page.getByRole("heading", { name: "Create your account" }),
      ).toBeVisible();
    });

    test("login rejects a non-campus email", async ({ page }) => {
      await page.getByLabel("email").fill("sample@gmail.com");
      await page.getByLabel("password").fill("samplepassword");
      await page.getByRole("button", { name: "Log In" }).click();
      await expect(
        page.getByText("Campus email must end with .edu"),
      ).toBeVisible();
      await expect(page).toHaveURL("/login");
    });

    test("rejected login shows the server error message", async ({ page }) => {
      await page.route("**/api/v1/auth/login", async (route) => {
        await route.fulfill({ status: 401 });
      });

      await page.getByLabel("email").fill("sample@augustana.edu");
      await page.getByLabel("password").fill("passwordsample");
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page.getByText("Invalid email or password")).toBeVisible();
      await expect(page).toHaveURL("/login");
      await expect(page.getByRole("button", { name: "Log In" })).toBeEnabled();
    });

    test("login prevents another submission while waiting", async ({
      page,
    }) => {
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

      await page.getByLabel("email").fill("sample@augustana.edu");
      await page.getByLabel("Password").fill("passwordsample");

      await page.getByRole("button", { name: "Log In" }).click();

      await expect(
        page.getByRole("button", { name: "Logging in..." }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Logging in..." }),
      ).toBeDisabled();

      releaseResponse();

      const error = page.getByRole("alert");

      await expect(error).toBeVisible();
      await expect(error).toHaveText("Invalid email or password.");
      await expect(page.getByRole("button", { name: "Log In" })).toBeEnabled();
    });
  });

  test.describe("Signup", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/signup");
    });

    test("empty signup form shows required field errors", async ({ page }) => {
      await page.getByRole("button", { name: "Create Account" }).click();
      await expect(page.getByText("Display name is required")).toBeVisible();
      await expect(page.getByText("Enter a valid email address")).toBeVisible();
      await expect(
        page.getByText("Password must be at least 8 characters long"),
      ).toBeVisible();
      await expect(
        page.getByText("Please confirm your password"),
      ).toBeVisible();
      await expect(page).toHaveURL("/signup");
    });

    test("fixing mismatched passwords clears the error", async ({ page }) => {
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

    test("successful signup sends the right data", async ({ page }) => {
      await page.route("**/api/v1/auth/register", async (route) => {
        await route.fulfill({ status: 201 });
      });

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
      await expect(page.getByLabel("email")).toHaveValue(
        "sample@augustana.edu",
      );
      await expect(page.getByLabel("Display name")).toHaveValue("Sample User");
    });
  });

  test("logged out user can't open marketplace", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });
});

// These tokens exercise client-side session handling only; the API is mocked.

test.describe("Authentication gaps", () => {
  test("empty login is rejected without sending credentials", async ({
    page,
  }) => {
    /** @type {import('@playwright/test').Request[]} */
    const requests = [];
    await page.route("**/api/v1/auth/login", (route) => {
      requests.push(route.request());
      return route.fulfill({ status: 401 });
    });
    await page.goto("/login");
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await expect(
      page.getByText("Enter a valid email address", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Password is required", { exact: true }),
    ).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test("login sends trimmed credentials, persists its session, and survives reload", async ({
    page,
  }) => {
    const token = makeSessionToken(Math.floor(Date.now() / 1000) + 3600);
    await mockMarketplace(page);
    await page.route("**/api/v1/auth/login", (route) =>
      route.fulfill({ json: { token } }),
    );
    await page.goto("/login");
    await page.getByLabel("email").fill("  sample@augustana.edu  ");
    await page.getByLabel("Password", { exact: true }).fill("passwordsample");
    const requestPromise = page.waitForRequest("**/api/v1/auth/login");
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    const request = await requestPromise;
    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toEqual({
      email: "sample@augustana.edu",
      password: "passwordsample",
    });
    await expect(page).toHaveURL("/home");
    await expect(
      page.getByRole("searchbox", { name: "Search the marketplace" }),
    ).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("token"))).toBe(
      token,
    );
    await page.reload();
    await expect(
      page.getByRole("searchbox", { name: "Search the marketplace" }),
    ).toBeVisible();
    await expect(page).toHaveURL("/home");
  });

  test("a failed login can be corrected and retried successfully", async ({
    page,
  }) => {
    const token = makeSessionToken(Math.floor(Date.now() / 1000) + 3600);
    await mockMarketplace(page);
    let attempts = 0;
    await page.route("**/api/v1/auth/login", (route) => {
      attempts += 1;
      return attempts === 1
        ? route.fulfill({ status: 401 })
        : route.fulfill({ json: { token } });
    });
    await page.goto("/login");
    await page.getByLabel("email").fill("sample@augustana.edu");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Invalid email or password.",
    );
    await expect(page.getByLabel("email")).toHaveValue("sample@augustana.edu");
    await page.getByLabel("Password", { exact: true }).fill("passwordsample");
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await expect(page).toHaveURL("/home");
    expect(attempts).toBe(2);
  });

  for (const [label, token] of [
    ["malformed", "not-a-token"],
    ["expired", makeSessionToken(1)],
  ]) {
    test(`${label} login tokens do not establish a session`, async ({
      page,
    }) => {
      await page.route("**/api/v1/auth/login", (route) =>
        route.fulfill({ json: { token } }),
      );
      await page.goto("/login");
      await page.getByLabel("email").fill("sample@augustana.edu");
      await page.getByLabel("Password", { exact: true }).fill("passwordsample");
      await page.getByRole("button", { name: "Log In", exact: true }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page).toHaveURL("/login");
      expect(
        await page.evaluate(() => localStorage.getItem("token")),
      ).toBeNull();
    });

    test(`${label} stored sessions are cleared before opening protected pages`, async ({
      page,
    }) => {
      await page.addInitScript((value) => {
        localStorage.setItem("token", value);
        localStorage.setItem("user", JSON.stringify({ name: "Old user" }));
      }, token);
      await page.goto("/home");
      await expect(page).toHaveURL("/login");
      expect(
        await page.evaluate(() => [
          localStorage.getItem("token"),
          localStorage.getItem("user"),
        ]),
      ).toEqual([null, null]);
    });
  }

  for (const path of [
    "/",
    "/profile",
    "/saved-item",
    "/list-an-item",
    "/items/sample",
    "/edit-listing/sample",
    "/messages",
    "/messages/sample",
  ]) {
    test(`logged-out access to ${path} redirects to login`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL("/login");
      await expect(
        page.getByRole("heading", { name: "Welcome back" }),
      ).toBeVisible();
    });
  }

  for (const [field, value, message] of [
    ["email", "not-an-email", "Enter a valid email address"],
    ["email", "sample@gmail.com", "Campus email must end with .edu"],
    ["Password", "1234567", "Password must be at least 8 characters long"],
  ]) {
    test(`signup rejects ${value} without a registration request`, async ({
      page,
    }) => {
      /** @type {import('@playwright/test').Request[]} */
      const requests = [];
      await page.route("**/api/v1/auth/register", (route) => {
        requests.push(route.request());
        return route.fulfill({ status: 201 });
      });
      await page.goto("/signup");
      await fillSignupForm(page);
      await page.getByLabel(field, { exact: field === "Password" }).fill(value);
      if (field === "Password")
        await page.getByLabel("Confirm password").fill(value);
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      await expect(page).toHaveURL("/signup");
      expect(requests).toHaveLength(0);
    });
  }

  test("signup accepts the eight-character password boundary and trims email", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/register", (route) =>
      route.fulfill({ status: 201 }),
    );
    await page.goto("/signup");
    await fillSignupForm(page);
    await page.getByLabel("email").fill("  sample@augustana.edu  ");
    await page.getByLabel("Password", { exact: true }).fill("12345678");
    await page.getByLabel("Confirm password").fill("12345678");
    const requestPromise = page.waitForRequest("**/api/v1/auth/register");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    expect((await requestPromise).postDataJSON()).toEqual({
      name: "Sample User",
      email: "sample@augustana.edu",
      password: "12345678",
    });
    await expect(page).toHaveURL("/verify-email");
    await expect(
      page.getByText("sample@augustana.edu", { exact: true }),
    ).toBeVisible();
  });

  for (const failure of ["server", "network"]) {
    test(`signup recovers from a ${failure} failure and allows retry`, async ({
      page,
    }) => {
      let attempts = 0;
      await page.route("**/api/v1/auth/register", (route) => {
        attempts += 1;
        if (attempts > 1) return route.fulfill({ status: 201 });
        return failure === "network"
          ? route.abort()
          : route.fulfill({ status: 500 });
      });
      await page.goto("/signup");
      await fillSignupForm(page);
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await expect(page.getByRole("alert")).toHaveText(
        "Unable to create your account. Please try again.",
      );
      await expect(page.getByLabel("email")).toHaveValue(
        "sample@augustana.edu",
      );
      await expect(
        page.getByRole("button", { name: "Create account", exact: true }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await expect(page).toHaveURL("/verify-email");
      expect(attempts).toBe(2);
    });
  }

  test("verification without signup state disables resend and offers navigation", async ({
    page,
  }) => {
    await page.goto("/verify-email");
    await expect(
      page.getByRole("button", { name: "Resend verification email" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page).toHaveURL("/signup");
    await page.goto("/verify-email");
    await page
      .getByRole("button", { name: "Already verified? Continue" })
      .click();
    await expect(page).toHaveURL("/login");
  });

  test("resend uses the signup email and recovers from failure", async ({
    page,
  }) => {
    let attempts = 0;
    await page.route("**/api/v1/auth/resend-verification", (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({
        email: "sample@augustana.edu",
      });
      attempts += 1;
      return route.fulfill({ status: attempts === 1 ? 500 : 200 });
    });
    await openVerificationAfterSignup(page);
    const resend = page.getByRole("button", {
      name: "Resend verification email",
    });
    await resend.click();
    await expect(page.getByRole("alert")).toHaveText(
      "Unable to process the request. Please try again later.",
    );
    await expect(resend).toBeEnabled();
    await resend.click();
    await expect(page.getByRole("status")).toHaveText(
      "If your account needs verification, a new link will be sent.",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(resend).toBeEnabled();
    expect(attempts).toBe(2);
  });

  test("expired verification links allow requesting a replacement", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/resend-verification", (route) =>
      route.fulfill({ status: 200 }),
    );
    await page.goto("/verification-expired");
    const resend = page.getByRole("button", {
      name: "Request a New Verification Link",
    });
    await expect(resend).toBeDisabled();
    await page.getByLabel("Campus email").fill("sample@augustana.edu");
    const requestPromise = page.waitForRequest(
      "**/api/v1/auth/resend-verification",
    );
    await resend.click();
    expect((await requestPromise).postDataJSON()).toEqual({
      email: "sample@augustana.edu",
    });
    await expect(page.getByRole("status")).toHaveText(
      "If your account requires verification, a new link will be sent.",
    );
    await page.getByRole("button", { name: "Back to Log In" }).click();
    await expect(page).toHaveURL("/login");
  });
});
