import { getEventListeners } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { providerSignal, withProviderDeadline, withProviderSignal } from "./providerCancellation";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it.each(["success", "failure"] as const)("removes the timer and parent listener after %s", async outcome => {
  const controller = new AbortController();
  const started = deferred<AbortSignal>(), body = deferred<string>();
  const work = withProviderSignal(controller, () => withProviderDeadline(15_000, async signal => {
    started.resolve(signal); const value = await body.promise;
    if (outcome === "failure") throw new Error(value);
    return value;
  }));
  const result = Promise.allSettled([work]);
  const signal = await started.promise;
  expect(vi.getTimerCount()).toBe(1);
  expect(getEventListeners(controller.signal, "abort")).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(14_999);
  expect(signal.aborted).toBe(false);
  body.resolve("finished");
  expect((await result)[0].status).toBe(outcome === "success" ? "fulfilled" : "rejected");
  expect(vi.getTimerCount()).toBe(0);
  expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(60_000);
  controller.abort(); expect(signal.aborted).toBe(false);
  expect(providerSignal()).toBeUndefined();
});

it.each(["deadline-first", "cancel-first"] as const)("settles once and cleans up when timeout and cancellation collide: %s", async order => {
  const controller = new AbortController();
  const started = deferred<AbortSignal>();
  let aborts = 0;
  const work = withProviderSignal(controller, () => withProviderDeadline(15_000, signal => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborts++; reject(signal.reason); }, { once: true });
    started.resolve(signal);
  })));
  const outcome = Promise.allSettled([work]);
  const signal = await started.promise;
  if (order === "cancel-first") controller.abort();
  await vi.advanceTimersByTimeAsync(15_000);
  controller.abort();
  expect((await outcome)[0]).toMatchObject({ status: "rejected", reason: { name: order === "deadline-first" ? "TimeoutError" : "AbortError" } });
  expect(aborts).toBe(1); expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
});

it("waits for a transport that settles late after abort and rejects its stale result", async () => {
  const controller = new AbortController(), started = deferred<AbortSignal>(), late = deferred<string>();
  let settled = false;
  const work = withProviderSignal(controller, () => withProviderDeadline(15_000, signal => { started.resolve(signal); return late.promise; }));
  const outcome = Promise.allSettled([work]).then(result => { settled = true; return result; });
  const signal = await started.promise;
  await vi.advanceTimersByTimeAsync(15_000);
  expect(signal.reason.name).toBe("TimeoutError"); expect(controller.signal.aborted).toBe(false);
  expect(settled).toBe(false);
  late.resolve("stale success");
  expect((await outcome)[0]).toMatchObject({ status: "rejected", reason: { name: "TimeoutError" } });
  expect(vi.getTimerCount()).toBe(0); expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
});

it("does not start work in a pre-cancelled request scope", async () => {
  const controller = new AbortController(); controller.abort();
  const work = vi.fn();
  await expect(withProviderSignal(controller, () => withProviderDeadline(15_000, work))).rejects.toMatchObject({ name: "AbortError" });
  expect(work).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
});

it("bounds direct adapter work even without an HTTP request scope", async () => {
  const started = deferred<AbortSignal>();
  const work = withProviderDeadline(15_000, signal => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true }); started.resolve(signal);
  }));
  const outcome = Promise.allSettled([work]);
  await started.promise; await vi.advanceTimersByTimeAsync(15_000);
  expect((await outcome)[0]).toMatchObject({ status: "rejected", reason: { name: "TimeoutError" } });
  expect(vi.getTimerCount()).toBe(0);
});
