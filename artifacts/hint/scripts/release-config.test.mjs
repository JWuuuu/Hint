import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReleaseConfig } from "./release-config.mjs";
const config = { VITE_API_BASE_URL: "https://api.mydailyhint.com", VITE_HINT_PUBLIC_URL: "https://mydailyhint.com/Hint", VITE_HINT_DOWNLOAD_URL: "https://mydailyhint.com/download", HINT_APPLE_TEAM_ID: "ABCDE12345", HINT_ASSOCIATED_DOMAIN: "mydailyhint.com" };
test("candidate config preserves a public hosting prefix", () => {
  assert.equal(validateReleaseConfig(config).app.pathname, "/Hint");
});
test("missing or placeholder config blocks native packaging", () => {
  for (const field of Object.keys(config)) assert.throws(() => validateReleaseConfig({ ...config, [field]: "" }));
  for (const url of ["http://mydailyhint.com", "https://api.example.com", "https://192.168.1.1", "https://localhost", "https://mydailyhint.com?token=private"]) {
    assert.throws(() => validateReleaseConfig({ ...config, VITE_API_BASE_URL: url }));
  }
});
test("universal link domain and public app base must agree", () => {
  assert.throws(() => validateReleaseConfig({ ...config, HINT_ASSOCIATED_DOMAIN: "elsewhere.com" }));
  assert.throws(() => validateReleaseConfig({ ...config, VITE_HINT_PUBLIC_URL: "https://mydailyhint.com/app" }));
});
