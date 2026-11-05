// @ts-check
import { expect, test } from "@playwright/test";

const desk = {
  id: "desk-1", title: "Wooden desk", description: "For a dorm room",
  category: "Furniture", price: 50, condition: "Good", status: "AVAILABLE",
  listingType: "For sale",
};
const book = {
  id: "book-1", title: "Desk reference", description: "A textbook",
  category: "Textbooks", price: 10, condition: "Good", status: "AVAILABLE",
  listingType: "For sale",
};

async function prepare(page) {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600, id: "buyer-1",
  })).toString("base64url");
  await page.addInitScript((token) => localStorage.setItem("token", token),
    `test.${payload}.signature`);
  await page.route("**/api/v1/admin/users**", (route) => route.fulfill({ status: 403 }));
  await page.route("**/api/v1/me/notifications/unread-count", (route) => route.fulfill({ json: { count: 0 } }));
  await page.route("**/api/v1/favorites", (route) => route.fulfill({ json: [] }));
}

test("keyword search reaches the server and retains the selected filter", async ({ page }) => {
  await prepare(page);
  const queries = [];
  await page.route("**/api/v1/home**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    queries.push(query);
    return route.fulfill({ json: [desk, book] });
  });
  await page.goto("/home");
  await expect(page.getByText("Wooden desk")).toBeVisible();
  await page.getByRole("button", { name: "Furniture", exact: true }).click();
  const input = page.getByRole("searchbox", { name: "Search the marketplace" });
  await input.fill("DeSk");
  await expect.poll(() => queries.includes("DeSk")).toBe(true);
  await expect(page.getByText("Wooden desk")).toBeVisible();
  await expect(page.getByText("Desk reference")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Furniture", exact: true })).toHaveAttribute("aria-pressed", "true");
  await input.clear();
  await expect.poll(() => queries.filter((value) => value === null).length).toBeGreaterThan(1);
  await expect(page.getByText("Wooden desk")).toBeVisible();
});

test("a stale search cannot replace a newer search", async ({ page }) => {
  await prepare(page);
  let releaseOld;
  const oldResponse = new Promise((resolve) => { releaseOld = resolve; });
  let sawOld = false;
  await page.route("**/api/v1/home**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "old") {
      sawOld = true;
      await oldResponse;
      await route.fulfill({ json: [desk] }).catch(() => {});
    } else {
      await route.fulfill({ json: query === "new" ? [book] : [] });
    }
  });
  await page.goto("/home");
  const input = page.getByRole("searchbox", { name: "Search the marketplace" });
  await input.fill("old");
  await expect.poll(() => sawOld).toBe(true);
  await input.fill("new");
  await expect(page.getByText("Desk reference")).toBeVisible();
  releaseOld();
  await expect(page.getByText("Wooden desk")).toHaveCount(0);
  await expect(page.getByText("Desk reference")).toBeVisible();
});

test("empty results and search errors are recoverable", async ({ page }) => {
  await prepare(page);
  let fail = true;
  await page.route("**/api/v1/home**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "retry" && fail) return route.fulfill({ status: 503 });
    return route.fulfill({ json: query === "retry" ? [desk] : [] });
  });
  await page.goto("/home");
  const input = page.getByRole("searchbox", { name: "Search the marketplace" });
  await input.fill("no match");
  await expect(page.getByText(/No listings found/)).toBeVisible();
  await input.fill("retry");
  await expect(page.getByRole("alert")).toContainText("Unable to load listings");
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Wooden desk")).toBeVisible();
});
