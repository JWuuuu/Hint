import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ take: vi.fn(), release: vi.fn(), log: vi.fn() }));
vi.mock("@workspace/db", () => ({ pool: {} }));
vi.mock("./logger", () => ({ logger: { error: db.log } }));
vi.mock("./durableBudget", async original => ({
  ...await original<object>(), takeBudget: db.take, releaseProviderLease: db.release,
}));
import { aiRequestSignal, consumeAiBudget, withAiLease } from "./aiCostGuards";
import { BudgetExceeded } from "./durableBudget";
import { providerSignal, trackProviderWork } from "./providerCancellation";

function deferred<T = void>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const active = new Set<string>();
let committedCharges = 0;
function fixture(owner = "owner") {
  const req = Object.assign(new EventEmitter(), {
    aborted: false, ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" },
    deviceSession: { ownerId: owner },
  }) as unknown as Request;
  const res = Object.assign(new EventEmitter(), {
    destroyed: false, writableEnded: false, writableFinished: false,
    status: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(),
  }) as unknown as Response;
  const disconnect = () => {
    Object.defineProperty(res, "destroyed", { configurable: true, value: true });
    res.emit("close");
  };
  const run = (work: (signal: AbortSignal) => Promise<unknown>) => Promise.resolve(withAiLease(async (req, res) => {
    if (!await consumeAiBudget(req, res, { feature: "transcription", dailyLimit: 30 })) return;
    await work(aiRequestSignal(req));
  })(req, res, vi.fn()));
  return { req, res, disconnect, run };
}
beforeEach(() => {
  active.clear(); committedCharges = 0; vi.clearAllMocks();
  db.take.mockReset().mockImplementation(async () => {
    if (active.size >= 8) throw new BudgetExceeded(30);
    const lease = `lease-${++committedCharges}`;
    active.add(lease); return lease;
  });
  db.release.mockReset().mockImplementation(async (lease: string) => { active.delete(lease); });
});

it("releases a successful request once and preserves every budget rule", async () => {
  const f = fixture();
  await f.run(async signal => {
    expect(active.size).toBe(1);
    expect(providerSignal()).toBe(signal);
    Object.defineProperty(f.res, "writableFinished", { value: true });
    f.res.emit("finish"); f.res.emit("close");
    expect(signal.aborted).toBe(false);
  });
  expect(db.take).toHaveBeenCalledWith([
    { key: "transcription:minute:owner", limit: 6, windowMs: 60000 },
    { key: "transcription:day:owner", limit: 30, windowMs: 86400000 },
    { key: expect.stringMatching(/^provider:ip:/), limit: 30, windowMs: 60000 },
    { key: "provider:global:day", limit: 500, windowMs: 86400000 },
  ], "owner");
  expect(active.size).toBe(0); expect(committedCharges).toBe(1);
  expect(db.release).toHaveBeenCalledExactlyOnceWith("lease-1");
  expect(f.req.listenerCount("aborted")).toBe(0); expect(f.res.listenerCount("close")).toBe(0);
  expect(providerSignal()).toBeUndefined();
});

it.each(["failure", "timeout"])("releases on provider %s without requiring response.finish", async reason => {
  const f = fixture(), error = new Error(reason);
  await expect(f.run(async () => { throw error; })).rejects.toBe(error);
  expect(active.size).toBe(0); expect(committedCharges).toBe(1);
  expect(db.release).toHaveBeenCalledTimes(1);
});

it.each(["request aborted", "response closed"])("skips admission when already %s", async reason => {
  const f = fixture(), work = vi.fn();
  if (reason === "request aborted") Object.defineProperty(f.req, "aborted", { value: true });
  else f.disconnect();
  await f.run(work);
  expect(db.take).not.toHaveBeenCalled(); expect(work).not.toHaveBeenCalled(); expect(db.release).not.toHaveBeenCalled();
});

it("checks cancellation again just before admission", async () => {
  const f = fixture(), ready = deferred(), gate = deferred();
  const task = Promise.resolve(withAiLease(async (req, res) => {
    ready.resolve(); await gate.promise;
    expect(await consumeAiBudget(req, res, { feature: "speech" })).toBe(false);
  })(f.req, f.res, vi.fn()));
  await ready.promise; f.disconnect(); gate.resolve(); await task;
  expect(db.take).not.toHaveBeenCalled();
});

it("releases a lease acquired after disconnect and never calls the provider or refunds counters", async () => {
  const f = fixture(), admission = deferred<string>(), entered = deferred(), work = vi.fn();
  db.take.mockImplementationOnce(() => { entered.resolve(); return admission.promise; });
  const task = f.run(work);
  await entered.promise; f.disconnect(); f.req.emit("aborted");
  active.add("late-lease"); committedCharges++;
  admission.resolve("late-lease"); await task;
  expect(work).not.toHaveBeenCalled(); expect(f.res.json).not.toHaveBeenCalled();
  expect(db.release).toHaveBeenCalledExactlyOnceWith("late-lease");
  expect(active.size).toBe(0); expect(committedCharges).toBe(1);
});

it("does not write a late admission failure to a disconnected response", async () => {
  const f = fixture(), admission = deferred<string>(), entered = deferred();
  db.take.mockImplementationOnce(() => { entered.resolve(); return admission.promise; });
  const task = f.run(vi.fn());
  await entered.promise; f.disconnect(); admission.reject(new BudgetExceeded(30)); await task;
  expect(f.res.json).not.toHaveBeenCalled(); expect(db.release).not.toHaveBeenCalled();
  expect(f.req.listenerCount("aborted")).toBe(0); expect(f.res.listenerCount("close")).toBe(0);
});

it("keeps existing 429 behavior and does not release an unacquired lease", async () => {
  db.take.mockRejectedValueOnce(new BudgetExceeded(12));
  const f = fixture(), work = vi.fn(); await f.run(work);
  expect(f.res.status).toHaveBeenCalledWith(429); expect(f.res.set).toHaveBeenCalledWith("Retry-After", "12");
  expect(f.res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PROVIDER_BUDGET_EXHAUSTED" }));
  expect(work).not.toHaveBeenCalled(); expect(db.release).not.toHaveBeenCalled();
});

it("preserves authentication before consuming budget", async () => {
  const f = fixture(); delete f.req.deviceSession;
  await expect(f.run(vi.fn())).rejects.toThrow();
  expect(db.take).not.toHaveBeenCalled(); expect(db.release).not.toHaveBeenCalled();
});

it("does not free capacity until cancelled provider work actually settles", async () => {
  const f = fixture(), started = deferred<AbortSignal>(), settled = deferred();
  const task = f.run(async signal => { started.resolve(signal); await settled.promise; });
  const signal = await started.promise;
  f.disconnect(); f.res.emit("finish"); f.req.emit("aborted"); f.disconnect();
  expect(signal.aborted).toBe(true); expect(active.size).toBe(1); expect(db.release).not.toHaveBeenCalled();
  settled.resolve(); await task;
  f.disconnect(); f.res.emit("finish");
  expect(db.release).toHaveBeenCalledTimes(1); expect(active.size).toBe(0);
});

it("isolates eight concurrent requests, rejects a ninth, and releases each exactly once", async () => {
  const fixtures = Array.from({ length: 8 }, (_, i) => fixture(`owner-${i}`));
  const starts = fixtures.map(() => deferred<AbortSignal>());
  const completions = fixtures.map(() => deferred());
  const tasks = fixtures.map((f, i) => f.run(async signal => {
    await Promise.resolve(); expect(providerSignal()).toBe(signal);
    starts[i]!.resolve(signal); await completions[i]!.promise;
    expect(providerSignal()).toBe(signal);
  }));
  const signals = await Promise.all(starts.map(x => x.promise));
  const ninth = fixture("ninth"), extra = vi.fn(); await ninth.run(extra);
  expect(ninth.res.status).toHaveBeenCalledWith(429); expect(extra).not.toHaveBeenCalled();
  fixtures[0]!.disconnect();
  expect(signals[0]!.aborted).toBe(true); expect(signals.slice(1).every(s => !s.aborted)).toBe(true);
  fixtures.forEach(f => { f.disconnect(); f.req.emit("aborted"); f.res.emit("finish"); });
  expect(active.size).toBe(8);
  completions.forEach(x => x.resolve()); await Promise.all(tasks);
  expect(active.size).toBe(0); expect(committedCharges).toBe(8);
  expect(new Set(db.release.mock.calls.map(([id]) => id)).size).toBe(8); expect(db.release).toHaveBeenCalledTimes(8);
  await fixture("new-user").run(async () => undefined);
  expect(committedCharges).toBe(9); expect(active.size).toBe(0);
});

it("twenty sequential cancellations do not exhaust the eight provider slots", async () => {
  for (let i = 0; i < 20; i++) {
    const f = fixture(`owner-${i}`), started = deferred();
    const task = f.run(signal => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }); started.resolve();
    }));
    await started.promise; f.disconnect(); await task;
    expect(active.size).toBe(0);
  }
  expect(committedCharges).toBe(20); expect(db.release).toHaveBeenCalledTimes(20);
});

it("reports failed cleanup without hiding the provider error; expiry remains a failsafe", async () => {
  db.release.mockRejectedValueOnce(new Error("database unavailable"));
  const error = new Error("provider failed");
  await expect(fixture().run(async () => { throw error; })).rejects.toBe(error);
  expect(db.release).toHaveBeenCalledTimes(1); expect(db.log).toHaveBeenCalledWith(expect.stringContaining("lease release failed"));
});

it("cancels and drains parallel provider siblings before releasing after an early failure", async () => {
  const f = fixture(), started = deferred<AbortSignal>(), sibling = deferred(), failure = deferred();
  const error = new Error("first provider failed");
  const task = f.run(async () => {
    await Promise.all([
      trackProviderWork(() => failure.promise),
      trackProviderWork(async () => { started.resolve(providerSignal()!); await sibling.promise; }),
    ]);
  });
  const rejected = expect(task).rejects.toBe(error);
  const signal = await started.promise;
  failure.reject(error);
  await vi.waitFor(() => expect(signal.aborted).toBe(true));
  expect(active.size).toBe(1); expect(db.release).not.toHaveBeenCalled();
  sibling.resolve(); await rejected;
  expect(active.size).toBe(0); expect(db.release).toHaveBeenCalledTimes(1);
});
