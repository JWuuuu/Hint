import { test as base, expect } from "@playwright/test";
export { expect };
export type { Page, Route, Locator, TestInfo } from "@playwright/test";

/** Every browser context is fictional; no test may reach a live API. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const prefix = (process.env.HINT_E2E_BASE_PATH ?? "").replace(/\/$/, "");
    if (prefix) {
      const goto = page.goto.bind(page);
      page.goto = (url, options) => goto(url.startsWith("/") && !url.startsWith(`${prefix}/`) ? `${prefix}${url}` : url, options);
    }
    await use(page);
  },
  context: async ({ context }, use) => {
    await context.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "ISOLATED_TEST_UNMOCKED_API" } }));
    await context.addInitScript(() => {
      // Seed a fake persisted session for this test identity. Authentication itself
      // is covered with real middleware + isolated PostgreSQL in backend tests.
      const originalGet = Storage.prototype.getItem;
      const originalSet = Storage.prototype.setItem;
      Storage.prototype.getItem = function(key: string) {
        if (key.startsWith("hint_device_session_v1:") && originalGet.call(this, key) === null) {
          originalSet.call(this, key, JSON.stringify({ token: "isolated-fixture-token-000000000000000000000000000000", ownerId: "isolated-server-owner", expiresAt: "2099-01-01T00:00:00Z" }));
        }
        return originalGet.call(this, key);
      };
    });
    await use(context);
  },
});
