import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const dbRequire = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const loader = createRequire(dbRequire.resolve("drizzle-kit")).resolve("tsx");
const database = "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality";
if (process.env.HINT_ISOLATED_DB !== "1" || process.env.DATABASE_URL !== database) throw new Error("Provision the disposable hint_quality database before running this harness.");
const assets = process.env.HINT_QA_BUILD_DIR;
if (!assets || !existsSync(path.join(assets, "index.html"))) throw new Error("HINT_QA_BUILD_DIR must identify already-built production assets.");
const output = path.resolve(process.env.HINT_HANDOFF_OUTPUT || "app-api-evidence");
mkdirSync(output, { recursive: true });
// Never inherit personal provider keys, production URLs or dotenv settings.
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SYSTEMROOT", "PLAYWRIGHT_BROWSERS_PATH"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, { NODE_ENV: "test", DATABASE_URL: database, HINT_ISOLATED_DB: "1", HINT_APP_API_QA: "1",
  HINT_ALLOWED_ORIGINS: "http://127.0.0.1:5256", HINT_ENROLLMENT_PER_IP_HOUR: "200",
  HINT_TAROT_E2E: "1", API_PROXY_TARGET: "http://127.0.0.1:5057", HINT_HANDOFF_OUTPUT: output,
  HINT_QA_BUILD_DIR: assets, HINT_E2E_BASE_URL: "http://127.0.0.1:5256" });
const children = [];
function start(name, args) {
  const log = createWriteStream(path.join(output, `${name}.log`), { flags: "a" });
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log); child.stderr.pipe(log); children.push(child);
  child.once("close", () => log.end());
  return child;
}
const completed = child => new Promise((resolve, reject) => {
  child.once("error", reject); child.once("exit", code => resolve(code));
});
async function ready(url) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (children.some(child => child.exitCode !== null)) throw new Error("QA service exited; inspect retained logs.");
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* bounded local startup */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Local QA service did not become ready: ${url}`);
}
async function stop() {
  await Promise.all(children.filter(child => child.exitCode === null).map(async child => {
    const done = completed(child); child.kill("SIGTERM");
    const timer = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 5000);
    await done; clearTimeout(timer);
  }));
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await stop(); process.exit(130); });
try {
  // Refuse occupied ports instead of attaching to an unrelated real API.
  const { createServer } = await import("node:net");
  for (const port of [5057, 5256]) await new Promise((resolve, reject) => {
    const probe = createServer(); probe.once("error", reject); probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
  start("api", ["--import", loader, "scripts/app-api-qa-server.ts"]);
  await ready("http://127.0.0.1:5057/api/readyz");
  start("preview", [path.join(path.dirname(require.resolve("vite/package.json")), "bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", "5256", "--strictPort", "--outDir", assets]);
  await ready("http://127.0.0.1:5256/app");
  const run = start("browser", [require.resolve("@playwright/test/cli"), "test", "--config", "playwright.app-api.config.ts", "--workers=1", ...process.argv.slice(2)]);
  process.exitCode = (await completed(run)) ?? 1;
  console.log(`Browser/API/DB exit ${process.exitCode}; evidence: ${output}`);
} finally { await stop(); }
