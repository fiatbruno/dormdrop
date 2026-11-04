// @ts-check
import { test, expect } from "@playwright/test";

function makeToken(claims = {}) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims }),
  ).toString("base64url");
  return `test.${payload}.signature`;
}

async function loginAs(page, claims = {}) {
  await page.addInitScript((token) => localStorage.setItem("token", token), makeToken(claims));
  await page.route("**/api/v1/me/notifications/unread-count", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
}

async function openReportForm(page) {
  await page.route("**/api/v1/home/listing-1", (route) =>
    route.fulfill({
      json: {
        id: "listing-1",
        title: "Campus bike",
        description: "Blue commuter bike",
        category: "Sports",
        price: 90,
        listingType: "For sale",
        status: "AVAILABLE",
        ownerId: "seller-1",
        sellerName: "Sam",
      },
    }),
  );
  await page.route("**/api/v1/home", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/favorites", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/items/listing-1");
  await page.getByRole("button", { name: "Report item" }).click();
}

function queuePage(items = [], total = items.length, totalPages = 1, page = 0) {
  return { items, total, page, size: 20, totalPages };
}

function caseDetail(overrides = {}) {
  const base = {
    caseSummary: {
      caseId: "case-1",
      referenceNumber: "DD-1042",
      listingId: "listing-1",
      status: "IN_REVIEW",
      priority: "HIGH",
      assignedTo: null,
      version: 3,
      reportCount: 2,
    },
    reportGroups: [
      {
        snapshotId: "snapshot-1",
        reports: [
          {
            reportId: "report-1",
            reporterId: "private-reporter-id",
            category: "SUSPECTED_SCAM",
            description: "The seller asked for payment outside the app.",
            submittedAt: "2026-10-30T12:00:00Z",
          },
        ],
      },
    ],
    snapshots: [
      {
        id: "snapshot-1",
        listingId: "listing-1",
        sellerId: "private-seller-id",
        listingVersion: 7,
        title: "Campus bike snapshot",
        description: "Original retained listing text.",
        category: "Sports",
        lifecycleStatus: "AVAILABLE",
        capturedAt: "2026-10-30T11:00:00Z",
        mediaKeys: [],
      },
    ],
    seller: { sellerId: "private-seller-id", displayName: "Sam Seller" },
    decisions: [],
    activity: [],
  };
  return {
    ...base,
    ...overrides,
    caseSummary: { ...base.caseSummary, ...overrides.summary },
  };
}

async function setupStaffPage(page, start = "/staff/reports/case-1") {
  await loginAs(page, { id: "moderator-1", roles: ["MODERATOR"] });
  let detailCalls = 0;
  await page.route("**/api/v1/admin/reports/case-1", (route) => {
    detailCalls += 1;
    return route.fulfill({ json: caseDetail() });
  });
  await page.route("**/api/v1/admin/reports**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/case-1")) return route.fallback();
    return route.fulfill({
      json: queuePage(
        [
          {
            caseId: "case-1",
            referenceNumber: "DD-1042",
            status: "IN_REVIEW",
            priority: "HIGH",
            reportCount: 2,
          },
        ],
        1,
        1,
      ),
    });
  });
  await page.goto(start);
  return () => detailCalls;
}

test("valid report sends category, reason, and idempotency key and keeps listing visible", async ({
  page,
}) => {
  await loginAs(page);
  await openReportForm(page);
  await page.getByLabel("Category").selectOption("SUSPECTED_SCAM");
  await page
    .getByLabel("Reason for report")
    .fill("The seller requested a deposit through an outside link.");

  let submitted;
  await page.route("**/api/v1/home/listing-1/reports", async (route) => {
    submitted = {
      body: route.request().postDataJSON(),
      key: route.request().headers()["idempotency-key"],
    };
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({
      status: 201,
      json: {
        reportId: "report-1",
        referenceNumber: "DD-1042",
        status: "OPEN",
        submittedAt: "2026-10-30T12:00:00Z",
      },
    });
  });

  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("button", { name: "Submitting…" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "do not guarantee immediate removal",
  );
  await expect(page.getByRole("heading", { name: "Campus bike" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View your report status" })).toBeVisible();
  expect(submitted).toEqual({
    body: {
      category: "SUSPECTED_SCAM",
      description: "The seller requested a deposit through an outside link.",
    },
    key: expect.any(String),
  });
});

test("report form validates required fields, handles duplicate 409 and preserves retry input", async ({
  page,
}) => {
  await loginAs(page);
  await openReportForm(page);
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("alert")).toContainText("Choose a category");

  await page.getByLabel("Category").selectOption("OTHER");
  await page.getByLabel("Reason for report").fill("Unsafe electrical wiring.");
  await page.route("**/api/v1/home/listing-1/reports", (route) =>
    route.fulfill({
      status: 409,
      json: {
        code: "DUPLICATE_REPORT",
        detailsSaved: false,
        report: { referenceNumber: "DD-1042", status: "OPEN" },
      },
    }),
  );
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("status")).toContainText("already reported");
  await expect(page.getByLabel("Reason for report")).toHaveValue(
    "Unsafe electrical wiring.",
  );
});

test("rate limit and retryable submission errors are explicit and preserve form values", async ({
  page,
}) => {
  await loginAs(page);
  await openReportForm(page);
  await page.getByLabel("Category").selectOption("PROHIBITED_ITEM");
  await page.getByLabel("Reason for report").fill("A prohibited item is listed.");
  let attempts = 0;
  const keys = [];
  await page.route("**/api/v1/home/listing-1/reports", (route) => {
    attempts += 1;
    keys.push(route.request().headers()["idempotency-key"]);
    if (attempts === 1) {
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": "45" },
        json: { message: "Too many reports" },
      });
    }
    if (attempts === 2) {
      return route.fulfill({ status: 503, json: { message: "Unavailable" } });
    }
    return route.fulfill({
      status: 201,
      json: { reportId: "report-2", status: "OPEN" },
    });
  });
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("alert")).toContainText("Please wait");
  await expect(page.getByLabel("Reason for report")).toHaveValue(
    "A prohibited item is listed.",
  );
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("alert")).toContainText("couldn't submit");
  await expect(page.getByLabel("Reason for report")).toHaveValue(
    "A prohibited item is listed.",
  );
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("status")).toContainText("do not guarantee immediate removal");
  expect(new Set(keys).size).toBe(1);
});

test("own report status displays only sanitized fields from the API", async ({
  page,
}) => {
  await loginAs(page);
  await page.route("**/api/v1/me/reports**", (route) =>
    route.fulfill({
      json: [
        {
          reportId: "report-1",
          referenceNumber: "DD-1042",
          status: "IN_REVIEW",
          submittedAt: "2026-10-30T12:00:00Z",
          reporterId: "private-reporter-id",
          internalRationale: "INTERNAL-SECRET",
          staffNotes: "STAFF-SECRET",
          privateEvidenceKeys: ["evidence-secret"],
        },
      ],
    }),
  );
  await page.goto("/my-reports");
  await expect(page.getByRole("heading", { name: "Your report status" })).toBeVisible();
  await expect(page.getByText("Report DD-1042")).toBeVisible();
  await expect(page.getByText("In Review")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("private-reporter-id");
  await expect(page.locator("body")).not.toContainText("INTERNAL-SECRET");
  await expect(page.locator("body")).not.toContainText("STAFF-SECRET");
  await expect(page.locator("body")).not.toContainText("evidence-secret");
});

test("staff queue filters and paginates; report detail shows grouped retained evidence safely", async ({
  page,
}) => {
  await loginAs(page, { id: "moderator-1", roles: ["MODERATOR"] });
  let queueRequests = [];
  await page.route("**/api/v1/admin/reports**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/case-1")) {
      return route.fulfill({ json: caseDetail() });
    }
    queueRequests.push({
      status: url.searchParams.get("status"),
      priority: url.searchParams.get("priority"),
      page: url.searchParams.get("page"),
    });
    const pageNumber = Number(url.searchParams.get("page") || 0);
    return route.fulfill({
      json: queuePage(
        pageNumber === 0
          ? [{ caseId: "case-1", referenceNumber: "DD-1042", status: "IN_REVIEW", priority: "HIGH", reportCount: 2 }]
          : [{ caseId: "case-2", referenceNumber: "DD-1043", status: "OPEN", priority: "LOW", reportCount: 1 }],
        21,
        2,
        pageNumber,
      ),
    });
  });
  await page.goto("/staff/reports/case-1");
  await expect(
    page.getByRole("heading", { name: "Campus bike snapshot", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Snapshot retained; no media is available")).toBeVisible();
  await expect(page.getByText("The seller asked for payment outside the app.")).toBeVisible();
  await expect(page.getByText("Sam Seller")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("private-reporter-id");
  await expect(page.locator("body")).not.toContainText("private-seller-id");
  await expect(page.locator("body")).not.toContainText("private-evidence");

  await page.getByLabel("Status").selectOption("OPEN");
  await expect.poll(() => queueRequests.at(-1)?.status).toBe("OPEN");
  await page.getByLabel("Priority").selectOption("LOW");
  await expect.poll(() => queueRequests.at(-1)?.priority).toBe("LOW");
  await page.getByRole("button", { name: "Next" }).click();
  await expect.poll(() => queueRequests.at(-1)?.page).toBe("1");
});

test("staff evidence media is fetched through the case-scoped authenticated endpoint", async ({
  page,
}) => {
  await loginAs(page, { id: "moderator-1", roles: ["MODERATOR"] });
  await page.route("**/api/v1/admin/reports/case-1", (route) =>
    route.fulfill({
      json: caseDetail({
        snapshots: [
          {
            ...caseDetail().snapshots[0],
            mediaKeys: ["private-media-key"],
          },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/admin/reports**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/case-1")) {
      return route.fallback();
    }
    return route.fulfill({ json: queuePage() });
  });
  let evidenceRequest;
  await page.route(
    "**/api/v1/staff/cases/case-1/snapshots/snapshot-1/media/private-media-key",
    (route) => {
      evidenceRequest = route.request();
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lE8AAAAASUVORK5CYII=",
          "base64",
        ),
      });
    },
  );
  await page.goto("/staff/reports/case-1");
  await expect(
    page.getByRole("img", { name: "Retained listing evidence 1" }),
  ).toBeVisible();
  expect(evidenceRequest.headers()["authorization"]).toMatch(/^Bearer /);
  await expect(page.locator("body")).not.toContainText("private-media-key");
});

test("student deep link to staff reports is denied", async ({ page }) => {
  await loginAs(page, { id: "student-1", roles: ["STUDENT"] });
  let staffCalls = 0;
  await page.route("**/api/v1/admin/reports**", (route) => {
    staffCalls += 1;
    return route.fulfill({ json: queuePage() });
  });

  await page.goto("/staff/reports/case-1");
  await expect(page.getByRole("heading", { name: "Staff access required" })).toBeVisible();
  expect(staffCalls).toBe(0);
});

test("staff-only responses and draft decision text are cleared after permission loss", async ({
  page,
}) => {
  await loginAs(page, { id: "moderator-1", roles: ["MODERATOR"] });
  await page.route("**/api/v1/admin/reports/case-1", (route) =>
    route.fulfill({ json: caseDetail() }),
  );
  await page.route("**/api/v1/admin/reports**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/case-1")) {
      return route.fallback();
    }
    return route.fulfill({ status: 403, json: { message: "Forbidden" } });
  });
  await page.goto("/staff/reports/case-1");
  await expect(page.getByRole("heading", { name: "Staff access required" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("The seller asked for payment");
  await expect(page.locator("body")).not.toContainText("Sam Seller");
});

test("claim sends current expectedVersion and refreshes the case after a stale conflict", async ({
  page,
}) => {
  await loginAs(page, { id: "moderator-1", roles: ["MODERATOR"] });
  let detailCalls = 0;
  let version = 3;
  let latestAssignedTo = null;
  await page.route("**/api/v1/admin/reports/case-1", (route) => {
    detailCalls += 1;
    return route.fulfill({
      json: caseDetail({
        summary: { version, assignedTo: latestAssignedTo },
      }),
    });
  });
  await page.route("**/api/v1/admin/reports**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/case-1")) {
      return route.fallback();
    }
    return route.fulfill({ json: queuePage() });
  });
  let assignment;
  await page.route("**/api/v1/admin/reports/case-1/assignment", (route) => {
    assignment = route.request().postDataJSON();
    version = 4;
    latestAssignedTo = "moderator-1";
    return route.fulfill({ status: 409, json: { message: "Stale version" } });
  });
  await page.goto("/staff/reports/case-1");
  await page.getByRole("button", { name: "Claim case" }).click();
  await expect(page.getByRole("alert")).toContainText("case changed");
  await expect.poll(() => detailCalls).toBeGreaterThan(1);
  expect(assignment).toEqual({ expectedVersion: 3, assigneeId: "moderator-1" });
});

for (const action of ["KEEP", "HIDE", "REMOVE"]) {
  test(`staff ${action.toLowerCase()} decision validates fields and sends versioned idempotent request`, async ({
    page,
  }) => {
    await setupStaffPage(page);
    const actionSelect = page.getByLabel("Action");
    await actionSelect.selectOption(action);
    await page.getByLabel("Policy reason").fill("Violates marketplace policy.");
    await page.getByLabel("Internal rationale").fill("Reviewed the retained evidence.");
    if (action === "REMOVE") {
      await page.getByRole("button", { name: "Record Remove" }).click();
      await expect(page.getByRole("alert")).toContainText("seller notice");
      await expect(page.getByLabel("Seller-visible notice")).toBeVisible();
      await page.getByLabel("Seller-visible notice").fill("Your listing was removed for violating policy.");
    }
    let decisionRequest;
    let decisionCount = 0;
    await page.route("**/api/v1/admin/reports/case-1/decisions", async (route) => {
      decisionCount += 1;
      decisionRequest = {
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      };
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        status: 201,
        json: { decisionId: "decision-1", action, caseVersion: 4 },
      });
    });
    await page.getByRole("button", { name: `Record ${action[0]}${action.slice(1).toLowerCase()}` }).click();
    await expect(page.getByRole("button", { name: "Saving decision…" })).toBeDisabled();
    await expect(page.getByText(`${action[0]}${action.slice(1).toLowerCase()} decision recorded.`)).toBeVisible();
    expect(decisionCount).toBe(1);
    expect(decisionRequest.body).toMatchObject({
      action,
      expectedVersion: 3,
      policyReason: "Violates marketplace policy.",
      internalRationale: "Reviewed the retained evidence.",
    });
    expect(decisionRequest.key).toBeTruthy();
    if (action === "REMOVE") {
      expect(decisionRequest.body.sellerMessage).toBe(
        "Your listing was removed for violating policy.",
      );
    } else {
      expect(decisionRequest.body).not.toHaveProperty("sellerMessage");
    }
  });
}

test("decision conflict refreshes case without dropping entered private staff form values", async ({
  page,
}) => {
  await loginAs(page, { id: "moderator-1", roles: ["MODERATOR"] });
  let detailCalls = 0;
  await page.route("**/api/v1/admin/reports/case-1", (route) => {
    detailCalls += 1;
    return route.fulfill({
      json: caseDetail({ summary: { version: detailCalls > 1 ? 4 : 3 } }),
    });
  });
  await page.route("**/api/v1/admin/reports**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/case-1")) {
      return route.fallback();
    }
    return route.fulfill({ json: queuePage() });
  });
  await page.goto("/staff/reports/case-1");
  await page.getByLabel("Action").selectOption("HIDE");
  await page.getByLabel("Policy reason").fill("Temporary review hold.");
  await page.getByLabel("Internal rationale").fill("Need a second reviewer.");
  await page.route("**/api/v1/admin/reports/case-1/decisions", (route) =>
    route.fulfill({ status: 409, json: { message: "Stale version" } }),
  );
  await page.getByRole("button", { name: "Record Hide" }).click();
  await expect(page.getByRole("alert")).toContainText("case changed");
  await expect(page.getByLabel("Policy reason")).toHaveValue("Temporary review hold.");
  await expect(page.getByLabel("Internal rationale")).toHaveValue("Need a second reviewer.");
  await expect.poll(() => detailCalls).toBeGreaterThan(1);
});
