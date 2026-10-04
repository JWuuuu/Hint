import crypto from "node:crypto";
import { pool } from "@workspace/db";
import type { Request } from "express";
export type BudgetRule = { key: string; limit: number; windowMs: number };
export class BudgetExceeded extends Error {
  constructor(public retryAfter: number) { super("Request limit reached. Please retry later."); }
}
export function positiveLimit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
/** Express resolves forwarded addresses only through the explicitly configured trusted proxy list. */
export function trustedIpKey(req: Request) {
  return crypto.createHash("sha256").update(req.ip || req.socket.remoteAddress || "unknown").digest("hex");
}
/** One transaction checks all buckets before incrementing any of them. Shared across restarts and instances. */
export async function takeBudget(rules: BudgetRule[], leaseOwner?: string): Promise<string | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(718095905)");
    const now = Number((await client.query("SELECT extract(epoch FROM now()) * 1000 AS ms")).rows[0].ms);
    await client.query("DELETE FROM request_budgets WHERE expires_at <= now()");
    await client.query("DELETE FROM provider_leases WHERE expires_at <= now()");
    for (const rule of rules) {
      const start = new Date(Math.floor(now / rule.windowMs) * rule.windowMs);
      const expiry = new Date(start.getTime() + rule.windowMs);
      const existing = await client.query("SELECT used FROM request_budgets WHERE bucket_key=$1 AND period_start=$2", [rule.key, start]);
      if ((existing.rows[0]?.used ?? 0) >= rule.limit) throw new BudgetExceeded(Math.max(1, Math.ceil((expiry.getTime() - now) / 1000)));
      await client.query("INSERT INTO request_budgets(bucket_key,period_start,used,expires_at) VALUES ($1,$2,1,$3) ON CONFLICT(bucket_key,period_start) DO UPDATE SET used=request_budgets.used+1", [rule.key, start, expiry]);
    }
    let lease: string | null = null;
    if (leaseOwner) {
      const active = Number((await client.query("SELECT count(*) AS count FROM provider_leases")).rows[0].count);
      if (active >= positiveLimit("HINT_PROVIDER_MAX_CONCURRENT", 8)) throw new BudgetExceeded(30);
      lease = crypto.randomUUID();
      // All provider calls have bounded timeouts. Aborted requests retain this conservative lease until expiry.
      await client.query("INSERT INTO provider_leases(id,owner_id,expires_at) VALUES ($1,$2,now()+interval '10 minutes')", [lease, leaseOwner]);
    }
    await client.query("COMMIT");
    return lease;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function releaseProviderLease(id: string) { await pool.query("DELETE FROM provider_leases WHERE id=$1", [id]); }
