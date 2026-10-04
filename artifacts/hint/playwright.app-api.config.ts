import { defineConfig } from "@playwright/test";
import base from "./playwright.handoff.config";

export default defineConfig({
  ...base,
  testMatch: "app-api.integration.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:5256" },
});
