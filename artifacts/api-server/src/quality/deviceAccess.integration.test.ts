import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
const enabled = process.env.HINT_ISOLATED_DB === "1";
type Credential = { token: string; ownerId: string; expiresAt: string };
let database: typeof import("@workspace/db");
let server: Server;
let origin: string;
let a: Credential; let b: Credential; let outsider: Credential;
async function request(path: string, credential?: Credential, body?: unknown, method = "GET", extraHeaders: Record<string, string> = {}) {
  return fetch(origin + path, { method, headers: { "content-type": "application/json", ...(credential ? { authorization: `Bearer ${credential.token}` } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
}
describe.skipIf(!enabled)("isolated installation access boundary", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality") throw new Error("Refusing non-isolated database");
    database = await import("@workspace/db");
    await database.pool.query("DELETE FROM request_budgets WHERE bucket_key LIKE 'enrollment:%'");
    const app = (await import("../app")).default;
    server = await new Promise<Server>(resolve => { const listening = app.listen(0, "127.0.0.1", () => resolve(listening)); });
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    a = await (await request("/api/device-sessions", undefined, {}, "POST")).json() as Credential;
    b = await (await request("/api/device-sessions", undefined, {}, "POST")).json() as Credential;
    outsider = await (await request("/api/device-sessions", undefined, {}, "POST")).json() as Credential;
  });
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await database?.pool.end(); });
  it("issues independent owners, persists only token hashes and never claims a legacy identifier", async () => {
    expect(a.ownerId).not.toBe(b.ownerId);
    expect(a.token).toMatch(/^hint_ds_[a-f0-9]{64}$/);
    const row = (await database.pool.query("SELECT * FROM device_sessions WHERE owner_id=$1", [a.ownerId])).rows[0];
    expect(row.token_hash).toHaveLength(64);
    expect(JSON.stringify(row)).not.toContain(a.token);
    const legacy = `legacy-private-${crypto.randomUUID()}`;
    await database.pool.query("INSERT INTO profiles(anon_id,name,birth_date) VALUES ($1,'Legacy secret','2000-01-01')", [legacy]);
    const fresh = await (await request("/api/device-sessions", undefined, { anonId: legacy, ownerId: legacy }, "POST")).json() as Credential;
    expect(fresh.ownerId).not.toBe(legacy);
    expect((await request(`/api/profile?anonId=${legacy}`, fresh)).status).toBe(404);
    expect((await request(`/api/profile?anonId=${legacy}`)).status).toBe(401);
    expect((await database.pool.query("SELECT name FROM profiles WHERE anon_id=$1", [legacy])).rows[0].name).toBe("Legacy secret");
    const store = await import("../modules/astrology/compatibilityStore");
    const legacyInvite = await store.createCompatibilityInvite(legacy, { birthday: "2000-01-01" });
    expect((await request(`/api/compatibility/invite/${legacyInvite.token}`)).status).toBe(410);
    const missing = await request("/api/profile", fresh);
    const missingBody = await missing.json() as { code: string; requestId: string };
    expect(missingBody.code).toBe("HTTP_404");
    expect(missingBody.requestId).toBe(missing.headers.get("x-request-id"));
  });
  it("requires credentials before private data or provider routes and ignores spoofed owner fields", async () => {
    for (const [path, method] of [["/api/profile", "GET"], ["/api/history", "DELETE"], ["/api/readings", "GET"], ["/api/journal", "POST"], ["/api/daily-receipts/sync", "POST"], ["/api/astrology/birth-chart", "POST"], ["/api/speech", "POST"]]) {
      expect((await request(path, undefined, method === "POST" ? {} : undefined, method)).status).toBe(401);
    }
    const saved = await request("/api/profile", a, { anonId: b.ownerId, name: "Installation A", birthDate: "2000-01-01" }, "POST");
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ anonId: a.ownerId, name: "Installation A" });
    expect((await request(`/api/profile?anonId=${a.ownerId}`, b)).status).toBe(404);
    expect(await (await request(`/api/profile?anonId=${b.ownerId}`, a)).json()).toMatchObject({ anonId: a.ownerId });
    await request("/api/journal", a, { anonId: b.ownerId, body: "Private A" }, "POST");
    await request(`/api/history?anonId=${a.ownerId}`, b, undefined, "DELETE");
    expect(await (await request(`/api/journal?anonId=${b.ownerId}`, a)).json()).toHaveLength(1);
  });
  it("keeps invite snapshots/results private and binds one authenticated accepter", async () => {
    const store = await import("../modules/astrology/compatibilityStore");
    const response = await request("/api/compatibility/invite", a, { createdByUserId: b.ownerId, birthProfile: { name: "Creator", birthday: "2000-01-01" } }, "POST");
    const invite = await response.json() as { token: string };
    expect(response.status).toBe(200);
    expect((await store.findCompatibilityInvite(invite.token)).ownerId).toBe(a.ownerId);
    const publicBefore = await (await request(`/api/compatibility/invite/${invite.token}`)).json();
    expect(publicBefore).not.toHaveProperty("creatorInput");
    expect(publicBefore).not.toHaveProperty("birthProfile");
    let finish!: () => void;
    let calls = 0;
    const working = store.completeCompatibilityInvite(invite.token, { name: "Friend", birthday: "2001-01-01" }, true, async () => {
      calls++;
      await new Promise<void>(resolve => { finish = resolve; });
      return { id: crypto.randomUUID(), source: "api", people: { user: { name: "Creator", chart: { source: "api" } }, friend: { name: "Friend", chart: { source: "api" } } } } as any;
    }, b.ownerId);
    while (!finish) await new Promise(resolve => setTimeout(resolve, 5));
    await expect(store.completeCompatibilityInvite(invite.token, { birthday: "2002-01-01" }, true, async () => { throw new Error("must not compute"); }, outsider.ownerId)).rejects.toMatchObject({ status: 403 });
    finish(); const result = await working;
    expect(calls).toBe(1);
    expect((await request(`/api/compatibility/${result.resultId}`, a)).status).toBe(200);
    expect((await request(`/api/compatibility/${result.resultId}`, b)).status).toBe(200);
    expect((await request(`/api/compatibility/${result.resultId}`, outsider)).status).toBe(404);
    expect((await request(`/api/compatibility/${result.resultId}`)).status).toBe(401);
    expect(await (await request(`/api/compatibility/invite/${invite.token}`)).json()).toMatchObject({ status: "completed", resultId: null });
    expect(await (await request(`/api/compatibility/invite/${invite.token}`, b)).json()).toMatchObject({ resultId: result.resultId });
    const repeated = await request(`/api/compatibility/invite/${invite.token}/complete`, b, { friendBirthProfile: { birthday: "2003-01-01", name: "Changed" }, consent: true }, "POST");
    expect(repeated.status).toBe(200);
    expect(((await repeated.json()) as { result: { people: { friend: { name: string } } } }).result.people.friend.name).toBe("Friend");
  });
  it("revokes and expires credentials without deleting or reassigning server records", async () => {
    expect((await request("/api/device-session", outsider, undefined, "DELETE")).status).toBe(204);
    expect((await request("/api/device-session", outsider)).status).toBe(401);
    await database.pool.query("UPDATE device_sessions SET expires_at=now()-interval '1 second' WHERE owner_id=$1", [b.ownerId]);
    expect((await request("/api/device-session", b)).status).toBe(401);
    expect((await request("/api/device-session", a)).status).toBe(200);
  });
  it("does not trust spoofed forwarding headers, blocks session churn with global quotas and durable leases", async () => {
    const { takeBudget, trustedIpKey, releaseProviderLease } = await import("../lib/durableBudget");
    const base = { ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" }, header: () => "198.51.100.55" } as any;
    expect(trustedIpKey(base)).toBe(trustedIpKey({ ...base, header: () => "203.0.113.9" }));
    const key = `security-global-${crypto.randomUUID()}`;
    const rule = { key, limit: 2, windowMs: 86400000 };
    const attempts = await Promise.allSettled([takeBudget([rule], a.ownerId), takeBudget([rule], b.ownerId), takeBudget([rule], outsider.ownerId)]);
    expect(attempts.filter(outcome => outcome.status === "fulfilled")).toHaveLength(2);
    expect((await database.pool.query("SELECT used FROM request_budgets WHERE bucket_key=$1", [key])).rows[0].used).toBe(2);
    // A new module/client sees the same durable counter; no provider was called.
    await expect((await import("../lib/durableBudget")).takeBudget([rule], crypto.randomUUID())).rejects.toMatchObject({ retryAfter: expect.any(Number) });
    for (const result of attempts) if (result.status === "fulfilled" && result.value) await releaseProviderLease(result.value);
    process.env.HINT_PROVIDER_MAX_CONCURRENT = "1";
    const lease = await takeBudget([], a.ownerId);
    await expect(takeBudget([], b.ownerId)).rejects.toMatchObject({ retryAfter: 30 });
    await database.pool.query("UPDATE provider_leases SET expires_at=now()-interval '1 second' WHERE id=$1", [lease]);
    const recovered = await takeBudget([], b.ownerId);
    expect(recovered).toBeTruthy();
    if (recovered) await releaseProviderLease(recovered);
    delete process.env.HINT_PROVIDER_MAX_CONCURRENT;
  });
  it("redacts database error details while preserving readable data", async () => {
    await database.pool.query("CREATE FUNCTION reject_private_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='trigger-private-error' THEN RAISE EXCEPTION 'private birth coordinates and secret token'; END IF; RETURN NEW; END $$");
    await database.pool.query("CREATE TRIGGER reject_private_fixture BEFORE INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION reject_private_fixture()");
    try {
      const response = await request("/api/profile", a, { name: "trigger-private-error", birthDate: "2000-01-01" }, "POST");
      expect(response.status).toBe(500);
      const body = await response.text();
      expect(body).not.toContain("coordinates");
      expect(body).not.toContain("secret token");
      expect(response.headers.get("x-request-id")).toBeTruthy();
      expect(JSON.parse(body).requestId).toBe(response.headers.get("x-request-id"));
      expect(await (await request("/api/profile", a)).json()).toMatchObject({ name: "Installation A" });
    } finally {
      await database.pool.query("DROP TRIGGER reject_private_fixture ON profiles");
      await database.pool.query("DROP FUNCTION reject_private_fixture()");
    }
  });
  it("fails closed for disallowed origins, enrollment closure and missing migration readiness", async () => {
    expect((await request("/api/device-session", a, undefined, "GET", { origin: "https://untrusted.invalid" })).status).toBe(403);
    process.env.HINT_DEVICE_ENROLLMENT_CLOSED = "1";
    expect((await request("/api/device-sessions", undefined, {}, "POST")).status).toBe(503);
    delete process.env.HINT_DEVICE_ENROLLMENT_CLOSED;
    expect((await request("/api/readyz")).status).toBe(200);
    process.env.HINT_DRAINING = "1";
    expect((await request("/api/readyz")).status).toBe(503);
    delete process.env.HINT_DRAINING;
    process.env.HINT_ENROLLMENT_PER_IP_HOUR = "4";
    try {
      expect((await request("/api/device-sessions", undefined, {}, "POST", { "x-forwarded-for": "198.51.100.1" })).status).toBe(429);
      expect((await request("/api/device-sessions", undefined, {}, "POST", { "x-forwarded-for": "203.0.113.99" })).status).toBe(429);
    } finally { delete process.env.HINT_ENROLLMENT_PER_IP_HOUR; }
  });
});
