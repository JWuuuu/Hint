import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import { pool } from "@workspace/db";
import { invitesRequired } from "./testerInvites";

export type DeviceSession = { id: string; ownerId: string; expiresAt: Date };
declare global { namespace Express { interface Request { deviceSession?: DeviceSession } } }
export function tokenHash(token: string) { return crypto.createHash("sha256").update(token).digest("hex"); }

export async function issueDeviceSession(inviteId: string | null = null, client: Pick<typeof pool, "query"> = pool) {
  const token = `hint_ds_${crypto.randomBytes(32).toString("hex")}`;
  const ownerId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 365 * 86400000);
  await client.query("INSERT INTO device_sessions(owner_id,token_hash,expires_at,invite_id) VALUES ($1,$2,$3,$4)", [ownerId, tokenHash(token), expiresAt, inviteId]);
  return { token, ownerId, expiresAt: expiresAt.toISOString() };
}
export async function readDeviceSession(token: string): Promise<DeviceSession | null> {
  if (!/^hint_ds_[a-f0-9]{64}$/.test(token)) return null;
  // A revoked invitation ends the sessions it enrolled. While invites are
  // required, a session enrolled without one is not accepted either.
  const result = await pool.query(`SELECT s.id,s.owner_id,s.expires_at FROM device_sessions s
    LEFT JOIN tester_invites i ON i.id=s.invite_id
    WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now()
      AND (i.id IS NULL OR i.revoked_at IS NULL) AND ($2::boolean = false OR s.invite_id IS NOT NULL)`, [tokenHash(token), invitesRequired()]);
  const row = result.rows[0];
  return row ? { id: row.id, ownerId: row.owner_id, expiresAt: row.expires_at } : null;
}
export const optionalDeviceSession: RequestHandler = async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  const authorization = req.header("authorization");
  if (!authorization) { next(); return; }
  const token = /^Bearer (\S+)$/.exec(authorization)?.[1];
  const session = token ? await readDeviceSession(token) : null;
  if (!session) { res.status(401).json({ error: "Device access expired or was revoked. Local data is unchanged.", code: "DEVICE_SESSION_INVALID" }); return; }
  req.deviceSession = session;
  next();
};
export const requireDeviceSession: RequestHandler = async (req, res, next) => {
  await optionalDeviceSession(req, res, () => {
    if (!req.deviceSession) { res.status(401).json({ error: "Connect this installation to the beta server first.", code: "DEVICE_SESSION_REQUIRED" }); return; }
    // Compatibility request fields remain accepted, but never establish server ownership.
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      req.body = { ...req.body, anonId: req.deviceSession.ownerId, anonymousDeviceId: req.deviceSession.ownerId,
        userId: req.deviceSession.ownerId, createdByUserId: req.deviceSession.ownerId };
    }
    res.set("Cache-Control", "private, no-store");
    next();
  });
};
export function authenticatedOwner(req: Request) {
  if (!req.deviceSession) throw Object.assign(new Error("Device session required"), { status: 401 });
  return req.deviceSession.ownerId;
}
