// Verification of the test observer only. Does not launch a browser or application.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");

const source = fs.readFileSync(path.resolve(__dirname, "../../../e2e/locale-surface-audit.spec.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics.length, 0);
const callbacks = [], observed = [], listeners = new Map(), auditWindow = {}, exported = {};
const test = (_name, callback) => callbacks.push(callback);
test.setTimeout = () => {};
vm.runInNewContext(compiled.outputText, {
  exports: exported,
  require: name => name === "./fixtures" ? { test, expect: () => {} } : require(name),
  URL, performance,
  window: auditWindow,
  location: { href: "http://127.0.0.1:5196/app/daily" },
  localStorage: { setItem() {} },
  addEventListener: (kind, handler) => listeners.set(kind, handler),
});

const classify = exported.isWebKitNavigationDiagnostic;
const nativeError = (endpoint = "readings", host = "127.0.0.1:5188") => ({
  name: "Fetch API cannot load http",
  message: `/${host}/api/${endpoint}?anonId=fictional due to access control checks.`,
  stack: `Fetch API cannot load http://${host}/api/${endpoint}?anonId=fictional due to access control checks.\n    at fetch`,
});
const navigation = { from: "http://127.0.0.1:5188/app/readings?hintPreview=embedded", to: "/app/profile", startedAt: 0 };
const checks = [];
function check(name, error, browser, activeNavigation, expected) {
  const actual = classify(error, browser, activeNavigation);
  assert.equal(actual, expected, name);
  checks.push({ name, expected, actual });
}
check("exact readings native diagnostic during matching navigation", nativeError(), "webkit", navigation, true);
check("exact reading-days native diagnostic during matching navigation", nativeError("reading-days"), "webkit", { ...navigation, from: "http://127.0.0.1:5188/app/daily" }, true);
for (const [name, error, browser, activeNavigation] of [
  ["outside goto", nativeError(), "webkit", null],
  ["Chromium", nativeError(), "chromium", navigation],
  ["different host", nativeError("readings", "example.test:5188"), "webkit", navigation],
  ["different port", nativeError("readings", "127.0.0.1:5199"), "webkit", navigation],
  ["different endpoint", nativeError("profile"), "webkit", navigation],
  ["wrong departing route", nativeError(), "webkit", { ...navigation, from: "http://127.0.0.1:5188/app/profile" }],
  ["real TypeError", { ...nativeError(), name: "TypeError" }, "webkit", navigation],
  ["missing stack", { ...nativeError(), stack: undefined }, "webkit", navigation],
  ["mismatched message", { ...nativeError(), message: "runtime error" }, "webkit", navigation],
  ["ordinary exception", new Error("actual bug"), "webkit", navigation],
]) check(name, error, browser, activeNavigation, false);

(async () => {
  const stop = new Error("observer setup complete");
  const page = {
    exposeBinding: async (name, callback) => {
      auditWindow[name] = async payload => { observed.push(payload); return callback({}, payload); };
    },
    addInitScript: async (callback, argument) => callback(argument),
    emulateMedia: async () => { throw stop; },
  };
  try {
    await callbacks[0]({ page, browserName: "webkit" }, {});
    assert.fail("expected bounded observer setup stop");
  } catch (error) {
    assert.equal(error, stop);
  }
  let prevented = 0;
  listeners.get("error")({ message: "real runtime failure", error: new Error("real runtime failure"), preventDefault() { prevented++; } });
  listeners.get("unhandledrejection")({ reason: new Error("real rejected promise"), preventDefault() { prevented++; } });
  await Promise.resolve();
  assert.deepEqual(observed.map(event => event.kind), ["error", "unhandledrejection"]);
  assert.equal(prevented, 0);
  process.stdout.write(JSON.stringify({
    scope: "Test-harness predicate and observer checks; no browser launched",
    syntaxDiagnostics: compiled.diagnostics.length,
    classifierChecks: checks,
    observedTrueRuntimeEvents: observed.map(({ kind, message }) => ({ kind, message })),
    preventedRuntimeEvents: prevented,
  }, null, 2) + "\n");
})().catch(error => { console.error(error); process.exitCode = 1; });
