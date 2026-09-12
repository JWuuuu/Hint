/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ token: vi.fn(async () => "fixture-token"), invalid: vi.fn() }));
vi.mock("./deviceSession", () => ({ getDeviceSessionToken: auth.token, invalidateDeviceSession: auth.invalid }));
import { apiFetch } from "./api";
import { getAnonId } from "./identity";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("authenticated API transport", () => {
  it.each([204, 205, 304])("preserves a bodyless %s response when WebKit exposes an empty stream", async status => {
    const response = new Response(null, { status, headers: { "X-Request-Id": "empty-fixture" } });
    // WebKit exposes a non-null, zero-byte stream for these network responses.
    Object.defineProperty(response, "body", { value: new ReadableStream({ start(controller) { controller.close(); } }) });
    vi.stubGlobal("fetch", vi.fn(async () => response));
    const result = await apiFetch("/api/history", { method: "DELETE" });
    expect(result.status).toBe(status);
    expect(result.body).toBeNull();
    expect(result.headers.get("X-Request-Id")).toBe("empty-fixture");
  });
  it("rejects a late private response body after a different profile is selected", async () => {
    const owner = getAnonId();
    const response = new Response("{}");
    vi.spyOn(response, "arrayBuffer").mockImplementation(async () => {
      localStorage.setItem("hint_anon_id", "another-profile");
      return new ArrayBuffer(0);
    });
    vi.stubGlobal("fetch", vi.fn(async () => response));
    await expect(apiFetch("/api/profile")).rejects.toMatchObject({ name: "AbortError" });
    localStorage.setItem("hint_anon_id", owner);
  });
  it("replaces caller authorization and refuses redirects", async () => {
    const fetcher = vi.fn(async () => new Response("{}")); vi.stubGlobal("fetch", fetcher);
    await apiFetch("/api/profile", { headers: { Authorization: "Bearer forged" } });
    expect(new Headers(fetcher.mock.calls[0]![1]!.headers).get("authorization")).toBe("Bearer fixture-token");
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ redirect: "error", credentials: "omit" });
  });
  it.each(["https://outside.test/api/profile", "/private", "//outside.test/api/profile"])("never sends a credential to %s", async path => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(apiFetch(path)).rejects.toThrow("Invalid API destination");
    expect(auth.token).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not send after cancellation and invalidates only the rejected token", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 401 })); vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController(); controller.abort();
    await expect(apiFetch("/api/profile", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
    await apiFetch("/api/profile");
    expect(auth.invalid).toHaveBeenCalledWith("fixture-token");
  });
});
