/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ token: vi.fn(async () => "fixture-token"), invalid: vi.fn() }));
vi.mock("./deviceSession", () => ({ getDeviceSessionToken: auth.token, invalidateDeviceSession: auth.invalid }));
import { apiFetch } from "./api";
import { customFetch, setAuthTokenGetter, setAuthFailureHandler, setBaseUrl, setRequestIdentityGetter } from "../../../../lib/api-client-react/src/custom-fetch";

const pending = <T,>() => new Promise<T>(() => {});
beforeEach(() => { vi.useFakeTimers(); auth.token.mockResolvedValue("fixture-token"); setBaseUrl(null); setAuthTokenGetter(auth.token); setAuthFailureHandler(auth.invalid); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setAuthTokenGetter(null); setAuthFailureHandler(null); setRequestIdentityGetter(null); });

describe.each([
  ["direct", (signal?: AbortSignal) => apiFetch("/api/profile", { signal })],
  ["generated", (signal?: AbortSignal) => customFetch("/api/profile", { signal })],
] as const)("%s request recovery", (_name, request) => {
  it.each(["enrollment", "headers", "success body", "error body"])("settles a stalled %s without revoking the credential", async phase => {
    const response = new Response("{}", { status: phase === "error body" ? 503 : 200, headers: { "content-type": "application/json" } });
    if (phase.includes("body")) {
      vi.spyOn(response, "text").mockImplementation(() => pending<string>());
      vi.spyOn(response, "arrayBuffer").mockImplementation(() => pending<ArrayBuffer>());
    }
    if (phase === "enrollment") auth.token.mockImplementation(() => pending<string>());
    const fetcher = vi.fn(() => phase === "headers" ? pending<Response>() : Promise.resolve(response));
    vi.stubGlobal("fetch", fetcher);
    let outcome: unknown = "pending";
    void request().then(value => { outcome = value; }, error => { outcome = error; });
    await vi.advanceTimersByTimeAsync(120_001);
    expect(outcome).toMatchObject({ name: "TimeoutError" });
    expect(auth.invalid).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(phase === "enrollment" ? 0 : 1);
    if (phase !== "enrollment") expect(fetcher.mock.calls[0]![1]!.signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("honors caller cancellation even when transport ignores its signal", async () => {
    const caller = new AbortController();
    const reason = new DOMException("User left the page", "AbortError");
    vi.stubGlobal("fetch", vi.fn(() => pending<Response>()));
    let outcome: unknown = "pending";
    void request(caller.signal).then(value => { outcome = value; }, error => { outcome = error; });
    await vi.advanceTimersByTimeAsync(0);
    caller.abort(reason);
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome).toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("clears the deadline after success and permits a fresh attempt after timeout", async () => {
    const fetcher = vi.fn().mockImplementationOnce(() => pending<Response>()).mockImplementation(() => Promise.resolve(new Response("{}", { headers: { "content-type": "application/json" } })));
    vi.stubGlobal("fetch", fetcher);
    let error: unknown;
    void request().catch(value => { error = value; });
    await vi.advanceTimersByTimeAsync(120_001);
    expect(error).toMatchObject({ name: "TimeoutError" });
    await request();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("allows a slow successful response including a delayed body", async () => {
    let headers!: (response: Response) => void; let body!: () => void;
    const response = new Response(new ReadableStream({ start(controller) { body = () => { controller.enqueue(new TextEncoder().encode("{}")); controller.close(); }; } }), { headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { headers = resolve; })));
    let outcome: unknown = "pending";
    const work = request().then(value => { outcome = value; });
    await vi.advanceTimersByTimeAsync(90_000); expect(outcome).toBe("pending"); headers(response);
    await vi.advanceTimersByTimeAsync(19_000); expect(outcome).toBe("pending"); body();
    await work; expect(outcome).not.toBe("pending"); expect(vi.getTimerCount()).toBe(0);
  });
  it("retains a shorter endpoint deadline and its original reason", async () => {
    const endpoint = new AbortController(); const reason = new DOMException("Endpoint timed out", "TimeoutError");
    setTimeout(() => endpoint.abort(reason), 8_000);
    vi.stubGlobal("fetch", vi.fn(() => pending<Response>()));
    let outcome: unknown = "pending";
    void request(endpoint.signal).catch(error => { outcome = error; });
    await vi.advanceTimersByTimeAsync(8_001);
    expect(outcome).toBe(reason); expect(vi.getTimerCount()).toBe(0);
  });
});

it("preserves raw audio bytes in direct and generated Blob responses", async () => {
  const bytes = new Uint8Array([0, 1, 128, 255]);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(bytes, { headers: { "content-type": "audio/mpeg" } }))));
  const direct = await apiFetch("/api/speech"); expect(new Uint8Array(await direct.arrayBuffer())).toEqual(bytes);
  const blob = await customFetch<Blob>("/api/speech", { responseType: "blob" }); expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not send a request when enrollment resolves after the deadline", async () => {
  let enroll!: (token: string) => void;
  auth.token.mockImplementation(() => new Promise(resolve => { enroll = resolve; }));
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const outcome = customFetch("/api/profile").catch(error => error);
  await vi.advanceTimersByTimeAsync(120_001); expect(await outcome).toMatchObject({ name: "TimeoutError" });
  enroll("late-token"); await vi.advanceTimersByTimeAsync(0); expect(fetcher).not.toHaveBeenCalled();
});
