import { Router } from "express";
import { pool } from "@workspace/db";
import { issueDeviceSession, requireDeviceSession } from "../lib/deviceSession";
import { claimInvite, InviteAccessError, invitesRequired, normalizeInviteCode } from "../lib/testerInvites";
import { takeBudget, trustedIpKey, positiveLimit } from "../lib/durableBudget";
const router = Router();
router.use("/device-session", requireDeviceSession, async (req, _res, next) => {
  await takeBudget([{ key: `session-control:${req.deviceSession!.ownerId}`, limit: 60, windowMs: 60000 }]);
  next();
});
router.post("/device-sessions", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (process.env.HINT_DEVICE_ENROLLMENT_CLOSED === "1") {
    res.status(503).json({ error: "New beta connections are temporarily closed. Local features remain available.", code: "DEVICE_ENROLLMENT_CLOSED" }); return;
  }
  await takeBudget([
    { key: `enrollment:ip:${trustedIpKey(req)}`, limit: positiveLimit("HINT_ENROLLMENT_PER_IP_HOUR", 10), windowMs: 3600000 },
    { key: "enrollment:global", limit: positiveLimit("HINT_ENROLLMENT_GLOBAL_DAY", 200), windowMs: 86400000 },
  ]);
  const inviteCode: unknown = req.body?.inviteCode;
  // Without the requirement, a valid code is still recorded so those sessions
  // keep working once invites become required; other codes are ignored.
  if (!invitesRequired() && !normalizeInviteCode(inviteCode)) { res.status(201).json(await issueDeviceSession()); return; }
  // The budget above already counted this attempt, so wrong codes stay rate limited.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inviteId = await claimInvite(client, inviteCode).catch(error => {
      if (!invitesRequired() && error instanceof InviteAccessError) return null;
      throw error;
    });
    const session = await issueDeviceSession(inviteId, client);
    await client.query("COMMIT");
    res.status(201).json(session);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof InviteAccessError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
    throw error;
  } finally { client.release(); }
});
router.get("/device-session", (req, res) => {
  res.json({ ownerId: req.deviceSession!.ownerId, expiresAt: req.deviceSession!.expiresAt.toISOString() });
});
router.delete("/device-session", async (req, res) => {
  await pool.query("UPDATE device_sessions SET revoked_at=now() WHERE id=$1", [req.deviceSession!.id]);
  res.status(204).send();
});
export default router;
