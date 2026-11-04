import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
const enabled = process.env.HINT_ISOLATED_DB === "1";
type Credential = { token: string; ownerId: string; expiresAt: string };
let database: typeof import("@workspace/db");
let invites: typeof import("../lib/testerInvites");
let server: Server;
let origin: string;
const saved = { required: process.env.HINT_TESTER_INVITES_REQUIRED, perIp: process.env.HINT_ENROLLMENT_PER_IP_HOUR };
const run = crypto.randomUUID().slice(0, 8);

async function enroll(body: unknown) {
  return fetch(`${origin}/api/device-sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function sessionStatus(credential: Credential) {
  return (await fetch(`${origin}/api/device-session`, { headers: { authorization: `Bearer ${credential.token}` } })).status;
}
async function createInvite(label: string, maxDevices: number) {
  const code = invites.generateInviteCode();
  const row = (await database.pool.query("INSERT INTO tester_invites(code_hash,label,max_devices) VALUES ($1,$2,$3) RETURNING id",
    [invites.inviteCodeHash(code), `${label}-${run}`, maxDevices])).rows[0] as { id: string };
  return { id: row.id, code: invites.formatInviteCode(code) };
}

describe.skipIf(!enabled)("private beta tester invites", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality") throw new Error("Refusing non-isolated database");
    process.env.HINT_ENROLLMENT_PER_IP_HOUR = "200";
    database = await import("@workspace/db");
    invites = await import("../lib/testerInvites");
    await database.pool.query("DELETE FROM request_budgets WHERE bucket_key LIKE 'enrollment:%'");
    const app = (await import("../app")).default;
    server = await new Promise<Server>(resolve => { const listening = app.listen(0, "127.0.0.1", () => resolve(listening)); });
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    process.env.HINT_TESTER_INVITES_REQUIRED = saved.required;
    process.env.HINT_ENROLLMENT_PER_IP_HOUR = saved.perIp;
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await database?.pool.end();
  });

  it("refuses new devices without a valid invite and stores only the code's hash", async () => {
    process.env.HINT_TESTER_INVITES_REQUIRED = "1";
    const invite = await createInvite("alice", 3);
    for (const [body, code] of [[{}, "INVITE_REQUIRED"], [{ inviteCode: "" }, "INVITE_REQUIRED"], [{ inviteCode: "not a code" }, "INVITE_INVALID"],
      [{ inviteCode: "ZZZZ-ZZZZ" }, "INVITE_INVALID"], [{ inviteCode: { $ne: null } }, "INVITE_INVALID"]] as const) {
      const response = await enroll(body);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code });
    }
    const response = await enroll({ inviteCode: invite.code.toLowerCase().replace("-", " ") });
    expect(response.status).toBe(201);
    const credential = await response.json() as Credential;
    const row = (await database.pool.query("SELECT invite_id FROM device_sessions WHERE owner_id=$1", [credential.ownerId])).rows[0];
    expect(row.invite_id).toBe(invite.id);
    const stored = JSON.stringify((await database.pool.query("SELECT * FROM tester_invites WHERE id=$1", [invite.id])).rows[0]);
    expect(stored).not.toContain(invite.code.replace("-", ""));
    expect(await sessionStatus(credential)).toBe(200);
  });

  it("caps devices per invite, even when they connect at the same time", async () => {
    process.env.HINT_TESTER_INVITES_REQUIRED = "1";
    const pair = await createInvite("pair", 2);
    const results = await Promise.all([enroll({ inviteCode: pair.code }), enroll({ inviteCode: pair.code }), enroll({ inviteCode: pair.code })]);
    expect(results.map(result => result.status).sort()).toEqual([201, 201, 403]);
    const refused = results.find(result => result.status === 403)!;
    expect(await refused.json()).toMatchObject({ code: "INVITE_EXHAUSTED" });
    const active = (await database.pool.query("SELECT count(*)::int AS n FROM device_sessions WHERE invite_id=$1", [pair.id])).rows[0].n;
    expect(active).toBe(2);
  });

  it("ends an invite's sessions when it is revoked, and refuses sessions enrolled without one", async () => {
    process.env.HINT_TESTER_INVITES_REQUIRED = "0";
    const open = await (await enroll({})).json() as Credential;
    const bob = await createInvite("bob", 1);
    const invited = await (await enroll({ inviteCode: bob.code })).json() as Credential;
    expect((await database.pool.query("SELECT invite_id FROM device_sessions WHERE owner_id=$1", [invited.ownerId])).rows[0].invite_id).toBe(bob.id);
    expect(await sessionStatus(open)).toBe(200);
    process.env.HINT_TESTER_INVITES_REQUIRED = "1";
    expect(await sessionStatus(open)).toBe(401);
    expect(await sessionStatus(invited)).toBe(200);
    await database.pool.query("UPDATE tester_invites SET revoked_at=now() WHERE id=$1", [bob.id]);
    expect(await sessionStatus(invited)).toBe(401);
    expect((await enroll({ inviteCode: bob.code })).status).toBe(403);
  });

  it("keeps enrollment open without a code when invites are not required", async () => {
    process.env.HINT_TESTER_INVITES_REQUIRED = "0";
    expect((await enroll({})).status).toBe(201);
    expect((await enroll({ inviteCode: "ZZZZ-ZZZZ" })).status).toBe(201);
  });
});
