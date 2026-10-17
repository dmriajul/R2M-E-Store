import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { RETURN_STATUSES, RETURNS_AUTO_REFRESH_KEY } from "../../lib/admin-returns";
import type { ReturnRequestRecord } from "../../types";

function fixtures(count = 80): ReturnRequestRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `RET-2026-${String(i + 1).padStart(5, "0")}`, orderId: `order-${i + 1}`, orderNumber: `LL-2026-${i + 1}`, userId: `user-${i}`, customerName: `Customer ${i + 1}${i === 0 ? " with a very long name that should wrap safely" : ""}`, customerEmail: `customer-${i}@example.com`, customerPhone: "01700000000", orderItemId: `line-${i}`, itemName: i === 0 ? "Winter jacket with a very long product description" : "Gold jacket", itemColor: "Gold", itemSize: "M", quantity: 1, type: i % 2 ? "EXCHANGE" : "REFUND", reason: "The item does not fit", details: "Please help with this request.", images: i === 0 ? ["/missing-return-proof.jpg"] : [], status: RETURN_STATUSES[i % 5]!, createdAt: new Date(Date.now() - (i + 4) * 86400000).toISOString(), updatedAt: new Date().toISOString(),
  }));
}
async function setup(page: Page, count = 80) {
  const state = { rows: fixtures(count), listCalls: 0, urls: [] as string[], failGet: false, failPatch: false, delay: 0, patchDelay: 0, patches: [] as unknown[] };
  const csrfResponse = await page.request.get("/api/auth/csrf");
  const csrf = await csrfResponse.json() as { csrfToken: string };
  const login = await page.request.post("/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email: "support@mukra.com", password: "password123" }, maxRedirects: 0 });
  expect(login.status()).toBe(302);
  await page.route("**/api/admin/returns**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON() as { action: string; adminNote?: string };
      state.patches.push(payload);
      if (state.patchDelay) await new Promise((resolve) => setTimeout(resolve, state.patchDelay));
      if (state.failPatch) { await route.fulfill({ status: 409, json: { success: false, error: "This request has already been reviewed", data: null } }); return; }
      const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
      const item = state.rows.find((r) => r.id === id)!;
      item.status = payload.action === "approve" ? "APPROVED" : payload.action === "reject" ? "REJECTED" : "COMPLETED";
      if (payload.adminNote) item.adminNote = payload.adminNote;
      await route.fulfill({ json: { success: true, data: { request: item, notification: "Updated" }, error: null } }); return;
    }
    if (url.searchParams.get("countOnly")) { await route.fulfill({ json: { data: state.rows.filter((r) => r.status === "PENDING").length, success: true, error: null } }); return; }
    state.listCalls++;
    state.urls.push(url.toString());
    if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
    if (state.failGet) { await route.fulfill({ status: 503, json: { success: false, error: "Test database unavailable", data: null } }); return; }
    let rows = state.rows;
    const q = url.searchParams.get("q")?.toLowerCase();
    const statuses = url.searchParams.get("status")?.split(",");
    const type = url.searchParams.get("type");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (q) rows = rows.filter((r) => `${r.customerName} ${r.orderNumber} ${r.id}`.toLowerCase().includes(q.replace(/^#/, "")));
    if (statuses) rows = rows.filter((r) => statuses.includes(r.status));
    if (type) rows = rows.filter((r) => r.type === type);
    if (from) rows = rows.filter((r) => r.createdAt.slice(0, 10) >= from);
    if (to) rows = rows.filter((r) => r.createdAt.slice(0, 10) <= to);
    const cursor = url.searchParams.get("cursor");
    const start = cursor ? rows.findIndex((r) => r.id === cursor) + 1 : 0;
    const size = Number(url.searchParams.get("pageSize") ?? 20);
    const data = rows.slice(start, start + size);
    await route.fulfill({ json: { data, pagination: { total: rows.length, pageSize: size, nextCursor: start + size < rows.length ? data.at(-1)?.id : null }, summary: { total: state.rows.length, pending: state.rows.filter((r) => r.status === "PENDING").length, urgent: state.rows.filter((r) => r.status === "PENDING").length }, success: true, error: null } });
  });
  return state;
}
async function ready(page: Page) {
  await page.goto("/admin/returns");
  await expect(page.getByTestId("returns-page").getByText("Showing 20 of 80 requests", { exact: true })).toBeVisible();
}
const viewports = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14 Pro", width: 393, height: 852 },
  { name: "Samsung Galaxy S23", width: 360, height: 780 },
  { name: "iPad Air", width: 820, height: 1180 },
  { name: "Desktop", width: 1920, height: 1080 },
  { name: "Narrow phone", width: 320, height: 640 },
  { name: "Desktop breakpoint", width: 1024, height: 900 },
];
for (const viewport of viewports) {
  test(`${viewport.name}: responsive layout, no page overflow, touch targets and WCAG checks`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await setup(page);
    await ready(page);
    const root = page.getByTestId("returns-page");
    if (viewport.width < 640) {
      await expect(page.getByTestId("mobile-returns")).toBeVisible();
      await expect(page.getByTestId("returns-table-scroll")).toHaveCount(0);
      await expect(root.getByRole("button", { name: "Refresh returns", exact: true })).toBeVisible();
      await root.getByRole("button", { name: "Expand #RET-2026-00001", exact: true }).click();
      await expect(root.getByText("Please help with this request.", { exact: true }).first()).toBeVisible();
    } else {
      await expect(page.getByTestId("returns-table-scroll")).toBeVisible();
      await expect(page.getByTestId("mobile-returns")).toHaveCount(0);
    }
    if (viewport.name === "iPad Air") {
      const region = page.getByTestId("returns-table-scroll");
      const before = await region.locator("tbody th").first().evaluate((e) => e.getBoundingClientRect().left);
      await region.evaluate((e) => { e.scrollLeft = 100; e.scrollTop = 200; });
      expect(await region.locator("tbody th").first().evaluate((e) => e.getBoundingClientRect().left)).toBeCloseTo(before, 0);
      const top = await region.evaluate((e) => e.getBoundingClientRect().top);
      expect(await region.locator("thead").evaluate((e) => e.getBoundingClientRect().top)).toBeCloseTo(top + 1, 0);
    }
    if (viewport.width < 640) {
      await expect(root.getByLabel("From date (UTC)", { exact: true })).toBeHidden();
      await root.getByRole("button", { name: "More filters", exact: true }).click();
      await expect(root.getByLabel("From date (UTC)", { exact: true })).toBeVisible();
      await root.getByRole("button", { name: "Hide filters", exact: true }).click();
    }
    const sizes = await root.locator("button:visible").evaluateAll((buttons) => buttons.map((b) => ({ label: b.getAttribute("aria-label") ?? b.textContent, width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height })));
    expect(sizes.filter((s) => s.height < 43.9 || s.width < 43.9)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const audit = await new AxeBuilder({ page }).include('[data-testid="returns-page"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  });
}

test("refresh, skeleton, success toast and keyboard shortcut excluding text inputs", async ({ page }) => {
  const state = await setup(page);
  state.delay = 700;
  await page.goto("/admin/returns");
  await expect(page.getByTestId("returns-skeleton")).toBeVisible();
  await expect(page.getByText("Showing 20 of 80 requests", { exact: true })).toBeVisible();
  const before = state.listCalls;
  await page.getByTestId("returns-page").getByRole("button", { name: "Refresh returns", exact: true }).click();
  await expect(page.getByTestId("returns-page").getByRole("button", { name: "Refresh returns", exact: true })).toBeDisabled();
  await expect(page.getByText("Returns list updated", { exact: true })).toBeVisible();
  expect(state.listCalls).toBe(before + 1);
  await page.locator("#returns-title").focus();
  await page.keyboard.press("r");
  await expect.poll(() => state.listCalls).toBe(before + 2);
  await expect(page.getByTestId("returns-page").getByRole("button", { name: "Refresh returns", exact: true })).toBeEnabled();
  const search = page.getByRole("searchbox", { name: "Search by customer, order ID or request ID" });
  await search.focus();
  await page.keyboard.press("r");
  await search.fill("");
  await page.waitForTimeout(400);
  expect(state.listCalls).toBe(before + 2);
});

test("auto-refresh preference persists and refreshes every 30 seconds", async ({ page }) => {
  const state = await setup(page);
  await ready(page);
  await page.clock.install();
  const toggle = page.getByRole("switch", { name: "Auto-refresh every 30 seconds" });
  await toggle.check();
  expect(await page.evaluate((key) => localStorage.getItem(key), RETURNS_AUTO_REFRESH_KEY)).toBe("true");
  const before = state.listCalls;
  await page.clock.fastForward(30000);
  await expect.poll(() => state.listCalls).toBe(before + 1);
  await page.reload();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  const after = state.listCalls;
  await page.clock.fastForward(60000);
  expect(state.listCalls).toBe(after);
});

test("mobile pull-to-refresh triggers exactly one fresh request", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const state = await setup(page);
  await ready(page);
  const before = state.listCalls;
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const element = document.querySelector('[data-testid="returns-page"]')!;
    const dispatch = (type: string, y: number, end = false) => {
      const touch = new Touch({ identifier: 1, target: element, clientX: 100, clientY: y });
      element.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: end ? [] : [touch], changedTouches: [touch] }));
    };
    dispatch("touchstart", 100); dispatch("touchmove", 240);
  });
  await expect(page.getByText("Release to refresh", { exact: true })).toBeVisible();
  await page.evaluate(() => document.querySelector('[data-testid="returns-page"]')!.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [] })));
  await expect.poll(() => state.listCalls).toBe(before + 1);
  await expect(page.getByText("Returns list updated", { exact: true })).toBeVisible();
});

test("search is debounced; multi-select, type/date filters and removable chips reach API", async ({ page }) => {
  const state = await setup(page);
  await ready(page);
  const root = page.getByTestId("returns-page");
  const before = state.listCalls;
  await root.getByRole("searchbox").fill("Customer 12");
  await page.waitForTimeout(100);
  expect(state.listCalls).toBe(before);
  await expect.poll(() => state.listCalls).toBe(before + 1);
  expect(new URL(state.urls.at(-1)!).searchParams.get("q")).toBe("Customer 12");
  await root.getByRole("button", { name: "Remove filter Search: Customer 12", exact: true }).click();
  await expect(root.getByText("Showing 20 of 80 requests", { exact: true })).toBeVisible();
  const statuses = root.getByRole("group", { name: "Filter by status; select one or more" });
  await statuses.getByRole("button", { name: "Pending", exact: true }).click();
  await statuses.getByRole("button", { name: "Received", exact: true }).click();
  await root.getByLabel("Request type", { exact: true }).selectOption("EXCHANGE");
  await root.getByLabel("From date (UTC)", { exact: true }).fill("2020-01-01");
  await expect.poll(() => {
    const params = new URL(state.urls.at(-1)!).searchParams;
    return [params.get("status"), params.get("type"), params.get("from")];
  }).toEqual(["PENDING,RECEIVED", "EXCHANGE", "2020-01-01"]);
  await expect(root.getByRole("button", { name: "Remove filter Received", exact: true })).toBeVisible();
  await root.getByRole("button", { name: "Clear all filters", exact: true }).click();
  await expect(root.getByText("Showing 20 of 80 requests", { exact: true })).toBeVisible();
});

test("approve/reject confirmation, optimistic state, rollback, and broken image fallback", async ({ page }) => {
  const state = await setup(page);
  state.patchDelay = 1000;
  await ready(page);
  const root = page.getByTestId("returns-page");
  await root.getByRole("button", { name: "View details for #RET-2026-00001", exact: true }).click();
  await expect(page.getByRole("img", { name: "Evidence image 1 unavailable", exact: true })).toBeVisible();
  const dialogAudit = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(dialogAudit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  await page.keyboard.press("Escape");
  await root.getByRole("button", { name: "Approve #RET-2026-00001", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.patches).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
  const first = root.locator("tbody tr").filter({ hasText: "#RET-2026-00001" });
  await expect(first.getByText("Approved", { exact: true })).toBeVisible();
  await expect(page.getByText("Return #RET-2026-00001 approved", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await root.getByRole("button", { name: "Reject #RET-2026-00006", exact: true }).click();
  await page.getByRole("button", { name: "Confirm rejection", exact: true }).click();
  await expect(page.getByText("Add a rejection note of at least 5 characters.", { exact: true })).toBeVisible();
  expect(state.patches).toHaveLength(1);
  await page.getByLabel("Reason for rejection", { exact: false }).fill("Outside the return window");
  state.failPatch = true;
  await page.getByRole("button", { name: "Confirm rejection", exact: true }).click();
  const sixth = root.locator("tbody tr").filter({ hasText: "#RET-2026-00006" });
  await expect(sixth.getByText("Rejected", { exact: true })).toBeVisible();
  await expect(page.getByText("This request has already been reviewed", { exact: true })).toBeVisible();
  await expect(sixth.getByText("Pending", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("API error retains stale rows, retry recovers, offline indicator is explicit", async ({ page, context }) => {
  const state = await setup(page);
  await ready(page);
  state.failGet = true;
  await page.getByTestId("returns-page").getByRole("button", { name: "Refresh returns", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Failed to load returns. Try again." })).toBeVisible();
  await expect(page.getByText("Showing 20 of 80 requests", { exact: true })).toBeVisible();
  state.failGet = false;
  await page.getByRole("button", { name: "Retry loading returns", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry loading returns", exact: true })).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByText("You are offline. Showing the last loaded requests. Changes and refresh are paused until you reconnect.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("returns-page").getByRole("button", { name: "Refresh returns", exact: true })).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByText("You are offline. Showing the last loaded requests. Changes and refresh are paused until you reconnect.", { exact: true })).toHaveCount(0);
});

test("empty state has guidance and a working policy destination", async ({ page }) => {
  await setup(page, 0);
  await page.goto("/admin/returns");
  await expect(page.getByRole("heading", { name: "No return requests yet", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View return policy", exact: true })).toHaveAttribute("href", "/returns");
});

test("pagination fetches 20 at a time, virtualizes long table and exports all filtered rows", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await setup(page);
  await ready(page);
  const root = page.getByTestId("returns-page");
  await root.getByRole("button", { name: "Load 20 more", exact: true }).click();
  await expect(root.getByText("Showing 40 of 80 requests", { exact: true })).toBeVisible();
  await root.getByRole("button", { name: "Load 20 more", exact: true }).click();
  await expect(root.getByText("Showing 60 of 80 requests", { exact: true })).toBeVisible();
  expect(await root.getByRole("table").locator("tbody tr[data-index]").count()).toBeLessThan(60);
  await page.getByTestId("returns-table-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(root.getByText("#RET-2026-00060", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await root.getByRole("button", { name: "Export all filtered returns as CSV", exact: true }).click();
  const result = await download;
  const stream = await result.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += String(chunk);
  expect(content).toContain('"RET-2026-00080"');
});

test("mobile virtualized cards expand and remain bounded after load more", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await setup(page);
  await ready(page);
  const root = page.getByTestId("returns-page");
  await root.getByRole("button", { name: "Load 20 more", exact: true }).click();
  await expect(root.getByText("Showing 40 of 80 requests", { exact: true })).toBeVisible();
  await root.getByRole("button", { name: "Load 20 more", exact: true }).click();
  await expect(root.getByText("Showing 60 of 80 requests", { exact: true })).toBeVisible();
  expect(await root.getByTestId("return-card").count()).toBeLessThan(60);
  await page.evaluate(() => window.scrollTo(0, 0));
  await root.getByRole("button", { name: "Expand #RET-2026-00001", exact: true }).click();
  await expect(root.getByText("Please help with this request.", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("successful rejection and completion sync with server; confirmation cancel does not PATCH", async ({ page }) => {
  const state = await setup(page);
  await ready(page);
  const root = page.getByTestId("returns-page");
  await root.getByRole("button", { name: "Reject #RET-2026-00001", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(state.patches).toHaveLength(0);
  await root.getByRole("button", { name: "Reject #RET-2026-00001", exact: true }).click();
  await page.getByRole("textbox", { name: "Reason for rejection (required)", exact: true }).fill("Outside the return window");
  await page.getByRole("button", { name: "Confirm rejection", exact: true }).click();
  await expect(page.getByText("Return #RET-2026-00001 rejected", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await root.getByRole("button", { name: "View details for #RET-2026-00002", exact: true }).click();
  await page.getByRole("button", { name: "Mark completed", exact: true }).click();
  await page.getByRole("button", { name: "Confirm completion", exact: true }).click();
  await expect(page.getByText("Return #RET-2026-00002 completed", { exact: true })).toBeVisible();
  expect(state.patches).toEqual([{ action: "reject", adminNote: "Outside the return window" }, { action: "complete" }]);
});

test("real API rejects anonymous requests and invalid filters with explicit JSON responses", async ({ page, request }) => {
  const anonymous = await request.get("/api/admin/returns");
  expect(anonymous.status()).toBe(401);
  await setup(page);
  const invalid = await page.request.get("/api/admin/returns?status=UNKNOWN");
  expect(invalid.status()).toBe(400);
  expect(invalid.headers()["cache-control"]).toContain("no-store");
  expect((await invalid.json() as { success: boolean }).success).toBe(false);
});
