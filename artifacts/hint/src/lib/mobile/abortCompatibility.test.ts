import { afterEach, expect, it, vi } from "vitest";
import { configureAbortCompatibility } from "./abortCompatibility";
const timeout = Object.getOwnPropertyDescriptor(AbortSignal, "timeout")!;
const throwing = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "throwIfAborted")!;
afterEach(() => {
  Object.defineProperty(AbortSignal, "timeout", timeout);
  Object.defineProperty(AbortSignal.prototype, "throwIfAborted", throwing);
  vi.useRealTimers();
});
it("supports cancellation and deadlines when the older WebView lacks both helpers", async () => {
  Object.defineProperty(AbortSignal, "timeout", { configurable: true, value: undefined });
  Object.defineProperty(AbortSignal.prototype, "throwIfAborted", { configurable: true, value: undefined });
  vi.useFakeTimers();
  configureAbortCompatibility();
  const signal = AbortSignal.timeout(20);
  expect(() => signal.throwIfAborted()).not.toThrow();
  await vi.advanceTimersByTimeAsync(20);
  expect(signal.aborted).toBe(true);
  expect(() => signal.throwIfAborted()).toThrow();
  const cancelled = new AbortController(); cancelled.abort();
  expect(() => cancelled.signal.throwIfAborted()).toThrow();
});
