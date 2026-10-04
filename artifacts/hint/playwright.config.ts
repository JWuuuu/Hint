import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:5180";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "./test-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  use: {
    baseURL,
    browserName: "webkit",
    hasTouch: true,
    isMobile: true,
    locale: "en-US",
    reducedMotion: "no-preference",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iphone-17-pro-max",
      use: { viewport: { width: 440, height: 956 } },
    },
    {
      name: "iphone-se",
      use: { viewport: { width: 375, height: 667 } },
    },
  ],
  webServer: {
    command: "HINT_TAROT_E2E=1 PORT=5180 pnpm run dev",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
