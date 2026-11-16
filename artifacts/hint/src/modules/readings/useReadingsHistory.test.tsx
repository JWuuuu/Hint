/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getListReadingsQueryKey, setAuthTokenGetter, setRequestIdentityGetter } from "@workspace/api-client-react";
import { readHistory, useReadingsHistory } from "./useReadingsHistory";

const identity = vi.hoisted(() => ({ owner: "history-fixture", controller: new AbortController() }));
vi.mock("../../lib/identity", () => ({ captureIdentityContext: () => {
  const owner = identity.owner, signal = identity.controller.signal;
  return { owner, signal, assertCurrent: () => { signal.throwIfAborted(); if (owner !== identity.owner) throw new DOMException("Changed", "AbortError"); } };
} }));
const clients: QueryClient[] = [];
const row = { id: "saved", cardName: "The Star", whisper: "Saved words", spreadType: "daily-pull", question: null, territory: "daily", createdAt: "2026-11-10T12:00:00Z" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
function clientHook() {
  const client = new QueryClient(); clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return { client, ...renderHook(() => useReadingsHistory(identity.owner), { wrapper }) };
}
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); identity.owner = "history-fixture"; identity.controller = new AbortController(); setAuthTokenGetter(null); setRequestIdentityGetter(null); onlineManager.setOnline(true); });
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.useRealTimers(); vi.unstubAllGlobals(); setAuthTokenGetter(null); setRequestIdentityGetter(null); onlineManager.setOnline(true); });

it.each(["headers", "body"])("settles stalled %s after10s and aborts transport without automatic retry", async phase => {
  const fetcher = vi.fn<typeof fetch>(() => phase === "headers" ? new Promise<Response>(() => {}) : Promise.resolve(new Response(new ReadableStream(), { headers: { "content-type": "application/json" } })));
  vi.stubGlobal("fetch", fetcher);
  const hook = clientHook();
  await act(async () => { await vi.advanceTimersByTimeAsync(9_999); });
  expect(hook.result.current.isPending).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(2); });
  expect(hook.result.current.error).toMatchObject({ name: "TimeoutError" });
  expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(fetcher).toHaveBeenCalledOnce();
});

it.each(["timeout", "503"])("a deliberate retry after%s gets a fresh deadline and keeps the same query key", async failure => {
  const fetcher = vi.fn().mockImplementationOnce(() => failure === "timeout" ? new Promise(() => {}) : Promise.resolve(json({ error: "fixture" }, 503))).mockResolvedValue(json([row]));
  vi.stubGlobal("fetch", fetcher); const hook = clientHook();
  await act(async () => { await vi.advanceTimersByTimeAsync(failure === "timeout" ? 10_001 : 1); });
  expect(hook.result.current.isError).toBe(true);
  await act(async () => { await hook.result.current.refetch(); await vi.advanceTimersByTimeAsync(1); });
  expect(hook.result.current.data).toEqual([row]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(hook.client.getQueryData(getListReadingsQueryKey({ anonId: identity.owner }))).toEqual([row]);
});

it("unmount cancels the pending query rather than waiting for its deadline", async () => {
  const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>(() => {})); vi.stubGlobal("fetch", fetcher);
  const hook = clientHook(); await act(async () => { await vi.advanceTimersByTimeAsync(1); }); hook.unmount();
  expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  expect(fetcher.mock.calls[0]![1]!.signal!.reason.name).toBe("AbortError");
});

it("rejects identity changes even if a late transport resolves", async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  const work = readHistory(identity.owner).catch(e => e); await vi.advanceTimersByTimeAsync(0);
  identity.controller.abort(new DOMException("Local profile changed", "AbortError")); identity.owner = "other-owner";
  expect(await work).toMatchObject({ name: "AbortError" }); finish(json([row])); await vi.advanceTimersByTimeAsync(0);
  expect(await work).not.toEqual([row]);
});

it("history clear cancels in-flight data and removes earlier cached records", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json([row])).mockImplementation(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetcher); const hook = clientHook();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); }); expect(hook.result.current.data).toEqual([row]);
  await act(async () => { void hook.result.current.refetch(); await vi.advanceTimersByTimeAsync(1); });
  await act(async () => { localStorage.setItem(`hint_history_clear_version_v1:${identity.owner}`, "cleared"); window.dispatchEvent(new Event("storage")); await vi.advanceTimersByTimeAsync(1); });
  expect(hook.result.current.data).toEqual([]); expect(fetcher.mock.calls[1]![1]!.signal.aborted).toBe(true);
});

it("cached rows stay available on a failed refresh and offline queries stay paused", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json([row])).mockResolvedValue(json({}, 503)); vi.stubGlobal("fetch", fetcher);
  const hook = clientHook(); await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  await act(async () => { await hook.result.current.refetch(); await vi.advanceTimersByTimeAsync(1); });
  expect(hook.result.current.isError).toBe(true); expect(hook.result.current.data).toEqual([row]);
  hook.unmount(); onlineManager.setOnline(false);
  const offline = clientHook(); await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(offline.result.current.fetchStatus).toBe("paused"); expect(offline.result.current.isPending).toBe(true); expect(fetcher).toHaveBeenCalledTimes(2);
});
