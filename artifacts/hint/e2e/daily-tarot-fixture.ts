import type { Page } from "./fixtures";

/** Explicit fictional server for layout tests. Storage never chooses the card.
 * Real ownership, concurrency and database writes are tested by app-api and API suites.
 * The clock defaults to the page's controlled clock so rollover tests stay deterministic.
 */
export async function mockDailyTarot(page: Page, options: { cardId?: string; opened?: boolean; now?: () => string } = {}) {
  const receipts = new Map<string, Record<string, unknown>>();
  await page.route("**/api/daily-receipts/**", async route => {
    const body = route.request().postDataJSON();
    if (!["daily-card", "daily-tarot"].includes(body.featureType)) return route.fallback();
    const now = options.now?.() ?? await page.evaluate(() => new Date().toISOString());
    const today = now.slice(0, 10);
    const day = body.dailyKey ?? today;
    if (day > today) return route.fulfill({ status: 409, json: { error: "DAILY_READING_NOT_AVAILABLE" } });
    const key = `${body.featureType}:${day}`;
    let receipt = receipts.get(key);
    if (!receipt && day !== today) return route.fulfill({ status: 404, json: { error: "DAILY_READING_NOT_FOUND" } });
    if (!receipt) {
      receipt = { id: `fixture-${key}`, anonymousDeviceId: "isolated-server-owner", userId: "isolated-server-owner",
        featureType: body.featureType, dailyKey: day, assignedCardId: options.cardId ?? "17-star",
        orientation: "upright", assignedAt: now, expiresAt: new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString(),
        openedAt: options.opened ? now : null, source: "server" };
      receipts.set(key, receipt);
    }
    if (route.request().url().endsWith("/sync")) return route.fulfill({ status: 409, json: { error: "UNEXPECTED_CLIENT_SYNC" } });
    if (route.request().url().endsWith("/open")) receipt.openedAt ??= now;
    await route.fulfill({ json: { ...receipt, serverTime: now } });
  });
  return receipts;
}
