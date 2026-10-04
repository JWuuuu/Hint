import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const migrationDir = fileURLToPath(new URL("../migrations/", import.meta.url));
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const checkOnly = process.argv.includes("--check");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(718095904)");
  if (!checkOnly) await client.query("CREATE TABLE IF NOT EXISTS hint_schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  const names = (await readdir(migrationDir)).filter(name => /^\d.*\.sql$/.test(name)).sort();
  for (const name of names) {
    const source = await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");
    const digest = createHash("sha256").update(source).digest("hex");
    const applied = await client.query("SELECT sha256 FROM hint_schema_migrations WHERE name=$1", [name]);
    if (applied.rows[0]) {
      if (applied.rows[0].sha256 !== digest) throw new Error(`Previously applied migration was changed: ${name}`);
      continue;
    }
    if (checkOnly) throw new Error(`Pending migration: ${name}`);
    // Early reviewed SQL files contain their own outer transaction; the runner owns it now.
    const sql = source.replace(/^\s*(BEGIN|COMMIT);\s*$/gm, "");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO hint_schema_migrations(name,sha256) VALUES ($1,$2)", [name, digest]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  console.log(checkOnly ? "Migration ledger is current." : "Migrations complete.");
} finally {
  await client.query("SELECT pg_advisory_unlock(718095904)").catch(() => {});
  await client.end();
}
