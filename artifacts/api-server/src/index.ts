import { loadDotEnv } from "./lib/env";

loadDotEnv();

const { default: app } = await import("./app");
const { logger } = await import("./lib/logger");

const rawPort =
  (process.env["NODE_ENV"] === "production" ? process.env["PORT"] : undefined) ??
  process.env["API_PORT"] ??
  "5050";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
server.requestTimeout = 150000;
server.headersTimeout = 15000;
let draining = false;
async function shutdown() {
  if (draining) return;
  draining = true;
  process.env.HINT_DRAINING = "1";
  logger.info("Draining API requests");
  const force = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 150000);
  force.unref();
  server.close(async () => {
    const { pool } = await import("@workspace/db");
    await pool.end();
    clearTimeout(force);
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
