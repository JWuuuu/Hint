import { mockDailyTarot } from "./daily-tarot-fixture";
import { test, expect } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-29T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint-language", "en");
    localStorage.setItem("hint.preferences.v1", JSON.stringify({ reduceMotion: true, soundAndHaptics: false }));
  });
});

test("Today retries after reconnect even when the old request fails afterward", async ({ page }) => {
  await mockDailyTarot(page);
  let release!: () => void;
  const oldConnection = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  await page.route("**/api/daily-receipts/get-or-create", async route => {
    if (++reads === 1) {
      await oldConnection;
      return route.fulfill({ status: 503, json: { error: "old connection" } });
    }
    return route.fallback();
  });
  await page.goto("/app?hintPreview=embedded");
  await expect.poll(() => reads).toBe(1);
  await expect(page.getByTestId("home-reveal-action")).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  release();
  await expect(page.getByTestId("home-reveal-action")).toBeEnabled();
  expect(reads).toBe(2);
  await expect(page.getByTestId("home-daily-reveal")).toHaveCount(0);
  await expect(page.locator(".hint-home-hero")).toHaveAttribute("data-daily-card-id", "17-star");
  await page.getByTestId("home-reveal-action").click();
  await expect(page.getByTestId("home-daily-reveal")).toBeVisible();
});

test("a failed reveal remains explained after restore until the reader retries", async ({ page }) => {
  await mockDailyTarot(page);
  let opens = 0;
  let reads = 0;
  await page.route("**/api/daily-receipts/get-or-create", async route => { reads++; return route.fallback(); });
  await page.route("**/api/daily-receipts/open", async route => {
    if (++opens === 1) return route.fulfill({ status: 503, json: { error: "open failed" } });
    return route.fallback();
  });
  await page.goto("/app?hintPreview=embedded");
  await page.getByTestId("home-reveal-action").click();
  await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
  // The extra focus restore proves a successful refresh cannot erase the failed action.
  const refreshed = page.waitForResponse(response => response.url().endsWith("/get-or-create") && response.ok());
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refreshed;
  await expect(page.locator(".hint-home-sync-status")).toBeVisible();
  await expect(page.locator(".hint-home-sync-status")).toHaveText("Your card couldn't be opened. Please try again.");
  await expect(page.getByTestId("home-daily-reveal")).toHaveCount(0);
  await expect(page.getByTestId("home-reveal-action")).toBeEnabled();
  await page.getByTestId("home-reveal-action").click();
  await expect(page.getByTestId("home-daily-reveal")).toBeVisible();
  await expect(page.locator(".hint-home-sync-status")).toHaveCount(0);
  expect(opens).toBe(2);
});

test("restore clears the failure when the server had saved the reveal before its response was lost", async ({ page }) => {
  const receipts = await mockDailyTarot(page);
  let opens = 0;
  await page.route("**/api/daily-receipts/open", async route => {
    opens++;
    const receipt = receipts.get("daily-card:2026-09-29")!;
    receipt.openedAt = "2026-09-29T12:00:00.000Z";
    return route.fulfill({ status: 503, json: { error: "response lost after save" } });
  });
  await page.goto("/app?hintPreview=embedded");
  await page.getByTestId("home-reveal-action").click();
  await expect(page.locator(".hint-home-hero")).toHaveAttribute("data-revealed", "true");
  await expect(page.locator(".hint-home-sync-status")).toHaveCount(0);
  await expect(page.getByTestId("home-daily-reveal")).toHaveCount(0);
  await page.getByRole("button", { name: "View card again", exact: true }).click();
  await expect(page.getByTestId("home-daily-reveal")).toBeVisible();
  expect(opens).toBe(1);
});
