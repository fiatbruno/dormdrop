// @ts-check
import { expect, test } from "@playwright/test";

const listing = {
  id: "65f0c2e5a1b2c3d4e5f67890",
  title: "Sony WH-1000XM4 Headphones",
  price: 120,
  status: "AVAILABLE",
  listingType: "For sale",
  ownerId: "seller-1",
  sellerName: "Alex Morgan",
  image: "",
};

async function openListing(page) {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      id: "buyer-1",
    }),
  ).toString("base64url");
  await page.addInitScript(
    (token) => localStorage.setItem("token", token),
    `test.${payload}.signature`,
  );
  await page.route("**/api/v1/admin/users**", (route) =>
    route.fulfill({ status: 403, json: { message: "Not an administrator" } }),
  );
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/v1/me/notifications**", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/api/v1/home**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/${listing.id}`)) {
      return route.fulfill({ json: listing });
    }
    return route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/favorites", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto(`/items/${listing.id}`);
  await page.getByRole("button", { name: "Report item" }).click();
}

test("report dialog submits the selected reason and shows a moderation confirmation", async ({
  page,
}) => {
  await openListing(page);
  const dialog = page.getByRole("dialog", { name: "Report this listing" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(listing.title)).toBeVisible();
  await expect(
    dialog.getByText("The seller won’t see who submitted the report."),
  ).toBeVisible();

  await dialog.getByLabel("Reason *").selectOption("SUSPECTED_SCAM");
  await dialog
    .getByLabel("What happened? *")
    .fill("The seller asked for a deposit before I could inspect the item.");

  let requestBody;
  let idempotencyKey;
  await page.route(`**/api/v1/home/${listing.id}/reports`, async (route) => {
    requestBody = route.request().postDataJSON();
    idempotencyKey = route.request().headers()["idempotency-key"];
    await route.fulfill({
      status: 201,
      json: {
        reportId: "report-1",
        referenceNumber: "RPT-1042",
        status: "OPEN",
        submittedAt: "2026-11-04T20:00:00Z",
      },
    });
  });

  await dialog.getByRole("button", { name: "Submit report" }).click();
  await expect(
    page.getByRole("heading", { name: "Thanks for speaking up." }),
  ).toBeVisible();
  await expect(page.getByText("Reference RPT-1042")).toBeVisible();
  await expect(
    page.getByText("Reporting a listing does not automatically remove it."),
  ).toBeVisible();
  expect(requestBody).toEqual({
    category: "SUSPECTED_SCAM",
    description:
      "The seller asked for a deposit before I could inspect the item.",
  });
  expect(idempotencyKey).toBeTruthy();

  await page.getByRole("link", { name: "Back to listing" }).click();
  await expect(page.getByRole("button", { name: "Report item" })).toBeVisible();
});

test("report dialog can be dismissed without submitting", async ({ page }) => {
  await openListing(page);
  const dialog = page.getByRole("dialog", { name: "Report this listing" });
  await dialog.getByLabel("What happened? *").fill("Not ready to report.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
});

test("submit shows a validation message when required report fields are missing", async ({
  page,
}) => {
  await openListing(page);
  const dialog = page.getByRole("dialog", { name: "Report this listing" });

  await dialog.getByRole("button", { name: "Submit report" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Choose a reason and tell us what happened before submitting.",
  );

  await dialog
    .getByLabel("What happened? *")
    .fill("The listing appears misleading.");
  await dialog.getByRole("button", { name: "Submit report" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Choose a reason for your report.",
  );

  await dialog.getByLabel("Reason *").selectOption("OTHER");
  await dialog.getByLabel("What happened? *").fill("");
  await dialog.getByRole("button", { name: "Submit report" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Tell us what happened so our team can review it.",
  );
});

test("report submission errors keep the dialog open and preserve entered details", async ({
  page,
}) => {
  await openListing(page);
  const dialog = page.getByRole("dialog", { name: "Report this listing" });
  await dialog.getByLabel("Reason *").selectOption("OTHER");
  await dialog
    .getByLabel("What happened? *")
    .fill("The listing contains misleading information.");
  await page.route(`**/api/v1/home/${listing.id}/reports`, (route) =>
    route.fulfill({
      status: 409,
      json: { message: "You have already reported this listing." },
    }),
  );

  await dialog.getByRole("button", { name: "Submit report" }).click();

  await expect(dialog.getByRole("alert")).toContainText(
    "You have already reported this listing.",
  );
  await expect(dialog.getByLabel("Reason *")).toHaveValue("OTHER");
  await expect(dialog.getByLabel("What happened? *")).toHaveValue(
    "The listing contains misleading information.",
  );
});
