import { defineConfig } from "@playwright/test";
import path from "node:path";
import os from "node:os";

// Portable continuation of the isolated Mac acceptance run. Start a fresh,
// API-isolated production preview separately; this config never starts one.
const output = path.resolve(
  process.env.HINT_HANDOFF_OUTPUT ?? path.join(os.tmpdir(), "hint-handoff-evidence"),
);

export default defineConfig({
  testDir: path.join(import.meta.dirname, "e2e"),
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  updateSnapshots: "none",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  reporter: [["list"], ["json", { outputFile: path.join(output, "results.json") }], ["./scripts/qa-progress-reporter.cjs"]],
  outputDir: path.join(output, "tests"),
  use: {
    baseURL: process.env.HINT_E2E_BASE_URL ?? "http://127.0.0.1:5240",
    browserName: "webkit",
    hasTouch: true,
    isMobile: true,
    locale: "en-US",
    reducedMotion: "no-preference",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "iphone-17-pro-max", use: { viewport: { width: 440, height: 956 } } },
    { name: "iphone-se", use: { viewport: { width: 375, height: 667 } } },
  ],
});
