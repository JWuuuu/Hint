import { AsyncLocalStorage } from "node:async_hooks";

// Carry cancellation through the existing nested astrology provider calls
// without sharing a controller across requests or changing their public inputs.
type ProviderScope = { controller: AbortController; pending: Set<Promise<unknown>> };
const scopes = new AsyncLocalStorage<ProviderScope>();
export async function withProviderSignal<T>(controller: AbortController, work: () => T | Promise<T>): Promise<T> {
  const scope: ProviderScope = { controller, pending: new Set() };
  return scopes.run(scope, async () => {
    try { return await work(); }
    finally {
      // Promise.all can reject while sibling requests are still running.
      // Cancel leftover work and drain it before the request releases its lease.
      while (scope.pending.size) {
        controller.abort();
        await Promise.allSettled([...scope.pending]);
      }
    }
  });
}

export function trackProviderWork<T>(work: () => Promise<T>): Promise<T> {
  const scope = scopes.getStore();
  const pending = Promise.resolve().then(() => {
    scope?.controller.signal.throwIfAborted();
    return work();
  });
  scope?.pending.add(pending);
  // Use both handlers so the bookkeeping never creates an unhandled rejection.
  void pending.then(() => scope?.pending.delete(pending), () => scope?.pending.delete(pending));
  return pending;
}

export function providerSignal(timeoutMs?: number): AbortSignal | undefined {
  const signal = scopes.getStore()?.controller.signal;
  if (timeoutMs === undefined) return signal;
  const deadline = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
}
