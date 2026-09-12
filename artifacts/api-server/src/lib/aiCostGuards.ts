import type { Request, Response } from "express";
import { authenticatedOwner } from "./deviceSession";
import { BudgetExceeded, positiveLimit, releaseProviderLease, takeBudget, trustedIpKey } from "./durableBudget";
type AiBudgetOptions = { feature: string; maxRequestsPerWindow?: number; windowMs?: number; dailyLimit?: number };

/** Durable request ceilings and admission leases apply before any live provider work. */
export async function consumeAiBudget(req: Request, res: Response,
  { feature, maxRequestsPerWindow = 6, windowMs = 60000, dailyLimit = 20 }: AiBudgetOptions): Promise<boolean> {
  const owner = authenticatedOwner(req);
  const prefix = `AI_LIMIT_${feature.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  try {
    const lease = await takeBudget([
      { key: `${feature}:minute:${owner}`, limit: positiveLimit(`${prefix}_PER_MINUTE`, maxRequestsPerWindow), windowMs },
      { key: `${feature}:day:${owner}`, limit: positiveLimit(`${prefix}_PER_DAY`, dailyLimit), windowMs: 86400000 },
      { key: `provider:ip:${trustedIpKey(req)}`, limit: positiveLimit("HINT_PROVIDER_PER_IP_MINUTE", 30), windowMs: 60000 },
      { key: "provider:global:day", limit: positiveLimit("HINT_PROVIDER_GLOBAL_DAY", 500), windowMs: 86400000 },
    ], owner);
    if (lease) {
      // An aborted request may still have provider work; retain its lease until expiry.
      res.once("finish", () => { void releaseProviderLease(lease).catch(() => {}); });
    }
    return true;
  } catch (error) {
    if (!(error instanceof BudgetExceeded)) throw error;
    res.status(429).set("Retry-After", String(error.retryAfter)).json({ error: error.message, code: "PROVIDER_BUDGET_EXHAUSTED" });
    return false;
  }
}
