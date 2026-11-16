import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";

const enabled = process.env.HINT_ISOLATED_DB === "1";
let database: typeof import("@workspace/db");
let service: typeof import("../modules/hint/dailyTarot");
let issue: typeof import("../lib/deviceSession").issueDeviceSession;
let server: Server;
let origin: string;
type Receipt = ReturnType<typeof import("../modules/hint/dailyReceipts").serializeDailyReceipt>;
type Credential = { ownerId: string; token: string };
async function request(path: string, credential?: Credential, body?: unknown, method = "POST") {
  return fetch(origin + path, { method, headers: { "content-type": "application/json",
    ...(credential ? { authorization: "Bearer " + credential.token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
const get = (credential: Credential, body: object = {}) => request("/api/daily-receipts/get-or-create", credential, { featureType: "daily-card", ...body });
const open = (credential: Credential, body: object = {}) => request("/api/daily-receipts/open", credential, { featureType: "daily-card", ...body }, "PATCH");
const sync = (credential: Credential, body: object) => request("/api/daily-receipts/sync", credential, { featureType: "daily-card", ...body });

describe.skipIf(!enabled)("Daily Tarot security on isolated PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality") throw new Error("Refusing non-isolated database");
    database = await import("@workspace/db");
    service = await import("../modules/hint/dailyTarot");
    const sessions = await import("../lib/deviceSession"); issue = sessions.issueDeviceSession;
    const app = express(); app.use(express.json()); app.use(sessions.requireDeviceSession);
    app.use("/api", (await import("../routes/dailyReceipts")).default);
    app.use("/api", (await import("../routes/history")).default);
    app.use((await import("../lib/errorHandler")).errorHandler);
    server = await new Promise<Server>(resolve => { const listening = app.listen(0, "127.0.0.1", () => resolve(listening)); });
    origin = "http://127.0.0.1:" + (server.address() as { port: number }).port;
  });
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await database?.pool.end(); });

  it("requires real credentials and ignores forged ownership, card, orientation and timestamps", async () => {
    for (const [path, method] of [["/api/daily-pull", "POST"], ["/api/daily-pull", "PATCH"],
      ["/api/daily-receipts/get-or-create", "POST"], ["/api/daily-receipts/open", "PATCH"], ["/api/daily-receipts/sync", "POST"]]) {
      expect((await request(path, undefined, {}, method)).status).toBe(401);
    }
    const a = await issue(); const b = await issue();
    const response = await get(a, { anonId: b.ownerId, anonymousDeviceId: b.ownerId, userId: b.ownerId,
      assignedCardId: "forged-card", orientation: "reversed", openedAt: "2099-01-01T00:00:00Z", timezone: "Pacific/Kiritimati" });
    expect(response.status).toBe(200);
    const result = await response.json() as Receipt;
    expect(result).toMatchObject({ anonymousDeviceId: a.ownerId, userId: a.ownerId, orientation: "upright", openedAt: null });
    expect(result.assignedCardId).not.toBe("forged-card");
    expect(result.dailyKey).toBe(new Date().toISOString().slice(0, 10));
    expect((await database.pool.query("SELECT * FROM daily_receipts WHERE anonymous_device_id=$1", [b.ownerId])).rows).toHaveLength(0);
  });

  it.each(["daily-card", "daily-tarot"] as const)("commits one immutable %s assignment under concurrent draws and opens", async featureType => {
    const credential = await issue();
    const responses = await Promise.all(Array.from({ length: 16 }, () => get(credential, { featureType })));
    expect(responses.every(response => response.status === 200)).toBe(true);
    const receipts = await Promise.all(responses.map(response => response.json() as Promise<Receipt>));
    expect(new Set(receipts.map(row => row.id)).size).toBe(1);
    expect(new Set(receipts.map(row => row.assignedCardId)).size).toBe(1);
    expect(new Set(receipts.map(row => row.orientation)).size).toBe(1);
    const openedResponses = await Promise.all(Array.from({ length: 16 }, () => open(credential, { featureType })));
    const opened = await Promise.all(openedResponses.map(response => response.json() as Promise<Receipt>));
    expect(openedResponses.every(response => response.status === 200)).toBe(true);
    expect(new Set(opened.map(row => row.openedAt)).size).toBe(1);
    expect(opened.every(row => row.id === receipts[0].id)).toBe(true);
    expect((await database.pool.query("SELECT * FROM daily_receipts WHERE anonymous_device_id=$1", [credential.ownerId])).rows).toHaveLength(1);
    const pulls = (await database.pool.query("SELECT * FROM daily_pulls WHERE anon_id=$1", [credential.ownerId])).rows;
    expect(pulls).toHaveLength(featureType === "daily-card" ? 1 : 0);
    if (pulls[0]) expect(pulls[0]).toMatchObject({ card_id: receipts[0].assignedCardId, is_flipped: true });
  });

  it("rejects card/orientation injection even before reveal; matching legacy sync uses server time", async () => {
    const credential = await issue();
    const assigned = await (await get(credential)).json() as Receipt;
    const other = assigned.assignedCardId === "18-moon" ? "3-empress" : "18-moon";
    const body = { dailyKey: assigned.dailyKey, assignedCardId: assigned.assignedCardId, orientation: assigned.orientation, openedAt: "2099-01-01T00:00:00.000Z" };
    expect((await sync(credential, { ...body, assignedCardId: other })).status).toBe(409);
    expect((await sync(credential, { ...body, orientation: "reversed" })).status).toBe(409);
    expect(await (await get(credential)).json()).toMatchObject({ id: assigned.id, assignedCardId: assigned.assignedCardId, openedAt: null });
    const response = await sync(credential, body);
    expect(response.status).toBe(200);
    const result = await response.json() as Receipt;
    expect(result.openedAt!.slice(0, 10)).toBe(assigned.dailyKey);
    expect(await (await open(credential)).json()).toMatchObject({ id: assigned.id, openedAt: result.openedAt });
    expect((await request("/api/daily-pull", credential, { isFlipped: false }, "PATCH")).status).toBe(400);
    const noted = await request("/api/daily-pull", credential, { note: "My note", cardId: other, cardName: "Forged", whisper: "Forged" }, "PATCH");
    expect(await noted.json()).toMatchObject({ cardId: assigned.assignedCardId, isFlipped: true, note: "My note" });
  });

  it("does not mint arbitrary past/future records or accept an unissued offline result", async () => {
    const credential = await issue();
    for (const [day, status] of [["2000-01-01", 404], ["2099-01-01", 409], ["2026-02-30", 400]] as const) {
      expect((await get(credential, { dailyKey: day })).status).toBe(status);
      expect((await open(credential, { dailyKey: day })).status).toBe(status);
      expect((await request("/api/daily-pull", credential, { date: day })).status).toBe(status);
    }
    expect((await sync(credential, { dailyKey: new Date().toISOString().slice(0, 10), assignedCardId: "18-moon", openedAt: new Date().toISOString() })).status).toBe(404);
    expect((await database.pool.query("SELECT * FROM daily_receipts WHERE anonymous_device_id=$1", [credential.ownerId])).rows).toHaveLength(0);
  });

  it("restores committed results after an ignored response, retries and a fresh database connection", async () => {
    const credential = await issue();
    await open(credential); // Simulate a client that never consumes the successful response.
    const connection = database.createDatabaseClient(process.env.DATABASE_URL!); await connection.connect();
    const stored = (await connection.query("SELECT * FROM daily_receipts WHERE anonymous_device_id=$1", [credential.ownerId])).rows[0];
    await connection.end();
    const restored = await (await get(credential)).json() as Receipt;
    const retried = await (await open(credential)).json();
    expect(restored).toMatchObject({ id: stored.id, assignedCardId: stored.assigned_card_id, openedAt: stored.opened_at.toISOString() });
    expect(retried).toMatchObject({ id: restored.id, assignedCardId: restored.assignedCardId, openedAt: restored.openedAt });
  });

  it("restores old opened readings, rejects expired unopened cards, and creates only the new UTC day", async () => {
    const credential = await issue();
    const first = await service.dailyTarot({ owner: credential.ownerId, feature: "daily-card", open: true, clock: () => new Date("2026-11-01T23:59:59.999Z") });
    const next = await service.dailyTarot({ owner: credential.ownerId, feature: "daily-card", clock: () => new Date("2026-11-02T00:00:00Z") });
    expect(next.receipt.dailyKey).toBe("2026-11-02");
    expect(next.receipt.id).not.toBe(first.receipt.id);
    const restored = await service.dailyTarot({ owner: credential.ownerId, feature: "daily-card", dailyKey: first.receipt.dailyKey, open: true, clock: () => new Date("2026-11-02T12:00:00Z") });
    expect(restored.receipt.id).toBe(first.receipt.id);
    expect(restored.receipt.openedAt).toEqual(first.receipt.openedAt);
    await expect(service.dailyTarot({ owner: credential.ownerId, feature: "daily-card", dailyKey: next.receipt.dailyKey, open: true, clock: () => new Date("2026-11-03T00:00:00Z") })).rejects.toMatchObject({ code: "DAILY_READING_EXPIRED" });
  });

  it("samples server time after waiting for a lock across midnight", async () => {
    const credential = await issue();
    const blocker = await database.pool.connect();
    let time = new Date("2026-11-01T23:59:59.999Z"); let clockCalls = 0;
    let pending: ReturnType<typeof service.dailyTarot> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [credential.ownerId]);
      pending = service.dailyTarot({ owner: credential.ownerId, feature: "daily-card", clock: () => { clockCalls++; return time; } });
      const until = Date.now() + 5000;
      while ((await database.pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event='advisory' AND pid <> pg_backend_pid()")).rowCount === 0) {
        if (Date.now() > until) throw new Error("No queued daily request");
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(clockCalls).toBe(0);
      time = new Date("2026-11-02T00:00:00.001Z");
      await blocker.query("COMMIT");
      expect((await pending).receipt.dailyKey).toBe("2026-11-02");
    } finally { await blocker.query("ROLLBACK"); blocker.release(); if (pending) await pending; }
  });

  it("keeps the assignment/reveal lock after history deletion and preserves a deliberate new note", async () => {
    const credential = await issue();
    const first = await (await open(credential)).json() as Receipt;
    expect((await request("/api/history", credential, undefined, "DELETE")).status).toBe(204);
    expect(await (await open(credential)).json()).toMatchObject({ id: first.id, assignedCardId: first.assignedCardId, openedAt: first.openedAt, historyExcluded: true });
    await request("/api/daily-pull", credential, {});
    expect((await database.pool.query("SELECT * FROM daily_pulls WHERE anon_id=$1", [credential.ownerId])).rows).toHaveLength(0);
    expect((await request("/api/daily-pull", credential, { note: "Stale", editedAt: "2000-01-01T00:00:00Z" }, "PATCH")).status).toBe(404);
    const saved = await request("/api/daily-pull", credential, { note: "New deliberate note", editedAt: new Date().toISOString() }, "PATCH");
    expect(saved.status).toBe(200);
    expect(await (await request("/api/daily-pull", credential, {})).json()).toMatchObject({ cardId: first.assignedCardId, note: "New deliberate note", isFlipped: true });
  });

  it("rolls back assignment and reveal if saving the daily history fails", async () => {
    const credential = await issue();
    await database.pool.query("CREATE FUNCTION fail_t13_pull() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.anon_id = '" + credential.ownerId + "' THEN RAISE EXCEPTION 'isolated T13 save failure'; END IF; RETURN NEW; END $$");
    await database.pool.query("CREATE TRIGGER fail_t13_pull BEFORE INSERT ON daily_pulls FOR EACH ROW EXECUTE FUNCTION fail_t13_pull()");
    try {
      expect((await open(credential)).status).toBe(500);
      expect((await database.pool.query("SELECT * FROM daily_receipts WHERE anonymous_device_id=$1", [credential.ownerId])).rows).toHaveLength(0);
    } finally {
      await database.pool.query("DROP TRIGGER fail_t13_pull ON daily_pulls");
      await database.pool.query("DROP FUNCTION fail_t13_pull()");
    }
    expect((await open(credential)).status).toBe(200);
  });

  it("serializes history deletion against concurrent reveals without rerolling or reviving history", async () => {
    const credential = await issue();
    const assigned = await (await get(credential)).json() as Receipt;
    const results = await Promise.all([open(credential), open(credential),
      request("/api/history", credential, undefined, "DELETE"), open(credential)]);
    expect(results.map(result => result.status)).toEqual([200, 200, 204, 200]);
    expect(await (await get(credential)).json()).toMatchObject({ id: assigned.id, assignedCardId: assigned.assignedCardId, historyExcluded: true });
    expect((await database.pool.query("SELECT * FROM daily_pulls WHERE anon_id=$1", [credential.ownerId])).rows).toHaveLength(0);
  });

  it("rejects pre-existing future assignments and fails closed for corrupt cards without rerolling", async () => {
    const credential = await issue();
    const assigned = await (await get(credential)).json() as Receipt;
    await database.pool.query("UPDATE daily_receipts SET assigned_card_id='invalid-card' WHERE id=$1", [assigned.id]);
    expect((await get(credential)).status).toBe(500);
    expect((await database.pool.query("SELECT assigned_card_id FROM daily_receipts WHERE id=$1", [assigned.id])).rows[0].assigned_card_id).toBe("invalid-card");
    await database.pool.query("UPDATE daily_receipts SET daily_key='2099-01-01' WHERE id=$1", [assigned.id]);
    expect((await get(credential, { dailyKey: "2099-01-01" })).status).toBe(409);
  });

  it("leaves unrelated receipt feature behavior unchanged", async () => {
    const credential = await issue();
    const result = await sync(credential, { featureType: "animal-tarot", dailyKey: "2026-09-09", assignedCardId: "moon-moth", openedAt: "2026-09-09T12:00:00.000Z" });
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ featureType: "animal-tarot", assignedCardId: "moon-moth", dailyKey: "2026-09-09" });
  });
});
