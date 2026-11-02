// @ts-check
import { expect, test } from "@playwright/test";

test("seller can counter an offer with a different price up to asking price", async ({
  page,
}) => {
  const conversation = {
    id: "conversation-1",
    currentUserId: "seller-1",
    participant: { name: "Jamie", emailVerified: true },
    listing: {
      id: "listing-1",
      ownerId: "seller-1",
      title: "Compact Mini Fridge",
      price: 80,
      listingType: "For Sale",
      status: "ACTIVE",
      imageUrl: "",
    },
    offer: {
      id: "offer-1",
      amount: 60,
      status: "PENDING",
    },
  };
  let submittedOffer;

  await page.addInitScript(() => {
    const payload = btoa(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    );
    localStorage.setItem("token", `header.${payload}.signature`);
  });
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/conversations/conversation-1/messages", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/conversations/conversation-1", (route) =>
    route.fulfill({ json: conversation }),
  );
  await page.route(
    "**/api/v1/offers/offer-1/counteroffer",
    async (route) => {
      submittedOffer = route.request().postDataJSON();
      await route.fulfill({ json: { ...conversation.offer, amount: 70 } });
    },
  );

  await page.goto("/messages/conversation-1");
  await page.getByRole("button", { name: "Send counteroffer" }).click();

  const dialog = page.getByRole("dialog", { name: "Send a counteroffer" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Jamie's offer: $60", { exact: false })).toBeVisible();
  await expect(dialog.getByLabel("Your offer")).toHaveValue("70.00");
  await expect(
    dialog.getByText("Jamie offered $60. Enter your counter price, up to $80."),
  ).toBeVisible();

  const amount = dialog.getByLabel("Your offer");
  const submit = dialog.getByRole("button", { name: "Send counteroffer" });
  await amount.fill("80.01");
  await expect(submit).toBeDisabled();
  await amount.fill("60");
  await expect(submit).toBeDisabled();
  await amount.fill("70");

  const counterofferRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/v1/offers/offer-1/counteroffer") &&
      request.method() === "POST",
  );
  await submit.click();
  const request = await counterofferRequest;
  expect(request.postDataJSON()).toEqual({ amount: 70 });
  expect(submittedOffer).toEqual({ amount: 70 });
  await expect(dialog).toBeHidden();
});
