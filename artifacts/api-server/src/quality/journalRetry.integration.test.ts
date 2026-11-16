import { beforeAll, afterAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
const enabled = process.env.HINT_ISOLATED_DB === "1";
let server: Server; let origin: string; let database: typeof import("@workspace/db");
async function save(body: object) { return fetch(origin + "/api/journal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
async function saved(response: Response) { return await response.json() as { id: string }; }
const entry = () => ({ anonId: `journal-retry-${crypto.randomUUID()}`, body: "A recoverable private entry", clientRequestId: crypto.randomUUID(), editedAt: new Date().toISOString() });
describe.skipIf(!enabled)("isolated journal retry consistency", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality") throw new Error("Refusing a non-isolated test database");
    database = await import("@workspace/db");
    const app = express(); app.use(express.json());
    // Transaction fixtures; real credential ownership is covered by deviceAccess.
    app.use((req, _res, next) => { req.deviceSession = { id: crypto.randomUUID(), ownerId: req.body?.anonId ?? String(req.query.anonId), expiresAt: new Date(Date.now() + 60000) }; next(); });
    app.use("/api", (await import("../routes/history")).default);
    await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", () => resolve()); });
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => { await new Promise<void>(resolve => server?.close(() => resolve())); await database?.pool.end(); });
  it("reuses a committed entry when its successful response was lost", async () => {
    const input = entry();
    const lost = await save(input); expect(lost.status).toBe(200); await lost.body?.cancel();
    const committed = (await database.pool.query("SELECT id FROM journal_entries WHERE anon_id=$1", [input.anonId])).rows[0];
    const retry = await save(input); expect(retry.status).toBe(200); expect((await saved(retry)).id).toBe(committed.id);
    expect((await database.pool.query("SELECT id FROM journal_entries WHERE anon_id=$1", [input.anonId])).rows).toHaveLength(1);
  });
  it("serializes concurrent retries and permits an intentional identical new entry", async () => {
    const input = entry(); const responses = await Promise.all([save(input), save(input)]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const [first, second] = await Promise.all(responses.map(saved)); expect(first.id).toBe(second.id);
    const next = await saved(await save({ ...input, clientRequestId: crypto.randomUUID() })); expect(next.id).not.toBe(first.id);
  });
  it("scopes the same retry key to its authenticated owner", async () => {
    const input = entry(); const first = await saved(await save(input));
    const second = await saved(await save({ ...input, anonId: entry().anonId })); expect(first.id).not.toBe(second.id);
  });
  it("rejects a reused key with changed content without changing the saved entry", async () => {
    const input = entry(); await save(input);
    const changed = await save({ ...input, body: "Different text" }); expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect((await database.pool.query("SELECT body FROM journal_entries WHERE anon_id=$1", [input.anonId])).rows).toEqual([{ body: input.body }]);
  });
  it("cannot recreate a committed entry after Clear History", async () => {
    const input = entry(); await save(input);
    expect((await fetch(origin + `/api/history?anonId=${input.anonId}`, { method: "DELETE" })).status).toBe(204);
    const retry = await save(input); expect(retry.status).toBe(409); expect(await retry.json()).toMatchObject({ code: "HISTORY_CLEARED" });
    expect((await database.pool.query("SELECT * FROM journal_entries WHERE anon_id=$1", [input.anonId])).rows).toHaveLength(0);
  });
  it("requires a valid retry key and original timestamp together", async () => {
    const { editedAt: _time, ...input } = entry();
    expect((await save(input)).status).toBe(400);
    expect((await save({ ...entry(), clientRequestId: "not-a-uuid" })).status).toBe(400);
  });
  it("preserves legacy submissions without a retry key", async () => {
    const { clientRequestId: _key, editedAt: _time, ...input } = entry();
    expect((await save(input)).status).toBe(200);
  });
});
