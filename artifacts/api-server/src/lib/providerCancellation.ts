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

/** Abort the actual transport, including body reads, and keep it tracked until
 * it settles. A Promise.race would release the lease while work could still run.
 */
export function withProviderDeadline<T>(timeoutMs: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  return trackProviderWork(async () => {
    const parent = providerSignal();
    const controller = new AbortController();
    const cancel = () => controller.abort(parent?.reason);
    parent?.addEventListener("abort", cancel, { once: true });
    if (parent?.aborted) cancel();
    const timer = setTimeout(() => controller.abort(new DOMException("Provider request timed out", "TimeoutError")), timeoutMs);
    timer.unref();
    try {
      controller.signal.throwIfAborted();
      const result = await work(controller.signal);
      controller.signal.throwIfAborted();
      return result;
    } finally {
      clearTimeout(timer);
      parent?.removeEventListener("abort", cancel);
    }
  });
}

export function providerSignal(timeoutMs?: number): AbortSignal | undefined {
  const signal = scopes.getStore()?.controller.signal;
  if (timeoutMs === undefined) return signal;
  const deadline = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
}
