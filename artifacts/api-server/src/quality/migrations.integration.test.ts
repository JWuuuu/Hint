import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const run = promisify(execFile);
const enabled = process.env.HINT_ISOLATED_DB === "1";
const databaseName = `hint_migration_${crypto.randomUUID().replaceAll("-", "")}`;
type DatabaseClient = ReturnType<typeof import("@workspace/db").createDatabaseClient>;
let admin: DatabaseClient; let database: DatabaseClient;
let databaseUrl: string;
const script = fileURLToPath(new URL("../../../../lib/db/scripts/migrate.mjs", import.meta.url));
async function migrate(check = false) {
  return run(process.execPath, [script, ...(check ? ["--check"] : [])], { env: { ...process.env, DATABASE_URL: databaseUrl } });
}
describe.skipIf(!enabled)("isolated migration rehearsal", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality") throw new Error("Refusing non-isolated migration test");
    const { createDatabaseClient } = await import("@workspace/db");
    admin = createDatabaseClient(process.env.DATABASE_URL); await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    databaseUrl = `postgresql://hint_test:isolated-test-only@127.0.0.1:55439/${databaseName}`;
    database = createDatabaseClient(databaseUrl); await database.connect();
  });
  afterAll(async () => {
    await database?.end();
    if (admin) { await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`); await admin.end(); }
  });
  it("rolls back failed migration DDL, resumes under concurrent runners and preserves legacy snapshots", async () => {
    await database.query(await readFile(new URL("../../../../lib/db/migrations/20260909_00_baseline.sql", import.meta.url), "utf8"));
    await database.query(await readFile(new URL("../../../../lib/db/migrations/20260909_03_compatibility_invites.sql", import.meta.url), "utf8"));
    await database.query("INSERT INTO profiles(anon_id,name,birth_date) VALUES ('legacy-owner','Preserved profile','2000-01-01')");
    await database.query("INSERT INTO compatibility_invites(owner_id,token,creator_input,expires_at) VALUES ('legacy-owner','old-token','{\"name\":\"Preserved snapshot\"}',now()+interval '7 days')");
    await database.query("CREATE TABLE hint_schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
    await database.query("CREATE FUNCTION reject_migration_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='20260909_01_history_locks.sql' THEN RAISE EXCEPTION 'isolated migration failure'; END IF; RETURN NEW; END $$");
    await database.query("CREATE TRIGGER reject_migration_fixture BEFORE INSERT ON hint_schema_migrations FOR EACH ROW EXECUTE FUNCTION reject_migration_fixture()");
    await expect(migrate()).rejects.toBeTruthy();
    expect((await database.query("SELECT column_name FROM information_schema.columns WHERE table_name='daily_receipts' AND column_name='history_excluded'")).rows).toHaveLength(0);
    expect((await database.query("SELECT * FROM hint_schema_migrations WHERE name='20260909_01_history_locks.sql'")).rows).toHaveLength(0);
    await database.query("DROP TRIGGER reject_migration_fixture ON hint_schema_migrations");
    await Promise.all([migrate(), migrate()]);
    expect((await database.query("SELECT * FROM hint_schema_migrations")).rows).toHaveLength(6);
    expect((await database.query("SELECT name,birth_date,latitude FROM profiles WHERE anon_id='legacy-owner'")).rows).toEqual([{ name: "Preserved profile", birth_date: "2000-01-01", latitude: null }]);
    const old = (await database.query("SELECT creator_input,expires_at<=now() AS expired FROM compatibility_invites WHERE token='old-token'")).rows[0];
    expect(old).toEqual({ creator_input: { name: "Preserved snapshot" }, expired: true });
    expect((await migrate(true)).stdout).toContain("ledger is current");
  });
  it("rejects an altered applied migration digest without changing data", async () => {
    const original = (await database.query("SELECT sha256 FROM hint_schema_migrations WHERE name='20260909_05_device_access.sql'")).rows[0].sha256;
    try {
      await database.query("UPDATE hint_schema_migrations SET sha256='tampered' WHERE name='20260909_05_device_access.sql'");
      await expect(migrate(true)).rejects.toMatchObject({ stderr: expect.stringContaining("Previously applied migration was changed") });
      expect((await database.query("SELECT name FROM profiles WHERE anon_id='legacy-owner'")).rows[0].name).toBe("Preserved profile");
    } finally { await database.query("UPDATE hint_schema_migrations SET sha256=$1 WHERE name='20260909_05_device_access.sql'", [original]); }
  });
});
