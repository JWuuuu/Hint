import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveIosAssociatedDomain } from "./ios-build-config.mjs";

// Vite also reads process.env internally. Keep fixtures independent of CI's hosts.
const keys = ["HINT_ASSOCIATED_DOMAIN", "VITE_HINT_PUBLIC_URL"];
const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
beforeEach(() => { for (const key of keys) delete process.env[key]; });
afterEach(() => {
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function fixture(t, files = {}) {
  const root = mkdtempSync(join(tmpdir(), "hint-ios-env-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content);
  return root;
}

test("iOS receives the associated domain configured only in .env.mobile", t => {
  const root = fixture(t, { ".env.mobile": "HINT_ASSOCIATED_DOMAIN=mydailyhint.com\nVITE_HINT_PUBLIC_URL=https://mydailyhint.com/Hint\n" });
  assert.equal(resolveIosAssociatedDomain(root, {}), "mydailyhint.com");
});

test("mobile-local and shell overrides follow mobile:build precedence", t => {
  const root = fixture(t, {
    ".env.mobile": "HINT_ASSOCIATED_DOMAIN=mydailyhint.com\n",
    ".env.mobile.local": "HINT_ASSOCIATED_DOMAIN=private.mydailyhint.com\n",
  });
  assert.equal(resolveIosAssociatedDomain(root, {}), "private.mydailyhint.com");
  assert.equal(resolveIosAssociatedDomain(root, { HINT_ASSOCIATED_DOMAIN: "ci.mydailyhint.com" }), "ci.mydailyhint.com");
});

test("artifact-consuming CI only needs the associated-domain variable", t => {
  assert.equal(resolveIosAssociatedDomain(fixture(t), { HINT_ASSOCIATED_DOMAIN: "mydailyhint.com" }), "mydailyhint.com");
});

test("the real process environment overrides a mobile env file", t => {
  const root = fixture(t, { ".env.mobile": "HINT_ASSOCIATED_DOMAIN=mydailyhint.com\n" });
  process.env.HINT_ASSOCIATED_DOMAIN = "ci.mydailyhint.com";
  assert.equal(resolveIosAssociatedDomain(root), "ci.mydailyhint.com");
});

test("missing, placeholder and malformed entitlements fail before Xcode", t => {
  const root = fixture(t);
  for (const domain of [undefined, "", "example.com", "localhost", "127.0.0.1", "https://mydailyhint.com", "mydailyhint.com/path", "mydailyhint.com:8443", "mydailyhint.com/", "mydailyhint.com?x=1", "mydailyhint.com\n"]) {
    assert.throws(() => resolveIosAssociatedDomain(root, { HINT_ASSOCIATED_DOMAIN: domain }));
  }
});

test("a configured public URL must agree with the domain passed to Xcode", t => {
  const root = fixture(t, { ".env.mobile": "VITE_HINT_PUBLIC_URL=https://mydailyhint.com\n" });
  assert.throws(() => resolveIosAssociatedDomain(root, { HINT_ASSOCIATED_DOMAIN: "elsewhere.com" }), /must match/);
});
