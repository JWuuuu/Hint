import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
if (existsSync(".env")) process.loadEnvFile(".env");
const env = {
  ...process.env,
  NODE_ENV: "development",
  PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`,
};
if (!env.DATABASE_URL) throw new Error("Configure DATABASE_URL in the project .env first.");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`Local backend setup failed: ${path.basename(command)}`);
}

let database;
try {
  database = new URL(env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(database.protocol)) throw new Error();
} catch {
  throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
}
const localState = path.join(root, ".local");
const managedDatabase = database.hostname === "127.0.0.1" && database.port === "55432";
if (managedDatabase && database.search) {
  throw new Error("Managed local DATABASE_URL must not contain query parameters; remove them before starting the backend.");
}
const apiPort = Number(env.API_PORT ?? "5050");
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  throw new Error("API_PORT must be an integer from 1 to 65535.");
}
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", error => {
    reject(new Error(error.code === "EADDRINUSE"
      ? `Hint API port ${apiPort} is already in use. Stop the existing backend with Ctrl+C in its terminal, then run Start Hint Backend.command again to load .env changes.`
      : `Cannot use Hint API port ${apiPort} (${error.code ?? "unknown error"}).`));
  });
  probe.listen(apiPort, () => probe.close(error => error ? reject(new Error("Could not release the API port check.")) : resolve()));
});
if (managedDatabase) {
  const binaryDir = path.join(localState, "postgres-runtime/node_modules/@embedded-postgres/darwin-arm64/native/bin");
  const dataDir = path.join(localState, "postgres-data");
  if (!existsSync(path.join(binaryDir, "pg_ctl"))) {
    throw new Error("Install the project's .local/postgres-runtime dependencies before starting the local database.");
  }
  mkdirSync(localState, { recursive: true, mode: 0o700 });
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    const passwordFile = path.join(localState, ".postgres-init-password");
    writeFileSync(passwordFile, decodeURIComponent(database.password), { mode: 0o600 });
    try {
      run(path.join(binaryDir, "initdb"), [
        "-D", dataDir, "-U", decodeURIComponent(database.username),
        "--pwfile", passwordFile, "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C",
      ]);
    } finally { rmSync(passwordFile, { force: true }); }
  }
  const status = spawnSync(path.join(binaryDir, "pg_ctl"), ["-D", dataDir, "status"], { stdio: "ignore", env });
  if (status.status !== 0) {
    run(path.join(binaryDir, "pg_ctl"), [
      "-D", dataDir, "-l", path.join(localState, "postgres.log"),
      "-o", "-h 127.0.0.1 -p 55432 -c unix_socket_directories=''", "-w", "start",
    ]);
  }
  const require = createRequire(new URL("../lib/db/package.json", import.meta.url));
  const { Client } = require("pg");
  const adminUrl = new URL(database);
  adminUrl.pathname = "/postgres";
  const client = new Client({ connectionString: adminUrl.href, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    const name = decodeURIComponent(database.pathname.slice(1));
    if (!(await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [name])).rowCount) {
      await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    }
  } finally { await client.end(); }
  run(process.execPath, ["lib/db/scripts/migrate.mjs"]);
} else {
  // Existing/external databases must be migrated deliberately, never by this local launcher.
  run(process.execPath, ["lib/db/scripts/migrate.mjs", "--check"]);
}

run(process.execPath, ["artifacts/api-server/build.mjs"]);
const configured = Boolean(
  (env.ASTROLOGYAPI_API_KEY || env.ASTROLOGY_API_KEY) &&
  (env.ASTROLOGYAPI_USER_ID || env.ASTROLOGY_API_USER_ID ||
    (env.ASTROLOGYAPI_API_KEY || env.ASTROLOGY_API_KEY).startsWith("ak-")),
);
console.log(`AstrologyAPI credentials: ${configured ? "configured; live calculation still needs verification" : "missing; fill ASTROLOGYAPI_USER_ID and ASTROLOGYAPI_API_KEY in .env"}`);
console.log(`Starting Hint API on port ${env.API_PORT || "5050"}. Local database data persists in .local/postgres-data.`);
const child = spawn(process.execPath, ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"], {
  cwd: root, env, stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 0; });
