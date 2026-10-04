import { beforeAll, afterAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
const enabled = process.env.HINT_ISOLATED_DB === "1";
const accepter = crypto.randomUUID();
async function sessionOwner() { return (await (await import("../lib/deviceSession")).issueDeviceSession()).ownerId; }
let server: Server;
let origin: string;
let dbModule: typeof import("@workspace/db");
async function request(path: string, body?: unknown, method = "POST") {
  return fetch(origin + path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
describe.skipIf(!enabled)("isolated PostgreSQL persistence", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality") throw new Error("Refusing a non-isolated test database");
    dbModule = await import("@workspace/db");
    const app = express(); app.use(express.json());
    // This suite tests transaction behavior with trusted fixtures; the access suite uses real tokens.
    app.use((req, _res, next) => { req.deviceSession = { id: crypto.randomUUID(), ownerId: req.body?.anonId ?? String(req.query.anonId ?? "fixture"), expiresAt: new Date(Date.now() + 100000) }; next(); });
    app.use("/api", (await import("../routes/dailyReceipts")).default);
    app.use("/api", (await import("../routes/history")).default);
    app.use("/api", (await import("../routes/profile")).default);
    await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", () => resolve()); });
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => { await new Promise<void>(resolve => server?.close(() => resolve())); await dbModule?.pool.end(); });
  it("syncs an offline reveal once, rejects a conflicting reveal and keeps the original row", async () => {
    const owner = `sync-${crypto.randomUUID()}`;
    const receipt = { anonId: owner, featureType: "daily-card", dailyKey: "2026-09-09", assignedCardId: "3-empress", openedAt: "2026-09-09T12:00:00.000Z" };
    const responses = await Promise.all([request("/api/daily-receipts/sync", receipt), request("/api/daily-receipts/sync", receipt)]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const rows = await dbModule.pool.query("SELECT card_id FROM daily_pulls WHERE anon_id=$1", [owner]);
    expect(rows.rows).toEqual([{ card_id: "3-empress" }]);
    expect((await request("/api/daily-receipts/sync", { ...receipt, assignedCardId: "18-moon" })).status).toBe(409);
    expect((await dbModule.pool.query("SELECT card_id FROM daily_pulls WHERE anon_id=$1", [owner])).rows).toEqual(rows.rows);
  });
  it("history deletion preserves the profile and reveal lock; re-entering cannot revive history", async () => {
    const owner = `clear-${crypto.randomUUID()}`;
    const profile = { anonId: owner, name: "Fixture", birthDate: "2000-02-29", birthPlace: "Tokyo", latitude: 35.67, longitude: 139.65, timezone: "Asia/Tokyo", timezoneOffset: 9 };
    expect((await request("/api/profile", profile)).status).toBe(200);
    const receipt = { anonId: owner, featureType: "daily-card", dailyKey: "2026-09-09", assignedCardId: "3-empress", openedAt: "2026-09-09T12:00:00.000Z" };
    await request("/api/daily-receipts/sync", receipt);
    expect((await request(`/api/history?anonId=${owner}`, undefined, "DELETE")).status).toBe(204);
    await request("/api/daily-pull", { anonId: owner, date: "2026-09-09" });
    await request("/api/daily-receipts/sync", receipt);
    expect((await dbModule.pool.query("SELECT * FROM daily_pulls WHERE anon_id=$1", [owner])).rows).toHaveLength(0);
    const kept = await (await request(`/api/profile?anonId=${owner}`, undefined, "GET")).json();
    expect(kept).toMatchObject(profile);
    expect((await dbModule.pool.query("SELECT assigned_card_id,history_excluded FROM daily_receipts WHERE anonymous_device_id=$1", [owner])).rows).toEqual([{ assigned_card_id: "3-empress", history_excluded: true }]);
  });
  it("does not resurrect an in-flight journal entry after clearing history", async () => {
    const owner = `journal-race-${crypto.randomUUID()}`;
    const gate = 728194601;
    const blocker = await dbModule.pool.connect();
    let saving: Promise<Response> | undefined;
    let clearing: Promise<Response> | undefined;
    await dbModule.pool.query(`CREATE OR REPLACE FUNCTION hold_fixture_journal_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.anon_id = '${owner}' THEN PERFORM pg_advisory_xact_lock(${gate}); END IF; RETURN NEW; END $$`);
    await dbModule.pool.query("CREATE TRIGGER hold_fixture_journal_insert BEFORE INSERT ON journal_entries FOR EACH ROW EXECUTE FUNCTION hold_fixture_journal_insert()");
    const waitFor = async (condition: () => Promise<boolean>) => {
      const until = Date.now() + 5000;
      while (!await condition()) {
        if (Date.now() > until) throw new Error("Journal concurrency fixture did not reach its barrier");
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock($1)", [gate]);
      saving = request("/api/journal", { anonId: owner, body: "This pending entry must be cleared" });
      await waitFor(async () => (await dbModule.pool.query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=$1 AND NOT granted", [gate])).rowCount! > 0);
      let cleared = false;
      clearing = request(`/api/history?anonId=${owner}`, undefined, "DELETE").then(response => { cleared = true; return response; });
      await waitFor(async () => cleared || (await dbModule.pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event='advisory' AND query LIKE '%hashtextextended%' AND pid <> pg_backend_pid() ")).rowCount! > 0);
      await blocker.query("COMMIT");
      expect((await saving).status).toBe(200);
      expect((await clearing).status).toBe(204);
      expect((await dbModule.pool.query("SELECT * FROM journal_entries WHERE anon_id=$1", [owner])).rows).toHaveLength(0);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await Promise.allSettled([saving, clearing].filter(Boolean));
      await dbModule.pool.query("DROP TRIGGER hold_fixture_journal_insert ON journal_entries");
      await dbModule.pool.query("DROP FUNCTION hold_fixture_journal_insert()");
    }
  });
  it("rejects a delayed pre-clear journal submission but permits a deliberate new entry", async () => {
    const owner = `journal-fence-${crypto.randomUUID()}`;
    const editedAt = new Date(Date.now() - 60_000).toISOString();
    expect((await request(`/api/history?anonId=${owner}`, undefined, "DELETE")).status).toBe(204);
    const stale = await request("/api/journal", { anonId: owner, body: "An old pending submission", editedAt });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "HISTORY_CLEARED" });
    expect((await dbModule.pool.query("SELECT * FROM journal_entries WHERE anon_id=$1", [owner])).rows).toHaveLength(0);
    expect((await request("/api/journal", { anonId: owner, body: "A new deliberate entry", editedAt: new Date().toISOString() })).status).toBe(200);
    expect((await request("/api/journal", { anonId: owner, body: "A compatible legacy submission" })).status).toBe(200);
  });
  it("persists invitations, consent and immutable results; concurrent completion does one computation", async () => {
    const store = await import("../modules/astrology/compatibilityStore");
    const creator = { name: "Creator", birthday: "2000-01-01" };
    const friend = { name: "Friend A", birthday: "2001-01-01" };
    const invite = await store.createCompatibilityInvite(await sessionOwner(), creator);
    let computations = 0;
    let finish!: () => void;
    const chart = (input: object) => ({ source: "api", provider: "astrologyapi", input, placements: [] });
    const compute = async (first: any, second: any) => {
      computations++;
      await new Promise<void>(resolve => { finish = resolve; });
      return { id: crypto.randomUUID(), source: "api", people: { user: { name: first.name, chart: chart(first) }, friend: { name: second.name, chart: chart(second) } } } as any;
    };
    const working = store.completeCompatibilityInvite(invite.token, friend, true, compute, accepter);
    while (!finish) await new Promise(resolve => setTimeout(resolve, 5));
    const duplicate = await store.completeCompatibilityInvite(invite.token, { ...friend, name: "Changed" }, true, compute, accepter);
    expect(duplicate.status).toBe(202);
    finish(); const completed = await working;
    expect(computations).toBe(1);
    const repeated = await store.completeCompatibilityInvite(invite.token, { ...friend, name: "Changed" }, true, compute, accepter);
    expect(repeated.resultId).toBe(completed.resultId);
    const stored = await store.readCompatibilityResult(completed.resultId!, accepter);
    expect(stored.people.friend.name).toBe("Friend A");
    expect((await store.findCompatibilityInvite(invite.token)).consentAt).not.toBeNull();
    // Repeated reads use the persisted immutable snapshot.
    const fresh = await import("../modules/astrology/compatibilityStore");
    expect((await fresh.readCompatibilityResult(completed.resultId!, accepter)).id).toBe(stored.id);
  });

  it("does not resurrect a receipt first uploaded after deletion", async () => {
    const owner = `late-offline-${crypto.randomUUID()}`;
    expect((await request(`/api/history?anonId=${owner}&throughDay=2026-09-09`, undefined, "DELETE")).status).toBe(204);
    const uploaded = await request("/api/daily-receipts/sync", { anonId: owner, featureType: "daily-card", dailyKey: "2026-09-09", assignedCardId: "18-moon", openedAt: "2026-09-09T01:00:00.000Z" });
    expect(uploaded.status).toBe(200);
    expect(await uploaded.json()).toMatchObject({ assignedCardId: "18-moon", historyExcluded: true });
    await request("/api/daily-pull", { anonId: owner, date: "2026-09-09" });
    expect((await dbModule.pool.query("SELECT * FROM daily_pulls WHERE anon_id=$1", [owner])).rows).toHaveLength(0);
    const stale = await request("/api/daily-pull", { anonId: owner, date: "2026-09-09", note: "Old delayed draft", editedAt: "2026-09-09T00:00:00.000Z" }, "PATCH");
    expect(stale.status).toBe(404);
    const current = await request("/api/daily-pull", { anonId: owner, date: "2026-09-09", note: "New deliberate note", editedAt: new Date().toISOString() }, "PATCH");
    expect(current.status).toBe(200);
    expect(await current.json()).toMatchObject({ cardId: "18-moon", note: "New deliberate note" });
  });

  it("rolls back every history deletion when one database operation fails", async () => {
    const owner = "rollback-isolated-fixture";
    await request("/api/journal", { anonId: owner, body: "Preserve on failed deletion" });
    await dbModule.pool.query(`CREATE OR REPLACE FUNCTION fail_fixture_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.anon_id = 'rollback-isolated-fixture' THEN RAISE EXCEPTION 'fixture failure'; END IF; RETURN OLD; END $$`);
    await dbModule.pool.query("CREATE TRIGGER fail_fixture_delete BEFORE DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION fail_fixture_delete()");
    try {
      expect((await request(`/api/history?anonId=${owner}`, undefined, "DELETE")).status).toBe(500);
      expect((await dbModule.pool.query("SELECT * FROM journal_entries WHERE anon_id=$1", [owner])).rows.length).toBeGreaterThan(0);
      expect((await dbModule.pool.query("SELECT * FROM history_clears WHERE owner_id=$1", [owner])).rows).toHaveLength(0);
    } finally {
      await dbModule.pool.query("DROP TRIGGER fail_fixture_delete ON journal_entries");
      await dbModule.pool.query("DROP FUNCTION fail_fixture_delete()");
    }
  });

  it("rejects invalid card dates and preserves complete profile coordinates across legacy updates", async () => {
    const owner = `profile-${crypto.randomUUID()}`;
    expect((await request("/api/daily-receipts/sync", { anonId: owner, featureType: "daily-card", dailyKey: "2026-02-30", assignedCardId: "18-moon", openedAt: "2026-09-09T01:00:00.000Z" })).status).toBe(400);
    const profile = { anonId: owner, name: "Fixture", birthDate: "2000-02-29", birthPlace: "Tokyo", latitude: 35.676234, longitude: 139.650127, timezone: "Asia/Tokyo", timezoneOffset: 9 };
    expect((await request("/api/profile", profile)).status).toBe(200);
    const updated = await (await request("/api/profile", { anonId: owner, name: "New name", birthDate: profile.birthDate, birthPlace: profile.birthPlace })).json();
    expect(updated).toMatchObject({ latitude: profile.latitude, longitude: profile.longitude, timezone: profile.timezone, timezoneOffset: 9 });
    const moved = await (await request("/api/profile", { anonId: owner, name: "New name", birthDate: profile.birthDate, birthPlace: "London" })).json();
    expect(moved).toMatchObject({ latitude: null, longitude: null, timezone: null, timezoneOffset: null });
  });
  it("requires consent, rejects expired/missing links and keeps failed/demo calculations retryable", async () => {
    const store = await import("../modules/astrology/compatibilityStore");
    const person = { name: "Fixture", birthday: "2000-01-01" };
    const invite = await store.createCompatibilityInvite(await sessionOwner(), person);
    const fail = async () => { throw new Error("offline"); };
    await expect(store.completeCompatibilityInvite(invite.token, person, false, fail, accepter)).rejects.toMatchObject({ status: 400 });
    await expect(store.completeCompatibilityInvite(invite.token, person, true, fail, accepter)).rejects.toMatchObject({ status: 503 });
    expect((await store.findCompatibilityInvite(invite.token)).status).toBe("failed");
    await expect(store.completeCompatibilityInvite(invite.token, person, true, async () => ({ source: "preview" } as any), accepter)).rejects.toMatchObject({ status: 503 });
    await dbModule.pool.query("UPDATE compatibility_invites SET expires_at=now()-interval '1 second' WHERE id=$1", [invite.id]);
    await expect(store.findCompatibilityInvite(invite.token)).rejects.toMatchObject({ status: 410 });
    await expect(store.findCompatibilityInvite("missing-fixture")).rejects.toMatchObject({ status: 404 });
  });

  it("recovers abandoned jobs and fences a calculation after its owner clears history", async () => {
    const store = await import("../modules/astrology/compatibilityStore");
    const person = { name: "Lease fixture", birthday: "2000-01-01" };
    const owner = await sessionOwner();
    const invite = await store.createCompatibilityInvite(owner, person);
    await dbModule.pool.query("UPDATE compatibility_invites SET status='processing',job_id=$2,accepter_owner_id=$3,lease_until=now()-interval '1 second' WHERE id=$1", [invite.id, crypto.randomUUID(), accepter]);
    expect(store.publicCompatibilityInvite(await store.findCompatibilityInvite(invite.token)).status).toBe("failed");
    let finish!: () => void;
    const working = store.completeCompatibilityInvite(invite.token, person, true, async () => {
      await new Promise<void>(resolve => { finish = resolve; });
      return { id: crypto.randomUUID(), source: "api", people: { user: { chart: { source: "api" } }, friend: { chart: { source: "api" } } } } as any;
    }, accepter);
    const rejected = expect(working).rejects.toMatchObject({ status: 409 });
    while (!finish) await new Promise(resolve => setTimeout(resolve, 5));
    expect((await request(`/api/history?anonId=${owner}`, undefined, "DELETE")).status).toBe(204);
    finish(); await rejected;
    await expect(store.findCompatibilityInvite(invite.token)).rejects.toMatchObject({ status: 404 });
    expect((await dbModule.pool.query("SELECT * FROM compatibility_invites WHERE owner_id=$1", [owner])).rows).toHaveLength(0);
  });

});
