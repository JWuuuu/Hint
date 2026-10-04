// Deliberately bypass api-server/index.ts: it loads local .env files. This
// harness receives only the isolated runner's explicit, non-secret environment.
import { createServer } from "node:http";

if (process.env.HINT_APP_API_QA !== "1" || process.env.DATABASE_URL !== "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality") {
  throw new Error("The browser/API harness requires the disposable QA database.");
}
globalThis.fetch = async () => { throw new Error("External services are disabled in browser/API QA."); };
const { default: app } = await import("../../api-server/src/app.ts");
const { pool } = await import("../../../lib/db/src/index.ts");
const allowed = new Set([
  "/api/healthz", "/api/readyz", "/api/device-sessions", "/api/profile",
  "/api/daily-receipts/get-or-create", "/api/daily-receipts/open", "/api/daily-receipts/sync",
  "/api/daily-pull", "/api/daily-pulls", "/api/reading-days", "/api/stats",
  "/api/readings", "/api/journal", "/api/history",
]);
const server = createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  if (!allowed.has(path)) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: "QA_PROVIDER_DISABLED", error: "Provider unavailable in isolated QA." }));
    return;
  }
  app(req, res);
});
server.listen(5057, "127.0.0.1", () => console.log("Isolated application API ready on 5057."));
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => {
  server.close(async () => { await pool.end(); process.exit(0); });
  server.closeIdleConnections();
});
