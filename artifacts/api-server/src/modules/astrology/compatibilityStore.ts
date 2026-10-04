import crypto from "node:crypto";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { db, compatibilityInvitesTable as invites, deviceSessionsTable } from "@workspace/db";
import type { BirthProfileInput, CompatibilityResult } from "./astrologyApiClient.js";
export class InviteError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function createCompatibilityInvite(ownerId: string, creatorInput: BirthProfileInput, relationshipType = "unclear") {
  const [row] = await db.insert(invites).values({ ownerId, creatorInput: { ...creatorInput }, relationshipType,
    token: crypto.randomBytes(24).toString("base64url"), expiresAt: new Date(Date.now() + 7 * 86400000) }).returning();
  return row!;
}
export async function findCompatibilityInvite(token: string) {
  const [row] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  if (!row) throw new InviteError(404, "Invite not found.");
  const [owner] = await db.select({ id: deviceSessionsTable.id }).from(deviceSessionsTable).where(sql`${deviceSessionsTable.ownerId}::text = ${row.ownerId}`).limit(1);
  if (!owner) throw new InviteError(410, "Create a new invitation for this beta version.");
  if (row.expiresAt.getTime() <= Date.now()) throw new InviteError(410, "Invite expired.");
  return row;
}
export function publicCompatibilityInvite(row: typeof invites.$inferSelect, viewerOwnerId?: string) {
  const participant = viewerOwnerId === row.ownerId || viewerOwnerId === row.accepterOwnerId;
  return { id: row.id, token: row.token, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(),
    status: row.status === "processing" && row.leaseUntil && row.leaseUntil.getTime() < Date.now() ? "failed" : row.status, creatorName: row.creatorInput.name, relationshipType: row.relationshipType, resultId: participant ? row.resultId : null };
}
export async function readCompatibilityResult(id: string, viewerOwnerId: string) {
  const [row] = await db.select().from(invites).where(and(eq(invites.resultId, id), eq(invites.status, "completed"))).limit(1);
  if (!row?.result) throw new InviteError(404, "Compatibility result not found.");
  if (viewerOwnerId !== row.ownerId && viewerOwnerId !== row.accepterOwnerId) throw new InviteError(404, "Compatibility result not found.");
  return row.result as unknown as CompatibilityResult;
}
/** Claim with a lease and fencing token. Late jobs cannot publish after retry or deletion. */
export async function completeCompatibilityInvite(token: string, friend: BirthProfileInput, consent: boolean,
  compute: (creator: BirthProfileInput, friend: BirthProfileInput) => Promise<CompatibilityResult>, accepterOwnerId: string) {
  if (!consent) throw new InviteError(400, "Consent is required.");
  const found = await findCompatibilityInvite(token);
  if (!accepterOwnerId || found.accepterOwnerId && found.accepterOwnerId !== accepterOwnerId) throw new InviteError(403, "This invitation has already been accepted by another installation.");
  if (found.ownerId === accepterOwnerId) throw new InviteError(403, "Open this invitation on the other participant's installation.");
  if (found.status !== "pending" && !found.accepterOwnerId) throw new InviteError(410, "Create a new invitation for this beta version.");
  if (found.status === "completed" && found.result) return { status: 200, resultId: found.resultId, result: found.result };
  const jobId = crypto.randomUUID();
  const [claimed] = await db.update(invites).set({ status: "processing", jobId, leaseUntil: new Date(Date.now() + 120000),
    friendInput: { ...friend }, consentAt: new Date(), accepterOwnerId }).where(and(eq(invites.id, found.id),
    or(eq(invites.accepterOwnerId, accepterOwnerId), sql`${invites.accepterOwnerId} IS NULL`),
    or(eq(invites.status, "pending"), eq(invites.status, "failed"), and(eq(invites.status, "processing"), lt(invites.leaseUntil, new Date()))))).returning();
  if (!claimed) {
    const latest = await findCompatibilityInvite(token);
    if (latest.accepterOwnerId !== accepterOwnerId) throw new InviteError(403, "This invitation has already been accepted by another installation.");
    return latest.status === "completed" ? { status: 200, resultId: latest.resultId, result: latest.result } : { status: 202 };
  }
  const heartbeat = setInterval(() => {
    void db.update(invites).set({ leaseUntil: new Date(Date.now() + 120000) }).where(and(eq(invites.id, claimed.id), eq(invites.jobId, jobId), eq(invites.status, "processing"))).catch(() => {});
  }, 15000);
  try {
    const result = await compute(claimed.creatorInput as BirthProfileInput, claimed.friendInput as BirthProfileInput);
    if (result.source !== "api" || result.people.user.chart.source !== "api" || result.people.friend.chart.source !== "api") throw new Error("Uncalculated result");
    const [saved] = await db.update(invites).set({ status: "completed", resultId: result.id, result: result as unknown as Record<string, unknown>, leaseUntil: null })
      .where(and(eq(invites.id, claimed.id), eq(invites.jobId, jobId), eq(invites.status, "processing"))).returning();
    if (!saved) throw new InviteError(409, "The invitation changed while calculating.");
    return { status: 200, resultId: result.id, result };
  } catch (error) {
    await db.update(invites).set({ status: "failed", leaseUntil: null }).where(and(eq(invites.id, claimed.id), eq(invites.jobId, jobId), eq(invites.status, "processing")));
    throw error instanceof InviteError ? error : new InviteError(503, "Compatibility calculation is unavailable. Please retry.");
  } finally { clearInterval(heartbeat); }
}
