import type { Request, RequestHandler, Response } from "express";
import { authenticatedOwner } from "./deviceSession";
import { BudgetExceeded, positiveLimit, releaseProviderLease, takeBudget, trustedIpKey } from "./durableBudget";
import { logger } from "./logger";
import { withProviderSignal } from "./providerCancellation";
type AiBudgetOptions = { feature: string; maxRequestsPerWindow?: number; windowMs?: number; dailyLimit?: number };

type AiRequestScope = { controller: AbortController; leases: Set<string>; disconnected: boolean };
const requestScopes = new WeakMap<Request, AiRequestScope>();

/** Own a lease until the awaited provider work settles, including after disconnect.
 * Releasing on close alone would admit new work while an uncancellable provider
 * call is still running. Register cancellation before admission, and release in
 * finally instead of depending on a response finish event that may never fire.
 */
export function withAiLease(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    const scope: AiRequestScope = { controller: new AbortController(), leases: new Set(), disconnected: false };
    requestScopes.set(req, scope);
    const cancel = () => { scope.disconnected = true; scope.controller.abort(); };
    const close = () => { if (!res.writableFinished) cancel(); };
    req.once("aborted", cancel);
    res.once("close", close);
    try {
      if (req.aborted || res.destroyed) cancel();
      if (!scope.controller.signal.aborted) {
        await withProviderSignal(scope.controller, () => handler(req, res, next));
      }
    } catch (error) {
      if (!scope.disconnected) throw error;
    } finally {
      req.off("aborted", cancel);
      res.off("close", close);
      requestScopes.delete(req);
      // Only concurrency leases are released. Committed request counters are
      // never refunded, even if cancellation won the race with admission.
      await Promise.all([...scope.leases].map(async lease => {
        try { await releaseProviderLease(lease); }
        catch { logger.error("Provider lease release failed; expiry remains the recovery fallback."); }
      }));
    }
  };
}

export function aiRequestSignal(req: Request): AbortSignal {
  const scope = requestScopes.get(req);
  if (!scope) throw new Error("AI requests must run inside withAiLease.");
  return scope.controller.signal;
}

/** Durable request ceilings and admission leases apply before any live provider work. */
export async function consumeAiBudget(req: Request, res: Response,
  { feature, maxRequestsPerWindow = 6, windowMs = 60000, dailyLimit = 20 }: AiBudgetOptions): Promise<boolean> {
  const scope = requestScopes.get(req);
  if (!scope) throw new Error("AI requests must run inside withAiLease.");
  if (scope.controller.signal.aborted || res.destroyed || res.writableEnded) return false;
  const owner = authenticatedOwner(req);
  const prefix = `AI_LIMIT_${feature.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  try {
    const lease = await takeBudget([
      { key: `${feature}:minute:${owner}`, limit: positiveLimit(`${prefix}_PER_MINUTE`, maxRequestsPerWindow), windowMs },
      { key: `${feature}:day:${owner}`, limit: positiveLimit(`${prefix}_PER_DAY`, dailyLimit), windowMs: 86400000 },
      { key: `provider:ip:${trustedIpKey(req)}`, limit: positiveLimit("HINT_PROVIDER_PER_IP_MINUTE", 30), windowMs: 60000 },
      { key: "provider:global:day", limit: positiveLimit("HINT_PROVIDER_GLOBAL_DAY", 500), windowMs: 86400000 },
    ], owner);
    if (lease) scope.leases.add(lease);
    // Admission may finish after the client has gone away. Keep ownership of
    // that lease for finally, but never start a provider call in that case.
    return !scope.controller.signal.aborted && !res.destroyed && !res.writableEnded;
  } catch (error) {
    if (scope.controller.signal.aborted || res.destroyed) return false;
    if (!(error instanceof BudgetExceeded)) throw error;
    res.status(429).set("Retry-After", String(error.retryAfter)).json({ error: error.message, code: "PROVIDER_BUDGET_EXHAUSTED" });
    return false;
  }
}
