import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { expect, webkit } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "test-results/tarot-startup");
const rounds = Number(process.env.HINT_STARTUP_ROUNDS ?? 3);
assert(Number.isInteger(rounds) && rounds > 0 && rounds <= 10, "Use 1-10 startup rounds.");
const devices = [
  { name: "pro-max", width: 440, height: 956 },
  { name: "se", width: 375, height: 667 },
];
const results = [];
await mkdir(output, { recursive: true });
const browser = await webkit.launch();

async function seed(context) {
  await context.addInitScript(() => {
    localStorage.setItem("hint_onboarding_complete_v3", "1");
    localStorage.setItem("hint_local_auth_v1", JSON.stringify({
      identifier: "startup@hint.local", provider: "email", email: "startup@hint.local",
      name: "Startup Test", verifiedAt: "2026-09-07T00:00:00.000Z",
      createdAt: "2026-09-07T00:00:00.000Z", lastSignedInAt: "2026-09-07T00:00:00.000Z",
    }));
  });
  await context.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const data = url.pathname === "/api/tarot/spread-recommendation"
      ? { spreadType: "three", reason: "Three cards keep this question focused.",
          focusLabel: "Clear signal", confidence: "high", source: "api" }
      : url.pathname === "/api/profile"
        ? { anonId: url.searchParams.get("anonId") ?? "startup", name: "Startup Test",
            birthDate: "1996-08-18", birthTime: null, birthPlace: null,
            createdAt: "2026-09-07T00:00:00.000Z" }
        : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
}

try {
  for (let round = 1; round <= rounds; round += 1) {
    for (const device of devices) {
      // Each case owns an empty cache; never clear the user's running preview cache.
      const cacheDir = await mkdtemp(resolve(root, "node_modules/.vite-tarot-startup-"));
      const logs = [];
      const errors = [];
      const result = { round, device: device.name, passed: false, logs, errors };
      let server;
      let context;
      try {
        server = await createServer({
          configFile: resolve(root, "vite.config.ts"),
          cacheDir,
          customLogger: {
            info: (message) => logs.push(message),
            warn: (message) => logs.push(message),
            warnOnce: (message) => logs.push(message),
            error: (message) => errors.push(message),
            clearScreen() {}, hasErrorLogged: () => false, hasWarned: false,
          },
          // Exercise normal dependency discovery/HMR, but ignore unrelated file edits.
          server: { port: 0, host: "127.0.0.1", strictPort: true, hmr: true, watch: null },
        });
        await server.listen();
        const address = server.httpServer.address();
        assert(address && typeof address === "object", "Missing startup server address.");
        const url = `http://127.0.0.1:${address.port}/app/tarot?hintPreview=embedded`;
        context = await browser.newContext({
          viewport: { width: device.width, height: device.height },
          isMobile: true, hasTouch: true, locale: "en-US",
        });
        await seed(context);
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        const navigations = [];
        page.on("framenavigated", (frame) => {
          if (frame === page.mainFrame()) navigations.push(frame.url());
        });
        await page.goto(url);
        const question = page.getByPlaceholder("Type your question...");
        await expect(question).toBeVisible({ timeout: 30_000 });
        await question.fill("What should I notice today?");
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.getByRole("button", { name: "Use this spread" })).toBeVisible();
        await page.getByRole("button", { name: "Next spread" }).click();
        await page.getByRole("button", { name: "Previous spread" }).click();
        await page.getByRole("button", { name: "Use this spread" }).click();
        await page.getByRole("button", { name: /Begin the ritual/i }).click();
        await page.getByRole("button", { name: "Auto Wash" }).click();
        await expect(page.getByRole("button", { name: /Lift card/ }).first()).toBeVisible({ timeout: 20_000 });
        assert.equal(navigations.length, 1, `Unexpected cold-start reload: ${navigations.join(", ")}`);
        await page.screenshot({ path: resolve(output, `${device.name}-${round}-arc.png`) });
        // A warm reload must restore the stable stage without acquiring another React instance.
        await page.reload();
        await expect(page.getByRole("button", { name: /Lift card/ }).first()).toBeVisible({ timeout: 20_000 });
        assert.equal(navigations.length, 2, "Unexpected reload during restoration.");
        assert.deepEqual(errors, [], "Cold startup emitted runtime/server errors.");
        result.passed = true;
        console.log(`PASS cold start + warm restore: ${device.name}, round ${round}`);
      } catch (error) {
        result.failure = error.stack ?? String(error);
        throw error;
      } finally {
        results.push(result);
        await context?.close();
        await server?.close();
        await rm(cacheDir, { recursive: true, force: true });
        await writeFile(resolve(output, "report.json"), JSON.stringify(results, null, 2));
      }
    }
  }
} finally {
  await browser.close();
}

console.log(`Tarot startup passed: ${results.length} isolated cold starts and warm restores.`);
