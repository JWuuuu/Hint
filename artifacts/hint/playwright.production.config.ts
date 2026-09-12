import { defineConfig } from "@playwright/test";
import phoneConfig from "./playwright.config";

const port = process.env.HINT_E2E_PORT || "5181";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  ...phoneConfig,
  outputDir: "./test-results/production",
  use: { ...phoneConfig.use, baseURL },
  // Hardware preview and source watching are development-only features.
  grepInvert: /development preview|native packaging files cannot reload/,
  webServer: {
    command: `API_PROXY_TARGET=http://127.0.0.1:1 PORT=${port} node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
