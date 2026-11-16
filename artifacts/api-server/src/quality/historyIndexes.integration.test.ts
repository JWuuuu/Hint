import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import express from "express";
import { getTableConfig } from "drizzle-orm/pg-core";

const run = promisify(execFile);
const enabled = process.env.HINT_ISOLATED_DB === "1";
const fixtureUrl = "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality";
const migrationName = "20261111_01_history_owner_order.sql";
const migrationDir = new URL("../../../../lib/db/migrations/", import.meta.url);
const script = fileURLToPath(new URL("../../../../lib/db/scripts/migrate.mjs", import.meta.url));
const indexNames = ["journal_entries_owner_created_at_idx", "readings_owner_created_at_idx"];
type DatabaseClient = ReturnType<typeof import("@workspace/db").createDatabaseClient>;

describe.skipIf(!enabled)("isolated additive history index migration", () => {
  const databaseName = `hint_index_${crypto.randomUUID().replaceAll("-", "")}`;
  let admin: DatabaseClient;
  let database: DatabaseClient;
  let before: unknown;
  const databaseUrl = fixtureUrl.replace("/hint_quality", `/${databaseName}`);
  const migrate = (check = false) => run(process.execPath, [script, ...(check ? ["--check"] : [])], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  async function snapshot() {
    return Promise.all(["readings", "journal_entries", "history_clears"].map(async table =>
      (await database.query(`SELECT row_to_json(t) AS row FROM ${table} t ORDER BY row_to_json(t)::text`)).rows));
  }
  async function indexes() {
    return (await database.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname=ANY($1) ORDER BY indexname", [indexNames])).rows;
  }
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== fixtureUrl) throw new Error("Refusing non-isolated index migration test");
    const { createDatabaseClient } = await import("@workspace/db");
    admin = createDatabaseClient(fixtureUrl); await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    database = createDatabaseClient(databaseUrl); await database.connect();
    // Build the exact previous schema and digest ledger, then populate legacy data.
    await database.query("CREATE TABLE hint_schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
    for (const name of (await readdir(migrationDir)).filter(name => /^\d.*\.sql$/.test(name) && name < migrationName).sort()) {
      const source = await readFile(new URL(name, migrationDir), "utf8");
      await database.query(source);
      await database.query("INSERT INTO hint_schema_migrations(name,sha256) VALUES($1,$2)", [name, createHash("sha256").update(source).digest("hex")]);
    }
    await database.query("INSERT INTO readings(anon_id,card_name,whisper,spread_type) VALUES ('owner-a','Moon','Preserved reading','single'),('owner-b','Sun','Other owner','single')");
    await database.query("INSERT INTO journal_entries(anon_id,body,client_request_id) VALUES ('owner-a','Preserved journal','00000000-0000-4000-8000-000000000001'),('owner-a','Legacy null key',NULL),('owner-b','Other journal',NULL)");
    await database.query("INSERT INTO history_clears(owner_id,cleared_at,through_day) VALUES ('owner-a','2026-01-01T00:00:00Z','2026-01-01')");
    before = await snapshot();
  });
  afterAll(async () => {
    await database?.end();
    if (admin) { await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`); await admin.end(); }
  });
  it("rolls back both new indexes if their ledger write fails, preserving existing data", async () => {
    await database.query(`CREATE FUNCTION reject_index_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='${migrationName}' THEN RAISE EXCEPTION 'isolated index ledger failure'; END IF; RETURN NEW; END $$`);
    await database.query("CREATE TRIGGER reject_index_ledger BEFORE INSERT ON hint_schema_migrations FOR EACH ROW EXECUTE FUNCTION reject_index_ledger()");
    try {
      await expect(migrate()).rejects.toMatchObject({ stderr: expect.stringContaining("isolated index ledger failure") });
      expect(await indexes()).toEqual([]);
      expect((await database.query("SELECT name FROM hint_schema_migrations WHERE name=$1", [migrationName])).rows).toEqual([]);
      expect(await snapshot()).toEqual(before);
    } finally {
      await database.query("DROP TRIGGER reject_index_ledger ON hint_schema_migrations");
      await database.query("DROP FUNCTION reject_index_ledger()");
    }
  });
  it("serializes concurrent runners, adds only the two intended indexes and retains retry uniqueness", async () => {
    const oldIndexes = (await database.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")).rows;
    await Promise.all([migrate(), migrate()]);
    await migrate();
    expect((await migrate(true)).stdout).toContain("ledger is current");
    expect(await indexes()).toEqual([
      { indexname: indexNames[0], indexdef: "CREATE INDEX journal_entries_owner_created_at_idx ON public.journal_entries USING btree (anon_id, created_at DESC)" },
      { indexname: indexNames[1], indexdef: "CREATE INDEX readings_owner_created_at_idx ON public.readings USING btree (anon_id, created_at DESC)" },
    ]);
    const allIndexes = (await database.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")).rows;
    expect(allIndexes.filter(row => !indexNames.includes(row.indexname))).toEqual(oldIndexes);
    expect(await snapshot()).toEqual(before);
    expect((await database.query("SELECT name FROM hint_schema_migrations WHERE name=$1", [migrationName])).rows).toHaveLength(1);
    await expect(database.query("INSERT INTO journal_entries(anon_id,body,client_request_id) VALUES ('owner-a','Duplicate','00000000-0000-4000-8000-000000000001')")).rejects.toMatchObject({ code: "23505" });
    await database.query("INSERT INTO journal_entries(anon_id,body,client_request_id) VALUES ('owner-b','Other owner same key','00000000-0000-4000-8000-000000000001'),('owner-a','Another legacy null',NULL)");
  });
  it("keeps Drizzle metadata aligned with the nonunique owner/time index catalog", async () => {
    const { readingsTable, journalEntriesTable } = await import("@workspace/db");
    for (const table of [readingsTable, journalEntriesTable]) {
      const config = getTableConfig(table);
      const index = config.indexes.find(index => index.config.name === `${config.name}_owner_created_at_idx`);
      expect(index?.config.unique).toBe(false);
      expect(index?.config.method).toBe("btree");
      expect(index?.config.columns).toMatchObject([
        { name: "anon_id", indexConfig: { order: "asc", nulls: "last" } },
        { name: "created_at", indexConfig: { order: "desc", nulls: "first" } },
      ]);
      const catalog = (await database.query("SELECT indisunique,indisvalid,indisready FROM pg_index WHERE indexrelid=$1::regclass", [`${config.name}_owner_created_at_idx`])).rows[0];
      expect(catalog).toEqual({ indisunique: false, indisvalid: true, indisready: true });
    }
  });
});

describe.skipIf(!enabled)("indexed history route contracts", () => {
  const owner = `history-index-${crypto.randomUUID()}`;
  const other = `history-index-${crypto.randomUUID()}`;
  let database: typeof import("@workspace/db");
  let server: Server;
  let origin: string;
  async function request(path: string, method = "GET", body?: object) {
    return fetch(origin + path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  }
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== fixtureUrl) throw new Error("Refusing non-isolated history contract test");
    database = await import("@workspace/db");
    expect((await database.pool.query("SELECT name FROM hint_schema_migrations WHERE name=$1", [migrationName])).rows).toHaveLength(1);
    for (const value of [owner, other]) {
      // Each limit falls inside a 30-row timestamp tie. Tied IDs are not ordered.
      await database.pool.query("INSERT INTO readings(anon_id,card_name,whisper,spread_type,created_at) SELECT $1,'Moon','Synthetic reading','single',timestamptz '2026-01-01' + (i/30)*interval '1 minute' FROM generate_series(0,269) s(i)", [value]);
      await database.pool.query("INSERT INTO journal_entries(anon_id,body,created_at) SELECT $1,'Synthetic journal',timestamptz '2026-01-01' + (i/30)*interval '1 minute' FROM generate_series(0,269) s(i)", [value]);
    }
    const app = express(); app.use(express.json());
    // This tests query/serialization contracts with a trusted owner fixture.
    // Real credential enforcement is covered separately by deviceAccess.
    app.use((req, _res, next) => { req.deviceSession = { id: crypto.randomUUID(), ownerId: owner, expiresAt: new Date(Date.now() + 60000) }; next(); });
    app.use("/api", (await import("../routes/history")).default);
    await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", () => resolve()); });
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (database) {
      await database.pool.query("DELETE FROM readings WHERE anon_id=ANY($1)", [[owner, other]]);
      await database.pool.query("DELETE FROM journal_entries WHERE anon_id=ANY($1)", [[owner, other]]);
      await database.pool.query("DELETE FROM history_clears WHERE owner_id=ANY($1)", [[owner, other]]);
      await database.pool.end();
    }
  });
  it("preserves bounded newest-first lists, response fields and authenticated owner isolation across timestamp ties", async () => {
    for (const [route, table, limit, fields] of [
      ["readings", "readings", 100, ["id", "cardName", "whisper", "spreadType", "question", "territory", "createdAt"]],
      ["journal", "journal_entries", 200, ["id", "anonId", "title", "body", "mood", "createdAt"]],
    ] as const) {
      const response = await request(`/api/${route}?anonId=${other}`);
      expect(response.status).toBe(200);
      const rows = await response.json() as { id: string; createdAt: string }[];
      expect(rows).toHaveLength(limit);
      expect(new Set(rows.map(row => row.id)).size).toBe(limit);
      expect(Object.keys(rows[0]).sort()).toEqual([...fields].sort());
      const owned = (await database.pool.query(`SELECT id,created_at FROM ${table} WHERE anon_id=$1 ORDER BY created_at DESC`, [owner])).rows;
      expect(rows.every(row => owned.some(value => value.id === row.id))).toBe(true);
      // Compare timestamp multiset/order, never unspecified IDs within tied groups.
      expect(rows.map(row => row.createdAt)).toEqual(owned.slice(0, limit).map(row => row.created_at.toISOString()));
    }
    const stats = await request(`/api/stats?anonId=${other}`);
    expect(await stats.json()).toMatchObject({ readings: 270, journals: 270 });
  });
  it("clears only the authenticated owner and retains the stale-write fence", async () => {
    expect((await request(`/api/history?anonId=${other}`, "DELETE")).status).toBe(204);
    for (const table of ["readings", "journal_entries"]) {
      expect((await database.pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE anon_id=$1`, [owner])).rows[0].count).toBe(0);
      expect((await database.pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE anon_id=$1`, [other])).rows[0].count).toBe(270);
    }
    expect((await database.pool.query("SELECT owner_id FROM history_clears WHERE owner_id=$1", [owner])).rows).toHaveLength(1);
    const stale = await request("/api/journal", "POST", { anonId: other, body: "Stale synthetic retry", clientRequestId: crypto.randomUUID(), editedAt: "2026-01-01T00:00:00Z" });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "HISTORY_CLEARED" });
  });
});
