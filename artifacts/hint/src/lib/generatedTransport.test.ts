import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customFetch, setBaseUrl, setAuthTokenGetter, setAuthFailureHandler, setRequestIdentityGetter } from "../../../../lib/api-client-react/src/custom-fetch";
const getter = vi.fn(async () => "test-credential");
beforeEach(() => {
  setBaseUrl("https://api.mydailyhint.com/gateway");
  setAuthTokenGetter(getter);
});
afterEach(() => { setBaseUrl(null); setAuthTokenGetter(null); setAuthFailureHandler(null); setRequestIdentityGetter(null); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("generated client credential boundary", () => {
  it("does not send a private request after its captured identity changes during enrollment", async () => {
    const owner = new AbortController();
    setRequestIdentityGetter(() => ({ signal: owner.signal, assertCurrent: () => owner.signal.throwIfAborted() }));
    setAuthTokenGetter(async () => { owner.abort(); return "old-owner-credential"; });
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(customFetch("/api/profile")).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a response body completed after an identity switch and removes abort listeners", async () => {
    const owner = new AbortController();
    const caller = new AbortController();
    const remove = vi.spyOn(owner.signal, "removeEventListener");
    setRequestIdentityGetter(() => ({ signal: owner.signal, assertCurrent: () => owner.signal.throwIfAborted() }));
    const response = new Response("{}", { headers: { "content-type": "application/json" } });
    vi.spyOn(response, "text").mockImplementation(async () => { owner.abort(); return '{"name":"Old private result"}'; });
    vi.stubGlobal("fetch", vi.fn(async () => response));
    await expect(customFetch("/api/profile", { signal: caller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
  it.each([
    "https://elsewhere.test/api/profile",
    new URL("https://elsewhere.test/api/profile"),
    new Request("https://elsewhere.test/api/profile"),
    "https://api.mydailyhint.com/api/profile",
    "https://someone:secret@api.mydailyhint.com/gateway/api/profile",
  ])("rejects an untrusted string/URL/Request destination before obtaining credentials", async destination => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(customFetch(destination)).rejects.toThrow("Invalid authenticated API destination");
    expect(getter).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("overwrites explicit caller Authorization at the configured API and forbids redirects", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } })); vi.stubGlobal("fetch", fetcher);
    await customFetch(new Request("https://api.mydailyhint.com/gateway/api/profile", { headers: { Authorization: "Bearer forged" } }));
    expect(new Headers(fetcher.mock.calls[0]![1]!.headers).get("authorization")).toBe("Bearer test-credential");
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ credentials: "omit", redirect: "error" });
  });
  it("checks a Request's own abort signal before enrollment", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(customFetch(new Request("https://api.mydailyhint.com/gateway/api/profile", { signal: controller.signal }))).rejects.toMatchObject({ name: "AbortError" });
    expect(getter).not.toHaveBeenCalled();
  });
  it("invalidates the exact rejected token", async () => {
    const invalid = vi.fn(); setAuthFailureHandler(invalid);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(customFetch("/api/profile")).rejects.toMatchObject({ status: 401 });
    expect(invalid).toHaveBeenCalledWith("test-credential");
  });
});
